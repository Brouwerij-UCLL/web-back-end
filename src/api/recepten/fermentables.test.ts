import assert from 'node:assert/strict';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { after, before, describe, test } from 'node:test';

// Vergistbare ingrediënten (moutstort) van een recept: /api/recipes/{id}/fermentables.
// Body { ingredient_id, amount_g }: het ingrediënt komt uit de catalogus, de hoeveelheid is in gram.
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

// Controleert de statuscode en het gedeelde foutformaat {"fout": "..."}, en geeft de foutmelding terug.
function foutmelding(antwoord: { status: number; body: any }, status: number): string {
  assert.equal(antwoord.status, status);
  assert.deepEqual(Object.keys(antwoord.body), ['fout']);
  return antwoord.body.fout;
}

const aantal = (sql: string, ...waarden: number[]) => (db.prepare(sql).get(...waarden) as { n: number }).n;
const catalogus = () => aantal('SELECT count(*) AS n FROM ingredients');

type Regel = { ingredient_id: number; name: string; manufacturer: string | null; amount_g: number };

// Een eigen recept per test, met ingrediënten uit de catalogus van de mockdata:
// 7 CaraPils (200 g), 1 Pilsner Malt (5500 g) en 3 Wheat Malt (800 g), in die volgorde.
// Vrij in de catalogus: 2 Pale Ale Malt, 4 Flaked Oats, 5 Munich Malt.
async function nieuwRecept(): Promise<number> {
  const { status, body } = await vraag('POST', '', {
    name: 'Moutstort-test',
    base_volume_l: 20,
    ingredients: [
      { ingredient_id: 7, amount_g: 200 },
      { ingredient_id: 1, amount_g: 5500 },
      { ingredient_id: 3, amount_g: 800 },
    ],
  });
  assert.equal(status, 201);
  return body.id;
}

async function lijst(receptId: number): Promise<Regel[]> {
  const { status, body } = await vraag('GET', `/${receptId}/fermentables`);
  assert.equal(status, 200);
  return body;
}

const ids = async (receptId: number) => (await lijst(receptId)).map((f) => f.ingredient_id);

describe('AC0: ingrediënt toevoegen', () => {
  test('POST met een ingrediënt uit de catalogus geeft 201 en het ingrediënt met naam, fabrikant en hoeveelheid', async () => {
    const id = await nieuwRecept();

    const { status, body } = await vraag('POST', `/${id}/fermentables`, { ingredient_id: 2, amount_g: 300 });

    assert.equal(status, 201);
    assert.deepEqual(body, { ingredient_id: 2, name: 'Pale Ale Malt', manufacturer: 'Crisp', amount_g: 300 });
    assert.deepEqual((await lijst(id)).at(-1), body);
  });

  test('vanuit een recept wordt nooit een ingrediënt in de catalogus aangemaakt', async () => {
    const id = await nieuwRecept();
    const voor = catalogus();

    await vraag('POST', `/${id}/fermentables`, { ingredient_id: 4, amount_g: 300 });
    await vraag('POST', `/${id}/fermentables`, { ingredient_id: 9999, amount_g: 300 });

    assert.equal(catalogus(), voor);
  });

  test('een ingrediënt dat niet in de catalogus staat, geeft 400 en er verandert niets', async () => {
    const id = await nieuwRecept();
    const voor = await lijst(id);

    const antwoord = await vraag('POST', `/${id}/fermentables`, { ingredient_id: 9999, amount_g: 300 });

    assert.match(foutmelding(antwoord, 400), /ingrediënt 9999 bestaat niet/);
    assert.deepEqual(await lijst(id), voor);
  });

  test('een ingrediënt dat al in het recept zit, geeft 409 en er verandert niets', async () => {
    const id = await nieuwRecept();
    const voor = await lijst(id);

    const antwoord = await vraag('POST', `/${id}/fermentables`, { ingredient_id: 7, amount_g: 1000 });

    foutmelding(antwoord, 409);
    assert.deepEqual(await lijst(id), voor);
  });
});

