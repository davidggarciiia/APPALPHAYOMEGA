-- Nutrición del diseño: comidas marcadas como hechas y suplementos del día.
-- Aditiva: tabla nueva y columna con valor por defecto.
-- AlterTable
ALTER TABLE "dias_seguimiento" ADD COLUMN     "suplementos" JSONB NOT NULL DEFAULT '[]';

-- CreateTable
CREATE TABLE "comidas_registradas" (
    "clienteId" TEXT NOT NULL,
    "fecha" DATE NOT NULL,
    "comidaId" TEXT NOT NULL,
    "dietaId" TEXT NOT NULL,
    "eleccion" JSONB NOT NULL,
    "registradaEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "comidas_registradas_pkey" PRIMARY KEY ("clienteId","fecha","comidaId")
);

-- CreateIndex
CREATE INDEX "comidas_registradas_dietaId_idx" ON "comidas_registradas"("dietaId");

-- AddForeignKey
ALTER TABLE "comidas_registradas" ADD CONSTRAINT "comidas_registradas_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comidas_registradas" ADD CONSTRAINT "comidas_registradas_dietaId_fkey" FOREIGN KEY ("dietaId") REFERENCES "dietas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

