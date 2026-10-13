import express, { type Express, type Request, type Response } from 'express';
import { apiRouter } from './api/index.ts';
import { healthRouter } from './api/health.ts';

export const app: Express = express();

app.use(express.json());

app.get('/', (req: Request, res: Response) => {
  res.send('Hello, Ferrari');
});

app.use('/health', healthRouter);
app.use('/api', apiRouter);
