-- CreateEnum
CREATE TYPE "EstadoHuecoDisponibilidad" AS ENUM ('libre', 'reservado', 'cerrado');

-- CreateTable
CREATE TABLE "aperturas_disponibilidad" (
    "id" TEXT NOT NULL,
    "entrenadorId" TEXT NOT NULL,
    "operacionId" TEXT NOT NULL,
    "peticion" JSONB NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "aperturas_disponibilidad_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "huecos_disponibilidad" (
    "id" TEXT NOT NULL,
    "entrenadorId" TEXT NOT NULL,
    "aperturaId" TEXT NOT NULL,
    "fecha" DATE NOT NULL,
    "horaInicio" VARCHAR(5) NOT NULL,
    "inicioEn" TIMESTAMPTZ(3) NOT NULL,
    "finEn" TIMESTAMPTZ(3) NOT NULL,
    "duracionMinutos" INTEGER NOT NULL DEFAULT 60,
    "servicios" "ServicioReserva"[],
    "estado" "EstadoHuecoDisponibilidad" NOT NULL DEFAULT 'libre',
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cerradoEn" TIMESTAMP(3),

    CONSTRAINT "huecos_disponibilidad_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "aperturas_disponibilidad_entrenadorId_operacionId_key" ON "aperturas_disponibilidad"("entrenadorId", "operacionId");

-- CreateIndex
CREATE INDEX "huecos_disponibilidad_entrenadorId_fecha_inicioEn_id_idx" ON "huecos_disponibilidad"("entrenadorId", "fecha", "inicioEn", "id");

-- CreateIndex
CREATE INDEX "huecos_disponibilidad_entrenadorId_estado_inicioEn_finEn_idx" ON "huecos_disponibilidad"("entrenadorId", "estado", "inicioEn", "finEn");

-- AddForeignKey
ALTER TABLE "aperturas_disponibilidad" ADD CONSTRAINT "aperturas_disponibilidad_entrenadorId_fkey" FOREIGN KEY ("entrenadorId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "huecos_disponibilidad" ADD CONSTRAINT "huecos_disponibilidad_entrenadorId_fkey" FOREIGN KEY ("entrenadorId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "huecos_disponibilidad" ADD CONSTRAINT "huecos_disponibilidad_aperturaId_fkey" FOREIGN KEY ("aperturaId") REFERENCES "aperturas_disponibilidad"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
