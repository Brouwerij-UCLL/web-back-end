--------------------------------------------------------------------------------
-- MOCK DATA: RECEPTEN & TEMPLATES
--------------------------------------------------------------------------------

-- Recept 1: Belgische Tripel (basisvolume 20 liter)
INSERT INTO recepten (id, naam, bierstijl, beschrijving, basis_volume_liter)
VALUES (1, 'Gouden Tripel', 'Belgische Tripel', 'Klassieke krachtige blondine met fruitige en kruidige tonen.', 20.0);

INSERT INTO recept_water (recept_id, maischwater_liter, spoelwater_liter)
VALUES (1, 18.5, 12.0);

INSERT INTO recept_ingredienten (recept_id, naam, fabrikant, hoeveelheid_kg) VALUES
(1, 'Pilsner Mout', 'Dingemans', 5.50),
(1, 'Tarwemout', 'Dingemans', 0.50);

INSERT INTO recept_hoppen (recept_id, naam, alfazuur_percentage, type, herkomst, hoeveelheid_gram, kooktijd_minuten) VALUES
(1, 'Saaz', 3.5, 'pellet', 'Tsjechië', 45.0, 75),
(1, 'Styrian Goldings', 4.8, 'pellet', 'Slovenië', 25.0, 15);

INSERT INTO recept_extra_toevoegingen (recept_id, naam, omschrijving, hoeveelheid, eenheid, toevoegmoment, kooktijd_minuten) VALUES
(1, 'Kandijsuiker (wit)', 'Voor hogere vergistingsgraad', 500.0, 'g', 'koken', 10),
(1, 'Gedroogde Koriander', 'Licht geplet voor aroma', 10.0, 'g', 'koken', 5);

INSERT INTO recept_maischstappen (recept_id, stap_volgorde, temperatuur_celsius, duur_minuten) VALUES
(1, 1, 62.0, 45),
(1, 2, 72.0, 20),
(1, 3, 78.0, 5);

INSERT INTO recept_kookinstellingen (recept_id, kooktijd_minuten)
VALUES (1, 75);

INSERT INTO recept_vergistingsstappen (recept_id, stap_volgorde, temperatuur_celsius, duur_dagen) VALUES
(1, 1, 20.0, 7),
(1, 2, 22.0, 14);

-- Recept 2: Session IPA (basisvolume 20 liter)
INSERT INTO recepten (id, naam, bierstijl, beschrijving, basis_volume_liter)
VALUES (2, 'Citra Breeze IPA', 'Session IPA', 'Licht en verfrissend speciaalbier boordevol citrusaroma.', 20.0);

INSERT INTO recept_water (recept_id, maischwater_liter, spoelwater_liter)
VALUES (2, 16.0, 14.0);

INSERT INTO recept_ingredienten (recept_id, naam, fabrikant, hoeveelheid_kg) VALUES
(2, 'Pale Ale Mout', 'Crisp', 3.80),
(2, 'Havervlokken', 'Mouterij Thomas Fawcett', 0.40);

INSERT INTO recept_hoppen (recept_id, naam, alfazuur_percentage, type, herkomst, hoeveelheid_gram, kooktijd_minuten) VALUES
(2, 'Citra', 12.5, 'pellet', 'USA', 15.0, 60),
(2, 'Mosaic', 11.5, 'pellet', 'USA', 40.0, 0);

INSERT INTO recept_maischstappen (recept_id, stap_volgorde, temperatuur_celsius, duur_minuten) VALUES
(2, 1, 67.0, 60);

INSERT INTO recept_kookinstellingen (recept_id, kooktijd_minuten)
VALUES (2, 60);

INSERT INTO recept_vergistingsstappen (recept_id, stap_volgorde, temperatuur_celsius, duur_dagen)
VALUES (2, 1, 19.0, 10);

--------------------------------------------------------------------------------
-- MOCK DATA: BROUWSESSIES & STAPPEN
--------------------------------------------------------------------------------

-- Afgeronde brouwsessie: Gouden Tripel geschaald naar 25 liter
INSERT INTO brouwsessies (id, recept_id, recept_naam, doel_volume_liter, schaalfactor, start_tijd, eind_tijd, status, opmerkingen)
VALUES (1, 1, 'Gouden Tripel', 25.0, 1.25, '2026-03-01 08:00:00', '2026-03-01 14:30:00', 'vergist', 'Zeer goed rendement behaald (80%).');

