import assert from 'node:assert/strict';
import { request, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { after, before, test } from 'node:test';

// CORS: de eigen origin (bv. Swagger UI op /api/docs) en de ingestelde front-ends mogen schrijven,
// een onbekende origin krijgt een 403 in plaats van een 500.
process.env.DATABASE_FILE = ':memory:';
delete process.env.CORS_ORIGINS;
const { app } = await import('./app.ts');

let server: Server;
let poort: number;

before(async () => {
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  poort = (server.address() as AddressInfo).port;
});

after(() => {
  server.close();
});

// node:http in plaats van fetch, zodat we de Host-header kunnen kiezen zoals een browser die stuurt.
function vraag(methode: string, pad: string, headers: Record<string, string>, body?: unknown) {
  const data = body === undefined ? undefined : JSON.stringify(body);
  return new Promise<{ status: number; headers: Record<string, unknown>; body: any }>((resolve, reject) => {
    const req = request(
      {
        host: 'localhost',
        port: poort,
        method: methode,
        path: pad,
        headers: { ...headers, ...(data === undefined ? {} : { 'content-type': 'application/json' }) },
      },
      (res) => {
        let tekst = '';
        res.setEncoding('utf8');
        res.on('data', (stuk) => (tekst += stuk));
        res.on('end', () =>
          resolve({ status: res.statusCode!, headers: res.headers, body: tekst ? JSON.parse(tekst) : undefined }),
        );
      },
    );
    req.on('error', reject);
    req.end(data);
  });
}

test('POST vanuit de eigen origin (Swagger UI op localhost:3000) lukt', async () => {
  const { status, body } = await vraag(
    'POST',
    '/api/hops',
    { host: 'localhost:3000', origin: 'http://localhost:3000' },
    { name: 'CORS-hop', type: 0 },
  );
  assert.equal(status, 201);
  assert.equal(body.name, 'CORS-hop');
});

test('een ingestelde front-end krijgt de CORS-headers', async () => {
  const { status, headers } = await vraag('GET', '/api/hops', { origin: 'http://localhost:4200' });
  assert.equal(status, 200);
  assert.equal(headers['access-control-allow-origin'], 'http://localhost:4200');
  assert.equal(headers['access-control-allow-credentials'], 'true');
});

test('een onbekende origin geeft 403 in het gewone foutformaat, geen 500', async () => {
  const post = await vraag('POST', '/api/hops', { origin: 'https://kwaadaardig.example' }, { name: 'Geweigerd', type: 0 });
  assert.equal(post.status, 403);
  assert.deepEqual(post.body, { fout: 'origin https://kwaadaardig.example is niet toegelaten door CORS' });
  assert.equal(post.headers['access-control-allow-origin'], undefined);

  const preflight = await vraag('OPTIONS', '/api/hops', {
    origin: 'https://kwaadaardig.example',
    'access-control-request-method': 'POST',
  });
  assert.equal(preflight.status, 403);

  const lijst = await vraag('GET', '/api/hops?search=Geweigerd', {});
  assert.deepEqual(lijst.body, []);
});

test('zonder Origin-header (curl, server-naar-server) werkt alles zoals voorheen', async () => {
  const { status } = await vraag('GET', '/api/hops', {});
  assert.equal(status, 200);
});
