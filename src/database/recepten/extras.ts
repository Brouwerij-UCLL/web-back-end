import { db } from '../db.ts';
import type { RecipeExtra } from './queries.ts';

// Extra ingrediënten van een recept (recipe_extras), met hun gegevens uit de catalogus extra_ingredients.

const selectExtras = `
  SELECT extra_ingredients.extra_ingredient_id, extra_ingredients.name, extra_ingredients.description,
         recipe_extras.amount, extra_ingredients.unit, recipe_extras.add_moment, recipe_extras.boil_time AS boil_time_min
  FROM recipe_extras
  JOIN extra_ingredients ON extra_ingredients.extra_ingredient_id = recipe_extras.extra_ingredient_id
  WHERE recipe_extras.recipe_id = ?`;

// Eerst de extra's voor het beslag, dan die voor het koken van langste naar kortste kooktijd.
export function getExtras(recipeId: number): RecipeExtra[] {
  return db
    .prepare(`${selectExtras} ORDER BY recipe_extras.add_moment, recipe_extras.boil_time DESC`)
    .all(recipeId)
    .map((row) => ({ ...row }) as RecipeExtra); // node:sqlite geeft objecten zonder prototype; maak er gewone objecten van
}
