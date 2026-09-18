-- Solo para revisión y una reversión explícita de una instalación vacía.
-- No ejecutar tras empezar a registrar entrenamientos: usar una migración
-- compensatoria que conserve los documentos e históricos y adaptar schema.prisma.
BEGIN;
LOCK TABLE "planes_entrenamiento", "sesiones_programadas", "sesiones_entrenamiento",
  "referencias_ejercicio", "cambios_de_fecha", "rutinas_guardadas", "operaciones_entrenamiento"
  IN ACCESS EXCLUSIVE MODE;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM "planes_entrenamiento")
    OR EXISTS (SELECT 1 FROM "sesiones_programadas")
    OR EXISTS (SELECT 1 FROM "sesiones_entrenamiento")
    OR EXISTS (SELECT 1 FROM "referencias_ejercicio")
    OR EXISTS (SELECT 1 FROM "cambios_de_fecha")
    OR EXISTS (SELECT 1 FROM "rutinas_guardadas")
    OR EXISTS (SELECT 1 FROM "operaciones_entrenamiento") THEN
    RAISE EXCEPTION 'Hay datos de entrenamiento: no se permite esta reversión';
  END IF;
END $$;
DROP TABLE "operaciones_entrenamiento", "referencias_ejercicio", "cambios_de_fecha";
DROP TABLE "sesiones_entrenamiento";
DROP TABLE "sesiones_programadas", "planes_entrenamiento", "rutinas_guardadas";
DROP TYPE "EstadoSesionProgramada";
COMMIT;
