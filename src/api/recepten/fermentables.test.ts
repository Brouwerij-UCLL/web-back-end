import assert from 'node:assert/strict';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { after, before, describe, test } from 'node:test';

// Vergistbare ingrediënten (moutstort) van een recept: /api/recipes/{id}/fermentables.
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

// Een eigen recept per test, met ingrediënten uit de catalogus van de mockdata:
// 7 CaraPils (0.2 kg), 1 Pilsner Malt (5.5 kg) en 3 Wheat Malt (0.8 kg), in die volgorde.
async function nieuwRecept(): Promise<number> {
  const { status, body } = await vraag('POST', '', {
    name: 'Moutstort-test',
    ingredients: [
      { ingredient_id: 7, amount_g: 200 },
      { ingredient_id: 1, amount_g: 5500 },
      { ingredient_id: 3, amount_g: 800 },
    ],
  });
  assert.equal(status, 201);
  return body.id;
}

async function lijst(receptId: number) {
  const { status, body } = await vraag('GET', `/${receptId}/fermentables`);
  assert.equal(status, 200);
  return body as { ingredient_id: number; name: string; manufacturer: string | null; amount_kg: number }[];
}

const ids = async (receptId: number) => (await lijst(receptId)).map((f) => f.ingredient_id);

describe('AC0: ingrediënt toevoegen', () => {
  test('POST met een nieuwe naam geeft 201 en het ingrediënt met een nieuw id', async () => {
    const id = await nieuwRecept();
    const voor = catalogus();

    const { status, body } = await vraag('POST', `/${id}/fermentables`, { name: 'Haver', manufacturer: 'Weyermann', amount_kg: 0.3 });

    assert.equal(status, 201);
    assert.ok(Number.isInteger(body.ingredient_id));
    assert.deepEqual(body, { ingredient_id: body.ingredient_id, name: 'Haver', manufacturer: 'Weyermann', amount_kg: 0.3 });
    assert.equal(catalogus(), voor + 1, 'het ingrediënt is aan de catalogus toegevoegd');
    assert.deepEqual((await lijst(id)).at(-1), body);
  });

  test('de fabrikant is optioneel', async () => {
    const id = await nieuwRecept();
    const { status, body } = await vraag('POST', `/${id}/fermentables`, { name: 'Rijstvlokken', amount_kg: 0.5 });
    assert.equal(status, 201);
    assert.equal(body.manufacturer, null);
  });

  test('een ingrediënt dat al in de catalogus staat, wordt hergebruikt (hoofdletters niet meegerekend)', async () => {
    const id = await nieuwRecept();
    const voor = catalogus();

    const { status, body } = await vraag('POST', `/${id}/fermentables`, { name: 'pale ale malt', manufacturer: 'CRISP', amount_kg: 1.1 });

    assert.equal(status, 201);
    assert.deepEqual(body, { ingredient_id: 2, name: 'Pale Ale Malt', manufacturer: 'Crisp', amount_kg: 1.1 });
    assert.equal(catalogus(), voor, 'geen dubbel ingrediënt in de catalogus');
  });

  test('een ingrediënt dat al in het recept zit, geeft 409 en er verandert niets', async () => {
    const id = await nieuwRecept();
    const voor = await lijst(id);

    const antwoord = await vraag('POST', `/${id}/fermentables`, { name: 'CaraPils', manufacturer: 'Dingemans', amount_kg: 1 });

    foutmelding(antwoord, 409);
    assert.deepEqual(await lijst(id), voor);
  });
});

