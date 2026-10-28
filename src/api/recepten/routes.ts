import { getRecept, getRecepten, getReceptIngredients } from '../../database/recepten/queries.ts';
import { maakRecept, ontbrekendeIds, receptBestaat, vervangRecept, type RecipeInput as RecipeInputData } from '../../database/recepten/saveRecipe.ts';
import { getMashSchedule, replaceMashSchedule } from '../../database/recepten/mashSchedule.ts';
import { createRoutes, HttpFout } from '../openapi/route.ts';
import { Recipe, MashSchedule, MashScheduleInput, RecipeIngredientList, RecipeInput, RecipeList, ReceptIdParams } from './schemas.ts';

export const recepten = createRoutes('/api/recipes', 'recipes');

const nietGevonden = 'Er bestaat geen recept met dit id';

recepten.route({
  method: 'get',
  path: '/',
  summary: 'Lijst van alle recepten',
  description: 'Alle recepten met hun algemene gegevens, alfabetisch op naam.',
  response: RecipeList,
  responseDescription: 'De recepten',
  handler: () => getRecepten(),
});

recepten.route({
  method: 'get',
  path: '/:id',
  summary: 'Eén recept',
  params: ReceptIdParams,
  response: Recipe,
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
  response: RecipeIngredientList,
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
  response: Recipe,
  responseDescription: 'Het recept met een lijst ingrediënten',
  errors: { 404: nietGevonden },
  handler: ({ params }) => {
    const recept = getRecept(params.id);
    if (!recept) throw new HttpFout(404, `recept ${params.id} niet gevonden`);
    return recept;
  },
});

// Controleert of alle ids naar een bestaand item in de catalogi verwijzen; zo niet, dan 400 met elk ontbrekend id.
function controleerCatalogus(recept: RecipeInputData) {
  const fouten = [
    ...ontbrekendeIds('ingredients', recept.ingredients.map((r) => r.ingredient_id)).map((id) => `ingrediënt ${id} bestaat niet`),
    ...ontbrekendeIds('hops', recept.hops.map((r) => r.hop_id)).map((id) => `hop ${id} bestaat niet`),
    ...ontbrekendeIds('extra_ingredients', recept.extras.map((r) => r.extra_ingredient_id)).map((id) => `extra ingrediënt ${id} bestaat niet`),
  ];
  if (fouten.length > 0) throw new HttpFout(400, `Ongeldige request body: ${fouten.join('; ')}`);
}

recepten.route({
  method: 'post',
  path: '/',
  summary: 'Volledig recept opslaan',
  description:
    'Slaat een nieuw recept met al zijn onderdelen in één keer op (in één transactie). Ingrediënten, hop en extra ingrediënten verwijzen naar de catalogi. Het antwoord heeft hetzelfde formaat als GET /api/recipes/{id}.',
  body: RecipeInput,
  status: 201,
  response: Recipe,
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
  body: RecipeInput,
  response: Recipe,
  responseDescription: 'Het bijgewerkte recept',
  errors: { 404: nietGevonden },
  handler: ({ params, body }) => {
    if (!receptBestaat(params.id)) throw new HttpFout(404, `recept ${params.id} niet gevonden`);
    controleerCatalogus(body);
    vervangRecept(params.id, body);
    return getRecept(params.id)!;
  },
});

recepten.route({
  method: 'get',
  path: '/:id/maischschema',
  summary: 'Maischschema van een recept',
  description: 'De maischstappen in volgorde (step_nr vanaf 1) en de kooktijd (boil_time).',
  params: ReceptIdParams,
  response: MashSchedule,
  responseDescription: 'Het maischschema; een lege lijst steps en boil_time null als er nog geen is ingesteld',
  errors: { 404: nietGevonden },
  handler: ({ params }) => {
    const schedule = getMashSchedule(params.id);
    if (!schedule) throw new HttpFout(404, `recept ${params.id} niet gevonden`);
    return schedule;
  },
});

recepten.route({
  method: 'put',
  path: '/:id/maischschema',
  summary: 'Maischschema van een recept opslaan of vervangen',
  description:
    'Vervangt alle maischstappen en de kooktijd in één keer. De stappen worden genummerd in de volgorde van de lijst. ' +
    'Is één waarde ongeldig, dan wordt er niets opgeslagen en blijft het vorige schema staan. ' +
    'Grenzen: temperature 20–80 °C, duration 1–240 minuten, boil_time 1–180 minuten. ' +
    'In de database is de kooktijd de laatste rij van recipe_mash_steps: temperature = 100 °C en duration = kooktijd.',
  params: ReceptIdParams,
  body: MashScheduleInput,
  response: MashSchedule,
  responseDescription: 'Het opgeslagen maischschema',
  errors: { 404: nietGevonden },
  handler: ({ params, body }) => {
    const schedule = replaceMashSchedule(params.id, body);
    if (!schedule) throw new HttpFout(404, `recept ${params.id} niet gevonden`);
    return schedule;
  },
});