INSERT INTO brouwsessie_stappen (id, sessie_id, stap_type, stap_volgorde, naam, doel_temperatuur_celsius, doel_duur_seconden, status, gestart_op, afgerond_op) VALUES
(1, 1, 'vullen', 1, 'Ketel vullen met maischwater (23.1L)', 20.0, 0, 'voltooid', '2026-03-01 08:00:00', '2026-03-01 08:15:00'),
(2, 1, 'opwarmen', 2, 'Opwarmen naar inmaischtemp', 64.0, 0, 'voltooid', '2026-03-01 08:15:00', '2026-03-01 08:40:00'),
(3, 1, 'maischen', 3, 'Maischstap 1 (Beta-amylase)', 62.0, 2700, 'voltooid', '2026-03-01 08:40:00', '2026-03-01 09:25:00'),
(4, 1, 'maischen', 4, 'Maischstap 2 (Alfa-amylase)', 72.0, 1200, 'voltooid', '2026-03-01 09:30:00', '2026-03-01 09:50:00'),
(5, 1, 'koken', 5, 'Koken met hopgiften', 100.0, 4500, 'voltooid', '2026-03-01 10:20:00', '2026-03-01 11:35:00');

-- Actieve brouwsessie: Citra Breeze IPA op 20 liter
INSERT INTO brouwsessies (id, recept_id, recept_naam, doel_volume_liter, schaalfactor, start_tijd, status)
VALUES (2, 2, 'Citra Breeze IPA', 20.0, 1.00, CURRENT_TIMESTAMP, 'bezig');

INSERT INTO brouwsessie_stappen (id, sessie_id, stap_type, stap_volgorde, naam, doel_temperatuur_celsius, doel_duur_seconden, status, gestart_op) VALUES
(10, 2, 'vullen', 1, 'Ketel vullen met maischwater (16.0L)', 20.0, 0, 'voltooid', CURRENT_TIMESTAMP),
(11, 2, 'opwarmen', 2, 'Opwarmen naar inmaischtemp', 69.0, 0, 'voltooid', CURRENT_TIMESTAMP),
(12, 2, 'maischen', 3, 'Maischstap 1 (Eénstaps maisch)', 67.0, 3600, 'actief', CURRENT_TIMESTAMP);

INSERT INTO brouwsessie_stappen (id, sessie_id, stap_type, stap_volgorde, naam, doel_temperatuur_celsius, doel_duur_seconden, status, gestart_op)
VALUES (13, 2, 'koken', 4, 'Koken met hopgiften', 100.0, 3600, 'wachtend', NULL);

--------------------------------------------------------------------------------
-- MOCK DATA: TELEMETRIE, LOGS & MELDINGEN
--------------------------------------------------------------------------------

-- Ketellogs voor de actieve maischstap van sessie 2 (stap 12)
INSERT INTO brouwketel_loggegevens (sessie_id, tijdstip, gemeten_temperatuur, doel_temperatuur, verwarming_status, verwarming_vermogen_procent, pomp_status, actieve_stap_id) VALUES
(2, DATETIME('now', '-10 minutes'), 66.2, 67.0, 1, 60.0, 1, 12),
(2, DATETIME('now', '-8 minutes'), 66.8, 67.0, 1, 30.0, 1, 12),
(2, DATETIME('now', '-6 minutes'), 67.1, 67.0, 0, 0.0, 1, 12),
(2, DATETIME('now', '-4 minutes'), 67.0, 67.0, 0, 0.0, 1, 12),
(2, DATETIME('now', '-2 minutes'), 66.7, 67.0, 1, 40.0, 1, 12);

-- Vergistingslogs voor de afgeronde sessie 1
INSERT INTO vergisting_loggegevens (sessie_id, tijdstip, gemeten_temperatuur, doel_temperatuur, klimaatkast_modus, sg_waarde) VALUES
(1, '2026-03-02 10:00:00', 20.1, 20.0, 'rust', 1.078),
(1, '2026-03-04 10:00:00', 20.4, 20.0, 'koelen', 1.045),
(1, '2026-03-07 10:00:00', 20.0, 20.0, 'rust', 1.020),
(1, '2026-03-10 10:00:00', 22.0, 22.0, 'verwarmen', 1.012);

-- Systeemmelding voor sessie 2
INSERT INTO systeem_meldingen (sessie_id, tijdstip, ernst, bericht, opgelost)
VALUES (2, DATETIME('now', '-9 minutes'), 'waarschuwing', 'Temperatuur zakte 0.8°C onder de ingestelde waarde.', 1);
