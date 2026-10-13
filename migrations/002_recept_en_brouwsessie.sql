--------------------------------------------------------------------------------
-- RECEPT & BROUWSESSIE ALS APARTE ENTITEITEN
--------------------------------------------------------------------------------
-- Een recept is een sjabloon dat mag veranderen. Een brouwsessie is één
-- concrete brouwbeurt: bij de start worden de receptwaarden gekopieerd naar de
-- sessie (brouwsessie + sessiestap), zodat de historiek niet verandert wanneer
-- het recept later aangepast of verwijderd wordt.

-- Sjabloon
CREATE TABLE IF NOT EXISTS recept (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    naam TEXT NOT NULL,
    stijl TEXT,
    beschrijving TEXT,
    aangemaakt_op DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    gewijzigd_op DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Stappen van het sjabloon (maischen, koken, vergisten, ...)
CREATE TABLE IF NOT EXISTS receptstap (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    recept_id INTEGER NOT NULL,
    volgorde INTEGER NOT NULL,
    fase TEXT CHECK(fase IN ('schrooten', 'vullen', 'opwarmen', 'maischen', 'spoelen', 'koken', 'overbrengen', 'vergisten')) NOT NULL,
    naam TEXT NOT NULL,
    temperatuur_celsius REAL,
    duur_minuten INTEGER CHECK(duur_minuten IS NULL OR duur_minuten >= 0),
    UNIQUE (recept_id, volgorde),
    FOREIGN KEY (recept_id) REFERENCES recept(id) ON DELETE CASCADE
);

-- Eén concrete brouwbeurt. recept_naam en recept_stijl zijn kopieën van het
-- recept bij de start; recept_id wordt NULL als het recept verwijderd wordt.
CREATE TABLE IF NOT EXISTS brouwsessie (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    recept_id INTEGER,
    recept_naam TEXT NOT NULL,
    recept_stijl TEXT,
    status TEXT CHECK(status IN ('bezig', 'afgerond', 'geannuleerd')) NOT NULL DEFAULT 'bezig',
    opmerkingen TEXT,
    gestart_op DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    afgerond_op DATETIME,
    FOREIGN KEY (recept_id) REFERENCES recept(id) ON DELETE SET NULL
);

-- Kopie van de receptstappen bij de start, plus de voortgang van de uitvoering
CREATE TABLE IF NOT EXISTS sessiestap (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sessie_id INTEGER NOT NULL,
    volgorde INTEGER NOT NULL,
    fase TEXT CHECK(fase IN ('schrooten', 'vullen', 'opwarmen', 'maischen', 'spoelen', 'koken', 'overbrengen', 'vergisten')) NOT NULL,
    naam TEXT NOT NULL,
    temperatuur_celsius REAL,
    duur_minuten INTEGER,
    status TEXT CHECK(status IN ('wachtend', 'actief', 'voltooid')) NOT NULL DEFAULT 'wachtend',
    gestart_op DATETIME,
    afgerond_op DATETIME,
    UNIQUE (sessie_id, volgorde),
    FOREIGN KEY (sessie_id) REFERENCES brouwsessie(id) ON DELETE CASCADE
);

-- Sensorwaarden en handmatige metingen tijdens een sessie
CREATE TABLE IF NOT EXISTS meting (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sessie_id INTEGER NOT NULL,
    sessiestap_id INTEGER,
    tijdstip DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    bron TEXT NOT NULL,          -- bijv. 'ketel/temperatuur' of 'handmatig'
    grootheid TEXT NOT NULL,     -- bijv. 'temperatuur', 'sg'
    waarde REAL NOT NULL,
    eenheid TEXT NOT NULL,       -- bijv. '°C'
    FOREIGN KEY (sessie_id) REFERENCES brouwsessie(id) ON DELETE CASCADE,
    FOREIGN KEY (sessiestap_id) REFERENCES sessiestap(id) ON DELETE SET NULL
);

-- Statuswijzigingen, stapovergangen en andere voorvallen tijdens een sessie
CREATE TABLE IF NOT EXISTS gebeurtenis (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sessie_id INTEGER NOT NULL,
    tijdstip DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    type TEXT NOT NULL,          -- bijv. 'sessie_gestart', 'status_gewijzigd', 'stap_gestart'
    omschrijving TEXT,
    FOREIGN KEY (sessie_id) REFERENCES brouwsessie(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_receptstap_recept ON receptstap(recept_id, volgorde);
CREATE INDEX IF NOT EXISTS idx_brouwsessie_recept ON brouwsessie(recept_id);
CREATE INDEX IF NOT EXISTS idx_sessiestap_sessie ON sessiestap(sessie_id, volgorde);
CREATE INDEX IF NOT EXISTS idx_meting_sessie_tijdstip ON meting(sessie_id, tijdstip);
CREATE INDEX IF NOT EXISTS idx_gebeurtenis_sessie_tijdstip ON gebeurtenis(sessie_id, tijdstip);


--------------------------------------------------------------------------------
-- AFGERONDE SESSIES VERGRENDELEN
--------------------------------------------------------------------------------
-- De API weigert wijzigingen al met 409. Deze triggers zijn het vangnet in de
-- database zelf, zodat ook losse SQL een afgeronde sessie niet kan aanpassen.
-- recept_id staat bewust niet in de lijst: die wordt NULL bij het verwijderen
-- van het recept.

CREATE TRIGGER IF NOT EXISTS brouwsessie_vergrendeld_update
BEFORE UPDATE OF recept_naam, recept_stijl, status, opmerkingen, gestart_op, afgerond_op ON brouwsessie
WHEN OLD.status IN ('afgerond', 'geannuleerd')
BEGIN
    SELECT RAISE(ABORT, 'brouwsessie is afgerond en kan niet gewijzigd worden');
END;

CREATE TRIGGER IF NOT EXISTS brouwsessie_vergrendeld_delete
BEFORE DELETE ON brouwsessie
WHEN OLD.status IN ('afgerond', 'geannuleerd')
BEGIN
    SELECT RAISE(ABORT, 'brouwsessie is afgerond en kan niet gewijzigd worden');
END;

CREATE TRIGGER IF NOT EXISTS sessiestap_vergrendeld_insert
BEFORE INSERT ON sessiestap
WHEN (SELECT status FROM brouwsessie WHERE id = NEW.sessie_id) IN ('afgerond', 'geannuleerd')
BEGIN
    SELECT RAISE(ABORT, 'brouwsessie is afgerond en kan niet gewijzigd worden');
END;

CREATE TRIGGER IF NOT EXISTS sessiestap_vergrendeld_update
BEFORE UPDATE ON sessiestap
WHEN (SELECT status FROM brouwsessie WHERE id = OLD.sessie_id) IN ('afgerond', 'geannuleerd')
BEGIN
    SELECT RAISE(ABORT, 'brouwsessie is afgerond en kan niet gewijzigd worden');
END;

CREATE TRIGGER IF NOT EXISTS sessiestap_vergrendeld_delete
BEFORE DELETE ON sessiestap
WHEN (SELECT status FROM brouwsessie WHERE id = OLD.sessie_id) IN ('afgerond', 'geannuleerd')
BEGIN
    SELECT RAISE(ABORT, 'brouwsessie is afgerond en kan niet gewijzigd worden');
END;

CREATE TRIGGER IF NOT EXISTS meting_vergrendeld_insert
BEFORE INSERT ON meting
WHEN (SELECT status FROM brouwsessie WHERE id = NEW.sessie_id) IN ('afgerond', 'geannuleerd')
BEGIN
    SELECT RAISE(ABORT, 'brouwsessie is afgerond en kan niet gewijzigd worden');
END;

CREATE TRIGGER IF NOT EXISTS meting_vergrendeld_update
BEFORE UPDATE ON meting
WHEN (SELECT status FROM brouwsessie WHERE id = OLD.sessie_id) IN ('afgerond', 'geannuleerd')
BEGIN
    SELECT RAISE(ABORT, 'brouwsessie is afgerond en kan niet gewijzigd worden');
END;

CREATE TRIGGER IF NOT EXISTS meting_vergrendeld_delete
BEFORE DELETE ON meting
WHEN (SELECT status FROM brouwsessie WHERE id = OLD.sessie_id) IN ('afgerond', 'geannuleerd')
BEGIN
    SELECT RAISE(ABORT, 'brouwsessie is afgerond en kan niet gewijzigd worden');
END;

CREATE TRIGGER IF NOT EXISTS gebeurtenis_vergrendeld_insert
BEFORE INSERT ON gebeurtenis
WHEN (SELECT status FROM brouwsessie WHERE id = NEW.sessie_id) IN ('afgerond', 'geannuleerd')
BEGIN
    SELECT RAISE(ABORT, 'brouwsessie is afgerond en kan niet gewijzigd worden');
END;

CREATE TRIGGER IF NOT EXISTS gebeurtenis_vergrendeld_update
BEFORE UPDATE ON gebeurtenis
WHEN (SELECT status FROM brouwsessie WHERE id = OLD.sessie_id) IN ('afgerond', 'geannuleerd')
BEGIN
    SELECT RAISE(ABORT, 'brouwsessie is afgerond en kan niet gewijzigd worden');
END;

CREATE TRIGGER IF NOT EXISTS gebeurtenis_vergrendeld_delete
BEFORE DELETE ON gebeurtenis
WHEN (SELECT status FROM brouwsessie WHERE id = OLD.sessie_id) IN ('afgerond', 'geannuleerd')
BEGIN
    SELECT RAISE(ABORT, 'brouwsessie is afgerond en kan niet gewijzigd worden');
END;
