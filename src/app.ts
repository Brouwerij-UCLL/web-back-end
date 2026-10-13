import express, { type Express, type NextFunction, type Request, type Response } from 'express';
import { AppError} from './appError.ts';
import { db } from './db.ts';

const app: Express = express();

app.get('/', (req: Request, res: Response) => {
  res.send('Hello World!');
});

console.log("online");

//REST-Endpoint voor health check
app.get('/health/db', async (req: Request, res: Response) => {
  try {
    await db.query('SELECT 1');

    res.status(200).json({
      database: 'ok'
    });
  } catch (error) {
    console.error(error);

    res.status(503).json({
      database: 'unavailable'
    });
  }
});

// Test route voor een onverwachte serverfout (500)
app.get('/test-error', (req: Request, res: Response) => {
  throw new Error('Test error');
});

// Test route voor een verwachte functionele fout (bijv. 400 Bad Request)
app.get('/test-app-error', (req: Request, res: Response) => {
  throw new AppError('Ongeldige aanvraag parameters', 400);
});

// Test route met async/await
app.get('/test-async-error', async (req: Request, res: Response) => {
  throw new AppError('Database verbinding mislukt', 503);
});

// Vang alle niet-bestaande routes op
app.use((req: Request, res: Response, next: NextFunction) => {
  next(new AppError(`Route ${req.originalUrl} niet gevonden`, 404));
});

// Centrale error handler
app.use((
  err: Error | AppError,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Bepaal de statuscode 
  const statusCode = err instanceof AppError ? err.statusCode : 500;

  // Bepaal de foutmelding
  const message = err instanceof AppError ? err.message : 'Internal Server Error';

  // Centrale logging
  console.error(`[ERROR] ${req.method} ${req.originalUrl}:`, err);

  // Uniforme JSON respons voor de frontend
  res.status(statusCode).json({
    error: {
      status: statusCode,
      message: message,
      timestamp: new Date().toISOString()
    }
  });
});

app.listen(3000);