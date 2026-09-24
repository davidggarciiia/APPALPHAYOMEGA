-- Reversión de 20260924070000_registro_de_comidas. Borra las comidas registradas y los suplementos del día.
BEGIN;
DROP TABLE "comidas_registradas";
ALTER TABLE "dias_seguimiento" DROP COLUMN "suplementos";
COMMIT;
