import { app } from './app.ts';
import { config } from './config.ts';
import { checkDatabaseConnection } from './database/db.ts';
import { startBroker } from './mqtt/broker.ts';
import { startMqtt } from './mqtt/client.ts';

// Lokaal startpunt van de back-end: de eigen MQTT-broker starten, ermee verbinden en de webserver starten.
if (config.mqttBroker) {
  const broker = await startBroker({ port: config.mqttPort, username: config.mqttUsername, password: config.mqttPassword });
  console.log(`MQTT-broker draait op poort ${broker.port}${config.mqttUsername ? ' (met login)' : ''}`);
}
startMqtt();

app.listen(config.port, () => {
  console.log(`online op http://localhost:${config.port}`);
  try {
    checkDatabaseConnection();
    console.log('verbonden met database');
  } catch (error) {
    console.error('geen verbinding met database:', (error as Error).message);
  }
});
