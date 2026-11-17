import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, test } from 'node:test';

// MAX_VOLUME_LITER: maximale capaciteit van de brouwketel. De instelling wordt bij het opstarten gelezen,
// dus elke test start de back-end in een apart proces met de gewenste omgeving, op een database in het geheugen.

const projectmap = fileURLToPath(new URL('..', import.meta.url));

// Draait in het aparte proces: start de app, probeert de grens uit en print het resultaat als JSON.
const proefScript = `
const { app } = await import('./src/app.ts');
const { config } = await import('./src/config.ts');
const server = app.listen(0);
await new Promise((resolve) => server.once('listening', resolve));
const basis = 'http://localhost:' + server.address().port;

async function vraag(methode, pad, body) {
  const antwoord = await fetch(basis + pad, {
    method: methode,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { status: antwoord.status, fout: (await antwoord.json()).fout ?? null };
}

const max = config.maxVolumeLiter;
const spec = await (await fetch(basis + '/api/docs/openapi.json')).json();
const resultaat = {
  max,
  receptOpGrens: await vraag('POST', '/api/recipes', { name: 'Grens', recept_volume: max }),
  receptBoven: await vraag('POST', '/api/recipes', { name: 'Te groot', recept_volume: max + 1 }),
  receptWaterOpGrens: await vraag('POST', '/api/recipes', {
    name: 'Water op grens', recept_volume: 20, water: { mash_water_l: max, sparge_water_l: max },
  }),
  receptWaterBoven: await vraag('POST', '/api/recipes', {
    name: 'Water te groot', recept_volume: 20, water: { mash_water_l: max + 1, sparge_water_l: 1 },
  }),
  waterOpGrens: await vraag('PUT', '/api/recipes/2/water', { mash_water_l: max, sparge_water_l: max }),
  waterBoven: await vraag('PUT', '/api/recipes/2/water', { mash_water_l: 10, sparge_water_l: max + 1 }),
  swaggerWater: spec.paths['/api/recipes/{id}/water'].put.description,
};
server.close();
console.log('RESULTAAT:' + JSON.stringify(resultaat));
`;

type Uitkomst = { status: number; fout: string | null };
type Resultaat = {
  max: number;
  receptOpGrens: Uitkomst;
  receptBoven: Uitkomst;
  receptWaterOpGrens: Uitkomst;
  receptWaterBoven: Uitkomst;
  waterOpGrens: Uitkomst;
  waterBoven: Uitkomst;
  swaggerWater: string;
};

// Start de back-end met MAX_VOLUME_LITER = waarde (undefined: variabele niet ingesteld).
function startMet(waarde: string | undefined) {
  const env: NodeJS.ProcessEnv = { ...process.env, DATABASE_FILE: ':memory:' };
  delete env.MAX_VOLUME_LITER;
  if (waarde !== undefined) env.MAX_VOLUME_LITER = waarde;
  return spawnSync(process.execPath, ['--input-type=module', '-e', proefScript], {
    cwd: projectmap,
    env,
    encoding: 'utf8',
    timeout: 30_000,
  });
}

function resultaatMet(waarde: string | undefined): Resultaat {
  const proces = startMet(waarde);
  assert.equal(proces.status, 0, `de back-end startte niet:\n${proces.stderr}`);
  const regel = proces.stdout.split(/\r?\n/).find((r) => r.startsWith('RESULTAAT:'));
  assert.ok(regel, `geen resultaat:\n${proces.stdout}`);
  return JSON.parse(regel.slice('RESULTAAT:'.length));
}

