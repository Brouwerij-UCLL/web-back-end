import { db } from '../db.ts';
import type { RecipeExtra } from './queries.ts';

// Extra ingrediënten van een recept (recipe_extras). Elk extra ingrediënt komt uit de catalogus
// extra_ingredients en staat maximaal één keer in een recept.

export type RecipeExtraUpdate = {
  amount: number;
  add_moment: 'beslag' | 'koken';
  boil_time_min: number | null;
};

export type RecipeExtraInput = RecipeExtraUpdate & { extra_ingredient_id: number };

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

// Eén extra ingrediënt van een recept; undefined als het niet in dat recept zit.
export function getExtra(recipeId: number, extraIngredientId: number): RecipeExtra | undefined {
  const row = db.prepare(`${selectExtras} AND recipe_extras.extra_ingredient_id = ?`).get(recipeId, extraIngredientId);
  return row ? ({ ...row } as RecipeExtra) : undefined;
}

export function addExtra(recipeId: number, extra: RecipeExtraInput): RecipeExtra {
  db.prepare(
    'INSERT INTO recipe_extras (recipe_id, extra_ingredient_id, amount, add_moment, boil_time) VALUES (?, ?, ?, ?, ?)',
  ).run(recipeId, extra.extra_ingredient_id, extra.amount, extra.add_moment, extra.boil_time_min);
  return getExtra(recipeId, extra.extra_ingredient_id)!;
}

export function updateExtra(recipeId: number, extraIngredientId: number, extra: RecipeExtraUpdate): RecipeExtra {
  db.prepare(
    'UPDATE recipe_extras SET amount = ?, add_moment = ?, boil_time = ? WHERE recipe_id = ? AND extra_ingredient_id = ?',
  ).run(extra.amount, extra.add_moment, extra.boil_time_min, recipeId, extraIngredientId);
  return getExtra(recipeId, extraIngredientId)!;
}

export function deleteExtra(recipeId: number, extraIngredientId: number): void {
  db.prepare('DELETE FROM recipe_extras WHERE recipe_id = ? AND extra_ingredient_id = ?').run(recipeId, extraIngredientId);
}
