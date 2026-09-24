-- Seguimiento del diseño: registro diario, medidas corporales y pruebas físicas.
-- Aditiva: tablas nuevas; los rangos se comprueban también en la base.
-- CreateTable
CREATE TABLE "dias_seguimiento" (
    "clienteId" TEXT NOT NULL,
    "fecha" DATE NOT NULL,
    "pesoKg" DECIMAL(4,1),
    "pasos" INTEGER,
    "suenoMin" INTEGER,
    "creatina" BOOLEAN,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dias_seguimiento_pkey" PRIMARY KEY ("clienteId","fecha")
);

-- CreateTable
CREATE TABLE "medidas_corporales" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "autorId" TEXT NOT NULL,
    "operacionId" TEXT NOT NULL,
    "fecha" DATE NOT NULL,
    "pesoKg" DECIMAL(4,1),
    "cinturaCm" DECIMAL(4,1),
    "grasaPct" DECIMAL(3,1),
    "alturaCm" INTEGER,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "medidas_corporales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pruebas_fisicas" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "autorId" TEXT NOT NULL,
    "operacionId" TEXT NOT NULL,
    "fecha" DATE NOT NULL,
    "nombre" VARCHAR(60) NOT NULL,
    "valor" DECIMAL(8,2) NOT NULL,
    "unidad" VARCHAR(12) NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pruebas_fisicas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "medidas_corporales_clienteId_fecha_idx" ON "medidas_corporales"("clienteId", "fecha");

-- CreateIndex
CREATE UNIQUE INDEX "medidas_corporales_autorId_operacionId_key" ON "medidas_corporales"("autorId", "operacionId");

-- CreateIndex
CREATE INDEX "pruebas_fisicas_clienteId_nombre_fecha_idx" ON "pruebas_fisicas"("clienteId", "nombre", "fecha");

-- CreateIndex
CREATE UNIQUE INDEX "pruebas_fisicas_autorId_operacionId_key" ON "pruebas_fisicas"("autorId", "operacionId");

-- AddForeignKey
ALTER TABLE "dias_seguimiento" ADD CONSTRAINT "dias_seguimiento_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medidas_corporales" ADD CONSTRAINT "medidas_corporales_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medidas_corporales" ADD CONSTRAINT "medidas_corporales_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pruebas_fisicas" ADD CONSTRAINT "pruebas_fisicas_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pruebas_fisicas" ADD CONSTRAINT "pruebas_fisicas_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Rangos coherentes con los contratos.
ALTER TABLE "dias_seguimiento"
  ADD CONSTRAINT "dia_peso_valido" CHECK ("pesoKg" IS NULL OR "pesoKg" BETWEEN 30 AND 400),
  ADD CONSTRAINT "dia_pasos_validos" CHECK ("pasos" IS NULL OR "pasos" BETWEEN 0 AND 100000),
  ADD CONSTRAINT "dia_sueno_valido" CHECK ("suenoMin" IS NULL OR "suenoMin" BETWEEN 0 AND 1440);
ALTER TABLE "medidas_corporales"
  ADD CONSTRAINT "medida_peso_valido" CHECK ("pesoKg" IS NULL OR "pesoKg" BETWEEN 30 AND 400),
  ADD CONSTRAINT "medida_cintura_valida" CHECK ("cinturaCm" IS NULL OR "cinturaCm" BETWEEN 30 AND 300),
  ADD CONSTRAINT "medida_grasa_valida" CHECK ("grasaPct" IS NULL OR "grasaPct" BETWEEN 2 AND 70),
  ADD CONSTRAINT "medida_altura_valida" CHECK ("alturaCm" IS NULL OR "alturaCm" BETWEEN 100 AND 250),
  ADD CONSTRAINT "medida_con_valor" CHECK (
    "pesoKg" IS NOT NULL OR "cinturaCm" IS NOT NULL OR "grasaPct" IS NOT NULL OR "alturaCm" IS NOT NULL
  );
ALTER TABLE "pruebas_fisicas"
  ADD CONSTRAINT "prueba_valor_valido" CHECK ("valor" >= 0);
