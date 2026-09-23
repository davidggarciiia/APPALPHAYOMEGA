-- CreateEnum
CREATE TYPE "EstadoDieta" AS ENUM ('borrador', 'publicada', 'archivada');

-- CreateTable
CREATE TABLE "dietas" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "estado" "EstadoDieta" NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "documento" JSONB NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 0,
    "operacionPublicacion" TEXT,
    "hashPublicacion" TEXT,
    "creadaPorId" TEXT NOT NULL,
    "publicadaPorId" TEXT,
    "creadaEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadaEn" TIMESTAMP(3) NOT NULL,
    "publicadaEn" TIMESTAMP(3),
    "archivadaEn" TIMESTAMP(3),

    CONSTRAINT "dietas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "dietas_clienteId_estado_idx" ON "dietas"("clienteId", "estado");

-- CreateIndex
CREATE UNIQUE INDEX "dietas_clienteId_operacionPublicacion_key" ON "dietas"("clienteId", "operacionPublicacion");

-- AddForeignKey
ALTER TABLE "dietas" ADD CONSTRAINT "dietas_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dietas" ADD CONSTRAINT "dietas_creadaPorId_fkey" FOREIGN KEY ("creadaPorId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dietas" ADD CONSTRAINT "dietas_publicadaPorId_fkey" FOREIGN KEY ("publicadaPorId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Coherencia del estado. Prisma no modela CHECK y no los toca en migraciones
-- posteriores. La regla de un borrador y una publicada por cliente la garantiza
-- el bloqueo de la fila del cliente en cada escritura (DietasService).
ALTER TABLE "dietas" ADD CONSTRAINT "dieta_revision_valida" CHECK ("revision" >= 0 AND "version" > 0);
ALTER TABLE "dietas" ADD CONSTRAINT "dieta_estado_coherente" CHECK (
  ("estado" = 'borrador' AND "publicadaEn" IS NULL AND "publicadaPorId" IS NULL AND "archivadaEn" IS NULL)
  OR ("estado" = 'publicada' AND "publicadaEn" IS NOT NULL AND "publicadaPorId" IS NOT NULL AND "archivadaEn" IS NULL)
  OR ("estado" = 'archivada' AND "publicadaEn" IS NOT NULL AND "publicadaPorId" IS NOT NULL AND "archivadaEn" IS NOT NULL)
);
