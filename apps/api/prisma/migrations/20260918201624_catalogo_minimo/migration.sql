-- CreateEnum
CREATE TYPE "GrupoMuscular" AS ENUM ('pecho', 'espalda', 'hombros', 'biceps', 'triceps', 'antebrazos', 'abdomen', 'gluteos', 'cuadriceps', 'isquiotibiales', 'gemelos');

-- CreateEnum
CREATE TYPE "EstadoEjercicio" AS ENUM ('publicado', 'retirado');

-- CreateTable
CREATE TABLE "ejercicios" (
    "id" TEXT NOT NULL,
    "nombre" VARCHAR(120) NOT NULL,
    "nombreNormalizado" VARCHAR(120) NOT NULL,
    "grupoPrincipal" "GrupoMuscular" NOT NULL,
    "instrucciones" VARCHAR(4000) NOT NULL,
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

-- CreateIndex
CREATE UNIQUE INDEX "ejercicios_nombreNormalizado_key" ON "ejercicios"("nombreNormalizado");

-- CreateIndex
CREATE INDEX "ejercicios_estado_grupoPrincipal_idx" ON "ejercicios"("estado", "grupoPrincipal");

-- CreateIndex
CREATE INDEX "grupos_secundarios_de_ejercicio_grupo_idx" ON "grupos_secundarios_de_ejercicio"("grupo");

-- AddForeignKey
ALTER TABLE "grupos_secundarios_de_ejercicio" ADD CONSTRAINT "grupos_secundarios_de_ejercicio_ejercicioId_fkey" FOREIGN KEY ("ejercicioId") REFERENCES "ejercicios"("id") ON DELETE CASCADE ON UPDATE CASCADE;
