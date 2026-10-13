import { Router } from 'express';
import type { DatabaseSync } from 'node:sqlite';
import { listBrewSessions } from '../model/brew-session.ts';
import { createRecipe, deleteRecipe, getRecipe, listRecipes, updateRecipe } from '../model/recipe.ts';
import { parseId } from './params.ts';

export function recipeRoutes(db: DatabaseSync): Router {
  const router = Router();

  router.get('/', (req, res) => {
    res.json(listRecipes(db));
  });

  router.post('/', (req, res) => {
    res.status(201).json(createRecipe(db, req.body));
  });

  router.get('/:id', (req, res) => {
    res.json(getRecipe(db, parseId(req.params.id)));
  });

  router.put('/:id', (req, res) => {
    res.json(updateRecipe(db, parseId(req.params.id), req.body));
  });

  router.delete('/:id', (req, res) => {
    deleteRecipe(db, parseId(req.params.id));
    res.status(204).end();
  });

  router.get('/:id/brouwsessies', (req, res) => {
    const id = parseId(req.params.id);
    getRecipe(db, id);
    res.json(listBrewSessions(db, id));
  });

  return router;
}