// Controleert dat alle volumevalidatie (recept en water) de grens max gebruikt.
function controleerGrens(r: Resultaat, max: number) {
  assert.equal(r.max, max);
  assert.equal(r.receptOpGrens.status, 201, 'recept_volume op de grens');
  assert.equal(r.receptWaterOpGrens.status, 201, 'water in het recept op de grens');
  assert.equal(r.waterOpGrens.status, 200, 'PUT /water op de grens');

  assert.equal(r.receptBoven.status, 400);
  assert.match(r.receptBoven.fout!, new RegExp(`recept_volume: volume mag maximaal ${max} liter zijn`));
  assert.equal(r.receptWaterBoven.status, 400);
  assert.match(r.receptWaterBoven.fout!, new RegExp(`water\\.mash_water_l: maischwater mag maximaal ${max} liter zijn`));
  assert.equal(r.waterBoven.status, 400);
  assert.match(r.waterBoven.fout!, new RegExp(`sparge_water_l mag maximaal ${max} liter zijn`));

  assert.match(r.swaggerWater, new RegExp(`maximaal ${max} liter`), 'Swagger toont de ingestelde grens');
}

// De standaardwaarde zoals ze in src/config.ts staat.
function standaardUitConfig(): number {
  const bron = readFileSync(new URL('./config.ts', import.meta.url), 'utf8');
  const gevonden = bron.match(/const defaultMaxVolumeLiter = (\d+(?:\.\d+)?);/);
  assert.ok(gevonden, 'defaultMaxVolumeLiter staat in src/config.ts');
  return Number(gevonden[1]);
}

describe('AC0: MAX_VOLUME_LITER in .env bepaalt alle volumevalidatie', () => {
  test('met MAX_VOLUME_LITER=50 gelden recept en water tot en met 50 liter', () => {
    controleerGrens(resultaatMet('50'), 50);
  });

  test('met MAX_VOLUME_LITER=1000 gelden recept en water tot en met 1000 liter (geen vaste grens meer in de code)', () => {
    controleerGrens(resultaatMet('1000'), 1000);
  });

  test('een kommagetal zoals 37.5 werkt ook', () => {
    controleerGrens(resultaatMet('37.5'), 37.5);
  });
});

describe('AC1: zonder waarde in .env geldt de standaard uit src/config.ts', () => {
  test('zonder MAX_VOLUME_LITER geldt de standaardwaarde', () => {
    controleerGrens(resultaatMet(undefined), standaardUitConfig());
  });

  test('een lege MAX_VOLUME_LITER geldt als niet ingesteld', () => {
    assert.equal(resultaatMet('  ').max, standaardUitConfig());
  });

  for (const ongeldig of ['0', '-3', 'veel']) {
    test(`MAX_VOLUME_LITER=${ongeldig} laat de back-end niet starten, met een duidelijke melding`, () => {
      const proces = startMet(ongeldig);
      assert.notEqual(proces.status, 0);
      assert.match(proces.stderr, new RegExp(`MAX_VOLUME_LITER moet een getal groter dan 0 zijn \\(gekregen: "${ongeldig}"\\)`));
    });
  }
});

describe('AC2: de variabele is gedocumenteerd', () => {
  test('.env.example bevat MAX_VOLUME_LITER met de standaardwaarde en uitleg', () => {
    const voorbeeld = readFileSync(new URL('../.env.example', import.meta.url), 'utf8');
    const regel = voorbeeld.match(/^MAX_VOLUME_LITER=(.*)$/m);
    assert.ok(regel, 'MAX_VOLUME_LITER staat in .env.example');
    assert.equal(Number(regel[1]), standaardUitConfig(), 'de waarde in .env.example is de standaard uit config.ts');
    assert.match(voorbeeld, /^# .*capaciteit van de brouwketel/m, 'er staat uitleg bij');
  });

  test('de README beschrijft MAX_VOLUME_LITER en de standaardwaarde', () => {
    const readme = readFileSync(new URL('../readme.md', import.meta.url), 'utf8');
    assert.match(readme, /config\.ts .*MAX_VOLUME_LITER/, 'vermeld bij de instellingen van config.ts');
    assert.match(readme, /### Maximale capaciteit van de brouwketel/);
    assert.match(readme, new RegExp(`\`MAX_VOLUME_LITER\`.*standaard \`${standaardUitConfig()}\``), 'de standaardwaarde klopt');
  });
});
