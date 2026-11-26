-- Migration 010: Kooktemperatuur en -duur per recept

CREATE TABLE recipe_boil_time (
    recipe_id   INTEGER PRIMARY KEY REFERENCES recipes(recipe_id) ON DELETE CASCADE,
    temperature REAL NOT NULL,
    duration    INTEGER NOT NULL CHECK (duration > 0)
);
