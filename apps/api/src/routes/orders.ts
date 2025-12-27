import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma, ActorType, OrderStatus, ComplianceCheckResult, ComplianceDecision, AgeVerificationStatus, AgeVerificationProvider, PaymentProvider, PaymentStatus } from '@lumi/db';
import { evaluateCompliance } from '@lumi/compliance-core';
import type { OrderInput } from '@lumi/compliance-core';
import { inngest } from '../plugins/inngest.js';
import { verifyAge } from '../services/veriff.js';
import type { VeriffError } from '../services/veriff.types.js';
import { authorizePayment, type AuthorizeNetError } from '../services/authorizenet.js';

const createOrderSchema = z.object({
  shippingAddressId: z.string().min(1),
  billingAddressId: z.string().min(1),
  items: z.array(
    z.object({
      productId: z.string().min(1),
      quantity: z.number().int(),
    })
  ).min(1),
  customerFirstName: z.string().min(1),
  customerLastName: z.string().min(1),
  customerDateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date of birth must be in YYYY-MM-DD format'),
  isFirstTimeRecipient: z.boolean(),
  payment: z.object({
    cardNumber: z.string().regex(/^\d{13,19}$/, 'Card number must be 13-19 digits'),
    expirationDate: z.string().regex(/^\d{2}\/\d{2}$/, 'Expiration date must be in MM/YY format'),
    cvv: z.string().regex(/^\d{3,4}$/, 'CVV must be 3-4 digits'),
  }).optional(),
});

