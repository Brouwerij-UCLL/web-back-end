import { Router, type Request, type Response } from 'express';
import swaggerUi from 'swagger-ui-express';
import { getOpenApiDocument } from './openapi/document.ts';

// Swagger UI op /api/docs en de specificatie op /api/docs/openapi.json.
export const docsRouter: Router = Router();

docsRouter.get('/openapi.json', (req: Request, res: Response) => {
  res.json(getOpenApiDocument());
});

docsRouter.use(
  '/',
  swaggerUi.serve,
  swaggerUi.setup(undefined, {
    customSiteTitle: 'Brouwerij API',
    swaggerOptions: { url: '/api/docs/openapi.json', persistAuthorization: true },
  }),
);
