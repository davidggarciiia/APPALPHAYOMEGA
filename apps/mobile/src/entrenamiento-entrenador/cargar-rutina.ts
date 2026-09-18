import type { PatronRutina } from "@alpha-omega/shared"
import type { ApiDeCatalogo } from "../catalogo-ejercicios/api"
import { desdeSesion, type SesionEditable } from "./editor-modelo"

export async function cargarRutina(
  patron: PatronRutina,
  catalogo: ApiDeCatalogo,
): Promise<{ sesiones: SesionEditable[]; retirados: string[] }> {
  const ids = [...new Set(patron.sesiones.flatMap((s) => s.ejercicios.map((e) => e.ejercicioId)))]
  const ejercicios = []
  // Grupos pequeños evitan lanzar cientos de peticiones de catálogo simultáneas.
  for (let n = 0; n < ids.length; n += 10)
    ejercicios.push(...(await Promise.all(ids.slice(n, n + 10).map((id) => catalogo.leer(id)))))
  const nombres = Object.fromEntries(ejercicios.map((e) => [e.id, e.nombre]))
  return {
    sesiones: patron.sesiones.map((s) => desdeSesion(s, nombres)),
    retirados: ejercicios.filter((e) => e.estado === "retirado").map((e) => e.nombre),
  }
}
