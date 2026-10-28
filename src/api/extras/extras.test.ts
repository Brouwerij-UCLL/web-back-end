import assert from 'node:assert/strict';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { after, before, test } from 'node:test';

// Catalogus van extra ingrediënten, op een tijdelijke database met de mockdata uit de migraties.
process.env.DATABASE_FILE = ':memory:';
const { app } = await import('../../app.ts');

type Extra = { id: number; name: string; description: string | null; unit: string };

let server: Server;
let baseUrl: string;

before(async () => {
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://localhost:${(server.address() as AddressInfo).port}/api/extras`;
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

test('alle extra ingrediënten, alfabetisch op naam', async () => {
  const { status, body } = await vraag('GET', '');
  assert.equal(status, 200);
  assert.ok(body.length >= 9, 'de 9 extra ingrediënten uit de mockdata ontbreken');
  assert.deepEqual(Object.keys(body[0]).sort(), ['description', 'id', 'name', 'unit']);
  const namen = body.map((extra: Extra) => extra.name);
  assert.deepEqual(namen, [...namen].sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' })));
});

test('zoeken op een deel van de naam, ongeacht hoofdletters', async () => {
  const { status, body } = await vraag('GET', '?search=KANDIJ');
  assert.equal(status, 200);
  assert.deepEqual(body.map((extra: Extra) => extra.id).sort(), [2, 3]);
});

test('één extra ingrediënt opvragen', async () => {
  const { status, body } = await vraag('GET', '/1');
  assert.equal(status, 200);
  assert.deepEqual(body, {
    id: 1,
    name: 'Gedroogde Koriander (Coriander)',
    description: 'Licht geplet voor citrus/kruidig aroma',
    unit: 'g',
  });
});

test('extra ingrediënt toevoegen, met en zonder beschrijving', async () => {
  const met = await vraag('POST', '', { name: 'Gemberwortel', description: 'Vers geraspt', unit: 'g' });
  assert.equal(met.status, 201);
  assert.ok(Number.isInteger(met.body.id));
  assert.deepEqual((await vraag('GET', `/${met.body.id}`)).body, met.body);

  const zonder = await vraag('POST', '', { name: 'Vanillestokje', unit: 'stuks' });
  assert.equal(zonder.status, 201);
  assert.equal(zonder.body.description, null);
});

test('dezelfde naam geeft 409, ook bij wijzigen', async () => {
  const toevoegen = await vraag('POST', '', { name: 'lactose (melksuiker)', unit: 'g' });
  assert.equal(toevoegen.status, 409);
  assert.ok(toevoegen.body.fout);

  const wijzigen = await vraag('PUT', '/1', { name: 'Lactose (Melksuiker)', unit: 'g' });
  assert.equal(wijzigen.status, 409);
  assert.equal((await vraag('GET', '/1')).body.name, 'Gedroogde Koriander (Coriander)');
});

test('extra ingrediënt wijzigen, recepten tonen de nieuwe gegevens', async () => {
  const { status, body } = await vraag('PUT', '/5', { name: 'Lactose', description: 'Melksuiker', unit: 'kg' });
  assert.equal(status, 200);
  assert.deepEqual(body, { id: 5, name: 'Lactose', description: 'Melksuiker', unit: 'kg' });

  // Recept 11 gebruikt extra ingrediënt 5.
  const recept = await fetch(baseUrl.replace('/extras', '/recipes/11')).then((r) => r.json());
  const extra = recept.extras.find((e: { extra_ingredient_id: number }) => e.extra_ingredient_id === 5);
  assert.equal(extra.name, 'Lactose');
  assert.equal(extra.unit, 'kg');
});

test('ongebruikt extra ingrediënt verwijderen', async () => {
  const nieuw = await vraag('POST', '', { name: 'Te verwijderen', unit: 'g' });
  const verwijderen = await vraag('DELETE', `/${nieuw.body.id}`);
  assert.equal(verwijderen.status, 204);
  assert.equal(verwijderen.body, undefined);
  assert.equal((await vraag('GET', `/${nieuw.body.id}`)).status, 404);
});

test('gebruikt extra ingrediënt verwijderen geeft 409 met het aantal recepten', async () => {
  // Extra ingrediënt 6 (Iers Mos) zit in de recepten 1 en 7 van de mockdata.
  const { status, body } = await vraag('DELETE', '/6');
  assert.equal(status, 409);
  assert.match(body.fout, /2 recepten/);
  assert.equal((await vraag('GET', '/6')).status, 200);
});

test('ongeldige velden geven 400 met het veld in de melding', async () => {
  const gevallen: [unknown, RegExp][] = [
    [{ unit: 'g' }, /name/],
    [{ name: '   ', unit: 'g' }, /naam is verplicht/],
    [{ name: 'x'.repeat(101), unit: 'g' }, /naam mag maximaal 100 tekens/],
    [{ name: 'Kaneel' }, /eenheid is verplicht/],
    [{ name: 'Kaneel', unit: '  ' }, /eenheid is verplicht/],
    [{ name: 'Kaneel', unit: 'x'.repeat(21) }, /eenheid mag maximaal 20 tekens/],
    [{ name: 'Kaneel', unit: 'g', description: 'x'.repeat(1001) }, /beschrijving mag maximaal 1000 tekens/],
    [{ name: 'Kaneel', unit: 'g', eenheid: 'g' }, /eenheid/],
  ];
  for (const [body, melding] of gevallen) {
    const antwoord = await vraag('POST', '', body);
    assert.equal(antwoord.status, 400, JSON.stringify(body));
    assert.match(antwoord.body.fout, melding);
  }
  assert.equal((await vraag('PUT', '/2', { name: '', unit: 'g' })).status, 400);
});

test('onbestaand id geeft 404', async () => {
  assert.equal((await vraag('GET', '/9999')).status, 404);
  assert.equal((await vraag('PUT', '/9999', { name: 'Iets', unit: 'g' })).status, 404);
  assert.equal((await vraag('DELETE', '/9999')).status, 404);
});
