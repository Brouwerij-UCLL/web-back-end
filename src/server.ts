import { app } from './app.ts';
import { config } from './config.ts';
import { checkDatabaseConnection } from './database/db.ts';
import { startMqtt, stopMqtt } from './mqtt/client.ts';

// Lokaal startpunt van de back-end: verbinden met de MQTT-broker (Mosquitto) en de webserver starten.
const mqttClient = startMqtt();

const server = app.listen(config.port, () => {
  console.log(`online op http://localhost:${config.port}`);
  try {
    checkDatabaseConnection();
    console.log('verbonden met database');
  } catch (error) {
    console.error('geen verbinding met database:', (error as Error).message);
  }
});

// Bij stoppen (Ctrl+C, systemctl stop/restart): eerst "offline" melden op MQTT, dan afsluiten.
// Open live-verbindingen (SSE) worden gesloten; de browser verbindt vanzelf opnieuw.
let stoppen = false;
async function stop(signaal: string): Promise<void> {
  if (stoppen) return;
  stoppen = true;
  console.log(`${signaal} ontvangen, back-end stopt`);
  const noodstop = setTimeout(() => process.exit(1), 5000);
  noodstop.unref();
  try {
    await stopMqtt(mqttClient);
  } catch (error) {
    console.error('MQTT niet netjes gesloten:', (error as Error).message);
  }
  server.closeAllConnections();
  server.close(() => process.exit(0));
}

process.on('SIGINT', () => void stop('SIGINT'));
process.on('SIGTERM', () => void stop('SIGTERM'));
