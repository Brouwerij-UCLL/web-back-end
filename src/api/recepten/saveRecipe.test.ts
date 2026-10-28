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
  name: 'Test Tripel',
  beer_style: 'Belgische Tripel',
  description: 'Recept uit de test',
  water: { mash_water_l: 20, sparge_water_l: 14 },
  ingredients: [
    { ingredient_id: 1, amount_g: 5500 },
    { ingredient_id: 3, amount_g: 800 },
  ],
  hops: [
    { hop_id: 4, amount_g: 35, boil_time_min: 60 },
    { hop_id: 4, amount_g: 20, boil_time_min: 10 },
  ],
  extras: [
    { extra_ingredient_id: 2, amount: 500, add_moment: 'koken', boil_time_min: 15 },
    { extra_ingredient_id: 7, amount: 50, add_moment: 'beslag' },
  ],
  mash_schedule: {
    steps: [
      { temperature_c: 62, duration_min: 40 },
      { temperature_c: 72, duration_min: 20 },
    ],
  },
  fermentation_schedule: { steps: [{ temperature_c: 20, duration_days: 10 }] },
};

test('AC0: een volledig recept opslaan geeft 201 en het volledige recept', async () => {
  const { status, body } = await vraag('POST', '', volledigRecept);
  assert.equal(status, 201);
  assert.ok(Number.isInteger(body.id));
  assert.equal(body.name, 'Test Tripel');
  assert.deepEqual(body.water, { mash_water_l: 20, sparge_water_l: 14 });
  assert.deepEqual(
    body.ingredients.map((r: { ingredient_id: number; amount_g: number }) => [r.ingredient_id, r.amount_g]),
    [[1, 5500], [3, 800]],
  );
  assert.equal(body.hops.length, 2, 'dezelfde hop twee keer moet kunnen');
  assert.deepEqual(body.hops.map((h: { boil_time_min: number }) => h.boil_time_min), [60, 10]);
  assert.equal(body.extras.length, 2);
  assert.deepEqual(body.mash_schedule.steps.map((s: { step_nr: number }) => s.step_nr), [1, 2]);
  assert.equal(body.fermentation_schedule.steps[0].duration_days, 10);
});

test('AC1: PUT vervangt alle onderdelen', async () => {
  const { body: nieuw } = await vraag('POST', '', volledigRecept);
  const { status, body } = await vraag('PUT', `/${nieuw.id}`, {
    name: 'Test Blond',
    ingredients: [{ ingredient_id: 2, amount_g: 4000 }],
    mash_schedule: { steps: [{ temperature_c: 65, duration_min: 60 }] },
  });
  assert.equal(status, 200);
  assert.equal(body.id, nieuw.id);
  assert.equal(body.name, 'Test Blond');
  assert.equal(body.beer_style, null);
  assert.equal(body.water, null);
  assert.deepEqual(body.ingredients.map((r: { ingredient_id: number }) => r.ingredient_id), [2]);
  assert.deepEqual(body.hops, []);
  assert.deepEqual(body.extras, []);
  assert.equal(body.mash_schedule.steps.length, 1);
  assert.deepEqual(body.fermentation_schedule.steps, []);
});

test('AC2: een ongeldig onderdeel geeft 400 met alle fouten, en er wordt niets opgeslagen', async () => {
  const voor = aantalRecepten();
  const { status, body } = await vraag('POST', '', {
    ...volledigRecept,
    name: '',
    mash_schedule: { steps: [{ temperature_c: 62, duration_min: 40 }, { temperature_c: 95, duration_min: 20 }] },
    extras: [{ extra_ingredient_id: 2, amount: 500, add_moment: 'koken' }],
  });
  assert.equal(status, 400);
  assert.match(body.fout, /name/);
  assert.match(body.fout, /mash_schedule\.steps\.1\.temperature_c/);
  assert.match(body.fout, /extras\.0\.boil_time_min/);
  assert.equal(aantalRecepten(), voor);
});

