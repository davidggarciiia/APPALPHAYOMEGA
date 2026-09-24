DROP TABLE "lecturas_novedades";
DROP TABLE "novedades_entrenamiento";
ALTER TABLE "sesiones_entrenamiento"
  DROP COLUMN "revisadaEn",
  DROP COLUMN "revisadaPorId";
