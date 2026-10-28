import assert from 'node:assert/strict';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { after, before, test } from 'node:test';

// SCRUM-53: extra ingrediënten van een recept, op een tijdelijke database met de mockdata uit de migraties.
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

// Een nieuw recept zonder extra ingrediënten, zodat elke test met een propere lei begint.
async function nieuwRecept(): Promise<number> {
  const { status, body } = await vraag('POST', '', { name: 'Extratest' });
  assert.equal(status, 201);
  return body.id;
}

const rijen = (id: number) =>
  db
    .prepare('SELECT extra_ingredient_id, amount, add_moment, boil_time FROM recipe_extras WHERE recipe_id = ? ORDER BY extra_ingredient_id')
    .all(id)
    .map((rij) => ({ ...rij }));

const koriander = { extra_ingredient_id: 1, amount: 10, add_moment: 'koken', boil_time_min: 5 };
const kersen = { extra_ingredient_id: 9, amount: 1000, add_moment: 'beslag', boil_time_min: null };

test('AC0: POST voegt een extra ingrediënt toe en antwoordt met 201 en het ingrediënt', async () => {
  const id = await nieuwRecept();
  const { status, body } = await vraag('POST', `/${id}/extras`, koriander);
  assert.equal(status, 201);
  assert.deepEqual(body, {
    extra_ingredient_id: 1,
    name: 'Gedroogde Koriander (Coriander)',
    description: 'Licht geplet voor citrus/kruidig aroma',
    amount: 10,
    unit: 'g',
    add_moment: 'koken',
    boil_time_min: 5,
  });
  assert.deepEqual((await vraag('GET', `/${id}/extras/1`)).body, body);

  // Bij "beslag" mag boil_time_min ook ontbreken.
  const { boil_time_min: _, ...zonderKooktijd } = kersen;
  assert.equal((await vraag('POST', `/${id}/extras`, zonderKooktijd)).status, 201);
});

test('AC0: hetzelfde extra ingrediënt twee keer toevoegen geeft 409', async () => {
  const id = await nieuwRecept();
  await vraag('POST', `/${id}/extras`, koriander);
  const { status, body } = await vraag('POST', `/${id}/extras`, { ...koriander, amount: 20 });
  assert.equal(status, 409);
  assert.match(body.fout, /zit al in recept/);
  assert.equal(rijen(id)[0].amount, 10);
});

test('AC1: koken zonder kooktijd geeft 400', async () => {
  const id = await nieuwRecept();
  const { status, body } = await vraag('POST', `/${id}/extras`, { ...koriander, boil_time_min: null });
  assert.equal(status, 400);
  assert.match(body.fout, /kooktijd is verplicht bij add_moment "koken"/);
});

test('AC2: beslag met een kooktijd geeft 400', async () => {
  const id = await nieuwRecept();
  const { status, body } = await vraag('POST', `/${id}/extras`, { ...kersen, boil_time_min: 10 });
  assert.equal(status, 400);
  assert.match(body.fout, /een kooktijd hoort alleen bij add_moment "koken"/);
});

test('AC3: een kooktijd boven het maximum geeft 400 met het maximum in de melding', async () => {
  const id = await nieuwRecept();
  const { status, body } = await vraag('POST', `/${id}/extras`, { ...koriander, boil_time_min: 181 });
  assert.equal(status, 400);
  assert.match(body.fout, /maximaal 180 minuten/);
  assert.equal((await vraag('POST', `/${id}/extras`, { ...koriander, boil_time_min: 180 })).status, 201);
});

test('AC4: eerst beslag, dan koken van langste naar kortste kooktijd, ook in het volledige recept', async () => {
  const id = await nieuwRecept();
  await vraag('POST', `/${id}/extras`, koriander);
  await vraag('POST', `/${id}/extras`, { extra_ingredient_id: 6, amount: 5, add_moment: 'koken', boil_time_min: 15 });
  await vraag('POST', `/${id}/extras`, kersen);
  await vraag('POST', `/${id}/extras`, { extra_ingredient_id: 2, amount: 500, add_moment: 'koken', boil_time_min: 60 });

  const { status, body } = await vraag('GET', `/${id}/extras`);
  assert.equal(status, 200);
  assert.deepEqual(
    body.map((e: { extra_ingredient_id: number }) => e.extra_ingredient_id),
    [9, 2, 6, 1],
  );
  assert.deepEqual((await vraag('GET', `/${id}`)).body.extras, body);
});

