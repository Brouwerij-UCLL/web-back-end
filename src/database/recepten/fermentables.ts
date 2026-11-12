import { db } from '../db.ts';

// Vergistbare ingrediënten (moutstort) van een recept. Een ingrediënt komt uit de
// catalogus (ingredients); recipe_ingredients koppelt het aan een recept met een
// hoeveelheid in gram. De API werkt in kilogram.

export type FermentableInput = {
  name: string;
  manufacturer: string | null;
  amount_kg: number;
};

export type Fermentable = FermentableInput & {
  ingredient_id: number;
};

// Resultaat van toevoegen of wijzigen: het ingrediënt, of waarom het niet lukte.
export type FermentableResult =
  | { ok: true; fermentable: Fermentable }
  | { ok: false; reason: 'recipe_not_found' | 'fermentable_not_found' | 'already_in_recipe' };

const kolommen = `
  ingredients.ingredient_id AS ingredient_id,
  ingredients.name AS name,
  ingredients.manufacturer AS manufacturer,
  recipe_ingredients.amount_g / 1000.0 AS amount_kg`;

// Ingrediënten in de volgorde waarin ze aan het recept zijn toegevoegd (rowid van
// recipe_ingredients). undefined als het recept niet bestaat.
export function getFermentables(recipeId: number): Fermentable[] | undefined {
  if (!recipeExists(recipeId)) return undefined;
  return db
    .prepare(`
      SELECT ${kolommen}
      FROM recipe_ingredients
      JOIN ingredients ON ingredients.ingredient_id = recipe_ingredients.ingredient_id
      WHERE recipe_ingredients.recipe_id = ?
      ORDER BY recipe_ingredients.rowid`)
    .all(recipeId)
    .map((rij) => ({ ...rij }) as Fermentable); // node:sqlite geeft objecten zonder prototype; maak er gewone objecten van
}

// Eén ingrediënt van een recept. undefined als het recept het ingrediënt niet heeft.
export function getFermentable(recipeId: number, ingredientId: number): Fermentable | undefined {
  const rij = db
    .prepare(`
      SELECT ${kolommen}
      FROM recipe_ingredients
      JOIN ingredients ON ingredients.ingredient_id = recipe_ingredients.ingredient_id
      WHERE recipe_ingredients.recipe_id = ? AND recipe_ingredients.ingredient_id = ?`)
    .get(recipeId, ingredientId);
  return rij ? ({ ...rij } as Fermentable) : undefined;
}

// Koppelt een ingrediënt aan het recept. Bestaat er in de catalogus nog geen
// ingrediënt met die naam en fabrikant, dan wordt het aangemaakt. Alles in één
// transactie: mislukt de koppeling, dan blijft er ook geen nieuw catalogus-ingrediënt achter.
export function addFermentable(recipeId: number, input: FermentableInput): FermentableResult {
  return inTransaction(() => {
    if (!recipeExists(recipeId)) return { ok: false, reason: 'recipe_not_found' };

    const ingredientId = findOrCreateIngredient(input);
    if (getFermentable(recipeId, ingredientId)) return { ok: false, reason: 'already_in_recipe' };

    db.prepare('INSERT INTO recipe_ingredients (recipe_id, ingredient_id, amount_g) VALUES (?, ?, ?)').run(
      recipeId,
      ingredientId,
      toGrams(input.amount_kg),
    );
    return { ok: true, fermentable: getFermentable(recipeId, ingredientId)! };
  });
}

// Zet de koppeling om naar het catalogus-ingrediënt met de nieuwe naam en fabrikant
// (bestaand of nieuw) en past de hoeveelheid aan. Het catalogus-ingrediënt zelf
// verandert niet, zodat andere recepten ongemoeid blijven. De plaats in de lijst blijft behouden.
export function updateFermentable(recipeId: number, ingredientId: number, input: FermentableInput): FermentableResult {
  return inTransaction(() => {
    if (!recipeExists(recipeId)) return { ok: false, reason: 'recipe_not_found' };
    if (!getFermentable(recipeId, ingredientId)) return { ok: false, reason: 'fermentable_not_found' };

    const nieuwId = findOrCreateIngredient(input);
    if (nieuwId !== ingredientId && getFermentable(recipeId, nieuwId)) return { ok: false, reason: 'already_in_recipe' };

    db.prepare('UPDATE recipe_ingredients SET ingredient_id = ?, amount_g = ? WHERE recipe_id = ? AND ingredient_id = ?').run(
      nieuwId,
      toGrams(input.amount_kg),
      recipeId,
      ingredientId,
    );
    return { ok: true, fermentable: getFermentable(recipeId, nieuwId)! };
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

export function recipeExists(recipeId: number): boolean {
  return db.prepare('SELECT 1 FROM recipes WHERE recipe_id = ?').get(recipeId) !== undefined;
}

// Zoekt het catalogus-ingrediënt op naam en fabrikant (hoofdletters niet meegerekend,
// net als de controle op dubbels in de catalogus) en maakt het aan als het nog niet bestaat.
function findOrCreateIngredient(input: FermentableInput): number {
  const bestaand = db
    .prepare(`
      SELECT ingredient_id FROM ingredients
      WHERE lower(name) = lower(?) AND lower(coalesce(manufacturer, '')) = lower(coalesce(?, ''))
      ORDER BY ingredient_id
      LIMIT 1`)
    .get(input.name, input.manufacturer) as { ingredient_id: number } | undefined;
  if (bestaand) return bestaand.ingredient_id;

  const { lastInsertRowid } = db
    .prepare('INSERT INTO ingredients (name, manufacturer) VALUES (?, ?)')
    .run(input.name, input.manufacturer);
  return Number(lastInsertRowid);
}

// Afronden op een milligram, zodat bv. 1.1 kg exact 1100 g wordt en niet 1100.0000000000002.
function toGrams(kg: number): number {
  return Math.round(kg * 1_000_000) / 1000;
}

function inTransaction<T>(fn: () => T): T {
  db.exec('BEGIN');
  try {
    const resultaat = fn();
    db.exec('COMMIT');
    return resultaat;
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}
