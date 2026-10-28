import {
  getRecept,
  getRecepten,
  getReceptIngredients,
  getReceptWithIngredients,
} from '../../database/recepten/queries.ts';
import { maakRecept, ontbrekendeIds, receptBestaat, vervangRecept, type ReceptInvoer as ReceptInvoerData } from '../../database/recepten/saveRecipe.ts';
import { createRoutes, HttpFout } from '../openapi/route.ts';
import { IngredientenLijst, Recept, ReceptenLijst, ReceptIdParams, ReceptInvoer, ReceptMetIngredienten } from './schemas.ts';

export const recepten = createRoutes('/api/recepten', 'recepten');

const nietGevonden = 'Er bestaat geen recept met dit id';

recepten.route({
  method: 'get',
  path: '/',
  summary: 'Lijst van alle recepten',
  description: 'Alle recepten met hun algemene gegevens, alfabetisch op naam.',
  response: ReceptenLijst,
  responseDescription: 'De recepten',
  handler: () => getRecepten(),
});

recepten.route({
  method: 'get',
  path: '/:id',
  summary: 'Eén recept',
  params: ReceptIdParams,
  response: Recept,
  responseDescription: 'Het recept',
  errors: { 404: nietGevonden },
  handler: ({ params }) => {
    const recept = getRecept(params.id);
    if (!recept) throw new HttpFout(404, `recept ${params.id} niet gevonden`);
    return recept;
  },
});

recepten.route({
  method: 'get',
  path: '/:id/ingredients',
  summary: 'Ingrediënten van een recept',
  params: ReceptIdParams,
  response: IngredientenLijst,
  responseDescription: 'De ingrediënten; een lege lijst als het recept er geen heeft',
  errors: { 404: nietGevonden },
  handler: ({ params }) => {
    if (!getRecept(params.id)) throw new HttpFout(404, `recept ${params.id} niet gevonden`);
    return getReceptIngredients(params.id);
  },
});

recepten.route({
  method: 'get',
  path: '/:id/details',
  summary: 'Eén recept met zijn ingrediënten',
  params: ReceptIdParams,
  response: ReceptMetIngredienten,
  responseDescription: 'Het recept met een lijst ingrediënten',
  errors: { 404: nietGevonden },
  handler: ({ params }) => {
    const recept = getReceptWithIngredients(params.id);
    if (!recept) throw new HttpFout(404, `recept ${params.id} niet gevonden`);
    return recept;
  },
});

// Controleert of alle ids naar een bestaand item in de catalogi verwijzen; zo niet, dan 400 met elk ontbrekend id.
function controleerCatalogus(recept: ReceptInvoerData) {
  const fouten = [
    ...ontbrekendeIds('ingredients', recept.ingredienten.map((r) => r.ingredient_id)).map((id) => `ingrediënt ${id} bestaat niet`),
    ...ontbrekendeIds('hops', recept.hop.map((r) => r.hop_id)).map((id) => `hop ${id} bestaat niet`),
    ...ontbrekendeIds('extra_ingredients', recept.extra.map((r) => r.extra_ingredient_id)).map((id) => `extra ingrediënt ${id} bestaat niet`),
  ];
  if (fouten.length > 0) throw new HttpFout(400, `Ongeldige request body: ${fouten.join('; ')}`);
}

recepten.route({
  method: 'post',
  path: '/',
  summary: 'Volledig recept opslaan',
  description:
    'Slaat een nieuw recept met al zijn onderdelen in één keer op (in één transactie). Ingrediënten, hop en extra ingrediënten verwijzen naar de catalogi. Het antwoord heeft hetzelfde formaat als GET /api/recepten/{id}.',
  body: ReceptInvoer,
  status: 201,
  response: Recept,
  responseDescription: 'Het opgeslagen recept',
  handler: ({ body }) => {
    controleerCatalogus(body);
    return getRecept(maakRecept(body))!;
  },
});

recepten.route({
  method: 'put',
  path: '/:id',
  summary: 'Volledig recept vervangen',
  description:
    'Vervangt de basisgegevens en alle onderdelen van een bestaand recept (in één transactie). Onderdelen die niet meegestuurd worden, zijn daarna leeg.',
  params: ReceptIdParams,
  body: ReceptInvoer,
  response: Recept,
  responseDescription: 'Het bijgewerkte recept',
  errors: { 404: nietGevonden },
  handler: ({ params, body }) => {
    if (!receptBestaat(params.id)) throw new HttpFout(404, `recept ${params.id} niet gevonden`);
    controleerCatalogus(body);
    vervangRecept(params.id, body);
    return getRecept(params.id)!;
  },
});
