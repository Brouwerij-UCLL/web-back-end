import express, { type Express, type Request, type Response } from 'express';
import { apiRouter } from './api/index.ts';
import { healthRouter } from './api/health.ts';
import cors, {type CorsOptions } from 'cors';
import migrate from './database/migrate.ts';

// De routes rekenen op een bijgewerkt schema, dus eerst migreren.
migrate();

const allowedOrigins: string[] = [
  'http://localhost:4200',
  'http://localhost',
  'https://localhost',
];

const corsOptions: CorsOptions = {
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    callback(new Error(`Origin ${origin} niet toegelaten door CORS`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

export const app: Express = express();

app.use(cors(corsOptions));   // eerst CORS, vóór alle routes
app.use(express.json());

app.get('/', (req: Request, res: Response) => {
  res.send('Hello, Ferrari');
});

app.use('/health', healthRouter);
app.use('/api', apiRouter);

// Vercel gebruikt dit bestand als startpunt en verwacht de app als default export.
export default app;
