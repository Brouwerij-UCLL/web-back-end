import assert from 'node:assert/strict';
import { after, beforeEach, test } from 'node:test';

process.env.DATABASE_FILE = ':memory:';

await import('../app.ts'); // voert de migraties uit
const { handleMessage } = await import('./handlers.ts');
const { ontdubbelNamen, stopOpruimen } = await import('./ontdubbelen.ts');
const { setPublisher } = await import('./opdrachten.ts');
const { getDevice } = await import('../database/devices/queries.ts');
const { gebeurtenissen } = await import('../events.ts');

let gewist: string[];
let verwijderd: string[];
gebeurtenissen.on('device.removed', ({ mac }) => verwijderd.push(mac));

beforeEach(() => {
  gewist = [];
  verwijderd = [];
  setPublisher(async (topic, payload, _qos, retain) => {
    if (payload === '' && retain) gewist.push(topic);
  });
});

after(() => {
  stopOpruimen();
  setPublisher(undefined);
});

function meldAan(mac: string, name: string, online: boolean, actuators: string[] = []) {
  handleMessage(`brouwer/${mac}/info`, JSON.stringify({ type: 'ketel', name, actuators: actuators.map((n) => ({ name: n })) }));
  handleMessage(`brouwer/${mac}/status`, online ? 'online' : 'offline');
}

const naam = (mac: string) => getDevice(mac)?.name;

test('een tweede toestel met dezelfde naam dat online is, krijgt meteen een cijfer', () => {
  meldAan('aa0000000001', 'Brouwketel', true);
  meldAan('aa0000000002', 'Brouwketel', true);
  assert.equal(naam('aa0000000001'), 'Brouwketel');
  assert.equal(naam('aa0000000002'), 'Brouwketel 2');

  meldAan('aa0000000003', 'brouwketel ', true); // hoofdletters en spaties tellen niet
  assert.equal(naam('aa0000000003'), 'brouwketel 3');
});

test('is er één online, dan wordt het offline toestel met die naam opgeruimd, ook op de broker', async () => {
  meldAan('bb0000000001', 'Vergister', false, ['koeling']);
  handleMessage('brouwer/bb0000000001/actuator/koeling/state', 'on');
  meldAan('bb0000000002', 'Vergister', true);

  ontdubbelNamen({ opruimen: true });
  await new Promise((klaar) => setImmediate(klaar)); // het wissen op de broker loopt asynchroon
  assert.equal(getDevice('bb0000000001'), undefined);
  assert.deepEqual(verwijderd, ['bb0000000001']);
  assert.deepEqual(gewist.sort(), [
    'brouwer/bb0000000001/actuator/koeling/state',
    'brouwer/bb0000000001/info',
    'brouwer/bb0000000001/status',
  ]);
  assert.equal(naam('bb0000000002'), 'Vergister'); // het cijfer is weg, de naam is vrij
});

test('zijn ze allemaal offline, dan wordt niets opgeruimd maar krijgt het tweede een cijfer', () => {
  meldAan('cc0000000001', 'Kast', false);
  meldAan('cc0000000002', 'Kast', false);
  ontdubbelNamen({ opruimen: true });
  assert.equal(naam('cc0000000001'), 'Kast');
  assert.equal(naam('cc0000000002'), 'Kast 2');
  assert.deepEqual(verwijderd, []);
});

test('gaat het eerste toestel offline terwijl het tweede online is, dan houdt het tweede de naam', () => {
  meldAan('dd0000000001', 'Ketel', true);
  meldAan('dd0000000002', 'Ketel', true);
  assert.equal(naam('dd0000000002'), 'Ketel 2');
  handleMessage('brouwer/dd0000000001/status', 'offline');
  ontdubbelNamen({ opruimen: true });
  assert.equal(getDevice('dd0000000001'), undefined);
  assert.equal(naam('dd0000000002'), 'Ketel');
});

test('het cijfer botst nooit met een toestel dat echt zo heet', () => {
  meldAan('ee0000000001', 'Pomp 2', true);
  meldAan('ee0000000002', 'Pomp', true);
  meldAan('ee0000000003', 'Pomp', true);
  assert.equal(naam('ee0000000001'), 'Pomp 2');
  assert.equal(naam('ee0000000002'), 'Pomp');
  assert.equal(naam('ee0000000003'), 'Pomp 3');
});

test('bij een info-bericht alleen (zonder opruimen) blijft het offline toestel staan', () => {
  meldAan('ff0000000001', 'Roerwerk', false);
  meldAan('ff0000000002', 'Roerwerk', true);
  assert.ok(getDevice('ff0000000001'));
  assert.equal(naam('ff0000000002'), 'Roerwerk');
  assert.equal(naam('ff0000000001'), 'Roerwerk 2');
});
