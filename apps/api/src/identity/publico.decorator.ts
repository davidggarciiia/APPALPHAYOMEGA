import { SetMetadata, type CustomDecorator } from "@nestjs/common"

export const CLAVE_PUBLICO = "ruta_publica"

/**
 * Marca una ruta como accesible sin sesion.
 *
 * El sentido de la regla esta invertido a proposito. No existe un decorador para
 * proteger: todo esta protegido por defecto y hay que pedir explicitamente lo
 * contrario. Asi, olvidarse de escribir algo deja la ruta cerrada, que es el
 * fallo barato. Con la regla al reves, olvidarse abriria la puerta.
 *
 * Cada uso de este decorador es una decision consciente que se ve en el diff.
 */
export const Publico = (): CustomDecorator<string> => SetMetadata(CLAVE_PUBLICO, true)
