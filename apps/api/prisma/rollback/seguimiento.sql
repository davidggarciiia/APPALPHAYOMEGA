-- Reversión de 20260924060000_seguimiento. Borra registros diarios, medidas y pruebas.
BEGIN;
DROP TABLE "pruebas_fisicas";
DROP TABLE "medidas_corporales";
DROP TABLE "dias_seguimiento";
COMMIT;
