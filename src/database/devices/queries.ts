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
  sensors: { name: string; unit?: string; value: number | null; updated_at: string | null }[];
  actuators: { name: string; values?: string[]; state: string | null; updated_at: string | null }[];
  commands: string[];
};

type Waarde = { kind: 'sensor' | 'actuator'; name: string; value: string; updated_at: string };

type Rij = {
  mac: string;
  type: string | null;
  name: string | null;
  firmware: string | null;
  info: string | null;
  online: number;
  last_seen: string | null;
};

// Sensoren en actuatoren uit het info-bericht, aangevuld met hun laatste waarde. Een sensor die waarden stuurt
// maar niet in info staat, komt er ook bij (zonder eenheid).
function naarDevice(rij: Rij): Device {
  const info: Partial<DeviceInfo> = rij.info ? JSON.parse(rij.info) : {};
  const waarden = db.prepare('SELECT kind, name, value, updated_at FROM device_readings WHERE mac = ?').all(rij.mac) as Waarde[];
  const laatste = (kind: Waarde['kind'], naam: string) => waarden.find((w) => w.kind === kind && w.name === naam);

  const sensorNamen = [...(info.sensors ?? []).map((s) => s.name), ...waarden.filter((w) => w.kind === 'sensor').map((w) => w.name)];
  const actuatorNamen = [...(info.actuators ?? []).map((a) => a.name), ...waarden.filter((w) => w.kind === 'actuator').map((w) => w.name)];

  return {
    mac: rij.mac,
    type: rij.type,
    name: rij.name,
    firmware: rij.firmware,
    online: rij.online === 1,
    last_seen: rij.last_seen,
    sensors: [...new Set(sensorNamen)].map((naam) => {
      const waarde = laatste('sensor', naam);
      return {
        ...(info.sensors ?? []).find((s) => s.name === naam),
        name: naam,
        value: waarde ? Number(waarde.value) : null,
        updated_at: waarde?.updated_at ?? null,
      };
    }),
    actuators: [...new Set(actuatorNamen)].map((naam) => {
      const waarde = laatste('actuator', naam);
      return {
        ...(info.actuators ?? []).find((a) => a.name === naam),
        name: naam,
        state: waarde?.value ?? null,
        updated_at: waarde?.updated_at ?? null,
      };
    }),
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

// Maakt een toestel aan als het nog niet bestaat (bv. een meting voor de eerste info), zonder iets anders te wijzigen.
function zorgVoorDevice(mac: string): void {
  db.prepare(`INSERT INTO devices (mac, last_seen) VALUES (?, datetime('now')) ON CONFLICT (mac) DO NOTHING`).run(mac);
}

// Bewaart de laatste waarde van een sensor of de laatste toestand van een actuator; geeft het tijdstip terug.
export function saveReading(mac: string, kind: 'sensor' | 'actuator', name: string, value: string): string {
  zorgVoorDevice(mac);
  db.prepare(
    `INSERT INTO device_readings (mac, kind, name, value, updated_at) VALUES (?, ?, ?, ?, datetime('now'))
     ON CONFLICT (mac, kind, name) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
  ).run(mac, kind, name, value);
  db.prepare(`UPDATE devices SET last_seen = datetime('now') WHERE mac = ?`).run(mac);
  return (db.prepare('SELECT updated_at FROM device_readings WHERE mac = ? AND kind = ? AND name = ?').get(mac, kind, name) as { updated_at: string })
    .updated_at;
}

// De eenheid van een sensor uit het info-bericht, als die er is.
export function getSensorUnit(mac: string, sensor: string): string | null {
  const rij = db.prepare('SELECT info FROM devices WHERE mac = ?').get(mac) as { info: string | null } | undefined;
  const info: Partial<DeviceInfo> = rij?.info ? JSON.parse(rij.info) : {};
  return info.sensors?.find((s) => s.name === sensor)?.unit ?? null;
}
