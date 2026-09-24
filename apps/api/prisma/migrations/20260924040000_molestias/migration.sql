-- CreateEnum
CREATE TYPE "ZonaDeMolestia" AS ENUM ('hombro', 'codo', 'muneca', 'lumbar', 'otra');

-- CreateEnum
CREATE TYPE "EstadoMolestia" AS ENUM ('abierta', 'atendida');

-- CreateTable
CREATE TABLE "molestias" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "sesionId" TEXT NOT NULL,
    "operacionId" TEXT NOT NULL,
    "ejercicioPrescritoId" TEXT,
    "ejercicio" VARCHAR(120),
    "serie" INTEGER,
    "zona" "ZonaDeMolestia" NOT NULL,
    "intensidad" INTEGER NOT NULL,
    "sintomas" TEXT[],
    "nota" VARCHAR(1000),
    "estado" "EstadoMolestia" NOT NULL DEFAULT 'abierta',
    "respuesta" VARCHAR(1000),
    "atendidaPorId" TEXT,
    "atendidaEn" TIMESTAMP(3),
    "creadaEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "molestias_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "molestias_clienteId_estado_creadaEn_idx" ON "molestias"("clienteId", "estado", "creadaEn");

-- CreateIndex
CREATE UNIQUE INDEX "molestias_clienteId_operacionId_key" ON "molestias"("clienteId", "operacionId");

-- AddForeignKey
ALTER TABLE "molestias" ADD CONSTRAINT "molestias_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "molestias" ADD CONSTRAINT "molestias_sesionId_clienteId_fkey" FOREIGN KEY ("sesionId", "clienteId") REFERENCES "sesiones_entrenamiento"("id", "clienteId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "molestias" ADD CONSTRAINT "molestias_atendidaPorId_fkey" FOREIGN KEY ("atendidaPorId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Intensidad de 0 a 10 y coherencia del estado (Prisma no genera CHECK).
ALTER TABLE "molestias" ADD CONSTRAINT "molestia_intensidad_valida" CHECK ("intensidad" BETWEEN 0 AND 10);
ALTER TABLE "molestias" ADD CONSTRAINT "molestia_estado_coherente" CHECK (
  ("estado" = 'abierta' AND "atendidaEn" IS NULL AND "respuesta" IS NULL) OR
  ("estado" = 'atendida' AND "atendidaEn" IS NOT NULL AND "respuesta" IS NOT NULL AND "atendidaPorId" IS NOT NULL)
);
