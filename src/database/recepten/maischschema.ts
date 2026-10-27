import { db } from '../db.ts';

// Maischschema van een recept: de maischstappen (recipe_mash_steps) en de
// kooktijd (recipes.boil_time_min, migratie 006). De API gebruikt Nederlandse veldnamen.

export type MaischstapInvoer = {
  temperatuur_celsius: number;
  duur_minuten: number;
};

export type MaischschemaInvoer = {
  kooktijd_minuten: number;
  stappen: MaischstapInvoer[];
};

export type Maischstap = MaischstapInvoer & {
  stap_volgorde: number;
};

export type Maischschema = {
  recept_id: number;
  kooktijd_minuten: number | null; // null: nog geen kooktijd ingesteld
  stappen: Maischstap[];
};

// Stappen in volgorde. undefined als het recept niet bestaat.
export function getMaischschema(receptId: number): Maischschema | undefined {
  const recept = db.prepare('SELECT boil_time_min AS kooktijd_minuten FROM recipes WHERE recipe_id = ?').get(receptId) as
    | { kooktijd_minuten: number | null }
    | undefined;
  if (!recept) return undefined;

  const stappen = db
    .prepare(`
      SELECT
        step_nr AS stap_volgorde,
        temperature AS temperatuur_celsius,
        duration AS duur_minuten
      FROM recipe_mash_steps
      WHERE recipe_id = ?
      ORDER BY step_nr`)
    .all(receptId)
    .map((rij) => ({ ...rij }) as Maischstap); // node:sqlite geeft objecten zonder prototype; maak er gewone objecten van

  return { recept_id: receptId, kooktijd_minuten: recept.kooktijd_minuten, stappen };
}

// Vervangt alle maischstappen en de kooktijd in één transactie. De stappen
// krijgen step_nr 1, 2, 3, ... in de volgorde van de lijst. Lukt er iets niet,
// dan wordt alles teruggedraaid en blijft het vorige schema staan.
// undefined als het recept niet bestaat.
export function vervangMaischschema(receptId: number, schema: MaischschemaInvoer): Maischschema | undefined {
  db.exec('BEGIN');
  try {
    const { changes } = db.prepare('UPDATE recipes SET boil_time_min = ? WHERE recipe_id = ?').run(schema.kooktijd_minuten, receptId);
    if (changes === 0) {
      db.exec('ROLLBACK');
      return undefined;
    }

    db.prepare('DELETE FROM recipe_mash_steps WHERE recipe_id = ?').run(receptId);
    const insertStap = db.prepare('INSERT INTO recipe_mash_steps (recipe_id, step_nr, temperature, duration) VALUES (?, ?, ?, ?)');
    schema.stappen.forEach((stap, i) => insertStap.run(receptId, i + 1, stap.temperatuur_celsius, stap.duur_minuten));

    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
  return getMaischschema(receptId);
}
