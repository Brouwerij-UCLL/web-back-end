// Op Vercel is alleen /tmp schrijfbaar; de database is daar dus tijdelijk.
const defaultDatabaseFile = process.env.VERCEL ? '/tmp/app.db' : './data/app.db';

// Front-ends die de API vanuit een andere origin mogen aanspreken (CORS).
const defaultCorsOrigins = 'http://localhost:4200,http://localhost,https://localhost';

// Maximale capaciteit van de brouwketel in liter: bovengrens voor elk volume (recept, water, brouwsessie).
const defaultMaxVolumeLiter = 100;

// Leest MAX_VOLUME_LITER; zonder waarde geldt de standaard. Een ongeldige waarde stopt de back-end
// bij het opstarten, zodat er nooit stil met een verkeerde grens gewerkt wordt.
function leesMaxVolumeLiter(waarde: string | undefined): number {
  if (waarde === undefined || waarde.trim() === '') return defaultMaxVolumeLiter;
  const liter = Number(waarde);
  if (!Number.isFinite(liter) || liter <= 0) {
    throw new Error(`MAX_VOLUME_LITER moet een getal groter dan 0 zijn (gekregen: "${waarde}")`);
  }
  return liter;
}

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
  maxVolumeLiter: leesMaxVolumeLiter(process.env.MAX_VOLUME_LITER),
};
