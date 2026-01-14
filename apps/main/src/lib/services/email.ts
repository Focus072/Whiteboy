/**
 * Email Service
 * 
 * Provides email sending functionality for notifications.
 * Currently supports SendGrid, but can be extended to support other providers.
 * 
 * To use this service, set the following environment variables:
 * - EMAIL_PROVIDER=sendgrid (or other provider)
 * - SENDGRID_API_KEY=your_api_key
 * - EMAIL_FROM=noreply@yourdomain.com
 * - EMAIL_FROM_NAME=Lumi Commerce
 * 
 * Security:
 * - HTTPS/SSL verification enforced
 */

import { secureFetch } from '@/lib/security/secure-fetch';

export interface EmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
}

export interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Send email using configured provider
 */
export async function sendEmail(options: EmailOptions): Promise<EmailResult> {
  const provider = process.env.EMAIL_PROVIDER || 'sendgrid';
  const fromEmail = process.env.EMAIL_FROM || 'noreply@lumi.com';
  const fromName = process.env.EMAIL_FROM_NAME || 'Lumi Commerce';

  switch (provider) {
    case 'sendgrid':
      return sendEmailViaSendGrid({
        ...options,
        from: fromEmail,
        fromName,
      });
    default:
      throw new Error(`Unsupported email provider: ${provider}`);
  }
}

/**
 * Send email via SendGrid
 */
async function sendEmailViaSendGrid(options: EmailOptions & { from: string; fromName: string }): Promise<EmailResult> {
  const apiKey = process.env.SENDGRID_API_KEY;
  if (!apiKey) {
    throw new Error('SENDGRID_API_KEY environment variable is not set');
  }

  const recipients = Array.isArray(options.to) ? options.to : [options.to];

  try {
    // Ensure HTTPS and SSL verification
    const sendGridUrl = 'https://api.sendgrid.com/v3/mail/send';
    const response = await secureFetch(sendGridUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        personalizations: recipients.map((to) => ({
          to: [{ email: to }],
        })),
        from: {
          email: options.from,
          name: options.fromName,
        },
        subject: options.subject,
        content: [
          {
            type: 'text/plain',
            value: options.text || stripHtml(options.html),
          },
          {
            type: 'text/html',
            value: options.html,
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return {
        success: false,
        error: `SendGrid API error: ${response.status} ${errorText}`,
      };
    }

    const messageId = response.headers.get('x-message-id') || undefined;

    return {
      success: true,
      messageId,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Strip HTML tags from text
 */
function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
}

/**
 * Generate order confirmation email HTML
 */
export function generateOrderConfirmationEmail(data: {
  orderId: string;
  customerName: string;
  orderDate: string;
  totalAmount: string;
  items: Array<{ name: string; quantity: number; price: string }>;
  shippingAddress: string;
}): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #4F46E5; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; background-color: #f9fafb; }
        .order-details { background-color: white; padding: 15px; margin: 15px 0; border-radius: 5px; }
        .item { padding: 10px 0; border-bottom: 1px solid #eee; }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Order Confirmation</h1>
        </div>
        <div class="content">
          <p>Hello ${data.customerName},</p>
          <p>Thank you for your order! Your order has been received and is being processed.</p>
          
          <div class="order-details">
            <h2>Order Details</h2>
            <p><strong>Order ID:</strong> ${data.orderId}</p>
            <p><strong>Order Date:</strong> ${data.orderDate}</p>
            <p><strong>Shipping Address:</strong><br>${data.shippingAddress}</p>
            
            <h3>Items</h3>
            ${data.items.map(item => `
              <div class="item">
                <strong>${item.name}</strong> x ${item.quantity} - $${item.price}
              </div>
            `).join('')}
            
            <p style="margin-top: 20px; font-size: 18px; font-weight: bold;">
              Total: $${data.totalAmount}
            </p>
          </div>
          
          <p>You will receive a shipping confirmation email once your order ships.</p>
          <p>If you have any questions, please contact our support team.</p>
        </div>
        <div class="footer">
          <p>This is an automated message. Please do not reply to this email.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

/**
 * Generate shipping notification email HTML
 */
export function generateShippingNotificationEmail(data: {
  orderId: string;
  customerName: string;
  trackingNumber: string;
  carrier: string;
  estimatedDelivery?: string;
}): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #10B981; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; background-color: #f9fafb; }
        .tracking-info { background-color: white; padding: 15px; margin: 15px 0; border-radius: 5px; }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Your Order Has Shipped!</h1>
        </div>
        <div class="content">
          <p>Hello ${data.customerName},</p>
          <p>Great news! Your order has been shipped.</p>
          
          <div class="tracking-info">
            <h2>Tracking Information</h2>
            <p><strong>Order ID:</strong> ${data.orderId}</p>
            <p><strong>Carrier:</strong> ${data.carrier}</p>
            <p><strong>Tracking Number:</strong> ${data.trackingNumber}</p>
            ${data.estimatedDelivery ? `<p><strong>Estimated Delivery:</strong> ${data.estimatedDelivery}</p>` : ''}
          </div>
          
          <p>You can track your package using the tracking number above on the carrier's website.</p>
          <p>Please note: Adult signature (21+) is required at delivery.</p>
        </div>
        <div class="footer">
          <p>This is an automated message. Please do not reply to this email.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

/**
 * Generate password reset email HTML
 */
export function generatePasswordResetEmail(data: {
  resetUrl: string;
  expiresIn: string;
}): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #4F46E5; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; background-color: #f9fafb; }
        .button { display: inline-block; background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
        .warning { background-color: #FEF3C7; border-left: 4px solid #F59E0B; padding: 12px; margin: 15px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Reset Your Password</h1>
        </div>
        <div class="content">
          <p>Hello,</p>
          <p>We received a request to reset your password for your Lumi Pouches account.</p>
          
          <div style="text-align: center;">
            <a href="${data.resetUrl}" class="button">Reset Password</a>
          </div>
          
          <p>Or copy and paste this link into your browser:</p>
          <p style="word-break: break-all; color: #4F46E5;">${data.resetUrl}</p>
          
          <div class="warning">
            <p><strong>This link will expire in ${data.expiresIn}.</strong></p>
            <p>If you did not request a password reset, please ignore this email or contact support if you have concerns.</p>
          </div>
        </div>
        <div class="footer">
          <p>This is an automated message. Please do not reply to this email.</p>
          <p>©2025 LUMI POUCHES. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

/**
 * Generate email verification email HTML
 */
export function generateEmailVerificationEmail(data: {
  verificationUrl: string;
  expiresIn: string;
}): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #4F46E5; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; background-color: #f9fafb; }
        .button { display: inline-block; background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Verify Your Email Address</h1>
        </div>
        <div class="content">
          <p>Hello,</p>
          <p>Thank you for creating an account with Lumi Pouches! Please verify your email address to complete your registration.</p>
          
          <div style="text-align: center;">
            <a href="${data.verificationUrl}" class="button">Verify Email</a>
          </div>
          
          <p>Or copy and paste this link into your browser:</p>
          <p style="word-break: break-all; color: #4F46E5;">${data.verificationUrl}</p>
          
          <p><strong>This link will expire in ${data.expiresIn}.</strong></p>
          <p>If you did not create an account, please ignore this email.</p>
        </div>
        <div class="footer">
          <p>This is an automated message. Please do not reply to this email.</p>
          <p>©2025 LUMI POUCHES. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}