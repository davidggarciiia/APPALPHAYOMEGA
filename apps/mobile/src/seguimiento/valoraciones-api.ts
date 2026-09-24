import {
  CambiarValoracionSchema,
  CrearValoracionSchema,
  GuardarPlantillaValoracionSchema,
  GuardarProximaRevisionSchema,
  ListadoValoracionesPublicadasSchema,
  ListadoValoracionesSchema,
  PlantillaValoracionSchema,
  ProximaRevisionSchema,
  PublicacionValoracionSchema,
  PublicarValoracionSchema,
  ValoracionClienteSchema,
  ValoracionProfesionalSchema,
  type CambiarValoracion,
  type CrearValoracion,
  type GuardarPlantillaValoracion,
  type GuardarProximaRevision,
  type ListadoValoraciones,
  type ListadoValoracionesPublicadas,
  type PlantillaValoracion,
  type ProximaRevision,
  type PublicacionValoracion,
  type PublicarValoracion,
  type ValoracionCliente,
  type ValoracionProfesional,
} from "@alpha-omega/shared"
import type { PeticionAutenticada } from "../lib/peticion-autenticada"

/** Rutas de valoración del panel profesional. */
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
  publicar: (
    clienteId: string,
    id: string,
    datos: PublicarValoracion,
  ) => Promise<PublicacionValoracion>
  proximaRevision: (clienteId: string) => Promise<ProximaRevision>
  guardarProximaRevision: (
    clienteId: string,
    datos: GuardarProximaRevision,
  ) => Promise<ProximaRevision>
}

/** Lo que consulta el cliente: solo publicaciones y la próxima revisión. */
export type ApiValoracionesCliente = {
  listarPublicadas: (
    clienteId: string,
    limite?: number,
    desplazamiento?: number,
  ) => Promise<ListadoValoracionesPublicadas>
  leerPublicada: (clienteId: string, id: string) => Promise<ValoracionCliente>
  proximaRevision: (clienteId: string) => Promise<ProximaRevision>
}

export function crearApiValoraciones(
  pedir: PeticionAutenticada,
): ApiValoraciones & ApiValoracionesCliente {
  const base = (clienteId: string): string =>
    `/seguimiento/clientes/${encodeURIComponent(clienteId)}`
  const visita = (clienteId: string, id: string): string =>
    `${base(clienteId)}/valoraciones/${encodeURIComponent(id)}`
  const pagina = (limite: number, desplazamiento: number): string =>
    `?limite=${limite}&desplazamiento=${desplazamiento}`
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
        `${base(clienteId)}/valoraciones${pagina(limite, desplazamiento)}`,
        ListadoValoracionesSchema,
      ),
    leer: (clienteId, id) => pedir(visita(clienteId, id), ValoracionProfesionalSchema),
    crear: (clienteId, datos) =>
      pedir(`${base(clienteId)}/valoraciones`, ValoracionProfesionalSchema, {
        method: "POST",
        body: JSON.stringify(CrearValoracionSchema.parse(datos)),
      }),
    cambiar: (clienteId, id, datos) =>
      pedir(visita(clienteId, id), ValoracionProfesionalSchema, {
        method: "PUT",
        body: JSON.stringify(CambiarValoracionSchema.parse(datos)),
      }),
    publicar: (clienteId, id, datos) =>
      pedir(`${visita(clienteId, id)}/publicaciones`, PublicacionValoracionSchema, {
        method: "POST",
        body: JSON.stringify(PublicarValoracionSchema.parse(datos)),
      }),
    proximaRevision: (clienteId) =>
      pedir(`${base(clienteId)}/proxima-revision`, ProximaRevisionSchema),
    guardarProximaRevision: (clienteId, datos) =>
      pedir(`${base(clienteId)}/proxima-revision`, ProximaRevisionSchema, {
        method: "PUT",
        body: JSON.stringify(GuardarProximaRevisionSchema.parse(datos)),
      }),
    listarPublicadas: (clienteId, limite = 20, desplazamiento = 0) =>
      pedir(
        `${base(clienteId)}/valoraciones${pagina(limite, desplazamiento)}`,
        ListadoValoracionesPublicadasSchema,
      ),
    leerPublicada: (clienteId, id) => pedir(visita(clienteId, id), ValoracionClienteSchema),
  }
}
