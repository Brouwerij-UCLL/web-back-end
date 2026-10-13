import express, { type Express, type Request, type Response } from 'express';
import { apiRouter } from './api/index.ts';
import { healthRouter } from './api/health.ts';
import migrate from './database/migrate.ts';

// De routes rekenen op een bijgewerkt schema, dus eerst migreren.
migrate();

export const app: Express = express();

app.use(express.json());

app.get('/', (req: Request, res: Response) => {
  res.send('Hello, Ferrari');
});

app.use('/health', healthRouter);
app.use('/api', apiRouter);

// Vercel gebruikt dit bestand als startpunt en verwacht de app als default export.
export default app;
