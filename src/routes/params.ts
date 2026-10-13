import { ValidatieFout } from '../model/errors.ts';

export function parseId(waarde: string | undefined, naam = 'id'): number {
  const id = Number(waarde);
  if (!Number.isInteger(id) || id <= 0) throw new ValidatieFout(`${naam} moet een positief geheel getal zijn`);
  return id;
}
