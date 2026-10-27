import assert from 'node:assert/strict';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { after, before, beforeEach, describe, test } from 'node:test';

// Test de acceptatiecriteria van het maischschema via de echte API, op een
// tijdelijke database in het geheugen met de mockdata uit de migraties.
process.env.DATABASE_FILE = ':memory:';
const { app } = await import('../../app.ts');
const { db } = await import('../../database/db.ts');
const { getMaischschema, vervangMaischschema } = await import('../../database/recepten/maischschema.ts');

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

type Antwoord = { status: number; body: any };

const geldigSchema = {
  kooktijd_minuten: 60,
  stappen: [
    { temperatuur_celsius: 63, duur_minuten: 45 },
    { temperatuur_celsius: 72, duur_minuten: 20 },
  ],
};

async function put(receptId: number | string, body: unknown): Promise<Antwoord> {
  const res = await fetch(`${baseUrl}/${receptId}/maischschema`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: await res.json() };
}

async function get(receptId: number | string): Promise<Antwoord> {
  const res = await fetch(`${baseUrl}/${receptId}/maischschema`);
  return { status: res.status, body: await res.json() };
}

// Controleert de statuscode en het gedeelde foutformaat {"fout": "..."}, en geeft de foutmelding terug.
function foutmelding(antwoord: Antwoord, status: number): string {
  assert.equal(antwoord.status, status);
  assert.deepEqual(Object.keys(antwoord.body), ['fout']);
  assert.equal(typeof antwoord.body.fout, 'string');
  return antwoord.body.fout;
}

// Recept 1 krijgt voor elke test hetzelfde vertrekschema, zodat de tests elkaar niet beïnvloeden.
beforeEach(() => {
  vervangMaischschema(1, geldigSchema);
});

describe('AC0: maischschema opslaan', () => {
  test('PUT slaat het schema op bij het recept en antwoordt met 200 en het opgeslagen schema', async () => {
    const antwoord = await put(1, { kooktijd_minuten: 75, stappen: [{ temperatuur_celsius: 66, duur_minuten: 60 }] });

    assert.equal(antwoord.status, 200);
    assert.deepEqual(antwoord.body, {
      recept_id: 1,
      kooktijd_minuten: 75,
      stappen: [{ stap_volgorde: 1, temperatuur_celsius: 66, duur_minuten: 60 }],
    });
    assert.deepEqual(getMaischschema(1), antwoord.body);
  });

  test('een schema zonder stappen wordt geweigerd', async () => {
    assert.match(foutmelding(await put(1, { kooktijd_minuten: 60, stappen: [] }), 400), /minstens één stap/);
  });
});

describe('AC1: maischschema opvragen', () => {
  test('GET geeft de stappen terug in dezelfde volgorde, met dezelfde temperatuur en duur', async () => {
    const stappen = [
      { temperatuur_celsius: 52, duur_minuten: 15 },
      { temperatuur_celsius: 63.5, duur_minuten: 45 },
      { temperatuur_celsius: 72, duur_minuten: 20 },
      { temperatuur_celsius: 78, duur_minuten: 5 },
    ];
    await put(1, { kooktijd_minuten: 90, stappen });

    const antwoord = await get(1);

    assert.equal(antwoord.status, 200);
    assert.equal(antwoord.body.kooktijd_minuten, 90);
    assert.deepEqual(
      antwoord.body.stappen,
      stappen.map((stap, i) => ({ stap_volgorde: i + 1, ...stap })),
    );
  });

  test('GET op de mockdata van recept 2 geeft het maischschema uit de mockdata', async () => {
    const antwoord = await get(2);

    assert.equal(antwoord.status, 200);
    assert.deepEqual(antwoord.body, {
      recept_id: 2,
      kooktijd_minuten: null,
      stappen: [
        { stap_volgorde: 1, temperatuur_celsius: 62, duur_minuten: 40 },
        { stap_volgorde: 2, temperatuur_celsius: 72, duur_minuten: 20 },
        { stap_volgorde: 3, temperatuur_celsius: 78, duur_minuten: 5 },
      ],
    });
  });
});

describe('AC2: bestaand schema vervangen', () => {
  test('het nieuwe schema vervangt het oude volledig, zonder achtergebleven stappen', async () => {
    await put(1, {
      kooktijd_minuten: 60,
      stappen: [
        { temperatuur_celsius: 50, duur_minuten: 10 },
        { temperatuur_celsius: 62, duur_minuten: 30 },
        { temperatuur_celsius: 72, duur_minuten: 20 },
      ],
    });

    await put(1, { kooktijd_minuten: 45, stappen: [{ temperatuur_celsius: 67, duur_minuten: 60 }] });

    const rijen = db.prepare('SELECT step_nr, temperature, duration FROM recipe_mash_steps WHERE recipe_id = 1').all();
    assert.deepEqual(rijen.map((rij) => ({ ...rij })), [{ step_nr: 1, temperature: 67, duration: 60 }]);
    assert.deepEqual({ ...db.prepare('SELECT boil_time_min FROM recipes WHERE recipe_id = 1').get() }, { boil_time_min: 45 });
  });

  test('het schema van een ander recept wordt niet aangeraakt', async () => {
    const voor = getMaischschema(3);
    await put(1, { kooktijd_minuten: 45, stappen: [{ temperatuur_celsius: 67, duur_minuten: 60 }] });
    assert.deepEqual(getMaischschema(3), voor);
  });
});

