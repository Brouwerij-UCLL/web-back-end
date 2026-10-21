-- Migration 004: Remove all brouwsessie and logging tables
-- 2. Drop all logging, session, and monitoring tables
DROP TABLE IF EXISTS brouwketel_loggegevens;
DROP TABLE IF EXISTS vergisting_loggegevens;
DROP TABLE IF EXISTS systeem_meldingen;
DROP TABLE IF EXISTS brouwsessie_stappen;
DROP TABLE IF EXISTS brouwsessies;

-- 4. Clean up any remaining related indexes
DROP INDEX IF EXISTS idx_systeem_meldingen_sessie;
DROP INDEX IF EXISTS idx_brouwsessie_stappen_sessie;
DROP INDEX IF EXISTS idx_vergisting_log_sessie;
DROP INDEX IF EXISTS idx_brouwketel_log_sessie;