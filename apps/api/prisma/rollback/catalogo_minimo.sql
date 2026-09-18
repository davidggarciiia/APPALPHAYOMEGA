-- Reversión manual de C02. No se ejecuta durante migrate dev ni al revertir código.
-- Si la migración ya terminó correctamente, incorporar este SQL a una migración
-- compensatoria versionada y revertir los modelos Prisma en el mismo cambio.
-- Si hay datos o tablas dependientes, aborta: conservar la migración aditiva y
-- revertir solo el código permite recuperar la versión anterior sin perder datos.
BEGIN;
LOCK TABLE "ejercicios", "grupos_secundarios_de_ejercicio" IN ACCESS EXCLUSIVE MODE;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "ejercicios")
    OR EXISTS (SELECT 1 FROM "grupos_secundarios_de_ejercicio") THEN
    RAISE EXCEPTION 'El catálogo contiene datos; no se puede revertir sin perderlos';
  END IF;
END $$;
DROP TABLE "grupos_secundarios_de_ejercicio";
DROP TABLE "ejercicios";
DROP TYPE "EstadoEjercicio";
DROP TYPE "GrupoMuscular";
COMMIT;
