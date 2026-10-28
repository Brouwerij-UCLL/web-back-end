import { db } from '../db.ts';

// Catalogus van extra ingrediënten (tabel extra_ingredients): kruiden, fruit, suikers, klaarmiddelen, …

export type Extra = {
  id: number;
  name: string;
  description: string | null;
  unit: string;
};

export type ExtraInput = Omit<Extra, 'id'>;

const kolommen = `extra_ingredient_id AS id, name, description, unit`;

// Alle extra ingrediënten alfabetisch op naam; met search alleen die waarvan de naam de zoekterm bevat (hoofdletters niet meegerekend).
export function getExtras(search?: string): Extra[] {
  if (search) {
    return db
      .prepare(`SELECT ${kolommen} FROM extra_ingredients WHERE lower(name) LIKE '%' || lower(?) || '%' ORDER BY name COLLATE NOCASE`)
      .all(search) as Extra[];
  }
  return db.prepare(`SELECT ${kolommen} FROM extra_ingredients ORDER BY name COLLATE NOCASE`).all() as Extra[];
}

export function getExtra(id: number): Extra | undefined {
  return db.prepare(`SELECT ${kolommen} FROM extra_ingredients WHERE extra_ingredient_id = ?`).get(id) as Extra | undefined;
}

// Bestaat er al een extra ingrediënt met dezelfde naam (eventueel buiten het extra ingrediënt met id uitgezonderd)?
export function extraExists(input: ExtraInput, uitgezonderdId?: number): boolean {
  const rij = db
    .prepare('SELECT 1 FROM extra_ingredients WHERE lower(name) = lower(?) AND extra_ingredient_id != ?')
    .get(input.name, uitgezonderdId ?? -1);
  return rij !== undefined;
}

export function createExtra(input: ExtraInput): Extra {
  const resultaat = db
    .prepare('INSERT INTO extra_ingredients (name, description, unit) VALUES (?, ?, ?)')
    .run(input.name, input.description, input.unit);
  return getExtra(Number(resultaat.lastInsertRowid))!;
}

export function updateExtra(id: number, input: ExtraInput): Extra | undefined {
  db.prepare('UPDATE extra_ingredients SET name = ?, description = ?, unit = ? WHERE extra_ingredient_id = ?').run(
    input.name,
    input.description,
    input.unit,
    id,
  );
  return getExtra(id);
}

// Aantal recepten dat het extra ingrediënt gebruikt.
export function countRecipesUsingExtra(id: number): number {
  const rij = db
    .prepare('SELECT count(DISTINCT recipe_id) AS aantal FROM recipe_extras WHERE extra_ingredient_id = ?')
    .get(id) as { aantal: number };
  return rij.aantal;
}

export function deleteExtra(id: number): void {
  db.prepare('DELETE FROM extra_ingredients WHERE extra_ingredient_id = ?').run(id);
}
