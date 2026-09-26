-- Reversión de 20260926130000_fotos_de_progreso. Falla si ya hay fotos de
-- progreso (origen cliente sin solicitud): retíralas o asígnalas antes.
BEGIN;
ALTER TABLE "medios_fotos" DROP CONSTRAINT "medio_foto_origen_coherente";
ALTER TABLE "medios_fotos" ADD CONSTRAINT "medio_foto_origen_coherente" CHECK (
  ("origen" = 'cliente') = ("solicitudId" IS NOT NULL)
  AND ("origen" <> 'profesional' OR "valoracionId" IS NOT NULL)
);
DELETE FROM "_prisma_migrations" WHERE "migration_name" = '20260926130000_fotos_de_progreso';
COMMIT;
