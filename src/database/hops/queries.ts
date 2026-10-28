import { db } from '../db.ts';

// Catalogus van hops (tabel hops), gedeeld door alle recepten.

export type Hop = {
  id: number;
  name: string;
  alpha_acid_percentage: number | null;
  type: number; // 0 = bloemen, 1 = pellet
  origin: string | null;
};

export type HopInput = Omit<Hop, 'id'>;

const kolommen = `hop_id AS id, name, alpha_acid_percentage, type, origin`;

// Alle hops alfabetisch op naam; met search alleen die waarvan de naam de zoekterm bevat (hoofdletters niet meegerekend).
export function getHops(search?: string): Hop[] {
  if (search) {
    return db
      .prepare(`SELECT ${kolommen} FROM hops WHERE lower(name) LIKE '%' || lower(?) || '%' ORDER BY name COLLATE NOCASE`)
      .all(search) as Hop[];
  }
  return db.prepare(`SELECT ${kolommen} FROM hops ORDER BY name COLLATE NOCASE`).all() as Hop[];
}

export function getHop(id: number): Hop | undefined {
  return db.prepare(`SELECT ${kolommen} FROM hops WHERE hop_id = ?`).get(id) as Hop | undefined;
}

// Bestaat er al een hop met dezelfde naam, type en herkomst (eventueel buiten de hop met id uitgezonderd)?
export function hopExists(input: HopInput, uitgezonderdId?: number): boolean {
  const rij = db
    .prepare(`
      SELECT 1 FROM hops
      WHERE lower(name) = lower(?) AND type = ? AND lower(coalesce(origin, '')) = lower(coalesce(?, ''))
        AND hop_id != ?`)
    .get(input.name, input.type, input.origin, uitgezonderdId ?? -1);
  return rij !== undefined;
}

export function createHop(input: HopInput): Hop {
  const resultaat = db
    .prepare('INSERT INTO hops (name, alpha_acid_percentage, type, origin) VALUES (?, ?, ?, ?)')
    .run(input.name, input.alpha_acid_percentage, input.type, input.origin);
  return getHop(Number(resultaat.lastInsertRowid))!;
}

export function updateHop(id: number, input: HopInput): Hop | undefined {
  db.prepare('UPDATE hops SET name = ?, alpha_acid_percentage = ?, type = ?, origin = ? WHERE hop_id = ?').run(
    input.name,
    input.alpha_acid_percentage,
    input.type,
    input.origin,
    id,
  );
  return getHop(id);
}

// Aantal recepten dat de hop gebruikt.
export function countRecipesUsingHop(id: number): number {
  const rij = db
    .prepare('SELECT count(DISTINCT recipe_id) AS aantal FROM hop_additions WHERE hop_id = ?')
    .get(id) as { aantal: number };
  return rij.aantal;
}

export function deleteHop(id: number): void {
  db.prepare('DELETE FROM hops WHERE hop_id = ?').run(id);
}
