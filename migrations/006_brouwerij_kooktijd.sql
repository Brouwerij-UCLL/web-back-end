-- Migration 006: Kooktijd per recept
-- Migratie 003 verwijderde recept_kookinstellingen zonder vervanging. Een recept
-- heeft precies één kooktijd, dus die komt als kolom op recipes.
-- NULL = nog geen maischschema ingesteld; bestaande recepten blijven zo geldig.

ALTER TABLE recipes ADD COLUMN boil_time_min INTEGER
    CHECK (boil_time_min IS NULL OR boil_time_min BETWEEN 1 AND 180);