describe('AC1: lijst opvragen', () => {
  test('GET geeft alle ingrediënten met naam, fabrikant en hoeveelheid, in de volgorde waarin ze zijn toegevoegd', async () => {
    const id = await nieuwRecept();
    await vraag('POST', `/${id}/fermentables`, { name: 'Haver', amount_kg: 9 });

    // Niet gesorteerd op hoeveelheid (Haver is de grootste) maar in de volgorde van toevoegen.
    assert.deepEqual(await lijst(id), [
      { ingredient_id: 7, name: 'CaraPils', manufacturer: 'Dingemans', amount_kg: 0.2 },
      { ingredient_id: 1, name: 'Pilsner Malt', manufacturer: 'Dingemans', amount_kg: 5.5 },
      { ingredient_id: 3, name: 'Wheat Malt (Tarwemout)', manufacturer: 'Dingemans', amount_kg: 0.8 },
      { ingredient_id: (await lijst(id))[3]!.ingredient_id, name: 'Haver', manufacturer: null, amount_kg: 9 },
    ]);
  });

  test('GET /ingredients geeft dezelfde volgorde', async () => {
    const id = await nieuwRecept();
    const { body } = await vraag('GET', `/${id}/ingredients`);
    assert.deepEqual(body.map((r: { ingredient_id: number }) => r.ingredient_id), [7, 1, 3]);
  });

  test('een recept zonder ingrediënten geeft een lege lijst', async () => {
    const { body } = await vraag('POST', '', { name: 'Leeg recept' });
    assert.deepEqual(await lijst(body.id), []);
  });

  test('één ingrediënt opvragen geeft naam, fabrikant en hoeveelheid', async () => {
    const id = await nieuwRecept();
    const { status, body } = await vraag('GET', `/${id}/fermentables/1`);
    assert.equal(status, 200);
    assert.deepEqual(body, { ingredient_id: 1, name: 'Pilsner Malt', manufacturer: 'Dingemans', amount_kg: 5.5 });
  });
});

describe('AC2: ingrediënt wijzigen', () => {
  test('PUT met een andere hoeveelheid geeft 200; de andere ingrediënten en de volgorde blijven ongewijzigd', async () => {
    const id = await nieuwRecept();
    const voor = await lijst(id);

    const { status, body } = await vraag('PUT', `/${id}/fermentables/1`, { name: 'Pilsner Malt', manufacturer: 'Dingemans', amount_kg: 6 });

    assert.equal(status, 200);
    assert.deepEqual(body, { ingredient_id: 1, name: 'Pilsner Malt', manufacturer: 'Dingemans', amount_kg: 6 });
    assert.deepEqual(await lijst(id), voor.map((f) => (f.ingredient_id === 1 ? { ...f, amount_kg: 6 } : f)));
  });

  test('PUT met een andere naam verwijst naar dat ingrediënt; de catalogus en andere recepten blijven ongewijzigd', async () => {
    const id = await nieuwRecept();
    const ander = await nieuwRecept();
    const anderVoor = await lijst(ander);

    const { status, body } = await vraag('PUT', `/${id}/fermentables/3`, { name: 'Spelt', manufacturer: 'Weyermann', amount_kg: 0.4 });

    assert.equal(status, 200);
    assert.equal(body.name, 'Spelt');
    assert.notEqual(body.ingredient_id, 3);
    assert.deepEqual(await ids(id), [7, 1, body.ingredient_id], 'op dezelfde plaats in de lijst');
    assert.deepEqual(await lijst(ander), anderVoor);
    const tarwemout = db.prepare('SELECT name FROM ingredients WHERE ingredient_id = 3').get() as { name: string };
    assert.equal(tarwemout.name, 'Wheat Malt (Tarwemout)');
  });

  test('PUT naar een ingrediënt dat al in het recept zit, geeft 409 en er verandert niets', async () => {
    const id = await nieuwRecept();
    const voor = await lijst(id);

    const antwoord = await vraag('PUT', `/${id}/fermentables/3`, { name: 'CaraPils', manufacturer: 'Dingemans', amount_kg: 1 });

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
    ['zonder naam', { amount_kg: 1 }, /name: naam is verplicht/],
    ['met een lege naam', { name: '   ', amount_kg: 1 }, /name: naam is verplicht/],
    ['met hoeveelheid 0', { name: 'Rogge', amount_kg: 0 }, /amount_kg: /],
    ['met een negatieve hoeveelheid', { name: 'Rogge', amount_kg: -2 }, /amount_kg: /],
    ['met een hoeveelheid die geen getal is', { name: 'Rogge', amount_kg: 'veel' }, /amount_kg: /],
    ['zonder hoeveelheid', { name: 'Rogge' }, /amount_kg: /],
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
      const [voor, voorCatalogus] = [await lijst(id), catalogus()];

      assert.match(foutmelding(await vraag('PUT', `/${id}/fermentables/1`, body), 400), veld);

      assert.deepEqual(await lijst(id), voor);
      assert.equal(catalogus(), voorCatalogus);
    });
  }
});

