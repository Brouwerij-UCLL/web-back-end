import { db } from '../db.ts';

export type ReceptOverzicht = {
  id: number;
  naam: string;
  beschrijving: string | null;
};

// Alle recepten voor de lijstweergave, alfabetisch op naam.
export function getRecepten(): ReceptOverzicht[] {
  return db.prepare('SELECT id, naam, beschrijving FROM recepten ORDER BY id').all() as ReceptOverzicht[];
}

// Specifiek recept op basis van id. Geeft undefined als het recept niet bestaat.
export function getReceptById(id: number): ReceptOverzicht | undefined {
  return db.prepare('SELECT * FROM recepten WHERE id = ?').get(id) as ReceptOverzicht | undefined;
}
