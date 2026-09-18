-- CreateEnum
CREATE TYPE "EstadoSesionProgramada" AS ENUM ('abierta', 'cerrada');

-- CreateTable
CREATE TABLE "planes_entrenamiento" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "creadorId" TEXT NOT NULL,
    "operacionId" TEXT NOT NULL,
    "hashPeticion" TEXT NOT NULL,
    "nombre" VARCHAR(120) NOT NULL,
    "semanaInicial" DATE NOT NULL,
    "semanas" INTEGER NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "patron" JSONB NOT NULL,
    "respuesta" JSONB NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "planes_entrenamiento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sesiones_programadas" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "fechaOriginal" DATE NOT NULL,
    "fechaActual" DATE NOT NULL,
    "estado" "EstadoSesionProgramada" NOT NULL DEFAULT 'abierta',
    "revision" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "sesiones_programadas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sesiones_entrenamiento" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "prescripcion" JSONB NOT NULL,
    "revisionPrescripcion" INTEGER NOT NULL DEFAULT 0,
    "iniciada" BOOLEAN NOT NULL DEFAULT false,
    "revisionBorrador" INTEGER NOT NULL DEFAULT 0,
    "borrador" JSONB,
    "resultado" JSONB,
    "enviadoEn" TIMESTAMP(3),

    CONSTRAINT "sesiones_entrenamiento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "referencias_ejercicio" (
    "sesionId" TEXT NOT NULL,
    "idPrescrito" TEXT NOT NULL,
    "ejercicioId" TEXT NOT NULL,

    CONSTRAINT "referencias_ejercicio_pkey" PRIMARY KEY ("sesionId","idPrescrito")
);

-- CreateTable
CREATE TABLE "cambios_de_fecha" (
    "id" TEXT NOT NULL,
    "sesionId" TEXT NOT NULL,
    "fechaAnterior" DATE NOT NULL,
    "fechaNueva" DATE NOT NULL,
    "autorId" TEXT NOT NULL,
    "cambiadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cambios_de_fecha_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rutinas_guardadas" (
    "id" TEXT NOT NULL,
    "nombre" VARCHAR(120) NOT NULL,
    "creadorId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "patron" JSONB NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 0,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rutinas_guardadas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "operaciones_entrenamiento" (
    "sesionId" TEXT NOT NULL,
    "operacionId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "hashPeticion" TEXT NOT NULL,
    "respuesta" JSONB NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "operaciones_entrenamiento_pkey" PRIMARY KEY ("sesionId","operacionId")
);

-- CreateIndex
CREATE INDEX "planes_entrenamiento_clienteId_idx" ON "planes_entrenamiento"("clienteId");

-- CreateIndex
CREATE UNIQUE INDEX "planes_entrenamiento_creadorId_operacionId_key" ON "planes_entrenamiento"("creadorId", "operacionId");

-- CreateIndex
CREATE UNIQUE INDEX "planes_entrenamiento_id_clienteId_key" ON "planes_entrenamiento"("id", "clienteId");

-- CreateIndex
CREATE INDEX "sesiones_programadas_clienteId_fechaActual_idx" ON "sesiones_programadas"("clienteId", "fechaActual");

-- CreateIndex
CREATE UNIQUE INDEX "sesiones_programadas_id_clienteId_key" ON "sesiones_programadas"("id", "clienteId");

-- CreateIndex
CREATE INDEX "sesiones_entrenamiento_planId_idx" ON "sesiones_entrenamiento"("planId");

-- CreateIndex
CREATE UNIQUE INDEX "sesiones_entrenamiento_id_clienteId_key" ON "sesiones_entrenamiento"("id", "clienteId");

-- CreateIndex
CREATE INDEX "referencias_ejercicio_ejercicioId_idx" ON "referencias_ejercicio"("ejercicioId");

-- CreateIndex
CREATE INDEX "cambios_de_fecha_sesionId_cambiadoEn_idx" ON "cambios_de_fecha"("sesionId", "cambiadoEn");

-- CreateIndex
CREATE INDEX "rutinas_guardadas_creadorId_idx" ON "rutinas_guardadas"("creadorId");

-- AddForeignKey
ALTER TABLE "planes_entrenamiento" ADD CONSTRAINT "planes_entrenamiento_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "planes_entrenamiento" ADD CONSTRAINT "planes_entrenamiento_creadorId_fkey" FOREIGN KEY ("creadorId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sesiones_programadas" ADD CONSTRAINT "sesiones_programadas_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sesiones_entrenamiento" ADD CONSTRAINT "sesiones_entrenamiento_id_clienteId_fkey" FOREIGN KEY ("id", "clienteId") REFERENCES "sesiones_programadas"("id", "clienteId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sesiones_entrenamiento" ADD CONSTRAINT "sesiones_entrenamiento_planId_clienteId_fkey" FOREIGN KEY ("planId", "clienteId") REFERENCES "planes_entrenamiento"("id", "clienteId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referencias_ejercicio" ADD CONSTRAINT "referencias_ejercicio_sesionId_fkey" FOREIGN KEY ("sesionId") REFERENCES "sesiones_entrenamiento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referencias_ejercicio" ADD CONSTRAINT "referencias_ejercicio_ejercicioId_fkey" FOREIGN KEY ("ejercicioId") REFERENCES "ejercicios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cambios_de_fecha" ADD CONSTRAINT "cambios_de_fecha_sesionId_fkey" FOREIGN KEY ("sesionId") REFERENCES "sesiones_programadas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cambios_de_fecha" ADD CONSTRAINT "cambios_de_fecha_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rutinas_guardadas" ADD CONSTRAINT "rutinas_guardadas_creadorId_fkey" FOREIGN KEY ("creadorId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operaciones_entrenamiento" ADD CONSTRAINT "operaciones_entrenamiento_sesionId_fkey" FOREIGN KEY ("sesionId") REFERENCES "sesiones_entrenamiento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Invariantes que también deben sobrevivir a escrituras fuera del servicio.
ALTER TABLE "planes_entrenamiento" ADD CONSTRAINT "plan_semanas_validas" CHECK ("semanas" BETWEEN 1 AND 52 AND "version" > 0);
ALTER TABLE "sesiones_programadas" ADD CONSTRAINT "agenda_revision_valida" CHECK ("revision" >= 0);
ALTER TABLE "sesiones_programadas" ADD CONSTRAINT "agenda_misma_semana" CHECK (
  "fechaActual" BETWEEN date_trunc('week', "fechaOriginal"::timestamp)::date
  AND date_trunc('week', "fechaOriginal"::timestamp)::date + 6
);
ALTER TABLE "sesiones_entrenamiento" ADD CONSTRAINT "sesion_estado_coherente" CHECK (
  "version" > 0 AND "revisionPrescripcion" >= 0 AND "revisionBorrador" >= 0
  AND (("resultado" IS NULL) = ("enviadoEn" IS NULL))
  AND ("resultado" IS NULL OR ("iniciada" AND "borrador" IS NULL))
  AND ("borrador" IS NULL OR "iniciada")
);
ALTER TABLE "rutinas_guardadas" ADD CONSTRAINT "rutina_revision_valida" CHECK ("revision" >= 0 AND "version" > 0);
ALTER TABLE "operaciones_entrenamiento" ADD CONSTRAINT "operacion_tipo_valido" CHECK ("tipo" IN ('borrador', 'envio') AND "version" > 0);
