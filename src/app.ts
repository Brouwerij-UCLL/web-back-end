import express, { type Express, type Request, type Response } from 'express';
import { checkDatabaseConnection } from './db.ts';
import migrate from './migrate.ts';

const app: Express = express();
const port = Number(process.env.PORT ?? 3000);

migrate();

app.get('/', (req: Request, res: Response) => {
  res.send('Hello World!');
});

app.get('/health/db', (req: Request, res: Response) => {
  try {
    checkDatabaseConnection();
    res.json({ database: 'ok' });
  } catch (error) {
    res.status(503).json({ database: 'unreachable', error: (error as Error).message });
  }
});

app.listen(port, () => {
  console.log(`online op http://localhost:${port}`);
  try {
    checkDatabaseConnection();
    console.log('verbonden met database');
  } catch (error) {
    console.error('geen verbinding met database:', (error as Error).message);
  }
});
