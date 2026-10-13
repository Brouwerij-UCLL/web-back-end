// Alle instellingen uit de omgeving (.env) op één plek.
export const config = {
  port: Number(process.env.PORT ?? 3000),
  databaseFile: process.env.DATABASE_FILE ?? './data/app.db',
  mqttUrl: process.env.MQTT_URL ?? 'mqtt://broker.emqx.io:1883',
};
