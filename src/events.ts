import { EventEmitter } from 'node:events';
import type { Device } from './database/devices/queries.ts';

// Gebeurtenissen binnen de back-end, bv. van MQTT naar de live updates voor de front-end.
// MQTT-code meldt wat er gebeurt; wie wil (zoals /api/events) luistert mee.

export type Gebeurtenissen = {
  'device.updated': [Device]; // nieuw toestel of nieuw info-bericht
  'device.status': [{ mac: string; online: boolean; last_seen: string }];
  'device.removed': [{ mac: string }];
  meting: [{ mac: string; sensor: string; value: number; unit: string | null; at: string }];
  'actuator.state': [{ mac: string; actuator: string; state: string; at: string }];
  fout: [{ mac: string; code: string | null; message: string; at: string }];
};

export const gebeurtenissen = new EventEmitter<Gebeurtenissen>();
// Elke open live-verbinding luistert mee; geen waarschuwing bij veel tegelijk.
gebeurtenissen.setMaxListeners(0);
