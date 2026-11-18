-- Migration 008: Toestellen (brouwketel, klimaatkast, ...)
-- Elk toestel meldt zich via MQTT aan met een retained info-bericht op brouwer/<mac>/info
-- en een retained status (online/offline, ook als last will) op brouwer/<mac>/status.

CREATE TABLE devices (
    mac        TEXT PRIMARY KEY CHECK (length(mac) = 12),
    type       TEXT,                 -- uit info, bv. 'ketel' of 'kast'; leeg zolang er geen info is
    name       TEXT,
    firmware   TEXT,
    info       TEXT,                 -- het volledige info-bericht als JSON
    online     INTEGER NOT NULL DEFAULT 0 CHECK (online IN (0, 1)),
    last_seen  TEXT,                 -- laatste status- of info-bericht
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
