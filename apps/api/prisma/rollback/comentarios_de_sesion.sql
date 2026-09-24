-- Reversión de 20260924080000_comentarios_de_sesion. Borra los comentarios.
BEGIN;
DROP TABLE "comentarios_sesion";
COMMIT;
