import assert from 'node:assert/strict';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { after, before, test } from 'node:test';

// Controleert de API-documentatie tegen de acceptatiecriteria, op een tijdelijke database in het geheugen.
process.env.DATABASE_FILE = ':memory:';
const { app } = await import('../../app.ts');

type Schema = { example?: unknown; $ref?: string };
type MediaType = { schema: Schema };
type Operation = {
  tags?: string[];
  summary?: string;
  parameters?: { name: string; example?: unknown; schema: Schema }[];
  requestBody?: { content: Record<string, MediaType> };
  responses: Record<string, { description: string; content?: Record<string, MediaType> }>;
};
type OpenApi = {
  openapi: string;
  paths: Record<string, Record<string, Operation>>;
  components: { schemas: Record<string, unknown>; securitySchemes: Record<string, { type: string; scheme: string }> };
};

let server: Server;
let baseUrl: string;
let spec: OpenApi;

before(async () => {
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://localhost:${(server.address() as AddressInfo).port}`;
  spec = (await (await fetch(`${baseUrl}/api/docs/openapi.json`)).json()) as OpenApi;
});

after(() => {
  server.close();
});

function operaties(): [string, string, Operation][] {
  return Object.entries(spec.paths).flatMap(([pad, methodes]) =>
    Object.entries(methodes).map(([methode, operatie]) => [pad, methode, operatie] as [string, string, Operation]),
  );
}

test('Swagger UI is bereikbaar op /api/docs', async () => {
  const antwoord = await fetch(`${baseUrl}/api/docs/`);
  assert.equal(antwoord.status, 200);
  assert.match(await antwoord.text(), /swagger-ui/i);
});

test('de bestanden van Swagger UI worden meegeleverd', async () => {
  // Op Vercel ontbraken deze bestanden; dan krijg je de HTML-pagina terug in plaats van CSS of JavaScript.
  for (const [pad, type] of [['/api/docs/swagger-ui.css', 'text/css'], ['/api/docs/swagger-ui-bundle.js', 'javascript']]) {
    const antwoord = await fetch(baseUrl + pad);
    assert.equal(antwoord.status, 200, `${pad} gaf ${antwoord.status}`);
    assert.match(antwoord.headers.get('content-type') ?? '', new RegExp(type!), `${pad} heeft het verkeerde type`);
  }
});

test('/api/docs/openapi.json is een OpenAPI 3-specificatie', () => {
  assert.match(spec.openapi, /^3\./);
  assert.ok(Object.keys(spec.paths).length > 0, 'geen endpoints gedocumenteerd');
});

test('JWT is gedefinieerd als bearer securityScheme', () => {
  assert.deepEqual(
    { type: spec.components.securitySchemes.bearerAuth?.type, scheme: spec.components.securitySchemes.bearerAuth?.scheme },
    { type: 'http', scheme: 'bearer' },
  );
});

test('elk endpoint is volledig gedocumenteerd', () => {
  const groepen = ['recipes', 'ingredients', 'hops', 'brouwsessies', 'installatie', 'health'];
  for (const [pad, methode, operatie] of operaties()) {
    const naam = `${methode.toUpperCase()} ${pad}`;
    assert.ok(operatie.summary, `${naam}: geen beschrijving`);
    assert.ok(operatie.tags?.length === 1 && groepen.includes(operatie.tags[0]!), `${naam}: geen geldige groep`);

    for (const parameter of operatie.parameters ?? []) {
      assert.notEqual(parameter.example, undefined, `${naam}: parameter ${parameter.name} heeft geen voorbeeld`);
    }
    if (operatie.requestBody) {
      assert.notEqual(operatie.requestBody.content['application/json']?.schema.example, undefined, `${naam}: request body heeft geen voorbeeld`);
    }

    for (const [status, antwoord] of Object.entries(operatie.responses)) {
      if (status === '204') continue; // geen inhoud
      const schema = antwoord.content?.['application/json']?.schema;
      assert.ok(schema, `${naam} ${status}: geen schema`);
      if (Number(status) >= 400) {
        assert.equal(schema.$ref, '#/components/schemas/Fout', `${naam} ${status}: gebruikt het gedeelde foutschema niet`);
      } else {
        assert.notEqual(schema.example, undefined, `${naam} ${status}: geen voorbeeld`);
      }
    }
  }
});

test('"Try it out" met de voorbeeldwaarden geeft het gedocumenteerde antwoord', async () => {
  for (const [pad, methode, operatie] of operaties()) {
    if (methode !== 'get') continue;
    const url = pad.replace(/\{(\w+)\}/g, (_, naam: string) =>
      String(operatie.parameters?.find((parameter) => parameter.name === naam)?.example),
    );
    const antwoord = await fetch(baseUrl + url);
    // Het antwoord wordt in de back-end tegen het schema gecontroleerd; een afwijking zou een 500 geven.
    assert.ok(String(antwoord.status) in operatie.responses, `GET ${url} gaf ${antwoord.status}, wat niet gedocumenteerd is`);
    assert.equal(antwoord.status, 200, `GET ${url} gaf ${antwoord.status}: ${await antwoord.text()}`);
  }
});

test('fouten hebben het formaat {"fout": "..."}', async () => {
  for (const url of ['/api/recipes/99', '/api/recipes/abc', '/bestaat-niet']) {
    const antwoord = await fetch(baseUrl + url);
    const body = (await antwoord.json()) as Record<string, unknown>;
    assert.ok(antwoord.status >= 400, `${url} gaf ${antwoord.status}`);
    assert.deepEqual(Object.keys(body), ['fout'], `${url}: ${JSON.stringify(body)}`);
  }
});
