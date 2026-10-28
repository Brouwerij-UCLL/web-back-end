import {
  countRecipesUsingExtra,
  createExtra,
  deleteExtra,
  extraExists,
  getExtra,
  getExtras,
  updateExtra,
} from '../../database/extras/queries.ts';
import { createRoutes, HttpFout } from '../openapi/route.ts';
import { Extra, ExtraIdParams, ExtraInput, ExtrasList, ExtrasQuery } from './schemas.ts';

export const extras = createRoutes('/api/extras', 'extras');

const nietGevonden = 'Er bestaat geen extra ingrediënt met dit id';
const dubbel = 'Er bestaat al een extra ingrediënt met deze naam';

function bestaatOfFout(id: number) {
  const extra = getExtra(id);
  if (!extra) throw new HttpFout(404, `extra ingrediënt ${id} niet gevonden`);
  return extra;
}

extras.route({
  method: 'get',
  path: '/',
  summary: 'Lijst van alle extra ingrediënten',
  description:
    'Alle extra ingrediënten uit de catalogus (kruiden, fruit, suikers, …), alfabetisch op naam. Met `search` alleen die waarvan de naam die tekst bevat.',
  query: ExtrasQuery,
  response: ExtrasList,
  responseDescription: 'De extra ingrediënten',
  handler: ({ query }) => getExtras(query.search),
});

extras.route({
  method: 'get',
  path: '/:id',
  summary: 'Eén extra ingrediënt',
  params: ExtraIdParams,
  response: Extra,
  responseDescription: 'Het extra ingrediënt',
  errors: { 404: nietGevonden },
  handler: ({ params }) => bestaatOfFout(params.id),
});

extras.route({
  method: 'post',
  path: '/',
  summary: 'Extra ingrediënt toevoegen',
  body: ExtraInput,
  status: 201,
  response: Extra,
  responseDescription: 'Het toegevoegde extra ingrediënt',
  errors: { 409: dubbel },
  handler: ({ body }) => {
    if (extraExists(body)) throw new HttpFout(409, dubbel);
    return createExtra(body);
  },
});

extras.route({
  method: 'put',
  path: '/:id',
  summary: 'Extra ingrediënt wijzigen',
  description: 'Recepten die het extra ingrediënt gebruiken, tonen meteen de nieuwe gegevens.',
  params: ExtraIdParams,
  body: ExtraInput,
  response: Extra,
  responseDescription: 'Het gewijzigde extra ingrediënt',
  errors: { 404: nietGevonden, 409: dubbel },
  handler: ({ params, body }) => {
    bestaatOfFout(params.id);
    if (extraExists(body, params.id)) throw new HttpFout(409, dubbel);
    return updateExtra(params.id, body)!;
  },
});

extras.route({
  method: 'delete',
  path: '/:id',
  summary: 'Extra ingrediënt verwijderen',
  description: 'Kan alleen als geen enkel recept het extra ingrediënt gebruikt.',
  params: ExtraIdParams,
  status: 204,
  response: Extra,
  responseDescription: 'Het extra ingrediënt is verwijderd',
  errors: { 404: nietGevonden, 409: 'Het extra ingrediënt wordt nog in een of meer recepten gebruikt' },
  handler: ({ params }) => {
    const extra = bestaatOfFout(params.id);
    const aantal = countRecipesUsingExtra(params.id);
    if (aantal > 0) {
      throw new HttpFout(409, `extra ingrediënt "${extra.name}" wordt nog in ${aantal} ${aantal === 1 ? 'recept' : 'recepten'} gebruikt`);
    }
    deleteExtra(params.id);
    return extra;
  },
});
