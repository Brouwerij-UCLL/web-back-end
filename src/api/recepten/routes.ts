import { getRecept, getRecepten, getReceptIngredients } from '../../database/recepten/queries.ts';
import {
  maakRecept,
  ontbrekendeIds,
  receptBestaat,
  vervangRecept,
  verwijderRecept,
  type RecipeInput as RecipeInputData,
} from '../../database/recepten/saveRecipe.ts';
import { getHopAdditions } from '../../database/recepten/hopAdditions.ts';
import { getExtras } from '../../database/recepten/extras.ts';
import { getMashSchedule, replaceMashSchedule } from '../../database/recepten/mashSchedule.ts';
import { getWater, saveWater } from '../../database/recepten/water.ts';
import { getFermentationSchedule, replaceFermentationSchedule } from '../../database/recepten/fermentationSchedule.ts';
import {
  addFermentable,
  deleteFermentable,
  getFermentable,
  getFermentables,
  recipeExists,
  updateFermentable,
  type FermentableResult,
} from '../../database/recepten/fermentables.ts';
import { createRoutes, HttpFout } from '../openapi/route.ts';
import {
  Fermentable,
  FermentableInput,
  FermentableList,
  FermentableParams,
  FermentationSchedule,
  FermentationScheduleInput,
  HopAdditionList,
  MashSchedule,
  MashScheduleInput,
  Recipe,
  RecipeExtraList,
  RecipeIngredientList,
  RecipeInput,
  RecipeList,
  ReceptIdParams,
  Water,
  WaterInput,
} from './schemas.ts';

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

// ----- Hopgiften van een recept (SCRUM-52) -----