test('AC2: onbestaande catalogus-ids, dubbele ingrediënten en onbekende velden geven 400', async () => {
  const voor = aantalRecepten();
  const onbestaand = await vraag('POST', '', {
    ...volledigRecept,
    ingredients: [{ ingredient_id: 999, amount_g: 100 }],
    hops: [{ hop_id: 999, amount_g: 10, boil_time_min: 5 }],
  });
  assert.equal(onbestaand.status, 400);
  assert.match(onbestaand.body.fout, /ingrediënt 999 bestaat niet/);
  assert.match(onbestaand.body.fout, /hop 999 bestaat niet/);

  const dubbel = await vraag('POST', '', {
    ...volledigRecept,
    ingredients: [{ ingredient_id: 1, amount_g: 100 }, { ingredient_id: 1, amount_g: 200 }],
  });
  assert.equal(dubbel.status, 400);
  assert.match(dubbel.body.fout, /ingredients\.1/);

  const onbekendVeld = await vraag('POST', '', { ...volledigRecept, naam: 'Nederlands veld' });
  assert.equal(onbekendVeld.status, 400);
  assert.equal(aantalRecepten(), voor);
});

test('transactie: een fout halverwege laat niets achter', () => {
  const voor = aantalRecepten();
  // Hop 999 bestaat niet: de foreign key faalt pas na het recept, het water en de ingrediënten.
  assert.throws(() =>
    maakRecept({
      name: 'Halverwege mislukt',
      beer_style: null,
      description: null,
      water: { mash_water_l: 10, sparge_water_l: 5 },
      ingredients: [{ ingredient_id: 1, amount_g: 100 }],
      hops: [{ hop_id: 999, amount_g: 10, boil_time_min: 5 }],
      extras: [],
      mash_schedule: { steps: [] },
      fermentation_schedule: { steps: [] },
    }),
  );
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
    name: recept.name,
    beer_style: recept.beer_style,
    description: recept.description,
    water: recept.water,
    ingredients: recept.ingredients.map((r: { ingredient_id: number; amount_g: number }) => ({
      ingredient_id: r.ingredient_id,
      amount_g: r.amount_g,
    })),
    hops: recept.hops.map((h: { hop_id: number; amount_g: number; boil_time_min: number }) => ({
      hop_id: h.hop_id,
      amount_g: h.amount_g,
      boil_time_min: h.boil_time_min,
    })),
    extras: recept.extras.map(
      (e: { extra_ingredient_id: number; amount: number; add_moment: string; boil_time_min: number | null }) => ({
        extra_ingredient_id: e.extra_ingredient_id,
        amount: e.amount,
        add_moment: e.add_moment,
        boil_time_min: e.boil_time_min,
      }),
    ),
    mash_schedule: {
      steps: recept.mash_schedule.steps.map((s: { temperature_c: number; duration_min: number }) => ({
        temperature_c: s.temperature_c,
        duration_min: s.duration_min,
      })),
    },
    fermentation_schedule: {
      steps: recept.fermentation_schedule.steps.map((s: { temperature_c: number; duration_days: number }) => ({
        temperature_c: s.temperature_c,
        duration_days: s.duration_days,
      })),
    },
  };
  const { status, body } = await vraag('PUT', '/2', terug);
  assert.equal(status, 200);
  // Bij PUT worden de hopgiften opnieuw aangemaakt: hun eigen id verandert, de inhoud niet.
  const zonderVluchtigeVelden = ({ updated_at: _, hops, ...rest }: { updated_at: string; hops: { id: number }[] }) => ({
    ...rest,
    hops: hops.map(({ id: _id, ...gift }) => gift),
  });
  assert.deepEqual(zonderVluchtigeVelden(body), zonderVluchtigeVelden(recept));
});

test('AC4: PUT op een onbestaand recept geeft 404 en verandert niets', async () => {
  const voor = aantalRecepten();
  const { status } = await vraag('PUT', '/9999', volledigRecept);
  assert.equal(status, 404);
  assert.equal(aantalRecepten(), voor);
});
