import assert from 'node:assert/strict';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { after, before, test } from 'node:test';

// SCRUM-53: extra ingrediënten van een recept opvragen, op een tijdelijke database met de mockdata uit de migraties.
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

test('de extra ingrediënten van een recept met hun gegevens uit de catalogus', async () => {
  // Recept 11 heeft in de mockdata kersenpuree bij het beslag en lactose bij het koken.
  const { status, body } = await vraag('GET', '/11/extras');
  assert.equal(status, 200);
  assert.deepEqual(body, [
    {
      extra_ingredient_id: 9,
      name: 'Kersenpuree (Kriek)',
      description: 'Fruit toevoeging voor secundaire vergisting',
      amount: 1000,
      unit: 'g',
      add_moment: 'beslag',
      boil_time_min: null,
    },
    {
      extra_ingredient_id: 5,
      name: 'Lactose (Melksuiker)',
      description: 'Niet-vergistbare suiker voor romigheid in Stouts',
      amount: 300,
      unit: 'g',
      add_moment: 'koken',
      boil_time_min: 10,
    },
  ]);
});

test('eerst beslag, dan koken van langste naar kortste kooktijd, ook in het volledige recept', async () => {
  const { body: recept } = await vraag('POST', '', {
    name: 'Extratest',
    extras: [
      { extra_ingredient_id: 1, amount: 10, add_moment: 'koken', boil_time_min: 5 },
      { extra_ingredient_id: 6, amount: 5, add_moment: 'koken', boil_time_min: 15 },
      { extra_ingredient_id: 9, amount: 1000, add_moment: 'beslag' },
      { extra_ingredient_id: 2, amount: 500, add_moment: 'koken', boil_time_min: 60 },
    ],
  });
  const { status, body } = await vraag('GET', `/${recept.id}/extras`);
  assert.equal(status, 200);
  assert.deepEqual(
    body.map((e: { extra_ingredient_id: number }) => e.extra_ingredient_id),
    [9, 2, 6, 1],
  );
  assert.deepEqual((await vraag('GET', `/${recept.id}`)).body.extras, body);
});

test('een recept zonder extra ingrediënten geeft een lege lijst', async () => {
  const { body: recept } = await vraag('POST', '', { name: 'Zonder extra' });
  const { status, body } = await vraag('GET', `/${recept.id}/extras`);
  assert.equal(status, 200);
  assert.deepEqual(body, []);
});

test('onbestaand recept geeft 404', async () => {
  const { status, body } = await vraag('GET', '/9999/extras');
  assert.equal(status, 404);
  assert.deepEqual(Object.keys(body), ['fout']);
});

test('extra ingrediënten bewerken kan niet per recept, alleen via PUT /api/recipes/{id}', async () => {
  const gift = { extra_ingredient_id: 1, amount: 10, add_moment: 'koken', boil_time_min: 5 };
  assert.equal((await vraag('POST', '/11/extras', gift)).status, 404);
  assert.equal((await vraag('PUT', '/11/extras/9', gift)).status, 404);
  assert.equal((await vraag('DELETE', '/11/extras/9')).status, 404);
  assert.equal((await vraag('GET', '/11/extras')).body.length, 2);
});