recepten.route({
  method: 'get',
  path: '/:id/hops',
  summary: 'Hopgiften van een recept',
  description:
    'Van langste naar kortste kooktijd, dus in de volgorde waarin ze in de ketel gaan. ' +
    'Toevoegen, wijzigen en verwijderen gebeurt met PUT /api/recipes/{id}; de catalogus zelf beheer je via /api/hops.',
  params: ReceptIdParams,
  response: HopAdditionList,
  responseDescription: 'De hopgiften; een lege lijst als het recept er geen heeft',
  errors: { 404: nietGevonden },
  handler: ({ params }) => {
    if (!receptBestaat(params.id)) throw new HttpFout(404, `recept ${params.id} niet gevonden`);
    return getHopAdditions(params.id);
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
  method: 'delete',
  path: '/:id',
  summary: 'Recept verwijderen',
  description:
    'Verwijdert het recept met alles wat alleen bij dit recept hoort: water, ingrediëntregels, hopgiften, extra ingrediënten, ' +
    'maisch- en vergistingsstappen. De catalogi (ingrediënten, hops en extra ingrediënten) blijven ongewijzigd.',
  params: ReceptIdParams,
  status: 204,
  response: Recipe,
  responseDescription: 'Het recept is verwijderd',
  errors: { 404: nietGevonden },
  handler: ({ params }) => {
    const recept = getRecept(params.id);
    if (!recept) throw new HttpFout(404, `recept ${params.id} niet gevonden`);
    verwijderRecept(params.id);
    return recept;
  },
});

// ----- Extra ingrediënten van een recept (SCRUM-53) -----

recepten.route({
  method: 'get',
  path: '/:id/extras',
  summary: 'Extra ingrediënten van een recept',
  description:
    'Eerst de extra ingrediënten voor het beslag, dan die voor het koken van langste naar kortste kooktijd. ' +
    'Toevoegen, wijzigen en verwijderen gebeurt met PUT /api/recipes/{id}; de catalogus zelf beheer je via /api/extras.',
  params: ReceptIdParams,
  response: RecipeExtraList,
  responseDescription: 'De extra ingrediënten; een lege lijst als het recept er geen heeft',
  errors: { 404: nietGevonden },
  handler: ({ params }) => {
    if (!receptBestaat(params.id)) throw new HttpFout(404, `recept ${params.id} niet gevonden`);
    return getExtras(params.id);
  },
});

recepten.route({
  method: 'get',
  path: '/:id/mash-schedule',
  summary: 'Maischschema van een recept',
  description: 'De maischstappen in volgorde (step_nr vanaf 1).',
  params: ReceptIdParams,
  response: MashSchedule,
  responseDescription: 'Het maischschema; een lege lijst steps als er nog geen is ingesteld',
  errors: { 404: nietGevonden },
  handler: ({ params }) => {
    const schedule = getMashSchedule(params.id);
    if (!schedule) throw new HttpFout(404, `recept ${params.id} niet gevonden`);
    return schedule;
  },
});

recepten.route({
  method: 'put',
  path: '/:id/mash-schedule',
  summary: 'Maischschema van een recept opslaan of vervangen',
  description:
    'Vervangt alle maischstappen in één keer. De stappen worden genummerd in de volgorde van de lijst. ' +
    'Is één waarde ongeldig, dan wordt er niets opgeslagen en blijft het vorige schema staan. ' +
    'Grenzen: temperature 20–80 °C, duration 1–240 minuten.',
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

recepten.route({
  method: 'get',
  path: '/:id/fermentation-schedule',
  summary: 'Vergistingsschema van een recept',
  description: 'De vergistingsstappen in volgorde (step_nr vanaf 1).',
  params: ReceptIdParams,
  response: FermentationSchedule,
  responseDescription: 'Het vergistingsschema; een lege lijst steps als er nog geen is ingesteld',
  errors: { 404: nietGevonden },
  handler: ({ params }) => {
    const schedule = getFermentationSchedule(params.id);
    if (!schedule) throw new HttpFout(404, `recept ${params.id} niet gevonden`);
    return schedule;
  },
});

recepten.route({
  method: 'get',
  path: '/:id/water',
  summary: 'Maisch- en spoelwater van een recept',
  description: 'De hoeveelheden water in liter. Dezelfde waarden staan ook in GET /api/recipes/{id}.',
  params: ReceptIdParams,
  response: Water,
  responseDescription: 'Het water; null-waarden als er nog niets is ingesteld',
  errors: { 404: nietGevonden },
  handler: ({ params }) => {
    const water = getWater(params.id);
    if (!water) throw new HttpFout(404, `recept ${params.id} niet gevonden`);
    return water;
  },  
});

recepten.route({
  method: 'put',
  path: '/:id/water',
  summary: 'Maisch- en spoelwater van een recept opslaan of wijzigen',
  description:
    'Slaat beide hoeveelheden op of vervangt de vorige waarden. De andere receptgegevens blijven ongewijzigd. ' +
    'Grenzen: mash_water_l groter dan 0, sparge_water_l 0 of meer, elk maximaal 500 liter.',
  params: ReceptIdParams,
  body: WaterInput,
  response: Water,
  responseDescription: 'Het opgeslagen water',
  errors: { 404: nietGevonden },
  handler: ({ params, body }) => {
    const water = saveWater(params.id, body);
    if (!water) throw new HttpFout(404, `recept ${params.id} niet gevonden`);
    return water;
  },
});

recepten.route({
  method: 'put',
  path: '/:id/fermentation-schedule',
  summary: 'Vergistingsschema van een recept opslaan of vervangen',
  description:
    'Vervangt alle vergistingsstappen in één keer. De stappen worden genummerd in de volgorde van de lijst. ' +
    'Is één waarde ongeldig, dan wordt er niets opgeslagen en blijft het vorige schema staan. ' +
    'Het maischschema blijft ongewijzigd. Grenzen: temperature_c 0–30 °C, duration_days 1–90 dagen.',
  params: ReceptIdParams,
  body: FermentationScheduleInput,
  response: FermentationSchedule,
  responseDescription: 'Het opgeslagen vergistingsschema',
  errors: { 404: nietGevonden },
  handler: ({ params, body }) => {
    const schedule = replaceFermentationSchedule(params.id, body);
    if (!schedule) throw new HttpFout(404, `recept ${params.id} niet gevonden`);
    return schedule;
  },
});

// ----- Vergistbare ingrediënten (moutstort) van een recept -----

const ingredientNietGevonden = 'Het recept bestaat niet, of het ingrediënt zit niet in dit recept';
const alInRecept = 'Een ingrediënt met deze naam en fabrikant zit al in dit recept';

// Zet het resultaat van toevoegen of wijzigen om naar het ingrediënt of de passende fout.
function fermentableOfFout(resultaat: FermentableResult, recipeId: number, ingredientId?: number) {
  if (resultaat.ok) return resultaat.fermentable;
  if (resultaat.reason === 'recipe_not_found') throw new HttpFout(404, `recept ${recipeId} niet gevonden`);
  if (resultaat.reason === 'fermentable_not_found') throw new HttpFout(404, `ingrediënt ${ingredientId} zit niet in recept ${recipeId}`);
  throw new HttpFout(409, `een ingrediënt met deze naam en fabrikant zit al in recept ${recipeId}`);
}

recepten.route({
  method: 'get',
  path: '/:id/fermentables',
  summary: 'Vergistbare ingrediënten van een recept',
  description: 'De moutstort van het recept: naam, fabrikant en hoeveelheid in kg, in de volgorde waarin de ingrediënten zijn toegevoegd.',
  params: ReceptIdParams,
  response: FermentableList,
  responseDescription: 'De ingrediënten; een lege lijst als het recept er geen heeft',
  errors: { 404: nietGevonden },
  handler: ({ params }) => {
    const lijst = getFermentables(params.id);
    if (!lijst) throw new HttpFout(404, `recept ${params.id} niet gevonden`);
    return lijst;
  },
});

recepten.route({
  method: 'get',
  path: '/:id/fermentables/:ingredientId',
  summary: 'Eén vergistbaar ingrediënt van een recept',
  params: FermentableParams,
  response: Fermentable,
  responseDescription: 'Het ingrediënt',
  errors: { 404: ingredientNietGevonden },
  handler: ({ params }) => {
    if (!recipeExists(params.id)) throw new HttpFout(404, `recept ${params.id} niet gevonden`);
    const ingredient = getFermentable(params.id, params.ingredientId);
    if (!ingredient) throw new HttpFout(404, `ingrediënt ${params.ingredientId} zit niet in recept ${params.id}`);
    return ingredient;
  },
});

recepten.route({
  method: 'post',
  path: '/:id/fermentables',
  summary: 'Vergistbaar ingrediënt aan een recept toevoegen',
  description:
    'Voegt een ingrediënt met naam, optioneel een fabrikant, en een hoeveelheid in kg toe aan de moutstort. ' +
    'Staat er in de catalogus nog geen ingrediënt met die naam en fabrikant (hoofdletters niet meegerekend), dan wordt het aangemaakt. ' +
    'Het antwoord bevat het id van het ingrediënt.',
  params: ReceptIdParams,
  body: FermentableInput,
  status: 201,
  response: Fermentable,
  responseDescription: 'Het toegevoegde ingrediënt',
  errors: { 404: nietGevonden, 409: alInRecept },
  handler: ({ params, body }) => fermentableOfFout(addFermentable(params.id, body), params.id),
});

recepten.route({
  method: 'put',
  path: '/:id/fermentables/:ingredientId',
  summary: 'Vergistbaar ingrediënt van een recept wijzigen',
  description:
    'Slaat de nieuwe naam, fabrikant en hoeveelheid op. Bij een andere naam of fabrikant verwijst het recept naar het ' +
    'catalogus-ingrediënt met die naam en fabrikant (bestaand of nieuw), zodat andere recepten ongewijzigd blijven; het id ' +
    'in het antwoord is dan dat van het nieuwe ingrediënt. De andere ingrediënten en de volgorde blijven ongewijzigd.',
  params: FermentableParams,
  body: FermentableInput,
  response: Fermentable,
  responseDescription: 'Het gewijzigde ingrediënt',
  errors: { 404: ingredientNietGevonden, 409: alInRecept },
  handler: ({ params, body }) =>
    fermentableOfFout(updateFermentable(params.id, params.ingredientId, body), params.id, params.ingredientId),
});

recepten.route({
  method: 'delete',
  path: '/:id/fermentables/:ingredientId',
  summary: 'Vergistbaar ingrediënt uit een recept verwijderen',
  description: 'Haalt het ingrediënt uit de moutstort van dit recept. Het ingrediënt blijft in de catalogus.',
  params: FermentableParams,
  status: 204,
  response: Fermentable,
  responseDescription: 'Het ingrediënt is uit het recept verwijderd',
  errors: { 404: ingredientNietGevonden },
  handler: ({ params }) => {
    if (!recipeExists(params.id)) throw new HttpFout(404, `recept ${params.id} niet gevonden`);
    const ingredient = getFermentable(params.id, params.ingredientId);
    if (!ingredient) throw new HttpFout(404, `ingrediënt ${params.ingredientId} zit niet in recept ${params.id}`);
    deleteFermentable(params.id, params.ingredientId);
    return ingredient;
  },
});
