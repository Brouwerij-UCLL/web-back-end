import { Router, type Request, type Response } from 'express';
import { readFileSync } from 'node:fs';
import { getOpenApiDocument } from './openapi/document.ts';

// De bestanden van Swagger UI worden met een vast pad ingelezen, zodat Vercel ze mee in de functie neemt
// (een map serveren met express.static ziet Vercel niet).
const swaggerUiCss = readFileSync(new URL('../../node_modules/swagger-ui-dist/swagger-ui.css', import.meta.url));
const swaggerUiBundle = readFileSync(new URL('../../node_modules/swagger-ui-dist/swagger-ui-bundle.js', import.meta.url));

const pagina = `<!doctype html>
<html lang="nl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Brouwerij API</title>
  <link rel="stylesheet" href="/api/docs/swagger-ui.css">
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="/api/docs/swagger-ui-bundle.js"></script>
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

docsRouter.get('/swagger-ui.css', (req: Request, res: Response) => {
  res.type('css').set('Cache-Control', 'public, max-age=86400').send(swaggerUiCss);
});

docsRouter.get('/swagger-ui-bundle.js', (req: Request, res: Response) => {
  res.type('js').set('Cache-Control', 'public, max-age=86400').send(swaggerUiBundle);
});

docsRouter.get('/', (req: Request, res: Response) => {
  res.type('html').send(pagina);
});
