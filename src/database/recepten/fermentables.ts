import { db } from '../db.ts';
import type { RecipeIngredient } from './queries.ts';
import { inTransactie, ontbrekendeIds, receptBestaat } from './saveRecipe.ts';

// Vergistbare ingrediënten (moutstort) van een recept (recipe_ingredients). Elk ingrediënt komt
// uit de catalogus ingredients en staat maximaal één keer in een recept; de hoeveelheid is in gram.
// Nieuwe ingrediënten maak je in de catalogus aan (/api/ingredients), niet vanuit een recept.

export type FermentableInput = {
  ingredient_id: number;
  amount_g: number;
};

// Resultaat van toevoegen of wijzigen: het ingrediënt, of waarom het niet lukte.
export type FermentableResult =
  | { ok: true; fermentable: RecipeIngredient }
  | { ok: false; reason: 'recipe_not_found' | 'fermentable_not_found' | 'ingredient_not_in_catalog' | 'already_in_recipe' };

const selectFermentables = `
  SELECT ingredients.ingredient_id, ingredients.name, ingredients.manufacturer, recipe_ingredients.amount_g
  FROM recipe_ingredients
  JOIN ingredients ON ingredients.ingredient_id = recipe_ingredients.ingredient_id
  WHERE recipe_ingredients.recipe_id = ?`;

// In de volgorde waarin ze aan het recept zijn toegevoegd (rowid van recipe_ingredients).
// undefined als het recept niet bestaat.
export function getFermentables(recipeId: number): RecipeIngredient[] | undefined {
  if (!receptBestaat(recipeId)) return undefined;
  return db
    .prepare(`${selectFermentables} ORDER BY recipe_ingredients.rowid`)
    .all(recipeId)
    .map((row) => ({ ...row }) as RecipeIngredient); // node:sqlite geeft objecten zonder prototype; maak er gewone objecten van
}

// Eén ingrediënt van een recept; undefined als het niet in dit recept zit.
export function getFermentable(recipeId: number, ingredientId: number): RecipeIngredient | undefined {
  const row = db.prepare(`${selectFermentables} AND recipe_ingredients.ingredient_id = ?`).get(recipeId, ingredientId);
  return row ? ({ ...row } as RecipeIngredient) : undefined;
}

// Koppelt een ingrediënt uit de catalogus aan het recept.
export function addFermentable(recipeId: number, input: FermentableInput): FermentableResult {
  return inTransactie(() => {
    if (!receptBestaat(recipeId)) return { ok: false, reason: 'recipe_not_found' };
    if (ontbrekendeIds('ingredients', [input.ingredient_id]).length > 0) return { ok: false, reason: 'ingredient_not_in_catalog' };
    if (getFermentable(recipeId, input.ingredient_id)) return { ok: false, reason: 'already_in_recipe' };

    db.prepare('INSERT INTO recipe_ingredients (recipe_id, ingredient_id, amount_g) VALUES (?, ?, ?)').run(
      recipeId,
      input.ingredient_id,
      input.amount_g,
    );
    return { ok: true, fermentable: getFermentable(recipeId, input.ingredient_id)! };
  });
}

// Wijzigt de hoeveelheid en eventueel het ingrediënt (een ander id uit de catalogus).
// De plaats in de lijst en de andere ingrediënten blijven ongewijzigd.
export function updateFermentable(recipeId: number, ingredientId: number, input: FermentableInput): FermentableResult {
  return inTransactie(() => {
    if (!receptBestaat(recipeId)) return { ok: false, reason: 'recipe_not_found' };
    if (!getFermentable(recipeId, ingredientId)) return { ok: false, reason: 'fermentable_not_found' };
    if (ontbrekendeIds('ingredients', [input.ingredient_id]).length > 0) return { ok: false, reason: 'ingredient_not_in_catalog' };
    if (input.ingredient_id !== ingredientId && getFermentable(recipeId, input.ingredient_id)) {
      return { ok: false, reason: 'already_in_recipe' };
    }

    db.prepare('UPDATE recipe_ingredients SET ingredient_id = ?, amount_g = ? WHERE recipe_id = ? AND ingredient_id = ?').run(
      input.ingredient_id,
      input.amount_g,
      recipeId,
      ingredientId,
    );
    return { ok: true, fermentable: getFermentable(recipeId, input.ingredient_id)! };
  });
}

// Haalt het ingrediënt uit het recept; de catalogus blijft ongewijzigd.
// false als het recept het ingrediënt niet heeft.
export function deleteFermentable(recipeId: number, ingredientId: number): boolean {
  const { changes } = db
    .prepare('DELETE FROM recipe_ingredients WHERE recipe_id = ? AND ingredient_id = ?')
    .run(recipeId, ingredientId);
  return changes > 0;
}
