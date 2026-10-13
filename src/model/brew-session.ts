import type { DatabaseSync } from 'node:sqlite';
import { Conflict, NietGevonden, SessieAfgerond, ValidatieFout } from './errors.ts';
import { getRecipe, type Fase } from './recipe.ts';
import { inTransaction } from './transaction.ts';

export type SessieStatus = 'bezig' | 'afgerond' | 'geannuleerd';

// Vanaf deze statussen is een sessie vergrendeld (zelfde lijst als de triggers
// in migrations/002_recept_en_brouwsessie.sql).
export const VERGRENDELDE_STATUSSEN: readonly SessieStatus[] = ['afgerond', 'geannuleerd'];

export interface Sessiestap {
  id: number;
  volgorde: number;
  fase: Fase;
  naam: string;
  temperatuur_celsius: number | null;
  duur_minuten: number | null;
  status: 'wachtend' | 'actief' | 'voltooid';
  gestart_op: string | null;
  afgerond_op: string | null;
}

export interface MetingInvoer {
  bron: string;
  grootheid: string;
  waarde: number;
  eenheid: string;
  tijdstip?: string;
  sessiestap_id?: number | null;
}

export interface Meting extends Required<MetingInvoer> {
  id: number;
}

export interface Gebeurtenis {
  id: number;
  tijdstip: string;
  type: string;
  omschrijving: string | null;
}

export interface Brouwsessie {
  id: number;
  recept_id: number | null;
  recept_naam: string;
  recept_stijl: string | null;
  status: SessieStatus;
  opmerkingen: string | null;
  gestart_op: string;
  afgerond_op: string | null;
  stappen: Sessiestap[];
  metingen: Meting[];
  gebeurtenissen: Gebeurtenis[];
}

// Start een sessie en kopieert in dezelfde transactie de receptwaarden:
// naam en stijl naar brouwsessie, de stappen naar sessiestap.
export function startBrewSession(db: DatabaseSync, receptId: number, opmerkingen: string | null = null): Brouwsessie {
  const id = inTransaction(db, () => {
    const recept = getRecipe(db, receptId);

    const { lastInsertRowid } = db
      .prepare('INSERT INTO brouwsessie (recept_id, recept_naam, recept_stijl, opmerkingen) VALUES (?, ?, ?, ?)')
      .run(recept.id, recept.naam, recept.stijl, opmerkingen);
    const sessieId = Number(lastInsertRowid);

    db.prepare(
      `INSERT INTO sessiestap (sessie_id, volgorde, fase, naam, temperatuur_celsius, duur_minuten)
       SELECT ?, volgorde, fase, naam, temperatuur_celsius, duur_minuten FROM receptstap WHERE recept_id = ?`,
    ).run(sessieId, recept.id);

    logGebeurtenis(db, sessieId, 'sessie_gestart', `gestart met recept '${recept.naam}'`);
    return sessieId;
  });
  return getBrewSession(db, id);
}

// Leest alles uit de sessietabellen; het recept zelf wordt niet geraadpleegd.
export function getBrewSession(db: DatabaseSync, id: number): Brouwsessie {
  const sessie = db
    .prepare('SELECT id, recept_id, recept_naam, recept_stijl, status, opmerkingen, gestart_op, afgerond_op FROM brouwsessie WHERE id = ?')
    .get(id) as Omit<Brouwsessie, 'stappen' | 'metingen' | 'gebeurtenissen'> | undefined;
  if (!sessie) throw new NietGevonden(`brouwsessie ${id} bestaat niet`);

  return {
    ...sessie,
    stappen: rijen(db, 'SELECT * FROM sessiestap WHERE sessie_id = ? ORDER BY volgorde', id).map(
      ({ sessie_id, ...stap }) => stap as unknown as Sessiestap,
    ),
    metingen: rijen(
      db,
      'SELECT id, sessiestap_id, tijdstip, bron, grootheid, waarde, eenheid FROM meting WHERE sessie_id = ? ORDER BY tijdstip, id',
      id,
    ) as unknown as Meting[],
    gebeurtenissen: rijen(
      db,
      'SELECT id, tijdstip, type, omschrijving FROM gebeurtenis WHERE sessie_id = ? ORDER BY tijdstip, id',
      id,
    ) as unknown as Gebeurtenis[],
  };
}

export function listBrewSessions(db: DatabaseSync, receptId?: number): Omit<Brouwsessie, 'stappen' | 'metingen' | 'gebeurtenissen'>[] {
  const select = 'SELECT id, recept_id, recept_naam, recept_stijl, status, opmerkingen, gestart_op, afgerond_op FROM brouwsessie';
  const sessies =
    receptId === undefined
      ? db.prepare(`${select} ORDER BY gestart_op DESC, id DESC`).all()
      : db.prepare(`${select} WHERE recept_id = ? ORDER BY gestart_op DESC, id DESC`).all(receptId);
  return sessies.map((sessie) => ({ ...sessie }) as unknown as Omit<Brouwsessie, 'stappen' | 'metingen' | 'gebeurtenissen'>);
}

