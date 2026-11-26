-- Migration 011: Mock kooktijden voor alle bestaande recepten

INSERT INTO recipe_boil_time (recipe_id, temperature, duration)
SELECT
    recipe_id,
    100,
    CASE recipe_id
        WHEN 2 THEN 90  -- Belgische tripel
        WHEN 4 THEN 90  -- Imperial stout
        WHEN 8 THEN 90  -- Pilsner
        ELSE 60
    END
FROM recipes;
