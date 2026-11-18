import assert from 'node:assert/strict';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { after, before, test } from 'node:test';

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

async function toestel(mac: string) {
  const antwoord = await fetch(`${baseUrl}/${mac}`);
  return { status: antwoord.status, body: await antwoord.json() };
}

const mac = 'a4cf12b3c8e0';
handleMessage(
  `brouwer/${mac}/info`,
  JSON.stringify({
    type: 'ketel',
    sensors: [{ name: 'temperatuur', unit: '°C' }],
    actuators: [{ name: 'verwarming', values: ['on', 'off'] }],
  }),
);

test('zonder metingen zijn value en state nog null', async () => {
  const { body } = await toestel(mac);
  assert.deepEqual(body.sensors, [{ name: 'temperatuur', unit: '°C', value: null, updated_at: null }]);
  assert.deepEqual(body.actuators, [{ name: 'verwarming', values: ['on', 'off'], state: null, updated_at: null }]);
});

test('het toestel toont de laatst gemeten waarde en de laatste toestand', async () => {
  handleMessage(`brouwer/${mac}/sensor/temperatuur`, '64.2');
  handleMessage(`brouwer/${mac}/sensor/temperatuur`, ' 66.8 ');
  handleMessage(`brouwer/${mac}/actuator/verwarming/state`, 'on');
  const { body } = await toestel(mac);
  assert.equal(body.sensors[0].value, 66.8);
  assert.ok(body.sensors[0].updated_at);
  assert.equal(body.actuators[0].state, 'on');
  assert.ok(body.actuators[0].updated_at);
});

test('een sensor of actuator die niet in info staat, komt er ook bij', async () => {
  handleMessage(`brouwer/${mac}/sensor/druk`, '1.2');
  handleMessage(`brouwer/${mac}/actuator/pomp/state`, '40');
  const { body } = await toestel(mac);
  assert.deepEqual(
    body.sensors.map((s: { name: string; value: number }) => [s.name, s.value]),
    [
      ['temperatuur', 66.8],
      ['druk', 1.2],
    ],
  );
  assert.equal(body.actuators.find((a: { name: string }) => a.name === 'pomp').state, '40');
});

test('een meting van een onbekend toestel maakt het aan, nog zonder type', async () => {
  handleMessage('brouwer/B0:B0:B0:00:00:01/sensor/temperatuur', '20');
  const { status, body } = await toestel('b0b0b0000001');
  assert.equal(status, 200);
  assert.equal(body.type, null);
  assert.equal(body.online, false);
  assert.deepEqual(
    body.sensors.map((s: { name: string; value: number }) => [s.name, s.value]),
    [['temperatuur', 20]],
  );
});

test('ongeldige metingen en toestanden worden genegeerd', async () => {
  handleMessage(`brouwer/${mac}/sensor/temperatuur`, 'warm');
  handleMessage(`brouwer/${mac}/sensor/temperatuur`, '');
  handleMessage(`brouwer/${mac}/sensor/temperatuur`, 'NaN');
  handleMessage(`brouwer/${mac}/actuator/verwarming/state`, '   ');
  handleMessage('brouwer/1/sensor/temperatuur', '50'); // geen MAC-adres
  const { body } = await toestel(mac);
  assert.equal(body.sensors[0].value, 66.8);
  assert.equal(body.actuators[0].state, 'on');
  assert.equal((await toestel('000000000001')).status, 404);
});

test('metingen, toestanden en fouten worden gemeld voor de live updates', () => {
  const gemeld: unknown[] = [];
  const opMeting = (e: object) => gemeld.push({ soort: 'meting', ...e });
  const opToestand = (e: object) => gemeld.push({ soort: 'actuator.state', ...e });
  const opFout = (e: object) => gemeld.push({ soort: 'fout', ...e });
  gebeurtenissen.on('meting', opMeting);
  gebeurtenissen.on('actuator.state', opToestand);
  gebeurtenissen.on('fout', opFout);

  handleMessage(`brouwer/${mac}/sensor/temperatuur`, '67');
  handleMessage(`brouwer/${mac}/sensor/druk`, 'kapot'); // genegeerd
  handleMessage(`brouwer/${mac}/actuator/verwarming/state`, 'off');
  handleMessage(`brouwer/${mac}/fout`, JSON.stringify({ code: 'SENSOR_KAPOT', message: 'Temperatuursensor geeft geen waarde' }));
  handleMessage(`brouwer/${mac}/fout`, 'Deksel open');
  handleMessage(`brouwer/${mac}/fout`, JSON.stringify({ code: 'X' })); // message ontbreekt: genegeerd

  gebeurtenissen.off('meting', opMeting);
  gebeurtenissen.off('actuator.state', opToestand);
  gebeurtenissen.off('fout', opFout);

  const zonderTijd = gemeld.map((e) => {
    const { at, ...rest } = e as { at: string };
    assert.match(at, /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
    return rest;
  });
  assert.deepEqual(zonderTijd, [
    { soort: 'meting', mac, sensor: 'temperatuur', value: 67, unit: '°C' },
    { soort: 'actuator.state', mac, actuator: 'verwarming', state: 'off' },
    { soort: 'fout', mac, code: 'SENSOR_KAPOT', message: 'Temperatuursensor geeft geen waarde' },
    { soort: 'fout', mac, code: null, message: 'Deksel open' },
  ]);
});

test('een verwijderd toestel neemt zijn laatste waarden mee', async () => {
  handleMessage('brouwer/b0b0b0000001/info', '');
  handleMessage('brouwer/b0b0b0000001/status', 'online');
  const { body } = await toestel('b0b0b0000001');
  assert.deepEqual(body.sensors, []);
});
