import { normaliseerMac, verwerkInfo, verwerkStatus } from './devices.ts';
import { parseTopic } from './topics.ts';

// Verwerkt één binnenkomend MQTT-bericht.
export function handleMessage(topic: string, payload: string): void {
  console.log(`Received message on topic: ${topic} with payload: ${payload}`);

  const { brouwerId, hoofdtype, naam } = parseTopic(topic);
  const mac = normaliseerMac(brouwerId);

  if (hoofdtype === 'info' || hoofdtype === 'status') {
    if (!mac) {
      console.warn(`[TOESTEL] "${brouwerId}" is geen geldig MAC-adres; ${hoofdtype} genegeerd`);
      return;
    }
    if (hoofdtype === 'info') verwerkInfo(mac, payload);
    else verwerkStatus(mac, payload);
  } else if (hoofdtype === 'sensor') {
    console.log(`[SENSOR] Brouwer #${brouwerId} stuurt ${naam}: ${payload}`);
    // DATABASE UPDATE LATER: Sla deze specifieke meting op
  } else if (hoofdtype === 'actuator') {
    console.log(`[ACTUATOR] Brouwer #${brouwerId} meldt toestand van ${naam}: ${payload}`);
    // DATABASE UPDATE LATER: Update de huidige status van de actuator
  }
}
