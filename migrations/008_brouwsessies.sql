CREATE TABLE IF NOT EXISTS brouwsessies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    recept_id INTEGER,
    recept_naam TEXT NOT NULL,
    doel_volume_liter REAL NOT NULL,
    schaalfactor REAL NOT NULL,
    start_tijd DATETIME DEFAULT CURRENT_TIMESTAMP,
    eind_tijd DATETIME,
    status TEXT CHECK(status IN ('aangemaakt', 'bezig', 'voltooid', 'geannuleerd', 'vergist')) NOT NULL DEFAULT 'aangemaakt',
    opmerkingen TEXT,
    recept_snapshot TEXT NOT NULL CHECK (json_valid(recept_snapshot)),
    geschaalde_hoeveelheden TEXT NOT NULL CHECK (json_valid(geschaalde_hoeveelheden))
);