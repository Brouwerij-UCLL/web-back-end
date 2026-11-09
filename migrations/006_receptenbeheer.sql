ALTER TABLE recipes
  ADD COLUMN basis_volume_liter REAL NOT NULL DEFAULT 20 CHECK (basis_volume_liter > 0);

CREATE TABLE brouwsessies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  recept_id INTEGER REFERENCES recipes(recipe_id) ON DELETE SET NULL,
  recept_naam TEXT NOT NULL,
  doel_volume_liter REAL NOT NULL CHECK (doel_volume_liter > 0),
  schaalfactor REAL NOT NULL CHECK (schaalfactor > 0),
  start_tijd TEXT NOT NULL DEFAULT (datetime('now')),
  eind_tijd TEXT,
  status TEXT NOT NULL DEFAULT 'aangemaakt'
    CHECK (status IN ('aangemaakt', 'bezig', 'voltooid', 'geannuleerd', 'vergist')),
  opmerkingen TEXT
);

CREATE TABLE brouwsessie_stappen (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sessie_id INTEGER NOT NULL REFERENCES brouwsessies(id) ON DELETE CASCADE,
  stap_type TEXT NOT NULL
    CHECK (stap_type IN ('schrooten', 'vullen', 'opwarmen', 'maischen', 'spoelen', 'koken', 'overbrengen', 'vergisten')),
  stap_volgorde INTEGER NOT NULL,
  naam TEXT NOT NULL,
  doel_temperatuur_celsius REAL,
  doel_duur_seconden INTEGER,
  status TEXT NOT NULL DEFAULT 'wachtend'
    CHECK (status IN ('wachtend', 'actief', 'voltooid', 'overgeslagen')),
  gestart_op TEXT,
  afgerond_op TEXT
);

CREATE INDEX idx_brouwsessie_stappen_sessie ON brouwsessie_stappen(sessie_id, stap_volgorde);
