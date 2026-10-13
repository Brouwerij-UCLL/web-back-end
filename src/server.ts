import { app } from './app.ts';
import { config } from './config.ts';
import { checkDatabaseConnection } from './database/db.ts';
import { startMqtt } from './mqtt/client.ts';

// Lokaal startpunt van de back-end: MQTT verbinden en de webserver starten.
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
