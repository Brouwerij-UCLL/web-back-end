import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { DatabaseSync } from 'node:sqlite';
import { after, before, describe, test } from 'node:test';

// base_volume_l: het basisvolume van een recept in liter (migraties 007 en 010), verplicht bij
// POST en PUT, groter dan 0 en hoogstens MAX_VOLUME_LITER.
// Op een tijdelijke database in het geheugen met de mockdata uit de migraties.
process.env.DATABASE_FILE = ':memory:';
const { app } = await import('../../app.ts');
const { db } = await import('../../database/db.ts');
const { config } = await import('../../config.ts');
const max = config.maxVolumeLiter;

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
const volumeInDatabase = (id: number) =>
  (db.prepare('SELECT base_volume_l FROM recipes WHERE recipe_id = ?').get(id) as { base_volume_l: number }).base_volume_l;

async function nieuwRecept(base_volume_l = 25): Promise<number> {
  const { status, body } = await vraag('POST', '', { name: 'Volumetest', base_volume_l });
  assert.equal(status, 201);
  return body.id;
}

describe('AC0: base_volume_l is verplicht, groter dan 0 en hoogstens MAX_VOLUME_LITER', () => {
  test('POST slaat base_volume_l op en geeft het terug', async () => {
    const { status, body } = await vraag('POST', '', { name: 'Volumetest', base_volume_l: 25 });
    assert.equal(status, 201);
    assert.equal(body.base_volume_l, 25);
    assert.equal(volumeInDatabase(body.id), 25);
  });

  test('PUT vervangt base_volume_l', async () => {
    const id = await nieuwRecept(25);
    const { status, body } = await vraag('PUT', `/${id}`, { name: 'Volumetest', base_volume_l: 40 });
    assert.equal(status, 200);
    assert.equal(body.base_volume_l, 40);
    assert.equal(volumeInDatabase(id), 40);
  });

  test('de grenswaarden zijn toegelaten: net boven 0 en MAX_VOLUME_LITER', async () => {
    for (const volume of [0.1, max]) {
      const { status, body } = await vraag('POST', '', { name: 'Grens', base_volume_l: volume });
      assert.equal(status, 201, String(volume));
      assert.equal(body.base_volume_l, volume);
    }
  });

  const gevallen: [string, unknown][] = [
    ['zonder basisvolume', undefined],
    ['basisvolume 0', 0],
    ['negatief basisvolume', -3],
    ['basisvolume dat geen getal is', 'veel'],
    ['basisvolume boven MAX_VOLUME_LITER', max + 1],
  ];

  for (const [omschrijving, volume] of gevallen) {
    test(`POST ${omschrijving} geeft 400 met base_volume_l in de melding, en er wordt niets opgeslagen`, async () => {
      const voor = aantalRecepten();
      const { status, body } = await vraag('POST', '', { name: 'Ongeldig', base_volume_l: volume });
      assert.equal(status, 400);
      assert.deepEqual(Object.keys(body), ['fout']);
      assert.match(body.fout, /base_volume_l/);
      assert.equal(aantalRecepten(), voor);
    });

    test(`PUT ${omschrijving} geeft 400 en het basisvolume blijft ongewijzigd`, async () => {
      const id = await nieuwRecept(25);
      const { status, body } = await vraag('PUT', `/${id}`, { name: 'Ongeldig', base_volume_l: volume });
      assert.equal(status, 400);
      assert.match(body.fout, /base_volume_l/);
      assert.equal(volumeInDatabase(id), 25);
    });
  }

  test('de melding bij een te groot basisvolume noemt de grens uit MAX_VOLUME_LITER', async () => {
    const { body } = await vraag('POST', '', { name: 'Te groot', base_volume_l: max + 1 });
    assert.match(body.fout, new RegExp(`base_volume_l: basisvolume mag maximaal ${max} liter zijn`));
  });

  test('de oude veldnaam recept_volume wordt niet meer aanvaard', async () => {
    const { status, body } = await vraag('POST', '', { name: 'Oude naam', recept_volume: 20 });
    assert.equal(status, 400);
    assert.match(body.fout, /base_volume_l/);
  });
});

describe('AC1: bestaande recepten hebben na de migratie een basisvolume van 20 l', () => {
  test('alle recepten uit de mockdata hebben 20 liter', () => {
    const rijen = db.prepare('SELECT name, base_volume_l FROM recipes WHERE recipe_id <= 12').all() as {
      name: string;
      base_volume_l: number;
    }[];
    assert.ok(rijen.length > 0);
    for (const rij of rijen) assert.equal(rij.base_volume_l, 20, rij.name);
  });

  test('de tabel recipes heeft base_volume_l (standaard 20) en geen recept_volume meer', () => {
    const kolommen = db.prepare("SELECT name, dflt_value FROM pragma_table_info('recipes')").all() as { name: string; dflt_value: string }[];
    assert.equal(kolommen.find((k) => k.name === 'base_volume_l')?.dflt_value, '20');
    assert.equal(kolommen.some((k) => k.name === 'recept_volume'), false);
  });

  test('migratie 010 houdt een aangepast volume van voor de migratie bij', () => {
    // Eigen database: alle migraties vóór 010, dan een recept aanpassen, dan 010 uitvoeren.
    const map = new URL('../../../migrations/', import.meta.url);
    const bestanden = readdirSync(map).filter((f) => f.endsWith('.sql')).sort();
    const proef = new DatabaseSync(':memory:');
    for (const bestand of bestanden.filter((f) => f < '010')) proef.exec(readFileSync(new URL(bestand, map), 'utf8'));
    proef.prepare('UPDATE recipes SET recept_volume = 37.5 WHERE recipe_id = 3').run();

    proef.exec(readFileSync(new URL('010_base_volume_l.sql', map), 'utf8'));

    const volume = (id: number) => (proef.prepare('SELECT base_volume_l FROM recipes WHERE recipe_id = ?').get(id) as { base_volume_l: number }).base_volume_l;
    assert.equal(volume(3), 37.5);
    assert.equal(volume(1), 20);
    proef.close();
  });
});

describe('AC2: GET /api/recipes/{id} geeft base_volume_l terug', () => {
  test('het recept toont base_volume_l', async () => {
    const id = await nieuwRecept(18.5);
    const { status, body } = await vraag('GET', `/${id}`);
    assert.equal(status, 200);
    assert.equal(body.base_volume_l, 18.5);
    assert.equal('recept_volume' in body, false);
  });

  test('ook de details en de lijst tonen base_volume_l', async () => {
    const id = await nieuwRecept(30);
    assert.equal((await vraag('GET', `/${id}/details`)).body.base_volume_l, 30);
    const { body: lijst } = await vraag('GET', '');
    assert.equal(lijst.find((r: { id: number }) => r.id === id).base_volume_l, 30);
  });

  test('Swagger toont base_volume_l met een voorbeeld', async () => {
    const spec = await (await fetch(baseUrl.replace('/api/recipes', '/api/docs/openapi.json'))).json();
    const voorbeeld = (o: any) => o?.content?.['application/json']?.schema?.example;
    assert.equal(voorbeeld(spec.paths['/api/recipes/{id}'].get.responses['200']).base_volume_l, 20);
    assert.equal(voorbeeld(spec.paths['/api/recipes'].post.requestBody).base_volume_l, 20);
  });
});
