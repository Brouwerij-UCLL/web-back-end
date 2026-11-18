-- Migration 009: Laatste waarden per toestel
-- De laatst gemeten waarde per sensor (brouwer/<mac>/sensor/<naam>) en de laatste toestand
-- per actuator (brouwer/<mac>/actuator/<naam>/state). Alleen de laatste waarde, geen historiek.

CREATE TABLE device_readings (
    mac        TEXT NOT NULL REFERENCES devices(mac) ON DELETE CASCADE,
    kind       TEXT NOT NULL CHECK (kind IN ('sensor', 'actuator')),
    name       TEXT NOT NULL,
    value      TEXT NOT NULL,     -- getal voor een sensor, bv. "66.8"; toestand voor een actuator, bv. "on"
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (mac, kind, name)
);
