import { db } from '../db.ts';
import type { HopAddition } from './queries.ts';

// Hopgiften van een recept (hop_additions), met hun gegevens uit de catalogus hops. Elke gift heeft
// een eigen id, zodat dezelfde hop meerdere keren in een recept kan staan, bv. Saaz op 60 en op 10 minuten.

// Van langste naar kortste kooktijd, dus in de volgorde waarin ze in de ketel gaan.
export function getHopAdditions(recipeId: number): HopAddition[] {
  return db
    .prepare(`
      SELECT hop_additions.hop_addition_id AS id, hops.hop_id, hops.name, hops.alpha_acid_percentage, hops.type, hops.origin,
             hop_additions.amount AS amount_g, hop_additions.boil_time_min
      FROM hop_additions
      JOIN hops ON hops.hop_id = hop_additions.hop_id
      WHERE hop_additions.recipe_id = ?
      ORDER BY hop_additions.boil_time_min DESC, hop_additions.hop_addition_id`)
    .all(recipeId)
    .map((row) => ({ ...row }) as HopAddition); // node:sqlite geeft objecten zonder prototype; maak er gewone objecten van
}
