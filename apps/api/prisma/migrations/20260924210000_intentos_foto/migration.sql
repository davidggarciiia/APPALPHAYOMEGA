-- Registro recuperable de copias privadas. No altera fotos ni registros existentes.
CREATE TABLE "intentos_foto" (
    "clave" TEXT NOT NULL,
    "medioId" TEXT NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "descartadoEn" TIMESTAMP(3),
    "reintentarEn" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "intentos_foto_pkey" PRIMARY KEY ("clave")
);

CREATE INDEX "intentos_foto_reintentarEn_clave_idx" ON "intentos_foto"("reintentarEn", "clave");
CREATE INDEX "intentos_foto_medioId_idx" ON "intentos_foto"("medioId");
