import type { DatabaseSync } from 'node:sqlite';

// Voert fn uit in een transactie: alles lukt, of er wordt niets opgeslagen.
export function inTransaction<T>(db: DatabaseSync, fn: () => T): T {
  db.exec('BEGIN');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}
