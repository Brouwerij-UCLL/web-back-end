import { db } from '../db.ts';

// Maischschema van een recept, opgeslagen in recipe_mash_steps. De kooktijd is
// de laatste rij: temperature = 100 °C en duration = kooktijd in minuten.
// Maischstappen zijn hoogstens 80 °C, dus de kookstap is altijd te herkennen.
// De veldnamen volgen het datamodel (recipe_id, step_nr, temperature, duration).


export type MashStepInput = {
  temperature: number; // °C
  duration: number; // minuten
};

export type MashScheduleInput = {
  boil_time: number; // minuten
  steps: MashStepInput[];
};

export type MashStep = MashStepInput & {
  step_nr: number;
};

export type MashSchedule = {
  recipe_id: number;
  boil_time: number | null; // null: nog geen kookstap ingesteld
  steps: MashStep[];
};

// Maischstappen in volgorde en de kooktijd. undefined als het recept niet bestaat.
export function getMashSchedule(recipeId: number): MashSchedule | undefined {
  if (!recipeExists(recipeId)) return undefined;

  const rows = db
    .prepare('SELECT step_nr, temperature, duration FROM recipe_mash_steps WHERE recipe_id = ? ORDER BY step_nr')
    .all(recipeId)
    .map((row) => ({ ...row }) as MashStep); // node:sqlite geeft objecten zonder prototype; maak er gewone objecten van

  const boilStep = rows.findLast((row) => row.temperature);
  return {
    recipe_id: recipeId,
    boil_time: boilStep?.duration ?? null,
    steps: rows.filter((row) => row.temperature ),
  };
}

// Vervangt alle maischstappen en de kookstap in één transactie. De maischstappen
// krijgen step_nr 1, 2, 3, ... in de volgorde van de lijst, de kookstap komt erna.
// Lukt er iets niet, dan wordt alles teruggedraaid en blijft het vorige schema staan.
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
    insertStep.run(recipeId, schedule.steps.length + 1, schedule.boil_time);

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
