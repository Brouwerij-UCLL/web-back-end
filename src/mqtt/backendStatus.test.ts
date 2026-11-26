import assert from 'node:assert/strict';
import { test } from 'node:test';

process.env.DATABASE_FILE = ':memory:';

await import('../app.ts'); // voert de migraties uit
const { mqttOptions } = await import('./client.ts');
const { handleMessage } = await import('./handlers.ts');
const { getDevices } = await import('../database/devices/queries.ts');
const { BACKEND_STATUS_TOPIC, subscribedTopics } = await import('./topics.ts');

test('de back-end meldt zich zoals een toestel: last will offline, retained, QoS 1', () => {
  const opties = mqttOptions();
  assert.equal(BACKEND_STATUS_TOPIC, 'brouwer/server/status');
  assert.equal(opties.will?.topic, BACKEND_STATUS_TOPIC);
  assert.equal(String(opties.will?.payload), 'offline');
  assert.equal(opties.will?.qos, 1);
  assert.equal(opties.will?.retain, true);
  assert.equal(opties.keepalive, 30);
  assert.equal(opties.clean, true);
});

test('elke instantie heeft een eigen client-id', () => {
  const a = mqttOptions().clientId;
  const b = mqttOptions().clientId;
  assert.match(String(a), /^brouwer-server-[0-9a-f]+$/);
  assert.notEqual(a, b);
});

test('de eigen status komt binnen via brouwer/+/status maar wordt geen toestel', () => {
  assert.ok(subscribedTopics.includes('brouwer/+/status'));
  handleMessage(BACKEND_STATUS_TOPIC, 'online');
  handleMessage(BACKEND_STATUS_TOPIC, 'offline');
  assert.deepEqual(getDevices(), []);
});
