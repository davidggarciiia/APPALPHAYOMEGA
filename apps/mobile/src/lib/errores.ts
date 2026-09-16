import { ErrorDePermiso, ErrorDeRed, ErrorDeSesion } from "./api"

/**
 * Lo que la pantalla enseña cuando algo falla.
 *
 * `reintentable` decide si se ofrece un botón de reintentar. Ofrecerlo siempre
 * es peor que no ofrecerlo: quien no tiene permiso puede insistir toda la tarde
 * contra una puerta cerrada creyendo que es un problema de cobertura.
 */
export type Falta = {
  texto: string
  reintentable: boolean
  /** La sesión ya no vale. La salida no es reintentar, es volver a entrar. */
  sesionCaducada: boolean
}

/**
 * Traduce un fallo de la API a algo que una persona pueda leer.
 *
 * Vive aquí y no dentro de cada pantalla para que las tres digan lo mismo ante
 * el mismo fallo. `respaldo` es lo único que cambia entre unas y otras: qué es
 * lo que no se ha podido hacer.
 */
export function faltaDe(error: unknown, respaldo: string): Falta {
  if (error instanceof ErrorDeRed) {
    return {
      texto: "No hemos podido conectar. Revisa tu conexión.",
      reintentable: true,
      sesionCaducada: false,
    }
  }

  if (error instanceof ErrorDePermiso) {
    return {
      texto: "Esta pantalla es solo para el entrenador.",
      reintentable: false,
      sesionCaducada: false,
    }
  }

  if (error instanceof ErrorDeSesion) {
    // El token de acceso dura quince minutos y hoy no se renueva solo mientras
    // la app está abierta. Una pantalla abierta más de ese rato se encuentra
    // esto, y un "reintentar" no la arreglaría jamás.
    return {
      texto: "Tu sesión ha caducado. Vuelve a entrar.",
      reintentable: false,
      sesionCaducada: true,
    }
  }

  return { texto: respaldo, reintentable: true, sesionCaducada: false }
}
