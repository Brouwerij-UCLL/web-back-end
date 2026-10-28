import { countRecipesUsingHop, createHop, deleteHop, getHop, getHops, hopExists, updateHop } from '../../database/hops/queries.ts';
import { createRoutes, HttpFout } from '../openapi/route.ts';
import { Hop, HopIdParams, HopInput, HopsList, HopsQuery } from './schemas.ts';

export const hops = createRoutes('/api/hops', 'hops');

const nietGevonden = 'Er bestaat geen hop met dit id';
const dubbel = 'Er bestaat al een hop met deze naam, dit type en deze herkomst';

function bestaatOfFout(id: number) {
  const hop = getHop(id);
  if (!hop) throw new HttpFout(404, `hop ${id} niet gevonden`);
  return hop;
}

hops.route({
  method: 'get',
  path: '/',
  summary: 'Lijst van alle hops',
  description: 'Alle hops uit de catalogus, alfabetisch op naam. Met `search` alleen de hops waarvan de naam die tekst bevat.',
  query: HopsQuery,
  response: HopsList,
  responseDescription: 'De hops',
  handler: ({ query }) => getHops(query.search),
});

hops.route({
  method: 'get',
  path: '/:id',
  summary: 'Eén hop',
  params: HopIdParams,
  response: Hop,
  responseDescription: 'De hop',
  errors: { 404: nietGevonden },
  handler: ({ params }) => bestaatOfFout(params.id),
});

hops.route({
  method: 'post',
  path: '/',
  summary: 'Hop toevoegen',
  body: HopInput,
  status: 201,
  response: Hop,
  responseDescription: 'De toegevoegde hop',
  errors: { 409: dubbel },
  handler: ({ body }) => {
    if (hopExists(body)) throw new HttpFout(409, dubbel);
    return createHop(body);
  },
});

hops.route({
  method: 'put',
  path: '/:id',
  summary: 'Hop wijzigen',
  description: 'Recepten die de hop gebruiken, tonen meteen de nieuwe gegevens.',
  params: HopIdParams,
  body: HopInput,
  response: Hop,
  responseDescription: 'De gewijzigde hop',
  errors: { 404: nietGevonden, 409: dubbel },
  handler: ({ params, body }) => {
    bestaatOfFout(params.id);
    if (hopExists(body, params.id)) throw new HttpFout(409, dubbel);
    return updateHop(params.id, body)!;
  },
});

hops.route({
  method: 'delete',
  path: '/:id',
  summary: 'Hop verwijderen',
  description: 'Kan alleen als geen enkel recept de hop gebruikt.',
  params: HopIdParams,
  status: 204,
  response: Hop,
  responseDescription: 'De hop is verwijderd',
  errors: { 404: nietGevonden, 409: 'De hop wordt nog in een of meer recepten gebruikt' },
  handler: ({ params }) => {
    const hop = bestaatOfFout(params.id);
    const aantal = countRecipesUsingHop(params.id);
    if (aantal > 0) {
      throw new HttpFout(409, `hop "${hop.name}" wordt nog in ${aantal} ${aantal === 1 ? 'recept' : 'recepten'} gebruikt`);
    }
    deleteHop(params.id);
    return hop;
  },
});
