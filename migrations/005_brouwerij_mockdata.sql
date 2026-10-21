-- Migration 005: Seed extensive mock data for frontend testing
-- Contains 12 diverse beer recipes, multiple ingredients, hops, and extra additions.

-- A recipe can use the same hop in multiple additions, for example at different boil times.
CREATE TABLE hop_additions_new (
    hop_addition_id INTEGER PRIMARY KEY AUTOINCREMENT,
    recipe_id       INTEGER NOT NULL REFERENCES recipes(recipe_id) ON DELETE CASCADE,
    hop_id          INTEGER NOT NULL REFERENCES hops(hop_id) ON DELETE RESTRICT,
    amount          REAL NOT NULL CHECK (amount > 0),
    boil_time_min   INTEGER NOT NULL CHECK (boil_time_min >= 0)
);

INSERT INTO hop_additions_new (recipe_id, hop_id, amount, boil_time_min)
SELECT recipe_id, hop_id, amount, boil_time_min
FROM hop_additions;

DROP TABLE hop_additions;
ALTER TABLE hop_additions_new RENAME TO hop_additions;
CREATE INDEX idx_hop_additions_hop ON hop_additions(hop_id);

-- ============================================================================
-- 1. SEED CATALOG DATA: INGREDIENTS
-- ============================================================================
INSERT INTO ingredients (ingredient_id, name, manufacturer) VALUES
(1, 'Pilsner Malt', 'Dingemans'),
(2, 'Pale Ale Malt', 'Crisp'),
(3, 'Wheat Malt (Tarwemout)', 'Dingemans'),
(4, 'Flaked Oats (Havervlokken)', 'Thomas Fawcett'),
(5, 'Munich Malt', 'Weyermann'),
(6, 'Vienna Malt', 'Weyermann'),
(7, 'CaraPils', 'Dingemans'),
(8, 'Cara30', 'Dingemans'),
(9, 'Cara120', 'Dingemans'),
(10, 'Chocolate Malt', 'Crisp'),
(11, 'Roasted Barley', 'Crisp'),
(12, 'Special B', 'Dingemans'),
(13, 'Flaked Barley', 'Thomas Fawcett'),
(14, 'Acid Malt', 'Weyermann'),
(15, 'Smoked Malt (Rauchmalz)', 'Weyermann');

-- ============================================================================
-- 2. SEED CATALOG DATA: HOPS
-- ============================================================================
-- type: 0 = bloemen (flowers), 1 = pellet
INSERT INTO hops (hop_id, name, alpha_acid_percentage, type, origin) VALUES
(1, 'Citra', 13.5, 1, 'USA'),
(2, 'Mosaic', 12.0, 1, 'USA'),
(3, 'Saaz', 3.5, 1, 'Czech Republic'),
(4, 'Styrian Goldings', 5.2, 1, 'Slovenia'),
(5, 'Cascade', 6.8, 1, 'USA'),
(6, 'Centennial', 9.5, 1, 'USA'),
(7, 'Simcoe', 13.0, 1, 'USA'),
(8, 'Amarillo', 8.5, 1, 'USA'),
(9, 'Hallertau Mittelfrüh', 4.0, 0, 'Germany'),
(10, 'Tettnang', 4.5, 0, 'Germany'),
(11, 'Fuggle', 4.8, 1, 'UK'),
(12, 'East Kent Goldings', 5.0, 1, 'UK'),
(13, 'Nelson Sauvin', 12.5, 1, 'New Zealand'),
(14, 'Galaxy', 14.5, 1, 'Australia');

-- ============================================================================
-- 3. SEED CATALOG DATA: EXTRA INGREDIENTS
-- ============================================================================
INSERT INTO extra_ingredients (extra_ingredient_id, name, description, unit) VALUES
(1, 'Gedroogde Koriander (Coriander)', 'Licht geplet voor citrus/kruidig aroma', 'g'),
(2, 'Kandijsuiker (Wit)', 'Voor hogere vergistingsgraad in zware Belgische bieren', 'g'),
(3, 'Kandijsuiker (Donker)', 'Voor karamel/gedroogd fruit toetsen in Dubbel/Quadrupel', 'g'),
(4, 'Sinaasappelschil (Sinaasappel/Curaçao)', 'Gedroogde schil voor Belgisch witbier', 'g'),
(5, 'Lactose (Melksuiker)', 'Niet-vergistbare suiker voor romigheid in Stouts', 'g'),
(6, 'Iers Mos (Irish Moss)', 'Klaarmiddel voor eiwituitvlokking tijdens het koken', 'g'),
(7, 'Eiken houtsnippers (Bourbon Oak)', 'Voor lagering en hout-rijping accenten', 'g'),
(8, 'Koffiebonen (Espresso Grind)', 'Koud getrokken of laat in de kook voor robuuste koffiesmaak', 'g'),
(9, 'Kersenpuree (Kriek)', 'Fruit toevoeging voor secundaire vergisting', 'g');

