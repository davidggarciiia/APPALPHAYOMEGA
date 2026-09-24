-- Consentimiento explícito de datos de salud (RGPD, art. 9). Aditiva.
-- CreateTable
CREATE TABLE "consentimientos_salud" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "version" VARCHAR(40) NOT NULL,
    "aceptadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "retiradoEn" TIMESTAMP(3),

    CONSTRAINT "consentimientos_salud_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "consentimientos_salud_usuarioId_version_key" ON "consentimientos_salud"("usuarioId", "version");

-- AddForeignKey
ALTER TABLE "consentimientos_salud" ADD CONSTRAINT "consentimientos_salud_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


ALTER TABLE "consentimientos_salud"
  ADD CONSTRAINT "consentimiento_retirada_posterior" CHECK ("retiradoEn" IS NULL OR "retiradoEn" >= "aceptadoEn");
