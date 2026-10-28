import { getRecept, getRecepten, getReceptIngredients } from '../../database/recepten/queries.ts';
import { maakRecept, ontbrekendeIds, receptBestaat, vervangRecept, type RecipeInput as RecipeInputData } from '../../database/recepten/saveRecipe.ts';
import {
  addHopAddition,
  deleteHopAddition,
  getHopAddition,
  getHopAdditions,
  updateHopAddition,
} from '../../database/recepten/hopAdditions.ts';
import { addExtra, deleteExtra, getExtra, getExtras, updateExtra } from '../../database/recepten/extras.ts';
import { getMashSchedule, replaceMashSchedule } from '../../database/recepten/mashSchedule.ts';
import { getWater, saveWater } from '../../database/recepten/water.ts';
import { getFermentationSchedule, replaceFermentationSchedule } from '../../database/recepten/fermentationSchedule.ts';
import { createRoutes, HttpFout } from '../openapi/route.ts';
import { HopAdditionInput, HopAdditionList, HopAdditionParams, HopAdditionResponse,FermentationSchedule, FermentationScheduleInput, Recipe, MashSchedule, MashScheduleInput, RecipeExtra, RecipeExtraInput, RecipeExtraList, RecipeExtraParams, RecipeExtraUpdate, RecipeIngredientList, RecipeInput, RecipeList, ReceptIdParams, Water, WaterInput } from './schemas.ts';

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

const hopgiftNietGevonden = 'Het recept bestaat niet, of de hopgift hoort niet bij dit recept';

// De hopgift van dit recept, of 404 als het recept niet bestaat of de gift er niet bij hoort.
function hopgiftOfFout(recipeId: number, hopAdditionId: number) {
  if (!receptBestaat(recipeId)) throw new HttpFout(404, `recept ${recipeId} niet gevonden`);
  const gift = getHopAddition(recipeId, hopAdditionId);
  if (!gift) throw new HttpFout(404, `hopgift ${hopAdditionId} hoort niet bij recept ${recipeId}`);
  return gift;
}

function controleerHop(hopId: number) {
  if (ontbrekendeIds('hops', [hopId]).length > 0) throw new HttpFout(400, `Ongeldige request body: hop ${hopId} bestaat niet`);
}

recepten.route({
  method: 'get',
  path: '/:id/hops',
  summary: 'Hopgiften van een recept',
  description: 'Van langste naar kortste kooktijd, dus in de volgorde waarin ze in de ketel gaan.',
  params: ReceptIdParams,
  response: HopAdditionList,
  responseDescription: 'De hopgiften; een lege lijst als het recept er geen heeft',
  errors: { 404: nietGevonden },
  handler: ({ params }) => {
    if (!receptBestaat(params.id)) throw new HttpFout(404, `recept ${params.id} niet gevonden`);
    return getHopAdditions(params.id);
  },
});

recepten.route({
  method: 'get',
  path: '/:id/hops/:hopAdditionId',
  summary: 'Eén hopgift van een recept',
  params: HopAdditionParams,
  response: HopAdditionResponse,
  responseDescription: 'De hopgift',
  errors: { 404: hopgiftNietGevonden },
  handler: ({ params }) => hopgiftOfFout(params.id, params.hopAdditionId),
});

recepten.route({
  method: 'post',
  path: '/:id/hops',
  summary: 'Hopgift aan een recept toevoegen',
  description:
    'Voegt een hop uit de catalogus (GET /api/hops) toe met hoeveelheid en kooktijd (0–180 minuten). ' +
    'Dezelfde hop kan meerdere keren gegeven worden; elke gift krijgt een eigen id.',
  params: ReceptIdParams,
  body: HopAdditionInput,
  status: 201,
  response: HopAdditionResponse,
  responseDescription: 'De toegevoegde hopgift',
  errors: { 404: nietGevonden },
  handler: ({ params, body }) => {
    if (!receptBestaat(params.id)) throw new HttpFout(404, `recept ${params.id} niet gevonden`);
    controleerHop(body.hop_id);
    return addHopAddition(params.id, body);
  },
});

recepten.route({
  method: 'put',
  path: '/:id/hops/:hopAdditionId',
  summary: 'Hopgift van een recept wijzigen',
  description: 'Vervangt hop, hoeveelheid en kooktijd van deze gift. De andere hopgiften blijven ongewijzigd.',
  params: HopAdditionParams,
  body: HopAdditionInput,
  response: HopAdditionResponse,
  responseDescription: 'De gewijzigde hopgift',
  errors: { 404: hopgiftNietGevonden },
  handler: ({ params, body }) => {
    hopgiftOfFout(params.id, params.hopAdditionId);
    controleerHop(body.hop_id);
    return updateHopAddition(params.id, params.hopAdditionId, body);
  },
});

