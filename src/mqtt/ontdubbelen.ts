import { deleteDevice, getDevice, getDeviceNamen, setDeviceName, type DeviceNaam } from '../database/devices/queries.ts';
import { gebeurtenissen } from '../events.ts';
import { wisRetained } from './opdrachten.ts';

// Twee toestellen met dezelfde naam (uit hun info-bericht) mogen niet naast elkaar in de lijst staan.
// - Is er minstens één online, dan verdwijnen de offline toestellen met die naam (opruimen).
// - Zijn er meerdere online (of allemaal offline), dan krijgt het tweede een cijfer: "Brouwketel 1 2", "Brouwketel 1 3", ...
//   Het toestel dat online is en het langst gekend, houdt de naam zonder cijfer.
// Dit gebeurt bij elk info-bericht (alleen namen) en kort na elk info- of statusbericht en elke 5 minuten (met opruimen).

export const OPRUIM_INTERVAL_MS = 5 * 60_000;
export const OPRUIM_VERTRAGING_MS = 5_000;

const sleutel = (naam: string) => naam.trim().toLowerCase();

export function ontdubbelNamen({ opruimen }: { opruimen: boolean }): void {
  const toestellen = getDeviceNamen();
  const groepen = new Map<string, DeviceNaam[]>();
  for (const toestel of toestellen) {
    if (!toestel.origineel?.trim()) continue;
    const groep = groepen.get(sleutel(toestel.origineel)) ?? [];
    groep.push(toestel);
    groepen.set(sleutel(toestel.origineel), groep);
  }

  // Namen die al bezet zijn: de eigen namen van alle toestellen, zodat "Ketel 2" nooit botst met een echt toestel "Ketel 2".
  const bezet = new Set(toestellen.filter((t) => t.origineel?.trim()).map((t) => sleutel(t.origineel!)));
  const gewenst = new Map<string, string>();

  for (const groep of groepen.values()) {
    let blijven = groep;
    if (opruimen && groep.some((t) => t.online)) {
      for (const weg of groep.filter((t) => !t.online)) verwijder(weg.mac);
      blijven = groep.filter((t) => t.online);
    }
    // Online eerst, dan wie het langst gekend is (getDeviceNamen sorteert al op created_at).
    const volgorde = [...blijven.filter((t) => t.online), ...blijven.filter((t) => !t.online)];
    volgorde.forEach((toestel, index) => {
      const basis = toestel.origineel!.trim();
      if (index === 0) {
        gewenst.set(toestel.mac, basis);
        return;
      }
      let nummer = 2;
      while (bezet.has(sleutel(`${basis} ${nummer}`))) nummer++;
      bezet.add(sleutel(`${basis} ${nummer}`));
      gewenst.set(toestel.mac, `${basis} ${nummer}`);
    });
  }

  for (const toestel of toestellen) {
    const naam = gewenst.get(toestel.mac);
    if (naam === undefined || naam === toestel.name) continue;
    setDeviceName(toestel.mac, naam);
    console.log(`[TOESTEL] ${toestel.mac} heet nu "${naam}" (dubbele naam)`);
    const device = getDevice(toestel.mac);
    if (device) gebeurtenissen.emit('device.updated', device);
  }
}

// Haalt een offline dubbel toestel weg, ook de retained berichten op de broker, zodat het na een herstart niet terugkomt.
// Meldt het toestel zich later opnieuw aan, dan komt het gewoon terug (met een cijfer als de naam bezet is).
function verwijder(mac: string): void {
  const device = getDevice(mac);
  if (!device || !deleteDevice(mac)) return;
  console.log(`[TOESTEL] ${mac} (${device.name ?? 'zonder naam'}) opgeruimd: offline en dubbel met een toestel dat online is`);
  gebeurtenissen.emit('device.removed', { mac });
  const topics = [
    `brouwer/${mac}/info`,
    `brouwer/${mac}/status`,
    ...device.actuators.map((a) => `brouwer/${mac}/actuator/${a.name}/state`),
  ];
  wisRetained(topics).catch((error: Error) => console.warn(`[TOESTEL] retained berichten van ${mac} niet gewist: ${error.message}`));
}

// Na een info- of statusbericht even wachten: bij het (her)verbinden komen alle retained berichten tegelijk binnen,
// en pas daarna is de online-status van elk toestel juist. Zo wordt geen toestel opgeruimd dat eigenlijk online is.
let vertraagd: NodeJS.Timeout | undefined;
export function planOpruimen(): void {
  clearTimeout(vertraagd);
  vertraagd = setTimeout(() => ontdubbelNamen({ opruimen: true }), OPRUIM_VERTRAGING_MS);
  vertraagd.unref();
}

let interval: NodeJS.Timeout | undefined;
export function startOpruimen(): void {
  interval ??= setInterval(() => ontdubbelNamen({ opruimen: true }), OPRUIM_INTERVAL_MS);
  interval.unref();
}

export function stopOpruimen(): void {
  clearInterval(interval);
  clearTimeout(vertraagd);
  interval = undefined;
}
