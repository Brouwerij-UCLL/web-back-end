import knex from 'knex';
import { fileURLToPath } from 'node:url';

const database = knex({
  client: 'better-sqlite3',
  connection: {
    filename: fileURLToPath(new URL('../database.sqlite', import.meta.url)),
  },
  useNullAsDefault: true,
  migrations: {
    directory: fileURLToPath(new URL('../migrations', import.meta.url)),
    loadExtensions: ['.js'],
  },
});

export default async function migrate(): Promise<void> {
  try {
    await database.migrate.latest();
  } finally {
    await database.destroy();
  }
}
