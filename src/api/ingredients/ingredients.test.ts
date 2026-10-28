import assert from 'node:assert/strict';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { after, before, test } from 'node:test';

// SCRUM-73: catalogus van vergistbare ingrediënten, op een tijdelijke database met de mockdata uit de migraties.
process.env.DATABASE_FILE = ':memory:';
const { app } = await import('../../app.ts');

type Ingredient = { id: number; name: string; manufacturer: string | null };

let server: Server;
let baseUrl: string;

before(async () => {
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://localhost:${(server.address() as AddressInfo).port}/api/ingredients`;
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

test('AC0: alle ingrediënten, alfabetisch op naam', async () => {
  const { status, body } = await vraag('GET', '');
  assert.equal(status, 200);
  assert.ok(body.length >= 15, 'de 15 ingrediënten uit de mockdata ontbreken');
  assert.deepEqual(Object.keys(body[0]).sort(), ['id', 'manufacturer', 'name']);
  const namen = body.map((ingredient: Ingredient) => ingredient.name);
  assert.deepEqual(namen, [...namen].sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' })));
});

test('AC1: zoeken op een deel van de naam, ongeacht hoofdletters', async () => {
  const { status, body } = await vraag('GET', '?search=MALT');
  assert.equal(status, 200);
  assert.ok(body.length > 0);
  assert.ok(body.every((ingredient: Ingredient) => ingredient.name.toLowerCase().includes('malt')));
  assert.ok(!body.some((ingredient: Ingredient) => ingredient.name === 'Roasted Barley'));
});

test('AC2: één ingrediënt opvragen', async () => {
  const { status, body } = await vraag('GET', '/1');
  assert.equal(status, 200);
  assert.deepEqual(body, { id: 1, name: 'Pilsner Malt', manufacturer: 'Dingemans' });
});

test('AC3: ingrediënt toevoegen, met en zonder fabrikant', async () => {
  const met = await vraag('POST', '', { name: 'Biscuit Malt', manufacturer: 'Dingemans' });
  assert.equal(met.status, 201);
  assert.equal(met.body.name, 'Biscuit Malt');
  assert.ok(Number.isInteger(met.body.id));

  const zonder = await vraag('POST', '', { name: 'Rietsuiker' });
  assert.equal(zonder.status, 201);
  assert.equal(zonder.body.manufacturer, null);

  assert.equal((await vraag('GET', `/${met.body.id}`)).status, 200);
});

test('AC4: dezelfde naam en fabrikant geeft 409, ook bij wijzigen', async () => {
  const toevoegen = await vraag('POST', '', { name: 'pilsner malt', manufacturer: 'DINGEMANS' });
  assert.equal(toevoegen.status, 409);
  assert.ok(toevoegen.body.fout);

  const wijzigen = await vraag('PUT', '/2', { name: 'Pilsner Malt', manufacturer: 'Dingemans' });
  assert.equal(wijzigen.status, 409);
  assert.equal((await vraag('GET', '/2')).body.name, 'Pale Ale Malt');
});

test('AC5: ingrediënt wijzigen, recepten tonen de nieuwe naam', async () => {
  const { status, body } = await vraag('PUT', '/3', { name: 'Tarwemout', manufacturer: 'Dingemans' });
  assert.equal(status, 200);
  assert.equal(body.name, 'Tarwemout');

  // Recept 2 (Gouden Tripel) gebruikt ingrediënt 3.
  const recept = await fetch(baseUrl.replace('/ingredients', '/recepten/2/ingredients')).then((r) => r.json());
  assert.ok(recept.some((ingredient: { name: string }) => ingredient.name === 'Tarwemout'));
});

test('AC6: ongebruikt ingrediënt verwijderen', async () => {
  const nieuw = await vraag('POST', '', { name: 'Te verwijderen mout' });
  const verwijderen = await vraag('DELETE', `/${nieuw.body.id}`);
  assert.equal(verwijderen.status, 204);
  assert.equal(verwijderen.body, undefined);
  assert.equal((await vraag('GET', `/${nieuw.body.id}`)).status, 404);
});

test('AC7: gebruikt ingrediënt verwijderen geeft 409 met het aantal recepten', async () => {
  // Ingrediënt 1 (Pilsner Malt) zit in meerdere recepten van de mockdata.
  const { status, body } = await vraag('DELETE', '/1');
  assert.equal(status, 409);
  assert.match(body.fout, /\d+ recepten/);
  assert.equal((await vraag('GET', '/1')).status, 200);
});

test('AC8: ongeldige naam of fabrikant geeft 400 met het veld in de melding', async () => {
  for (const ongeldig of [{ name: '' }, { name: '   ' }, { name: 'x'.repeat(101) }, { name: 'Mout', manufacturer: 'x'.repeat(101) }, {}]) {
    const { status, body } = await vraag('POST', '', ongeldig);
    assert.equal(status, 400, JSON.stringify(ongeldig));
    assert.match(body.fout, /name|manufacturer/);
  }
  assert.equal((await vraag('PUT', '/2', { name: '' })).status, 400);
});

test('AC9: onbestaand id geeft 404', async () => {
  assert.equal((await vraag('GET', '/9999')).status, 404);
  assert.equal((await vraag('PUT', '/9999', { name: 'Iets' })).status, 404);
  assert.equal((await vraag('DELETE', '/9999')).status, 404);
});
