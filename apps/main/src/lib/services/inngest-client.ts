/**
 * Inngest client for Next.js API routes
 */

import { Inngest } from 'inngest';

export const inngest = new Inngest({
  id: 'lumi-main',
  name: 'Lumi Main App',
  eventKey: process.env.INNGEST_EVENT_KEY || 'dev',
  signingKey: process.env.INNGEST_SIGNING_KEY || 'dev',
});
