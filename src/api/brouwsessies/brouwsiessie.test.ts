import assert from 'node:assert/strict';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { after, before, test } from 'node:test';

process.env.DATABASE_FILE = ':memory:';
process.env.MAX_VOLUME_LITER = '40.5';
const { app } = await import('../../app.ts');
const { db } = await import('../../database/db.ts');

const receptenPad = '/api/recipes';
const sessiesPad = '/api/brouwsessies';
let server: Server;
let basis: string;

before(async () => {
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  basis = `http://localhost:${(server.address() as AddressInfo).port}`;
});

after(() => server.close());

async function vraag(method: string, pad: string, body?: unknown) {
  const antwoord = await fetch(basis + pad, {
    method,
    headers: body === undefined ? {} : { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: antwoord.status, body: antwoord.status === 204 ? undefined : await antwoord.json() };
}

const testRecept = {
  name: 'Testbrouwsel',
  recept_volume: 20,
  water: { mash_water_l: 20, sparge_water_l: 5 },
  ingredients: [{ ingredient_id: 1, amount_g: 4000 }],
  hops: [{ hop_id: 3, amount_g: 40, boil_time_min: 60 }],
  extras: [{ extra_ingredient_id: 2, amount: 200, add_moment: 'koken', boil_time_min: 15 }],
  mash_schedule: { steps: [{ temperature_c: 65, duration_min: 45 }] },
  fermentation_schedule: { steps: [{ temperature_c: 20, duration_days: 10 }] },
};

async function maakTestRecept() {
  const { status, body } = await vraag('POST', receptenPad, testRecept);
  assert.equal(status, 201, JSON.stringify(body));
  return body;
}

async function startSessie(recept_id: number, doel_volume_liter: number) {
  return vraag('POST', sessiesPad, { recept_id, doel_volume_liter });
}

test('AC0: POST geeft 201 en de opgeslagen sessie met schaalfactor en hoeveelheden', async () => {
  const recept = await maakTestRecept();
  const { status, body } = await startSessie(recept.id, 30);

  assert.equal(status, 201);
  assert.ok(Number.isInteger(body.id) && body.id > 0);
  assert.equal(body.recept_id, recept.id);
  assert.equal(body.doel_volume_liter, 30);
  assert.equal(body.schaalfactor, 1.5);
  assert.deepEqual(body.recept_snapshot, recept);
  assert.ok(body.geschaalde_hoeveelheden);
});

test('AC1: alle hoeveelheden schalen mee en tijden en temperaturen blijven gelijk', async () => {
  const recept = await maakTestRecept();
  const { status, body } = await startSessie(recept.id, 10);

  assert.equal(status, 201);
  assert.equal(body.schaalfactor, 0.5);
  const { water, ingredients, hops, extras } = body.geschaalde_hoeveelheden;
  assert.deepEqual(water, { mash_water_l: 10, sparge_water_l: 2.5 });
  assert.deepEqual(ingredients, [{ ...recept.ingredients[0], amount_g: 2000 }]);
  assert.deepEqual(hops, [{ ...recept.hops[0], amount_g: 20 }]);
  assert.deepEqual(extras, [{ ...recept.extras[0], amount: 100 }]);
  assert.deepEqual(body.recept_snapshot.mash_schedule, recept.mash_schedule);
  assert.deepEqual(body.recept_snapshot.fermentation_schedule, recept.fermentation_schedule);
});

test('AC2: 20 naar 30 liter geeft 6 kg mout, 30 l maischwater, 7,5 l spoelwater en 60 g hop', async () => {
  const recept = await maakTestRecept();
  const { status, body } = await startSessie(recept.id, 30);

  assert.equal(status, 201);
  const { water, ingredients, hops } = body.geschaalde_hoeveelheden;
  assert.deepEqual(water, { mash_water_l: 30, sparge_water_l: 7.5 });
  assert.equal(ingredients[0].amount_g, 6000);
  assert.equal(hops[0].amount_g, 60);
});

test('AC3: de opgeslagen sessie blijft identiek na wijzigen en verwijderen van het recept', async () => {
  const recept = await maakTestRecept();
  const { status, body } = await startSessie(recept.id, 30);
  assert.equal(status, 201);

  const zoek = db.prepare('SELECT * FROM brouwsessies WHERE id = ?');
  const opgeslagen = zoek.get(body.id);
  assert.ok(opgeslagen);
  assert.equal(opgeslagen.recept_id, body.recept_id);
  assert.equal(opgeslagen.recept_naam, recept.name);
  assert.equal(opgeslagen.start_tijd, body.created_at);
  assert.equal(opgeslagen.status, 'aangemaakt');
  assert.equal(opgeslagen.doel_volume_liter, body.doel_volume_liter);
  assert.equal(opgeslagen.schaalfactor, body.schaalfactor);
  assert.deepEqual(JSON.parse(opgeslagen.recept_snapshot as string), recept);
  assert.deepEqual(JSON.parse(opgeslagen.geschaalde_hoeveelheden as string), body.geschaalde_hoeveelheden);

  const pad = `${receptenPad}/${recept.id}`;
  assert.equal((await vraag('PUT', pad, { name: 'Vervangen recept', recept_volume: 15 })).status, 200);
  assert.deepEqual(zoek.get(body.id), opgeslagen);
  assert.equal((await vraag('DELETE', pad)).status, 204);
  assert.equal((await vraag('GET', pad)).status, 404);
  assert.deepEqual(zoek.get(body.id), opgeslagen);
});

test('AC4: ongeldige volumes geven 400 en een onbestaand recept geeft 404', async () => {
  const recept = await maakTestRecept();
  const aantal = db.prepare('SELECT count(*) AS aantal FROM brouwsessies');
  const voor = aantal.get();
  for (const volume of [0, -1, 40.6]) {
    const { status, body } = await startSessie(recept.id, volume);
    assert.equal(status, 400);
    assert.deepEqual(Object.keys(body), ['fout']);
    assert.match(body.fout, /doel_volume_liter/);
  }

  const { status, body } = await startSessie(999_999, 30);
  assert.equal(status, 404);
  assert.deepEqual(body, { fout: 'recept 999999 niet gevonden' });
  assert.deepEqual(aantal.get(), voor);
  assert.equal((await startSessie(recept.id, 40.5)).status, 201);
});

test('Swagger toont de groep en voorbeelden voor de aanvraag en de sessie', async () => {
  const { status, body } = await vraag('GET', '/api/docs/openapi.json');
  assert.equal(status, 200);
  const operatie = body.paths[sessiesPad].post;
  assert.deepEqual(operatie.tags, ['brouwsessies']);
  assert.deepEqual(operatie.requestBody.content['application/json'].schema.example, {
    recept_id: 1, doel_volume_liter: 30,
  });
  assert.equal(operatie.responses['201'].content['application/json'].schema.example.schaalfactor, 1.5);
});

test('een recept zonder water of ingrediënten levert lege hoeveelheden op', async () => {
  const { status, body: recept } = await vraag('POST', receptenPad, { name: 'Basisrecept', recept_volume: 20 });
  assert.equal(status, 201);
  const sessie = await startSessie(recept.id, 30);
  assert.equal(sessie.status, 201);
  assert.deepEqual(sessie.body.geschaalde_hoeveelheden, { water: null, ingredients: [], hops: [], extras: [] });
});