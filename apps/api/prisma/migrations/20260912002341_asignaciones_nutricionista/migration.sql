-- CreateTable
CREATE TABLE "asignaciones_nutricionista" (
    "id" TEXT NOT NULL,
    "nutricionistaId" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "desde" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "asignaciones_nutricionista_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "asignaciones_nutricionista_clienteId_idx" ON "asignaciones_nutricionista"("clienteId");

-- CreateIndex
CREATE UNIQUE INDEX "asignaciones_nutricionista_nutricionistaId_clienteId_key" ON "asignaciones_nutricionista"("nutricionistaId", "clienteId");

-- AddForeignKey
ALTER TABLE "asignaciones_nutricionista" ADD CONSTRAINT "asignaciones_nutricionista_nutricionistaId_fkey" FOREIGN KEY ("nutricionistaId") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asignaciones_nutricionista" ADD CONSTRAINT "asignaciones_nutricionista_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;
