-- Horarios, reservas, saldo y cobros (SPEC-agenda.md ampliación y SPEC-planes.md).
-- Aditiva: solo crea tipos, tablas e índices nuevos; no toca datos existentes.

-- CreateEnum
CREATE TYPE "ClaseSaldo" AS ENUM ('ep', 'boxeo');

-- CreateEnum
CREATE TYPE "TipoExcepcionAgenda" AS ENUM ('cierre', 'apertura');

-- CreateEnum
CREATE TYPE "EstadoReserva" AS ENUM ('confirmada', 'cancelada');

-- CreateEnum
CREATE TYPE "TipoProducto" AS ENUM ('plan', 'bono', 'matricula');

-- CreateEnum
CREATE TYPE "OrigenBono" AS ENUM ('compra', 'compensacion');

-- CreateEnum
CREATE TYPE "MotivoMovimiento" AS ENUM ('consumo', 'devolucion', 'ajuste');

-- CreateEnum
CREATE TYPE "EstadoSolicitudProducto" AS ENUM ('pendiente', 'activada', 'rechazada', 'anulada');

-- CreateEnum
CREATE TYPE "EstadoCobro" AS ENUM ('pendiente', 'cobrado', 'anulado');

-- CreateEnum
CREATE TYPE "OrigenCobro" AS ENUM ('producto', 'reserva', 'manual');

-- CreateTable
CREATE TABLE "ajustes_agenda" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "antelacionMin" INTEGER NOT NULL DEFAULT 120,
    "horizonteDias" INTEGER NOT NULL DEFAULT 28,
    "cancelacionHoras" INTEGER NOT NULL DEFAULT 24,
    "intervaloMin" INTEGER NOT NULL DEFAULT 60,
    "actualizadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ajustes_agenda_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "servicios_agenda" (
    "id" TEXT NOT NULL,
    "codigo" VARCHAR(40) NOT NULL,
    "nombre" VARCHAR(60) NOT NULL,
    "descripcion" VARCHAR(200),
    "duracionMin" INTEGER NOT NULL,
    "minPersonas" INTEGER NOT NULL DEFAULT 1,
    "maxPersonas" INTEGER NOT NULL DEFAULT 1,
    "claseDeSaldo" "ClaseSaldo",
    "precioCentimos" INTEGER,
    "reservable" BOOLEAN NOT NULL DEFAULT true,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "orden" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "servicios_agenda_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tarifas_grupo" (
    "servicioId" TEXT NOT NULL,
    "personas" INTEGER NOT NULL,
    "precioPorPersonaCentimos" INTEGER NOT NULL,

    CONSTRAINT "tarifas_grupo_pkey" PRIMARY KEY ("servicioId","personas")
);

