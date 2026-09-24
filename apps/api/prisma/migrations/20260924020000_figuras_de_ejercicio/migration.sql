-- CreateEnum
CREATE TYPE "TipoDeContenido" AS ENUM ('figura', 'video');

-- CreateEnum
CREATE TYPE "OrigenDeContenido" AS ENUM ('propio', 'licenciado', 'provisional');

-- CreateTable
CREATE TABLE "contenidos_de_ejercicio" (
    "id" TEXT NOT NULL,
    "ejercicioId" TEXT NOT NULL,
    "tipo" "TipoDeContenido" NOT NULL,
    "claveDeObjeto" VARCHAR(120) NOT NULL,
    "origen" "OrigenDeContenido" NOT NULL,
    "licencia" VARCHAR(200),
    "atribucion" VARCHAR(200),
    "subidoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contenidos_de_ejercicio_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "contenidos_de_ejercicio_ejercicioId_tipo_key" ON "contenidos_de_ejercicio"("ejercicioId", "tipo");

-- AddForeignKey
ALTER TABLE "contenidos_de_ejercicio" ADD CONSTRAINT "contenidos_de_ejercicio_ejercicioId_fkey" FOREIGN KEY ("ejercicioId") REFERENCES "ejercicios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

