--------------------------------------------------------------------------------
-- 1. RECEPTEN & TEMPLATES (BEHEER VAN BIERRECEPTEN)
--------------------------------------------------------------------------------

-- Algemene gegevens van een recept[cite: 1]
CREATE TABLE IF NOT EXISTS recepten (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    naam TEXT NOT NULL,[cite: 1]
    bierstijl TEXT,[cite: 1]
    beschrijving TEXT,[cite: 1]
    basis_volume_liter REAL NOT NULL, -- Oorspronkelijk brouwvolume (bijv. 20.0 L)[cite: 1]
    aangemaakt_op DATETIME DEFAULT CURRENT_TIMESTAMP,
    gewijzigd_op DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Waterhoeveelheden gekoppeld aan het basisvolume[cite: 1]
CREATE TABLE IF NOT EXISTS recept_water (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    recept_id INTEGER NOT NULL,
    maischwater_liter REAL NOT NULL,[cite: 1]
    spoelwater_liter REAL NOT NULL,[cite: 1]
    FOREIGN KEY (recept_id) REFERENCES recepten(id) ON DELETE CASCADE
);

-- Vergistbare ingrediënten (mouten, suikers, etc.)[cite: 1]
CREATE TABLE IF NOT EXISTS recept_ingredienten (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    recept_id INTEGER NOT NULL,
    naam TEXT NOT NULL,[cite: 1]
    fabrikant TEXT,[cite: 1]
    hoeveelheid_kg REAL NOT NULL,[cite: 1]
    FOREIGN KEY (recept_id) REFERENCES recepten(id) ON DELETE CASCADE
);

-- Hopgiften[cite: 1]
CREATE TABLE IF NOT EXISTS recept_hoppen (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    recept_id INTEGER NOT NULL,
    naam TEXT NOT NULL,[cite: 1]
    alfazuur_percentage REAL NOT NULL,[cite: 1]
    type TEXT CHECK(type IN ('pellet', 'bloemen')) NOT NULL DEFAULT 'pellet',[cite: 1]
    herkomst TEXT,[cite: 1]
    hoeveelheid_gram REAL NOT NULL,[cite: 1]
    kooktijd_minuten INTEGER NOT NULL,[cite: 1]
    FOREIGN KEY (recept_id) REFERENCES recepten(id) ON DELETE CASCADE
);

-- Extra ingrediënten (kruiden, specerijen, etc.)[cite: 1]
CREATE TABLE IF NOT EXISTS recept_extra_toevoegingen (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    recept_id INTEGER NOT NULL,
    naam TEXT NOT NULL,[cite: 1]
    omschrijving TEXT,[cite: 1]
    hoeveelheid REAL NOT NULL,[cite: 1]
    eenheid TEXT NOT NULL, -- bijv. 'g', 'ml', 'stuks'[cite: 1]
    toevoegmoment TEXT CHECK(toevoegmoment IN ('beslag', 'koken')) NOT NULL,[cite: 1]
    kooktijd_minuten INTEGER DEFAULT 0, -- Alleen van toepassing als toevoegmoment = 'koken'[cite: 1]
    FOREIGN KEY (recept_id) REFERENCES recepten(id) ON DELETE CASCADE
);

-- Maischschema (stappen)[cite: 1]
CREATE TABLE IF NOT EXISTS recept_maischstappen (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    recept_id INTEGER NOT NULL,
    stap_volgorde INTEGER NOT NULL,
    temperatuur_celsius REAL NOT NULL,[cite: 1]
    duur_minuten INTEGER NOT NULL,[cite: 1]
    FOREIGN KEY (recept_id) REFERENCES recepten(id) ON DELETE CASCADE
);

-- Kookstap instelling per recept[cite: 1]
CREATE TABLE IF NOT EXISTS recept_kookinstellingen (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    recept_id INTEGER UNIQUE NOT NULL,
    kooktijd_minuten INTEGER NOT NULL,[cite: 1]
    FOREIGN KEY (recept_id) REFERENCES recepten(id) ON DELETE CASCADE
);

-- Vergistingsschema (stappen)[cite: 1]
CREATE TABLE IF NOT EXISTS recept_vergistingsstappen (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    recept_id INTEGER NOT NULL,
    stap_volgorde INTEGER NOT NULL,
    temperatuur_celsius REAL NOT NULL,[cite: 1]
    duur_dagen INTEGER NOT NULL,[cite: 1]
    FOREIGN KEY (recept_id) REFERENCES recepten(id) ON DELETE CASCADE
);


--------------------------------------------------------------------------------
-- 2. BROUWSESSIES & UITVOERING (HISTORIEK EN PROCESSEN)
--------------------------------------------------------------------------------

-- Een concrete uitvoering van een recept[cite: 1]
CREATE TABLE IF NOT EXISTS brouwsessies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    recept_id INTEGER, -- Mag NULL worden als het originele recept ooit gewist wordt[cite: 1]
    recept_naam TEXT NOT NULL, -- Momentopname van de receptnaam[cite: 1]
    doel_volume_liter REAL NOT NULL, -- Gekozen volume voor deze specifieke sessie[cite: 1]
    schaalfactor REAL NOT NULL, -- Berekend: doel_volume_liter / basis_volume_liter[cite: 1]
    start_tijd DATETIME DEFAULT CURRENT_TIMESTAMP,[cite: 1]
    eind_tijd DATETIME,[cite: 1]
    status TEXT CHECK(status IN ('aangemaakt', 'bezig', 'voltooid', 'geannuleerd', 'vergist')) NOT NULL DEFAULT 'aangemaakt',
    opmerkingen TEXT,
    FOREIGN KEY (recept_id) REFERENCES recepten(id) ON DELETE SET NULL
);

