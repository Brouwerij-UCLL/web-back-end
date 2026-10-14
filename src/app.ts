import express, { type Express, type NextFunction, type Request, type Response } from 'express';
import { docsRouter } from './api/docs.ts';
import { routeGroepen } from './api/index.ts';
import { HttpFout } from './api/openapi/route.ts';
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

app.use('/api/docs', docsRouter);
for (const groep of routeGroepen) {
  app.use(groep.mountPath, groep.router);
}

// Onbekende routes en fouten krijgen het gedocumenteerde formaat {"fout": "..."}.
app.use((req: Request, res: Response) => {
  res.status(404).json({ fout: `route ${req.method} ${req.originalUrl} bestaat niet` });
});

app.use((error: unknown, req: Request, res: Response, next: NextFunction) => {
  if (error instanceof HttpFout) {
    res.status(error.status).json({ fout: error.message });
    return;
  }
  // Fouten van Express zelf met een 4xx-status, bv. ongeldige JSON in de request body.
  const status = (error as { status?: number }).status;
  if (status && status >= 400 && status < 500) {
    res.status(status).json({ fout: (error as Error).message });
    return;
  }
  console.error(`[FOUT] ${req.method} ${req.originalUrl}:`, error);
  res.status(500).json({ fout: 'Onverwachte fout in de back-end' });
});

// Vercel gebruikt dit bestand als startpunt en verwacht de app als default export.
export default app;
