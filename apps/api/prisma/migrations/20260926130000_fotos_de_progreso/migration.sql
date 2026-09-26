-- Fotos de progreso: el cliente sube fotos cuando quiere, sin solicitud ni visita.
-- Antes, origen cliente equivalía a tener solicitud. Ahora solo se exige que una
-- foto con solicitud sea del cliente; las profesionales siguen yendo a una visita.
ALTER TABLE "medios_fotos" DROP CONSTRAINT "medio_foto_origen_coherente";
ALTER TABLE "medios_fotos" ADD CONSTRAINT "medio_foto_origen_coherente" CHECK (
  ("origen" = 'cliente' OR "solicitudId" IS NULL)
  AND ("origen" <> 'profesional' OR "valoracionId" IS NOT NULL)
);
