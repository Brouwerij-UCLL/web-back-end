import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { app } from '../../app.ts';
import { scaleRecipe } from '../../database/recepten/scale.ts';

describe('Recept schalen (GET /api/recipes/:id/scaled)', () => {
  // Hulpfunctie om requests naar je Express-app te sturen
  async function request(path: string) {
    // Tip: als jullie al een request-helper hebben in een ander testbestand, gebruik die dan!
    const server = app.listen(0);
    const port = (server.address() as { port: number }).port;
    try {
      const res = await fetch(`http://127.0.0.1:${port}${path}`);
      const body = await res.json();
      return { status: res.status, body };
    } finally {
      server.close();
    }
  }

  it('AC: schaalt hoeveelheden mee voor 30 liter en behoudt tijden en stappen', async () => {
    // 1. Haal eerst het originele recept op (voor de database-check achteraf)
    const vooraf = await request('/api/recipes/1');
    assert.equal(vooraf.status, 200);

    // 2. Vraag het geschaalde recept op voor 30 liter
    const res = await request('/api/recipes/1/scaled?volume=30');
    assert.equal(res.status, 200);
    assert.equal(res.body.target_volume_l, 30);

    const verwachteFactor = Number((30 / vooraf.body.recept_volume).toFixed(4));
    assert.equal(res.body.scale_factor, verwachteFactor);

    // Controleer of maisch- en vergistingsschema ongewijzigd zijn gebleven
    assert.deepStrictEqual(res.body.mash_schedule, vooraf.body.mash_schedule);
    assert.deepStrictEqual(res.body.fermentation_schedule, vooraf.body.fermentation_schedule);

    // 3. Bewijs dat niets in de database veranderd is
    const achteraf = await request('/api/recipes/1');
    assert.deepStrictEqual(achteraf.body, vooraf.body);
  });

  it('AC: geeft 400 bij ongeldig of ontbrekend volume (0, negatief of boven MAX_VOLUME_LITER)', async () => {
    const ongeldigeUrls = [
      '/api/recipes/1/scaled',
      '/api/recipes/1/scaled?volume=0',
      '/api/recipes/1/scaled?volume=-5',
      '/api/recipes/1/scaled?volume=9999',
    ];

    for (const url of ongeldigeUrls) {
      const res = await request(url);
      assert.equal(res.status, 400, `Verwachtte 400 voor ${url}`);
    }
  });

  it('AC: geeft 404 wanneer het recept niet bestaat', async () => {
    const res = await request('/api/recipes/999999/scaled?volume=30');
    assert.equal(res.status, 404);
  });

  it('Unit test: gedeelde scaleRecipe-functie rekent ingrediënten, hop, extras en water juist uit', () => {
    const dummyRecept = {
      id: 1,
      name: 'Test Tripel',
      beer_style: 'Tripel',
      description: null,
      recept_volume: 20,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
      water: { mash_water_l: 16, sparge_water_l: 12 },
      ingredients: [{ ingredient_id: 1, name: 'Pilsmout', amount_g: 5000 }],
      hops: [{ hop_id: 1, name: 'Saaz', amount_g: 40, boil_time_min: 60 }],
      extras: [{ extra_ingredient_id: 1, name: 'Koriander', amount: 10, unit: 'g', add_moment: 'koken', boil_time_min: 10 }],
      mash_schedule: { steps: [{ step_nr: 1, temperature_c: 63, duration_min: 45 }] },
      fermentation_schedule: { steps: [{ step_nr: 1, temperature_c: 20, duration_days: 14 }] },
    };

    const resultaat = scaleRecipe(dummyRecept as any, 30); // factor 1.5

    assert.equal(resultaat.scale_factor, 1.5);
    assert.equal(resultaat.water?.mash_water_l, 24);
    assert.equal(resultaat.water?.sparge_water_l, 18);
    assert.equal(resultaat.ingredients[0].amount_g, 7500);
    assert.equal(resultaat.hops[0].amount_g, 60);
    assert.equal(resultaat.extras[0].amount, 15);
  });
});
