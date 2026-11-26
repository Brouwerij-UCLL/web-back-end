import { db } from '../db.ts';

export type RecipeBoilTime = {
  recipe_id: number;
  temperature: number;
  duration: number;
};

export function getRecipeBoilTime(recipeId: number): RecipeBoilTime | undefined {
  return db
    .prepare('SELECT recipe_id, temperature, duration FROM recipe_boil_time WHERE recipe_id = ?')
    .get(recipeId) as RecipeBoilTime | undefined;
}
