import { db } from '../db.ts';

// Een volledig recept zoals de receptwizard het verstuurt (SCRUM-56). Ingrediënten, hop en extra's verwijzen naar de catalogi.
export type RecipeInput = {
  name: string;
  beer_style: string | null;
  description: string | null;
  water: { mash_water_l: number; sparge_water_l: number } | null;
  ingredients: { ingredient_id: number; amount_g: number }[];
  hops: { hop_id: number; amount_g: number; boil_time_min: number }[];
  extras: {
    extra_ingredient_id: number;
    amount: number;
    add_moment: 'beslag' | 'koken';
    boil_time_min: number | null;
  }[];
  mash_schedule: { steps: { temperature_c: number; duration_min: number }[] };
  fermentation_schedule: { steps: { temperature_c: number; duration_days: number }[] };
};

// Ids uit de lijst die niet in de catalogustabel staan.
export function ontbrekendeIds(tabel: 'ingredients' | 'hops' | 'extra_ingredients', ids: number[]): number[] {
  const kolom = { ingredients: 'ingredient_id', hops: 'hop_id', extra_ingredients: 'extra_ingredient_id' }[tabel];
  const zoek = db.prepare(`SELECT 1 FROM ${tabel} WHERE ${kolom} = ?`);
  return [...new Set(ids)].filter((id) => zoek.get(id) === undefined);
}

export function receptBestaat(id: number): boolean {
  return db.prepare('SELECT 1 FROM recipes WHERE recipe_id = ?').get(id) !== undefined;
}

function schrijfOnderdelen(receptId: number, recept: RecipeInput): void {
  for (const tabel of ['recipe_water', 'recipe_ingredients', 'hop_additions', 'recipe_extras', 'recipe_mash_steps', 'recipe_fermentation_steps']) {
    db.prepare(`DELETE FROM ${tabel} WHERE recipe_id = ?`).run(receptId);
  }

  if (recept.water) {
    db.prepare('INSERT INTO recipe_water (recipe_id, mash_water_l, sparge_water_l) VALUES (?, ?, ?)').run(
      receptId,
      recept.water.mash_water_l,
      recept.water.sparge_water_l,
    );
  }

  const ingredient = db.prepare('INSERT INTO recipe_ingredients (recipe_id, ingredient_id, amount_g) VALUES (?, ?, ?)');
  for (const regel of recept.ingredients) ingredient.run(receptId, regel.ingredient_id, regel.amount_g);

  const hop = db.prepare('INSERT INTO hop_additions (recipe_id, hop_id, amount, boil_time_min) VALUES (?, ?, ?, ?)');
  for (const gift of recept.hops) hop.run(receptId, gift.hop_id, gift.amount_g, gift.boil_time_min);

  const extra = db.prepare(
    'INSERT INTO recipe_extras (recipe_id, extra_ingredient_id, amount, add_moment, boil_time) VALUES (?, ?, ?, ?, ?)',
  );
  for (const regel of recept.extras) {
    extra.run(receptId, regel.extra_ingredient_id, regel.amount, regel.add_moment, regel.boil_time_min);
  }

  const maischstap = db.prepare('INSERT INTO recipe_mash_steps (recipe_id, step_nr, temperature, duration) VALUES (?, ?, ?, ?)');
  recept.mash_schedule.steps.forEach((stap, i) => maischstap.run(receptId, i + 1, stap.temperature_c, stap.duration_min));

  const vergistingsstap = db.prepare(
    'INSERT INTO recipe_fermentation_steps (recipe_id, step_nr, temperature, duration) VALUES (?, ?, ?, ?)',
  );
  recept.fermentation_schedule.steps.forEach((stap, i) => vergistingsstap.run(receptId, i + 1, stap.temperature_c, stap.duration_days));
}

// Voert alles uit in één transactie: lukt een stap niet, dan blijft er niets achter.
function inTransactie<T>(werk: () => T): T {
  db.exec('BEGIN');
  try {
    const resultaat = werk();
    db.exec('COMMIT');
    return resultaat;
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

// Slaat een nieuw recept met al zijn onderdelen op en geeft het nieuwe id terug.
export function maakRecept(recept: RecipeInput): number {
  return inTransactie(() => {
    const resultaat = db
      .prepare('INSERT INTO recipes (name, beer_style, description) VALUES (?, ?, ?)')
      .run(recept.name, recept.beer_style, recept.description);
    const id = Number(resultaat.lastInsertRowid);
    schrijfOnderdelen(id, recept);
    return id;
  });
}

// Verwijdert een recept. Wat alleen bij dit recept hoort (water, ingrediëntregels, hopgiften, extra's,
// maisch- en vergistingsstappen) verdwijnt mee via ON DELETE CASCADE; de catalogi blijven ongewijzigd.
export function verwijderRecept(id: number): void {
  db.prepare('DELETE FROM recipes WHERE recipe_id = ?').run(id);
}

// Vervangt een bestaand recept volledig: basisgegevens en alle onderdelen.
export function vervangRecept(id: number, recept: RecipeInput): void {
  inTransactie(() => {
    db.prepare(
      "UPDATE recipes SET name = ?, beer_style = ?, description = ?, timestamp_edit = datetime('now') WHERE recipe_id = ?",
    ).run(recept.name, recept.beer_style, recept.description, id);
    schrijfOnderdelen(id, recept);
  });
}
