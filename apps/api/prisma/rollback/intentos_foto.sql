-- Reversión de 20260924210000_intentos_foto. Solo en una base desechable:
-- sin esta tabla, las copias pendientes de limpiar dejan de estar localizadas.
-- Antes de aplicarla en otro entorno, borra del almacén las claves que liste
-- SELECT "clave" FROM "intentos_foto" WHERE "descartadoEn" IS NOT NULL.
BEGIN;
DROP TABLE "intentos_foto";
DELETE FROM "_prisma_migrations" WHERE "migration_name" = '20260924210000_intentos_foto';
COMMIT;
