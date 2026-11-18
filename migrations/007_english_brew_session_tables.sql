DROP INDEX idx_brouwsessie_stappen_sessie;

ALTER TABLE brouwsessies RENAME TO brew_sessions;
ALTER TABLE brouwsessie_stappen RENAME TO brew_session_steps;

CREATE INDEX idx_brew_session_steps_session ON brew_session_steps(sessie_id, stap_volgorde);
