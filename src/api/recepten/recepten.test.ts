import assert from 'node:assert/strict';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { after, before, test } from 'node:test';

process.env.DATABASE_FILE = ':memory:';
const { app } = await import('../../app.ts');
const { db } = await import('../../database/db.ts');

let server: Server;
let baseUrl: string;

before(async () => {
  db.exec('DELETE FROM recipes');
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://localhost:${(server.address() as AddressInfo).port}/api/recipes`;
});

after(() => {
  server.close();
});

async function vraag(methode: string, pad: string, body?: unknown) {
  const antwoord = await fetch(baseUrl + pad, {
    method: methode,
    headers: body === undefined ? {} : { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const tekst = await antwoord.text();
  return { status: antwoord.status, body: tekst ? JSON.parse(tekst) : undefined };
}

function maakRecept(name: string, beerStyle: string, basisVolume = 20): number {
  const resultaat = db.prepare(`
    INSERT INTO recipes (name, beer_style, description, basis_volume_liter)
    VALUES (?, ?, 'Testrecept', ?)
  `).run(name, beerStyle, basisVolume);
  return Number(resultaat.lastInsertRowid);
}

test('AC0-1: de lege lijst is 200; recepten bevatten de gevraagde velden', async () => {
  const leeg = await vraag('GET', '');
  assert.equal(leeg.status, 200);
  assert.deepEqual(leeg.body, []);

  maakRecept('Gouden Tripel', 'Belgische Tripel');
  const antwoord = await vraag('GET', '');
  assert.equal(antwoord.status, 200);
  assert.deepEqual(Object.keys(antwoord.body[0]).sort(), [
    'basis_volume_liter', 'beer_style', 'created_at', 'description', 'id', 'name', 'updated_at',
  ]);
  assert.equal(antwoord.body[0].basis_volume_liter, 20);
});

test('AC2: filteren en sorteren werkt; ongeldige waarden geven 400', async () => {
  maakRecept('Amber Ale', 'Amerikaanse Amber');
  maakRecept('Tripel Zilver', 'Belgische Tripel');

  const gefilterd = await vraag('GET', '?search=tripel&beer_style=Belgische%20Tripel');
  assert.deepEqual(gefilterd.body.map((recipe: { name: string }) => recipe.name), ['Gouden Tripel', 'Tripel Zilver']);

  const descending = await vraag('GET', '?sort=name&direction=desc');
  const names = descending.body.map((recipe: { name: string }) => recipe.name);
  assert.deepEqual(names, [...names].sort((a: string, b: string) => b.localeCompare(a)));
  assert.equal((await vraag('GET', '?sort=unknown')).status, 400);
  assert.equal((await vraag('GET', '?direction=sideways')).status, 400);
});

test('AC3-4, AC8: wijzigen valideert alle velden en past de wijzigingstijd aan', async () => {
  const id = maakRecept('Te wijzigen', 'Oud', 15);
  const sessieId = Number(db.prepare(`
    INSERT INTO brouwsessies (recept_id, recept_naam, doel_volume_liter, schaalfactor, status)
    VALUES (?, 'Recept snapshot', 15, 1, 'voltooid')
  `).run(id).lastInsertRowid);
  db.prepare(`
    INSERT INTO brouwsessie_stappen (sessie_id, stap_type, stap_volgorde, naam, status)
    VALUES (?, 'maischen', 1, 'Snapshot maischen', 'voltooid')
  `).run(sessieId);
  const original = await vraag('GET', `/${id}`);
  const body = {
    name: 'Gewijzigd recept',
    beer_style: 'Nieuwe stijl',
    description: 'Nieuwe beschrijving',
    basis_volume_liter: 25,
  };
  const updated = await vraag('PUT', `/${id}`, body);
  assert.equal(updated.status, 200);
  assert.deepEqual(
    { name: updated.body.name, beer_style: updated.body.beer_style, description: updated.body.description, basis_volume_liter: updated.body.basis_volume_liter },
    body,
  );
  assert.notEqual(updated.body.updated_at, original.body.updated_at);

  for (const { input, field } of [
    { input: { ...body, name: '' }, field: 'name' },
    { input: { ...body, basis_volume_liter: 0 }, field: 'basis_volume_liter' },
    { input: { ...body, beer_style: undefined }, field: 'beer_style' },
  ]) {
    const response = await vraag('PUT', `/${id}`, input);
    assert.equal(response.status, 400);
    assert.match(response.body.fout, new RegExp(field));
  }
  assert.equal((await vraag('GET', `/${id}`)).body.name, body.name);
  const session = db.prepare('SELECT recept_id, recept_naam FROM brouwsessies WHERE id = ?').get(sessieId) as { recept_id: number; recept_naam: string };
  assert.equal(session.recept_id, id);
  assert.equal(session.recept_naam, 'Recept snapshot');
  assert.equal((db.prepare('SELECT naam FROM brouwsessie_stappen WHERE sessie_id = ?').get(sessieId) as { naam: string }).naam, 'Snapshot maischen');
  assert.equal((await vraag('PUT', '/99999', body)).status, 404);
});

test('AC5-7: verwijderen wist receptonderdelen, bewaart sessiehistoriek en blokkeert lopende sessies', async () => {
  const id = maakRecept('Te verwijderen', 'Stout');
  db.prepare('INSERT INTO recipe_water (recipe_id, mash_water_l, sparge_water_l) VALUES (?, 12, 8)').run(id);
  db.prepare('INSERT INTO recipe_mash_steps (recipe_id, step_nr, temperature, duration) VALUES (?, 1, 66, 60)').run(id);
  const ingrediëntId = Number(db.prepare("INSERT INTO ingredients (name) VALUES ('Testmout')").run().lastInsertRowid);
  db.prepare('INSERT INTO recipe_ingredients (recipe_id, ingredient_id, amount_g) VALUES (?, ?, 1000)').run(id, ingrediëntId);
  const sessieId = Number(db.prepare(`
    INSERT INTO brouwsessies (recept_id, recept_naam, doel_volume_liter, schaalfactor, status)
    VALUES (?, 'Recept snapshot', 20, 1, 'voltooid')
  `).run(id).lastInsertRowid);
  db.prepare(`
    INSERT INTO brouwsessie_stappen (sessie_id, stap_type, stap_volgorde, naam, status)
    VALUES (?, 'maischen', 1, 'Maischen', 'voltooid')
  `).run(sessieId);

  const lopendId = maakRecept('Lopende batch', 'Pils');
  db.prepare(`
    INSERT INTO brouwsessies (recept_id, recept_naam, doel_volume_liter, schaalfactor, status)
    VALUES (?, 'Lopende batch', 20, 1, 'bezig')
  `).run(lopendId);
  assert.equal((await vraag('DELETE', `/${lopendId}`)).status, 409);
  assert.equal((await vraag('GET', `/${lopendId}`)).status, 200);

  const deleted = await vraag('DELETE', `/${id}`);
  assert.equal(deleted.status, 204);
  assert.equal(deleted.body, undefined);
  assert.equal((await vraag('GET', '')).body.some((recipe: { id: number }) => recipe.id === id), false);
  assert.equal((db.prepare('SELECT count(*) AS aantal FROM recipe_water WHERE recipe_id = ?').get(id) as { aantal: number }).aantal, 0);
  assert.equal((db.prepare('SELECT count(*) AS aantal FROM recipe_ingredients WHERE recipe_id = ?').get(id) as { aantal: number }).aantal, 0);
  assert.equal((db.prepare('SELECT count(*) AS aantal FROM recipe_mash_steps WHERE recipe_id = ?').get(id) as { aantal: number }).aantal, 0);
  const sessie = db.prepare('SELECT recept_id, recept_naam FROM brouwsessies WHERE id = ?').get(sessieId) as { recept_id: number | null; recept_naam: string };
  assert.equal(sessie.recept_id, null);
  assert.equal(sessie.recept_naam, 'Recept snapshot');
  assert.equal((db.prepare('SELECT count(*) AS aantal FROM brouwsessie_stappen WHERE sessie_id = ?').get(sessieId) as { aantal: number }).aantal, 1);
  assert.equal((await vraag('DELETE', '/99999')).status, 404);
});
