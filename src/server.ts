import { app } from './app.ts';
import { config } from './config.ts';
import { checkDatabaseConnection } from './database/db.ts';
import migrate from './database/migrate.ts';
import { startMqtt } from './mqtt/client.ts';

// Startpunt van de back-end: database migreren, MQTT verbinden en de webserver starten.
migrate();
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