describe('AC1: lijst opvragen', () => {
  test('GET geeft alle ingrediënten met naam, fabrikant en hoeveelheid, in de volgorde waarin ze zijn toegevoegd', async () => {
    const id = await nieuwRecept();
    await vraag('POST', `/${id}/fermentables`, { ingredient_id: 4, amount_g: 9000 });

    // Niet gesorteerd op hoeveelheid (Flaked Oats is de grootste) maar in de volgorde van toevoegen.
    assert.deepEqual(await lijst(id), [
      { ingredient_id: 7, name: 'CaraPils', manufacturer: 'Dingemans', amount_g: 200 },
      { ingredient_id: 1, name: 'Pilsner Malt', manufacturer: 'Dingemans', amount_g: 5500 },
      { ingredient_id: 3, name: 'Wheat Malt (Tarwemout)', manufacturer: 'Dingemans', amount_g: 800 },
      { ingredient_id: 4, name: 'Flaked Oats (Havervlokken)', manufacturer: 'Thomas Fawcett', amount_g: 9000 },
    ]);
  });

  test('GET /ingredients geeft hetzelfde formaat, op grootste hoeveelheid eerst', async () => {
    const id = await nieuwRecept();
    await vraag('POST', `/${id}/fermentables`, { ingredient_id: 4, amount_g: 9000 });

    const { status, body } = await vraag('GET', `/${id}/ingredients`);

    assert.equal(status, 200);
    assert.deepEqual(body.map((r: Regel) => r.ingredient_id), [4, 1, 3, 7]);
    assert.deepEqual(
      [...body].sort((a: Regel, b: Regel) => a.ingredient_id - b.ingredient_id),
      [...(await lijst(id))].sort((a, b) => a.ingredient_id - b.ingredient_id),
      'dezelfde ingrediënten, velden en eenheid',
    );
  });

  test('een recept zonder ingrediënten geeft een lege lijst', async () => {
    const { body } = await vraag('POST', '', { name: 'Leeg recept', base_volume_l: 20 });
    assert.deepEqual(await lijst(body.id), []);
  });

  test('één ingrediënt opvragen geeft naam, fabrikant en hoeveelheid', async () => {
    const id = await nieuwRecept();
    const { status, body } = await vraag('GET', `/${id}/fermentables/1`);
    assert.equal(status, 200);
    assert.deepEqual(body, { ingredient_id: 1, name: 'Pilsner Malt', manufacturer: 'Dingemans', amount_g: 5500 });
  });
});

describe('AC2: ingrediënt wijzigen', () => {
  test('PUT met een andere hoeveelheid geeft 200; de andere ingrediënten en de volgorde blijven ongewijzigd', async () => {
    const id = await nieuwRecept();
    const voor = await lijst(id);

    const { status, body } = await vraag('PUT', `/${id}/fermentables/1`, { ingredient_id: 1, amount_g: 6000 });

    assert.equal(status, 200);
    assert.deepEqual(body, { ingredient_id: 1, name: 'Pilsner Malt', manufacturer: 'Dingemans', amount_g: 6000 });
    assert.deepEqual(await lijst(id), voor.map((f) => (f.ingredient_id === 1 ? { ...f, amount_g: 6000 } : f)));
  });

  test('PUT met een ander ingredient_id vervangt het ingrediënt op dezelfde plaats; andere recepten blijven ongewijzigd', async () => {
    const id = await nieuwRecept();
    const ander = await nieuwRecept();
    const anderVoor = await lijst(ander);

    const { status, body } = await vraag('PUT', `/${id}/fermentables/3`, { ingredient_id: 5, amount_g: 700 });

    assert.equal(status, 200);
    assert.deepEqual(body, { ingredient_id: 5, name: 'Munich Malt', manufacturer: 'Weyermann', amount_g: 700 });
    assert.deepEqual(await ids(id), [7, 1, 5], 'op dezelfde plaats in de lijst');
    assert.deepEqual(await lijst(ander), anderVoor);
  });

  test('PUT naar een ingrediënt dat niet in de catalogus staat, geeft 400 en er verandert niets', async () => {
    const id = await nieuwRecept();
    const voor = await lijst(id);

    const antwoord = await vraag('PUT', `/${id}/fermentables/3`, { ingredient_id: 9999, amount_g: 700 });

    assert.match(foutmelding(antwoord, 400), /ingrediënt 9999 bestaat niet/);
    assert.deepEqual(await lijst(id), voor);
  });

  test('PUT naar een ingrediënt dat al in het recept zit, geeft 409 en er verandert niets', async () => {
    const id = await nieuwRecept();
    const voor = await lijst(id);

    const antwoord = await vraag('PUT', `/${id}/fermentables/3`, { ingredient_id: 7, amount_g: 1000 });

    foutmelding(antwoord, 409);
    assert.deepEqual(await lijst(id), voor);
  });
});

describe('AC3: ingrediënt verwijderen', () => {
  test('DELETE geeft 204 en het ingrediënt staat niet meer in de moutstort; de catalogus blijft', async () => {
    const id = await nieuwRecept();
    const voor = catalogus();

    const antwoord = await vraag('DELETE', `/${id}/fermentables/1`);

    assert.equal(antwoord.status, 204);
    assert.equal(antwoord.body, undefined);
    assert.deepEqual(await ids(id), [7, 3]);
    foutmelding(await vraag('GET', `/${id}/fermentables/1`), 404);
    assert.equal(catalogus(), voor, 'Pilsner Malt staat nog in de catalogus');
  });
});

