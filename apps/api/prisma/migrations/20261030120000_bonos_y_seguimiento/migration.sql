-- CreateEnum
CREATE TYPE "ServicioReserva" AS ENUM ('entrenoPersonal', 'seguimiento', 'quiromasaje');

-- CreateEnum
CREATE TYPE "TipoMovimientoBono" AS ENUM ('carga', 'consumo', 'devolucion', 'ajuste');

-- CreateTable
CREATE TABLE "movimientos_bono" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "autorId" TEXT NOT NULL,
    "operacionId" TEXT NOT NULL,
    "servicio" "ServicioReserva" NOT NULL,
    "tipo" "TipoMovimientoBono" NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "mes" VARCHAR(7),
    "nota" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "movimientos_bono_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seguimiento_bonos" (
    "clienteId" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT false,
    "autorId" TEXT NOT NULL,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "seguimiento_bonos_pkey" PRIMARY KEY ("clienteId")
);

-- CreateIndex
CREATE INDEX "movimientos_bono_clienteId_servicio_mes_idx" ON "movimientos_bono"("clienteId", "servicio", "mes");

-- CreateIndex
CREATE INDEX "movimientos_bono_clienteId_creadoEn_id_idx" ON "movimientos_bono"("clienteId", "creadoEn", "id");

-- CreateIndex
CREATE UNIQUE INDEX "movimientos_bono_autorId_operacionId_key" ON "movimientos_bono"("autorId", "operacionId");

-- Un solo cupo por mes; reactivar el seguimiento no vuelve a conceder minutos.
CREATE UNIQUE INDEX "movimientos_bono_cupo_mensual_key"
ON "movimientos_bono"("clienteId", "mes")
WHERE "servicio" = 'seguimiento' AND "tipo" = 'carga';

ALTER TABLE "movimientos_bono"
ADD CONSTRAINT "movimientos_bono_cantidad_check" CHECK (
    "cantidad" <> 0
    AND ("tipo" NOT IN ('carga', 'devolucion') OR "cantidad" > 0)
    AND ("tipo" <> 'consumo' OR "cantidad" < 0)
),
ADD CONSTRAINT "movimientos_bono_mes_check" CHECK (
    ("servicio" = 'seguimiento' AND "mes" IS NOT NULL
        AND "mes" ~ '^[0-9]{4}-(0[1-9]|1[0-2])$' AND LEFT("mes", 4) <> '0000')
    OR ("servicio" <> 'seguimiento' AND "mes" IS NULL)
),
ADD CONSTRAINT "movimientos_bono_cupo_check" CHECK (
    "servicio" <> 'seguimiento' OR "tipo" <> 'carga' OR "cantidad" = 120
);

-- AddForeignKey
ALTER TABLE "movimientos_bono" ADD CONSTRAINT "movimientos_bono_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos_bono" ADD CONSTRAINT "movimientos_bono_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seguimiento_bonos" ADD CONSTRAINT "seguimiento_bonos_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seguimiento_bonos" ADD CONSTRAINT "seguimiento_bonos_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
