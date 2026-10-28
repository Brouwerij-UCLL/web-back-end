import { db } from '../db.ts';

// Een volledig recept zoals de receptwizard het verstuurt (SCRUM-56). Ingrediënten, hop en extra's verwijzen naar de catalogi.
export type ReceptInvoer = {
  naam: string;
  bierstijl: string | null;
  beschrijving: string | null;
  water: { maischwater_liter: number; spoelwater_liter: number } | null;
  ingredienten: { ingredient_id: number; hoeveelheid_g: number }[];
  hop: { hop_id: number; hoeveelheid_gram: number; kooktijd_minuten: number }[];
  extra: {
    extra_ingredient_id: number;
    hoeveelheid: number;
    toevoegmoment: 'beslag' | 'koken';
    kooktijd_minuten: number | null;
  }[];
  maischschema: { stappen: { temperatuur_celsius: number; duur_minuten: number }[] };
  vergistingsschema: { stappen: { temperatuur_celsius: number; duur_dagen: number }[] };
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

function schrijfOnderdelen(receptId: number, recept: ReceptInvoer): void {
  for (const tabel of ['recipe_water', 'recipe_ingredients', 'hop_additions', 'recipe_extras', 'recipe_mash_steps', 'recipe_fermentation_steps']) {
    db.prepare(`DELETE FROM ${tabel} WHERE recipe_id = ?`).run(receptId);
  }

  if (recept.water) {
    db.prepare('INSERT INTO recipe_water (recipe_id, mash_water_l, sparge_water_l) VALUES (?, ?, ?)').run(
      receptId,
      recept.water.maischwater_liter,
      recept.water.spoelwater_liter,
    );
  }

  const ingredient = db.prepare('INSERT INTO recipe_ingredients (recipe_id, ingredient_id, amount_g) VALUES (?, ?, ?)');
  for (const regel of recept.ingredienten) ingredient.run(receptId, regel.ingredient_id, regel.hoeveelheid_g);

  const hop = db.prepare('INSERT INTO hop_additions (recipe_id, hop_id, amount, boil_time_min) VALUES (?, ?, ?, ?)');
  for (const gift of recept.hop) hop.run(receptId, gift.hop_id, gift.hoeveelheid_gram, gift.kooktijd_minuten);

  const extra = db.prepare(
    'INSERT INTO recipe_extras (recipe_id, extra_ingredient_id, amount, add_moment, boil_time) VALUES (?, ?, ?, ?, ?)',
  );
  for (const regel of recept.extra) {
    extra.run(receptId, regel.extra_ingredient_id, regel.hoeveelheid, regel.toevoegmoment, regel.kooktijd_minuten);
  }

  const maischstap = db.prepare('INSERT INTO recipe_mash_steps (recipe_id, step_nr, temperature, duration) VALUES (?, ?, ?, ?)');
  recept.maischschema.stappen.forEach((stap, i) => maischstap.run(receptId, i + 1, stap.temperatuur_celsius, stap.duur_minuten));

  const vergistingsstap = db.prepare(
    'INSERT INTO recipe_fermentation_steps (recipe_id, step_nr, temperature, duration) VALUES (?, ?, ?, ?)',
  );
  recept.vergistingsschema.stappen.forEach((stap, i) => vergistingsstap.run(receptId, i + 1, stap.temperatuur_celsius, stap.duur_dagen));
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
export function maakRecept(recept: ReceptInvoer): number {
  return inTransactie(() => {
    const resultaat = db
      .prepare('INSERT INTO recipes (name, beer_style, description) VALUES (?, ?, ?)')
      .run(recept.naam, recept.bierstijl, recept.beschrijving);
    const id = Number(resultaat.lastInsertRowid);
    schrijfOnderdelen(id, recept);
    return id;
  });
}

// Vervangt een bestaand recept volledig: basisgegevens en alle onderdelen.
export function vervangRecept(id: number, recept: ReceptInvoer): void {
  inTransactie(() => {
    db.prepare(
      "UPDATE recipes SET name = ?, beer_style = ?, description = ?, timestamp_edit = datetime('now') WHERE recipe_id = ?",
    ).run(recept.naam, recept.bierstijl, recept.beschrijving, id);
    schrijfOnderdelen(id, recept);
  });
}
