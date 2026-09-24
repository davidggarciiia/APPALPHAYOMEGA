-- Solo para revisión y una reversión explícita sin figuras asociadas.
-- Con datos, usar una migración compensatoria que conserve las asociaciones.
BEGIN;
LOCK TABLE "contenidos_de_ejercicio" IN ACCESS EXCLUSIVE MODE;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM "contenidos_de_ejercicio") THEN
    RAISE EXCEPTION 'Hay figuras asociadas a ejercicios: no se permite esta reversión';
  END IF;
END $$;
DROP TABLE "contenidos_de_ejercicio";
DROP TYPE "TipoDeContenido";
DROP TYPE "OrigenDeContenido";
COMMIT;
