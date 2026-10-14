import { db } from '../db.ts';

export type ReceptOverzicht = {
  id: number;
  naam: string;
  bierstijl: string | null;
  beschrijving: string | null;
};

// SQLite geeft datums terug als tekst, bv. "2026-10-14 12:38:49".
export type Recept = ReceptOverzicht & {
  basis_volume_liter: number;
  aangemaakt_op: string;
  gewijzigd_op: string;
};

export type Ingredient = {
  ingredient_id: number;
  naam: string;
  fabrikant: string | null;
  hoeveelheid_kg: number;
};

export type ReceptWithIngredients = Recept & {
  ingredienten: Ingredient[];
};

// Alle recepten voor de lijstweergave, alfabetisch op naam.
export function getRecepten(): ReceptOverzicht[] {
  return db.prepare('SELECT id, naam, beschrijving, bierstijl FROM recepten ORDER BY naam').all() as ReceptOverzicht[];
}

export function getRecept(id: number): Recept | undefined {
  return db.prepare('SELECT * FROM recepten WHERE id = ?').get(id) as Recept | undefined;
}

// Geeft een lege lijst als het recept geen ingrediënten heeft of niet bestaat.
export function getReceptIngredients(id: number): Ingredient[] {
  return db
    .prepare('SELECT id AS ingredient_id, naam, fabrikant, hoeveelheid_kg FROM recept_ingredienten WHERE recept_id = ?')
    .all(id) as Ingredient[];
}

export function getReceptWithIngredients(id: number): ReceptWithIngredients | undefined {
  const rij = db.prepare(`
    SELECT
      recepten.*,
      COALESCE(
        json_group_array(json_object(
          'ingredient_id', recept_ingredienten.id,
          'naam', recept_ingredienten.naam,
          'fabrikant', recept_ingredienten.fabrikant,
          'hoeveelheid_kg', recept_ingredienten.hoeveelheid_kg
        )) FILTER (WHERE recept_ingredienten.id IS NOT NULL),
        '[]'
      ) AS ingredienten
    FROM recepten
    LEFT JOIN recept_ingredienten ON recept_ingredienten.recept_id = recepten.id
    WHERE recepten.id = ?
    GROUP BY recepten.id
  `).get(id) as (Recept & { ingredienten: string }) | undefined;

  if (!rij) return undefined;
  return { ...rij, ingredienten: JSON.parse(rij.ingredienten) as Ingredient[] };
}