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

/** El contrato ofrece avisos por cliente; se recorre la cartera sin saturar la conexión. */
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
    for (;;) {
      if (signal?.aborted) throw new Error("Consulta cancelada")
      const pagina = await listarUsuarios(pedir, {
        rol: "cliente",
        limite: 100,
        desde: clientes.length,
      })
      clientes.push(...pagina.usuarios)
      if (clientes.length >= pagina.total) break
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
