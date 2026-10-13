import { parseTopic } from './topics.ts';

// Verwerkt één binnenkomend MQTT-bericht.
export function handleMessage(topic: string, payload: string): void {
  console.log(`Received message on topic: ${topic} with payload: ${payload}`);

  const { brouwerId, hoofdtype, naam } = parseTopic(topic);

  if (hoofdtype === 'sensor') {
    console.log(`[SENSOR] Brouwer #${brouwerId} stuurt ${naam}: ${payload}`);
    // DATABASE UPDATE LATER: Sla deze specifieke meting op
  } else if (hoofdtype === 'actuator') {
    console.log(`[ACTUATOR] Brouwer #${brouwerId} meldt toestand van ${naam}: ${payload}`);
    // DATABASE UPDATE LATER: Update de huidige status van de actuator
  } else if (hoofdtype === 'status') {
    console.log(`[STATUS] Brouwer #${brouwerId} is nu: ${payload}`);
    // DATABASE LATER: Update of de controller online of offline is
  }
}
