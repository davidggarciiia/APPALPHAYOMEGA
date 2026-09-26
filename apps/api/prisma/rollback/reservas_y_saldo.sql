-- Reversión de 20260926120000_reservas_y_saldo. Solo en una base desechable:
-- borra reservas, saldo, solicitudes y cobros, que son deuda y citas reales.
-- En otro entorno, exporta antes esas tablas.
BEGIN;
DROP TABLE "cobros";
DROP TABLE "solicitudes_producto";
DROP TABLE "movimientos_saldo";
DROP TABLE "bonos";
DROP TABLE "suscripciones";
DROP TABLE "productos";
DROP TABLE "reservas";
DROP TABLE "excepciones_agenda";
DROP TABLE "franjas_semanales";
DROP TABLE "tarifas_grupo";
DROP TABLE "servicios_agenda";
DROP TABLE "ajustes_agenda";
DROP TYPE "OrigenCobro";
DROP TYPE "EstadoCobro";
DROP TYPE "EstadoSolicitudProducto";
DROP TYPE "MotivoMovimiento";
DROP TYPE "OrigenBono";
DROP TYPE "TipoProducto";
DROP TYPE "EstadoReserva";
DROP TYPE "TipoExcepcionAgenda";
DROP TYPE "ClaseSaldo";
DELETE FROM "_prisma_migrations" WHERE "migration_name" = '20260926120000_reservas_y_saldo';
COMMIT;
