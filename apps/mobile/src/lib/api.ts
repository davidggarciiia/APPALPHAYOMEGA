import { EstadoSaludSchema, type EstadoSalud } from "@alpha-omega/shared"

/**
 * Cliente HTTP contra la API.
 *
 * La direccion no esta escrita en el codigo: sale de una variable de entorno,
 * porque cambia segun desde donde se pruebe. En un emulador de Android es una
 * direccion, en un movil fisico es la IP del ordenador en la wifi, y en
 * produccion sera el dominio.
 */
function urlBase(): string {
  const configurada = process.env.EXPO_PUBLIC_API_URL

  if (configurada === undefined || configurada === "") {
    throw new Error("Falta EXPO_PUBLIC_API_URL. Copia apps/mobile/.env.example a apps/mobile/.env.")
  }

  return configurada.replace(/\/+$/, "")
}

/**
 * Toda respuesta se valida antes de usarse. Lo que llega por la red es dato de
 * fuera, y el tipo de TypeScript no comprueba nada en tiempo de ejecucion: sin
 * esta validacion, un cambio en el servidor se manifestaria como un fallo
 * incomprensible dentro de un componente.
 */
export async function consultarSalud(): Promise<EstadoSalud> {
  const respuesta = await fetch(`${urlBase()}/salud`)

  if (!respuesta.ok) {
    throw new Error(`El servidor respondio ${String(respuesta.status)}`)
  }

  return EstadoSaludSchema.parse(await respuesta.json())
}