describe('AC5: onbestaand recept of ingrediënt, of ingrediënt van een ander recept', () => {
  const geldig = { name: 'Pilsner Malt', manufacturer: 'Dingemans', amount_kg: 1 };

  test('een recept dat niet bestaat, geeft 404 bij opvragen, toevoegen, wijzigen en verwijderen, en er verandert niets', async () => {
    const [voorRegels, voorCatalogus] = [aantal('SELECT count(*) AS n FROM recipe_ingredients'), catalogus()];

    for (const [methode, pad, body] of [
      ['GET', '/9999/fermentables'],
      ['GET', '/9999/fermentables/1'],
      ['POST', '/9999/fermentables', { name: 'Nieuw ingrediënt', amount_kg: 1 }],
      ['PUT', '/9999/fermentables/1', geldig],
      ['DELETE', '/9999/fermentables/1'],
    ] as const) {
      assert.match(foutmelding(await vraag(methode, pad, body), 404), /recept 9999/, `${methode} ${pad}`);
    }
    assert.equal(aantal('SELECT count(*) AS n FROM recipe_ingredients'), voorRegels);
    assert.equal(catalogus(), voorCatalogus, 'geen nieuw catalogus-ingrediënt bij een onbestaand recept');
  });

  test('een ingrediënt dat niet bestaat, geeft 404 bij opvragen, wijzigen en verwijderen', async () => {
    const id = await nieuwRecept();
    const voor = await lijst(id);

    for (const [methode, body] of [['GET'], ['PUT', geldig], ['DELETE']] as const) {
      assert.match(foutmelding(await vraag(methode, `/${id}/fermentables/9999`, body), 404), /9999/, methode);
    }
    assert.deepEqual(await lijst(id), voor);
  });

  test('een ingrediënt van een ander recept geeft 404, en geen van beide recepten verandert', async () => {
    const id = await nieuwRecept();
    const ander = await nieuwRecept();
    const { body: haver } = await vraag('POST', `/${ander}/fermentables`, { name: 'Haver', amount_kg: 1 });
    const [voor, anderVoor] = [await lijst(id), await lijst(ander)];

    for (const [methode, body] of [['GET'], ['PUT', { name: 'Haver', amount_kg: 2 }], ['DELETE']] as const) {
      foutmelding(await vraag(methode, `/${id}/fermentables/${haver.ingredient_id}`, body), 404);
    }
    assert.deepEqual(await lijst(id), voor);
    assert.deepEqual(await lijst(ander), anderVoor);
  });
});

describe('AC6: recept verwijderen', () => {
  test('de vergistbare ingrediënten van het recept worden mee verwijderd; de catalogus blijft', async () => {
    const id = await nieuwRecept();
    await vraag('POST', `/${id}/fermentables`, { name: 'Haver', amount_kg: 1 });
    const voor = catalogus();

    assert.equal((await vraag('DELETE', `/${id}`)).status, 204);

    assert.equal(aantal('SELECT count(*) AS n FROM recipe_ingredients WHERE recipe_id = ?', id), 0);
    foutmelding(await vraag('GET', `/${id}/fermentables`), 404);
    assert.equal(catalogus(), voor);
  });
});