-- ============================================================================
-- 4. SEED RECIPES
-- ============================================================================
INSERT INTO recipes (recipe_id, name, beer_style, description) VALUES
(1, 'Citra Breeze IPA', 'Session IPA', 'Licht en verfrissend speciaalbier boordevol citrus- en tropisch fruitaroma.'),
(2, 'Gouden Tripel', 'Belgische Tripel', 'Klassieke krachtige blondine met fruitige esters en een volle, warme afdronk.'),
(3, 'Limburgs Witje', 'Witbier', 'Traditioneel troebel witbier met verfrissende tonen van koriander en sinaasappelschil.'),
(4, 'Nachtwacht Stout', 'Imperial Stout', 'Zware, donkere stout boordevol tonen van espresso, pure chocolade en geroosterde mout.'),
(5, 'Boszicht Blond', 'Belgisch Blond', 'Toegankelijk en goudgeel blond bier met een zachte moutzoetheid en subtiele bitterheid.'),
(6, 'Dubbel Genieten', 'Belgische Dubbel', 'Rijk, robijnrood abdijbier met aroma’s van karamel, rozijnen en donkere kandijsuiker.'),
(7, 'Hoppy Sunset NEIPA', 'New England IPA', 'Zacht, troebel (hazy) bier met een explosie van tropisch fruit en een extreem lage bitterheid.'),
(8, 'Boheems Goud', 'Boheems Pilsner', 'Klassiek ondergistend pilsener met zuivere mouttonen en een edel bittertje van Saaz hop.'),
(9, 'Herfstbok Royale', 'Bokbier', 'Verwarmend robijnbruin seizoensbier met karamel- en notentonen, perfect voor het najaar.'),
(10, 'Saison Du Nord', 'Saison / Farmhouse Ale', 'Droog, kruidig en verfrissend amberkleurig bier met een typisch gistkarakter.'),
(11, 'Milkshake Raspberry Stout', 'Sweet Stout', 'Romige, zoete stout verrijkt met lactose en een volle fruitige touch.'),
(12, 'Smoky West Rauchbier', 'Rauchbier', 'Traditioneel Duits kasteelbier met een uitgesproken en ambachtelijke rooksmaak.');

-- ============================================================================
-- 5. SEED RECIPE INGREDIENTS (Malt / Grains)
-- ============================================================================
INSERT INTO recipe_ingredients (recipe_id, ingredient_id, amount_g) VALUES
-- 1. Citra Breeze IPA
(1, 1, 3500), (1, 3, 500), (1, 4, 300),
-- 2. Gouden Tripel
(2, 1, 5500), (2, 3, 800), (2, 7, 200),
-- 3. Limburgs Witje
(3, 1, 2300), (3, 3, 2300), (3, 4, 400),
-- 4. Nachtwacht Stout
(4, 2, 6000), (4, 5, 1000), (4, 10, 600), (4, 11, 400), (4, 13, 500),
-- 5. Boszicht Blond
(5, 1, 4200), (5, 6, 800), (5, 7, 250),
-- 6. Dubbel Genieten
(6, 1, 4500), (6, 5, 800), (6, 9, 300), (6, 12, 200),
-- 7. Hoppy Sunset NEIPA
(7, 2, 4000), (7, 3, 1000), (7, 4, 800),
-- 8. Boheems Goud
(8, 1, 4800), (8, 14, 50),
-- 9. Herfstbok Royale
(9, 5, 3000), (9, 6, 1800), (9, 8, 400), (9, 9, 200),
-- 10. Saison Du Nord
(10, 1, 3800), (10, 3, 500), (10, 6, 400),
-- 11. Milkshake Raspberry Stout
(11, 2, 3500), (11, 5, 800), (11, 10, 400), (11, 11, 200),
-- 12. Smoky West Rauchbier
(12, 15, 3500), (12, 5, 1200), (12, 6, 500);

-- ============================================================================
-- 6. SEED RECIPE WATER
-- ============================================================================
INSERT INTO recipe_water (recipe_id, mash_water_l, sparge_water_l) VALUES
(1, 15.0, 12.5),
(2, 20.0, 14.0),
(3, 16.0, 13.0),
(4, 23.0, 12.0),
(5, 17.5, 13.5),
(6, 18.0, 13.0),
(7, 19.0, 14.0),
(8, 16.5, 14.5),
(9, 17.0, 13.0),
(10, 16.0, 13.5),
(11, 16.0, 12.0),
(12, 17.0, 13.0);

