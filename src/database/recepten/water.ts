import { db } from '../db.ts';

// Maisch- en spoelwater van een recept: één rij per recept in recipe_water.

export type WaterInput = {
  mash_water_l: number;
  sparge_water_l: number;
};

export type Water = {
  recipe_id: number;
  mash_water_l: number | null;
  sparge_water_l: number | null;
};

// Het water van een recept; null-waarden als er nog niets is ingesteld. undefined als het recept niet bestaat.
export function getWater(recipeId: number): Water | undefined {
  if (!recipeExists(recipeId)) return undefined;

  const row = db.prepare('SELECT mash_water_l, sparge_water_l FROM recipe_water WHERE recipe_id = ?').get(recipeId) as
    | { mash_water_l: number; sparge_water_l: number }
    | undefined;
  return { recipe_id: recipeId, mash_water_l: row?.mash_water_l ?? null, sparge_water_l: row?.sparge_water_l ?? null };
}

// Slaat het water op of vervangt het; recipe_id is de sleutel, dus er blijft altijd één rij. undefined als het recept niet bestaat.
export function saveWater(recipeId: number, water: WaterInput): Water | undefined {
  if (!recipeExists(recipeId)) return undefined;

  db.prepare(
    `INSERT INTO recipe_water (recipe_id, mash_water_l, sparge_water_l) VALUES (?, ?, ?)
     ON CONFLICT (recipe_id) DO UPDATE SET mash_water_l = excluded.mash_water_l, sparge_water_l = excluded.sparge_water_l`,
  ).run(recipeId, water.mash_water_l, water.sparge_water_l);
  return getWater(recipeId);
}

function recipeExists(recipeId: number): boolean {
  return db.prepare('SELECT 1 FROM recipes WHERE recipe_id = ?').get(recipeId) !== undefined;
}
