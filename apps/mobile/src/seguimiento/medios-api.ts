import {
  AccesoMedioSchema,
  CrearSolicitudFotosSchema,
  IntencionSubidaSchema,
  ListadoFotosSchema,
  ListadoSolicitudesFotosSchema,
  MedioFotoSchema,
  RevisarSolicitudFotosSchema,
  SolicitarSubidaSchema,
  SolicitudFotosSchema,
  VincularFotoSchema,
  type AccesoMedio,
  type CrearSolicitudFotos,
  type IntencionSubida,
  type ListadoFotos,
  type ListadoSolicitudesFotos,
  type MedioFoto,
  type SolicitarSubida,
  type SolicitudFotos,
} from "@alpha-omega/shared"
import type { PeticionAutenticada } from "../lib/peticion-autenticada"

/**
 * Fotos privadas (ADR 0005). Los enlaces de subida y lectura caducan en
 * minutos: se piden cuando hacen falta y nunca se guardan ni se cachean.
 */
export type ApiMedios = {
  solicitarSubida: (datos: SolicitarSubida) => Promise<IntencionSubida>
  confirmar: (medioId: string) => Promise<MedioFoto>
  acceso: (medioId: string) => Promise<AccesoMedio>
  borrar: (medioId: string) => Promise<MedioFoto>
  fotosDeValoracion: (clienteId: string, valoracionId: string) => Promise<ListadoFotos>
  /** Todas las fotos del cliente que puede ver quien pregunta, sin las pendientes. */
  fotosDeCliente: (clienteId: string) => Promise<ListadoFotos>
  vincularFoto: (clienteId: string, valoracionId: string, medioId: string) => Promise<MedioFoto>
  solicitudes: (clienteId: string) => Promise<ListadoSolicitudesFotos>
  pedirFotos: (clienteId: string, datos: CrearSolicitudFotos) => Promise<SolicitudFotos>
  revisarSolicitud: (
    clienteId: string,
    solicitudId: string,
    operacionId: string,
  ) => Promise<SolicitudFotos>
}

export function crearApiMedios(pedir: PeticionAutenticada): ApiMedios {
  const medio = (id: string): string => `/medios/${encodeURIComponent(id)}`
  const cliente = (id: string): string => `/seguimiento/clientes/${encodeURIComponent(id)}`
  return {
    solicitarSubida: (datos) =>
      pedir("/medios/subidas", IntencionSubidaSchema, {
        method: "POST",
        body: JSON.stringify(SolicitarSubidaSchema.parse(datos)),
      }),
    confirmar: (medioId) =>
      pedir(`${medio(medioId)}/confirmacion`, MedioFotoSchema, { method: "POST" }),
    acceso: (medioId) => pedir(`${medio(medioId)}/acceso`, AccesoMedioSchema),
    borrar: (medioId) => pedir(medio(medioId), MedioFotoSchema, { method: "DELETE" }),
    fotosDeCliente: (clienteId) => pedir(`${cliente(clienteId)}/fotos`, ListadoFotosSchema),
    fotosDeValoracion: (clienteId, valoracionId) =>
      pedir(
        `${cliente(clienteId)}/valoraciones/${encodeURIComponent(valoracionId)}/fotos`,
        ListadoFotosSchema,
      ),
    vincularFoto: (clienteId, valoracionId, medioId) =>
      pedir(
        `${cliente(clienteId)}/valoraciones/${encodeURIComponent(valoracionId)}/fotos`,
        MedioFotoSchema,
        { method: "POST", body: JSON.stringify(VincularFotoSchema.parse({ medioId })) },
      ),
    solicitudes: (clienteId) =>
      pedir(`${cliente(clienteId)}/solicitudes-fotos`, ListadoSolicitudesFotosSchema),
    pedirFotos: (clienteId, datos) =>
      pedir(`${cliente(clienteId)}/solicitudes-fotos`, SolicitudFotosSchema, {
        method: "POST",
        body: JSON.stringify(CrearSolicitudFotosSchema.parse(datos)),
      }),
    revisarSolicitud: (clienteId, solicitudId, operacionId) =>
      pedir(
        `${cliente(clienteId)}/solicitudes-fotos/${encodeURIComponent(solicitudId)}/revision`,
        SolicitudFotosSchema,
        {
          method: "POST",
          body: JSON.stringify(RevisarSolicitudFotosSchema.parse({ operacionId })),
        },
      ),
  }
}
