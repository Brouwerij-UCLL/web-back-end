import assert from 'node:assert/strict';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { after, before, test } from 'node:test';

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

test('GET geeft de kookstap van een bestaand recept terug', async () => {
  const response = await fetch(`${baseUrl}/2/boil-time`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { recipe_id: 2, temperature: 100, duration: 90 });
});

test('GET van een niet-bestaand recept geeft 404', async () => {
  const response = await fetch(`${baseUrl}/9999/boil-time`);
  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), { fout: 'recept 9999 niet gevonden' });
});

test('GET van een bestaand recept zonder kookstap geeft 404', async () => {
  const { db } = await import('../../database/db.ts');
  db.prepare('DELETE FROM recipe_boil_time WHERE recipe_id = ?').run(1);

  const response = await fetch(`${baseUrl}/1/boil-time`);
  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), { fout: 'kookstap voor recept 1 niet gevonden' });
});
