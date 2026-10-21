-- Migration 003: Drop oude tabellen en maak de nieuwe receptstructuur aan
-- Let op: Dit verwijdert alle bestaande receptdata en start met een schone lei voor de nieuwe tabellen.

-- 1. Verwijder de oude tabellen (in omgekeerde volgorde vanwege foreign keys)
DROP TABLE IF EXISTS recept_vergistingsstappen;
DROP TABLE IF EXISTS recept_maischstappen;
DROP TABLE IF EXISTS recept_extra_toevoegingen;
DROP TABLE IF EXISTS recept_hoppen;
DROP TABLE IF EXISTS recept_water;
DROP TABLE IF EXISTS recept_ingredienten;
DROP TABLE IF EXISTS recept_kookinstellingen;
DROP TABLE IF EXISTS recepten;

-- 2. Maak de nieuwe tabellen aan

CREATE TABLE recipes (
    recipe_id        INTEGER PRIMARY KEY AUTOINCREMENT,
    name             TEXT NOT NULL,
    beer_style       TEXT,
    description      TEXT,
    timestamp_create TEXT NOT NULL DEFAULT (datetime('now')),
    timestamp_edit   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE ingredients (
    ingredient_id INTEGER PRIMARY KEY AUTOINCREMENT,
    name          TEXT NOT NULL,
    manufacturer  TEXT
);

CREATE TABLE recipe_ingredients (
    recipe_id     INTEGER NOT NULL REFERENCES recipes(recipe_id) ON DELETE CASCADE,
    ingredient_id INTEGER NOT NULL REFERENCES ingredients(ingredient_id) ON DELETE RESTRICT,
    amount_g      REAL NOT NULL CHECK (amount_g > 0),
    PRIMARY KEY (recipe_id, ingredient_id)
);

CREATE TABLE recipe_water (
    recipe_id      INTEGER PRIMARY KEY REFERENCES recipes(recipe_id) ON DELETE CASCADE,
    mash_water_l   REAL NOT NULL CHECK (mash_water_l >= 0),
    sparge_water_l REAL NOT NULL CHECK (sparge_water_l >= 0)
);

CREATE TABLE hops (
    hop_id                INTEGER PRIMARY KEY AUTOINCREMENT,
    name                  TEXT NOT NULL,
    alpha_acid_percentage REAL CHECK (alpha_acid_percentage BETWEEN 0 AND 100),
    type                  INTEGER NOT NULL CHECK (type IN (0, 1)), -- 0 = bloemen, 1 = pellet
    origin                TEXT
);

CREATE TABLE hop_additions (
    recipe_id     INTEGER NOT NULL REFERENCES recipes(recipe_id) ON DELETE CASCADE,
    hop_id        INTEGER NOT NULL REFERENCES hops(hop_id) ON DELETE RESTRICT,
    amount        REAL NOT NULL CHECK (amount > 0),
    boil_time_min INTEGER NOT NULL CHECK (boil_time_min >= 0),
    PRIMARY KEY (recipe_id, hop_id)
);

CREATE TABLE extra_ingredients (
    extra_ingredient_id INTEGER PRIMARY KEY AUTOINCREMENT,
    name                TEXT NOT NULL,
    description         TEXT,
    unit                TEXT NOT NULL
);

CREATE TABLE recipe_extras (
    recipe_id           INTEGER NOT NULL REFERENCES recipes(recipe_id) ON DELETE CASCADE,
    extra_ingredient_id INTEGER NOT NULL REFERENCES extra_ingredients(extra_ingredient_id) ON DELETE RESTRICT,
    amount              REAL NOT NULL CHECK (amount > 0),
    add_moment          TEXT NOT NULL CHECK (add_moment IN ('beslag', 'koken')),
    boil_time           INTEGER CHECK (boil_time >= 0),
    CHECK (add_moment = 'koken' OR boil_time IS NULL),
    PRIMARY KEY (recipe_id, extra_ingredient_id)
);

CREATE TABLE recipe_mash_steps (
    recipe_id   INTEGER NOT NULL REFERENCES recipes(recipe_id) ON DELETE CASCADE,
    step_nr     INTEGER NOT NULL CHECK (step_nr > 0),
    temperature REAL NOT NULL,
    duration    INTEGER NOT NULL CHECK (duration > 0),
    PRIMARY KEY (recipe_id, step_nr)
);

CREATE TABLE recipe_fermentation_steps (
    recipe_id   INTEGER NOT NULL REFERENCES recipes(recipe_id) ON DELETE CASCADE,
    step_nr     INTEGER NOT NULL CHECK (step_nr > 0),
    temperature REAL NOT NULL,
    duration    INTEGER NOT NULL CHECK (duration > 0),
    PRIMARY KEY (recipe_id, step_nr)
);

-- 3. Indexes en Triggers aanmaken

CREATE INDEX idx_recipe_ingredients_ingredient ON recipe_ingredients(ingredient_id);
CREATE INDEX idx_hop_additions_hop             ON hop_additions(hop_id);
CREATE INDEX idx_recipe_extras_extra           ON recipe_extras(extra_ingredient_id);

CREATE TRIGGER trg_recipes_timestamp_edit
AFTER UPDATE ON recipes
FOR EACH ROW
WHEN NEW.timestamp_edit = OLD.timestamp_edit
BEGIN
    UPDATE recipes SET timestamp_edit = datetime('now') WHERE recipe_id = NEW.recipe_id;
END;
