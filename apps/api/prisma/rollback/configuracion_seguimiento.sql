-- Reversión de 20260924100000_configuracion_seguimiento.
-- Elimina las configuraciones y las referencias nuevas; conserva resultados previos.
BEGIN;
DROP INDEX "pruebas_fisicas_clienteId_pruebaId_fecha_idx";
ALTER TABLE "pruebas_fisicas" DROP COLUMN "pruebaId";
DROP TABLE "configuraciones_seguimiento";
COMMIT;
