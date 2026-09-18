import { useMemo } from "react"
import {
  EditarRutinaSchema,
  GuardarRutinaSchema,
  RutinaGuardadaSchema,
  ListadoRutinasSchema,
  type EditarRutina,
  type GuardarRutina,
  type RutinaGuardada,
  type ListadoRutinas,
} from "@alpha-omega/shared"
import type { PeticionAutenticada } from "../lib/peticion-autenticada"
import { useSesion } from "../sesion"

export type ApiRutinas = {
  listar: (buscar: string, desplazamiento: number) => Promise<ListadoRutinas>
  leer: (id: string) => Promise<RutinaGuardada>
  crear: (datos: GuardarRutina) => Promise<RutinaGuardada>
  editar: (id: string, datos: EditarRutina) => Promise<RutinaGuardada>
}
export function crearApiRutinas(pedir: PeticionAutenticada): ApiRutinas {
  return {
    listar: (buscar, desplazamiento) =>
      pedir(
        `/entrenamiento/rutinas?buscar=${encodeURIComponent(buscar)}&limite=10&desplazamiento=${desplazamiento}`,
        ListadoRutinasSchema,
      ),
    leer: (id) => pedir(`/entrenamiento/rutinas/${encodeURIComponent(id)}`, RutinaGuardadaSchema),
    crear: (datos) =>
      pedir("/entrenamiento/rutinas", RutinaGuardadaSchema, {
        method: "POST",
        body: JSON.stringify(GuardarRutinaSchema.parse(datos)),
      }),
    editar: (id, datos) =>
      pedir(`/entrenamiento/rutinas/${encodeURIComponent(id)}`, RutinaGuardadaSchema, {
        method: "PATCH",
        body: JSON.stringify(EditarRutinaSchema.parse(datos)),
      }),
  }
}
export function useRutinas(): ApiRutinas {
  const { pedir } = useSesion()
  return useMemo(() => crearApiRutinas(pedir), [pedir])
}
