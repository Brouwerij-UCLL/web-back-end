import { db } from '../db.ts';

// Recepten met al hun onderdelen. De API gebruikt Engelse veldnamen, dicht bij de kolommen van het schema (migratie 003).

export type RecipeSummary = {
  id: number;
  name: string;
  beer_style: string | null;
  description: string | null;
};

export type RecipeListItem = {
  id: number;
  name: string;
  beer_style: string | null;
  description: string | null;
  basis_volume_liter: number;
  created_at: string;
  updated_at: string;
};

export type RecipeFilter = {
  search?: string;
  beer_style?: string;
  sort?: 'name' | 'created_at' | 'updated_at';
  direction?: 'asc' | 'desc';
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
export function getRecipes(filter: RecipeFilter): RecipeListItem[] {
  const sortColumns = {
    name: 'name',
    created_at: 'timestamp_create',
    updated_at: 'timestamp_edit',
  } as const;
  const sort = sortColumns[filter.sort ?? 'name'];
  const direction = filter.direction ?? 'asc';
  const conditions: string[] = [];
  const values: string[] = [];

  if (filter.search) {
    conditions.push("name LIKE '%' || ? || '%' COLLATE NOCASE");
    values.push(filter.search);
  }
  if (filter.beer_style) {
    conditions.push('beer_style = ? COLLATE NOCASE');
    values.push(filter.beer_style);
  }

  return db
    .prepare(`
      SELECT
        recipe_id AS id,
        name,
        beer_style,
        description,
        basis_volume_liter,
        timestamp_create AS created_at,
        timestamp_edit AS updated_at
      FROM recipes
      ${conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''}
      ORDER BY ${sort} COLLATE NOCASE ${direction.toUpperCase()}, recipe_id ASC`)
    .all(...values) as RecipeListItem[];
}

export function getRecipeListItem(id: number): RecipeListItem | undefined {
  return db.prepare(`
    SELECT
      recipe_id AS id,
      name,
      beer_style,
      description,
      basis_volume_liter,
      timestamp_create AS created_at,
      timestamp_edit AS updated_at
    FROM recipes
    WHERE recipe_id = ?
  `).get(id) as RecipeListItem | undefined;
}

export function updateRecipeBasics(
  id: number,
  recipe: { name: string; beer_style: string | null; description: string | null; basis_volume_liter: number },
): RecipeListItem | undefined {
  const resultaat = db.prepare(`
    UPDATE recipes
    SET name = ?, beer_style = ?, description = ?, basis_volume_liter = ?,
        timestamp_edit = MAX(
          strftime('%Y-%m-%d %H:%M:%f', 'now'),
          strftime('%Y-%m-%d %H:%M:%f', timestamp_edit, '+0.001 seconds')
        )
    WHERE recipe_id = ?
  `).run(recipe.name, recipe.beer_style, recipe.description, recipe.basis_volume_liter, id);

  if (resultaat.changes === 0) return undefined;
  return getRecipeListItem(id);
}

export function deleteRecipe(id: number): 'deleted' | 'active_session' | 'not_found' {
  const resultaat = db.prepare(`
    DELETE FROM recipes
    WHERE recipe_id = ?
      AND NOT EXISTS (
        SELECT 1 FROM brouwsessies
        WHERE brouwsessies.recept_id = recipes.recipe_id
          AND brouwsessies.status = 'bezig'
      )
  `).run(id);
  if (resultaat.changes > 0) return 'deleted';
  if (db.prepare('SELECT 1 FROM recipes WHERE recipe_id = ?').get(id) !== undefined) return 'active_session';
  return 'not_found';
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
