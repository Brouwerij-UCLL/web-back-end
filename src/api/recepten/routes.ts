import { Router, type Request, type Response } from 'express';
import { getRecepten, getReceptById } from '../../database/recepten/queries.ts';

export const receptenRouter: Router = Router();

// GET /api/recepten: lijst van alle recepten
receptenRouter.get('/', (req: Request, res: Response) => {
  res.json(getRecepten());
});

// GET /api/recepten/:id: specifiek recept
receptenRouter.get('/:id', (req: Request, res: Response) => {
  const receptId = parseInt(req.params.id as string, 10);
  const recept = getReceptById(receptId);

  if (!recept) {
    return res.status(404).json({ error: "Recept niet gevonden" });
  }

  res.json(recept);
});
