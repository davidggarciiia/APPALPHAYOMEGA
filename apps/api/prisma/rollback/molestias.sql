-- Reversión de 20260924040000_molestias. Se niega si hay avisos guardados.
BEGIN;
LOCK TABLE "molestias" IN ACCESS EXCLUSIVE MODE;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM "molestias") THEN
    RAISE EXCEPTION 'Hay molestias registradas: no se permite esta reversión';
  END IF;
END $$;
DROP TABLE "molestias";
DROP TYPE "ZonaDeMolestia";
DROP TYPE "EstadoMolestia";
COMMIT;
