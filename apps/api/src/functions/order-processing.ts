import type { Inngest } from 'inngest';
import { PrismaClient } from '@prisma/client';
import { sendEmail, generateOrderConfirmationEmail, generateShippingNotificationEmail } from '../services/email.js';

const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
});

export function createOrderProcessingFunctions(inngest: Inngest) {
  /**
   * Send order confirmation email
   * Triggered when an order is created and paid
   */
  const sendOrderConfirmation = inngest.createFunction(
    { id: 'send-order-confirmation' },
    { event: 'order/created' },
    async ({ event, step }) => {
      const { orderId } = event.data;

    // Fetch order details
    const order = await step.run('fetch-order', async () => {
      const orderData = await prisma.order.findUnique({
        where: { id: orderId },
        include: {
          user: {
            select: {
              email: true,
            },
          },
          items: {
            include: {
              product: {
                select: {
                  name: true,
                  price: true,
                },
              },
            },
          },
          shippingAddress: true,
        },
      });

      if (!orderData) {
        throw new Error(`Order ${orderId} not found`);
      }

      return orderData;
    });

    // Get customer email (from user or from billing address)
    const customerEmail = order.user?.email;
    if (!customerEmail) {
      // If no user email, we might need to get it from billing address
      // For now, skip email sending
      return { success: false, reason: 'No customer email found' };
    }

    // Format order items for email
    const items = order.items.map((item) => ({
      name: item.product.name,
      quantity: item.quantity,
      price: item.unitPrice.toString(),
    }));

    // Format shipping address
    const shippingAddress = [
      order.shippingAddress.recipientName,
      order.shippingAddress.line1,
      order.shippingAddress.line2,
      `${order.shippingAddress.city}, ${order.shippingAddress.state} ${order.shippingAddress.postalCode}`,
    ]
      .filter(Boolean)
      .join('<br>');

    // Generate and send email
    await step.run('send-confirmation-email', async () => {
      const emailHtml = generateOrderConfirmationEmail({
        orderId: order.id,
        customerName: order.shippingAddress.recipientName,
        orderDate: new Date(order.createdAt).toLocaleDateString(),
        totalAmount: order.totalAmount.toString(),
        items,
        shippingAddress,
      });

      const result = await sendEmail({
        to: customerEmail,
        subject: `Order Confirmation - Order #${order.id.slice(0, 8)}`,
        html: emailHtml,
      });

      if (!result.success) {
        throw new Error(`Failed to send email: ${result.error}`);
      }

      return result;
    });

      return { success: true, orderId };
    }
  );

  /**
   * Send shipping notification email
   * Triggered when an order status changes to SHIPPED
   */
  const sendShippingNotification = inngest.createFunction(
    { id: 'send-shipping-notification' },
    { event: 'order/shipped' },
    async ({ event, step }) => {
      const { orderId, trackingNumber, carrier } = event.data;

    // Fetch order details
    const order = await step.run('fetch-order', async () => {
      const orderData = await prisma.order.findUnique({
        where: { id: orderId },
        include: {
          user: {
            select: {
              email: true,
            },
          },
          shippingAddress: true,
        },
      });

      if (!orderData) {
        throw new Error(`Order ${orderId} not found`);
      }

      return orderData;
    });

    const customerEmail = order.user?.email;
    if (!customerEmail) {
      return { success: false, reason: 'No customer email found' };
    }

    // Send shipping notification email
    await step.run('send-shipping-email', async () => {
      const emailHtml = generateShippingNotificationEmail({
        orderId: order.id,
        customerName: order.shippingAddress.recipientName,
        trackingNumber: trackingNumber || order.trackingNumber || 'N/A',
        carrier: carrier || order.carrier || 'Unknown',
        estimatedDelivery: undefined, // Can be added if available
      });

      const result = await sendEmail({
        to: customerEmail,
        subject: `Your Order Has Shipped - Order #${order.id.slice(0, 8)}`,
        html: emailHtml,
      });

      if (!result.success) {
        throw new Error(`Failed to send email: ${result.error}`);
      }

      return result;
    });

      return { success: true, orderId };
    }
  );

  return [sendOrderConfirmation, sendShippingNotification];
}

