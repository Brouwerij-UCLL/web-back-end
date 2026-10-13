import mqtt, { MqttClient } from 'mqtt';
import { config } from '../config.ts';
import { handleMessage } from './handlers.ts';
import { subscribedTopics } from './topics.ts';

const options = {
  clientId: `brouw_backend_${Math.random().toString(16).substr(2, 8)}`,
  clean: true,
  connectTimeout: 4000,
  reconnectPeriod: 1000,
};

// Verbindt met de MQTT-broker, abonneert op de topics en geeft de client terug (bv. om te publiceren).
export function startMqtt(): MqttClient {
  const mqttClient: MqttClient = mqtt.connect(config.mqttUrl, options);

  mqttClient.on('connect', () => {
    console.log('Successfully connected to MQTT broker');

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
