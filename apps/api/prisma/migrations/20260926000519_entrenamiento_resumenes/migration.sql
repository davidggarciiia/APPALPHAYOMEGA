-- Columnas de resumen de las sesiones de entrenamiento.
--
-- `nombre` copia `prescripcion.nombre` para que los listados y el panel del
-- entrenador no lean el documento JSON. Se rellena desde la prescripcion antes
-- de exigirla, asi la migracion vale tambien con filas existentes.
ALTER TABLE "sesiones_entrenamiento"
ADD COLUMN "borradorActualizadoEn" TIMESTAMP(3),
ADD COLUMN "nombre" TEXT,
ADD COLUMN "seriesHechas" INTEGER,
ADD COLUMN "seriesPrescritas" INTEGER;

UPDATE "sesiones_entrenamiento" SET "nombre" = "prescripcion"->>'nombre' WHERE "nombre" IS NULL;

ALTER TABLE "sesiones_entrenamiento" ALTER COLUMN "nombre" SET NOT NULL;
