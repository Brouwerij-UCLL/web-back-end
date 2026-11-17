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
    const payload: { fout: string; velden?: Array<{ veld: string; melding: string }> } = { fout: error.message };
    if (error.status === 400 && error.velden && error.velden.length > 0) {
      payload.velden = error.velden;
    }
    res.status(error.status).json(payload);
    return;
  }
  // Fouten van Express zelf met een 4xx-status, bv. ongeldige JSON in de request body.
  const status = (error as { status?: number }).status;
  if (status && status >= 400 && status < 500) {
    const message = (error as Error).message;
    if (message.includes('Unexpected end of JSON') || message.includes('invalid json') || message.includes('JSON')) {
      res.status(status).json({
        fout: 'Het recept bevat ongeldige gegevens',
        velden: [{ veld: 'body', melding: 'request body is geen geldige JSON' }],
      });
      return;
    }
    res.status(status).json({ fout: message });
    return;
  }
  console.error(`[FOUT] ${req.method} ${req.originalUrl}:`, error);
  res.status(500).json({ fout: 'Onverwachte fout in de back-end' });
});

// Vercel gebruikt dit bestand als startpunt en verwacht de app als default export.
export default app;
