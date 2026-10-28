import assert from 'node:assert/strict';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { after, before, beforeEach, test } from 'node:test';

// SCRUM-48: vergistingsschema van een recept, op een tijdelijke database met de mockdata uit de migraties.
process.env.DATABASE_FILE = ':memory:';
const { app } = await import('../../app.ts');
const { getMashSchedule } = await import('../../database/recepten/mashSchedule.ts');
const { getFermentationSchedule, replaceFermentationSchedule } = await import('../../database/recepten/fermentationSchedule.ts');

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

async function vraag(methode: string, recipeId: number | string, body?: unknown) {
  const antwoord = await fetch(`${baseUrl}/${recipeId}/fermentation-schedule`, {
    method: methode,
    headers: body === undefined ? {} : { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: antwoord.status, body: await antwoord.json() };
}

// Het voorbeeld uit de opgave: 18 °C 5 dagen, 20 °C 3 dagen, 22 °C 2 dagen.
const voorbeeld = {
  steps: [
    { temperature_c: 18, duration_days: 5 },
    { temperature_c: 20, duration_days: 3 },
    { temperature_c: 22, duration_days: 2 },
  ],
};

// Recept 1 krijgt voor elke test hetzelfde vertrekschema, zodat de tests elkaar niet beïnvloeden.
beforeEach(() => {
  replaceFermentationSchedule(1, { steps: [{ temperature_c: 19, duration_days: 7 }] });
});

test('AC0: PUT slaat het schema op en antwoordt met 200 en het opgeslagen schema', async () => {
  const { status, body } = await vraag('PUT', 1, voorbeeld);
  assert.equal(status, 200);
  assert.deepEqual(body, {
    recipe_id: 1,
    steps: [
      { step_nr: 1, temperature_c: 18, duration_days: 5 },
      { step_nr: 2, temperature_c: 20, duration_days: 3 },
      { step_nr: 3, temperature_c: 22, duration_days: 2 },
    ],
  });
  assert.deepEqual(getFermentationSchedule(1), body);
});

test('AC1: GET geeft de stappen terug in dezelfde volgorde, ook in het volledige recept', async () => {
  await vraag('PUT', 1, { steps: [{ temperature_c: 22, duration_days: 2 }, ...voorbeeld.steps] });
  const { status, body } = await vraag('GET', 1);
  assert.equal(status, 200);
  assert.deepEqual(
    body.steps.map((s: { temperature_c: number; duration_days: number }) => [s.temperature_c, s.duration_days]),
    [[22, 2], [18, 5], [20, 3], [22, 2]],
  );

  const recept = await fetch(`${baseUrl}/1`).then((r) => r.json());
  assert.deepEqual(recept.fermentation_schedule.steps, body.steps);
});

test('AC2: een nieuw schema vervangt het oude volledig', async () => {
  await vraag('PUT', 1, voorbeeld);
  const { body } = await vraag('PUT', 1, { steps: [{ temperature_c: 12, duration_days: 14 }] });
  assert.deepEqual(body.steps, [{ step_nr: 1, temperature_c: 12, duration_days: 14 }]);
  assert.equal(getFermentationSchedule(1)!.steps.length, 1);
});

test('AC3: één ongeldige stap geeft 400 en het vorige schema blijft staan', async () => {
  const voor = getFermentationSchedule(1);
  const { status, body } = await vraag('PUT', 1, {
    steps: [{ temperature_c: 18, duration_days: 5 }, { temperature_c: 40, duration_days: 3 }],
  });
  assert.equal(status, 400);
  assert.deepEqual(Object.keys(body), ['fout']);
  assert.deepEqual(getFermentationSchedule(1), voor);
});

test('AC4: temperatuur of duur buiten de grenzen geeft 400 met de stap en het veld', async () => {
  const gevallen: [unknown, RegExp][] = [
    [{ temperature_c: -1, duration_days: 5 }, /stap 2: temperature_c moet tussen 0 en 30/],
    [{ temperature_c: 31, duration_days: 5 }, /stap 2: temperature_c moet tussen 0 en 30/],
    [{ temperature_c: 18, duration_days: 0 }, /stap 2: duration_days moet tussen 1 en 90/],
    [{ temperature_c: 18, duration_days: 91 }, /stap 2: duration_days moet tussen 1 en 90/],
    [{ temperature_c: 18, duration_days: 2.5 }, /stap 2: duration_days moet een geheel aantal dagen zijn/],
    [{ temperature_c: 'warm', duration_days: 5 }, /stap 2: temperature_c ontbreekt of is geen getal/],
    [{ temperature_c: 18 }, /stap 2: duration_days ontbreekt/],
  ];
  for (const [stap, melding] of gevallen) {
    const { status, body } = await vraag('PUT', 1, { steps: [{ temperature_c: 18, duration_days: 5 }, stap] });
    assert.equal(status, 400, JSON.stringify(stap));
    assert.match(body.fout, melding);
  }
  assert.equal((await vraag('PUT', 1, { steps: [] })).status, 400);
  assert.equal((await vraag('PUT', 1, {})).status, 400);
});

test('AC4: de grenswaarden zelf zijn geldig', async () => {
  const { status } = await vraag('PUT', 1, {
    steps: [{ temperature_c: 0, duration_days: 1 }, { temperature_c: 30, duration_days: 90 }],
  });
  assert.equal(status, 200);
});

test('AC5: het ene schema wijzigen laat het andere ongewijzigd', async () => {
  const maisch = getMashSchedule(1);
  assert.ok(maisch && maisch.steps.length > 0, 'recept 1 heeft een maischschema in de mockdata');
  await vraag('PUT', 1, voorbeeld);
  assert.deepEqual(getMashSchedule(1), maisch);

  // En omgekeerd: het maischschema wijzigen laat het vergistingsschema staan.
  const vergisting = getFermentationSchedule(1);
  const antwoord = await fetch(`${baseUrl}/1/mash-schedule`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ steps: [{ temperature: 66, duration: 60 }] }),
  });
  assert.equal(antwoord.status, 200);
  assert.deepEqual(getFermentationSchedule(1), vergisting);
});

test('AC6: onbestaand recept geeft 404', async () => {
  assert.equal((await vraag('GET', 9999)).status, 404);
  assert.equal((await vraag('PUT', 9999, voorbeeld)).status, 404);
  assert.equal(getFermentationSchedule(9999), undefined);
});
