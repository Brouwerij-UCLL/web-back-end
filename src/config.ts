// Op Vercel is alleen /tmp schrijfbaar; de database is daar dus tijdelijk.
const defaultDatabaseFile = process.env.VERCEL ? '/tmp/app.db' : './data/app.db';

// Front-ends die de API vanuit een andere origin mogen aanspreken (CORS).
const defaultCorsOrigins = 'http://localhost:4200,http://localhost,https://localhost';

// Alle instellingen uit de omgeving (.env) op één plek.
export const config = {
  port: Number(process.env.PORT ?? 3000),
  databaseFile: process.env.DATABASE_FILE ?? defaultDatabaseFile,
  // Eigen MQTT-broker in de back-end; MQTT_BROKER=off om een externe broker te gebruiken (via MQTT_URL).
  mqttBroker: process.env.MQTT_BROKER !== 'off',
  mqttPort: Number(process.env.MQTT_PORT ?? 1883),
  // Leeg = iedereen mag verbinden; ingevuld = elke client (ook de back-end zelf) moet inloggen.
  mqttUsername: process.env.MQTT_USERNAME || undefined,
  mqttPassword: process.env.MQTT_PASSWORD || undefined,
  mqttUrl: process.env.MQTT_URL ?? `mqtt://localhost:${Number(process.env.MQTT_PORT ?? 1883)}`,
  // Kommagescheiden lijst; een afsluitende / wordt genegeerd.
  corsOrigins: (process.env.CORS_ORIGINS ?? defaultCorsOrigins)
    .split(',')
    .map((origin) => origin.trim().replace(/\/+$/, ''))
    .filter((origin) => origin !== ''),
};
