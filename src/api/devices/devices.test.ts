import assert from 'node:assert/strict';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { after, before, test } from 'node:test';

// Toestellen die zich via MQTT aanmelden (info) en hun online/offline-status, op een tijdelijke database.
// De MQTT-berichten gaan rechtstreeks naar handleMessage, zoals de client ze zou doorgeven.
process.env.DATABASE_FILE = ':memory:';
const { app } = await import('../../app.ts');
const { handleMessage } = await import('../../mqtt/handlers.ts');
const { gebeurtenissen } = await import('../../events.ts');

let server: Server;
let baseUrl: string;

before(async () => {
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://localhost:${(server.address() as AddressInfo).port}/api/devices`;
});

after(() => {
  server.close();
});

async function vraag(pad = '') {
  const antwoord = await fetch(baseUrl + pad);
  return { status: antwoord.status, body: await antwoord.json() };
}

const ketelInfo = {
  type: 'ketel',
  name: 'Brouwketel 1',
  firmware: '1.0.0',
  sensors: [{ name: 'temperatuur', unit: '°C' }],
  actuators: [{ name: 'verwarming', values: ['on', 'off'] }],
  commands: ['setpoint', 'recept'],
};

test('een info-bericht maakt het toestel aan met alles wat het kan', async () => {
  handleMessage('brouwer/a4cf12b3c8e0/info', JSON.stringify(ketelInfo));
  const { status, body } = await vraag('/a4cf12b3c8e0');
  assert.equal(status, 200);
  assert.equal(body.type, 'ketel');
  assert.equal(body.name, 'Brouwketel 1');
  assert.equal(body.firmware, '1.0.0');
  assert.deepEqual(body.sensors, [{ name: 'temperatuur', unit: '°C', value: null, updated_at: null }]);
  assert.deepEqual(body.actuators, [{ name: 'verwarming', values: ['on', 'off'], state: null, updated_at: null }]);
  assert.deepEqual(body.commands, ketelInfo.commands);
  assert.equal(body.online, false, 'zonder statusbericht nog niet online');
});

test('status online en offline (ook de last will) worden bijgehouden', async () => {
  handleMessage('brouwer/a4cf12b3c8e0/status', 'online');
  assert.equal((await vraag('/a4cf12b3c8e0')).body.online, true);
  handleMessage('brouwer/a4cf12b3c8e0/status', 'offline');
  const { body } = await vraag('/a4cf12b3c8e0');
  assert.equal(body.online, false);
  assert.ok(body.last_seen);
});

test('een nieuw info-bericht werkt het toestel bij en laat de status staan', async () => {
  handleMessage('brouwer/a4cf12b3c8e0/status', 'online');
  handleMessage('brouwer/a4cf12b3c8e0/info', JSON.stringify({ ...ketelInfo, firmware: '1.1.0' }));
  const { body } = await vraag('/a4cf12b3c8e0');
  assert.equal(body.firmware, '1.1.0');
  assert.equal(body.online, true);
});

test('een status zonder eerdere info maakt het toestel toch aan, nog zonder type', async () => {
  handleMessage('brouwer/b8d61a0f22c4/status', 'online');
  const { body } = await vraag('/b8d61a0f22c4');
  assert.equal(body.type, null);
  assert.equal(body.online, true);
});

test('de lijst toont alle toestellen, eerst die met een type', async () => {
  handleMessage('brouwer/c0ffee000001/info', JSON.stringify({ type: 'kast', name: 'Klimaatkast 1' }));
  const { status, body } = await vraag();
  assert.equal(status, 200);
  const macs = body.map((d: { mac: string }) => d.mac);
  assert.ok(macs.includes('a4cf12b3c8e0') && macs.includes('c0ffee000001') && macs.includes('b8d61a0f22c4'));
  assert.equal(body.at(-1).type, null, 'toestellen zonder type staan achteraan');
});

test('een MAC-adres met dubbelpunten of hoofdletters wordt hetzelfde toestel', async () => {
  handleMessage('brouwer/A4:CF:12:B3:C8:E0/status', 'offline');
  assert.equal((await vraag('/a4cf12b3c8e0')).body.online, false);
  assert.equal((await vraag('/A4CF12B3C8E0')).status, 200);
});

test('een leeg retained info-bericht haalt het toestel weg', async () => {
  handleMessage('brouwer/c0ffee000001/info', '');
  assert.equal((await vraag('/c0ffee000001')).status, 404);
});

test('ongeldige berichten worden genegeerd', async () => {
  const voor = (await vraag()).body.length;
  handleMessage('brouwer/1/status', 'online'); // geen MAC-adres
  handleMessage('brouwer/d00d00000001/info', '{kapot'); // geen JSON
  handleMessage('brouwer/d00d00000002/info', JSON.stringify({ name: 'zonder type' })); // type ontbreekt
  handleMessage('brouwer/a4cf12b3c8e0/status', 'misschien'); // onbekende status
  assert.equal((await vraag()).body.length, voor);
  assert.equal((await vraag('/a4cf12b3c8e0')).body.online, false);
});

test('wijzigingen worden gemeld voor de live updates', () => {
  const gemeld: string[] = [];
  const opStatus = (e: { mac: string; online: boolean }) => gemeld.push(`status ${e.mac} ${e.online}`);
  const opUpdate = (d: { mac: string }) => gemeld.push(`updated ${d.mac}`);
  const opWeg = (e: { mac: string }) => gemeld.push(`removed ${e.mac}`);
  gebeurtenissen.on('device.status', opStatus);
  gebeurtenissen.on('device.updated', opUpdate);
  gebeurtenissen.on('device.removed', opWeg);
  handleMessage('brouwer/e1e1e1e1e1e1/info', JSON.stringify({ type: 'kast' }));
  handleMessage('brouwer/e1e1e1e1e1e1/status', 'online');
  handleMessage('brouwer/e1e1e1e1e1e1/info', '');
  gebeurtenissen.off('device.status', opStatus);
  gebeurtenissen.off('device.updated', opUpdate);
  gebeurtenissen.off('device.removed', opWeg);
  assert.deepEqual(gemeld, ['updated e1e1e1e1e1e1', 'status e1e1e1e1e1e1 true', 'removed e1e1e1e1e1e1']);
});

test('onbekend of ongeldig MAC-adres geeft 404 of 400', async () => {
  assert.equal((await vraag('/ffffffffffff')).status, 404);
  assert.equal((await vraag('/geen-mac')).status, 400);
});
