-- Alta directa con nombre, y enlace de activacion de un solo uso.
--
-- `nombre` es obligatorio pero la tabla ya tiene filas, asi que se anade en tres
-- pasos igual que la familia de tokens: nulable, relleno, obligatorio.
--
-- A las cuentas que ya existen se les pone la parte del correo anterior a la
-- arroba como nombre provisional. Es lo unico que sabemos de ellas, y es mejor
-- que un texto generico: quien lo vea en pantalla sabra a quien corresponde y
-- podra corregirlo.

-- Paso 1
ALTER TABLE "usuarios" ADD COLUMN "nombre" TEXT;
ALTER TABLE "usuarios" ADD COLUMN "apellidos" TEXT;

-- Paso 2
UPDATE "usuarios"
SET "nombre" = split_part("email", '@', 1)
WHERE "nombre" IS NULL;

-- Paso 3
ALTER TABLE "usuarios" ALTER COLUMN "nombre" SET NOT NULL;

-- CreateTable
CREATE TABLE "tokens_activacion" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "expiraEn" TIMESTAMP(3) NOT NULL,
    "usadoEn" TIMESTAMP(3),
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tokens_activacion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tokens_activacion_usuarioId_idx" ON "tokens_activacion"("usuarioId");

-- AddForeignKey
ALTER TABLE "tokens_activacion" ADD CONSTRAINT "tokens_activacion_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;
