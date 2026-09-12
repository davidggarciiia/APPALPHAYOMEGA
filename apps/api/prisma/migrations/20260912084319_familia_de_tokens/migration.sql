-- Anade la familia de tokens de refresco.
--
-- Las dos columnas son obligatorias, asi que no se pueden anadir de golpe sobre
-- una tabla con filas. Se hace en tres pasos, que es el patron correcto y el
-- que hara falta el dia que haya sesiones de clientes reales:
--   1. anadir la columna permitiendo nulos
--   2. rellenar las filas existentes
--   3. imponer la obligatoriedad
--
-- A cada sesion ya existente se le da su propia familia, con `gen_random_uuid()`
-- por fila, y se toma su fecha de creacion como nacimiento de la cadena. Es la
-- interpretacion honesta: cada token vivo es la cabeza de su propia cadena.

-- Paso 1: columnas nulables
ALTER TABLE "tokens_refresco" ADD COLUMN "familiaId" TEXT;
ALTER TABLE "tokens_refresco" ADD COLUMN "familiaCreadaEn" TIMESTAMP(3);

-- Paso 2: relleno de lo que ya estaba
UPDATE "tokens_refresco"
SET "familiaId" = gen_random_uuid()::text,
    "familiaCreadaEn" = "creadoEn"
WHERE "familiaId" IS NULL;

-- Paso 3: ya no admiten nulos
ALTER TABLE "tokens_refresco" ALTER COLUMN "familiaId" SET NOT NULL;
ALTER TABLE "tokens_refresco" ALTER COLUMN "familiaCreadaEn" SET NOT NULL;

-- CreateIndex
CREATE INDEX "tokens_refresco_familiaId_idx" ON "tokens_refresco"("familiaId");
