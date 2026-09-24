-- Ficha del cliente del diseño: comentarios sobre una sesión enviada o un ejercicio.
-- Aditiva: tabla nueva.
-- CreateTable
CREATE TABLE "comentarios_sesion" (
    "id" TEXT NOT NULL,
    "sesionId" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "autorId" TEXT NOT NULL,
    "operacionId" TEXT NOT NULL,
    "ejercicioPrescritoId" TEXT,
    "ejercicio" VARCHAR(120),
    "texto" VARCHAR(2000) NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "comentarios_sesion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "comentarios_sesion_sesionId_creadoEn_idx" ON "comentarios_sesion"("sesionId", "creadoEn");

-- CreateIndex
CREATE UNIQUE INDEX "comentarios_sesion_autorId_operacionId_key" ON "comentarios_sesion"("autorId", "operacionId");

-- AddForeignKey
ALTER TABLE "comentarios_sesion" ADD CONSTRAINT "comentarios_sesion_sesionId_clienteId_fkey" FOREIGN KEY ("sesionId", "clienteId") REFERENCES "sesiones_entrenamiento"("id", "clienteId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comentarios_sesion" ADD CONSTRAINT "comentarios_sesion_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comentarios_sesion" ADD CONSTRAINT "comentarios_sesion_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Un comentario nunca está vacío.

ALTER TABLE "comentarios_sesion" ADD CONSTRAINT "comentario_con_texto" CHECK (length(trim("texto")) > 0);
