-- Configuración por cliente. No modifica las filas previas de seguimiento.
CREATE TABLE "configuraciones_seguimiento" (
    "clienteId" TEXT NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "documento" JSONB NOT NULL,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "configuraciones_seguimiento_pkey" PRIMARY KEY ("clienteId")
);

ALTER TABLE "configuraciones_seguimiento"
  ADD CONSTRAINT "configuraciones_seguimiento_revision_valida" CHECK ("revision" >= 1);
ALTER TABLE "configuraciones_seguimiento"
  ADD CONSTRAINT "configuraciones_seguimiento_clienteId_fkey"
  FOREIGN KEY ("clienteId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "pruebas_fisicas" ADD COLUMN "pruebaId" TEXT;
CREATE INDEX "pruebas_fisicas_clienteId_pruebaId_fecha_idx"
  ON "pruebas_fisicas"("clienteId", "pruebaId", "fecha");
