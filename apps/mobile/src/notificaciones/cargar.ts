import type {
  ListadoAvisosSeguimiento,
  ListadoNovedades,
  UsuarioPublico,
} from "@alpha-omega/shared"
import type { ApiEntrenamiento } from "../entrenamiento/api"
import { listarUsuarios } from "../lib/api"
import type { PeticionAutenticada } from "../lib/peticion-autenticada"
import type { ApiEvolucionAvisos } from "../seguimiento/valoraciones-api"

export type BuzonCliente = {
  id: string
  nombre: string
  entrenamiento: ListadoNovedades
  seguimiento: ListadoAvisosSeguimiento
}

export function contadoresEntrenamiento(listado: ListadoNovedades): {
  total: number
  sinLeer: number
} {
  const revisiones = listado.novedades.filter((novedad) => novedad.tipo === "sesion_revisada")
  return {
    total: Math.max(0, listado.total - revisiones.length),
    sinLeer: Math.max(0, listado.sinLeer - revisiones.filter((novedad) => !novedad.leidaEn).length),
  }
}

/**
 * El contrato ofrece avisos por cliente; se recorre la cartera sin saturar la conexión.
 * Los clientes dados de baja se saltan: no generan avisos y cada uno costaría dos peticiones.
 */
export async function cargarNotificaciones(
  usuario: UsuarioPublico,
  pedir: PeticionAutenticada,
  api: Pick<ApiEntrenamiento, "novedades">,
  seguimiento: Pick<ApiEvolucionAvisos, "avisos">,
  signal?: AbortSignal,
): Promise<BuzonCliente[]> {
  const clientes: { id: string; nombre: string; apellidos: string | null }[] = []
  if (usuario.rol === "cliente") clientes.push(usuario)
  else if (usuario.rol === "entrenador") {
    let recibidos = 0
    for (;;) {
      if (signal?.aborted) throw new Error("Consulta cancelada")
      const pagina = await listarUsuarios(pedir, {
        rol: "cliente",
        limite: 100,
        desde: recibidos,
      })
      // El avance se mide con lo recibido de la API, no con lo que queda tras filtrar.
      recibidos += pagina.usuarios.length
      clientes.push(...pagina.usuarios.filter((cliente) => cliente.estado !== "desactivado"))
      if (recibidos >= pagina.total) break
      if (pagina.usuarios.length === 0) throw new Error("Cartera incompleta")
    }
  }
  const buzones: BuzonCliente[] = []
  for (let inicio = 0; inicio < clientes.length; inicio += 4) {
    if (signal?.aborted) throw new Error("Consulta cancelada")
    buzones.push(
      ...(await Promise.all(
        clientes.slice(inicio, inicio + 4).map(async (cliente) => {
          const [entrenamiento, avisos] = await Promise.all([
            api.novedades(cliente.id, 0),
            seguimiento.avisos(cliente.id),
          ])
          return {
            id: cliente.id,
            nombre: [cliente.nombre, cliente.apellidos].filter(Boolean).join(" "),
            entrenamiento,
            seguimiento: avisos,
          }
        }),
      )),
    )
  }
  return buzones
}
