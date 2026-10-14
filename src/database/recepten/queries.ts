import { db } from '../db.ts';

export type ReceptOverzicht = {
  id: number;
  naam: string;
  bierstijl: string;
  beschrijving: string | null;
};

export type Recept = ReceptOverzicht & {
  bierstijl: string;
  basis_volume_liter: number;
  aangemaakt_op: Date;
  gewijzigd_op: Date;
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

export function getRecept(id: number): ReceptOverzicht | undefined {
  return db.prepare('SELECT * FROM recepten WHERE id = ?').get(id) as Recept | undefined;
}

export function getReceptIngredients(id: number): Ingredient[] | undefined {
  return db.prepare('SELECT * FROM recept_ingredienten WHERE recept_id = ?').all(id) as Ingredient[] | undefined;
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