describe('AC3: alles of niets', () => {
  test('één ongeldige stap geeft 400, er wordt niets opgeslagen en het vorige schema blijft ongewijzigd', async () => {
    const voor = getMaischschema(1);

    const antwoord = await put(1, {
      kooktijd_minuten: 90,
      stappen: [
        { temperatuur_celsius: 50, duur_minuten: 10 },
        { temperatuur_celsius: 66, duur_minuten: 60 },
        { temperatuur_celsius: 95, duur_minuten: 10 },
      ],
    });

    foutmelding(antwoord, 400);
    assert.deepEqual(getMaischschema(1), voor);
  });

  test('een databasefout halverwege het vervangen wordt volledig teruggedraaid', () => {
    const voor = getMaischschema(1);
    const tweedeStapFaalt = {
      kooktijd_minuten: 90,
      stappen: [
        { temperatuur_celsius: 50, duur_minuten: 10 },
        { temperatuur_celsius: null as unknown as number, duur_minuten: 10 },
      ],
    };

    assert.throws(() => vervangMaischschema(1, tweedeStapFaalt), /NOT NULL/);
    assert.deepEqual(getMaischschema(1), voor);
  });
});

describe('AC4: temperatuur of duur buiten de grenzen', () => {
  const gevallen = [
    { veld: 'temperatuur_celsius', waarde: 19.9, tekst: 'temperatuur' },
    { veld: 'temperatuur_celsius', waarde: 80.1, tekst: 'temperatuur' },
    { veld: 'duur_minuten', waarde: 0, tekst: 'duur' },
    { veld: 'duur_minuten', waarde: 241, tekst: 'duur' },
  ];

  for (const { veld, waarde, tekst } of gevallen) {
    test(`${veld} = ${waarde} geeft 400 met de stap en het veld in de foutmelding`, async () => {
      const voor = getMaischschema(1);
      const stap2 = { temperatuur_celsius: 72, duur_minuten: 20, [veld]: waarde };

      const antwoord = await put(1, { kooktijd_minuten: 60, stappen: [{ temperatuur_celsius: 63, duur_minuten: 45 }, stap2] });

      const melding = foutmelding(antwoord, 400);
      assert.match(melding, new RegExp(`stappen\\.1\\.${veld}: stap 2: ${tekst}`));
      assert.doesNotMatch(melding, /stap 1/);
      assert.deepEqual(getMaischschema(1), voor);
    });
  }

  test('de grenswaarden zelf zijn toegelaten', async () => {
    const antwoord = await put(1, {
      kooktijd_minuten: 60,
      stappen: [
        { temperatuur_celsius: 20, duur_minuten: 1 },
        { temperatuur_celsius: 80, duur_minuten: 240 },
      ],
    });
    assert.equal(antwoord.status, 200);
  });
});

describe('AC5: kooktijd ontbreekt of valt buiten 1–180 minuten', () => {
  for (const [omschrijving, kooktijd] of [
    ['ontbreekt', undefined],
    ['is 0', 0],
    ['is 181', 181],
  ] as const) {
    test(`kooktijd ${omschrijving} geeft 400 en er wordt niets opgeslagen`, async () => {
      const voor = getMaischschema(1);

      const antwoord = await put(1, { kooktijd_minuten: kooktijd, stappen: [{ temperatuur_celsius: 66, duur_minuten: 60 }] });

      assert.match(foutmelding(antwoord, 400), /kooktijd_minuten/);
      assert.deepEqual(getMaischschema(1), voor);
    });
  }

  test('de grenswaarden 1 en 180 zijn toegelaten', async () => {
    for (const kooktijd of [1, 180]) {
      const antwoord = await put(1, { kooktijd_minuten: kooktijd, stappen: [{ temperatuur_celsius: 66, duur_minuten: 60 }] });
      assert.equal(antwoord.status, 200);
      assert.equal(antwoord.body.kooktijd_minuten, kooktijd);
    }
  });
});

describe('AC6: onbestaand recept', () => {
  test('PUT op een onbestaand recept geeft 404', async () => {
    assert.match(foutmelding(await put(999, geldigSchema), 404), /999/);
  });

  test('GET op een onbestaand recept geeft 404', async () => {
    assert.match(foutmelding(await get(999), 404), /999/);
  });
});
