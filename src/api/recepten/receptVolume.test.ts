import assert from 'node:assert/strict';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { after, before, describe, test } from 'node:test';

// recept_volume: het volume van een recept in liter (migratie 007), verplicht bij POST en PUT.
// Op een tijdelijke database in het geheugen met de mockdata uit de migraties.
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

const aantalRecepten = () => (db.prepare('SELECT count(*) AS n FROM recipes').get() as { n: number }).n;

async function nieuwRecept(recept_volume = 25): Promise<number> {
  const { status, body } = await vraag('POST', '', { name: 'Volumetest', recept_volume });
  assert.equal(status, 201);
  return body.id;
}

describe('opvragen', () => {
  test('bestaande recepten uit de mockdata hebben 20 liter', async () => {
    const { status, body } = await vraag('GET', '');
    assert.equal(status, 200);
    assert.ok(body.length > 0);
    for (const recept of body) assert.equal(recept.recept_volume, 20, recept.name);
  });

  test('het recept en de details tonen recept_volume', async () => {
    const id = await nieuwRecept(18.5);
    for (const pad of [`/${id}`, `/${id}/details`]) {
      const { status, body } = await vraag('GET', pad);
      assert.equal(status, 200, pad);
      assert.equal(body.recept_volume, 18.5, pad);
    }
  });

  test('de lijst toont recept_volume', async () => {
    const id = await nieuwRecept(30);
    const { body } = await vraag('GET', '');
    assert.equal(body.find((r: { id: number }) => r.id === id).recept_volume, 30);
  });
});

describe('opslaan en wijzigen', () => {
  test('POST slaat recept_volume op en geeft het terug', async () => {
    const { status, body } = await vraag('POST', '', { name: 'Volumetest', recept_volume: 25 });
    assert.equal(status, 201);
    assert.equal(body.recept_volume, 25);
    const rij = db.prepare('SELECT recept_volume FROM recipes WHERE recipe_id = ?').get(body.id) as { recept_volume: number };
    assert.equal(rij.recept_volume, 25);
  });

  test('PUT vervangt recept_volume', async () => {
    const id = await nieuwRecept(25);
    const { status, body } = await vraag('PUT', `/${id}`, { name: 'Volumetest', recept_volume: 40 });
    assert.equal(status, 200);
    assert.equal(body.recept_volume, 40);
    assert.equal((await vraag('GET', `/${id}`)).body.recept_volume, 40);
  });

  test('de grenswaarden zijn toegelaten: net boven 0 en 500 liter', async () => {
    for (const volume of [0.1, 500]) {
      const { status, body } = await vraag('POST', '', { name: 'Grens', recept_volume: volume });
      assert.equal(status, 201, String(volume));
      assert.equal(body.recept_volume, volume);
    }
  });
});

describe('ongeldig volume', () => {
  const gevallen: [string, unknown][] = [
    ['zonder volume', undefined],
    ['volume 0', 0],
    ['negatief volume', -3],
    ['volume dat geen getal is', 'veel'],
    ['volume boven 500 liter', 501],
  ];

  for (const [omschrijving, volume] of gevallen) {
    test(`POST ${omschrijving} geeft 400 met recept_volume in de melding, en er wordt niets opgeslagen`, async () => {
      const voor = aantalRecepten();
      const { status, body } = await vraag('POST', '', { name: 'Ongeldig', recept_volume: volume });
      assert.equal(status, 400);
      assert.deepEqual(Object.keys(body), ['fout']);
      assert.match(body.fout, /recept_volume/);
      assert.equal(aantalRecepten(), voor);
    });

    test(`PUT ${omschrijving} geeft 400 en het volume blijft ongewijzigd`, async () => {
      const id = await nieuwRecept(25);
      const { status, body } = await vraag('PUT', `/${id}`, { name: 'Ongeldig', recept_volume: volume });
      assert.equal(status, 400);
      assert.match(body.fout, /recept_volume/);
      assert.equal((await vraag('GET', `/${id}`)).body.recept_volume, 25);
    });
  }
});
