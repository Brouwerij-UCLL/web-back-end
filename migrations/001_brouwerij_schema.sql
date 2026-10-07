--------------------------------------------------------------------------------
-- 1. RECEPTEN & TEMPLATES (BEHEER VAN BIERRECEPTEN)
--------------------------------------------------------------------------------

-- Algemene gegevens van een recept
CREATE TABLE IF NOT EXISTS recepten (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    naam TEXT NOT NULL,
    bierstijl TEXT,
    beschrijving TEXT,
    basis_volume_liter REAL NOT NULL, -- Oorspronkelijk brouwvolume (bijv. 20.0 L)
    aangemaakt_op DATETIME DEFAULT CURRENT_TIMESTAMP,
    gewijzigd_op DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Waterhoeveelheden gekoppeld aan het basisvolume
CREATE TABLE IF NOT EXISTS recept_water (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    recept_id INTEGER NOT NULL,
    maischwater_liter REAL NOT NULL,
    spoelwater_liter REAL NOT NULL,
    FOREIGN KEY (recept_id) REFERENCES recepten(id) ON DELETE CASCADE
);

-- Vergistbare ingrediënten (mouten, suikers, etc.)
CREATE TABLE IF NOT EXISTS recept_ingredienten (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    recept_id INTEGER NOT NULL,
    naam TEXT NOT NULL,
    fabrikant TEXT,
    hoeveelheid_kg REAL NOT NULL,
    FOREIGN KEY (recept_id) REFERENCES recepten(id) ON DELETE CASCADE
);

-- Hopgiften
CREATE TABLE IF NOT EXISTS recept_hoppen (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    recept_id INTEGER NOT NULL,
    naam TEXT NOT NULL,
    alfazuur_percentage REAL NOT NULL,
    type TEXT CHECK(type IN ('pellet', 'bloemen')) NOT NULL DEFAULT 'pellet',
    herkomst TEXT,
    hoeveelheid_gram REAL NOT NULL,
    kooktijd_minuten INTEGER NOT NULL,
    FOREIGN KEY (recept_id) REFERENCES recepten(id) ON DELETE CASCADE
);

-- Extra ingrediënten (kruiden, specerijen, etc.)
CREATE TABLE IF NOT EXISTS recept_extra_toevoegingen (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    recept_id INTEGER NOT NULL,
    naam TEXT NOT NULL,
    omschrijving TEXT,
    hoeveelheid REAL NOT NULL,
    eenheid TEXT NOT NULL, -- bijv. 'g', 'ml', 'stuks'
    toevoegmoment TEXT CHECK(toevoegmoment IN ('beslag', 'koken')) NOT NULL,
    kooktijd_minuten INTEGER DEFAULT 0, -- Alleen van toepassing als toevoegmoment = 'koken'
    FOREIGN KEY (recept_id) REFERENCES recepten(id) ON DELETE CASCADE
);

-- Maischschema (stappen)
CREATE TABLE IF NOT EXISTS recept_maischstappen (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    recept_id INTEGER NOT NULL,
    stap_volgorde INTEGER NOT NULL,
    temperatuur_celsius REAL NOT NULL,
    duur_minuten INTEGER NOT NULL,
    FOREIGN KEY (recept_id) REFERENCES recepten(id) ON DELETE CASCADE
);

-- Kookstap instelling per recept
CREATE TABLE IF NOT EXISTS recept_kookinstellingen (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    recept_id INTEGER UNIQUE NOT NULL,
    kooktijd_minuten INTEGER NOT NULL,
    FOREIGN KEY (recept_id) REFERENCES recepten(id) ON DELETE CASCADE
);

-- Vergistingsschema (stappen)
CREATE TABLE IF NOT EXISTS recept_vergistingsstappen (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    recept_id INTEGER NOT NULL,
    stap_volgorde INTEGER NOT NULL,
    temperatuur_celsius REAL NOT NULL,
    duur_dagen INTEGER NOT NULL,
    FOREIGN KEY (recept_id) REFERENCES recepten(id) ON DELETE CASCADE
);


--------------------------------------------------------------------------------
-- 2. BROUWSESSIES & UITVOERING (HISTORIEK EN PROCESSEN)
--------------------------------------------------------------------------------

-- Een concrete uitvoering van een recept
CREATE TABLE IF NOT EXISTS brouwsessies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    recept_id INTEGER, -- Mag NULL worden als het originele recept ooit gewist wordt
    recept_naam TEXT NOT NULL, -- Momentopname van de receptnaam
    doel_volume_liter REAL NOT NULL, -- Gekozen volume voor deze specifieke sessie
    schaalfactor REAL NOT NULL, -- Berekend: doel_volume_liter / basis_volume_liter
    start_tijd DATETIME DEFAULT CURRENT_TIMESTAMP,
    eind_tijd DATETIME,
    status TEXT CHECK(status IN ('aangemaakt', 'bezig', 'voltooid', 'geannuleerd', 'vergist')) NOT NULL DEFAULT 'aangemaakt',
    opmerkingen TEXT,
    FOREIGN KEY (recept_id) REFERENCES recepten(id) ON DELETE SET NULL
);

