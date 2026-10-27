import { db } from '../db.ts';

// De database gebruikt Engelse tabel- en kolomnamen (migratie 003); de API geeft Nederlandse veldnamen terug.

export type ReceptOverzicht = {
  id: number;
  naam: string;
  bierstijl: string | null;
  beschrijving: string | null;
};

export type Water = {
  maischwater_liter: number;
  spoelwater_liter: number;
} | null;

export type Vergistbaar = {
  id: number;
  naam: string;
  fabrikant: string | null;
  hoeveelheid_kg: number;
};

export type Hop = {
  id: number;
  naam: string;
  alfazuur_percentage: number | null;
  type: number;
  herkomst: string | null;
  hoeveelheid_gram: number;
  kooktijd_minuten: number;
};

export type Extra = {
  id: number;
  naam: string;
  omschrijving: string | null;
  hoeveelheid: number;
  eenheid: string;
  toevoegmoment: 'beslag' | 'koken';
  kooktijd_minuten: number | null;
};

export type Maischstap = {
  stap_volgorde: number;
  temperatuur_celsius: number;
  duur_minuten: number;
};

export type Vergistingsstap = {
  stap_volgorde: number;
  temperatuur_celsius: number;
  duur_dagen: number;
};

// SQLite geeft datums terug als tekst, bv. "2026-10-14 12:38:49".
export type Recept = ReceptOverzicht & {
  aangemaakt_op: string;
  gewijzigd_op: string;
  water: Water;
  ingredienten: Ingredient[];
  vergistbaar: Vergistbaar[];
  hop: Hop[];
  extra: Extra[];
  maischschema: {
    stappen: Maischstap[];
  };
  vergistingsschema: {
    stappen: Vergistingsstap[];
  };
};

export type Ingredient = {
  ingredient_id: number;
  naam: string;
  fabrikant: string | null;
  hoeveelheid_g: number;
};

export type ReceptWithIngredients = Recept;

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
  const result = db.prepare(`
    SELECT json_object(
      'id', recipes.recipe_id,
      'naam', recipes.name,
      'bierstijl', recipes.beer_style,
      'beschrijving', recipes.description,
      'aangemaakt_op', recipes.timestamp_create,
      'gewijzigd_op', recipes.timestamp_edit,
      'water', json((
        SELECT json_object(
          'maischwater_liter', water.mash_water_l,
          'spoelwater_liter', water.sparge_water_l
        )
        FROM recipe_water water
        WHERE water.recipe_id = recipes.recipe_id
      )),
      'ingredienten', json((
        SELECT json_group_array(json_object(
          'ingredient_id', ingredients.ingredient_id,
          'naam', ingredients.name,
          'fabrikant', ingredients.manufacturer,
          'hoeveelheid_g', recipe_ingredients.amount_g
        ))
        FROM recipe_ingredients
        JOIN ingredients ON ingredients.ingredient_id = recipe_ingredients.ingredient_id
        WHERE recipe_ingredients.recipe_id = recipes.recipe_id
      )),
      'vergistbaar', json((
        SELECT json_group_array(json_object(
          'id', ingredients.ingredient_id,
          'naam', ingredients.name,
          'fabrikant', ingredients.manufacturer,
          'hoeveelheid_kg', recipe_ingredients.amount_g / 1000.0
        ))
        FROM recipe_ingredients
        JOIN ingredients ON ingredients.ingredient_id = recipe_ingredients.ingredient_id
        WHERE recipe_ingredients.recipe_id = recipes.recipe_id
      )),
      'hop', json((
        SELECT json_group_array(json_object(
          'id', hop_additions.hop_addition_id,
          'naam', hops.name,
          'alfazuur_percentage', hops.alpha_acid_percentage,
          'type', hops.type,
          'herkomst', hops.origin,
          'hoeveelheid_gram', hop_additions.amount,
          'kooktijd_minuten', hop_additions.boil_time_min
        ))
        FROM (
          SELECT hop_addition_id, recipe_id, hop_id, amount, boil_time_min
          FROM hop_additions
          WHERE recipe_id = recipes.recipe_id
          ORDER BY boil_time_min DESC
        ) hop_additions
        JOIN hops ON hops.hop_id = hop_additions.hop_id
      )),
      'extra', json((
        SELECT json_group_array(json_object(
          'id', extra_ingredients.extra_ingredient_id,
          'naam', extra_ingredients.name,
          'omschrijving', extra_ingredients.description,
          'hoeveelheid', recipe_extras.amount,
          'eenheid', extra_ingredients.unit,
          'toevoegmoment', recipe_extras.add_moment,
          'kooktijd_minuten', recipe_extras.boil_time
        ))
        FROM recipe_extras
        JOIN extra_ingredients
          ON extra_ingredients.extra_ingredient_id = recipe_extras.extra_ingredient_id
        WHERE recipe_extras.recipe_id = recipes.recipe_id
      )),
      'maischschema', json_object(
        'stappen', json((
          SELECT json_group_array(json_object(
            'stap_volgorde', mash_steps.step_nr,
            'temperatuur_celsius', mash_steps.temperature,
            'duur_minuten', mash_steps.duration
          ))
          FROM (
            SELECT step_nr, temperature, duration
            FROM recipe_mash_steps
            WHERE recipe_id = recipes.recipe_id
            ORDER BY step_nr
          ) mash_steps
        ))
      ),
      'vergistingsschema', json_object(
        'stappen', json((
          SELECT json_group_array(json_object(
            'stap_volgorde', fermentation_steps.step_nr,
            'temperatuur_celsius', fermentation_steps.temperature,
            'duur_dagen', fermentation_steps.duration
          ))
          FROM (
            SELECT step_nr, temperature, duration
            FROM recipe_fermentation_steps
            WHERE recipe_id = recipes.recipe_id
            ORDER BY step_nr
          ) fermentation_steps
        ))
      )
    ) AS recept
    FROM recipes
    WHERE recipes.recipe_id = ?
  `).get(id) as { recept: string } | undefined;

  if (!result) return undefined;
  return JSON.parse(result.recept) as Recept;
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
  return getRecept(id);
}
