import { db } from '../db.ts';

// Catalogus van vergistbare ingrediënten (tabel ingredients), gedeeld door alle recepten.

export type Ingredient = {
  id: number;
  name: string;
  manufacturer: string | null;
};

export type IngredientInput = {
  name: string;
  manufacturer: string | null;
};

const kolommen = `ingredient_id AS id, name, manufacturer`;

// Alle ingrediënten alfabetisch op naam; met search alleen die waarvan de naam de zoekterm bevat (hoofdletters niet meegerekend).
export function getIngredients(search?: string): Ingredient[] {
  if (search) {
    return db
      .prepare(`SELECT ${kolommen} FROM ingredients WHERE lower(name) LIKE '%' || lower(?) || '%' ORDER BY name COLLATE NOCASE`)
      .all(search) as Ingredient[];
  }
  return db.prepare(`SELECT ${kolommen} FROM ingredients ORDER BY name COLLATE NOCASE`).all() as Ingredient[];
}

export function getIngredient(id: number): Ingredient | undefined {
  return db.prepare(`SELECT ${kolommen} FROM ingredients WHERE ingredient_id = ?`).get(id) as Ingredient | undefined;
}

// Bestaat er al een ingrediënt met dezelfde naam en fabrikant (eventueel buiten het ingrediënt met id uitgezonderd)?
export function ingredientExists(input: IngredientInput, uitgezonderdId?: number): boolean {
  const rij = db
    .prepare(`
      SELECT 1 FROM ingredients
      WHERE lower(name) = lower(?) AND lower(coalesce(manufacturer, '')) = lower(coalesce(?, ''))
        AND ingredient_id != ?`)
    .get(input.name, input.manufacturer, uitgezonderdId ?? -1);
  return rij !== undefined;
}

export function createIngredient(input: IngredientInput): Ingredient {
  const resultaat = db
    .prepare('INSERT INTO ingredients (name, manufacturer) VALUES (?, ?)')
    .run(input.name, input.manufacturer);
  return getIngredient(Number(resultaat.lastInsertRowid))!;
}

export function updateIngredient(id: number, input: IngredientInput): Ingredient | undefined {
  db.prepare('UPDATE ingredients SET name = ?, manufacturer = ? WHERE ingredient_id = ?').run(input.name, input.manufacturer, id);
  return getIngredient(id);
}

// Aantal recepten dat het ingrediënt gebruikt.
export function countRecipesUsingIngredient(id: number): number {
  const rij = db
    .prepare('SELECT count(DISTINCT recipe_id) AS aantal FROM recipe_ingredients WHERE ingredient_id = ?')
    .get(id) as { aantal: number };
  return rij.aantal;
}

export function deleteIngredient(id: number): void {
  db.prepare('DELETE FROM ingredients WHERE ingredient_id = ?').run(id);
}
