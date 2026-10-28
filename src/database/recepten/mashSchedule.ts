import { db } from '../db.ts';

// Maischschema van een recept, opgeslagen in recipe_mash_steps. De kooktijd is
// de laatste rij: temperature = 100 °C en duration = kooktijd in minuten.
// Maischstappen zijn hoogstens 80 °C, dus de kookstap is altijd te herkennen.
// De API gebruikt Nederlandse veldnamen.

export const KOOKTEMPERATUUR_CELSIUS = 100;

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
  kooktijd_minuten: number | null; // null: nog geen kookstap ingesteld
  stappen: Maischstap[];
};

// Maischstappen in volgorde en de kooktijd. undefined als het recept niet bestaat.
export function getMaischschema(receptId: number): Maischschema | undefined {
  if (!receptBestaat(receptId)) return undefined;

  const rijen = db
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

  const kookstap = rijen.findLast((rij) => rij.temperatuur_celsius === KOOKTEMPERATUUR_CELSIUS);
  return {
    recept_id: receptId,
    kooktijd_minuten: kookstap?.duur_minuten ?? null,
    stappen: rijen.filter((rij) => rij.temperatuur_celsius !== KOOKTEMPERATUUR_CELSIUS),
  };
}

// Vervangt alle maischstappen en de kookstap in één transactie. De maischstappen
// krijgen step_nr 1, 2, 3, ... in de volgorde van de lijst, de kookstap komt erna.
// Lukt er iets niet, dan wordt alles teruggedraaid en blijft het vorige schema staan.
// undefined als het recept niet bestaat.
export function vervangMaischschema(receptId: number, schema: MaischschemaInvoer): Maischschema | undefined {
  db.exec('BEGIN');
  try {
    if (!receptBestaat(receptId)) {
      db.exec('ROLLBACK');
      return undefined;
    }

    db.prepare('DELETE FROM recipe_mash_steps WHERE recipe_id = ?').run(receptId);
    const insertStap = db.prepare('INSERT INTO recipe_mash_steps (recipe_id, step_nr, temperature, duration) VALUES (?, ?, ?, ?)');
    schema.stappen.forEach((stap, i) => insertStap.run(receptId, i + 1, stap.temperatuur_celsius, stap.duur_minuten));
    insertStap.run(receptId, schema.stappen.length + 1, KOOKTEMPERATUUR_CELSIUS, schema.kooktijd_minuten);

    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
  return getMaischschema(receptId);
}

function receptBestaat(receptId: number): boolean {
  return db.prepare('SELECT 1 FROM recipes WHERE recipe_id = ?').get(receptId) !== undefined;
}
