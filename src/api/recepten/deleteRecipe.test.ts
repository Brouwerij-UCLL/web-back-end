import assert from 'node:assert/strict';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { after, before, test } from 'node:test';

// Recept verwijderen, op een tijdelijke database met de mockdata uit de migraties.
process.env.DATABASE_FILE = ':memory:';
const { app } = await import('../../app.ts');
const { db } = await import('../../database/db.ts');

let server: Server;
let baseUrl: string;

before(async () => {
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

const onderdelen = ['recipe_water', 'recipe_ingredients', 'hop_additions', 'recipe_extras', 'recipe_mash_steps', 'recipe_fermentation_steps'];
const catalogi = ['ingredients', 'hops', 'extra_ingredients'];

const aantal = (tabel: string, recipeId?: number) =>
  (
    db
      .prepare(`SELECT count(*) AS n FROM ${tabel}${recipeId === undefined ? '' : ' WHERE recipe_id = ?'}`)
      .get(...(recipeId === undefined ? [] : [recipeId])) as { n: number }
  ).n;

const volledigRecept = {
  name: 'Te verwijderen tripel',
  beer_style: 'Belgische Tripel',
  water: { mash_water_l: 20, sparge_water_l: 14 },
  ingredients: [{ ingredient_id: 1, amount_g: 5500 }],
  hops: [
    { hop_id: 4, amount_g: 35, boil_time_min: 60 },
    { hop_id: 4, amount_g: 20, boil_time_min: 10 },
  ],
  extras: [{ extra_ingredient_id: 2, amount: 500, add_moment: 'koken', boil_time_min: 15 }],
  mash_schedule: { steps: [{ temperature_c: 62, duration_min: 40 }] },
  fermentation_schedule: { steps: [{ temperature_c: 20, duration_days: 10 }] },
};

test('DELETE verwijdert het recept en alles wat alleen bij dat recept hoort', async () => {
  const { body: recept } = await vraag('POST', '', volledigRecept);
  for (const tabel of onderdelen) assert.ok(aantal(tabel, recept.id) > 0, `${tabel} is leeg voor het verwijderen`);

  const { status, body } = await vraag('DELETE', `/${recept.id}`);
  assert.equal(status, 204);
  assert.equal(body, undefined);

  assert.equal((await vraag('GET', `/${recept.id}`)).status, 404);
  assert.ok(!(await vraag('GET', '')).body.some((r: { id: number }) => r.id === recept.id));
  for (const tabel of onderdelen) assert.equal(aantal(tabel, recept.id), 0, `${tabel} heeft nog rijen van het recept`);
});

test('de catalogi en de andere recepten blijven ongewijzigd', async () => {
  const { body: recept } = await vraag('POST', '', volledigRecept);
  const catalogiVoor = catalogi.map((tabel) => aantal(tabel));
  const tripelVoor = (await vraag('GET', '/2')).body;

  assert.equal((await vraag('DELETE', `/${recept.id}`)).status, 204);

  assert.deepEqual(catalogi.map((tabel) => aantal(tabel)), catalogiVoor);
  // Recept 2 gebruikt dezelfde mout, hop en kandijsuiker.
  assert.deepEqual((await vraag('GET', '/2')).body, tripelVoor);
});

test('een recept uit de mockdata verwijderen maakt een hop die alleen dat recept gebruikte weer verwijderbaar', async () => {
  const { hop_id, recipe_id } = db
    .prepare('SELECT hop_id, min(recipe_id) AS recipe_id FROM hop_additions GROUP BY hop_id HAVING count(DISTINCT recipe_id) = 1 LIMIT 1')
    .get() as { hop_id: number; recipe_id: number };
  const hops = baseUrl.replace('/recipes', '/hops');
  assert.equal((await fetch(`${hops}/${hop_id}`, { method: 'DELETE' })).status, 409, 'de hop is nog in gebruik');

  assert.equal((await vraag('DELETE', `/${recipe_id}`)).status, 204);
  assert.equal((await fetch(`${hops}/${hop_id}`, { method: 'DELETE' })).status, 204);
});

test('onbestaand recept geeft 404 en verandert niets', async () => {
  const voor = aantal('recipes');
  const { status, body } = await vraag('DELETE', '/9999');
  assert.equal(status, 404);
  assert.deepEqual(Object.keys(body), ['fout']);
  assert.equal(aantal('recipes'), voor);
});

test('twee keer verwijderen geeft de tweede keer 404', async () => {
  const { body: recept } = await vraag('POST', '', { name: 'Eenmalig' });
  assert.equal((await vraag('DELETE', `/${recept.id}`)).status, 204);
  assert.equal((await vraag('DELETE', `/${recept.id}`)).status, 404);
});
