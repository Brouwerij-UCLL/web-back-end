import type { DatabaseSync } from 'node:sqlite';
import { NietGevonden, ValidatieFout } from './errors.ts';
import { inTransaction } from './transaction.ts';

export const FASEN = ['schrooten', 'vullen', 'opwarmen', 'maischen', 'spoelen', 'koken', 'overbrengen', 'vergisten'] as const;
export type Fase = (typeof FASEN)[number];

export interface ReceptstapInvoer {
  fase: Fase;
  naam: string;
  temperatuur_celsius: number | null;
  duur_minuten: number | null;
}

export interface ReceptInvoer {
  naam: string;
  stijl: string | null;
  beschrijving: string | null;
  stappen: ReceptstapInvoer[];
}

export interface Receptstap extends ReceptstapInvoer {
  id: number;
  volgorde: number;
}

export interface Recept {
  id: number;
  naam: string;
  stijl: string | null;
  beschrijving: string | null;
  aangemaakt_op: string;
  gewijzigd_op: string;
  stappen: Receptstap[];
}

export function createRecipe(db: DatabaseSync, invoer: ReceptInvoer): Recept {
  valideer(invoer);
  const id = inTransaction(db, () => {
    const { lastInsertRowid } = db
      .prepare('INSERT INTO recept (naam, stijl, beschrijving) VALUES (?, ?, ?)')
      .run(invoer.naam, invoer.stijl ?? null, invoer.beschrijving ?? null);
    const id = Number(lastInsertRowid);
    insertStappen(db, id, invoer.stappen);
    return id;
  });
  return getRecipe(db, id);
}

export function getRecipe(db: DatabaseSync, id: number): Recept {
  const recept = db
    .prepare('SELECT id, naam, stijl, beschrijving, aangemaakt_op, gewijzigd_op FROM recept WHERE id = ?')
    .get(id) as Omit<Recept, 'stappen'> | undefined;
  if (!recept) throw new NietGevonden(`recept ${id} bestaat niet`);

  const stappen = db
    .prepare('SELECT id, volgorde, fase, naam, temperatuur_celsius, duur_minuten FROM receptstap WHERE recept_id = ? ORDER BY volgorde')
    .all(id) as unknown as Receptstap[];
  return { ...recept, stappen: stappen.map((stap) => ({ ...stap })) };
}

export function listRecipes(db: DatabaseSync): Omit<Recept, 'stappen'>[] {
  const recepten = db
    .prepare('SELECT id, naam, stijl, beschrijving, aangemaakt_op, gewijzigd_op FROM recept ORDER BY naam')
    .all() as unknown as Omit<Recept, 'stappen'>[];
  return recepten.map((recept) => ({ ...recept }));
}

// Vervangt het recept en zijn stappen. Lopende en afgeronde brouwsessies merken
// hier niets van: zij werken met hun eigen kopie in sessiestap.
export function updateRecipe(db: DatabaseSync, id: number, invoer: ReceptInvoer): Recept {
  valideer(invoer);
  inTransaction(db, () => {
    const { changes } = db
      .prepare('UPDATE recept SET naam = ?, stijl = ?, beschrijving = ?, gewijzigd_op = CURRENT_TIMESTAMP WHERE id = ?')
      .run(invoer.naam, invoer.stijl ?? null, invoer.beschrijving ?? null, id);
    if (changes === 0) throw new NietGevonden(`recept ${id} bestaat niet`);
    db.prepare('DELETE FROM receptstap WHERE recept_id = ?').run(id);
    insertStappen(db, id, invoer.stappen);
  });
  return getRecipe(db, id);
}

// Brouwsessies van dit recept blijven bestaan: ON DELETE SET NULL maakt hun
// recept_id leeg, en hun naam, stijl en stappen zijn kopieën.
export function deleteRecipe(db: DatabaseSync, id: number): void {
  const { changes } = db.prepare('DELETE FROM recept WHERE id = ?').run(id);
  if (changes === 0) throw new NietGevonden(`recept ${id} bestaat niet`);
}

function insertStappen(db: DatabaseSync, receptId: number, stappen: ReceptstapInvoer[]): void {
  const insert = db.prepare(
    'INSERT INTO receptstap (recept_id, volgorde, fase, naam, temperatuur_celsius, duur_minuten) VALUES (?, ?, ?, ?, ?, ?)',
  );
  stappen.forEach((stap, i) => insert.run(receptId, i + 1, stap.fase, stap.naam, stap.temperatuur_celsius ?? null, stap.duur_minuten ?? null));
}

function valideer(invoer: ReceptInvoer): void {
  if (typeof invoer?.naam !== 'string' || !invoer.naam.trim()) throw new ValidatieFout('naam is verplicht');
  if (!Array.isArray(invoer.stappen)) throw new ValidatieFout('stappen moet een lijst zijn');
  invoer.stappen.forEach((stap, i) => {
    if (!FASEN.includes(stap?.fase)) throw new ValidatieFout(`stap ${i + 1}: fase moet een van ${FASEN.join(', ')} zijn`);
    if (typeof stap.naam !== 'string' || !stap.naam.trim()) throw new ValidatieFout(`stap ${i + 1}: naam is verplicht`);
    if (stap.temperatuur_celsius != null && typeof stap.temperatuur_celsius !== 'number') {
      throw new ValidatieFout(`stap ${i + 1}: temperatuur_celsius moet een getal zijn`);
    }
    if (stap.duur_minuten != null && !(Number.isInteger(stap.duur_minuten) && stap.duur_minuten >= 0)) {
      throw new ValidatieFout(`stap ${i + 1}: duur_minuten moet een positief geheel getal zijn`);
    }
  });
}
