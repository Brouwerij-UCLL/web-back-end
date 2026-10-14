import { db } from '../db.ts';

export type ReceptOverzicht = {
  id: number;
  naam: string;
  beschrijving: string | null;
};

// Alle recepten voor de lijstweergave, alfabetisch op naam.
export function getRecepten(): ReceptOverzicht[] {
  return db.prepare('SELECT id, naam, beschrijving FROM recepten ORDER BY naam').all() as ReceptOverzicht[];
}
