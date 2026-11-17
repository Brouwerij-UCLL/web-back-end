import { db } from '../db.ts';

// De database gebruikt Engelse tabel- en kolomnamen (migratie 003); de API geeft Nederlandse veldnamen terug.

export type ReceptOverzicht = {
  id: number;
  naam: string;
  bierstijl: string | null;
  beschrijving: string | null;
};

// SQLite geeft datums terug als tekst, bv. "2026-10-14 12:38:49".
export type Recept = ReceptOverzicht & {
  aangemaakt_op: string;
  gewijzigd_op: string;
  maischwater_liter: number | null;
  spoelwater_liter: number | null;
};

export type Ingredient = {
  ingredient_id: number;
  naam: string;
  fabrikant: string | null;
  hoeveelheid_g: number;
};

export type ReceptWithIngredients = Recept & {
  ingredienten: Ingredient[];
};

export type ReceptWater = {
  maischwater_liter: number;
  spoelwater_liter: number;
};

const receptKolommen = `
  recipes.recipe_id AS id,
  recipes.name AS naam,
  recipes.beer_style AS bierstijl,
  recipes.description AS beschrijving`;

// Alle recepten voor de lijstweergave, alfabetisch op naam.
export function getRecepten(): ReceptOverzicht[] {
  return db.prepare(`SELECT ${receptKolommen} FROM recipes ORDER BY recipes.name`).all() as ReceptOverzicht[];
}

export function getRecept(id: number): Recept | undefined {
  return db
    .prepare(`
      SELECT ${receptKolommen},
        recipes.timestamp_create AS aangemaakt_op,
        recipes.timestamp_edit AS gewijzigd_op,
        recipe_water.mash_water_l AS maischwater_liter,
        recipe_water.sparge_water_l AS spoelwater_liter
      FROM recipes
      LEFT JOIN recipe_water
        ON recipes.recipe_id = recipe_water.recipe_id
      WHERE recipes.recipe_id = ?`)
    .get(id) as Recept | undefined;
}

// Geeft een lege lijst als het recept geen ingrediënten heeft of niet bestaat.
export function getReceptIngredients(id: number): Ingredient[] {
  return db
    .prepare(`
      SELECT
        ingredients.ingredient_id AS ingredient_id,
        ingredients.name AS naam,
        ingredients.manufacturer AS fabrikant,
        recipe_ingredients.amount_g AS hoeveelheid_g
      FROM recipe_ingredients
      JOIN ingredients ON ingredients.ingredient_id = recipe_ingredients.ingredient_id
      WHERE recipe_ingredients.recipe_id = ?
      ORDER BY recipe_ingredients.amount_g DESC`)
    .all(id) as Ingredient[];
}

export function getReceptWithIngredients(id: number): ReceptWithIngredients | undefined {
  const recept = getRecept(id);
  if (!recept) return undefined;
  return { ...recept, ingredienten: getReceptIngredients(id) };
}

export function getReceptWater(id: number): ReceptWater | null {
  const water = db.prepare(`
    SELECT
      mash_water_l AS maischwater_liter,
      sparge_water_l AS spoelwater_liter
    FROM recipe_water 
    WHERE recipe_id = ?
  `).get(id) as ReceptWater | undefined;

  return water ?? null;
}

export function saveReceptWater(
  id: number,
  maischwater: number,
  spoelwater: number
): ReceptWater | null {

  const recept = db.prepare(
    'SELECT recipe_id FROM recipes WHERE recipe_id = ?'
  ).get(id);

  if (!recept) {
    return null;
  }

  db.prepare(`
    INSERT INTO recipe_water (
      recipe_id,
      mash_water_l,
      sparge_water_l
    )
    VALUES (?, ?, ?)
    ON CONFLICT(recipe_id)
    DO UPDATE SET
      mash_water_l = excluded.mash_water_l,
      sparge_water_l = excluded.sparge_water_l
    `).run(id, maischwater, spoelwater);

    return getReceptWater(id);
}
