import { Router, type Request, type Response } from 'express';
import { checkDatabaseConnection } from '../database/db.ts';

export const healthRouter: Router = Router();

healthRouter.get('/db', (req: Request, res: Response) => {
  try {
    checkDatabaseConnection();
    res.json({ database: 'ok' });
  } catch (error) {
    res.status(503).json({ database: 'unreachable', error: (error as Error).message });
  }
});