export const ordersRoutes: FastifyPluginAsync = async (fastify) => {
  // Order creation allows guest checkout (no auth required)
  // Authentication is optional - userId can be null
  // We'll authenticate if token is provided, but won't require it

  fastify.post<{ Body: z.infer<typeof createOrderSchema> }>('/orders', {
    preHandler: async (request, reply) => {
      // Try to authenticate, but don't fail if no token
      const authHeader = request.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        try {
          await fastify.authenticate(request, reply);
        } catch (err) {
          // Ignore auth errors for guest checkout
        }
      }
    },
  }, async (request, reply) => {
    const userId = request.user?.id;
    const body = createOrderSchema.parse(request.body);

    try {
      // Step 1: Load products and addresses from DB
      const [shippingAddress, billingAddress, products] = await Promise.all([
        prisma.address.findUnique({
          where: { id: body.shippingAddressId },
        }),
        prisma.address.findUnique({
          where: { id: body.billingAddressId },
        }),
        prisma.product.findMany({
          where: {
            id: { in: body.items.map((item) => item.productId) },
            active: true,
          },
        }),
      ]);

      // Validation: Check if addresses exist
      if (!shippingAddress) {
        return reply.code(400).send({
          success: false,
          error: { code: 'SHIPPING_ADDRESS_NOT_FOUND', message: 'Shipping address not found' },
        });
      }

      if (!billingAddress) {
        return reply.code(400).send({
          success: false,
          error: { code: 'BILLING_ADDRESS_NOT_FOUND', message: 'Billing address not found' },
        });
      }

      // Validation: Check if all products exist and are active
      const productMap = new Map(products.map((p) => [p.id, p]));
      const missingProducts = body.items.filter((item) => !productMap.has(item.productId));

      if (missingProducts.length > 0) {
        return reply.code(400).send({
          success: false,
          error: {
            code: 'PRODUCTS_NOT_FOUND',
            message: `Products not found: ${missingProducts.map((p) => p.productId).join(', ')}`,
          },
        });
      }

      // Step 2: Call Veriff for age verification
      let veriffResult;
      try {
        veriffResult = await verifyAge({
          firstName: body.customerFirstName,
          lastName: body.customerLastName,
          dateOfBirth: body.customerDateOfBirth,
          address: {
            line1: shippingAddress.line1,
            city: shippingAddress.city,
            state: shippingAddress.state,
            zip: shippingAddress.postalCode,
            country: shippingAddress.country,
          },
        });
      } catch (error) {
        // Veriff timeout or error - fail closed
        const veriffError = error as VeriffError;
        
        // Audit log failure
        await prisma.auditEvent.create({
          data: {
            actorUserId: userId || null,
            actorType: userId ? ActorType.USER : ActorType.SYSTEM,
            action: 'AGE_VERIFICATION',
            entityType: 'ORDER',
            result: 'FAIL',
            reasonCode: veriffError.code,
          },
        }).catch(() => {
          // Ignore audit log errors
        });

        return reply.code(403).send({
          success: false,
          error: {
            code: 'AGE_VERIFICATION_FAILED',
            message: 'Age verification failed due to provider error or timeout',
            reasonCode: veriffError.code,
          },
        });
      }

      // Step 3: If verification FAIL, block order immediately
      if (veriffResult.status === 'FAIL') {
        // Audit log failure
        await prisma.auditEvent.create({
          data: {
            actorUserId: userId || null,
            actorType: userId ? ActorType.USER : ActorType.SYSTEM,
            action: 'AGE_VERIFICATION',
            entityType: 'ORDER',
            result: 'FAIL',
            reasonCode: veriffResult.reasonCode || 'VERIFF_FAIL',
          },
        }).catch(() => {
          // Ignore audit log errors
        });

        return reply.code(403).send({
          success: false,
          error: {
            code: 'AGE_VERIFICATION_FAILED',
            message: 'Age verification failed',
            reasonCode: veriffResult.reasonCode,
          },
        });
      }

      // Step 4: Build OrderInput object for compliance engine (age verification PASS)
      const orderInput: OrderInput = {
        shippingAddress: {
          state: shippingAddress.state,
          is_po_box: shippingAddress.isPoBox,
        },
        items: body.items.map((item) => {
          const product = productMap.get(item.productId)!;
          return {
            product: {
              flavor_type: product.flavorType,
              ca_utl_approved: product.caUtlApproved,
              sensory_cooling: product.sensoryCooling,
            },
            quantity: item.quantity,
          };
        }),
        isFirstTimeRecipient: body.isFirstTimeRecipient,
        ageVerificationStatus: 'PASS', // From Veriff result
      };

      // Step 5: Evaluate compliance
      const complianceResult = evaluateCompliance(orderInput);

      // Step 6: If compliance BLOCK, return 403
      if (complianceResult.decision === 'BLOCK') {
        return reply.code(403).send({
          success: false,
          error: {
            code: 'ORDER_BLOCKED',
            message: 'Order blocked by compliance rules',
            reasonCodes: complianceResult.reasonCodes,
          },
        });
      }

      // Step 7: Validate product prices and calculate order totals
      // Validate all products have valid prices and quantities
      for (const item of body.items) {
        const product = productMap.get(item.productId)!;
        
        if (!product.price || Number(product.price) <= 0) {
          return reply.code(400).send({
            success: false,
            error: {
              code: 'INVALID_PRODUCT_PRICE',
              message: `Product ${product.sku} has invalid or missing price`,
            },
          });
        }
        
        if (item.quantity <= 0) {
          return reply.code(400).send({
            success: false,
            error: {
              code: 'INVALID_QUANTITY',
              message: `Invalid quantity for product ${product.sku}`,
            },
          });
        }
      }

      // Calculate line items and subtotal
      let subtotal = 0;

      const orderItemsData = body.items.map((item) => {
        const product = productMap.get(item.productId)!;
        const unitPrice = Number(product.price);
        const lineTotal = unitPrice * item.quantity;
        subtotal += lineTotal;
        
        return {
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: unitPrice,
        };
      });

      // Calculate taxes using tax service
      const { calculateTaxes } = await import('../services/tax.js');
      const taxCalculation = calculateTaxes({
        subtotal,
        shippingState: shippingAddress.state,
        items: body.items.map((item) => {
          const product = productMap.get(item.productId)!;
          return {
            netWeightGrams: Number(product.netWeightGrams),
            quantity: item.quantity,
          };
        }),
      });

      const taxAmount = taxCalculation.salesTaxAmount;
      const exciseTaxAmount = taxCalculation.exciseTaxAmount;

      // Calculate total
      const totalAmount = subtotal + taxAmount + exciseTaxAmount;

      // Round to 2 decimal places
      const roundTo2 = (num: number) => Math.round(num * 100) / 100;
      const finalSubtotal = roundTo2(subtotal);
      const finalTaxAmount = roundTo2(taxAmount);
      const finalExciseTaxAmount = roundTo2(exciseTaxAmount);
      const finalTotalAmount = roundTo2(totalAmount);

      // Step 8: Authorize payment with Authorize.Net
      if (!body.payment) {
        return reply.code(400).send({
          success: false,
          error: { code: 'PAYMENT_REQUIRED', message: 'Payment details are required' },
        });
      }

      let paymentResult;
      try {
        // Convert expiration date from MM/YY to MMYY
        const expirationDate = body.payment.expirationDate.replace('/', '');

        paymentResult = await authorizePayment({
          amount: finalTotalAmount,
          cardNumber: body.payment.cardNumber,
          expirationDate,
          cvv: body.payment.cvv,
          billingAddress: {
            firstName: body.customerFirstName,
            lastName: body.customerLastName,
            address: billingAddress.line1,
            city: billingAddress.city,
            state: billingAddress.state,
            zip: billingAddress.postalCode,
          },
        });
      } catch (error) {
        // Payment authorization failed
        const authError = error as AuthorizeNetError;

        // Audit log payment failure
        await prisma.auditEvent.create({
          data: {
            actorUserId: userId || null,
            actorType: userId ? ActorType.USER : ActorType.SYSTEM,
            action: 'PAYMENT_AUTHORIZATION',
            entityType: 'ORDER',
            result: 'FAIL',
            reasonCode: authError.code,
          },
        }).catch(() => {
          // Ignore audit log errors
        });

        return reply.code(402).send({
          success: false,
          error: {
            code: 'PAYMENT_AUTHORIZATION_FAILED',
            message: 'Payment authorization failed',
            reasonCode: authError.code,
          },
        });
      }

      // Step 9: If payment authorization FAILED, persist payment record and return 402
      if (paymentResult.status === 'FAILED') {
        // Note: This shouldn't happen as authorizePayment throws on failure,
        // but handling it defensively
        await prisma.payment.create({
          data: {
            orderId: 'temp', // Will be updated after order creation
            provider: PaymentProvider.AUTHORIZE_NET,
            status: PaymentStatus.FAILED,
            amount: finalTotalAmount,
            transactionId: paymentResult.transactionId || 'failed',
            avsResult: paymentResult.avsResult || null,
            cvvResult: paymentResult.cvvResult || null,
          },
        }).catch(() => {
          // Ignore if order doesn't exist yet
        });

        await prisma.auditEvent.create({
          data: {
            actorUserId: userId || null,
            actorType: userId ? ActorType.USER : ActorType.SYSTEM,
            action: 'PAYMENT_AUTHORIZATION',
            entityType: 'ORDER',
            result: 'FAIL',
            reasonCode: paymentResult.reasonCode || 'AUTHORIZATION_DECLINED',
          },
        }).catch(() => {
          // Ignore audit log errors
        });

        return reply.code(402).send({
          success: false,
          error: {
            code: 'PAYMENT_AUTHORIZATION_FAILED',
            message: 'Payment authorization failed',
            reasonCode: paymentResult.reasonCode,
          },
        });
      }

      // Step 10: Persist order with PAID status (payment authorized)
      const order = await prisma.order.create({
        data: {
          userId: userId || null,
          shippingAddressId: body.shippingAddressId,
          billingAddressId: body.billingAddressId,
          status: OrderStatus.PAID,
          totalAmount: finalTotalAmount,
          subtotal: finalSubtotal,
          taxAmount: finalTaxAmount,
          exciseTaxAmount: finalExciseTaxAmount,
          items: {
            create: orderItemsData,
          },
        },
        include: {
          items: true,
        },
      });

      // Step 11: Persist payment record with AUTHORIZED status
      await prisma.payment.create({
        data: {
          orderId: order.id,
          provider: PaymentProvider.AUTHORIZE_NET,
          status: PaymentStatus.AUTHORIZED,
          amount: finalTotalAmount,
          transactionId: paymentResult.transactionId,
          avsResult: paymentResult.avsResult || null,
          cvvResult: paymentResult.cvvResult || null,
        },
      });

      // Step 12: Persist compliance snapshot (IMMUTABLE)
      const complianceSnapshot = await prisma.complianceSnapshot.create({
        data: {
          orderId: order.id,
          shippingState: shippingAddress.state,
          caFlavorCheck: complianceResult.reasonCodes.includes('CA_FLAVOR_BAN')
            ? ComplianceCheckResult.FAIL
            : ComplianceCheckResult.PASS,
          caSensoryCheck: complianceResult.reasonCodes.includes('CA_SENSORY_BAN')
            ? ComplianceCheckResult.FAIL
            : ComplianceCheckResult.PASS,
          poBoxCheck: complianceResult.reasonCodes.includes('PO_BOX_NOT_ALLOWED')
            ? ComplianceCheckResult.FAIL
            : ComplianceCheckResult.PASS,
          ageVerificationCheck: complianceResult.reasonCodes.includes('AGE_VERIFICATION_FAILED')
            ? ComplianceCheckResult.FAIL
            : ComplianceCheckResult.PASS,
          stakeCallRequired: complianceResult.stakeCallRequired,
          finalDecision: complianceResult.decision === 'ALLOW' ? ComplianceDecision.ALLOW : ComplianceDecision.BLOCK,
        },
      });

      // Step 13: Create age verification record with Veriff result
      await prisma.ageVerification.create({
        data: {
          orderId: order.id,
          provider: AgeVerificationProvider.VERIFF,
          status: veriffResult.status === 'PASS' ? AgeVerificationStatus.PASS : AgeVerificationStatus.FAIL,
          referenceId: veriffResult.referenceId,
          reasonCode: veriffResult.reasonCode || null,
          verifiedAt: new Date(),
        },
      });

      // Step 14: Audit log
      await prisma.auditEvent.create({
        data: {
          actorUserId: userId || null,
          actorType: userId ? ActorType.USER : ActorType.SYSTEM,
          action: 'CREATE_ORDER',
          entityType: 'ORDER',
          entityId: order.id,
          result: 'SUCCESS',
          reasonCode: null,
        },
      });

      // Step 14.5: Trigger Inngest event for order confirmation (non-blocking)
      try {
        await inngest.send({
          name: 'order/created',
          data: {
            orderId: order.id,
            userId: userId || null,
            totalAmount: finalTotalAmount.toString(),
          },
        });
      } catch (error) {
        fastify.log.warn(error, 'Failed to send Inngest event for order creation');
      }

      // Step 15: Send order confirmation email (non-blocking) - DEPRECATED: use Inngest function instead
      try {
        const { sendEmail, generateOrderConfirmationEmail } = await import('../services/email.js');
        const orderWithDetails = await prisma.order.findUnique({
          where: { id: order.id },
          include: {
            items: {
              include: {
                product: true,
              },
            },
            shippingAddress: true,
          },
        });

        if (orderWithDetails) {
          const emailHtml = generateOrderConfirmationEmail({
            orderId: order.id,
            customerName: `${body.customerFirstName} ${body.customerLastName}`,
            orderDate: new Date().toLocaleDateString(),
            totalAmount: finalTotalAmount.toFixed(2),
            items: orderWithDetails.items.map((item) => ({
              name: item.product.name,
              quantity: item.quantity,
              price: (Number(item.unitPrice) * item.quantity).toFixed(2),
            })),
            shippingAddress: [
              orderWithDetails.shippingAddress.recipientName,
              orderWithDetails.shippingAddress.line1,
              orderWithDetails.shippingAddress.line2,
              `${orderWithDetails.shippingAddress.city}, ${orderWithDetails.shippingAddress.state} ${orderWithDetails.shippingAddress.postalCode}`,
            ].filter(Boolean).join('<br>'),
          });

          // Get customer email from shipping address or use a placeholder
          // In a real system, you'd have customer email in the order or user record
          const customerEmail = process.env.ORDER_NOTIFICATION_EMAIL || shippingAddress.recipientName.replace(/\s+/g, '.').toLowerCase() + '@example.com';
          
          sendEmail({
            to: customerEmail,
            subject: `Order Confirmation - ${order.id.substring(0, 8)}`,
            html: emailHtml,
          }).catch((err) => {
            fastify.log.warn({ err, orderId: order.id }, 'Failed to send order confirmation email');
          });
        }
      } catch (emailError) {
        // Don't fail the order if email fails
        fastify.log.warn({ err: emailError, orderId: order.id }, 'Error sending order confirmation email');
      }

      // Step 16: Return success response
      return reply.code(201).send({
        success: true,
        data: {
          orderId: order.id,
          status: order.status,
          stakeCallRequired: complianceResult.stakeCallRequired,
          complianceSnapshotId: complianceSnapshot.id,
          paymentTransactionId: paymentResult.transactionId,
        },
      });
    } catch (error) {
      fastify.log.error(error, 'Error creating order');

      // Audit log for errors
      if (userId) {
        await prisma.auditEvent.create({
          data: {
            actorUserId: userId,
            actorType: ActorType.USER,
            action: 'CREATE_ORDER',
            entityType: 'ORDER',
            result: 'ERROR',
            reasonCode: error instanceof Error ? error.message : 'UNKNOWN_ERROR',
          },
        }).catch(() => {
          // Ignore audit log errors
        });
      }

      // Re-throw to be handled by error handler
      throw error;
    }
  });

  // Customer order history endpoint (authenticated)
  fastify.get('/orders', { preHandler: [async (request, reply) => { await fastify.authenticate(request, reply); }] }, async (request, reply) => {
    const userId = request.user?.id;
    if (!userId) {
      return reply.code(401).send({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
    }

    const page = Number((request.query as any).page) || 1;
    const pageSize = Math.min(Number((request.query as any).pageSize) || 20, 100);
    const skip = (page - 1) * pageSize;

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where: { userId },
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          items: {
            include: {
              product: true,
            },
          },
          shippingAddress: true,
          complianceSnapshot: true,
        },
      }),
      prisma.order.count({ where: { userId } }),
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

  // Customer order detail endpoint (authenticated)
  fastify.get('/orders/:id', { preHandler: [async (request, reply) => { await fastify.authenticate(request, reply); }] }, async (request, reply) => {
    const userId = request.user?.id;
    if (!userId) {
      return reply.code(401).send({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
    }

    const order = await prisma.order.findFirst({
      where: {
        id: (request.params as any).id,
        userId, // Ensure user can only access their own orders
      },
      include: {
        items: {
          include: {
            product: true,
          },
        },
        shippingAddress: true,
        billingAddress: true,
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
};

