-- Reversión de 20260924200000_consentimiento_salud. Solo en una base desechable:
-- borra el registro de consentimientos, que en producción es prueba legal.
BEGIN;
DROP TABLE "consentimientos_salud";
DELETE FROM "_prisma_migrations" WHERE "migration_name" = '20260924200000_consentimiento_salud';
COMMIT;