-- ============================================================================
-- 7. SEED HOP ADDITIONS
-- ============================================================================
INSERT INTO hop_additions (recipe_id, hop_id, amount, boil_time_min) VALUES
-- 1. Citra Breeze IPA
(1, 1, 20.0, 60), (1, 1, 40.0, 10), (1, 2, 50.0, 0),
-- 2. Gouden Tripel
(2, 4, 35.0, 60), (2, 3, 25.0, 15),
-- 3. Limburgs Witje
(3, 9, 20.0, 60), (3, 10, 15.0, 15),
-- 4. Nachtwacht Stout
(4, 6, 50.0, 60), (4, 5, 30.0, 15),
-- 5. Boszicht Blond
(5, 4, 30.0, 60), (5, 3, 20.0, 10),
-- 6. Dubbel Genieten
(6, 4, 35.0, 60), (6, 9, 20.0, 20),
-- 7. Hoppy Sunset NEIPA
(7, 1, 15.0, 60), (7, 2, 50.0, 5), (7, 14, 60.0, 0),
-- 8. Boheems Goud
(8, 3, 40.0, 60), (8, 3, 30.0, 30), (8, 3, 30.0, 10),
-- 9. Herfstbok Royale
(9, 9, 30.0, 60), (9, 10, 20.0, 15),
-- 10. Saison Du Nord
(10, 4, 30.0, 60), (10, 12, 25.0, 15),
-- 11. Milkshake Raspberry Stout
(11, 11, 35.0, 60),
-- 12. Smoky West Rauchbier
(12, 9, 35.0, 60), (12, 10, 20.0, 20);

-- ============================================================================
-- 8. SEED RECIPE EXTRAS
-- ============================================================================
INSERT INTO recipe_extras (recipe_id, extra_ingredient_id, amount, add_moment, boil_time) VALUES
-- Witbier extras
(3, 1, 15.0, 'koken', 10),
(3, 4, 25.0, 'koken', 10),
-- Tripel & Dubbel sugars
(2, 2, 500.0, 'koken', 15),
(6, 3, 400.0, 'koken', 15),
-- Clarifier & lactose
(1, 6, 5.0, 'koken', 15),
(7, 6, 5.0, 'koken', 15),
(11, 5, 300.0, 'koken', 10),
(11, 9, 1000.0, 'beslag', NULL),
-- Stout aging
(4, 7, 50.0, 'beslag', NULL),
(4, 8, 100.0, 'koken', 5);

-- ============================================================================
-- 9. SEED MASH STEPS
-- ============================================================================
INSERT INTO recipe_mash_steps (recipe_id, step_nr, temperature, duration) VALUES
-- 1. Citra Breeze IPA (Single infusion)
(1, 1, 65.0, 60), (1, 2, 78.0, 5),
-- 2. Gouden Tripel (Multi-rest)
(2, 1, 62.0, 40), (2, 2, 72.0, 20), (2, 3, 78.0, 5),
-- 3. Limburgs Witje
(3, 1, 52.0, 15), (3, 2, 63.0, 35), (3, 3, 72.0, 20), (3, 4, 78.0, 5),
-- Standard steps for 4 to 12
(4, 1, 67.0, 65), (4, 2, 78.0, 5),
(5, 1, 64.0, 60), (5, 2, 72.0, 15), (5, 3, 78.0, 5),
(6, 1, 63.0, 35), (6, 2, 72.0, 25), (6, 3, 78.0, 5),
(7, 1, 66.0, 60), (7, 2, 78.0, 5),
(8, 1, 50.0, 20), (8, 2, 62.0, 40), (8, 3, 72.0, 20), (8, 4, 78.0, 5),
(9, 1, 63.0, 40), (9, 2, 72.0, 20), (9, 3, 78.0, 5),
(10, 1, 64.0, 75), (10, 2, 78.0, 5),
(11, 1, 67.0, 60), (11, 2, 78.0, 5),
(12, 1, 63.0, 30), (12, 2, 72.0, 30), (12, 3, 78.0, 5);

-- ============================================================================
-- 10. SEED FERMENTATION STEPS
-- ============================================================================
INSERT INTO recipe_fermentation_steps (recipe_id, step_nr, temperature, duration) VALUES
-- 1. Citra Breeze IPA
(1, 1, 19.0, 7), (1, 2, 21.0, 4), (1, 3, 15.0, 3),
-- 2. Gouden Tripel
(2, 1, 20.0, 10), (2, 2, 23.0, 5), (2, 3, 12.0, 14),
-- 3. Limburgs Witje
(3, 1, 20.0, 7), (3, 2, 18.0, 7),
-- 4 to 12 Standard schedules
(4, 1, 18.0, 14), (4, 2, 20.0, 7), (4, 3, 10.0, 21),
(5, 1, 20.0, 7), (5, 2, 22.0, 4),
(6, 1, 19.0, 10), (6, 2, 22.0, 4), (6, 3, 15.0, 10),
(7, 1, 19.0, 7), (7, 2, 21.0, 3), (7, 3, 14.0, 4),
(8, 1, 10.0, 14), (8, 2, 14.0, 3), (8, 3, 3.0, 28),
(9, 1, 18.0, 10), (9, 2, 20.0, 5), (9, 3, 12.0, 14),
(10, 1, 22.0, 5), (10, 2, 26.0, 5), (10, 3, 18.0, 7),
(11, 1, 19.0, 10), (11, 2, 15.0, 7),
(12, 1, 11.0, 14), (12, 2, 15.0, 3), (12, 3, 4.0, 21);
