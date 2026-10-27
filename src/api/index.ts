import { Router } from 'express';
import { receptenRouter } from './recepten/routes.ts';

// Alle REST-endpoints onder /api. Voeg per onderdeel een router toe.
export const apiRouter: Router = Router();

apiRouter.use('/recepten', receptenRouter);
apiRouter.use('/recepten/:id', receptenRouter);