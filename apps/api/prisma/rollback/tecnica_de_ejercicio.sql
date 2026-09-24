-- Reversión de 20260924030000_tecnica_de_ejercicio. Borra la técnica escrita.
BEGIN;
ALTER TABLE "ejercicios" DROP COLUMN "pasos", DROP COLUMN "evita", DROP COLUMN "consejos";
COMMIT;
