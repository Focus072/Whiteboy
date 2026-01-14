/**
 * Ship order
 * POST /api/admin/orders/[id]/ship
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma, ActorType, OrderStatus, ComplianceDecision, PaymentStatus } from '@lumi/db';
import { requireAdmin } from '@/lib/api-auth';
import { capturePayment, type AuthorizeNetError } from '@/lib/services/authorizenet';
import { createShippingLabel, type ShippoError } from '@/lib/services/shippo';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { inngest } from '@/lib/services/inngest-client';
import crypto from 'crypto';

const s3Client = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
  },
});

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireAdmin(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { user } = authResult;

    // Load order with all related data
    const order = await prisma.order.findUnique({
      where: { id: params.id },
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
      return NextResponse.json(
        {
          success: false,
          error: { code: 'ORDER_NOT_FOUND', message: 'Order not found' },
        },
        { status: 404 }
      );
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
          actorUserId: user.id,
          actorType: ActorType.USER,
          action: 'SHIP_ORDER',
          entityType: 'ORDER',
          entityId: order.id,
          result: 'BLOCKED',
          reasonCode: failures.join('; '),
        },
      });

      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'SHIPPING_NOT_ALLOWED',
            message: 'Order cannot be shipped',
            reasons: failures,
          },
        },
        { status: 403 }
      );
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
          actorUserId: user.id,
          actorType: ActorType.USER,
          action: 'SHIP_ORDER',
          entityType: 'ORDER',
          entityId: order.id,
          result: 'FAIL',
          reasonCode: `PAYMENT_CAPTURE_FAILED: ${captureError.code}`,
        },
      });

      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'PAYMENT_CAPTURE_FAILED',
            message: 'Payment capture failed',
            reasonCode: captureError.code,
          },
        },
        { status: 402 }
      );
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
          actorUserId: user.id,
          actorType: ActorType.USER,
          action: 'SHIP_ORDER',
          entityType: 'ORDER',
          entityId: order.id,
          result: 'FAIL',
          reasonCode: `SHIPPO_ERROR: ${shippoError.code}`,
        },
      });

      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'SHIPPO_ERROR',
            message: 'Shipping label generation failed',
            reasonCode: shippoError.code,
          },
        },
        { status: 500 }
      );
    }

    // Step 4: Download and store label PDF in R2 (optional, non-blocking)
    let labelFileId: string | null = null;
    try {
      const { secureFetch } = await import('@/lib/security/secure-fetch');
      const labelResponse = await secureFetch(shippoResult.labelUrl);
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
            createdByUserId: user.id,
          },
        });

        labelFileId = labelFile.id;
      }
    } catch (error) {
      // Log but don't fail - label URL is still available
      console.warn('Failed to store label PDF in R2:', error);
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

    // Step 6: Trigger Inngest event for shipping notification (non-blocking)
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
      console.warn('Failed to send Inngest event for order shipping:', error);
    }

    // Step 7: Audit log success
    await prisma.auditEvent.create({
      data: {
        actorUserId: user.id,
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

    return NextResponse.json({
      success: true,
      data: {
        orderId: order.id,
        trackingNumber: shippoResult.trackingNumber,
        carrier: shippoResult.carrier,
        labelUrl: shippoResult.labelUrl,
        labelFileId,
        captureTransactionId: captureResult.transactionId,
      },
    });
  } catch (error: any) {
    console.error('Error shipping order:', error);

    // Audit log for errors
    const authResult = await requireAdmin(request);
    if (!(authResult instanceof NextResponse) && authResult.user) {
      await prisma.auditEvent.create({
        data: {
          actorUserId: authResult.user.id,
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

    return NextResponse.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'An error occurred' },
      },
      { status: 500 }
    );
  }
}
