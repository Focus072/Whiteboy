/**
 * Order creation helper functions
 * Extracted from Fastify routes for use in Next.js API routes
 */

import { prisma, ActorType, OrderStatus, ComplianceCheckResult, ComplianceDecision, AgeVerificationProvider, AgeVerificationStatus, PaymentProvider, PaymentStatus } from '@lumi/db';
import { evaluateCompliance } from '@lumi/compliance-core';
import type { OrderInput } from '@lumi/compliance-core';
import { verifyAge } from '@/lib/services/veriff';
import type { VeriffError } from '@/lib/services/veriff.types';
import { authorizePayment, type AuthorizeNetError } from '@/lib/services/authorizenet';
import { calculateTaxes } from '@/lib/services/tax';

export interface CreateOrderInput {
  shippingAddressId: string;
  billingAddressId: string;
  items: Array<{
    productId: string;
    quantity: number;
  }>;
  customerFirstName: string;
  customerLastName: string;
  customerDateOfBirth: string;
  isFirstTimeRecipient: boolean;
  payment?: {
    cardNumber: string;
    expirationDate: string;
    cvv: string;
  };
  userId?: string | null;
}

export async function createOrder(input: CreateOrderInput) {
  const userId = input.userId || null;

  // Step 1: Load products and addresses from DB
  const [shippingAddress, billingAddress, products] = await Promise.all([
    prisma.address.findUnique({ where: { id: input.shippingAddressId } }),
    prisma.address.findUnique({ where: { id: input.billingAddressId } }),
    prisma.product.findMany({
      where: {
        id: { in: input.items.map((item) => item.productId) },
        active: true,
      },
    }),
  ]);

  if (!shippingAddress) {
    throw { code: 'SHIPPING_ADDRESS_NOT_FOUND', message: 'Shipping address not found', status: 400 };
  }

  if (!billingAddress) {
    throw { code: 'BILLING_ADDRESS_NOT_FOUND', message: 'Billing address not found', status: 400 };
  }

  const productMap = new Map(products.map((p) => [p.id, p]));
  const missingProducts = input.items.filter((item) => !productMap.has(item.productId));
  if (missingProducts.length > 0) {
    throw {
      code: 'PRODUCTS_NOT_FOUND',
      message: `Products not found: ${missingProducts.map((p) => p.productId).join(', ')}`,
      status: 400,
    };
  }

  // Step 2: Age verification with Veriff
  let veriffResult;
  try {
    veriffResult = await verifyAge({
      firstName: input.customerFirstName,
      lastName: input.customerLastName,
      dateOfBirth: input.customerDateOfBirth,
      address: {
        line1: shippingAddress.line1,
        city: shippingAddress.city,
        state: shippingAddress.state,
        zip: shippingAddress.postalCode,
        country: shippingAddress.country,
      },
    });
  } catch (error) {
    const veriffError = error as VeriffError;
    await prisma.auditEvent.create({
      data: {
        actorUserId: userId,
        actorType: userId ? ActorType.USER : ActorType.SYSTEM,
        action: 'AGE_VERIFICATION',
        entityType: 'ORDER',
        result: 'FAIL',
        reasonCode: veriffError.code,
      },
    }).catch(() => {});
    throw { code: 'AGE_VERIFICATION_FAILED', message: 'Age verification failed', reasonCode: veriffError.code, status: 403 };
  }

  if (veriffResult.status === 'FAIL') {
    await prisma.auditEvent.create({
      data: {
        actorUserId: userId,
        actorType: userId ? ActorType.USER : ActorType.SYSTEM,
        action: 'AGE_VERIFICATION',
        entityType: 'ORDER',
        result: 'FAIL',
        reasonCode: veriffResult.reasonCode || 'VERIFF_FAIL',
      },
    }).catch(() => {});
    throw { code: 'AGE_VERIFICATION_FAILED', message: 'Age verification failed', reasonCode: veriffResult.reasonCode, status: 403 };
  }

  // Step 3: Build OrderInput for compliance
  const orderInput: OrderInput = {
    shippingAddress: {
      state: shippingAddress.state,
      is_po_box: shippingAddress.isPoBox,
    },
    items: input.items.map((item) => {
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
    isFirstTimeRecipient: input.isFirstTimeRecipient,
    ageVerificationStatus: 'PASS',
  };

  // Step 4: Evaluate compliance
  const complianceResult = evaluateCompliance(orderInput);
  if (complianceResult.decision === 'BLOCK') {
    throw {
      code: 'ORDER_BLOCKED',
      message: 'Order blocked by compliance rules',
      reasonCodes: complianceResult.reasonCodes,
      status: 403,
    };
  }

  // Step 5: Validate prices and calculate totals
  for (const item of input.items) {
    const product = productMap.get(item.productId)!;
    if (!product.price || Number(product.price) <= 0) {
      throw { code: 'INVALID_PRODUCT_PRICE', message: `Product ${product.sku} has invalid price`, status: 400 };
    }
    if (item.quantity <= 0) {
      throw { code: 'INVALID_QUANTITY', message: `Invalid quantity for product ${product.sku}`, status: 400 };
    }
  }

  let subtotal = 0;
  const orderItemsData = input.items.map((item) => {
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

  // Calculate taxes
  const taxCalculation = calculateTaxes({
    subtotal,
    shippingState: shippingAddress.state,
    items: input.items.map((item) => {
      const product = productMap.get(item.productId)!;
      return {
        netWeightGrams: Number(product.netWeightGrams),
        quantity: item.quantity,
      };
    }),
  });

  const roundTo2 = (num: number) => Math.round(num * 100) / 100;
  const finalSubtotal = roundTo2(subtotal);
  const finalTaxAmount = roundTo2(taxCalculation.salesTaxAmount);
  const finalExciseTaxAmount = roundTo2(taxCalculation.exciseTaxAmount);
  const finalTotalAmount = roundTo2(finalSubtotal + finalTaxAmount + finalExciseTaxAmount);

  // Step 6: Authorize payment
  if (!input.payment) {
    throw { code: 'PAYMENT_REQUIRED', message: 'Payment details are required', status: 400 };
  }

  let paymentResult;
  try {
    const expirationDate = input.payment.expirationDate.replace('/', '');
    paymentResult = await authorizePayment({
      amount: finalTotalAmount,
      cardNumber: input.payment.cardNumber,
      expirationDate,
      cvv: input.payment.cvv,
      billingAddress: {
        firstName: input.customerFirstName,
        lastName: input.customerLastName,
        address: billingAddress.line1,
        city: billingAddress.city,
        state: billingAddress.state,
        zip: billingAddress.postalCode,
      },
    });
  } catch (error) {
    const authError = error as AuthorizeNetError;
    await prisma.auditEvent.create({
      data: {
        actorUserId: userId,
        actorType: userId ? ActorType.USER : ActorType.SYSTEM,
        action: 'PAYMENT_AUTHORIZATION',
        entityType: 'ORDER',
        result: 'FAIL',
        reasonCode: authError.code,
      },
    }).catch(() => {});
    throw { code: 'PAYMENT_AUTHORIZATION_FAILED', message: 'Payment authorization failed', reasonCode: authError.code, status: 402 };
  }

  if (paymentResult.status === 'FAILED') {
    await prisma.auditEvent.create({
      data: {
        actorUserId: userId,
        actorType: userId ? ActorType.USER : ActorType.SYSTEM,
        action: 'PAYMENT_AUTHORIZATION',
        entityType: 'ORDER',
        result: 'FAIL',
        reasonCode: paymentResult.reasonCode || 'AUTHORIZATION_DECLINED',
      },
    }).catch(() => {});
    throw { code: 'PAYMENT_AUTHORIZATION_FAILED', message: 'Payment authorization failed', reasonCode: paymentResult.reasonCode, status: 402 };
  }

  // Step 7: Create order
  const order = await prisma.order.create({
    data: {
      userId,
      shippingAddressId: input.shippingAddressId,
      billingAddressId: input.billingAddressId,
      status: OrderStatus.PAID,
      totalAmount: finalTotalAmount,
      subtotal: finalSubtotal,
      taxAmount: finalTaxAmount,
      exciseTaxAmount: finalExciseTaxAmount,
      items: { create: orderItemsData },
    },
    include: { items: true },
  });

  // Step 8: Create payment record
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

  // Step 9: Create compliance snapshot
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

  // Step 10: Create age verification record
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

  // Step 11: Audit log
  await prisma.auditEvent.create({
    data: {
      actorUserId: userId,
      actorType: userId ? ActorType.USER : ActorType.SYSTEM,
      action: 'CREATE_ORDER',
      entityType: 'ORDER',
      entityId: order.id,
      result: 'SUCCESS',
      reasonCode: null,
    },
  });

  // Step 12: Trigger Inngest event (non-blocking)
  try {
    const { inngest } = await import('@/lib/services/inngest-client');
    await inngest.send({
      name: 'order/created',
      data: {
        orderId: order.id,
        userId,
        totalAmount: finalTotalAmount.toString(),
      },
    });
  } catch (error) {
    console.warn('Failed to send Inngest event:', error);
  }

  return {
    order,
    complianceSnapshot,
    paymentTransactionId: paymentResult.transactionId,
    stakeCallRequired: complianceResult.stakeCallRequired,
  };
}
