import assert from 'node:assert/strict';
import { get, type IncomingMessage, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { after, before, test } from 'node:test';

// Live updates via Server-Sent Events op /api/events, op een tijdelijke database.
process.env.DATABASE_FILE = ':memory:';
const { app } = await import('../app.ts');
const { handleMessage } = await import('../mqtt/handlers.ts');
const { gebeurtenissen } = await import('../events.ts');

type Bericht = { event: string; data: any };

let server: Server;
let baseUrl: string;

before(async () => {
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://localhost:${(server.address() as AddressInfo).port}`;
});

after(() => {
  server.closeAllConnections(); // open live-verbindingen houden de server anders open
  server.close();
});

// Opent /api/events en verzamelt de berichten; volgend() wacht op het volgende bericht.
async function verbind(headers: Record<string, string> = {}) {
  const antwoord = await new Promise<IncomingMessage>((resolve) => get(`${baseUrl}/api/events`, { headers }, resolve));
  const berichten: Bericht[] = [];
  const wachtend: ((b: Bericht) => void)[] = [];
  let buffer = '';
  antwoord.setEncoding('utf8');
  antwoord.on('data', (stuk: string) => {
    buffer += stuk;
    let einde;
    while ((einde = buffer.indexOf('\n\n')) >= 0) {
      const blok = buffer.slice(0, einde);
      buffer = buffer.slice(einde + 2);
      const event = /^event: (.*)$/m.exec(blok)?.[1];
      const data = /^data: (.*)$/m.exec(blok)?.[1];
      if (!event || data === undefined) continue; // retry- en hartslagregels
      const bericht = { event, data: JSON.parse(data) };
      const wachter = wachtend.shift();
      if (wachter) wachter(bericht);
      else berichten.push(bericht);
    }
  });
  const volgend = () =>
    new Promise<Bericht>((resolve) => {
      const klaar = berichten.shift();
      if (klaar) resolve(klaar);
      else wachtend.push(resolve);
    });
  return { antwoord, volgend, sluit: () => antwoord.destroy() };
}

test('bij het verbinden komt eerst een snapshot met alle toestellen', async () => {
  handleMessage('brouwer/a4cf12b3c8e0/info', JSON.stringify({ type: 'ketel', name: 'Brouwketel 1' }));
  handleMessage('brouwer/a4cf12b3c8e0/status', 'online');
  const stroom = await verbind();
  assert.equal(stroom.antwoord.statusCode, 200);
  assert.match(String(stroom.antwoord.headers['content-type']), /text\/event-stream/);
  const eerste = await stroom.volgend();
  assert.equal(eerste.event, 'snapshot');
  const ketel = eerste.data.devices.find((d: { mac: string }) => d.mac === 'a4cf12b3c8e0');
  assert.equal(ketel.online, true);
  assert.equal(ketel.name, 'Brouwketel 1');
  stroom.sluit();
});

test('online, offline, een nieuw toestel en verwijderen komen live binnen', async () => {
  const stroom = await verbind();
  await stroom.volgend(); // snapshot

  handleMessage('brouwer/a4cf12b3c8e0/status', 'offline');
  const status = await stroom.volgend();
  assert.equal(status.event, 'device.status');
  assert.equal(status.data.mac, 'a4cf12b3c8e0');
  assert.equal(status.data.online, false);
  assert.ok(status.data.last_seen);

  handleMessage('brouwer/c0ffee000001/info', JSON.stringify({ type: 'kast', name: 'Klimaatkast 1' }));
  const nieuw = await stroom.volgend();
  assert.equal(nieuw.event, 'device.updated');
  assert.equal(nieuw.data.type, 'kast');

  handleMessage('brouwer/c0ffee000001/info', '');
  const weg = await stroom.volgend();
  assert.deepEqual(weg, { event: 'device.removed', data: { mac: 'c0ffee000001' } });
  stroom.sluit();
});

test('metingen, toestanden en fouten komen live binnen', async () => {
  const stroom = await verbind();
  await stroom.volgend(); // snapshot

  handleMessage('brouwer/a4cf12b3c8e0/sensor/temperatuur', '66.8');
  const meting = await stroom.volgend();
  assert.equal(meting.event, 'meting');
  assert.equal(meting.data.mac, 'a4cf12b3c8e0');
  assert.equal(meting.data.sensor, 'temperatuur');
  assert.equal(meting.data.value, 66.8);
  assert.ok(meting.data.at);

  handleMessage('brouwer/a4cf12b3c8e0/actuator/verwarming/state', 'on');
  const toestand = await stroom.volgend();
  assert.equal(toestand.event, 'actuator.state');
  assert.equal(toestand.data.state, 'on');

  handleMessage('brouwer/a4cf12b3c8e0/fout', JSON.stringify({ code: 'DEKSEL', message: 'Deksel staat open' }));
  const fout = await stroom.volgend();
  assert.equal(fout.event, 'fout');
  assert.equal(fout.data.message, 'Deksel staat open');
  stroom.sluit();

  // Wie later verbindt, ziet de laatste waarden meteen in de snapshot.
  const later = await verbind();
  const snapshot = await later.volgend();
  const ketel = snapshot.data.devices.find((d: { mac: string }) => d.mac === 'a4cf12b3c8e0');
  assert.equal(ketel.sensors.find((s: { name: string }) => s.name === 'temperatuur').value, 66.8);
  later.sluit();
});

test('meerdere browsers krijgen allemaal de updates', async () => {
  const a = await verbind();
  const b = await verbind();
  await a.volgend();
  await b.volgend();
  handleMessage('brouwer/a4cf12b3c8e0/status', 'online');
  assert.equal((await a.volgend()).data.online, true);
  assert.equal((await b.volgend()).data.online, true);
  a.sluit();
  b.sluit();
});

test('een gesloten verbinding luistert niet meer mee', async () => {
  await new Promise((resolve) => setTimeout(resolve, 50)); // verbindingen van vorige tests zijn dan gesloten
  const voor = gebeurtenissen.listenerCount('device.status');
  const stroom = await verbind();
  await stroom.volgend();
  assert.equal(gebeurtenissen.listenerCount('device.status'), voor + 1);
  stroom.sluit();
  await new Promise((resolve) => setTimeout(resolve, 50));
  assert.equal(gebeurtenissen.listenerCount('device.status'), voor);
});

test('de front-end op een andere origin mag meeluisteren (CORS)', async () => {
  const stroom = await verbind({ origin: 'http://localhost:4200' });
  assert.equal(stroom.antwoord.headers['access-control-allow-origin'], 'http://localhost:4200');
  stroom.sluit();
});
