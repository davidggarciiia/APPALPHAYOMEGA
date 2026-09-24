-- Reversión de 20260924050000_bloque_del_plan. Borra los bloques escritos.
BEGIN;
ALTER TABLE "planes_entrenamiento" DROP COLUMN "bloque";
COMMIT;
