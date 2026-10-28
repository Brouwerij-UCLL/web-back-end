import { db } from '../db.ts';

// Recepten met al hun onderdelen. De API gebruikt Engelse veldnamen, dicht bij de kolommen van het schema (migratie 003).

export type RecipeSummary = {
  id: number;
  name: string;
  beer_style: string | null;
  description: string | null;
};

export type RecipeIngredient = {
  ingredient_id: number;
  name: string;
  manufacturer: string | null;
  amount_g: number;
};

export type HopAddition = {
  id: number;
  hop_id: number;
  name: string;
  alpha_acid_percentage: number | null;
  type: number;
  origin: string | null;
  amount_g: number;
  boil_time_min: number;
};

export type RecipeExtra = {
  extra_ingredient_id: number;
  name: string;
  description: string | null;
  amount: number;
  unit: string;
  add_moment: 'beslag' | 'koken';
  boil_time_min: number | null;
};

export type MashStep = {
  step_nr: number;
  temperature_c: number;
  duration_min: number;
};

export type FermentationStep = {
  step_nr: number;
  temperature_c: number;
  duration_days: number;
};

// SQLite geeft datums terug als tekst, bv. "2026-10-14 12:38:49".
export type Recipe = RecipeSummary & {
  created_at: string;
  updated_at: string;
  water: { mash_water_l: number; sparge_water_l: number } | null;
  ingredients: RecipeIngredient[];
  hops: HopAddition[];
  extras: RecipeExtra[];
  mash_schedule: { steps: MashStep[] };
  fermentation_schedule: { steps: FermentationStep[] };
};

// Alle recepten voor de lijstweergave, alfabetisch op naam.
export function getRecepten(): RecipeSummary[] {
  return db
    .prepare(`
      SELECT recipe_id AS id, name, beer_style, description
      FROM recipes
      ORDER BY name`)
    .all() as RecipeSummary[];
}

export function getRecept(id: number): Recipe | undefined {
  const result = db.prepare(`
    SELECT json_object(
      'id', recipes.recipe_id,
      'name', recipes.name,
      'beer_style', recipes.beer_style,
      'description', recipes.description,
      'created_at', recipes.timestamp_create,
      'updated_at', recipes.timestamp_edit,
      'water', json((
        SELECT json_object(
          'mash_water_l', water.mash_water_l,
          'sparge_water_l', water.sparge_water_l
        )
        FROM recipe_water water
        WHERE water.recipe_id = recipes.recipe_id
      )),
      'ingredients', json((
        SELECT json_group_array(json_object(
          'ingredient_id', ingredients.ingredient_id,
          'name', ingredients.name,
          'manufacturer', ingredients.manufacturer,
          'amount_g', recipe_ingredients.amount_g
        ))
        FROM recipe_ingredients
        JOIN ingredients ON ingredients.ingredient_id = recipe_ingredients.ingredient_id
        WHERE recipe_ingredients.recipe_id = recipes.recipe_id
      )),
      'hops', json((
        SELECT json_group_array(json_object(
          'id', hop_additions.hop_addition_id,
          'hop_id', hops.hop_id,
          'name', hops.name,
          'alpha_acid_percentage', hops.alpha_acid_percentage,
          'type', hops.type,
          'origin', hops.origin,
          'amount_g', hop_additions.amount,
          'boil_time_min', hop_additions.boil_time_min
        ))
        FROM (
          SELECT hop_addition_id, recipe_id, hop_id, amount, boil_time_min
          FROM hop_additions
          WHERE recipe_id = recipes.recipe_id
          ORDER BY boil_time_min DESC
        ) hop_additions
        JOIN hops ON hops.hop_id = hop_additions.hop_id
      )),
      'extras', json((
        SELECT json_group_array(json_object(
          'extra_ingredient_id', extras.extra_ingredient_id,
          'name', extras.name,
          'description', extras.description,
          'amount', extras.amount,
          'unit', extras.unit,
          'add_moment', extras.add_moment,
          'boil_time_min', extras.boil_time
        ))
        FROM (
          SELECT recipe_extras.*, extra_ingredients.name, extra_ingredients.description, extra_ingredients.unit
          FROM recipe_extras
          JOIN extra_ingredients
            ON extra_ingredients.extra_ingredient_id = recipe_extras.extra_ingredient_id
          WHERE recipe_extras.recipe_id = recipes.recipe_id
          ORDER BY recipe_extras.add_moment, recipe_extras.boil_time DESC -- eerst beslag, dan koken van lang naar kort
        ) extras
      )),
      'mash_schedule', json_object(
        'steps', json((
          SELECT json_group_array(json_object(
            'step_nr', mash_steps.step_nr,
            'temperature_c', mash_steps.temperature,
            'duration_min', mash_steps.duration
          ))
          FROM (
            SELECT step_nr, temperature, duration
            FROM recipe_mash_steps
            WHERE recipe_id = recipes.recipe_id
            ORDER BY step_nr
          ) mash_steps
        ))
      ),
      'fermentation_schedule', json_object(
        'steps', json((
          SELECT json_group_array(json_object(
            'step_nr', fermentation_steps.step_nr,
            'temperature_c', fermentation_steps.temperature,
            'duration_days', fermentation_steps.duration
          ))
          FROM (
            SELECT step_nr, temperature, duration
            FROM recipe_fermentation_steps
            WHERE recipe_id = recipes.recipe_id
            ORDER BY step_nr
          ) fermentation_steps
        ))
      )
    ) AS recipe
    FROM recipes
    WHERE recipes.recipe_id = ?
  `).get(id) as { recipe: string } | undefined;

  if (!result) return undefined;
  return JSON.parse(result.recipe) as Recipe;
}

// Geeft een lege lijst als het recept geen ingrediënten heeft of niet bestaat.
export function getReceptIngredients(id: number): RecipeIngredient[] {
  return db
    .prepare(`
      SELECT
        ingredients.ingredient_id AS ingredient_id,
        ingredients.name AS name,
        ingredients.manufacturer AS manufacturer,
        recipe_ingredients.amount_g AS amount_g
      FROM recipe_ingredients
      JOIN ingredients ON ingredients.ingredient_id = recipe_ingredients.ingredient_id
      WHERE recipe_ingredients.recipe_id = ?
      ORDER BY recipe_ingredients.amount_g DESC`)
    .all(id) as RecipeIngredient[];
}
