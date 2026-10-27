import {
  getRecept,
  getRecepten,
  getReceptIngredients,
  getReceptWithIngredients,
} from '../../database/recepten/queries.ts';
import { getMaischschema, vervangMaischschema } from '../../database/recepten/maischschema.ts';
import { createRoutes, HttpFout } from '../openapi/route.ts';
import {
  IngredientenLijst,
  Maischschema,
  MaischschemaInvoer,
  Recept,
  ReceptenLijst,
  ReceptIdParams,
  ReceptMetIngredienten,
} from './schemas.ts';

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

recepten.route({
  method: 'get',
  path: '/:id/maischschema',
  summary: 'Maischschema van een recept',
  description: 'De maischstappen in volgorde (stap_volgorde vanaf 1) en de kooktijd.',
  params: ReceptIdParams,
  response: Maischschema,
  responseDescription: 'Het maischschema; een lege lijst stappen en kooktijd null als er nog geen is ingesteld',
  errors: { 404: nietGevonden },
  handler: ({ params }) => {
    const schema = getMaischschema(params.id);
    if (!schema) throw new HttpFout(404, `recept ${params.id} niet gevonden`);
    return schema;
  },
});

recepten.route({
  method: 'put',
  path: '/:id/maischschema',
  summary: 'Maischschema van een recept opslaan of vervangen',
  description:
    'Vervangt alle maischstappen en de kooktijd in één keer. De stappen worden genummerd in de volgorde van de lijst. ' +
    'Is één waarde ongeldig, dan wordt er niets opgeslagen en blijft het vorige schema staan. ' +
    'Grenzen: temperatuur 20–80 °C, duur 1–240 minuten, kooktijd 1–180 minuten.',
  params: ReceptIdParams,
  body: MaischschemaInvoer,
  response: Maischschema,
  responseDescription: 'Het opgeslagen maischschema',
  errors: { 404: nietGevonden },
  handler: ({ params, body }) => {
    const schema = vervangMaischschema(params.id, body);
    if (!schema) throw new HttpFout(404, `recept ${params.id} niet gevonden`);
    return schema;
  },
});