describe('AC4: ongeldig ingrediënt', () => {
  const gevallen: [string, unknown, RegExp][] = [
    ['zonder ingrediënt', { amount_g: 500 }, /ingredient_id/],
    ['met een naam in plaats van een id', { name: 'Pilsner Malt', amount_g: 500 }, /ingredient_id/],
    ['met hoeveelheid 0', { ingredient_id: 4, amount_g: 0 }, /amount_g: hoeveelheid moet groter zijn dan 0 g/],
    ['met een negatieve hoeveelheid', { ingredient_id: 4, amount_g: -2 }, /amount_g: hoeveelheid moet groter zijn dan 0 g/],
    ['met een hoeveelheid die geen getal is', { ingredient_id: 4, amount_g: 'veel' }, /amount_g/],
    ['zonder hoeveelheid', { ingredient_id: 4 }, /amount_g/],
    ['met de hoeveelheid in kg in plaats van gram', { ingredient_id: 4, amount_kg: 1 }, /amount_g/],
  ];

  for (const [omschrijving, body, veld] of gevallen) {
    test(`POST ${omschrijving} geeft 400 met het veld in de foutmelding, en er wordt niets opgeslagen`, async () => {
      const id = await nieuwRecept();
      const [voor, voorCatalogus] = [await lijst(id), catalogus()];

      assert.match(foutmelding(await vraag('POST', `/${id}/fermentables`, body), 400), veld);

      assert.deepEqual(await lijst(id), voor);
      assert.equal(catalogus(), voorCatalogus);
    });

    test(`PUT ${omschrijving} geeft 400 met het veld in de foutmelding, en er wordt niets gewijzigd`, async () => {
      const id = await nieuwRecept();
      const voor = await lijst(id);

      assert.match(foutmelding(await vraag('PUT', `/${id}/fermentables/1`, body), 400), veld);

      assert.deepEqual(await lijst(id), voor);
    });
  }
});

describe('AC5: onbestaand recept of ingrediënt, of ingrediënt van een ander recept', () => {
  const geldig = { ingredient_id: 1, amount_g: 1000 };

  test('een recept dat niet bestaat, geeft 404 bij opvragen, toevoegen, wijzigen en verwijderen, en er verandert niets', async () => {
    const voor = aantal('SELECT count(*) AS n FROM recipe_ingredients');

    for (const [methode, pad, body] of [
      ['GET', '/9999/fermentables'],
      ['GET', '/9999/fermentables/1'],
      ['POST', '/9999/fermentables', geldig],
      ['PUT', '/9999/fermentables/1', geldig],
      ['DELETE', '/9999/fermentables/1'],
    ] as const) {
      assert.match(foutmelding(await vraag(methode, pad, body), 404), /recept 9999/, `${methode} ${pad}`);
    }
    assert.equal(aantal('SELECT count(*) AS n FROM recipe_ingredients'), voor);
  });

  test('een ingrediënt dat niet in het recept zit, geeft 404 bij opvragen, wijzigen en verwijderen', async () => {
    const id = await nieuwRecept();
    const voor = await lijst(id);

    for (const [methode, body] of [['GET'], ['PUT', { ingredient_id: 2, amount_g: 100 }], ['DELETE']] as const) {
      assert.match(foutmelding(await vraag(methode, `/${id}/fermentables/2`, body), 404), /ingrediënt 2 zit niet in recept/, methode);
    }
    assert.deepEqual(await lijst(id), voor);
  });

  test('een ingrediënt van een ander recept geeft 404, en geen van beide recepten verandert', async () => {
    const id = await nieuwRecept();
    const ander = await nieuwRecept();
    await vraag('POST', `/${ander}/fermentables`, { ingredient_id: 4, amount_g: 1000 });
    const [voor, anderVoor] = [await lijst(id), await lijst(ander)];

    for (const [methode, body] of [['GET'], ['PUT', { ingredient_id: 4, amount_g: 2000 }], ['DELETE']] as const) {
      foutmelding(await vraag(methode, `/${id}/fermentables/4`, body), 404);
    }
    assert.deepEqual(await lijst(id), voor);
    assert.deepEqual(await lijst(ander), anderVoor);
  });
});

describe('AC6: recept verwijderen', () => {
  test('de vergistbare ingrediënten van het recept worden mee verwijderd; de catalogus blijft', async () => {
    const id = await nieuwRecept();
    await vraag('POST', `/${id}/fermentables`, { ingredient_id: 4, amount_g: 1000 });
    const voor = catalogus();

    assert.equal((await vraag('DELETE', `/${id}`)).status, 204);

    assert.equal(aantal('SELECT count(*) AS n FROM recipe_ingredients WHERE recipe_id = ?', id), 0);
    foutmelding(await vraag('GET', `/${id}/fermentables`), 404);
    assert.equal(catalogus(), voor);
  });
});