// Rondt de actieve stap af en activeert de volgende wachtende stap.
export function nextStep(db: DatabaseSync, sessieId: number): Brouwsessie {
  inTransaction(db, () => {
    controleerNietVergrendeld(db, sessieId);

    const actief = db.prepare("SELECT id, naam FROM sessiestap WHERE sessie_id = ? AND status = 'actief'").get(sessieId) as
      | { id: number; naam: string }
      | undefined;
    if (actief) {
      db.prepare("UPDATE sessiestap SET status = 'voltooid', afgerond_op = CURRENT_TIMESTAMP WHERE id = ?").run(actief.id);
      logGebeurtenis(db, sessieId, 'stap_afgerond', actief.naam);
    }

    const volgende = db
      .prepare("SELECT id, naam FROM sessiestap WHERE sessie_id = ? AND status = 'wachtend' ORDER BY volgorde LIMIT 1")
      .get(sessieId) as { id: number; naam: string } | undefined;
    if (volgende) {
      db.prepare("UPDATE sessiestap SET status = 'actief', gestart_op = CURRENT_TIMESTAMP WHERE id = ?").run(volgende.id);
      logGebeurtenis(db, sessieId, 'stap_gestart', volgende.naam);
    } else if (!actief) {
      throw new Conflict(`brouwsessie ${sessieId} heeft geen stappen meer`);
    }
  });
  return getBrewSession(db, sessieId);
}

export function changeBrewSessionStatus(db: DatabaseSync, sessieId: number, status: SessieStatus): Brouwsessie {
  if (!VERGRENDELDE_STATUSSEN.includes(status)) {
    throw new ValidatieFout(`status moet ${VERGRENDELDE_STATUSSEN.join(' of ')} zijn`);
  }
  inTransaction(db, () => {
    controleerNietVergrendeld(db, sessieId);
    // Eerst de gebeurtenis loggen: na de statuswijziging is de sessie vergrendeld.
    logGebeurtenis(db, sessieId, 'status_gewijzigd', `bezig → ${status}`);
    db.prepare('UPDATE brouwsessie SET status = ?, afgerond_op = CURRENT_TIMESTAMP WHERE id = ?').run(status, sessieId);
  });
  return getBrewSession(db, sessieId);
}

export function updateBrewSessionNotes(db: DatabaseSync, sessieId: number, opmerkingen: string | null): Brouwsessie {
  controleerNietVergrendeld(db, sessieId);
  db.prepare('UPDATE brouwsessie SET opmerkingen = ? WHERE id = ?').run(opmerkingen, sessieId);
  return getBrewSession(db, sessieId);
}

// Zonder sessiestap_id wordt de meting gekoppeld aan de stap die op dat moment actief is.
export function addMeasurement(db: DatabaseSync, sessieId: number, invoer: MetingInvoer): Meting {
  if (typeof invoer?.bron !== 'string' || !invoer.bron) throw new ValidatieFout('bron is verplicht');
  if (typeof invoer.grootheid !== 'string' || !invoer.grootheid) throw new ValidatieFout('grootheid is verplicht');
  if (typeof invoer.waarde !== 'number' || !Number.isFinite(invoer.waarde)) throw new ValidatieFout('waarde moet een getal zijn');
  if (typeof invoer.eenheid !== 'string') throw new ValidatieFout('eenheid is verplicht');

  return inTransaction(db, () => {
    controleerNietVergrendeld(db, sessieId);

    let stapId = invoer.sessiestap_id ?? null;
    if (stapId === null) {
      const actief = db.prepare("SELECT id FROM sessiestap WHERE sessie_id = ? AND status = 'actief'").get(sessieId) as
        | { id: number }
        | undefined;
      stapId = actief?.id ?? null;
    } else if (!db.prepare('SELECT 1 FROM sessiestap WHERE id = ? AND sessie_id = ?').get(stapId, sessieId)) {
      throw new ValidatieFout(`sessiestap ${stapId} hoort niet bij brouwsessie ${sessieId}`);
    }

    const { lastInsertRowid } = db
      .prepare(
        'INSERT INTO meting (sessie_id, sessiestap_id, tijdstip, bron, grootheid, waarde, eenheid) VALUES (?, ?, COALESCE(?, CURRENT_TIMESTAMP), ?, ?, ?, ?)',
      )
      .run(sessieId, stapId, invoer.tijdstip ?? null, invoer.bron, invoer.grootheid, invoer.waarde, invoer.eenheid);
    return {
      ...db.prepare('SELECT id, sessiestap_id, tijdstip, bron, grootheid, waarde, eenheid FROM meting WHERE id = ?').get(lastInsertRowid),
    } as unknown as Meting;
  });
}

export function addEvent(db: DatabaseSync, sessieId: number, type: string, omschrijving: string | null = null): Gebeurtenis {
  if (typeof type !== 'string' || !type) throw new ValidatieFout('type is verplicht');
  return inTransaction(db, () => {
    controleerNietVergrendeld(db, sessieId);
    const id = logGebeurtenis(db, sessieId, type, omschrijving);
    return { ...db.prepare('SELECT id, tijdstip, type, omschrijving FROM gebeurtenis WHERE id = ?').get(id) } as unknown as Gebeurtenis;
  });
}

function controleerNietVergrendeld(db: DatabaseSync, sessieId: number): void {
  const sessie = db.prepare('SELECT status FROM brouwsessie WHERE id = ?').get(sessieId) as { status: SessieStatus } | undefined;
  if (!sessie) throw new NietGevonden(`brouwsessie ${sessieId} bestaat niet`);
  if (VERGRENDELDE_STATUSSEN.includes(sessie.status)) throw new SessieAfgerond(sessieId);
}

function logGebeurtenis(db: DatabaseSync, sessieId: number, type: string, omschrijving: string | null): number {
  const { lastInsertRowid } = db
    .prepare('INSERT INTO gebeurtenis (sessie_id, type, omschrijving) VALUES (?, ?, ?)')
    .run(sessieId, type, omschrijving);
  return Number(lastInsertRowid);
}

// node:sqlite geeft rijen met een null-prototype; spread maakt er gewone objecten van.
function rijen(db: DatabaseSync, sql: string, id: number): Record<string, unknown>[] {
  return db.prepare(sql).all(id).map((rij) => ({ ...rij }));
}
