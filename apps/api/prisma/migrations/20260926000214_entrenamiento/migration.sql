-- CreateEnum
CREATE TYPE "GrupoMuscular" AS ENUM ('pecho', 'espalda', 'hombros', 'biceps', 'triceps', 'antebrazos', 'abdomen', 'gluteos', 'cuadriceps', 'isquiotibiales', 'gemelos');

-- CreateEnum
CREATE TYPE "EstadoEjercicio" AS ENUM ('publicado', 'retirado');

-- CreateEnum
CREATE TYPE "EstadoSesionProgramada" AS ENUM ('abierta', 'cerrada');

-- CreateTable
CREATE TABLE "ejercicios" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "nombreNormalizado" TEXT NOT NULL,
    "grupoPrincipal" "GrupoMuscular" NOT NULL,
    "instrucciones" TEXT NOT NULL,
    "estado" "EstadoEjercicio" NOT NULL DEFAULT 'publicado',
    "retiradoEn" TIMESTAMP(3),
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ejercicios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "grupos_secundarios_de_ejercicio" (
    "ejercicioId" TEXT NOT NULL,
    "grupo" "GrupoMuscular" NOT NULL,

    CONSTRAINT "grupos_secundarios_de_ejercicio_pkey" PRIMARY KEY ("ejercicioId","grupo")
);

-- CreateTable
CREATE TABLE "sesiones_programadas" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "fechaOriginal" DATE NOT NULL,
    "fechaActual" DATE NOT NULL,
    "estado" "EstadoSesionProgramada" NOT NULL DEFAULT 'abierta',
    "revision" INTEGER NOT NULL DEFAULT 0,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sesiones_programadas_pkey" PRIMARY KEY ("id")
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
CREATE TABLE "planes_entrenamiento" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "operacionId" TEXT NOT NULL,
    "huella" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "semanaInicial" DATE NOT NULL,
    "semanas" INTEGER NOT NULL,
    "patron" JSONB NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "planes_entrenamiento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sesiones_entrenamiento" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "prescripcion" JSONB NOT NULL,
    "revisionPrescripcion" INTEGER NOT NULL DEFAULT 0,
    "borrador" JSONB,
    "revisionBorrador" INTEGER NOT NULL DEFAULT 0,
    "operacionBorrador" TEXT,
    "huellaBorrador" TEXT,
    "iniciadaEn" TIMESTAMP(3),
    "resultado" JSONB,
    "enviadoEn" TIMESTAMP(3),
    "operacionEnvio" TEXT,
    "huellaEnvio" TEXT,

    CONSTRAINT "sesiones_entrenamiento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "referencias_ejercicio" (
    "sesionId" TEXT NOT NULL,
    "clave" TEXT NOT NULL,
    "ejercicioId" TEXT NOT NULL,

    CONSTRAINT "referencias_ejercicio_pkey" PRIMARY KEY ("sesionId","clave")
);

-- CreateTable
CREATE TABLE "rutinas_guardadas" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "patron" JSONB NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 0,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rutinas_guardadas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ejercicios_nombreNormalizado_key" ON "ejercicios"("nombreNormalizado");

-- CreateIndex
CREATE INDEX "ejercicios_estado_grupoPrincipal_idx" ON "ejercicios"("estado", "grupoPrincipal");

-- CreateIndex
CREATE INDEX "grupos_secundarios_de_ejercicio_grupo_idx" ON "grupos_secundarios_de_ejercicio"("grupo");

-- CreateIndex
CREATE INDEX "sesiones_programadas_clienteId_fechaActual_idx" ON "sesiones_programadas"("clienteId", "fechaActual");

-- CreateIndex
CREATE INDEX "sesiones_programadas_fechaActual_idx" ON "sesiones_programadas"("fechaActual");

-- CreateIndex
CREATE INDEX "cambios_de_fecha_sesionId_idx" ON "cambios_de_fecha"("sesionId");

-- CreateIndex
CREATE UNIQUE INDEX "planes_entrenamiento_operacionId_key" ON "planes_entrenamiento"("operacionId");

-- CreateIndex
CREATE INDEX "planes_entrenamiento_clienteId_idx" ON "planes_entrenamiento"("clienteId");

-- CreateIndex
CREATE UNIQUE INDEX "sesiones_entrenamiento_operacionEnvio_key" ON "sesiones_entrenamiento"("operacionEnvio");

-- CreateIndex
CREATE INDEX "sesiones_entrenamiento_planId_idx" ON "sesiones_entrenamiento"("planId");

-- CreateIndex
CREATE INDEX "referencias_ejercicio_ejercicioId_idx" ON "referencias_ejercicio"("ejercicioId");

-- AddForeignKey
ALTER TABLE "grupos_secundarios_de_ejercicio" ADD CONSTRAINT "grupos_secundarios_de_ejercicio_ejercicioId_fkey" FOREIGN KEY ("ejercicioId") REFERENCES "ejercicios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sesiones_programadas" ADD CONSTRAINT "sesiones_programadas_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cambios_de_fecha" ADD CONSTRAINT "cambios_de_fecha_sesionId_fkey" FOREIGN KEY ("sesionId") REFERENCES "sesiones_programadas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cambios_de_fecha" ADD CONSTRAINT "cambios_de_fecha_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "planes_entrenamiento" ADD CONSTRAINT "planes_entrenamiento_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sesiones_entrenamiento" ADD CONSTRAINT "sesiones_entrenamiento_id_fkey" FOREIGN KEY ("id") REFERENCES "sesiones_programadas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sesiones_entrenamiento" ADD CONSTRAINT "sesiones_entrenamiento_planId_fkey" FOREIGN KEY ("planId") REFERENCES "planes_entrenamiento"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referencias_ejercicio" ADD CONSTRAINT "referencias_ejercicio_sesionId_fkey" FOREIGN KEY ("sesionId") REFERENCES "sesiones_entrenamiento"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referencias_ejercicio" ADD CONSTRAINT "referencias_ejercicio_ejercicioId_fkey" FOREIGN KEY ("ejercicioId") REFERENCES "ejercicios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