-- Bewaart de geschaalde en unieke stappen voor déze brouwsessie
CREATE TABLE IF NOT EXISTS brouwsessie_stappen (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sessie_id INTEGER NOT NULL,
    stap_type TEXT CHECK(stap_type IN ('schrooten', 'vullen', 'opwarmen', 'maischen', 'spoelen', 'koken', 'overbrengen', 'vergisten')) NOT NULL,
    stap_volgorde INTEGER NOT NULL,
    naam TEXT NOT NULL,
    doel_temperatuur_celsius REAL,
    doel_duur_seconden INTEGER,
    status TEXT CHECK(status IN ('wachtend', 'actief', 'voltooid', 'overgeslagen')) NOT NULL DEFAULT 'wachtend',
    gestart_op DATETIME,
    afgerond_op DATETIME,
    FOREIGN KEY (sessie_id) REFERENCES brouwsessies(id) ON DELETE CASCADE
);


--------------------------------------------------------------------------------
-- 3. MONITORING, REAL-TIME LOGGING & FOUTMELDINGEN
--------------------------------------------------------------------------------

-- Telemetrie en sensorwaarden tijdens het brouwproces (maischen / koken)
CREATE TABLE IF NOT EXISTS brouwketel_loggegevens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sessie_id INTEGER NOT NULL,
    tijdstip DATETIME DEFAULT CURRENT_TIMESTAMP,
    gemeten_temperatuur REAL NOT NULL,
    doel_temperatuur REAL,
    verwarming_status INTEGER CHECK(verwarming_status IN (0, 1)) NOT NULL, -- 0 = Uit, 1 = Aan
    verwarming_vermogen_procent REAL DEFAULT 0.0, -- Modulerend vermogen (0.0% tot 100.0%)
    pomp_status INTEGER CHECK(pomp_status IN (0, 1)) NOT NULL, -- 0 = Uit, 1 = Aan
    actieve_stap_id INTEGER, -- Koppeling naar de huidige stap in de wizard
    FOREIGN KEY (sessie_id) REFERENCES brouwsessies(id) ON DELETE CASCADE,
    FOREIGN KEY (actieve_stap_id) REFERENCES brouwsessie_stappen(id) ON DELETE SET NULL
);

-- Telemetrie en handmatige invoer voor de klimaatkast / gistingstank
CREATE TABLE IF NOT EXISTS vergisting_loggegevens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sessie_id INTEGER NOT NULL,
    tijdstip DATETIME DEFAULT CURRENT_TIMESTAMP,
    gemeten_temperatuur REAL NOT NULL,
    doel_temperatuur REAL NOT NULL,
    klimaatkast_modus TEXT CHECK(klimaatkast_modus IN ('uit', 'verwarmen', 'koelen', 'rust')) NOT NULL DEFAULT 'uit',
    sg_waarde REAL, -- Handmatig ingegeven of gemeten SG-waarde (Specific Gravity)
    FOREIGN KEY (sessie_id) REFERENCES brouwsessies(id) ON DELETE CASCADE
);

-- Systeemmeldingen, fouten en alarmsituaties
CREATE TABLE IF NOT EXISTS systeem_meldingen (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sessie_id INTEGER,
    tijdstip DATETIME DEFAULT CURRENT_TIMESTAMP,
    ernst TEXT CHECK(ernst IN ('info', 'waarschuwing', 'fout', 'kritiek')) NOT NULL,
    bericht TEXT NOT NULL,
    opgelost INTEGER CHECK(opgelost IN (0, 1)) DEFAULT 0,
    FOREIGN KEY (sessie_id) REFERENCES brouwsessies(id) ON DELETE CASCADE
);


--------------------------------------------------------------------------------
-- 4. INDEXEN VOOR SNELLE QUERIES (DASHBOARDS & GRAFIEKEN)
--------------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_brouwketel_log_sessie ON brouwketel_loggegevens(sessie_id, tijdstip);
CREATE INDEX IF NOT EXISTS idx_vergisting_log_sessie ON vergisting_loggegevens(sessie_id, tijdstip);
CREATE INDEX IF NOT EXISTS idx_brouwsessie_stappen_sessie ON brouwsessie_stappen(sessie_id, stap_volgorde);
CREATE INDEX IF NOT EXISTS idx_systeem_meldingen_sessie ON systeem_meldingen(sessie_id, tijdstip);