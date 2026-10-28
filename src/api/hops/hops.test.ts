import assert from 'node:assert/strict';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { after, before, test } from 'node:test';

// Catalogus van hops, op een tijdelijke database met de mockdata uit de migraties.
process.env.DATABASE_FILE = ':memory:';
const { app } = await import('../../app.ts');

type Hop = { id: number; name: string; alpha_acid_percentage: number | null; type: number; origin: string | null };

let server: Server;
let baseUrl: string;

before(async () => {
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://localhost:${(server.address() as AddressInfo).port}/api/hops`;
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

test('alle hops, alfabetisch op naam', async () => {
  const { status, body } = await vraag('GET', '');
  assert.equal(status, 200);
  assert.ok(body.length >= 14, 'de 14 hops uit de mockdata ontbreken');
  assert.deepEqual(Object.keys(body[0]).sort(), ['alpha_acid_percentage', 'id', 'name', 'origin', 'type']);
  const namen = body.map((hop: Hop) => hop.name);
  assert.deepEqual(namen, [...namen].sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' })));
});

test('zoeken op een deel van de naam, ongeacht hoofdletters', async () => {
  const { status, body } = await vraag('GET', '?search=GOLDINGS');
  assert.equal(status, 200);
  assert.deepEqual(body.map((hop: Hop) => hop.name).sort(), ['East Kent Goldings', 'Styrian Goldings']);
});

test('één hop opvragen', async () => {
  const { status, body } = await vraag('GET', '/3');
  assert.equal(status, 200);
  assert.deepEqual(body, { id: 3, name: 'Saaz', alpha_acid_percentage: 3.5, type: 1, origin: 'Czech Republic' });
});

test('hop toevoegen, met en zonder optionele velden', async () => {
  const volledig = await vraag('POST', '', { name: 'Perle', alpha_acid_percentage: 7.5, type: 0, origin: 'Germany' });
  assert.equal(volledig.status, 201);
  assert.ok(Number.isInteger(volledig.body.id));
  assert.deepEqual((await vraag('GET', `/${volledig.body.id}`)).body, volledig.body);

  const minimaal = await vraag('POST', '', { name: 'Huisgekweekte hop', type: 0 });
  assert.equal(minimaal.status, 201);
  assert.equal(minimaal.body.alpha_acid_percentage, null);
  assert.equal(minimaal.body.origin, null);
});

test('dezelfde naam, type en herkomst geeft 409, ook bij wijzigen', async () => {
  const toevoegen = await vraag('POST', '', { name: 'saaz', alpha_acid_percentage: 4, type: 1, origin: 'czech republic' });
  assert.equal(toevoegen.status, 409);
  assert.ok(toevoegen.body.fout);

  // Saaz in bloemen is een andere hop dan Saaz in pellets.
  assert.equal((await vraag('POST', '', { name: 'Saaz', type: 0, origin: 'Czech Republic' })).status, 201);

  const wijzigen = await vraag('PUT', '/1', { name: 'Saaz', alpha_acid_percentage: 3.5, type: 1, origin: 'Czech Republic' });
  assert.equal(wijzigen.status, 409);
  assert.equal((await vraag('GET', '/1')).body.name, 'Citra');
});

test('hop wijzigen, recepten tonen de nieuwe gegevens', async () => {
  const { status, body } = await vraag('PUT', '/4', { name: 'Styrian Golding', alpha_acid_percentage: 5.4, type: 0, origin: 'Slovenia' });
  assert.equal(status, 200);
  assert.deepEqual(body, { id: 4, name: 'Styrian Golding', alpha_acid_percentage: 5.4, type: 0, origin: 'Slovenia' });

  // Recept 2 (Gouden Tripel) gebruikt hop 4.
  const recept = await fetch(baseUrl.replace('/hops', '/recipes/2')).then((r) => r.json());
  const gift = recept.hops.find((h: { hop_id: number }) => h.hop_id === 4);
  assert.equal(gift.name, 'Styrian Golding');
  assert.equal(gift.alpha_acid_percentage, 5.4);
  assert.equal(gift.type, 0);
});

test('ongebruikte hop verwijderen', async () => {
  const nieuw = await vraag('POST', '', { name: 'Te verwijderen hop', type: 1 });
  const verwijderen = await vraag('DELETE', `/${nieuw.body.id}`);
  assert.equal(verwijderen.status, 204);
  assert.equal(verwijderen.body, undefined);
  assert.equal((await vraag('GET', `/${nieuw.body.id}`)).status, 404);
});

test('gebruikte hop verwijderen geeft 409 met het aantal recepten', async () => {
  const { status, body } = await vraag('DELETE', '/4');
  assert.equal(status, 409);
  assert.match(body.fout, /\d+ recept/);
  assert.equal((await vraag('GET', '/4')).status, 200);
});

test('ongeldige velden geven 400 met het veld in de melding', async () => {
  const gevallen: [unknown, RegExp][] = [
    [{ type: 1 }, /name/],
    [{ name: '   ', type: 1 }, /naam is verplicht/],
    [{ name: 'x'.repeat(101), type: 1 }, /naam mag maximaal 100 tekens/],
    [{ name: 'Hop' }, /type moet 0 \(bloemen\) of 1 \(pellet\) zijn/],
    [{ name: 'Hop', type: 2 }, /type moet 0 \(bloemen\) of 1 \(pellet\) zijn/],
    [{ name: 'Hop', type: 'pellet' }, /type moet 0 \(bloemen\) of 1 \(pellet\) zijn/],
    [{ name: 'Hop', type: 1, alpha_acid_percentage: 31 }, /alpha_acid_percentage moet tussen 0 en 30 %/],
    [{ name: 'Hop', type: 1, alpha_acid_percentage: -1 }, /alpha_acid_percentage moet tussen 0 en 30 %/],
    [{ name: 'Hop', type: 1, alpha_acid_percentage: 'hoog' }, /alpha_acid_percentage moet een getal zijn/],
    [{ name: 'Hop', type: 1, origin: 'x'.repeat(101) }, /herkomst mag maximaal 100 tekens/],
    [{ name: 'Hop', type: 1, naam: 'Nederlands veld' }, /naam/],
  ];
  for (const [body, melding] of gevallen) {
    const antwoord = await vraag('POST', '', body);
    assert.equal(antwoord.status, 400, JSON.stringify(body));
    assert.match(antwoord.body.fout, melding);
  }
  assert.equal((await vraag('PUT', '/2', { name: '', type: 1 })).status, 400);
});

test('onbestaand id geeft 404', async () => {
  assert.equal((await vraag('GET', '/9999')).status, 404);
  assert.equal((await vraag('PUT', '/9999', { name: 'Iets', type: 1 })).status, 404);
  assert.equal((await vraag('DELETE', '/9999')).status, 404);
});
