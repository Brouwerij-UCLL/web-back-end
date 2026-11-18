ALTER TABLE brew_sessions RENAME COLUMN recept_id TO recipe_id;
ALTER TABLE brew_sessions RENAME COLUMN recept_naam TO recipe_name;
ALTER TABLE brew_sessions RENAME COLUMN doel_volume_liter TO target_volume_l;
ALTER TABLE brew_sessions RENAME COLUMN schaalfactor TO scale_factor;
ALTER TABLE brew_sessions RENAME COLUMN start_tijd TO start_time;
ALTER TABLE brew_sessions RENAME COLUMN eind_tijd TO end_time;
ALTER TABLE brew_sessions RENAME COLUMN opmerkingen TO notes;

ALTER TABLE brew_session_steps RENAME COLUMN sessie_id TO brew_session_id;
ALTER TABLE brew_session_steps RENAME COLUMN stap_type TO step_type;
ALTER TABLE brew_session_steps RENAME COLUMN stap_volgorde TO step_order;
ALTER TABLE brew_session_steps RENAME COLUMN naam TO name;
ALTER TABLE brew_session_steps RENAME COLUMN doel_temperatuur_celsius TO target_temperature_c;
ALTER TABLE brew_session_steps RENAME COLUMN doel_duur_seconden TO target_duration_seconds;
ALTER TABLE brew_session_steps RENAME COLUMN gestart_op TO started_at;
ALTER TABLE brew_session_steps RENAME COLUMN afgerond_op TO completed_at;
