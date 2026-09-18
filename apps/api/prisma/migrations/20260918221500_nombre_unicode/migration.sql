-- La normalización puede expandir un nombre válido de 120 caracteres.
ALTER TABLE "ejercicios" ALTER COLUMN "nombreNormalizado" TYPE TEXT;
-- Reversión solo con migración compensatoria: comprobar primero que no existen
-- valores con char_length("nombreNormalizado") > 120. Nunca truncar para revertir.
