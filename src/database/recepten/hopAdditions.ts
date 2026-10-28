import { db } from '../db.ts';
import type { HopAddition } from './queries.ts';

// Hopgiften van een recept (hop_additions). Elke gift heeft een eigen id, zodat dezelfde hop
// meerdere keren in een recept kan staan, bv. Saaz op 60 en op 10 minuten.

export type HopAdditionInput = {
  hop_id: number;
  amount_g: number;
  boil_time_min: number;
};

const selectHopAdditions = `
  SELECT hop_additions.hop_addition_id AS id, hops.hop_id, hops.name, hops.alpha_acid_percentage, hops.type, hops.origin,
         hop_additions.amount AS amount_g, hop_additions.boil_time_min
  FROM hop_additions
  JOIN hops ON hops.hop_id = hop_additions.hop_id
  WHERE hop_additions.recipe_id = ?`;

// Van langste naar kortste kooktijd, dus in de volgorde waarin ze in de ketel gaan.
export function getHopAdditions(recipeId: number): HopAddition[] {
  return db
    .prepare(`${selectHopAdditions} ORDER BY hop_additions.boil_time_min DESC, hop_additions.hop_addition_id`)
    .all(recipeId)
    .map((row) => ({ ...row }) as HopAddition); // node:sqlite geeft objecten zonder prototype; maak er gewone objecten van
}

// Eén hopgift van een recept; undefined als ze niet bestaat of bij een ander recept hoort.
export function getHopAddition(recipeId: number, hopAdditionId: number): HopAddition | undefined {
  const row = db.prepare(`${selectHopAdditions} AND hop_additions.hop_addition_id = ?`).get(recipeId, hopAdditionId);
  return row ? ({ ...row } as HopAddition) : undefined;
}

export function addHopAddition(recipeId: number, gift: HopAdditionInput): HopAddition {
  const resultaat = db
    .prepare('INSERT INTO hop_additions (recipe_id, hop_id, amount, boil_time_min) VALUES (?, ?, ?, ?)')
    .run(recipeId, gift.hop_id, gift.amount_g, gift.boil_time_min);
  return getHopAddition(recipeId, Number(resultaat.lastInsertRowid))!;
}

export function updateHopAddition(recipeId: number, hopAdditionId: number, gift: HopAdditionInput): HopAddition {
  db.prepare('UPDATE hop_additions SET hop_id = ?, amount = ?, boil_time_min = ? WHERE recipe_id = ? AND hop_addition_id = ?').run(
    gift.hop_id,
    gift.amount_g,
    gift.boil_time_min,
    recipeId,
    hopAdditionId,
  );
  return getHopAddition(recipeId, hopAdditionId)!;
}

export function deleteHopAddition(recipeId: number, hopAdditionId: number): void {
  db.prepare('DELETE FROM hop_additions WHERE recipe_id = ? AND hop_addition_id = ?').run(recipeId, hopAdditionId);
}
