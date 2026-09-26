import { ErrorDePermiso, ErrorDeRed, ErrorDelServidor, ErrorDeSesion } from "./transporte"

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
    // Genérico a propósito: ahora también hay pantallas del cliente, y un
    // cliente no tiene por qué leer que algo es "solo para el entrenador".
    return {
      texto: "Tu perfil no tiene acceso a esto.",
      reintentable: false,
      sesionCaducada: false,
    }
  }

  if (error instanceof ErrorDeSesion) {
    // El transporte ya renueva solo el token de acceso caducado. Si aun así
    // llega un 401 aquí, es que el servidor tampoco aceptó la renovación: la
    // sesión se revocó o la cuenta se dio de baja. Un "reintentar" no la
    // arreglaría jamás.
    return {
      texto: "Tu sesión ha caducado. Vuelve a entrar.",
      reintentable: false,
      sesionCaducada: true,
    }
  }

  // Los conflictos con código (entrenamiento, agenda, catálogo) traen un texto
  // escrito para enseñarlo, y reintentar lo mismo no los arreglaría. Los errores
  // de identidad no llevan código y siguen usando el texto de cada pantalla.
  if (error instanceof ErrorDelServidor && error.detalle?.codigo !== undefined) {
    return { texto: error.mensaje ?? respaldo, reintentable: false, sesionCaducada: false }
  }

  return { texto: respaldo, reintentable: true, sesionCaducada: false }
}
