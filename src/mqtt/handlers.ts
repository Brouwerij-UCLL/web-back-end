import { normaliseerMac, verwerkActuatorToestand, verwerkFout, verwerkInfo, verwerkMeting, verwerkStatus } from './devices.ts';
import { verwerkAck } from './opdrachten.ts';
import { BACKEND_STATUS_ID, parseTopic } from './topics.ts';

// Verwerkt één binnenkomend MQTT-bericht.
export function handleMessage(topic: string, payload: string): void {
  console.log(`Received message on topic: ${topic} with payload: ${payload}`);

  const { brouwerId, hoofdtype, naam } = parseTopic(topic);
  if (brouwerId === BACKEND_STATUS_ID) return; // de eigen status van de back-end, via brouwer/+/status
  const mac = normaliseerMac(brouwerId);

  if (!mac) {
    console.warn(`[TOESTEL] "${brouwerId}" is geen geldig MAC-adres; ${topic} genegeerd`);
    return;
  }
  if (hoofdtype === 'info') verwerkInfo(mac, payload);
  else if (hoofdtype === 'status') verwerkStatus(mac, payload);
  else if (hoofdtype === 'sensor' && naam) verwerkMeting(mac, naam, payload);
  else if (hoofdtype === 'actuator' && naam) verwerkActuatorToestand(mac, naam, payload);
  else if (hoofdtype === 'fout') verwerkFout(mac, payload);
  else if (hoofdtype === 'ack') verwerkAck(mac, payload);
}
