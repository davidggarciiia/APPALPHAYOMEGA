-- Fotos privadas de evolución y solicitudes de fotos (F01b). Aditiva: no modifica
-- valoraciones, medidas ni registros existentes. Nunca guarda URLs firmadas.
-- CreateEnum
CREATE TYPE "VistaFoto" AS ENUM ('frente', 'espalda', 'perfilIzquierdo', 'perfilDerecho', 'otra');

-- CreateEnum
CREATE TYPE "EstadoMedio" AS ENUM ('pendiente', 'disponible', 'eliminando', 'eliminado');

-- CreateEnum
CREATE TYPE "OrigenMedio" AS ENUM ('profesional', 'cliente');

-- CreateEnum
CREATE TYPE "EstadoSolicitudFotos" AS ENUM ('pendiente', 'recibida', 'revisada');

-- CreateTable
CREATE TABLE "medios_fotos" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "autorId" TEXT NOT NULL,
    "operacionId" TEXT NOT NULL,
    "origen" "OrigenMedio" NOT NULL,
    "vista" "VistaFoto" NOT NULL,
    "etiqueta" VARCHAR(40),
    "fechaToma" DATE NOT NULL,
    "estado" "EstadoMedio" NOT NULL DEFAULT 'pendiente',
    "tipoMime" VARCHAR(20) NOT NULL,
    "bytes" INTEGER NOT NULL,
    "clave" TEXT NOT NULL,
    "subidaCaducaEn" TIMESTAMP(3) NOT NULL,
    "valoracionId" TEXT,
    "solicitudId" TEXT,
    "publicadaEn" TIMESTAMP(3),
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmadoEn" TIMESTAMP(3),
    "eliminadoEn" TIMESTAMP(3),

    CONSTRAINT "medios_fotos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "solicitudes_fotos" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "autorId" TEXT NOT NULL,
    "operacionId" TEXT NOT NULL,
    "vistas" "VistaFoto"[],
    "fechaLimite" DATE,
    "mensaje" VARCHAR(200),
    "estado" "EstadoSolicitudFotos" NOT NULL DEFAULT 'pendiente',
    "creadaEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recibidaEn" TIMESTAMP(3),
    "revisadaEn" TIMESTAMP(3),
    "revisionOperacionId" TEXT,

    CONSTRAINT "solicitudes_fotos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "medios_fotos_clave_key" ON "medios_fotos"("clave");

-- CreateIndex
CREATE INDEX "medios_fotos_clienteId_vista_fechaToma_idx" ON "medios_fotos"("clienteId", "vista", "fechaToma");

-- CreateIndex
CREATE INDEX "medios_fotos_valoracionId_idx" ON "medios_fotos"("valoracionId");

-- CreateIndex
CREATE INDEX "medios_fotos_solicitudId_idx" ON "medios_fotos"("solicitudId");

-- CreateIndex
CREATE INDEX "medios_fotos_estado_subidaCaducaEn_idx" ON "medios_fotos"("estado", "subidaCaducaEn");

-- CreateIndex
CREATE UNIQUE INDEX "medios_fotos_autorId_operacionId_key" ON "medios_fotos"("autorId", "operacionId");

-- CreateIndex
CREATE INDEX "solicitudes_fotos_clienteId_creadaEn_idx" ON "solicitudes_fotos"("clienteId", "creadaEn");

-- CreateIndex
CREATE UNIQUE INDEX "solicitudes_fotos_autorId_operacionId_key" ON "solicitudes_fotos"("autorId", "operacionId");

-- AddForeignKey
ALTER TABLE "medios_fotos" ADD CONSTRAINT "medios_fotos_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medios_fotos" ADD CONSTRAINT "medios_fotos_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medios_fotos" ADD CONSTRAINT "medios_fotos_valoracionId_fkey" FOREIGN KEY ("valoracionId") REFERENCES "valoraciones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medios_fotos" ADD CONSTRAINT "medios_fotos_solicitudId_fkey" FOREIGN KEY ("solicitudId") REFERENCES "solicitudes_fotos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solicitudes_fotos" ADD CONSTRAINT "solicitudes_fotos_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solicitudes_fotos" ADD CONSTRAINT "solicitudes_fotos_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Coherencia que Prisma no modela.
ALTER TABLE "medios_fotos"
  ADD CONSTRAINT "medio_foto_bytes_validos" CHECK ("bytes" BETWEEN 1 AND 8388608),
  ADD CONSTRAINT "medio_foto_formato_valido" CHECK ("tipoMime" IN ('image/jpeg', 'image/png', 'image/webp')),
  ADD CONSTRAINT "medio_foto_etiqueta_coherente" CHECK (("vista" = 'otra') = ("etiqueta" IS NOT NULL)),
  ADD CONSTRAINT "medio_foto_origen_coherente" CHECK (
    ("origen" = 'cliente') = ("solicitudId" IS NOT NULL)
    AND ("origen" <> 'profesional' OR "valoracionId" IS NOT NULL)
  ),
  ADD CONSTRAINT "medio_foto_estado_coherente" CHECK (
    ("estado" <> 'disponible' OR "confirmadoEn" IS NOT NULL)
    AND (("estado" = 'eliminado') = ("eliminadoEn" IS NOT NULL))
    AND ("publicadaEn" IS NULL OR "valoracionId" IS NOT NULL)
  );
ALTER TABLE "solicitudes_fotos"
  ADD CONSTRAINT "solicitud_fotos_vistas_validas" CHECK (cardinality("vistas") BETWEEN 1 AND 4),
  ADD CONSTRAINT "solicitud_fotos_estado_coherente" CHECK (
    ("estado" = 'pendiente' OR "recibidaEn" IS NOT NULL)
    AND (("estado" = 'revisada') = ("revisadaEn" IS NOT NULL))
  );
