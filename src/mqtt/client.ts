import mqtt, { type IClientOptions, type MqttClient } from 'mqtt';
import { config } from '../config.ts';
import { handleMessage } from './handlers.ts';
import { BACKEND_STATUS_TOPIC, subscribedTopics } from './topics.ts';

// De back-end volgt dezelfde verbindingsregels als de toestellen: een status die retained is,
// "online" na het verbinden en "offline" als last will, zodat ketel en kast weten of de back-end er is.
const statusBericht = { qos: 1, retain: true } as const;

export function mqttOptions(): IClientOptions {
  return {
    // Uniek per instantie: een lokale back-end en die op de server mogen elkaar niet van de broker gooien.
    clientId: `brouwer-server-${Math.random().toString(16).slice(2, 10)}`,
    clean: true,
    keepalive: 30,
    connectTimeout: 4000,
    reconnectPeriod: 1000,
    username: config.mqttUsername,
    password: config.mqttPassword,
    will: { topic: BACKEND_STATUS_TOPIC, payload: Buffer.from('offline'), ...statusBericht },
  };
}

// Verbindt met de MQTT-broker, meldt de back-end online, abonneert op de topics en geeft de client terug.
export function startMqtt(): MqttClient {
  const mqttClient: MqttClient = mqtt.connect(config.mqttUrl, mqttOptions());

  mqttClient.on('connect', () => {
    console.log('Successfully connected to MQTT broker');
    mqttClient.publish(BACKEND_STATUS_TOPIC, 'online', statusBericht);

    mqttClient.subscribe(subscribedTopics, (err: Error | null) => {
      if (!err) {
        console.log(`Subscribed to topic: ${subscribedTopics}`);
      } else {
        console.error(`Error subscribing to topic: ${subscribedTopics}`, err);
      }
    });
  });

  mqttClient.on('message', (topic: string, message: Buffer) => {
    handleMessage(topic, message.toString());
  });

  mqttClient.on('error', (err: Error) => {
    console.error('MQTT client error:', err);
  });

  return mqttClient;
}

// Netjes afsluiten: bij een gewone disconnect stuurt de broker de last will niet, dus eerst zelf "offline".
export async function stopMqtt(mqttClient: MqttClient): Promise<void> {
  if (mqttClient.connected) {
    await mqttClient.publishAsync(BACKEND_STATUS_TOPIC, 'offline', statusBericht);
  }
  await mqttClient.endAsync();
}
