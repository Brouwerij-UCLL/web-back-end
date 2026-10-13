import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

// SQLite (ingebouwd in Node): de volledige database is één lokaal bestand.
const file = process.env.DATABASE_FILE ?? './data/app.db';
mkdirSync(dirname(file), { recursive: true });

export const db = new DatabaseSync(file);

// Controleert of de database bereikbaar is (werkt ook met een lege database).
export function checkDatabaseConnection(): void {
  db.prepare('SELECT 1').get();
}
