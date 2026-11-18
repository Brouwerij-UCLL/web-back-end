import { db } from '../db.ts';

// Toestellen die zich via MQTT aanmeldden (tabel devices). Het info-bericht beschrijft wat een toestel kan.

export type DeviceInfo = {
  type: string;
  name?: string;
  firmware?: string;
  sensors?: { name: string; unit?: string }[];
  actuators?: { name: string; values?: string[] }[];
  commands?: string[];
};

export type Device = {
  mac: string;
  type: string | null;
  name: string | null;
  firmware: string | null;
  online: boolean;
  last_seen: string | null;
  sensors: { name: string; unit?: string }[];
  actuators: { name: string; values?: string[] }[];
  commands: string[];
};

type Rij = {
  mac: string;
  type: string | null;
  name: string | null;
  firmware: string | null;
  info: string | null;
  online: number;
  last_seen: string | null;
};

function naarDevice(rij: Rij): Device {
  const info: Partial<DeviceInfo> = rij.info ? JSON.parse(rij.info) : {};
  return {
    mac: rij.mac,
    type: rij.type,
    name: rij.name,
    firmware: rij.firmware,
    online: rij.online === 1,
    last_seen: rij.last_seen,
    sensors: info.sensors ?? [],
    actuators: info.actuators ?? [],
    commands: info.commands ?? [],
  };
}

const kolommen = 'mac, type, name, firmware, info, online, last_seen';

// Alle toestellen: eerst die met een type, dan op naam.
export function getDevices(): Device[] {
  return (db.prepare(`SELECT ${kolommen} FROM devices ORDER BY type IS NULL, type, name COLLATE NOCASE, mac`).all() as Rij[]).map(
    naarDevice,
  );
}

export function getDevice(mac: string): Device | undefined {
  const rij = db.prepare(`SELECT ${kolommen} FROM devices WHERE mac = ?`).get(mac) as Rij | undefined;
  return rij ? naarDevice(rij) : undefined;
}

// Maakt het toestel aan of werkt het bij met een nieuw info-bericht. De online-status blijft zoals ze was.
export function saveDeviceInfo(mac: string, info: DeviceInfo): Device {
  db.prepare(
    `INSERT INTO devices (mac, type, name, firmware, info, last_seen) VALUES (?, ?, ?, ?, ?, datetime('now'))
     ON CONFLICT (mac) DO UPDATE SET type = excluded.type, name = excluded.name, firmware = excluded.firmware,
       info = excluded.info, last_seen = excluded.last_seen, updated_at = datetime('now')`,
  ).run(mac, info.type, info.name ?? null, info.firmware ?? null, JSON.stringify(info));
  return getDevice(mac)!;
}

// Zet een toestel online of offline; een onbekend toestel wordt aangemaakt (nog zonder info).
export function saveDeviceStatus(mac: string, online: boolean): Device {
  db.prepare(
    `INSERT INTO devices (mac, online, last_seen) VALUES (?, ?, datetime('now'))
     ON CONFLICT (mac) DO UPDATE SET online = excluded.online, last_seen = excluded.last_seen, updated_at = datetime('now')`,
  ).run(mac, online ? 1 : 0);
  return getDevice(mac)!;
}

export function deleteDevice(mac: string): boolean {
  return db.prepare('DELETE FROM devices WHERE mac = ?').run(mac).changes > 0;
}
