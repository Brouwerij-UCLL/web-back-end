import { getDevices, type Device } from '../devices/queries.ts';

// De ketel en de kast voor een brouwsessie, gevonden via het type in hun info-bericht (er is er telkens één).
// Een sessie kan alleen starten als beide bekend en online zijn en de opdracht 'recept' kennen.

export const KETEL_TYPE = 'ketel';
export const KAST_TYPE = 'kast';

export type BrewDevices = { ok: true; ketel: Device; kast: Device } | { ok: false; problemen: string[] };

// Het toestel met dit type; bij meerdere eerst een toestel dat online is.
function zoek(toestellen: Device[], type: string): Device | undefined {
  const metType = toestellen.filter((toestel) => toestel.type === type);
  return metType.find((toestel) => toestel.online) ?? metType[0];
}

// Wat er mis is met een toestel, of undefined als het klaar is om een recept te ontvangen.
function probleem(toestel: Device | undefined, naam: string, type: string): string | undefined {
  if (!toestel) return `geen ${naam} gevonden (toestel met type '${type}')`;
  if (!toestel.online) return `${naam} ${toestel.mac} is offline`;
  if (!toestel.commands.includes('recept')) return `${naam} ${toestel.mac} kent de opdracht recept niet`;
  return undefined;
}

export function findBrewDevices(): BrewDevices {
  const toestellen = getDevices();
  const ketel = zoek(toestellen, KETEL_TYPE);
  const kast = zoek(toestellen, KAST_TYPE);
  const problemen = [probleem(ketel, 'ketel', KETEL_TYPE), probleem(kast, 'kast', KAST_TYPE)].filter(
    (p): p is string => p !== undefined,
  );
  return problemen.length === 0 ? { ok: true, ketel: ketel!, kast: kast! } : { ok: false, problemen };
}
