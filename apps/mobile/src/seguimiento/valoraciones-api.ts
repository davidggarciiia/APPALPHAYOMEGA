import {
  CambiarValoracionSchema,
  CrearValoracionSchema,
  GuardarPlantillaValoracionSchema,
  ListadoValoracionesSchema,
  PlantillaValoracionSchema,
  ValoracionProfesionalSchema,
  type CambiarValoracion,
  type CrearValoracion,
  type GuardarPlantillaValoracion,
  type ListadoValoraciones,
  type PlantillaValoracion,
  type ValoracionProfesional,
} from "@alpha-omega/shared"
import type { PeticionAutenticada } from "../lib/peticion-autenticada"

/** Rutas de valoración del panel profesional. El cliente usa otra proyección. */
export type ApiValoraciones = {
  plantilla: (clienteId: string) => Promise<PlantillaValoracion>
  guardarPlantilla: (
    clienteId: string,
    datos: GuardarPlantillaValoracion,
  ) => Promise<PlantillaValoracion>
  listar: (
    clienteId: string,
    limite?: number,
    desplazamiento?: number,
  ) => Promise<ListadoValoraciones>
  leer: (clienteId: string, id: string) => Promise<ValoracionProfesional>
  crear: (clienteId: string, datos: CrearValoracion) => Promise<ValoracionProfesional>
  cambiar: (
    clienteId: string,
    id: string,
    datos: CambiarValoracion,
  ) => Promise<ValoracionProfesional>
}

export function crearApiValoraciones(pedir: PeticionAutenticada): ApiValoraciones {
  const base = (clienteId: string): string =>
    `/seguimiento/clientes/${encodeURIComponent(clienteId)}`
  return {
    plantilla: (clienteId) =>
      pedir(`${base(clienteId)}/plantilla-valoracion`, PlantillaValoracionSchema),
    guardarPlantilla: (clienteId, datos) =>
      pedir(`${base(clienteId)}/plantilla-valoracion`, PlantillaValoracionSchema, {
        method: "PUT",
        body: JSON.stringify(GuardarPlantillaValoracionSchema.parse(datos)),
      }),
    listar: (clienteId, limite = 20, desplazamiento = 0) =>
      pedir(
        `${base(clienteId)}/valoraciones?limite=${limite}&desplazamiento=${desplazamiento}`,
        ListadoValoracionesSchema,
      ),
    leer: (clienteId, id) =>
      pedir(
        `${base(clienteId)}/valoraciones/${encodeURIComponent(id)}`,
        ValoracionProfesionalSchema,
      ),
    crear: (clienteId, datos) =>
      pedir(`${base(clienteId)}/valoraciones`, ValoracionProfesionalSchema, {
        method: "POST",
        body: JSON.stringify(CrearValoracionSchema.parse(datos)),
      }),
    cambiar: (clienteId, id, datos) =>
      pedir(
        `${base(clienteId)}/valoraciones/${encodeURIComponent(id)}`,
        ValoracionProfesionalSchema,
        { method: "PUT", body: JSON.stringify(CambiarValoracionSchema.parse(datos)) },
      ),
  }
}
