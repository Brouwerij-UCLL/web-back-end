import { Router, type Request, type Response } from 'express';
import {
  getRecept,
  getRecepten,
  getReceptIngredients,
  getReceptWithIngredients
} from '../../database/recepten/queries.ts';

export const receptenRouter: Router = Router();

// GET /api/recepten: lijst van alle recepten
receptenRouter.get('/', (req: Request, res: Response) => {
  res.json(getRecepten());
});

receptenRouter.get('/:id', (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: 'id moet een getal zijn' });
    return;
  }

  const recept = getRecept(id);
  if (!recept) {
    res.status(404).json({ error: `recept ${id} niet gevonden` });
    return;
  }

  res.json(recept);
});

receptenRouter.get('/:id/ingredients', (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: 'id moet een getal zijn' });
    return;
  }

  const recept = getReceptIngredients(id);
  if (!recept) {
    res.status(404).json({ error: `recept ${id} niet gevonden` });
    return;
  }

  res.json(recept);
})

receptenRouter.get('/:id/details', (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: 'id moet een getal zijn' });
    return;
  }

  const recept = getReceptWithIngredients(id);
  if (!recept) {
    res.status(404).json({ error: `recept ${id} niet gevonden` });
    return;
  }

  res.json(recept);
})