-- Revisión profesional explícita y avisos de sesión con lectura por usuario.
ALTER TABLE "sesiones_entrenamiento"
  ADD COLUMN "revisadaEn" TIMESTAMP(3),
  ADD COLUMN "revisadaPorId" TEXT;

ALTER TABLE "sesiones_entrenamiento"
  ADD CONSTRAINT "sesiones_entrenamiento_revisadaPorId_fkey"
  FOREIGN KEY ("revisadaPorId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "novedades_entrenamiento" (
  "id" TEXT NOT NULL,
  "sesionId" TEXT NOT NULL,
  "clienteId" TEXT NOT NULL,
  "tipo" VARCHAR(40) NOT NULL,
  "audiencia" VARCHAR(20) NOT NULL,
  "autorId" TEXT NOT NULL,
  "creadaEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "novedades_entrenamiento_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "novedades_entrenamiento_audiencia_check"
    CHECK ("audiencia" IN ('cliente', 'entrenador')),
  CONSTRAINT "novedades_entrenamiento_tipo_check"
    CHECK ("tipo" IN ('entrenamiento_enviado', 'sesion_revisada', 'comentario', 'molestia', 'molestia_atendida', 'fecha_cambiada'))
);

CREATE INDEX "novedades_entrenamiento_clienteId_audiencia_creadaEn_idx"
  ON "novedades_entrenamiento"("clienteId", "audiencia", "creadaEn");
CREATE INDEX "novedades_entrenamiento_sesionId_creadaEn_idx"
  ON "novedades_entrenamiento"("sesionId", "creadaEn");

ALTER TABLE "novedades_entrenamiento"
  ADD CONSTRAINT "novedades_entrenamiento_sesionId_clienteId_fkey"
  FOREIGN KEY ("sesionId", "clienteId") REFERENCES "sesiones_entrenamiento"("id", "clienteId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "novedades_entrenamiento"
  ADD CONSTRAINT "novedades_entrenamiento_autorId_fkey"
  FOREIGN KEY ("autorId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "lecturas_novedades" (
  "novedadId" TEXT NOT NULL,
  "usuarioId" TEXT NOT NULL,
  "leidaEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "lecturas_novedades_pkey" PRIMARY KEY ("novedadId", "usuarioId")
);

CREATE INDEX "lecturas_novedades_usuarioId_idx" ON "lecturas_novedades"("usuarioId");
ALTER TABLE "lecturas_novedades"
  ADD CONSTRAINT "lecturas_novedades_novedadId_fkey"
  FOREIGN KEY ("novedadId") REFERENCES "novedades_entrenamiento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "lecturas_novedades"
  ADD CONSTRAINT "lecturas_novedades_usuarioId_fkey"
  FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
