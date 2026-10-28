import assert from 'node:assert/strict';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { after, before, test } from 'node:test';

// SCRUM-52: hopgiften van een recept, op een tijdelijke database met de mockdata uit de migraties.
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

// Een nieuw recept zonder hopgiften, zodat elke test met een propere lei begint.
async function nieuwRecept(): Promise<number> {
  const { status, body } = await vraag('POST', '', { name: 'Hoptest' });
  assert.equal(status, 201);
  return body.id;
}

const rijen = (id: number) =>
  db
    .prepare('SELECT hop_addition_id AS id, hop_id, amount, boil_time_min FROM hop_additions WHERE recipe_id = ? ORDER BY hop_addition_id')
    .all(id)
    .map((rij) => ({ ...rij }));

const saaz60 = { hop_id: 3, amount_g: 45, boil_time_min: 60 };

test('AC0: POST slaat een hopgift op en antwoordt met 201 en de gift met een nieuw id', async () => {
  const id = await nieuwRecept();
  const { status, body } = await vraag('POST', `/${id}/hops`, saaz60);
  assert.equal(status, 201);
  assert.ok(Number.isInteger(body.id));
  assert.deepEqual(body, {
    id: body.id,
    hop_id: 3,
    name: 'Saaz',
    alpha_acid_percentage: 3.5,
    type: 1,
    origin: 'Czech Republic',
    amount_g: 45,
    boil_time_min: 60,
  });
  assert.deepEqual((await vraag('GET', `/${id}/hops/${body.id}`)).body, body);
});

test('AC1: dezelfde hop op twee momenten geeft twee aparte giften', async () => {
  const id = await nieuwRecept();
  const eerste = await vraag('POST', `/${id}/hops`, saaz60);
  const tweede = await vraag('POST', `/${id}/hops`, { hop_id: 3, amount_g: 20, boil_time_min: 10 });
  assert.equal(tweede.status, 201);
  assert.notEqual(eerste.body.id, tweede.body.id);
  assert.deepEqual(
    rijen(id).map((r) => [r.hop_id, r.amount, r.boil_time_min]),
    [[3, 45, 60], [3, 20, 10]],
  );
});

test('AC2: giften van langste naar kortste kooktijd, ook in het volledige recept', async () => {
  const id = await nieuwRecept();
  for (const boil_time_min of [10, 60, 0, 30]) {
    await vraag('POST', `/${id}/hops`, { hop_id: 1, amount_g: 10, boil_time_min });
  }
  const { status, body } = await vraag('GET', `/${id}/hops`);
  assert.equal(status, 200);
  assert.deepEqual(body.map((g: { boil_time_min: number }) => g.boil_time_min), [60, 30, 10, 0]);
  assert.deepEqual((await vraag('GET', `/${id}`)).body.hops, body);
});

test('AC3: wijzigen geeft 200 en laat de andere giften ongewijzigd', async () => {
  const id = await nieuwRecept();
  const gift = (await vraag('POST', `/${id}/hops`, saaz60)).body;
  const ander = (await vraag('POST', `/${id}/hops`, { hop_id: 1, amount_g: 30, boil_time_min: 5 })).body;

  const { status, body } = await vraag('PUT', `/${id}/hops/${gift.id}`, { hop_id: 4, amount_g: 35, boil_time_min: 45 });
  assert.equal(status, 200);
  assert.equal(body.id, gift.id);
  assert.equal(body.name, 'Styrian Goldings');
  assert.equal(body.boil_time_min, 45);
  assert.deepEqual(rijen(id), [
    { id: gift.id, hop_id: 4, amount: 35, boil_time_min: 45 },
    { id: ander.id, hop_id: 1, amount: 30, boil_time_min: 5 },
  ]);
});

test('AC3: verwijderen geeft 204 en laat de andere giften en de catalogus staan', async () => {
  const id = await nieuwRecept();
  const gift = (await vraag('POST', `/${id}/hops`, saaz60)).body;
  const ander = (await vraag('POST', `/${id}/hops`, { hop_id: 3, amount_g: 20, boil_time_min: 10 })).body;

  const { status, body } = await vraag('DELETE', `/${id}/hops/${gift.id}`);
  assert.equal(status, 204);
  assert.equal(body, undefined);
  assert.deepEqual(rijen(id).map((r) => r.id), [ander.id]);
  assert.ok(db.prepare('SELECT 1 FROM hops WHERE hop_id = 3').get());
});

test('AC4: een kooktijd boven het maximum geeft 400 met het maximum in de melding', async () => {
  const id = await nieuwRecept();
  const { status, body } = await vraag('POST', `/${id}/hops`, { ...saaz60, boil_time_min: 181 });
  assert.equal(status, 400);
  assert.match(body.fout, /maximaal 180 minuten/);
  assert.equal((await vraag('POST', `/${id}/hops`, { ...saaz60, boil_time_min: 180 })).status, 201);
});

test('AC6: ontbrekende of ongeldige velden of een onbekende hop geven 400, en er verandert niets', async () => {
  const id = await nieuwRecept();
  const gift = (await vraag('POST', `/${id}/hops`, saaz60)).body;
  const voor = rijen(id);

  const ongeldig: unknown[] = [
    { amount_g: 45, boil_time_min: 60 },
    { hop_id: 3, boil_time_min: 60 },
    { hop_id: 3, amount_g: 45 },
    { hop_id: 3, amount_g: 0, boil_time_min: 60 },
    { hop_id: 3, amount_g: 'veel', boil_time_min: 60 },
    { hop_id: 3, amount_g: 45, boil_time_min: -1 },
    { hop_id: 3, amount_g: 45, boil_time_min: 7.5 },
    { hop_id: 999, amount_g: 45, boil_time_min: 60 },
    { ...saaz60, naam: 'Saaz' },
  ];
  for (const body of ongeldig) {
    const post = await vraag('POST', `/${id}/hops`, body);
    assert.equal(post.status, 400, `POST ${JSON.stringify(body)}`);
    assert.deepEqual(Object.keys(post.body), ['fout']);
    assert.equal((await vraag('PUT', `/${id}/hops/${gift.id}`, body)).status, 400, `PUT ${JSON.stringify(body)}`);
  }
  assert.match((await vraag('POST', `/${id}/hops`, { ...saaz60, hop_id: 999 })).body.fout, /hop 999 bestaat niet/);
  assert.deepEqual(rijen(id), voor);
});

test('AC7: onbestaand recept, onbestaande gift of een gift van een ander recept geeft 404', async () => {
  const id = await nieuwRecept();
  const ander = await nieuwRecept();
  const giftVanAnder = (await vraag('POST', `/${ander}/hops`, saaz60)).body;

  assert.equal((await vraag('GET', '/9999/hops')).status, 404);
  assert.equal((await vraag('POST', '/9999/hops', saaz60)).status, 404);
  for (const pad of [`/9999/hops/${giftVanAnder.id}`, `/${id}/hops/${giftVanAnder.id}`, `/${id}/hops/99999`]) {
    assert.equal((await vraag('GET', pad)).status, 404, pad);
    assert.equal((await vraag('PUT', pad, saaz60)).status, 404, pad);
    assert.equal((await vraag('DELETE', pad)).status, 404, pad);
  }
  assert.deepEqual(rijen(id), []);
  assert.equal(rijen(ander).length, 1);
});
