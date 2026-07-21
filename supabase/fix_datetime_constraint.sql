-- Correction de la contrainte NOT NULL sur date_time pour permettre "Date à déterminer"
ALTER TABLE courses ALTER COLUMN date_time DROP NOT NULL;
