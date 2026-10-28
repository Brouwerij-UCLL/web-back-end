import { db } from '../db.ts';

// Vergistingsschema van een recept: de stappen in recipe_fermentation_steps.
// In de API heten de kolommen temperature_c en duration_days, zoals in GET /api/recipes/{id}.

export type FermentationStepInput = {
  temperature_c: number;
  duration_days: number;
};

export type FermentationScheduleInput = {
  steps: FermentationStepInput[];
};

export type FermentationStep = FermentationStepInput & {
  step_nr: number;
};

export type FermentationSchedule = {
  recipe_id: number;
  steps: FermentationStep[];
};

// Vergistingsstappen in volgorde. undefined als het recept niet bestaat.
export function getFermentationSchedule(recipeId: number): FermentationSchedule | undefined {
  if (!recipeExists(recipeId)) return undefined;

  const steps = db
    .prepare(
      `SELECT step_nr, temperature AS temperature_c, duration AS duration_days
       FROM recipe_fermentation_steps WHERE recipe_id = ? ORDER BY step_nr`,
    )
    .all(recipeId)
    .map((row) => ({ ...row }) as FermentationStep); // node:sqlite geeft objecten zonder prototype; maak er gewone objecten van

  return { recipe_id: recipeId, steps };
}

// Vervangt alle vergistingsstappen in één transactie. De stappen krijgen step_nr
// 1, 2, 3, ... in de volgorde van de lijst. Lukt er iets niet, dan wordt alles
// teruggedraaid en blijft het vorige schema staan.
// undefined als het recept niet bestaat.
export function replaceFermentationSchedule(
  recipeId: number,
  schedule: FermentationScheduleInput,
): FermentationSchedule | undefined {
  db.exec('BEGIN');
  try {
    if (!recipeExists(recipeId)) {
      db.exec('ROLLBACK');
      return undefined;
    }

    db.prepare('DELETE FROM recipe_fermentation_steps WHERE recipe_id = ?').run(recipeId);
    const insertStep = db.prepare(
      'INSERT INTO recipe_fermentation_steps (recipe_id, step_nr, temperature, duration) VALUES (?, ?, ?, ?)',
    );
    schedule.steps.forEach((step, i) => insertStep.run(recipeId, i + 1, step.temperature_c, step.duration_days));

    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
  return getFermentationSchedule(recipeId);
}

function recipeExists(recipeId: number): boolean {
  return db.prepare('SELECT 1 FROM recipes WHERE recipe_id = ?').get(recipeId) !== undefined;
}
