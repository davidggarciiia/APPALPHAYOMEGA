-- Ficha de técnica del diseño: pasos, «evita» y consejos. Aditiva: los
-- ejercicios existentes quedan con listas vacías y sin «evita».
ALTER TABLE "ejercicios" ADD COLUMN "pasos" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN "evita" VARCHAR(500),
ADD COLUMN "consejos" JSONB NOT NULL DEFAULT '[]';
