import { Router, type Request, type Response } from 'express';
import { getRecepten } from '../../database/recepten/queries.ts';

export const receptenRouter: Router = Router();

// GET /api/recepten: lijst van alle recepten
receptenRouter.get('/', (req: Request, res: Response) => {
  res.json(getRecepten());
});
