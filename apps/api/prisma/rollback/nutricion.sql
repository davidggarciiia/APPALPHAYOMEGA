-- Solo para revisión y una reversión explícita de una instalación sin dietas.
-- Con datos, usar una migración compensatoria que conserve el histórico.
BEGIN;
LOCK TABLE "dietas" IN ACCESS EXCLUSIVE MODE;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM "dietas") THEN
    RAISE EXCEPTION 'Hay dietas guardadas: no se permite esta reversión';
  END IF;
END $$;
DROP TABLE "dietas";
DROP TYPE "EstadoDieta";
COMMIT;
