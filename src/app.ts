import express, { type Express, type Request, type Response } from 'express';
import migrate from './migrate.ts';

const app: Express = express();

migrate();

app.get('/', (req: Request, res: Response) => {
  res.send('Hello World!');
});

const start = async (): Promise<void> => {
  await migrate();
  app.listen(3000, () => {
    console.log('online');
  });
};

void start().catch((error: unknown) => {
  console.error('Failed to run database migrations', error);
  process.exitCode = 1;
});