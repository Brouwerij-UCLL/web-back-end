import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import mqtt, { type IClientOptions, type MqttClient } from 'mqtt';
import { startBroker, type Broker } from './broker.ts';

// De eigen MQTT-broker: verbinden, retained berichten, last will, QoS 2 en login.

function verbind(port: number, opties: IClientOptions = {}): Promise<MqttClient> {
  return new Promise((resolve, reject) => {
    const client = mqtt.connect(`mqtt://localhost:${port}`, { reconnectPeriod: 0, connectTimeout: 2000, ...opties });
    client.once('connect', () => resolve(client));
    client.once('error', (error) => {
      client.end(true);
      reject(error);
    });
  });
}

// Wacht op het eerste bericht op dit topic (na het abonneren).
function volgendBericht(client: MqttClient, topic: string): Promise<{ payload: string; retain: boolean; qos: number }> {
  return new Promise((resolve) => {
    client.on('message', (t, payload, packet) => {
      if (t === topic) resolve({ payload: payload.toString(), retain: packet.retain, qos: packet.qos });
    });
    client.subscribe(topic, { qos: 2 });
  });
}

describe('zonder login', () => {
  let broker: Broker;
  const clients: MqttClient[] = [];
  const open = async (opties?: IClientOptions) => {
    const client = await verbind(broker.port, opties);
    clients.push(client);
    return client;
  };

  before(async () => {
    broker = await startBroker({ port: 0 });
  });

  after(async () => {
    for (const client of clients) client.end(true);
    await broker.close();
  });

  test('een client kan verbinden en berichten uitwisselen', async () => {
    const zender = await open();
    const ontvanger = await open();
    const bericht = volgendBericht(ontvanger, 'brouwer/a4cf12b3c8e0/sensor/temperatuur');
    await new Promise((resolve) => setTimeout(resolve, 50));
    zender.publish('brouwer/a4cf12b3c8e0/sensor/temperatuur', '66.8');
    assert.equal((await bericht).payload, '66.8');
  });

  test('een retained bericht komt ook bij wie zich later abonneert', async () => {
    const toestel = await open();
    await toestel.publishAsync('brouwer/a4cf12b3c8e0/info', '{"type":"ketel"}', { retain: true, qos: 1 });
    const backend = await open();
    const bericht = await volgendBericht(backend, 'brouwer/a4cf12b3c8e0/info');
    assert.equal(bericht.payload, '{"type":"ketel"}');
    assert.equal(bericht.retain, true);
  });

  test('valt een toestel weg, dan publiceert de broker zijn last will', async () => {
    const backend = await open();
    const toestel = await open({
      will: { topic: 'brouwer/b8d61a0f22c4/status', payload: Buffer.from('offline'), qos: 1, retain: true },
    });
    const bericht = volgendBericht(backend, 'brouwer/b8d61a0f22c4/status');
    await new Promise((resolve) => setTimeout(resolve, 50));
    toestel.stream.destroy(); // verbinding weg zonder netjes af te melden
    assert.equal((await bericht).payload, 'offline');
  });

  test('een bericht met QoS 2 komt aan met QoS 2', async () => {
    const backend = await open();
    const toestel = await open();
    const bericht = volgendBericht(toestel, 'brouwer/a4cf12b3c8e0/cmd/recept');
    await new Promise((resolve) => setTimeout(resolve, 50));
    await backend.publishAsync('brouwer/a4cf12b3c8e0/cmd/recept', '{"message_id":"b41d07aa"}', { qos: 2 });
    const ontvangen = await bericht;
    assert.equal(ontvangen.qos, 2);
    assert.equal(ontvangen.payload, '{"message_id":"b41d07aa"}');
  });
});

describe('met login', () => {
  let broker: Broker;

  before(async () => {
    broker = await startBroker({ port: 0, username: 'brouwer', password: 'geheim' });
  });

  after(async () => {
    await broker.close();
  });

  test('met de juiste gebruikersnaam en het juiste wachtwoord mag een client verbinden', async () => {
    const client = await verbind(broker.port, { username: 'brouwer', password: 'geheim' });
    assert.ok(client.connected);
    client.end(true);
  });

  test('zonder login of met een fout wachtwoord weigert de broker de verbinding', async () => {
    await assert.rejects(verbind(broker.port), /Bad username or password|Not authorized/i);
    await assert.rejects(verbind(broker.port, { username: 'brouwer', password: 'fout' }), /Bad username or password|Not authorized/i);
  });
});