-- Bewaart de geschaalde en unieke stappen voor déze brouwsessie[cite: 1]
CREATE TABLE IF NOT EXISTS brouwsessie_stappen (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sessie_id INTEGER NOT NULL,
    stap_type TEXT CHECK(stap_type IN ('schrooten', 'vullen', 'opwarmen', 'maischen', 'spoelen', 'koken', 'overbrengen', 'vergisten')) NOT NULL,[cite: 1]
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

-- Telemetrie en sensorwaarden tijdens het brouwproces (maischen / koken)[cite: 1]
CREATE TABLE IF NOT EXISTS brouwketel_loggegevens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sessie_id INTEGER NOT NULL,
    tijdstip DATETIME DEFAULT CURRENT_TIMESTAMP,
    gemeten_temperatuur REAL NOT NULL,[cite: 1]
    doel_temperatuur REAL,[cite: 1]
    verwarming_status INTEGER CHECK(verwarming_status IN (0, 1)) NOT NULL, -- 0 = Uit, 1 = Aan[cite: 1]
    verwarming_vermogen_procent REAL DEFAULT 0.0, -- Modulerend vermogen (0.0% tot 100.0%)[cite: 1]
    pomp_status INTEGER CHECK(pomp_status IN (0, 1)) NOT NULL, -- 0 = Uit, 1 = Aan[cite: 1]
    actieve_stap_id INTEGER, -- Koppeling naar de huidige stap in de wizard[cite: 1]
    FOREIGN KEY (sessie_id) REFERENCES brouwsessies(id) ON DELETE CASCADE,
    FOREIGN KEY (actieve_stap_id) REFERENCES brouwsessie_stappen(id) ON DELETE SET NULL
);

-- Telemetrie en handmatige invoer voor de klimaatkast / gistingstank[cite: 1]
CREATE TABLE IF NOT EXISTS vergisting_loggegevens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sessie_id INTEGER NOT NULL,
    tijdstip DATETIME DEFAULT CURRENT_TIMESTAMP,
    gemeten_temperatuur REAL NOT NULL,[cite: 1]
    doel_temperatuur REAL NOT NULL,[cite: 1]
    klimaatkast_modus TEXT CHECK(klimaatkast_modus IN ('uit', 'verwarmen', 'koelen', 'rust')) NOT NULL DEFAULT 'uit',[cite: 1]
    sg_waarde REAL, -- Handmatig ingegeven of gemeten SG-waarde (Specific Gravity)[cite: 1]
    FOREIGN KEY (sessie_id) REFERENCES brouwsessies(id) ON DELETE CASCADE
);

-- Systeemmeldingen, fouten en alarmsituaties[cite: 1]
CREATE TABLE IF NOT EXISTS systeem_meldingen (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sessie_id INTEGER,
    tijdstip DATETIME DEFAULT CURRENT_TIMESTAMP,
    ernst TEXT CHECK(ernst IN ('info', 'waarschuwing', 'fout', 'kritiek')) NOT NULL,
    bericht TEXT NOT NULL,[cite: 1]
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