-- Reversión de 20260924130000_medios_privados. Solo borra las tablas de fotos y
-- solicitudes; valoraciones, medidas y registros anteriores no se tocan. Los
-- objetos del almacén no se borran desde aquí: limpiarlos es una operación aparte.
-- Ensayar únicamente en una base desechable.
BEGIN;
DROP TABLE "medios_fotos";
DROP TABLE "solicitudes_fotos";
DROP TYPE "EstadoSolicitudFotos";
DROP TYPE "OrigenMedio";
DROP TYPE "EstadoMedio";
DROP TYPE "VistaFoto";
DELETE FROM "_prisma_migrations" WHERE "migration_name" = '20260924130000_medios_privados';
COMMIT;
