import assert from 'node:assert/strict';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { after, before, beforeEach, describe, test } from 'node:test';

// Test de acceptatiecriteria van het maischschema via de echte API, op een
// tijdelijke database in het geheugen met de mockdata uit de migraties.
process.env.DATABASE_FILE = ':memory:';
const { app } = await import('../../app.ts');
const { db } = await import('../../database/db.ts');
const { getMashSchedule, replaceMashSchedule } = await import('../../database/recepten/mashSchedule.ts');

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

type ApiResponse = { status: number; body: any };

const validSchedule = {
  steps: [
    { temperature: 63, duration: 45 },
    { temperature: 72, duration: 20 },
  ],
};

async function put(recipeId: number | string, body: unknown): Promise<ApiResponse> {
  const res = await fetch(`${baseUrl}/${recipeId}/maischschema`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: await res.json() };
}

async function get(recipeId: number | string): Promise<ApiResponse> {
  const res = await fetch(`${baseUrl}/${recipeId}/maischschema`);
  return { status: res.status, body: await res.json() };
}

// Controleert de statuscode en het gedeelde foutformaat {"fout": "..."}, en geeft de foutmelding terug.
function errorMessage(response: ApiResponse, status: number): string {
  assert.equal(response.status, status);
  assert.deepEqual(Object.keys(response.body), ['fout']);
  assert.equal(typeof response.body.fout, 'string');
  return response.body.fout;
}

function mashStepRows(recipeId: number) {
  return db
    .prepare('SELECT step_nr, temperature, duration FROM recipe_mash_steps WHERE recipe_id = ? ORDER BY step_nr')
    .all(recipeId)
    .map((row) => ({ ...row }));
}

// Recept 1 krijgt voor elke test hetzelfde vertrekschema, zodat de tests elkaar niet beïnvloeden.
beforeEach(() => {
  replaceMashSchedule(1, validSchedule);
});

describe('AC0: maischschema opslaan', () => {
  test('PUT slaat het schema op bij het recept en antwoordt met 200 en het opgeslagen schema', async () => {
    const response = await put(1, { steps: [{ temperature: 66, duration: 60 }] });

    assert.equal(response.status, 200);
    assert.deepEqual(response.body, {
      recipe_id: 1,
      steps: [{ step_nr: 1, temperature: 66, duration: 60 }],
    });
    assert.deepEqual(getMashSchedule(1), response.body);
  });

  test('een schema zonder stappen wordt geweigerd', async () => {
    assert.match(errorMessage(await put(1, { steps: [] }), 400), /minstens één stap/);
  });
});

describe('AC1: maischschema opvragen', () => {
  test('GET geeft de stappen terug in dezelfde volgorde, met dezelfde temperatuur en duur', async () => {
    const steps = [
      { temperature: 52, duration: 15 },
      { temperature: 63.5, duration: 45 },
      { temperature: 72, duration: 20 },
      { temperature: 78, duration: 5 },
    ];
    await put(1, { steps });

    const response = await get(1);

    assert.equal(response.status, 200);
    assert.deepEqual(
      response.body.steps,
      steps.map((step, i) => ({ step_nr: i + 1, ...step })),
    );
  });

  test('GET op de mockdata van recept 2 geeft het maischschema uit de mockdata', async () => {
    const response = await get(2);

    assert.equal(response.status, 200);
    assert.deepEqual(response.body, {
      recipe_id: 2,
      steps: [
        { step_nr: 1, temperature: 62, duration: 40 },
        { step_nr: 2, temperature: 72, duration: 20 },
        { step_nr: 3, temperature: 78, duration: 5 },
      ],
    });
  });
});

describe('AC2: bestaand schema vervangen', () => {
  test('het nieuwe schema vervangt het oude volledig, zonder achtergebleven stappen', async () => {
    await put(1, {
      steps: [
        { temperature: 50, duration: 10 },
        { temperature: 62, duration: 30 },
        { temperature: 72, duration: 20 },
      ],
    });

    await put(1, { steps: [{ temperature: 67, duration: 60 }] });

    assert.deepEqual(mashStepRows(1), [
      { step_nr: 1, temperature: 67, duration: 60 },
    ]);
  });

  test('het schema van een ander recept wordt niet aangeraakt', async () => {
    const previous = getMashSchedule(3);
    await put(1, { steps: [{ temperature: 67, duration: 60 }] });
    assert.deepEqual(getMashSchedule(3), previous);
  });
});

describe('AC3: alles of niets', () => {
  test('één ongeldige stap geeft 400, er wordt niets opgeslagen en het vorige schema blijft ongewijzigd', async () => {
    const previous = getMashSchedule(1);

    const response = await put(1, {
      steps: [
        { temperature: 50, duration: 10 },
        { temperature: 66, duration: 60 },
        { temperature: 95, duration: 10 },
      ],
    });

    errorMessage(response, 400);
    assert.deepEqual(getMashSchedule(1), previous);
  });

  test('een databasefout halverwege het vervangen wordt volledig teruggedraaid', () => {
    const previous = getMashSchedule(1);
    const secondStepFails = {
      steps: [
        { temperature: 50, duration: 10 },
        { temperature: null as unknown as number, duration: 10 },
      ],
    };

    assert.throws(() => replaceMashSchedule(1, secondStepFails), /NOT NULL/);
    assert.deepEqual(getMashSchedule(1), previous);
  });
});

describe('AC4: temperatuur of duur buiten de grenzen', () => {
  const cases = [
    { field: 'temperature', value: 19.9 },
    { field: 'temperature', value: 80.1 },
    { field: 'duration', value: 0 },
    { field: 'duration', value: 241 },
  ];

  for (const { field, value } of cases) {
    test(`${field} = ${value} geeft 400 met de stap en het veld in de foutmelding`, async () => {
      const previous = getMashSchedule(1);
      const step2 = { temperature: 72, duration: 20, [field]: value };

      const response = await put(1, { steps: [{ temperature: 63, duration: 45 }, step2] });

      const message = errorMessage(response, 400);
      assert.match(message, new RegExp(`steps\\.1\\.${field}: stap 2: ${field}`));
      assert.doesNotMatch(message, /stap 1/);
      assert.deepEqual(getMashSchedule(1), previous);
    });
  }

  test('de grenswaarden zelf zijn toegelaten', async () => {
    const response = await put(1, {
      steps: [
        { temperature: 20, duration: 1 },
        { temperature: 80, duration: 240 },
      ],
    });
    assert.equal(response.status, 200);
  });
});

describe('AC6: onbestaand recept', () => {
  test('PUT op een onbestaand recept geeft 404', async () => {
    assert.match(errorMessage(await put(999, validSchedule), 404), /999/);
  });

  test('GET op een onbestaand recept geeft 404', async () => {
    assert.match(errorMessage(await get(999), 404), /999/);
  });
});
