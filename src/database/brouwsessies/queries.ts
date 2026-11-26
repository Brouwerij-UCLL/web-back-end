import { db } from '../db.ts';
import type { Recipe } from '../recepten/queries.ts';

type NieuweBrouwsessie = {
  recept_id: number;
  doel_volume_liter: number;
  schaalfactor: number;
  recept_snapshot: Recipe;
  geschaalde_hoeveelheden: Pick<Recipe, 'water' | 'ingredients' | 'hops' | 'extras'>;
};

export function slaBrouwsessieOp(sessie: NieuweBrouwsessie) {
  const opgeslagen = db.prepare(`
    INSERT INTO brouwsessies (
      recept_id, recept_naam, doel_volume_liter, schaalfactor, recept_snapshot, geschaalde_hoeveelheden
    )
    VALUES (?, ?, ?, ?, ?, ?)
    RETURNING id, start_tijd AS created_at
  `).get(
    sessie.recept_id,
    sessie.recept_snapshot.name,
    sessie.doel_volume_liter,
    sessie.schaalfactor,
    JSON.stringify(sessie.recept_snapshot),
    JSON.stringify(sessie.geschaalde_hoeveelheden),
  ) as { id: number; created_at: string };

  return { ...opgeslagen, ...sessie };
}