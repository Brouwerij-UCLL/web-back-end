import { db } from '../db.ts';

// Brouwsessies (tabel brew_sessions). Een sessie bewaart een kopie van het geschaalde recept
// (recipe_snapshot), zodat ze ongewijzigd blijft als het recept later verandert of verwijderd wordt.

export const BREW_SESSION_STATUSES = ['gestart', 'bezig', 'klaar', 'mislukt'] as const;
export type BrewSessionStatus = (typeof BREW_SESSION_STATUSES)[number];

// Een sessie met deze status loopt nog: dan mag er geen nieuwe starten.
const LOPEND: BrewSessionStatus[] = ['gestart', 'bezig'];
// Bij deze status is de sessie afgelopen en krijgt ze een eindtijd.
const AFGELOPEN: BrewSessionStatus[] = ['klaar', 'mislukt'];

export type BrewSession<Snapshot = unknown> = {
  id: number;
  recipe_id: number | null;
  volume_l: number;
  scale_factor: number;
  recipe_snapshot: Snapshot;
  status: BrewSessionStatus;
  started_at: string;
  ended_at: string | null;
};

export type NewBrewSession<Snapshot = unknown> = {
  recipe_id: number;
  volume_l: number;
  scale_factor: number;
  recipe_snapshot: Snapshot;
};

type Rij = Omit<BrewSession, 'recipe_snapshot'> & { recipe_snapshot: string };

const kolommen = 'id, recipe_id, volume_l, scale_factor, recipe_snapshot, status, started_at, ended_at';

function naarSessie(rij: Rij): BrewSession {
  return { ...rij, recipe_snapshot: JSON.parse(rij.recipe_snapshot) };
}

// Slaat een nieuwe sessie op met status 'gestart' en geeft ze terug.
export function createBrewSession<Snapshot>(sessie: NewBrewSession<Snapshot>): BrewSession<Snapshot> {
  const { lastInsertRowid } = db
    .prepare('INSERT INTO brew_sessions (recipe_id, volume_l, scale_factor, recipe_snapshot) VALUES (?, ?, ?, ?)')
    .run(sessie.recipe_id, sessie.volume_l, sessie.scale_factor, JSON.stringify(sessie.recipe_snapshot));
  return getBrewSession(Number(lastInsertRowid)) as BrewSession<Snapshot>;
}

export function getBrewSession(id: number): BrewSession | undefined {
  const rij = db.prepare(`SELECT ${kolommen} FROM brew_sessions WHERE id = ?`).get(id) as Rij | undefined;
  return rij ? naarSessie({ ...rij }) : undefined;
}

// De sessie die nog loopt (gestart of bezig); undefined als er geen is.
export function getRunningBrewSession(): BrewSession | undefined {
  const rij = db
    .prepare(`SELECT ${kolommen} FROM brew_sessions WHERE status IN (${LOPEND.map(() => '?').join(', ')}) ORDER BY id DESC LIMIT 1`)
    .get(...LOPEND) as Rij | undefined;
  return rij ? naarSessie({ ...rij }) : undefined;
}

// Zet de status van een sessie. Bij 'klaar' of 'mislukt' wordt ook de eindtijd ingevuld.
// undefined als de sessie niet bestaat.
export function setBrewSessionStatus(id: number, status: BrewSessionStatus): BrewSession | undefined {
  const eindtijd = AFGELOPEN.includes(status) ? "datetime('now')" : 'ended_at';
  db.prepare(`UPDATE brew_sessions SET status = ?, ended_at = ${eindtijd} WHERE id = ?`).run(status, id);
  return getBrewSession(id);
}