recepten.route({
  method: 'delete',
  path: '/:id/hops/:hopAdditionId',
  summary: 'Hopgift uit een recept verwijderen',
  description: 'Haalt deze gift uit het recept; de hop blijft in de catalogus staan.',
  params: HopAdditionParams,
  status: 204,
  response: HopAdditionResponse,
  responseDescription: 'De hopgift is verwijderd',
  errors: { 404: hopgiftNietGevonden },
  handler: ({ params }) => {
    const gift = hopgiftOfFout(params.id, params.hopAdditionId);
    deleteHopAddition(params.id, params.hopAdditionId);
    return gift;
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

// ----- Extra ingrediënten van een recept (SCRUM-53) -----

const extraNietGevonden = 'Het recept bestaat niet, of het extra ingrediënt zit niet in dit recept';

// Het extra ingrediënt van dit recept, of 404 als het recept niet bestaat of het ingrediënt er niet in zit.
function extraOfFout(recipeId: number, extraIngredientId: number) {
  if (!receptBestaat(recipeId)) throw new HttpFout(404, `recept ${recipeId} niet gevonden`);
  const extra = getExtra(recipeId, extraIngredientId);
  if (!extra) throw new HttpFout(404, `extra ingrediënt ${extraIngredientId} zit niet in recept ${recipeId}`);
  return extra;
}

recepten.route({
  method: 'get',
  path: '/:id/extras',
  summary: 'Extra ingrediënten van een recept',
  description: 'Eerst de extra ingrediënten voor het beslag, dan die voor het koken van langste naar kortste kooktijd.',
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
  path: '/:id/extras/:extraIngredientId',
  summary: 'Eén extra ingrediënt van een recept',
  params: RecipeExtraParams,
  response: RecipeExtra,
  responseDescription: 'Het extra ingrediënt',
  errors: { 404: extraNietGevonden },
  handler: ({ params }) => extraOfFout(params.id, params.extraIngredientId),
});

recepten.route({
  method: 'post',
  path: '/:id/extras',
  summary: 'Extra ingrediënt aan een recept toevoegen',
  description:
    'Voegt een extra ingrediënt uit de catalogus toe met hoeveelheid, toevoegmoment (beslag of koken) en, bij koken, de kooktijd (0–180 minuten). ' +
    'Bij "beslag" laat je boil_time_min weg of zet je het op null.',
  params: ReceptIdParams,
  body: RecipeExtraInput,
  status: 201,
  response: RecipeExtra,
  responseDescription: 'Het toegevoegde extra ingrediënt',
  errors: { 404: nietGevonden, 409: 'Het extra ingrediënt zit al in dit recept' },
  handler: ({ params, body }) => {
    if (!receptBestaat(params.id)) throw new HttpFout(404, `recept ${params.id} niet gevonden`);
    if (ontbrekendeIds('extra_ingredients', [body.extra_ingredient_id]).length > 0) {
      throw new HttpFout(400, `Ongeldige request body: extra ingrediënt ${body.extra_ingredient_id} bestaat niet`);
    }
    if (getExtra(params.id, body.extra_ingredient_id)) {
      throw new HttpFout(409, `extra ingrediënt ${body.extra_ingredient_id} zit al in recept ${params.id}; wijzig het met PUT`);
    }
    return addExtra(params.id, body);
  },
});

recepten.route({
  method: 'put',
  path: '/:id/extras/:extraIngredientId',
  summary: 'Extra ingrediënt van een recept wijzigen',
  description: 'Vervangt hoeveelheid, toevoegmoment en kooktijd. De andere extra ingrediënten blijven ongewijzigd.',
  params: RecipeExtraParams,
  body: RecipeExtraUpdate,
  response: RecipeExtra,
  responseDescription: 'Het gewijzigde extra ingrediënt',
  errors: { 404: extraNietGevonden },
  handler: ({ params, body }) => {
    extraOfFout(params.id, params.extraIngredientId);
    return updateExtra(params.id, params.extraIngredientId, body);
  },
});

recepten.route({
  method: 'delete',
  path: '/:id/extras/:extraIngredientId',
  summary: 'Extra ingrediënt uit een recept verwijderen',
  description: 'Haalt het extra ingrediënt uit dit recept; het blijft in de catalogus staan.',
  params: RecipeExtraParams,
  status: 204,
  response: RecipeExtra,
  responseDescription: 'Het extra ingrediënt is verwijderd',
  errors: { 404: extraNietGevonden },
  handler: ({ params }) => {
    const extra = extraOfFout(params.id, params.extraIngredientId);
    deleteExtra(params.id, params.extraIngredientId);
    return extra;
  },
});

recepten.route({
  method: 'get',
  path: '/:id/maischschema',
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
  path: '/:id/maischschema',
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
