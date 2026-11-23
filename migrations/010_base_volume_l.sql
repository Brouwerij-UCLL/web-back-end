-- Migration 010: Basisvolume van een recept heet base_volume_l
-- Migratie 007 voegde het volume toe als recept_volume. Deze migratie hernoemt die kolom,
-- zodat er één basisvolume per recept is. De waarden blijven bewaard; bestaande recepten
-- hebben 20 L (de standaard uit migratie 007), nieuwe recepten zonder waarde ook.

ALTER TABLE recipes RENAME COLUMN recept_volume TO base_volume_l;
