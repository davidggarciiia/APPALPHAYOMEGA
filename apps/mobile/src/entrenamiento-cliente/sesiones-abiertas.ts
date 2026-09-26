import { randomUUID } from "expo-crypto"

import * as almacen from "./almacen-borradores"
import * as api from "./api"
import { SesionEnCurso, type Dependencias } from "./sesion-en-curso"

/*
 * Las sesiones de entreno abiertas en esta ejecución de la app.
 *
 * Vive aparte del hook para que el proveedor de sesión pueda cerrarlas al salir
 * sin depender de React ni crear una importación circular.
 */

const dependencias: Dependencias = {
  api,
  almacen,
  nuevoId: () => randomUUID(),
  ahora: () => new Date(),
  programar: (tarea, milisegundos) => {
    const reloj = setTimeout(tarea, milisegundos)
    return () => clearTimeout(reloj)
  },
}

/**
 * Una sola instancia por cuenta y sesión: la pantalla de la semana y la del
 * entreno comparten la misma cola de guardado.
 */
const abiertas = new Map<string, Promise<SesionEnCurso>>()

export function abrirSesionEnCurso(cuenta: string, sesionId: string): Promise<SesionEnCurso> {
  const clave = `${cuenta}:${sesionId}`
  let abierta = abiertas.get(clave)
  if (abierta === undefined) {
    abierta = SesionEnCurso.abrir(cuenta, sesionId, dependencias)
    abiertas.set(clave, abierta)
    abierta.catch(() => abiertas.delete(clave))
  }
  return abierta
}

/** Al salir de la cuenta: nada abierto sigue guardando ni sincronizando. */
export function cerrarSesionesEnCurso(): void {
  for (const abierta of abiertas.values()) {
    void abierta.then((sesion) => sesion.cerrar()).catch(() => undefined)
  }
  abiertas.clear()
}
