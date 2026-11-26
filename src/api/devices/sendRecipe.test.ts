import assert from 'node:assert/strict';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { after, before, beforeEach, test } from 'node:test';

process.env.DATABASE_FILE = ':memory:';

const { app } = await import('../../app.ts');
const { handleMessage } = await import('../../mqtt/handlers.ts');
const { setPublisher } = await import('../../mqtt/opdrachten.ts');
const { getRecept } = await import('../../database/recepten/queries.ts');

let server: Server;
let baseUrl: string;

before(async () => {
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://localhost:${(server.address() as AddressInfo).port}/api/devices`;
});

after(() => {
  setPublisher(undefined);
  server.close();
});

const ketel = 'a4cf12b3c8e0';
const vergister = 'b8d61a2f04c1';

function meldAan(mac: string, type: string, commands: string[]) {
  handleMessage(`brouwer/${mac}/info`, JSON.stringify({ type, commands }));
  handleMessage(`brouwer/${mac}/status`, 'online');
}
meldAan(ketel, 'ketel', ['setpoint', 'recept']);
meldAan(vergister, 'kast', ['recept']);

type Bericht = { topic: string; payload: { message_id: string; data: { id: number; mash_schedule: unknown } }; qos: number };
let verstuurd: Bericht[];
// Antwoord van het nep-toestel op elke opdracht: een ack-payload, of null voor geen antwoord.
let antwoord: (message_id: string) => object | null;

beforeEach(() => {
  verstuurd = [];
  antwoord = (message_id) => ({ message_id, ok: true });
  setPublisher(async (topic, payload, qos) => {
    const bericht = { topic, payload: JSON.parse(payload), qos } as Bericht;
    verstuurd.push(bericht);
    const mac = topic.split('/')[1];
    const ack = antwoord(bericht.payload.message_id);
    if (ack) setImmediate(() => handleMessage(`brouwer/${mac}/ack`, JSON.stringify(ack)));
  });
});

async function stuur(mac: string, body: unknown) {
  const res = await fetch(`${baseUrl}/${mac}/recipe`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: await res.json() };
}

test('het volledige recept gaat met QoS 2 naar het gekozen toestel en wacht op de ack', async () => {
  const { status, body } = await stuur(ketel, { recipe_id: 1 });
  assert.equal(status, 200);
  assert.equal(verstuurd.length, 1);
  const [bericht] = verstuurd;
  assert.equal(bericht.topic, `brouwer/${ketel}/cmd/recept`);
  assert.equal(bericht.qos, 2);
  assert.deepEqual(bericht.payload.data, JSON.parse(JSON.stringify(getRecept(1))));
  assert.ok(bericht.payload.data.mash_schedule);
  assert.deepEqual(body, { mac: ketel, recipe_id: 1, message_id: bericht.payload.message_id, ok: true });
});

test('het MAC-adres bepaalt voor wie het recept is', async () => {
  await stuur(vergister, { recipe_id: 1 });
  assert.equal(verstuurd[0].topic, `brouwer/${vergister}/cmd/recept`);
});

test('een ack van een ander toestel telt niet', async () => {
  antwoord = () => null;
  setPublisher(async (topic, payload) => {
    const { message_id } = JSON.parse(payload);
    verstuurd.push({ topic, payload: JSON.parse(payload), qos: 2 });
    setImmediate(() => {
      handleMessage(`brouwer/${vergister}/ack`, JSON.stringify({ message_id, ok: true })); // verkeerd toestel
      handleMessage(`brouwer/${ketel}/ack`, JSON.stringify({ message_id, ok: false, fout: 'geheugen vol' }));
    });
  });
  const { status, body } = await stuur(ketel, { recipe_id: 1 });
  assert.equal(status, 502);
  assert.match(body.fout, /geheugen vol/);
});

test('ok=false van het toestel geeft 502 met de fout', async () => {
  antwoord = (message_id) => ({ message_id, ok: false, fout: 'recept te groot voor het geheugen' });
  const { status, body } = await stuur(ketel, { recipe_id: 1 });
  assert.equal(status, 502);
  assert.match(body.fout, /recept te groot/);
});

test('offline toestel, onbekende opdracht, onbekend toestel of recept: niets verstuurd', async () => {
  handleMessage('brouwer/c0ffee000001/info', JSON.stringify({ type: 'sensor', commands: ['setpoint'] }));
  handleMessage('brouwer/c0ffee000001/status', 'online');
  assert.equal((await stuur('c0ffee000001', { recipe_id: 1 })).status, 409);

  handleMessage(`brouwer/${vergister}/status`, 'offline');
  const offline = await stuur(vergister, { recipe_id: 1 });
  assert.equal(offline.status, 409);
  assert.match(offline.body.fout, /offline/);
  handleMessage(`brouwer/${vergister}/status`, 'online');

  assert.equal((await stuur('ffffffffffff', { recipe_id: 1 })).status, 404);
  assert.equal((await stuur(ketel, { recipe_id: 99999 })).status, 404);
  assert.equal((await stuur(ketel, {})).status, 400);
  assert.equal(verstuurd.length, 0);
});

test('zonder verbinding met de broker: 503', async () => {
  setPublisher(undefined);
  assert.equal((await stuur(ketel, { recipe_id: 1 })).status, 503);
});

test('zonder ack binnen de tijd: AckTimeoutFout, en een late ack wordt genegeerd', async () => {
  const { stuurOpdracht, AckTimeoutFout } = await import('../../mqtt/opdrachten.ts');
  antwoord = () => null;
  await assert.rejects(stuurOpdracht(ketel, 'recept', {}, { qos: 2, timeoutMs: 50 }), AckTimeoutFout);
  handleMessage(`brouwer/${ketel}/ack`, JSON.stringify({ message_id: verstuurd[0].payload.message_id, ok: true }));
});
