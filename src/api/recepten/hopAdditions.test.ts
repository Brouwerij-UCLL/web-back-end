import assert from 'node:assert/strict';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { after, before, test } from 'node:test';

// SCRUM-52: hopgiften van een recept opvragen, op een tijdelijke database met de mockdata uit de migraties.
// Toevoegen, wijzigen en verwijderen gebeurt met PUT /api/recipes/{id} (saveRecipe.test.ts).
process.env.DATABASE_FILE = ':memory:';
const { app } = await import('../../app.ts');

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

test('de hopgiften van een recept met hun gegevens uit de catalogus', async () => {
  // Recept 2 (Gouden Tripel) heeft in de mockdata Styrian Goldings op 60 en Saaz op 15 minuten.
  const { status, body } = await vraag('GET', '/2/hops');
  assert.equal(status, 200);
  assert.deepEqual(body, [
    { id: 4, hop_id: 4, name: 'Styrian Goldings', alpha_acid_percentage: 5.2, type: 1, origin: 'Slovenia', amount_g: 35, boil_time_min: 60 },
    { id: 5, hop_id: 3, name: 'Saaz', alpha_acid_percentage: 3.5, type: 1, origin: 'Czech Republic', amount_g: 25, boil_time_min: 15 },
  ]);
});

test('dezelfde hop op meerdere momenten, van langste naar kortste kooktijd, ook in het volledige recept', async () => {
  const { body: recept } = await vraag('POST', '', {
    name: 'Hoptest',
    hops: [
      { hop_id: 3, amount_g: 20, boil_time_min: 10 },
      { hop_id: 3, amount_g: 45, boil_time_min: 60 },
      { hop_id: 1, amount_g: 30, boil_time_min: 0 },
      { hop_id: 4, amount_g: 15, boil_time_min: 30 },
    ],
  });
  const { status, body } = await vraag('GET', `/${recept.id}/hops`);
  assert.equal(status, 200);
  assert.deepEqual(
    body.map((g: { hop_id: number; boil_time_min: number }) => [g.hop_id, g.boil_time_min]),
    [[3, 60], [4, 30], [3, 10], [1, 0]],
  );
  assert.equal(new Set(body.map((g: { id: number }) => g.id)).size, 4, 'elke gift heeft een eigen id');
  assert.deepEqual((await vraag('GET', `/${recept.id}`)).body.hops, body);
});

test('een recept zonder hopgiften geeft een lege lijst', async () => {
  const { body: recept } = await vraag('POST', '', { name: 'Zonder hop' });
  const { status, body } = await vraag('GET', `/${recept.id}/hops`);
  assert.equal(status, 200);
  assert.deepEqual(body, []);
});

test('onbestaand recept geeft 404', async () => {
  const { status, body } = await vraag('GET', '/9999/hops');
  assert.equal(status, 404);
  assert.deepEqual(Object.keys(body), ['fout']);
});

test('hopgiften bewerken kan niet per recept, alleen via PUT /api/recipes/{id}', async () => {
  const gift = { hop_id: 3, amount_g: 45, boil_time_min: 60 };
  assert.equal((await vraag('POST', '/2/hops', gift)).status, 404);
  assert.equal((await vraag('PUT', '/2/hops/4', gift)).status, 404);
  assert.equal((await vraag('DELETE', '/2/hops/4')).status, 404);
  assert.equal((await vraag('GET', '/2/hops')).body.length, 2);
});
