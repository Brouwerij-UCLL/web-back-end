import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { config } from '../config.ts';

// SQLite (ingebouwd in Node): de volledige database is één lokaal bestand.
const file = config.databaseFile;
mkdirSync(dirname(file), { recursive: true });

export const db = new DatabaseSync(file);

// Controleert of de database bereikbaar is (werkt ook met een lege database).
export function checkDatabaseConnection(): void {
  db.prepare('SELECT 1').get();
}
