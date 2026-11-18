-- Migration 007: Volume van een recept
-- Het volume (in liter) waarvoor het recept geschreven is, bv. 20 L.
-- Bestaande recepten krijgen 20 L.

ALTER TABLE recipes ADD COLUMN recept_volume REAL NOT NULL DEFAULT 20 CHECK (recept_volume > 0);
