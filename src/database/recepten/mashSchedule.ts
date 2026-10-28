import { db } from '../db.ts';

// Maischschema van een recept: de maischstappen in recipe_mash_steps.
// De veldnamen volgen het datamodel (recipe_id, step_nr, temperature, duration).

export type MashStepInput = {
  temperature: number; // °C
  duration: number; // minuten
};

export type MashScheduleInput = {
  steps: MashStepInput[];
};

export type MashStep = MashStepInput & {
  step_nr: number;
};

export type MashSchedule = {
  recipe_id: number;
  steps: MashStep[];
};

// Maischstappen in volgorde. undefined als het recept niet bestaat.
export function getMashSchedule(recipeId: number): MashSchedule | undefined {
  if (!recipeExists(recipeId)) return undefined;

  const steps = db
    .prepare('SELECT step_nr, temperature, duration FROM recipe_mash_steps WHERE recipe_id = ? ORDER BY step_nr')
    .all(recipeId)
    .map((row) => ({ ...row }) as MashStep); // node:sqlite geeft objecten zonder prototype; maak er gewone objecten van

  return { recipe_id: recipeId, steps };
}

// Vervangt alle maischstappen in één transactie. De stappen krijgen step_nr
// 1, 2, 3, ... in de volgorde van de lijst. Lukt er iets niet, dan wordt alles
// teruggedraaid en blijft het vorige schema staan.
// undefined als het recept niet bestaat.
export function replaceMashSchedule(recipeId: number, schedule: MashScheduleInput): MashSchedule | undefined {
  db.exec('BEGIN');
  try {
    if (!recipeExists(recipeId)) {
      db.exec('ROLLBACK');
      return undefined;
    }

    db.prepare('DELETE FROM recipe_mash_steps WHERE recipe_id = ?').run(recipeId);
    const insertStep = db.prepare('INSERT INTO recipe_mash_steps (recipe_id, step_nr, temperature, duration) VALUES (?, ?, ?, ?)');
    schedule.steps.forEach((step, i) => insertStep.run(recipeId, i + 1, step.temperature, step.duration));

    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
  return getMashSchedule(recipeId);
}

function recipeExists(recipeId: number): boolean {
  return db.prepare('SELECT 1 FROM recipes WHERE recipe_id = ?').get(recipeId) !== undefined;
}
