/**
 * Inngest endpoint
 * POST /api/inngest
 * 
 * This endpoint handles Inngest webhooks and function execution
 * 
 * Production URL: https://your-domain.vercel.app/api/inngest
 * Signing Key: Set INNGEST_SIGNING_KEY environment variable
 */

import { serve } from 'inngest/next';
import { inngest } from '@/lib/services/inngest-client';
import { createOrderProcessingFunctions } from '@/lib/inngest/functions';

// Create all Inngest functions
const functions = createOrderProcessingFunctions(inngest);

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Export the serve handler
export const { GET, POST, PUT } = serve({
  client: inngest,
  functions,
});
