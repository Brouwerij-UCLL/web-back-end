import { z } from 'zod';
import { checkDatabaseConnection } from '../database/db.ts';
import { createRoutes, HttpFout } from './openapi/route.ts';

export const health = createRoutes('/health', 'health');

health.route({
  method: 'get',
  path: '/db',
  summary: 'Controleert of de database bereikbaar is',
  response: z.object({ database: z.literal('ok') }).meta({ example: { database: 'ok' } }),
  responseDescription: 'De database is bereikbaar',
  errors: { 503: 'De database is niet bereikbaar' },
  handler: () => {
    try {
      checkDatabaseConnection();
    } catch (error) {
      throw new HttpFout(503, `database niet bereikbaar: ${(error as Error).message}`);
    }
    return { database: 'ok' as const };
  },
});
