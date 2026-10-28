import assert from 'node:assert/strict';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { after, before, test } from 'node:test';

// SCRUM-56: volledig recept opslaan en vervangen, op een tijdelijke database met de mockdata uit de migraties.
process.env.DATABASE_FILE = ':memory:';
const { app } = await import('../../app.ts');
const { db } = await import('../../database/db.ts');
const { maakRecept } = await import('../../database/recepten/saveRecipe.ts');

let server: Server;
let baseUrl: string;

before(async () => {
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://localhost:${(server.address() as AddressInfo).port}/api/recepten`;
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

const volledigRecept = {
  naam: 'Test Tripel',
  bierstijl: 'Belgische Tripel',
  beschrijving: 'Recept uit de test',
  water: { maischwater_liter: 20, spoelwater_liter: 14 },
  ingredienten: [
    { ingredient_id: 1, hoeveelheid_g: 5500 },
    { ingredient_id: 3, hoeveelheid_g: 800 },
  ],
  hop: [
    { hop_id: 4, hoeveelheid_gram: 35, kooktijd_minuten: 60 },
    { hop_id: 4, hoeveelheid_gram: 20, kooktijd_minuten: 10 },
  ],
  extra: [
    { extra_ingredient_id: 2, hoeveelheid: 500, toevoegmoment: 'koken', kooktijd_minuten: 15 },
    { extra_ingredient_id: 7, hoeveelheid: 50, toevoegmoment: 'beslag' },
  ],
  maischschema: {
    stappen: [
      { temperatuur_celsius: 62, duur_minuten: 40 },
      { temperatuur_celsius: 72, duur_minuten: 20 },
    ],
  },
  vergistingsschema: { stappen: [{ temperatuur_celsius: 20, duur_dagen: 10 }] },
};

test('AC0: een volledig recept opslaan geeft 201 en het volledige recept', async () => {
  const { status, body } = await vraag('POST', '', volledigRecept);
  assert.equal(status, 201);
  assert.ok(Number.isInteger(body.id));
  assert.equal(body.naam, 'Test Tripel');
  assert.deepEqual(body.water, { maischwater_liter: 20, spoelwater_liter: 14 });
  assert.deepEqual(
    body.ingredienten.map((r: { ingredient_id: number; hoeveelheid_g: number }) => [r.ingredient_id, r.hoeveelheid_g]),
    [[1, 5500], [3, 800]],
  );
  assert.equal(body.hop.length, 2, 'dezelfde hop twee keer moet kunnen');
  assert.deepEqual(body.hop.map((h: { kooktijd_minuten: number }) => h.kooktijd_minuten), [60, 10]);
  assert.equal(body.extra.length, 2);
  assert.deepEqual(body.maischschema.stappen.map((s: { stap_volgorde: number }) => s.stap_volgorde), [1, 2]);
  assert.equal(body.vergistingsschema.stappen[0].duur_dagen, 10);
});

test('AC1: PUT vervangt alle onderdelen', async () => {
  const { body: nieuw } = await vraag('POST', '', volledigRecept);
  const { status, body } = await vraag('PUT', `/${nieuw.id}`, {
    naam: 'Test Blond',
    ingredienten: [{ ingredient_id: 2, hoeveelheid_g: 4000 }],
    maischschema: { stappen: [{ temperatuur_celsius: 65, duur_minuten: 60 }] },
  });
  assert.equal(status, 200);
  assert.equal(body.id, nieuw.id);
  assert.equal(body.naam, 'Test Blond');
  assert.equal(body.bierstijl, null);
  assert.equal(body.water, null);
  assert.deepEqual(body.ingredienten.map((r: { ingredient_id: number }) => r.ingredient_id), [2]);
  assert.deepEqual(body.hop, []);
  assert.deepEqual(body.extra, []);
  assert.equal(body.maischschema.stappen.length, 1);
  assert.deepEqual(body.vergistingsschema.stappen, []);
});

test('AC2: een ongeldig onderdeel geeft 400 met alle fouten, en er wordt niets opgeslagen', async () => {
  const voor = aantalRecepten();
  const { status, body } = await vraag('POST', '', {
    ...volledigRecept,
    naam: '',
    maischschema: { stappen: [{ temperatuur_celsius: 62, duur_minuten: 40 }, { temperatuur_celsius: 95, duur_minuten: 20 }] },
    extra: [{ extra_ingredient_id: 2, hoeveelheid: 500, toevoegmoment: 'koken' }],
  });
  assert.equal(status, 400);
  assert.match(body.fout, /naam/);
  assert.match(body.fout, /maischschema\.stappen\.1\.temperatuur_celsius/);
  assert.match(body.fout, /extra\.0\.kooktijd_minuten/);
  assert.equal(aantalRecepten(), voor);
});

test('AC2: onbestaande catalogus-ids en dubbele ingrediënten geven 400', async () => {
  const voor = aantalRecepten();
  const onbestaand = await vraag('POST', '', { ...volledigRecept, ingredienten: [{ ingredient_id: 999, hoeveelheid_g: 100 }], hop: [{ hop_id: 999, hoeveelheid_gram: 10, kooktijd_minuten: 5 }] });
  assert.equal(onbestaand.status, 400);
  assert.match(onbestaand.body.fout, /ingrediënt 999 bestaat niet/);
  assert.match(onbestaand.body.fout, /hop 999 bestaat niet/);

  const dubbel = await vraag('POST', '', { ...volledigRecept, ingredienten: [{ ingredient_id: 1, hoeveelheid_g: 100 }, { ingredient_id: 1, hoeveelheid_g: 200 }] });
  assert.equal(dubbel.status, 400);
  assert.match(dubbel.body.fout, /ingredienten\.1/);

  const onbekendVeld = await vraag('POST', '', { ...volledigRecept, basis_volume_liter: 20 });
  assert.equal(onbekendVeld.status, 400);
  assert.equal(aantalRecepten(), voor);
});

test('transactie: een fout halverwege laat niets achter', () => {
  const voor = aantalRecepten();
  // Hop 999 bestaat niet: de foreign key faalt pas na het recept, het water en de ingrediënten.
  assert.throws(() => maakRecept({
    naam: 'Halverwege mislukt',
    bierstijl: null,
    beschrijving: null,
    water: { maischwater_liter: 10, spoelwater_liter: 5 },
    ingredienten: [{ ingredient_id: 1, hoeveelheid_g: 100 }],
    hop: [{ hop_id: 999, hoeveelheid_gram: 10, kooktijd_minuten: 5 }],
    extra: [],
    maischschema: { stappen: [] },
    vergistingsschema: { stappen: [] },
  }));
  assert.equal(aantalRecepten(), voor);
  assert.equal(db.prepare("SELECT 1 FROM recipes WHERE name = 'Halverwege mislukt'").get(), undefined);
});

test('AC3: GET geeft hetzelfde formaat als het antwoord bij het opslaan', async () => {
  const { body: opgeslagen } = await vraag('POST', '', volledigRecept);
  const { status, body: opgevraagd } = await vraag('GET', `/${opgeslagen.id}`);
  assert.equal(status, 200);
  assert.deepEqual(opgevraagd, opgeslagen);
});

test('AC3: een opgehaald recept kan ongewijzigd teruggestuurd worden met PUT', async () => {
  const { body: recept } = await vraag('GET', '/2');
  const terug = {
    naam: recept.naam,
    bierstijl: recept.bierstijl,
    beschrijving: recept.beschrijving,
    water: recept.water,
    ingredienten: recept.ingredienten.map((r: { ingredient_id: number; hoeveelheid_g: number }) => ({ ingredient_id: r.ingredient_id, hoeveelheid_g: r.hoeveelheid_g })),
    hop: recept.hop.map((h: { hop_id: number; hoeveelheid_gram: number; kooktijd_minuten: number }) => ({ hop_id: h.hop_id, hoeveelheid_gram: h.hoeveelheid_gram, kooktijd_minuten: h.kooktijd_minuten })),
    extra: recept.extra.map((e: { id: number; hoeveelheid: number; toevoegmoment: string; kooktijd_minuten: number | null }) => ({ extra_ingredient_id: e.id, hoeveelheid: e.hoeveelheid, toevoegmoment: e.toevoegmoment, kooktijd_minuten: e.kooktijd_minuten })),
    maischschema: { stappen: recept.maischschema.stappen.map((s: { temperatuur_celsius: number; duur_minuten: number }) => ({ temperatuur_celsius: s.temperatuur_celsius, duur_minuten: s.duur_minuten })) },
    vergistingsschema: { stappen: recept.vergistingsschema.stappen.map((s: { temperatuur_celsius: number; duur_dagen: number }) => ({ temperatuur_celsius: s.temperatuur_celsius, duur_dagen: s.duur_dagen })) },
  };
  const { status, body } = await vraag('PUT', '/2', terug);
  assert.equal(status, 200);
  // Bij PUT worden de hopgiften opnieuw aangemaakt: hun eigen id verandert, de inhoud niet.
  const zonderVluchtigeVelden = ({ gewijzigd_op: _, hop, ...rest }: { gewijzigd_op: string; hop: { id: number }[] }) => ({
    ...rest,
    hop: hop.map(({ id: _id, ...gift }) => gift),
  });
  assert.deepEqual(zonderVluchtigeVelden(body), zonderVluchtigeVelden(recept));
});

test('AC4: PUT op een onbestaand recept geeft 404 en verandert niets', async () => {
  const voor = aantalRecepten();
  const { status } = await vraag('PUT', '/9999', volledigRecept);
  assert.equal(status, 404);
  assert.equal(aantalRecepten(), voor);
});