-- CreateTable
CREATE TABLE "franjas_semanales" (
    "id" TEXT NOT NULL,
    "diaSemana" INTEGER NOT NULL,
    "inicioMin" INTEGER NOT NULL,
    "finMin" INTEGER NOT NULL,

    CONSTRAINT "franjas_semanales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "excepciones_agenda" (
    "id" TEXT NOT NULL,
    "tipo" "TipoExcepcionAgenda" NOT NULL,
    "inicio" TIMESTAMPTZ(3) NOT NULL,
    "fin" TIMESTAMPTZ(3) NOT NULL,
    "motivo" VARCHAR(120),
    "autorId" TEXT NOT NULL,
    "creadaEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "excepciones_agenda_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reservas" (
    "id" TEXT NOT NULL,
    "servicioId" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "inicio" TIMESTAMPTZ(3) NOT NULL,
    "fin" TIMESTAMPTZ(3) NOT NULL,
    "personas" INTEGER NOT NULL DEFAULT 1,
    "estado" "EstadoReserva" NOT NULL DEFAULT 'confirmada',
    "cargoSaldo" VARCHAR(80),
    "creadaPorId" TEXT NOT NULL,
    "operacionId" TEXT NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 0,
    "creadaEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "canceladaEn" TIMESTAMP(3),
    "canceladaPorId" TEXT,
    "canceladaPorEntrenador" BOOLEAN,
    "motivoCancelacion" VARCHAR(200),
    "devueltaAManoEn" TIMESTAMP(3),

    CONSTRAINT "reservas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "productos" (
    "id" TEXT NOT NULL,
    "codigo" VARCHAR(40) NOT NULL,
    "tipo" "TipoProducto" NOT NULL,
    "clase" "ClaseSaldo",
    "nombre" VARCHAR(80) NOT NULL,
    "descripcion" VARCHAR(200),
    "precioCentimos" INTEGER NOT NULL,
    "sesionesPorMes" INTEGER,
    "clasesPorSemana" INTEGER,
    "meses" INTEGER,
    "sesiones" INTEGER,
    "validezDias" INTEGER,
    "regalo" VARCHAR(120),
    "visibleParaCliente" BOOLEAN NOT NULL DEFAULT true,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "orden" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "productos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "suscripciones" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "productoId" TEXT NOT NULL,
    "nombre" VARCHAR(80) NOT NULL,
    "clase" "ClaseSaldo" NOT NULL,
    "sesionesPorMes" INTEGER NOT NULL,
    "clasesPorSemana" INTEGER,
    "mesInicio" DATE NOT NULL,
    "meses" INTEGER NOT NULL,
    "creadaPorId" TEXT NOT NULL,
    "creadaEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "suscripciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bonos" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "productoId" TEXT,
    "nombre" VARCHAR(80) NOT NULL,
    "clase" "ClaseSaldo" NOT NULL,
    "sesiones" INTEGER NOT NULL,
    "validezDias" INTEGER NOT NULL DEFAULT 365,
    "suelta" BOOLEAN NOT NULL DEFAULT false,
    "primerUsoEn" DATE,
    "caducaEn" DATE,
    "origen" "OrigenBono" NOT NULL DEFAULT 'compra',
    "creadoPorId" TEXT NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bonos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "movimientos_saldo" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "motivo" "MotivoMovimiento" NOT NULL,
    "suscripcionId" TEXT,
    "periodo" DATE,
    "bonoId" TEXT,
    "fechaSesion" DATE NOT NULL,
    "origenTipo" VARCHAR(30) NOT NULL,
    "origenId" VARCHAR(80) NOT NULL,
    "autorId" TEXT NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "movimientos_saldo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "solicitudes_producto" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "productoId" TEXT NOT NULL,
    "precioCentimos" INTEGER NOT NULL,
    "estado" "EstadoSolicitudProducto" NOT NULL DEFAULT 'pendiente',
    "operacionId" TEXT NOT NULL,
    "creadaEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resueltaEn" TIMESTAMP(3),
    "resueltaPorId" TEXT,

    CONSTRAINT "solicitudes_producto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cobros" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "concepto" VARCHAR(120) NOT NULL,
    "importeCentimos" INTEGER NOT NULL,
    "estado" "EstadoCobro" NOT NULL DEFAULT 'pendiente',
    "origenTipo" "OrigenCobro" NOT NULL,
    "origenId" VARCHAR(80),
    "cobradoEn" TIMESTAMP(3),
    "anuladoPorId" TEXT,
    "autorId" TEXT NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cobros_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "servicios_agenda_codigo_key" ON "servicios_agenda"("codigo");

-- CreateIndex
CREATE INDEX "franjas_semanales_diaSemana_idx" ON "franjas_semanales"("diaSemana");

-- CreateIndex
CREATE INDEX "excepciones_agenda_inicio_fin_idx" ON "excepciones_agenda"("inicio", "fin");

-- CreateIndex
CREATE INDEX "reservas_inicio_idx" ON "reservas"("inicio");

-- CreateIndex
CREATE INDEX "reservas_clienteId_inicio_idx" ON "reservas"("clienteId", "inicio");

-- CreateIndex
CREATE UNIQUE INDEX "reservas_creadaPorId_operacionId_key" ON "reservas"("creadaPorId", "operacionId");

-- CreateIndex
CREATE UNIQUE INDEX "productos_codigo_key" ON "productos"("codigo");

-- CreateIndex
CREATE INDEX "suscripciones_clienteId_mesInicio_idx" ON "suscripciones"("clienteId", "mesInicio");

-- CreateIndex
CREATE INDEX "bonos_clienteId_idx" ON "bonos"("clienteId");

-- CreateIndex
CREATE INDEX "movimientos_saldo_clienteId_creadoEn_idx" ON "movimientos_saldo"("clienteId", "creadoEn");

-- CreateIndex
CREATE INDEX "movimientos_saldo_suscripcionId_periodo_idx" ON "movimientos_saldo"("suscripcionId", "periodo");

-- CreateIndex
CREATE INDEX "movimientos_saldo_bonoId_idx" ON "movimientos_saldo"("bonoId");

-- CreateIndex
CREATE UNIQUE INDEX "movimientos_saldo_origenTipo_origenId_motivo_key" ON "movimientos_saldo"("origenTipo", "origenId", "motivo");

-- CreateIndex
CREATE INDEX "solicitudes_producto_estado_creadaEn_idx" ON "solicitudes_producto"("estado", "creadaEn");

-- CreateIndex
CREATE UNIQUE INDEX "solicitudes_producto_clienteId_operacionId_key" ON "solicitudes_producto"("clienteId", "operacionId");

-- CreateIndex
CREATE INDEX "cobros_estado_creadoEn_idx" ON "cobros"("estado", "creadoEn");

-- CreateIndex
CREATE INDEX "cobros_cobradoEn_idx" ON "cobros"("cobradoEn");

-- CreateIndex
CREATE INDEX "cobros_clienteId_idx" ON "cobros"("clienteId");

-- CreateIndex
CREATE UNIQUE INDEX "cobros_origenTipo_origenId_key" ON "cobros"("origenTipo", "origenId");

-- AddForeignKey
ALTER TABLE "tarifas_grupo" ADD CONSTRAINT "tarifas_grupo_servicioId_fkey" FOREIGN KEY ("servicioId") REFERENCES "servicios_agenda"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservas" ADD CONSTRAINT "reservas_servicioId_fkey" FOREIGN KEY ("servicioId") REFERENCES "servicios_agenda"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservas" ADD CONSTRAINT "reservas_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "suscripciones" ADD CONSTRAINT "suscripciones_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "suscripciones" ADD CONSTRAINT "suscripciones_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "productos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bonos" ADD CONSTRAINT "bonos_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bonos" ADD CONSTRAINT "bonos_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "productos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos_saldo" ADD CONSTRAINT "movimientos_saldo_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos_saldo" ADD CONSTRAINT "movimientos_saldo_suscripcionId_fkey" FOREIGN KEY ("suscripcionId") REFERENCES "suscripciones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos_saldo" ADD CONSTRAINT "movimientos_saldo_bonoId_fkey" FOREIGN KEY ("bonoId") REFERENCES "bonos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solicitudes_producto" ADD CONSTRAINT "solicitudes_producto_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solicitudes_producto" ADD CONSTRAINT "solicitudes_producto_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "productos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cobros" ADD CONSTRAINT "cobros_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Dos reservas confirmadas nunca se solapan, sea cual sea su duración. Lo
-- garantiza la base de datos además del código (23P01 → 409 en la API).
ALTER TABLE "reservas" ADD CONSTRAINT "reservas_sin_solape"
  EXCLUDE USING gist (tstzrange("inicio", "fin", '[)') WITH &&) WHERE ("estado" = 'confirmada');

ALTER TABLE "reservas" ADD CONSTRAINT "reservas_fin_posterior" CHECK ("fin" > "inicio");
ALTER TABLE "reservas" ADD CONSTRAINT "reservas_personas" CHECK ("personas" BETWEEN 1 AND 6);
ALTER TABLE "franjas_semanales" ADD CONSTRAINT "franjas_semanales_limites"
  CHECK ("diaSemana" BETWEEN 1 AND 7 AND "inicioMin" >= 0 AND "finMin" <= 1440 AND "finMin" > "inicioMin");
ALTER TABLE "excepciones_agenda" ADD CONSTRAINT "excepciones_agenda_fin_posterior" CHECK ("fin" > "inicio");
ALTER TABLE "cobros" ADD CONSTRAINT "cobros_importe" CHECK ("importeCentimos" >= 0);

-- Solo una solicitud pendiente por cliente y producto.
CREATE UNIQUE INDEX "solicitudes_producto_una_pendiente"
  ON "solicitudes_producto" ("clienteId", "productoId") WHERE ("estado" = 'pendiente');

-- La fila única de ajustes existe siempre: es el candado de la agenda.
INSERT INTO "ajustes_agenda" ("id", "actualizadoEn") VALUES (1, CURRENT_TIMESTAMP) ON CONFLICT ("id") DO NOTHING;
