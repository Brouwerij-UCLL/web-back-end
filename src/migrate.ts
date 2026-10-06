import { readdirSync, readFileSync } from 'node:fs';
import { db } from './db.ts';

const migrationsDir = new URL('../migrations/', import.meta.url);

// Voert alle nog niet uitgevoerde .sql-bestanden uit de map migrations uit, in alfabetische volgorde.
export default function migrate(): void {
  db.exec('CREATE TABLE IF NOT EXISTS migrations (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL)');
  const applied = new Set(db.prepare('SELECT name FROM migrations').all().map((row) => row.name));

  const files = readdirSync(migrationsDir).filter((file) => file.endsWith('.sql')).sort();
  for (const name of files) {
    if (applied.has(name)) continue;
    db.exec('BEGIN');
    try {
      db.exec(readFileSync(new URL(name, migrationsDir), 'utf8'));
      db.prepare('INSERT INTO migrations (name, applied_at) VALUES (?, ?)').run(name, new Date().toISOString());
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw new Error(`migratie ${name} is mislukt: ${(error as Error).message}`);
    }
    console.log(`migratie uitgevoerd: ${name}`);
  }
}
