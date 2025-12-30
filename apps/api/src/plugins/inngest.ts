import { Inngest } from 'inngest';
import { fastifyPlugin } from 'inngest/fastify';
import type { FastifyInstance } from 'fastify';

// Import your functions
import { createOrderProcessingFunctions } from '../functions/order-processing.js';

// Initialize Inngest client with signing key
export const inngest = new Inngest({
  id: 'lumi-api',
  name: 'Lumi API',
  eventKey: process.env.INNGEST_EVENT_KEY || 'dev',
  signingKey: process.env.INNGEST_SIGNING_KEY || 'dev',
});

const orderProcessingFunctions = createOrderProcessingFunctions(inngest);

/**
 * Register Inngest plugin with Fastify
 */
export async function registerInngest(fastify: FastifyInstance) {
  const baseURL = process.env.INNGEST_BASE_URL || 'http://127.0.0.1:8288';

  await fastify.register(fastifyPlugin, {
    client: inngest,
    functions: orderProcessingFunctions,
  });

  fastify.log.info(`Inngest plugin registered (baseURL: ${baseURL})`);
}

