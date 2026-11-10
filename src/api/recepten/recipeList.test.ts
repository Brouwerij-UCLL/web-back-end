import assert from 'node:assert/strict';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { after, before, test } from 'node:test';

// Lijst van recepten met ?orderBy, op een tijdelijke database met de mockdata uit de migraties.
process.env.DATABASE_FILE = ':memory:';
const { app } = await import('../../app.ts');

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

async function namen(query = '') {
  const antwoord = await fetch(baseUrl + query);
  assert.equal(antwoord.status, 200);
  return ((await antwoord.json()) as { name: string }[]).map((recept) => recept.name);
}

const alfabetisch = (lijst: string[]) => [...lijst].sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' }));

test('zonder orderBy: van A tot Z', async () => {
  const lijst = await namen();
  assert.ok(lijst.length > 1);
  assert.deepEqual(lijst, alfabetisch(lijst));
  assert.deepEqual(await namen('?orderBy=asc'), lijst);
});

test('orderBy=desc: van Z tot A, dezelfde recepten', async () => {
  const oplopend = await namen();
  assert.deepEqual(await namen('?orderBy=desc'), [...oplopend].reverse());
});

test('een ongeldige orderBy geeft 400', async () => {
  const antwoord = await fetch(`${baseUrl}?orderBy=random`);
  assert.equal(antwoord.status, 400);
  assert.match((await antwoord.json()).fout, /orderBy/);
});
