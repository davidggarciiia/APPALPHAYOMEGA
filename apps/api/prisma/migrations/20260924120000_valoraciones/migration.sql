-- Valoración inicial y revisiones (V02). Aditiva: no modifica medidas, pruebas ni
-- registros diarios existentes.
-- CreateEnum
CREATE TYPE "TipoValoracion" AS ENUM ('inicial', 'revision');

-- CreateTable
CREATE TABLE "plantillas_valoracion" (
    "clienteId" TEXT NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "documento" JSONB NOT NULL,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plantillas_valoracion_pkey" PRIMARY KEY ("clienteId")
);

-- CreateTable
CREATE TABLE "valoraciones" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "autorId" TEXT NOT NULL,
    "tipo" "TipoValoracion" NOT NULL,
    "anteriorId" TEXT,
    "creadaEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "valoraciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "borradores_valoracion" (
    "id" TEXT NOT NULL,
    "valoracionId" TEXT NOT NULL,
    "autorId" TEXT NOT NULL,
    "corrigePublicacionId" TEXT,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "fechaToma" DATE NOT NULL,
    "documento" JSONB NOT NULL,
    "valoracionAbiertaId" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "borradores_valoracion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "publicaciones_valoracion" (
    "id" TEXT NOT NULL,
    "valoracionId" TEXT NOT NULL,
    "borradorId" TEXT NOT NULL,
    "numero" INTEGER NOT NULL,
    "sustituyeId" TEXT,
    "fechaToma" DATE NOT NULL,
    "autorId" TEXT NOT NULL,
    "documento" JSONB NOT NULL,
    "publicadaEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "publicaciones_valoracion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "operaciones_valoracion" (
    "autorId" TEXT NOT NULL,
    "operacionId" TEXT NOT NULL,
    "tipo" VARCHAR(20) NOT NULL,
    "hashPeticion" TEXT NOT NULL,
    "valoracionId" TEXT NOT NULL,
    "borradorId" TEXT,
    "publicacionId" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "operaciones_valoracion_pkey" PRIMARY KEY ("autorId","operacionId")
);

-- CreateTable
CREATE TABLE "proximas_revisiones_valoracion" (
    "clienteId" TEXT NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "pauta" JSONB,
    "cumplidaPorId" TEXT,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "proximas_revisiones_valoracion_pkey" PRIMARY KEY ("clienteId")
);

-- CreateTable
CREATE TABLE "lecturas_avisos_seguimiento" (
    "usuarioId" TEXT NOT NULL,
    "avisoId" TEXT NOT NULL,
    "tipo" VARCHAR(40) NOT NULL,
    "leidoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lecturas_avisos_seguimiento_pkey" PRIMARY KEY ("usuarioId","avisoId")
);

-- CreateIndex
CREATE INDEX "valoraciones_clienteId_creadaEn_idx" ON "valoraciones"("clienteId", "creadaEn");

-- CreateIndex
CREATE UNIQUE INDEX "borradores_valoracion_corrigePublicacionId_key" ON "borradores_valoracion"("corrigePublicacionId");

-- CreateIndex
CREATE UNIQUE INDEX "borradores_valoracion_valoracionAbiertaId_key" ON "borradores_valoracion"("valoracionAbiertaId");

-- CreateIndex
CREATE INDEX "borradores_valoracion_valoracionId_idx" ON "borradores_valoracion"("valoracionId");

-- CreateIndex
CREATE UNIQUE INDEX "publicaciones_valoracion_borradorId_key" ON "publicaciones_valoracion"("borradorId");

-- CreateIndex
CREATE UNIQUE INDEX "publicaciones_valoracion_sustituyeId_key" ON "publicaciones_valoracion"("sustituyeId");

-- CreateIndex
CREATE UNIQUE INDEX "publicaciones_valoracion_valoracionId_numero_key" ON "publicaciones_valoracion"("valoracionId", "numero");

-- CreateIndex
CREATE INDEX "operaciones_valoracion_valoracionId_idx" ON "operaciones_valoracion"("valoracionId");

-- CreateIndex
CREATE UNIQUE INDEX "proximas_revisiones_valoracion_cumplidaPorId_key" ON "proximas_revisiones_valoracion"("cumplidaPorId");

-- AddForeignKey
ALTER TABLE "plantillas_valoracion" ADD CONSTRAINT "plantillas_valoracion_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "valoraciones" ADD CONSTRAINT "valoraciones_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "valoraciones" ADD CONSTRAINT "valoraciones_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "valoraciones" ADD CONSTRAINT "valoraciones_anteriorId_fkey" FOREIGN KEY ("anteriorId") REFERENCES "valoraciones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "borradores_valoracion" ADD CONSTRAINT "borradores_valoracion_valoracionId_fkey" FOREIGN KEY ("valoracionId") REFERENCES "valoraciones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "borradores_valoracion" ADD CONSTRAINT "borradores_valoracion_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "borradores_valoracion" ADD CONSTRAINT "borradores_valoracion_corrigePublicacionId_fkey" FOREIGN KEY ("corrigePublicacionId") REFERENCES "publicaciones_valoracion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "publicaciones_valoracion" ADD CONSTRAINT "publicaciones_valoracion_valoracionId_fkey" FOREIGN KEY ("valoracionId") REFERENCES "valoraciones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "publicaciones_valoracion" ADD CONSTRAINT "publicaciones_valoracion_borradorId_fkey" FOREIGN KEY ("borradorId") REFERENCES "borradores_valoracion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "publicaciones_valoracion" ADD CONSTRAINT "publicaciones_valoracion_sustituyeId_fkey" FOREIGN KEY ("sustituyeId") REFERENCES "publicaciones_valoracion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "publicaciones_valoracion" ADD CONSTRAINT "publicaciones_valoracion_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operaciones_valoracion" ADD CONSTRAINT "operaciones_valoracion_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operaciones_valoracion" ADD CONSTRAINT "operaciones_valoracion_valoracionId_fkey" FOREIGN KEY ("valoracionId") REFERENCES "valoraciones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proximas_revisiones_valoracion" ADD CONSTRAINT "proximas_revisiones_valoracion_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proximas_revisiones_valoracion" ADD CONSTRAINT "proximas_revisiones_valoracion_cumplidaPorId_fkey" FOREIGN KEY ("cumplidaPorId") REFERENCES "valoraciones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lecturas_avisos_seguimiento" ADD CONSTRAINT "lecturas_avisos_seguimiento_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Coherencia que Prisma no modela (no genera CHECK ni los toca después).
ALTER TABLE "plantillas_valoracion"
  ADD CONSTRAINT "plantilla_valoracion_revision_valida" CHECK ("revision" >= 1);
ALTER TABLE "valoraciones"
  ADD CONSTRAINT "valoracion_anterior_coherente" CHECK (
    ("tipo" = 'inicial') = ("anteriorId" IS NULL) AND ("anteriorId" IS NULL OR "anteriorId" <> "id")
  );
ALTER TABLE "borradores_valoracion"
  ADD CONSTRAINT "borrador_valoracion_revision_valida" CHECK ("revision" >= 1),
  ADD CONSTRAINT "borrador_valoracion_abierto_coherente" CHECK (
    "valoracionAbiertaId" IS NULL OR "valoracionAbiertaId" = "valoracionId"
  );
ALTER TABLE "publicaciones_valoracion"
  ADD CONSTRAINT "publicacion_valoracion_numero_coherente" CHECK (
    "numero" >= 1 AND ("numero" = 1) = ("sustituyeId" IS NULL)
    AND ("sustituyeId" IS NULL OR "sustituyeId" <> "id")
  );
ALTER TABLE "operaciones_valoracion"
  ADD CONSTRAINT "operacion_valoracion_tipo_valido" CHECK ("tipo" IN ('crear', 'corregir', 'publicar'));
ALTER TABLE "proximas_revisiones_valoracion"
  ADD CONSTRAINT "proxima_revision_valoracion_revision_valida" CHECK ("revision" >= 1);
