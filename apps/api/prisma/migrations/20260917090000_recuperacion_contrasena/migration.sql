-- CreateTable
CREATE TABLE "tokens_recuperacion" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "expiraEn" TIMESTAMP(3) NOT NULL,
    "usadoEn" TIMESTAMP(3),
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tokens_recuperacion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tokens_recuperacion_usuarioId_idx" ON "tokens_recuperacion"("usuarioId");

-- AddForeignKey
ALTER TABLE "tokens_recuperacion" ADD CONSTRAINT "tokens_recuperacion_usuarioId_fkey"
FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;
