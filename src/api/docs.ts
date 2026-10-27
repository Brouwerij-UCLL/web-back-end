import express, { Router, type Request, type Response } from 'express';
import { createRequire } from 'node:module';
import { getOpenApiDocument } from './openapi/document.ts';

const require = createRequire(import.meta.url);
const swaggerUiDist = require('swagger-ui-dist') as { getAbsoluteFSPath: () => string };
const swaggerUiVersion = (require('swagger-ui-dist/package.json') as { version: string }).version;

// Vercel neemt de bestanden uit node_modules/swagger-ui-dist niet mee; daar laden we dezelfde versie van een CDN.
const assetBase = process.env.VERCEL
  ? `https://cdn.jsdelivr.net/npm/swagger-ui-dist@${swaggerUiVersion}`
  : '/api/docs/assets';

const pagina = `<!doctype html>
<html lang="nl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Brouwerij API</title>
  <link rel="stylesheet" href="${assetBase}/swagger-ui.css">
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="${assetBase}/swagger-ui-bundle.js"></script>
  <script>
    window.ui = SwaggerUIBundle({
      url: '/api/docs/openapi.json',
      dom_id: '#swagger-ui',
      persistAuthorization: true,
    });
  </script>
</body>
</html>`;

// Swagger UI op /api/docs en de specificatie op /api/docs/openapi.json.
export const docsRouter: Router = Router();

docsRouter.get('/openapi.json', (req: Request, res: Response) => {
  res.json(getOpenApiDocument());
});

docsRouter.use('/assets', express.static(swaggerUiDist.getAbsoluteFSPath()));

docsRouter.get('/', (req: Request, res: Response) => {
  res.type('html').send(pagina);
});
