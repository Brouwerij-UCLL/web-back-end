import { z } from 'zod';
import { deleteDevice, saveDeviceInfo, saveDeviceStatus } from '../database/devices/queries.ts';
import { gebeurtenissen } from '../events.ts';

// Verwerkt de aanmelding (info) en de online/offline-status van toestellen.

// MAC-adres zonder scheidingstekens in kleine letters: "A4:CF:12:B3:C8:E0" -> "a4cf12b3c8e0". Ongeldig: undefined.
export function normaliseerMac(waarde: string): string | undefined {
  const mac = waarde.replace(/[:-]/g, '').toLowerCase();
  return /^[0-9a-f]{12}$/.test(mac) ? mac : undefined;
}

const InfoBericht = z.object({
  type: z.string().trim().min(1),
  name: z.string().optional(),
  firmware: z.string().optional(),
  sensors: z.array(z.object({ name: z.string(), unit: z.string().optional() })).optional(),
  actuators: z.array(z.object({ name: z.string(), values: z.array(z.string()).optional() })).optional(),
  commands: z.array(z.string()).optional(),
});

// brouwer/<mac>/info. Een leeg (retained) bericht haalt het toestel definitief weg.
export function verwerkInfo(mac: string, payload: string): void {
  if (payload.trim() === '') {
    if (deleteDevice(mac)) {
      console.log(`[TOESTEL] ${mac} verwijderd`);
      gebeurtenissen.emit('device.removed', { mac });
    }
    return;
  }
  let json: unknown;
  try {
    json = JSON.parse(payload);
  } catch {
    console.warn(`[TOESTEL] ${mac}: info is geen geldige JSON, genegeerd`);
    return;
  }
  const info = InfoBericht.safeParse(json);
  if (!info.success) {
    console.warn(`[TOESTEL] ${mac}: ongeldige info, genegeerd: ${info.error.issues.map((i) => i.message).join('; ')}`);
    return;
  }
  const device = saveDeviceInfo(mac, info.data);
  console.log(`[TOESTEL] ${mac} aangemeld als ${device.type}${device.name ? ` (${device.name})` : ''}`);
  gebeurtenissen.emit('device.updated', device);
}

// brouwer/<mac>/status: "online" of "offline" (ook de last will van het toestel).
export function verwerkStatus(mac: string, payload: string): void {
  const status = payload.trim().toLowerCase();
  if (status !== 'online' && status !== 'offline') {
    console.warn(`[TOESTEL] ${mac}: onbekende status "${payload}", genegeerd`);
    return;
  }
  const device = saveDeviceStatus(mac, status === 'online');
  console.log(`[TOESTEL] ${mac} is ${status}`);
  gebeurtenissen.emit('device.status', { mac, online: device.online, last_seen: device.last_seen! });
}
