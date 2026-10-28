import {
  countRecipesUsingIngredient,
  createIngredient,
  deleteIngredient,
  getIngredient,
  getIngredients,
  ingredientExists,
  updateIngredient,
} from '../../database/ingredients/queries.ts';
import { createRoutes, HttpFout } from '../openapi/route.ts';
import { Ingredient, IngredientIdParams, IngredientInput, IngredientsList, IngredientsQuery } from './schemas.ts';

export const ingredients = createRoutes('/api/ingredients', 'ingredients');

const nietGevonden = 'Er bestaat geen ingrediënt met dit id';
const dubbel = 'Er bestaat al een ingrediënt met deze naam en fabrikant';

function bestaatOfFout(id: number) {
  const ingredient = getIngredient(id);
  if (!ingredient) throw new HttpFout(404, `ingrediënt ${id} niet gevonden`);
  return ingredient;
}

ingredients.route({
  method: 'get',
  path: '/',
  summary: 'Lijst van alle ingrediënten',
  description: 'Alle vergistbare ingrediënten uit de catalogus, alfabetisch op naam. Met `search` alleen de ingrediënten waarvan de naam die tekst bevat.',
  query: IngredientsQuery,
  response: IngredientsList,
  responseDescription: 'De ingrediënten',
  handler: ({ query }) => getIngredients(query.search),
});

ingredients.route({
  method: 'get',
  path: '/:id',
  summary: 'Eén ingrediënt',
  params: IngredientIdParams,
  response: Ingredient,
  responseDescription: 'Het ingrediënt',
  errors: { 404: nietGevonden },
  handler: ({ params }) => bestaatOfFout(params.id),
});

ingredients.route({
  method: 'post',
  path: '/',
  summary: 'Ingrediënt toevoegen',
  body: IngredientInput,
  status: 201,
  response: Ingredient,
  responseDescription: 'Het toegevoegde ingrediënt',
  errors: { 409: dubbel },
  handler: ({ body }) => {
    if (ingredientExists(body)) throw new HttpFout(409, dubbel);
    return createIngredient(body);
  },
});

ingredients.route({
  method: 'put',
  path: '/:id',
  summary: 'Ingrediënt wijzigen',
  description: 'Recepten die het ingrediënt gebruiken, tonen meteen de nieuwe naam en fabrikant.',
  params: IngredientIdParams,
  body: IngredientInput,
  response: Ingredient,
  responseDescription: 'Het gewijzigde ingrediënt',
  errors: { 404: nietGevonden, 409: dubbel },
  handler: ({ params, body }) => {
    bestaatOfFout(params.id);
    if (ingredientExists(body, params.id)) throw new HttpFout(409, dubbel);
    return updateIngredient(params.id, body)!;
  },
});

ingredients.route({
  method: 'delete',
  path: '/:id',
  summary: 'Ingrediënt verwijderen',
  description: 'Kan alleen als geen enkel recept het ingrediënt gebruikt.',
  params: IngredientIdParams,
  status: 204,
  response: Ingredient,
  responseDescription: 'Het ingrediënt is verwijderd',
  errors: { 404: nietGevonden, 409: 'Het ingrediënt wordt nog in een of meer recepten gebruikt' },
  handler: ({ params }) => {
    const ingredient = bestaatOfFout(params.id);
    const aantal = countRecipesUsingIngredient(params.id);
    if (aantal > 0) {
      throw new HttpFout(409, `ingrediënt "${ingredient.name}" wordt nog in ${aantal} ${aantal === 1 ? 'recept' : 'recepten'} gebruikt`);
    }
    deleteIngredient(params.id);
    return ingredient;
  },
});
