-- Migration 006: hetzelfde ingrediënt (naam + fabrikant, hoofdletters niet meegerekend) mag maar één keer in de catalogus.
CREATE UNIQUE INDEX IF NOT EXISTS idx_ingredients_name_manufacturer
    ON ingredients (lower(name), lower(coalesce(manufacturer, '')));
