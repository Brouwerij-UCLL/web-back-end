import { Router } from 'express';
import type { DatabaseSync } from 'node:sqlite';
import {
  addEvent,
  addMeasurement,
  changeBrewSessionStatus,
  getBrewSession,
  listBrewSessions,
  nextStep,
  startBrewSession,
  updateBrewSessionNotes,
} from '../model/brew-session.ts';
import { parseId } from './params.ts';

export function brewSessionRoutes(db: DatabaseSync): Router {
  const router = Router();

  router.get('/', (req, res) => {
    res.json(listBrewSessions(db));
  });

  router.post('/', (req, res) => {
    const receptId = parseId(req.body?.recept_id, 'recept_id');
    res.status(201).json(startBrewSession(db, receptId, req.body?.opmerkingen ?? null));
  });

  router.get('/:id', (req, res) => {
    res.json(getBrewSession(db, parseId(req.params.id)));
  });

  // Body: { status?: 'afgerond' | 'geannuleerd', opmerkingen?: string | null }
  router.patch('/:id', (req, res) => {
    const id = parseId(req.params.id);
    let sessie = getBrewSession(db, id);
    if (req.body && 'opmerkingen' in req.body) sessie = updateBrewSessionNotes(db, id, req.body.opmerkingen);
    if (req.body?.status !== undefined) sessie = changeBrewSessionStatus(db, id, req.body.status);
    res.json(sessie);
  });

  router.post('/:id/volgende-stap', (req, res) => {
    res.json(nextStep(db, parseId(req.params.id)));
  });

  router.post('/:id/metingen', (req, res) => {
    res.status(201).json(addMeasurement(db, parseId(req.params.id), req.body));
  });

  router.post('/:id/gebeurtenissen', (req, res) => {
    res.status(201).json(addEvent(db, parseId(req.params.id), req.body?.type, req.body?.omschrijving ?? null));
  });

  return router;
}
