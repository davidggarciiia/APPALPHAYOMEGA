import {
  CambiarValoracionSchema,
  ConsultarEvolucionSchema,
  CrearValoracionSchema,
  EvolucionSchema,
  GuardarPlantillaValoracionSchema,
  GuardarProximaRevisionSchema,
  LeerAvisosSeguimientoSchema,
  ListadoAvisosSeguimientoSchema,
  ListadoValoracionesPublicadasSchema,
  ListadoValoracionesSchema,
  PlantillaValoracionSchema,
  ProximaRevisionSchema,
  PublicacionValoracionSchema,
  PublicarValoracionSchema,
  ValoracionClienteSchema,
  ValoracionProfesionalSchema,
  type CambiarValoracion,
  type ConsultarEvolucion,
  type CrearValoracion,
  type Evolucion,
  type GuardarPlantillaValoracion,
  type GuardarProximaRevision,
  type ListadoAvisosSeguimiento,
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

/**
 * Evolución (cliente, entrenador y nutricionista) y avisos de Inicio (cliente y
 * entrenador). Leer un aviso no revisa nada.
 */
export type ApiEvolucionAvisos = {
  evolucion: (clienteId: string, periodo?: ConsultarEvolucion) => Promise<Evolucion>
  avisos: (clienteId: string) => Promise<ListadoAvisosSeguimiento>
  leerAvisos: (clienteId: string, avisoIds: string[]) => Promise<ListadoAvisosSeguimiento>
}

export function crearApiValoraciones(
  pedir: PeticionAutenticada,
): ApiValoraciones & ApiValoracionesCliente & ApiEvolucionAvisos {
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
    evolucion: (clienteId, periodo = {}) => {
      const { desde, hasta } = ConsultarEvolucionSchema.parse(periodo)
      const consulta = new URLSearchParams({
        ...(desde && { desde }),
        ...(hasta && { hasta }),
      }).toString()
      return pedir(`${base(clienteId)}/evolucion${consulta ? `?${consulta}` : ""}`, EvolucionSchema)
    },
    avisos: (clienteId) => pedir(`${base(clienteId)}/avisos`, ListadoAvisosSeguimientoSchema),
    leerAvisos: (clienteId, avisoIds) =>
      pedir(`${base(clienteId)}/avisos/leidos`, ListadoAvisosSeguimientoSchema, {
        method: "POST",
        body: JSON.stringify(LeerAvisosSeguimientoSchema.parse({ avisoIds })),
      }),
  }
}
