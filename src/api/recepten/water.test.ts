import assert from 'node:assert/strict';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { after, before, test } from 'node:test';

// SCRUM-47: maisch- en spoelwater van een recept, op een tijdelijke database met de mockdata uit de migraties.
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
  return { status: antwoord.status, body: await antwoord.json() };
}

// Een nieuw recept zonder water, zodat elke test met een propere lei begint.
async function nieuwRecept(): Promise<number> {
  const { status, body } = await vraag('POST', '', {
    name: 'Watertest',
    mash_schedule: { steps: [{ temperature_c: 66, duration_min: 60 }] },
  });
  assert.equal(status, 201);
  return body.id;
}

const waterRijen = (id: number) =>
  (db.prepare('SELECT count(*) AS n FROM recipe_water WHERE recipe_id = ?').get(id) as { n: number }).n;

test('AC0: PUT slaat maisch- en spoelwater op en antwoordt met 200 en de waarden', async () => {
  const id = await nieuwRecept();
  const { status, body } = await vraag('PUT', `/${id}/water`, { mash_water_l: 18.5, sparge_water_l: 12 });
  assert.equal(status, 200);
  assert.deepEqual(body, { recipe_id: id, mash_water_l: 18.5, sparge_water_l: 12 });
});

test('AC1: GET van het water en van het recept geeft exact dezelfde hoeveelheden', async () => {
  const id = await nieuwRecept();
  assert.deepEqual((await vraag('GET', `/${id}/water`)).body, { recipe_id: id, mash_water_l: null, sparge_water_l: null });

  await vraag('PUT', `/${id}/water`, { mash_water_l: 18.5, sparge_water_l: 12.25 });
  const water = await vraag('GET', `/${id}/water`);
  assert.equal(water.status, 200);
  assert.deepEqual(water.body, { recipe_id: id, mash_water_l: 18.5, sparge_water_l: 12.25 });
  assert.deepEqual((await vraag('GET', `/${id}`)).body.water, { mash_water_l: 18.5, sparge_water_l: 12.25 });
});

test('AC2: nieuwe waarden vervangen de oude, de rest van het recept blijft ongewijzigd', async () => {
  const id = await nieuwRecept();
  await vraag('PUT', `/${id}/water`, { mash_water_l: 18.5, sparge_water_l: 12 });
  const { water: _oud, ...voor } = (await vraag('GET', `/${id}`)).body;

  const { body } = await vraag('PUT', `/${id}/water`, { mash_water_l: 20, sparge_water_l: 14 });
  assert.deepEqual(body, { recipe_id: id, mash_water_l: 20, sparge_water_l: 14 });
  assert.equal(waterRijen(id), 1, 'per recept maar één waterrecord');

  const { water, ...na } = (await vraag('GET', `/${id}`)).body;
  assert.deepEqual(water, { mash_water_l: 20, sparge_water_l: 14 });
  assert.deepEqual(na, voor);
});

test('AC3: 0 liter spoelwater wordt aanvaard', async () => {
  const id = await nieuwRecept();
  const { status, body } = await vraag('PUT', `/${id}/water`, { mash_water_l: 25, sparge_water_l: 0 });
  assert.equal(status, 200);
  assert.equal(body.sparge_water_l, 0);
});

test('AC4: ongeldige hoeveelheden geven 400 met het veld, en er wordt niets opgeslagen', async () => {
  const id = await nieuwRecept();
  await vraag('PUT', `/${id}/water`, { mash_water_l: 18.5, sparge_water_l: 12 });

  const gevallen: [unknown, RegExp][] = [
    [{ sparge_water_l: 12 }, /mash_water_l/],
    [{ mash_water_l: 0, sparge_water_l: 12 }, /mash_water_l moet groter zijn dan 0/],
    [{ mash_water_l: -5, sparge_water_l: 12 }, /mash_water_l moet groter zijn dan 0/],
    [{ mash_water_l: 18, sparge_water_l: -1 }, /sparge_water_l mag niet negatief zijn/],
    [{ mash_water_l: '18', sparge_water_l: 12 }, /mash_water_l ontbreekt of is geen getal/],
    [{ mash_water_l: 18 }, /sparge_water_l ontbreekt of is geen getal/],
    [{ mash_water_l: 501, sparge_water_l: 12 }, /mash_water_l mag maximaal 500 liter zijn/],
  ];
  for (const [body, melding] of gevallen) {
    const antwoord = await vraag('PUT', `/${id}/water`, body);
    assert.equal(antwoord.status, 400, JSON.stringify(body));
    assert.deepEqual(Object.keys(antwoord.body), ['fout']);
    assert.match(antwoord.body.fout, melding);
  }
  assert.deepEqual((await vraag('GET', `/${id}/water`)).body, { recipe_id: id, mash_water_l: 18.5, sparge_water_l: 12 });
});

test('AC5: onbestaand recept geeft 404', async () => {
  assert.equal((await vraag('GET', '/9999/water')).status, 404);
  assert.equal((await vraag('PUT', '/9999/water', { mash_water_l: 18.5, sparge_water_l: 12 })).status, 404);
  assert.equal(waterRijen(9999), 0);
});