test('AC5: wijzigen geeft 200 en laat de andere extra ingrediënten ongewijzigd', async () => {
  const id = await nieuwRecept();
  await vraag('POST', `/${id}/extras`, koriander);
  await vraag('POST', `/${id}/extras`, kersen);

  const { status, body } = await vraag('PUT', `/${id}/extras/1`, { amount: 12, add_moment: 'beslag' });
  assert.equal(status, 200);
  assert.equal(body.amount, 12);
  assert.equal(body.add_moment, 'beslag');
  assert.equal(body.boil_time_min, null);
  assert.deepEqual(rijen(id), [
    { extra_ingredient_id: 1, amount: 12, add_moment: 'beslag', boil_time: null },
    { extra_ingredient_id: 9, amount: 1000, add_moment: 'beslag', boil_time: null },
  ]);
});

test('AC5: verwijderen geeft 204 en laat de andere extra ingrediënten en de catalogus staan', async () => {
  const id = await nieuwRecept();
  await vraag('POST', `/${id}/extras`, koriander);
  await vraag('POST', `/${id}/extras`, kersen);

  const { status, body } = await vraag('DELETE', `/${id}/extras/1`);
  assert.equal(status, 204);
  assert.equal(body, undefined);
  assert.deepEqual(rijen(id).map((r) => r.extra_ingredient_id), [9]);
  assert.ok(db.prepare('SELECT 1 FROM extra_ingredients WHERE extra_ingredient_id = 1').get());
});

test('AC6: ontbrekende velden, onbekend toevoegmoment of hoeveelheid 0 of minder geven 400, en er verandert niets', async () => {
  const id = await nieuwRecept();
  await vraag('POST', `/${id}/extras`, koriander);
  const voor = rijen(id);

  const ongeldig: unknown[] = [
    { amount: 10, add_moment: 'koken', boil_time_min: 5 },
    { extra_ingredient_id: 6, add_moment: 'koken', boil_time_min: 5 },
    { extra_ingredient_id: 6, amount: 10 },
    { extra_ingredient_id: 6, amount: 10, add_moment: 'gisting' },
    { extra_ingredient_id: 6, amount: 0, add_moment: 'beslag' },
    { extra_ingredient_id: 6, amount: -5, add_moment: 'beslag' },
    { extra_ingredient_id: 999, amount: 10, add_moment: 'beslag' },
    { ...kersen, extra_ingredient_id: 6, naam: 'Nederlands veld' },
  ];
  for (const body of ongeldig) {
    const antwoord = await vraag('POST', `/${id}/extras`, body);
    assert.equal(antwoord.status, 400, JSON.stringify(body));
    assert.deepEqual(Object.keys(antwoord.body), ['fout']);
  }
  for (const body of [{ amount: 0, add_moment: 'beslag' }, { amount: 10, add_moment: 'gisting' }, { add_moment: 'beslag' }]) {
    assert.equal((await vraag('PUT', `/${id}/extras/1`, body)).status, 400, JSON.stringify(body));
  }
  assert.deepEqual(rijen(id), voor);
});

test('AC7: onbestaand recept, onbestaand ingrediënt of een ingrediënt van een ander recept geeft 404', async () => {
  const id = await nieuwRecept();
  const ander = await nieuwRecept();
  await vraag('POST', `/${ander}/extras`, koriander);

  assert.equal((await vraag('GET', '/9999/extras')).status, 404);
  assert.equal((await vraag('POST', '/9999/extras', koriander)).status, 404);
  for (const pad of ['/9999/extras/1', `/${id}/extras/1`, `/${id}/extras/999`]) {
    assert.equal((await vraag('GET', pad)).status, 404, pad);
    assert.equal((await vraag('PUT', pad, { amount: 1, add_moment: 'beslag' })).status, 404, pad);
    assert.equal((await vraag('DELETE', pad)).status, 404, pad);
  }
  assert.deepEqual(rijen(id), []);
  assert.equal(rijen(ander).length, 1);
});
