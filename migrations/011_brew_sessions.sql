-- Migration 011: Brouwsessies
-- Een brouwsessie start een recept op een gekozen volume. De sessie bewaart een kopie van het
-- geschaalde recept (recipe_snapshot), zodat ze ongewijzigd blijft als het recept later verandert.
-- Statussen: gestart (recept naar ketel en kast gestuurd), bezig, klaar, mislukt.

CREATE TABLE brew_sessions (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    recipe_id       INTEGER REFERENCES recipes(recipe_id) ON DELETE SET NULL, -- leeg als het recept verwijderd is
    volume_l        REAL NOT NULL CHECK (volume_l > 0),
    scale_factor    REAL NOT NULL CHECK (scale_factor > 0),             -- volume_l / base_volume_l
    recipe_snapshot TEXT NOT NULL CHECK (json_valid(recipe_snapshot)),   -- het geschaalde recept als JSON
    status          TEXT NOT NULL DEFAULT 'gestart' CHECK (status IN ('gestart', 'bezig', 'klaar', 'mislukt')),
    started_at      TEXT NOT NULL DEFAULT (datetime('now')),
    ended_at        TEXT
);

CREATE INDEX idx_brew_sessions_status ON brew_sessions(status);
