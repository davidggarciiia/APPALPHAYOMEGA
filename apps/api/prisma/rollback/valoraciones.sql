-- Reversión de 20260924120000_valoraciones. Solo borra las tablas de esta
-- ampliación; medidas, pruebas y registros diarios anteriores no se tocan.
-- Ensayar únicamente en una base desechable: elimina valoraciones guardadas.
-- Quita también el registro de la migración para poder reaplicarla con deploy.
BEGIN;
DROP TABLE "lecturas_avisos_seguimiento";
DROP TABLE "proximas_revisiones_valoracion";
DROP TABLE "operaciones_valoracion";
ALTER TABLE "borradores_valoracion" DROP CONSTRAINT "borradores_valoracion_corrigePublicacionId_fkey";
DROP TABLE "publicaciones_valoracion";
DROP TABLE "borradores_valoracion";
DROP TABLE "valoraciones";
DROP TABLE "plantillas_valoracion";
DROP TYPE "TipoValoracion";
DELETE FROM "_prisma_migrations" WHERE "migration_name" = '20260924120000_valoraciones';
COMMIT;
