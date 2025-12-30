import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma, ActorType, OrderStatus, PaymentStatus, ComplianceDecision, FlavorType, UserRole } from '@lumi/db';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { capturePayment, type AuthorizeNetError } from '../services/authorizenet.js';
import { hashPassword } from '../plugins/auth.js';
import { createShippingLabel, type ShippoError } from '../services/shippo.js';
import { generatePactCsv, type PactReportRow } from '../utils/csv-generator.js';
import { inngest } from '../plugins/inngest.js';
import crypto from 'crypto';

const s3Client = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
  },
});

const presignSchema = z.object({
  key: z.string().min(1),
  contentType: z.string(),
  sizeBytes: z.number().int().positive(),
});

export const adminRoutes: FastifyPluginAsync = async (fastify) => {
  // All admin routes require authentication and admin role
  fastify.addHook('preHandler', async (request, reply) => {
    await fastify.requireAdmin(request, reply);
  });

  fastify.get<{ Querystring: { page?: string; pageSize?: string } }>('/audit-events', async (request, reply) => {
    const page = Number(request.query.page) || 1;
    const pageSize = Math.min(Number(request.query.pageSize) || 50, 100);
    const skip = (page - 1) * pageSize;

    const [items, total] = await Promise.all([
      prisma.auditEvent.findMany({
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          actorUser: {
            select: {
              id: true,
              email: true,
            },
          },
        },
      }),
      prisma.auditEvent.count(),
    ]);

    return {
      success: true,
      data: {
        items,
        total,
        page,
        pageSize,
      },
    };
  });

  fastify.get('/configs', async () => {
    const configs = await prisma.config.findMany({
      orderBy: { key: 'asc' },
    });

    return {
      success: true,
      data: configs,
    };
  });

  fastify.put<{ Params: { key: string }; Body: { value: unknown } }>('/configs/:key', async (request, reply) => {
    const { key } = request.params;
    const body = request.body;

    if (!body.value) {
      return reply.code(400).send({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'value is required' },
      });
    }

    const config = await prisma.config.upsert({
      where: { key },
      update: {
        valueJson: body.value,
      },
      create: {
        key,
        valueJson: body.value,
      },
    });

    // Audit log
    if (request.user) {
      await prisma.auditEvent.create({
        data: {
          actorUserId: request.user.id,
          actorType: 'USER',
          action: 'UPDATE_CONFIG',
          entityType: 'CONFIG',
          entityId: config.id,
          result: 'SUCCESS',
        },
      });
    }

    return {
      success: true,
      data: config,
    };
  });

  fastify.post('/files/presign', async (request, reply) => {
    const body = presignSchema.parse(request.body);

    const bucket = process.env.R2_BUCKET_NAME || 'lumi-files';
    const expiresIn = 3600; // 1 hour

    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: body.key,
      ContentType: body.contentType,
      ContentLength: body.sizeBytes,
    });

    const url = await getSignedUrl(s3Client, command, { expiresIn });

    return {
      success: true,
      data: {
        url,
        key: body.key,
        expiresIn,
      },
    };
  });

  // Get orders list (admin only)
  fastify.get<{ Querystring: { status?: string; statuses?: string | string[]; search?: string; page?: string; pageSize?: string; startDate?: string; endDate?: string } }>('/orders', async (request, reply) => {
    const status = request.query.status;
    const statuses = Array.isArray(request.query.statuses) ? request.query.statuses : (request.query.statuses ? [request.query.statuses] : undefined);
    const search = request.query.search;
    const startDate = request.query.startDate;
    const endDate = request.query.endDate;
    const page = Number(request.query.page) || 1;
    const pageSize = Math.min(Number(request.query.pageSize) || 50, 100);
    const skip = (page - 1) * pageSize;

    const where: any = {};
    if (status) {
      where.status = status;
    } else if (statuses && statuses.length > 0) {
      where.status = { in: statuses };
    }
    if (search) {
      where.id = { contains: search };
    }
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        where.createdAt.gte = new Date(startDate);
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        where.createdAt.lte = end;
      }
    }

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          shippingAddress: {
            select: {
              state: true,
            },
          },
          complianceSnapshot: {
            select: {
              stakeCallRequired: true,
            },
          },
        },
      }),
      prisma.order.count({ where }),
    ]);

    return {
      success: true,
      data: {
        items: orders,
        total,
        page,
        pageSize,
      },
    };
  });

  // Get order detail (admin only)
  fastify.get<{ Params: { id: string } }>('/orders/:id', async (request, reply) => {
    const { id } = request.params;

    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        shippingAddress: true,
        billingAddress: true,
        items: {
          include: {
            product: true,
          },
        },
        complianceSnapshot: true,
        ageVerification: true,
        payments: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        stakeCalls: {
          orderBy: { calledAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!order) {
      return reply.code(404).send({
        success: false,
        error: { code: 'ORDER_NOT_FOUND', message: 'Order not found' },
      });
    }

    return {
      success: true,
      data: order,
    };
  });

  // STAKE Act call endpoint
  const stakeCallSchema = z.object({
    notes: z.string().min(1),
  });

  fastify.post<{ Params: { id: string }; Body: z.infer<typeof stakeCallSchema> }>('/orders/:id/stake-call', async (request, reply) => {
    const { id } = request.params;
    const body = stakeCallSchema.parse(request.body);
    const adminUserId = request.user?.id;

    if (!adminUserId) {
      return reply.code(401).send({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Admin authentication required' },
      });
    }

    // Load order
    const order = await prisma.order.findUnique({
      where: { id },
    });

    if (!order) {
      return reply.code(404).send({
        success: false,
        error: { code: 'ORDER_NOT_FOUND', message: 'Order not found' },
      });
    }

    // Create STAKE call record
    const stakeCall = await prisma.stakeCall.create({
      data: {
        orderId: order.id,
        calledAt: new Date(),
        adminUserId,
        notes: body.notes,
      },
    });

    // Audit log
    await prisma.auditEvent.create({
      data: {
        actorUserId: adminUserId,
        actorType: ActorType.USER,
        action: 'STAKE_CALL',
        entityType: 'ORDER',
        entityId: order.id,
        result: 'SUCCESS',
      },
    });

    return {
      success: true,
      data: {
        stakeCallId: stakeCall.id,
        orderId: order.id,
        calledAt: stakeCall.calledAt,
      },
    };
  });

  // Ship order endpoint
  fastify.post<{ Params: { id: string } }>('/orders/:id/ship', async (request, reply) => {
    const { id } = request.params;
    const adminUserId = request.user?.id;

    if (!adminUserId) {
      return reply.code(401).send({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Admin authentication required' },
      });
    }

    try {
      // Load order with all related data
      const order = await prisma.order.findUnique({
        where: { id },
        include: {
          shippingAddress: true,
          billingAddress: true,
          complianceSnapshot: true,
          payments: {
            where: {
              status: PaymentStatus.AUTHORIZED,
            },
            orderBy: {
              createdAt: 'desc',
            },
            take: 1,
          },
          stakeCalls: {
            orderBy: {
              calledAt: 'desc',
            },
            take: 1,
          },
        },
      });

      if (!order) {
        return reply.code(404).send({
          success: false,
          error: { code: 'ORDER_NOT_FOUND', message: 'Order not found' },
        });
      }

      // FULFILLMENT RULES CHECK
      const failures: string[] = [];

      // Rule 1: Order status must be PAID
      if (order.status !== OrderStatus.PAID) {
        failures.push(`Order status is ${order.status}, must be PAID`);
      }

      // Rule 2: Compliance snapshot must exist and be ALLOW
      if (!order.complianceSnapshot) {
        failures.push('Compliance snapshot missing');
      } else if (order.complianceSnapshot.finalDecision !== ComplianceDecision.ALLOW) {
        failures.push('Compliance decision is not ALLOW');
      }

      // Rule 3: Shipping address must not be PO box
      if (order.shippingAddress.isPoBox) {
        failures.push('Shipping address is a PO box');
      }

      // Rule 4: Payment must be AUTHORIZED
      if (!order.payments || order.payments.length === 0) {
        failures.push('No authorized payment found');
      } else if (order.payments[0].status !== PaymentStatus.AUTHORIZED) {
        failures.push(`Payment status is ${order.payments[0].status}, must be AUTHORIZED`);
      }

      // Rule 5: CA first-time recipient must have STAKE call
      if (order.complianceSnapshot && order.complianceSnapshot.stakeCallRequired) {
        if (!order.stakeCalls || order.stakeCalls.length === 0) {
          failures.push('STAKE Act call required for CA first-time recipient');
        }
      }

      // If any rules fail, return 403
      if (failures.length > 0) {
        await prisma.auditEvent.create({
          data: {
            actorUserId: adminUserId,
            actorType: ActorType.USER,
            action: 'SHIP_ORDER',
            entityType: 'ORDER',
            entityId: order.id,
            result: 'BLOCKED',
            reasonCode: failures.join('; '),
          },
        });

        return reply.code(403).send({
          success: false,
          error: {
            code: 'SHIPPING_NOT_ALLOWED',
            message: 'Order cannot be shipped',
            reasons: failures,
          },
        });
      }

      const payment = order.payments[0];
      const totalAmount = Number(order.totalAmount) + Number(order.taxAmount) + Number(order.exciseTaxAmount);

      // Step 1: Capture payment
      let captureResult;
      try {
        captureResult = await capturePayment(payment.transactionId, totalAmount);
      } catch (error) {
        const captureError = error as AuthorizeNetError;

        await prisma.auditEvent.create({
          data: {
            actorUserId: adminUserId,
            actorType: ActorType.USER,
            action: 'SHIP_ORDER',
            entityType: 'ORDER',
            entityId: order.id,
            result: 'FAIL',
            reasonCode: `PAYMENT_CAPTURE_FAILED: ${captureError.code}`,
          },
        });

        return reply.code(402).send({
          success: false,
          error: {
            code: 'PAYMENT_CAPTURE_FAILED',
            message: 'Payment capture failed',
            reasonCode: captureError.code,
          },
        });
      }

      // Step 2: Update payment status to CAPTURED
      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: PaymentStatus.CAPTURED,
        },
      });

      // Step 3: Generate shipping label via Shippo
      let shippoResult;
      try {
        // Get from address from config or use default
        const fromAddressConfig = await prisma.config.findUnique({
          where: { key: 'shipping_from_address' },
        });

        const fromAddress = fromAddressConfig
          ? (fromAddressConfig.valueJson as any)
          : {
              name: 'Lumi Commerce',
              street1: '123 Warehouse St',
              city: 'Los Angeles',
              state: 'CA',
              zip: '90001',
              country: 'US',
              phone: '555-0000',
            };

        shippoResult = await createShippingLabel({
          fromAddress: {
            name: fromAddress.name,
            street1: fromAddress.street1,
            street2: fromAddress.street2,
            city: fromAddress.city,
            state: fromAddress.state,
            zip: fromAddress.zip,
            country: fromAddress.country,
            phone: fromAddress.phone,
          },
          toAddress: {
            name: order.shippingAddress.recipientName,
            street1: order.shippingAddress.line1,
            street2: order.shippingAddress.line2 || undefined,
            city: order.shippingAddress.city,
            state: order.shippingAddress.state,
            zip: order.shippingAddress.postalCode,
            country: order.shippingAddress.country,
            phone: order.shippingAddress.phone,
          },
          parcel: {
            length: '10',
            width: '8',
            height: '6',
            distanceUnit: 'in',
            weight: '1',
            massUnit: 'lb',
          },
        });
      } catch (error) {
        const shippoError = error as ShippoError;

        await prisma.auditEvent.create({
          data: {
            actorUserId: adminUserId,
            actorType: ActorType.USER,
            action: 'SHIP_ORDER',
            entityType: 'ORDER',
            entityId: order.id,
            result: 'FAIL',
            reasonCode: `SHIPPO_ERROR: ${shippoError.code}`,
          },
        });

        return reply.code(500).send({
          success: false,
          error: {
            code: 'SHIPPO_ERROR',
            message: 'Shipping label generation failed',
            reasonCode: shippoError.code,
          },
        });
      }

      // Step 4: Download and store label PDF in R2
      let labelFileId: string | null = null;
      try {
        const labelResponse = await fetch(shippoResult.labelUrl);
        if (labelResponse.ok) {
          const labelBuffer = await labelResponse.arrayBuffer();
          const labelKey = `shipping-labels/${order.id}-${Date.now()}.pdf`;
          const labelHash = crypto.createHash('sha256').update(Buffer.from(labelBuffer)).digest('hex');

          const bucket = process.env.R2_BUCKET_NAME || 'lumi-files';
          await s3Client.send(new PutObjectCommand({
            Bucket: bucket,
            Key: labelKey,
            Body: Buffer.from(labelBuffer),
            ContentType: 'application/pdf',
          }));

          const labelFile = await prisma.file.create({
            data: {
              bucket,
              key: labelKey,
              contentType: 'application/pdf',
              sizeBytes: labelBuffer.byteLength,
              sha256: labelHash,
              createdByUserId: adminUserId,
            },
          });

          labelFileId = labelFile.id;
        }
      } catch (error) {
        // Log but don't fail - label URL is still available
        fastify.log.warn(error, 'Failed to store label PDF in R2');
      }

      // Step 5: Update order with shipping information
      await prisma.order.update({
        where: { id: order.id },
        data: {
          status: OrderStatus.SHIPPED,
          carrier: shippoResult.carrier,
          trackingNumber: shippoResult.trackingNumber,
          shippedAt: new Date(),
        },
      });

      // Step 5.5: Trigger Inngest event for shipping notification (non-blocking)
      try {
        await inngest.send({
          name: 'order/shipped',
          data: {
            orderId: order.id,
            trackingNumber: shippoResult.trackingNumber,
            carrier: shippoResult.carrier,
          },
        });
      } catch (error) {
        fastify.log.warn(error, 'Failed to send Inngest event for order shipping');
      }

      // Step 6: Audit log success
      await prisma.auditEvent.create({
        data: {
          actorUserId: adminUserId,
          actorType: ActorType.USER,
          action: 'SHIP_ORDER',
          entityType: 'ORDER',
          entityId: order.id,
          result: 'SUCCESS',
          metadataJson: {
            trackingNumber: shippoResult.trackingNumber,
            carrier: shippoResult.carrier,
            captureTransactionId: captureResult.transactionId,
          },
        },
      });

      // Step 7: Send shipping notification email (non-blocking) - DEPRECATED: use Inngest function instead
      try {
        const { sendEmail, generateShippingNotificationEmail } = await import('../services/email.js');
        const emailHtml = generateShippingNotificationEmail({
          orderId: order.id,
          customerName: order.shippingAddress.recipientName,
          trackingNumber: shippoResult.trackingNumber,
          carrier: shippoResult.carrier,
        });

        // Get customer email from shipping address or use a placeholder
        // In a real system, you'd have customer email in the order or user record
        const customerEmail = process.env.ORDER_NOTIFICATION_EMAIL || order.shippingAddress.recipientName.replace(/\s+/g, '.').toLowerCase() + '@example.com';
        
        sendEmail({
          to: customerEmail,
          subject: `Your Order Has Shipped - ${order.id.substring(0, 8)}`,
          html: emailHtml,
        }).catch((err) => {
          fastify.log.warn({ err, orderId: order.id }, 'Failed to send shipping notification email');
        });
      } catch (emailError) {
        // Don't fail the shipment if email fails
        fastify.log.warn({ err: emailError, orderId: order.id }, 'Error sending shipping notification email');
      }

      return {
        success: true,
        data: {
          orderId: order.id,
          trackingNumber: shippoResult.trackingNumber,
          carrier: shippoResult.carrier,
          labelUrl: shippoResult.labelUrl,
          labelFileId,
          captureTransactionId: captureResult.transactionId,
        },
      };
    } catch (error) {
      fastify.log.error(error, 'Error shipping order');

      // Audit log for errors
      if (adminUserId) {
        await prisma.auditEvent.create({
          data: {
            actorUserId: adminUserId,
            actorType: ActorType.USER,
            action: 'SHIP_ORDER',
            entityType: 'ORDER',
            result: 'ERROR',
            reasonCode: error instanceof Error ? error.message : 'UNKNOWN_ERROR',
          },
        }).catch(() => {
          // Ignore audit log errors
        });
      }

      throw error;
    }
  });

  // PACT Act report generation endpoint
  const pactReportSchema = z.object({
    state: z.string().length(2).toUpperCase(),
    periodStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
    periodEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
  });

  fastify.post<{ Body: z.infer<typeof pactReportSchema> }>('/reports/pact', async (request, reply) => {
    const body = pactReportSchema.parse(request.body);
    const adminUserId = request.user?.id;

    if (!adminUserId) {
      return reply.code(401).send({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Admin authentication required' },
      });
    }

    try {
      const periodStart = new Date(body.periodStart);
      const periodEnd = new Date(body.periodEnd);
      periodEnd.setHours(23, 59, 59, 999); // End of day

      // Validate date range
      if (periodStart > periodEnd) {
        return reply.code(400).send({
          success: false,
          error: { code: 'INVALID_DATE_RANGE', message: 'periodStart must be before periodEnd' },
        });
      }

      // Check if report already exists (idempotency)
      const existingReport = await prisma.pactReport.findFirst({
        where: {
          state: body.state,
          periodStart: {
            gte: periodStart,
            lte: periodEnd,
          },
          periodEnd: {
            gte: periodStart,
            lte: periodEnd,
          },
        },
        orderBy: {
          generatedAt: 'desc',
        },
      });

      if (existingReport) {
        // Return existing report
        const file = await prisma.file.findUnique({
          where: { id: existingReport.fileId },
        });

        return {
          success: true,
          data: {
            reportId: existingReport.id,
            state: existingReport.state,
            periodStart: existingReport.periodStart,
            periodEnd: existingReport.periodEnd,
            generatedAt: existingReport.generatedAt,
            fileId: existingReport.fileId,
            fileKey: file?.key,
          },
        };
      }

      // Query shipped orders in date range for the state
      const orders = await prisma.order.findMany({
        where: {
          status: OrderStatus.SHIPPED,
          shippedAt: {
            gte: periodStart,
            lte: periodEnd,
          },
          shippingAddress: {
            state: body.state,
          },
        },
        include: {
          shippingAddress: true,
          items: {
            include: {
              product: true,
            },
          },
        },
        orderBy: {
          shippedAt: 'asc',
        },
      });

      if (orders.length === 0) {
        return reply.code(404).send({
          success: false,
          error: {
            code: 'NO_ORDERS_FOUND',
            message: `No shipped orders found for ${body.state} in the specified period`,
          },
        });
      }

      // Generate report rows
      const reportRows: PactReportRow[] = [];

      for (const order of orders) {
        if (!order.shippedAt || !order.trackingNumber || !order.carrier) {
          // Skip orders without complete shipping data
          continue;
        }

        for (const item of order.items) {
          const shipmentDate = order.shippedAt.toISOString().split('T')[0]; // YYYY-MM-DD

          reportRows.push({
            recipientName: order.shippingAddress.recipientName,
            recipientAddress: `${order.shippingAddress.line1}${order.shippingAddress.line2 ? ` ${order.shippingAddress.line2}` : ''}`,
            recipientCity: order.shippingAddress.city,
            recipientState: order.shippingAddress.state,
            recipientZip: order.shippingAddress.postalCode,
            productBrand: item.product.name, // Using name as brand placeholder
            productSku: item.product.sku,
            quantity: item.quantity,
            netWeightGrams: item.product.netWeightGrams * item.quantity,
            shipmentDate,
            carrier: order.carrier,
            trackingNumber: order.trackingNumber,
          });
        }
      }

      if (reportRows.length === 0) {
        return reply.code(404).send({
          success: false,
          error: {
            code: 'NO_DATA_FOUND',
            message: 'No valid order data found for report generation',
          },
        });
      }

      // Generate CSV
      const csvContent = generatePactCsv(reportRows);
      const csvBuffer = Buffer.from(csvContent, 'utf-8');
      const csvHash = crypto.createHash('sha256').update(csvBuffer).digest('hex');

      // Generate file key (idempotent: state-period)
      const fileKey = `pact-reports/${body.state}-${body.periodStart}-${body.periodEnd}.csv`;

      // Upload to R2
      const bucket = process.env.R2_BUCKET_NAME || 'lumi-files';
      await s3Client.send(new PutObjectCommand({
        Bucket: bucket,
        Key: fileKey,
        Body: csvBuffer,
        ContentType: 'text/csv',
      }));

      // Create file record
      const file = await prisma.file.create({
        data: {
          bucket,
          key: fileKey,
          contentType: 'text/csv',
          sizeBytes: csvBuffer.length,
          sha256: csvHash,
          createdByUserId: adminUserId,
        },
      });

      // Create PACT report record
      const pactReport = await prisma.pactReport.create({
        data: {
          periodStart,
          periodEnd,
          state: body.state,
          fileId: file.id,
          generatedAt: new Date(),
        },
      });

      // Audit log
      await prisma.auditEvent.create({
        data: {
          actorUserId: adminUserId,
          actorType: ActorType.USER,
          action: 'GENERATE_PACT_REPORT',
          entityType: 'PACT_REPORT',
          entityId: pactReport.id,
          result: 'SUCCESS',
          metadataJson: {
            state: body.state,
            periodStart: body.periodStart,
            periodEnd: body.periodEnd,
            orderCount: orders.length,
            rowCount: reportRows.length,
          },
        },
      });

      return {
        success: true,
        data: {
          reportId: pactReport.id,
          state: pactReport.state,
          periodStart: pactReport.periodStart,
          periodEnd: pactReport.periodEnd,
          generatedAt: pactReport.generatedAt,
          fileId: pactReport.fileId,
          fileKey: file.key,
          orderCount: orders.length,
          rowCount: reportRows.length,
        },
      };
    } catch (error) {
      fastify.log.error(error, 'Error generating PACT report');

      // Audit log for errors
      if (adminUserId) {
        await prisma.auditEvent.create({
          data: {
            actorUserId: adminUserId,
            actorType: ActorType.USER,
            action: 'GENERATE_PACT_REPORT',
            entityType: 'PACT_REPORT',
            result: 'ERROR',
            reasonCode: error instanceof Error ? error.message : 'UNKNOWN_ERROR',
          },
        }).catch(() => {
          // Ignore audit log errors
        });
      }

      throw error;
    }
  });

  // Product Management Endpoints
  const createProductSchema = z.object({
    name: z.string().min(1),
    sku: z.string().min(1),
    flavorType: z.nativeEnum(FlavorType),
    nicotineMg: z.number().positive(),
    netWeightGrams: z.number().positive(),
    price: z.number().positive(),
    caUtlApproved: z.boolean().default(false),
    sensoryCooling: z.boolean().default(false),
    active: z.boolean().default(true),
    imageUrl: z.string().url().optional(),
    imageFileId: z.string().uuid().optional(),
  });

  const updateProductSchema = createProductSchema.partial().extend({
    sku: z.string().min(1).optional(),
    imageUrl: z.string().url().optional().nullable(),
    imageFileId: z.string().uuid().optional().nullable(),
  });

  // List products (admin)
  fastify.get<{ Querystring: { page?: string; pageSize?: string; search?: string; active?: string } }>('/products', async (request) => {
    const page = Number(request.query.page) || 1;
    const pageSize = Math.min(Number(request.query.pageSize) || 50, 100);
    const skip = (page - 1) * pageSize;
    const search = request.query.search;
    const activeFilter = request.query.active === undefined ? undefined : request.query.active === 'true';

    const where: any = {};
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { sku: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (activeFilter !== undefined) {
      where.active = activeFilter;
    }

    const [items, total] = await Promise.all([
      prisma.product.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.product.count({ where }),
    ]);

    return {
      success: true,
      data: {
        items,
        total,
        page,
        pageSize,
      },
    };
  });

  // Get single product
  fastify.get<{ Params: { id: string } }>('/products/:id', async (request, reply) => {
    const product = await prisma.product.findUnique({
      where: { id: request.params.id },
    });

    if (!product) {
      return reply.code(404).send({
        success: false,
        error: { code: 'PRODUCT_NOT_FOUND', message: 'Product not found' },
      });
    }

    return {
      success: true,
      data: product,
    };
  });

  // Create product
  fastify.post<{ Body: z.infer<typeof createProductSchema> }>('/products', async (request, reply) => {
    const body = createProductSchema.parse(request.body);

    // Check if SKU already exists
    const existing = await prisma.product.findUnique({
      where: { sku: body.sku },
    });

    if (existing) {
      return reply.code(400).send({
        success: false,
        error: { code: 'SKU_EXISTS', message: 'Product with this SKU already exists' },
      });
    }

    const product = await prisma.product.create({
      data: {
        name: body.name,
        sku: body.sku,
        flavorType: body.flavorType,
        nicotineMg: body.nicotineMg,
        netWeightGrams: body.netWeightGrams,
        price: body.price,
        caUtlApproved: body.caUtlApproved,
        sensoryCooling: body.sensoryCooling,
        active: body.active,
        imageUrl: body.imageUrl || null,
        imageFileId: body.imageFileId || null,
      },
    });

    // Audit log
    if (request.user) {
      await prisma.auditEvent.create({
        data: {
          actorUserId: request.user.id,
          actorType: ActorType.USER,
          action: 'CREATE_PRODUCT',
          entityType: 'Product',
          entityId: product.id,
          result: 'SUCCESS',
          metadataJson: { sku: product.sku, name: product.name },
        },
      }).catch(() => {
        // Ignore audit log errors
      });
    }

    return {
      success: true,
      data: product,
    };
  });

  // Update product
  fastify.put<{ Params: { id: string }; Body: z.infer<typeof updateProductSchema> }>('/products/:id', async (request, reply) => {
    const body = updateProductSchema.parse(request.body);

    // Check if product exists
    const existing = await prisma.product.findUnique({
      where: { id: request.params.id },
    });

    if (!existing) {
      return reply.code(404).send({
        success: false,
        error: { code: 'PRODUCT_NOT_FOUND', message: 'Product not found' },
      });
    }

    // If SKU is being updated, check for conflicts
    if (body.sku && body.sku !== existing.sku) {
      const skuExists = await prisma.product.findUnique({
        where: { sku: body.sku },
      });

      if (skuExists) {
        return reply.code(400).send({
          success: false,
          error: { code: 'SKU_EXISTS', message: 'Product with this SKU already exists' },
        });
      }
    }

    const product = await prisma.product.update({
      where: { id: request.params.id },
      data: {
        ...(body.name !== undefined && { name: body.name }),
        ...(body.sku !== undefined && { sku: body.sku }),
        ...(body.flavorType !== undefined && { flavorType: body.flavorType }),
        ...(body.nicotineMg !== undefined && { nicotineMg: body.nicotineMg }),
        ...(body.netWeightGrams !== undefined && { netWeightGrams: body.netWeightGrams }),
        ...(body.price !== undefined && { price: body.price }),
        ...(body.caUtlApproved !== undefined && { caUtlApproved: body.caUtlApproved }),
        ...(body.sensoryCooling !== undefined && { sensoryCooling: body.sensoryCooling }),
        ...(body.active !== undefined && { active: body.active }),
        ...(body.imageUrl !== undefined && { imageUrl: body.imageUrl }),
        ...(body.imageFileId !== undefined && { imageFileId: body.imageFileId }),
      },
    });

    // Audit log
    if (request.user) {
      await prisma.auditEvent.create({
        data: {
          actorUserId: request.user.id,
          actorType: ActorType.USER,
          action: 'UPDATE_PRODUCT',
          entityType: 'Product',
          entityId: product.id,
          result: 'SUCCESS',
          metadataJson: { sku: product.sku, changes: Object.keys(body) },
        },
      }).catch(() => {
        // Ignore audit log errors
      });
    }

    return {
      success: true,
      data: product,
    };
  });

  // Delete product (soft delete by setting active=false)
  fastify.delete<{ Params: { id: string } }>('/products/:id', async (request, reply) => {
    const product = await prisma.product.findUnique({
      where: { id: request.params.id },
    });

    if (!product) {
      return reply.code(404).send({
        success: false,
        error: { code: 'PRODUCT_NOT_FOUND', message: 'Product not found' },
      });
    }

    // Soft delete by setting active=false
    const updated = await prisma.product.update({
      where: { id: request.params.id },
      data: { active: false },
    });

    // Audit log
    if (request.user) {
      await prisma.auditEvent.create({
        data: {
          actorUserId: request.user.id,
          actorType: ActorType.USER,
          action: 'DELETE_PRODUCT',
          entityType: 'Product',
          entityId: product.id,
          result: 'SUCCESS',
          metadataJson: { sku: product.sku, name: product.name },
        },
      }).catch(() => {
        // Ignore audit log errors
      });
    }

    return {
      success: true,
      data: updated,
    };
  });

  // User Management Endpoints
  const createUserSchema = z.object({
    email: z.string().email(),
    password: z.string().min(8),
    role: z.nativeEnum(UserRole),
  });

  const updateUserSchema = z.object({
    email: z.string().email().optional(),
    role: z.nativeEnum(UserRole).optional(),
    disabled: z.boolean().optional(),
  });

  const resetPasswordSchema = z.object({
    newPassword: z.string().min(8),
  });

  // List users
  fastify.get<{ Querystring: { page?: string; pageSize?: string; search?: string; role?: string } }>('/users', async (request) => {
    const page = Number(request.query.page) || 1;
    const pageSize = Math.min(Number(request.query.pageSize) || 50, 100);
    const skip = (page - 1) * pageSize;
    const search = request.query.search;
    const role = request.query.role as UserRole | undefined;

    const where: any = {};
    if (search) {
      where.email = { contains: search, mode: 'insensitive' };
    }
    if (role) {
      where.role = role;
    }

    const [items, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          email: true,
          role: true,
          createdAt: true,
          updatedAt: true,
          disabledAt: true,
        },
      }),
      prisma.user.count({ where }),
    ]);

    return {
      success: true,
      data: {
        items,
        total,
        page,
        pageSize,
      },
    };
  });

  // Get single user
  fastify.get<{ Params: { id: string } }>('/users/:id', async (request, reply) => {
    const user = await prisma.user.findUnique({
      where: { id: request.params.id },
      select: {
        id: true,
        email: true,
        role: true,
        createdAt: true,
        updatedAt: true,
        disabledAt: true,
      },
    });

    if (!user) {
      return reply.code(404).send({
        success: false,
        error: { code: 'USER_NOT_FOUND', message: 'User not found' },
      });
    }

    return {
      success: true,
      data: user,
    };
  });

  // Create user
  fastify.post<{ Body: z.infer<typeof createUserSchema> }>('/users', async (request, reply) => {
    const body = createUserSchema.parse(request.body);

    // Check if email already exists
    const existing = await prisma.user.findUnique({
      where: { email: body.email },
    });

    if (existing) {
      return reply.code(400).send({
        success: false,
        error: { code: 'EMAIL_EXISTS', message: 'User with this email already exists' },
      });
    }

    const passwordHash = await hashPassword(body.password);

    const user = await prisma.user.create({
      data: {
        email: body.email,
        passwordHash,
        role: body.role,
      },
      select: {
        id: true,
        email: true,
        role: true,
        createdAt: true,
        updatedAt: true,
        disabledAt: true,
      },
    });

    // Audit log
    if (request.user) {
      await prisma.auditEvent.create({
        data: {
          actorUserId: request.user.id,
          actorType: ActorType.USER,
          action: 'CREATE_USER',
          entityType: 'User',
          entityId: user.id,
          result: 'SUCCESS',
          metadataJson: { email: user.email, role: user.role },
        },
      }).catch(() => {
        // Ignore audit log errors
      });
    }

    return {
      success: true,
      data: user,
    };
  });

  // Update user
  fastify.put<{ Params: { id: string }; Body: z.infer<typeof updateUserSchema> }>('/users/:id', async (request, reply) => {
    const body = updateUserSchema.parse(request.body);

    // Check if user exists
    const existing = await prisma.user.findUnique({
      where: { id: request.params.id },
    });

    if (!existing) {
      return reply.code(404).send({
        success: false,
        error: { code: 'USER_NOT_FOUND', message: 'User not found' },
      });
    }

    // If email is being updated, check for conflicts
    if (body.email && body.email !== existing.email) {
      const emailExists = await prisma.user.findUnique({
        where: { email: body.email },
      });

      if (emailExists) {
        return reply.code(400).send({
          success: false,
          error: { code: 'EMAIL_EXISTS', message: 'User with this email already exists' },
        });
      }
    }

    // Prevent disabling yourself
    if (body.disabled === true && request.user?.id === request.params.id) {
      return reply.code(400).send({
        success: false,
        error: { code: 'CANNOT_DISABLE_SELF', message: 'You cannot disable your own account' },
      });
    }

    const updateData: any = {};
    if (body.email !== undefined) updateData.email = body.email;
    if (body.role !== undefined) updateData.role = body.role;
    if (body.disabled !== undefined) {
      updateData.disabledAt = body.disabled ? new Date() : null;
    }

    const user = await prisma.user.update({
      where: { id: request.params.id },
      data: updateData,
      select: {
        id: true,
        email: true,
        role: true,
        createdAt: true,
        updatedAt: true,
        disabledAt: true,
      },
    });

    // Audit log
    if (request.user) {
      await prisma.auditEvent.create({
        data: {
          actorUserId: request.user.id,
          actorType: ActorType.USER,
          action: 'UPDATE_USER',
          entityType: 'User',
          entityId: user.id,
          result: 'SUCCESS',
          metadataJson: { changes: Object.keys(body) },
        },
      }).catch(() => {
        // Ignore audit log errors
      });
    }

    return {
      success: true,
      data: user,
    };
  });

  // Disable user (soft delete)
  fastify.delete<{ Params: { id: string } }>('/users/:id', async (request, reply) => {
    const user = await prisma.user.findUnique({
      where: { id: request.params.id },
    });

    if (!user) {
      return reply.code(404).send({
        success: false,
        error: { code: 'USER_NOT_FOUND', message: 'User not found' },
      });
    }

    // Prevent disabling yourself
    if (request.user?.id === request.params.id) {
      return reply.code(400).send({
        success: false,
        error: { code: 'CANNOT_DISABLE_SELF', message: 'You cannot disable your own account' },
      });
    }

    // Soft delete by setting disabledAt
    const updated = await prisma.user.update({
      where: { id: request.params.id },
      data: { disabledAt: new Date() },
      select: {
        id: true,
        email: true,
        role: true,
        createdAt: true,
        updatedAt: true,
        disabledAt: true,
      },
    });

    // Revoke all sessions
    await prisma.session.updateMany({
      where: { userId: user.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    // Audit log
    if (request.user) {
      await prisma.auditEvent.create({
        data: {
          actorUserId: request.user.id,
          actorType: ActorType.USER,
          action: 'DISABLE_USER',
          entityType: 'User',
          entityId: user.id,
          result: 'SUCCESS',
          metadataJson: { email: user.email },
        },
      }).catch(() => {
        // Ignore audit log errors
      });
    }

    return {
      success: true,
      data: updated,
    };
  });

  // Reset user password
  fastify.post<{ Params: { id: string }; Body: z.infer<typeof resetPasswordSchema> }>('/users/:id/reset-password', async (request, reply) => {
    const body = resetPasswordSchema.parse(request.body);

    const user = await prisma.user.findUnique({
      where: { id: request.params.id },
    });

    if (!user) {
      return reply.code(404).send({
        success: false,
        error: { code: 'USER_NOT_FOUND', message: 'User not found' },
      });
    }

    const passwordHash = await hashPassword(body.newPassword);

    await prisma.user.update({
      where: { id: request.params.id },
      data: { passwordHash },
    });

    // Revoke all sessions to force re-login
    await prisma.session.updateMany({
      where: { userId: user.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    // Audit log
    if (request.user) {
      await prisma.auditEvent.create({
        data: {
          actorUserId: request.user.id,
          actorType: ActorType.USER,
          action: 'RESET_USER_PASSWORD',
          entityType: 'User',
          entityId: user.id,
          result: 'SUCCESS',
          metadataJson: { email: user.email },
        },
      }).catch(() => {
        // Ignore audit log errors
      });
    }

    return {
      success: true,
      data: { message: 'Password reset successfully' },
    };
  });

  // Dashboard Analytics Endpoint
  fastify.get('/dashboard/stats', async () => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // Order counts by status
    const [paidCount, shippedCount, blockedCount, totalOrders] = await Promise.all([
      prisma.order.count({ where: { status: OrderStatus.PAID } }),
      prisma.order.count({ where: { status: OrderStatus.SHIPPED } }),
      prisma.order.count({ where: { status: OrderStatus.BLOCKED } }),
      prisma.order.count(),
    ]);

    // Revenue calculations
    const [todayRevenue, weekRevenue, monthRevenue, totalRevenue] = await Promise.all([
      prisma.order.aggregate({
        where: {
          status: OrderStatus.SHIPPED,
          shippedAt: { gte: startOfToday },
        },
        _sum: { totalAmount: true },
      }),
      prisma.order.aggregate({
        where: {
          status: OrderStatus.SHIPPED,
          shippedAt: { gte: startOfWeek },
        },
        _sum: { totalAmount: true },
      }),
      prisma.order.aggregate({
        where: {
          status: OrderStatus.SHIPPED,
          shippedAt: { gte: startOfMonth },
        },
        _sum: { totalAmount: true },
      }),
      prisma.order.aggregate({
        where: { status: OrderStatus.SHIPPED },
        _sum: { totalAmount: true },
      }),
    ]);

    // Product counts
    const [activeProducts, totalProducts] = await Promise.all([
      prisma.product.count({ where: { active: true } }),
      prisma.product.count(),
    ]);

    // Recent orders (last 10)
    const recentOrders = await prisma.order.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      include: {
        items: {
          include: {
            product: true,
          },
        },
        shippingAddress: {
          select: {
            state: true,
          },
        },
      },
    });

    // Orders by status for chart
    const ordersByStatus = await prisma.order.groupBy({
      by: ['status'],
      _count: true,
    });

    // Orders by day (last 30 days) for chart
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const ordersByDay = await prisma.order.findMany({
      where: {
        createdAt: { gte: thirtyDaysAgo },
      },
      select: {
        createdAt: true,
        totalAmount: true,
        status: true,
      },
    });

    // Group by day
    const dailyStats = ordersByDay.reduce((acc: any, order) => {
      const date = order.createdAt.toISOString().split('T')[0];
      if (!acc[date]) {
        acc[date] = { date, count: 0, revenue: 0 };
      }
      acc[date].count++;
      if (order.status === OrderStatus.SHIPPED) {
        acc[date].revenue += Number(order.totalAmount);
      }
      return acc;
    }, {});

    const dailyStatsArray = Object.values(dailyStats).sort((a: any, b: any) => 
      a.date.localeCompare(b.date)
    );

    return {
      success: true,
      data: {
        orders: {
          paid: paidCount,
          shipped: shippedCount,
          blocked: blockedCount,
          total: totalOrders,
          byStatus: ordersByStatus.map((item) => ({
            status: item.status,
            count: item._count,
          })),
        },
        revenue: {
          today: Number(todayRevenue._sum.totalAmount || 0),
          week: Number(weekRevenue._sum.totalAmount || 0),
          month: Number(monthRevenue._sum.totalAmount || 0),
          total: Number(totalRevenue._sum.totalAmount || 0),
          daily: dailyStatsArray,
        },
        products: {
          active: activeProducts,
          total: totalProducts,
        },
        recentOrders: recentOrders.map((order) => ({
          id: order.id,
          status: order.status,
          totalAmount: Number(order.totalAmount),
          createdAt: order.createdAt,
          itemCount: order.items.length,
          state: order.shippingAddress.state,
        })),
      },
    };
  });
};

