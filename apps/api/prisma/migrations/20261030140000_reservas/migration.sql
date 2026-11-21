CREATE TYPE "EstadoReserva" AS ENUM ('confirmada', 'cancelada');

CREATE TABLE "reservas" (
  "id" TEXT NOT NULL,
  "huecoId" TEXT NOT NULL,
  "clienteId" TEXT NOT NULL,
  "entrenadorId" TEXT NOT NULL,
  "operacionId" TEXT NOT NULL,
  "servicio" "ServicioReserva" NOT NULL,
  "cantidadConsumida" INTEGER NOT NULL,
  "mesCupo" VARCHAR(7),
  "estado" "EstadoReserva" NOT NULL DEFAULT 'confirmada',
  "creadaEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "canceladaEn" TIMESTAMP(3),
  "devuelto" BOOLEAN NOT NULL DEFAULT false,
  "asistio" BOOLEAN,
  "asistenciaEn" TIMESTAMP(3),
  "consumoId" TEXT NOT NULL,
  "devolucionId" TEXT,
  CONSTRAINT "reservas_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "reservas_servicio_cantidad_check" CHECK (
    ("servicio" = 'entrenoPersonal' AND "cantidadConsumida" = 1 AND "mesCupo" IS NULL)
    OR ("servicio" = 'seguimiento' AND "cantidadConsumida" BETWEEN 1 AND 480 AND "mesCupo" IS NOT NULL AND "mesCupo" ~ '^(?!0000)[0-9]{4}-(0[1-9]|1[0-2])$')
  ),
  CONSTRAINT "reservas_cancelacion_check" CHECK (("estado" = 'cancelada') = ("canceladaEn" IS NOT NULL)),
  CONSTRAINT "reservas_devolucion_check" CHECK (
    "devuelto" = ("devolucionId" IS NOT NULL) AND (NOT "devuelto" OR "estado" = 'cancelada')
  ),
  CONSTRAINT "reservas_asistencia_check" CHECK (("asistio" IS NULL) = ("asistenciaEn" IS NULL))
);
CREATE UNIQUE INDEX "reservas_entrenadorId_operacionId_key" ON "reservas"("entrenadorId", "operacionId");
CREATE UNIQUE INDEX "reservas_consumoId_key" ON "reservas"("consumoId");
CREATE UNIQUE INDEX "reservas_devolucionId_key" ON "reservas"("devolucionId");
CREATE UNIQUE INDEX "reservas_hueco_confirmado_key" ON "reservas"("huecoId") WHERE "estado" = 'confirmada';
CREATE INDEX "reservas_clienteId_creadaEn_id_idx" ON "reservas"("clienteId", "creadaEn", "id");
CREATE INDEX "reservas_entrenadorId_creadaEn_id_idx" ON "reservas"("entrenadorId", "creadaEn", "id");
CREATE INDEX "reservas_huecoId_idx" ON "reservas"("huecoId");
ALTER TABLE "reservas" ADD CONSTRAINT "reservas_huecoId_fkey" FOREIGN KEY ("huecoId") REFERENCES "huecos_disponibilidad"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "reservas" ADD CONSTRAINT "reservas_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "reservas" ADD CONSTRAINT "reservas_entrenadorId_fkey" FOREIGN KEY ("entrenadorId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "reservas" ADD CONSTRAINT "reservas_consumoId_fkey" FOREIGN KEY ("consumoId") REFERENCES "movimientos_bono"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "reservas" ADD CONSTRAINT "reservas_devolucionId_fkey" FOREIGN KEY ("devolucionId") REFERENCES "movimientos_bono"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "avisos_reserva" (
  "id" TEXT NOT NULL,
  "reservaId" TEXT NOT NULL,
  "tipo" VARCHAR(20) NOT NULL,
  "creadaEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "leidaEn" TIMESTAMP(3),
  CONSTRAINT "avisos_reserva_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "avisos_reserva_tipo_check" CHECK ("tipo" IN ('asignada', 'cancelada'))
);
CREATE UNIQUE INDEX "avisos_reserva_reservaId_tipo_key" ON "avisos_reserva"("reservaId", "tipo");
CREATE INDEX "avisos_reserva_creadaEn_id_idx" ON "avisos_reserva"("creadaEn", "id");
ALTER TABLE "avisos_reserva" ADD CONSTRAINT "avisos_reserva_reservaId_fkey" FOREIGN KEY ("reservaId") REFERENCES "reservas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
