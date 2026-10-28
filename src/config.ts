// Op Vercel is alleen /tmp schrijfbaar; de database is daar dus tijdelijk.
const defaultDatabaseFile = process.env.VERCEL ? '/tmp/app.db' : './data/app.db';

// Front-ends die de API vanuit een andere origin mogen aanspreken (CORS).
const defaultCorsOrigins = 'http://localhost:4200,http://localhost,https://localhost';

// Alle instellingen uit de omgeving (.env) op één plek.
export const config = {
  port: Number(process.env.PORT ?? 3000),
  databaseFile: process.env.DATABASE_FILE ?? defaultDatabaseFile,
  mqttUrl: process.env.MQTT_URL ?? 'mqtt://broker.emqx.io:1883',
  // Kommagescheiden lijst; een afsluitende / wordt genegeerd.
  corsOrigins: (process.env.CORS_ORIGINS ?? defaultCorsOrigins)
    .split(',')
    .map((origin) => origin.trim().replace(/\/+$/, ''))
    .filter((origin) => origin !== ''),
};
