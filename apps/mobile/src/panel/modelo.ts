import {
  ZONA_AGENDA,
  type ActividadDelPanel,
  type EstadoEntrenoDeHoy,
  type MolestiaAbierta,
  type PanelHoy,
  type ZonaDeMolestia,
} from "@alpha-omega/shared"

import { sumarDias } from "../entrenamiento/fechas"

const DIA_DE_AGENDA = new Intl.DateTimeFormat("en-CA", { timeZone: ZONA_AGENDA })
const HORA = new Intl.DateTimeFormat("es-ES", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: ZONA_AGENDA,
})
const DIA_CORTO = new Intl.DateTimeFormat("es-ES", {
  day: "numeric",
  month: "short",
  timeZone: ZONA_AGENDA,
})
const DIA_LARGO = new Intl.DateTimeFormat("es-ES", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: "UTC",
})
const DIA_DE_SEMANA = new Intl.DateTimeFormat("es-ES", {
  weekday: "short",
  day: "numeric",
  timeZone: "UTC",
})

/** «Sábado, 26 de septiembre». La fecha es de la agenda: sin hora ni zona. */
export function fechaLarga(fecha: string): string {
  const texto = DIA_LARGO.format(new Date(`${fecha}T00:00:00Z`))
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}

/** «lun 21 – dom 27», para la cabecera de la semana. */
export function rangoDeSemana(lunes: string, domingo: string): string {
  const corto = (fecha: string): string =>
    DIA_DE_SEMANA.format(new Date(`${fecha}T00:00:00Z`))
      .replace(",", "")
      .replace(".", "")
  return `${corto(lunes)} – ${corto(domingo)}`
}

/**
 * Cuándo pasó algo, como lo diría una persona: «ahora», «hace 12 min», «hoy,
 * 11:02», «ayer, 18:05» o «24 sept». Los días son los de la agenda (Madrid).
 */
export function momento(iso: string, ahora: Date = new Date()): string {
  const cuando = new Date(iso)
  const minutos = Math.floor((ahora.getTime() - cuando.getTime()) / 60000)
  if (minutos < 1) return "ahora"
  if (minutos < 60) return `hace ${minutos} min`
  const dia = DIA_DE_AGENDA.format(cuando)
  const hoy = DIA_DE_AGENDA.format(ahora)
  if (dia === hoy) return `hoy, ${HORA.format(cuando)}`
  if (dia === sumarDias(hoy, -1)) return `ayer, ${HORA.format(cuando)}`
  return DIA_CORTO.format(cuando).replace(".", "")
}

export const ETIQUETA_DE_ESTADO: Record<EstadoEntrenoDeHoy, string> = {
  pendiente: "Pendiente",
  enCurso: "En curso",
  enviada: "Enviada",
}

const NIVEL = { verde: "verde", ambar: "ámbar", rojo: "roja" } as const

/** Con su artículo: «el hombro», «la muñeca», «la zona lumbar». */
const EN_ZONA: Record<ZonaDeMolestia, string> = {
  hombro: "el hombro",
  codo: "el codo",
  muneca: "la muñeca",
  lumbar: "la zona lumbar",
  otra: "otra zona",
}

function enZona(zona: ZonaDeMolestia): string {
  return EN_ZONA[zona]
}

/** «Molestia ámbar en el hombro». El nivel va escrito, no solo en el color. */
export function tituloDeMolestia(molestia: Pick<MolestiaAbierta, "nivel" | "zona">): string {
  return `Molestia ${NIVEL[molestia.nivel]} en ${enZona(molestia.zona)}`
}

/** Lo que espera al entrenador, sin las molestias, que tienen su propia cifra. */
export function totalPorRevisar(datos: PanelHoy): number {
  const { entrenamientos, fotos, comentarios } = datos.porRevisar
  return entrenamientos.total + fotos.total + comentarios.total
}

export function textoDeActividad(evento: ActividadDelPanel): string {
  const quien = evento.cliente.nombre
  switch (evento.tipo) {
    case "envio":
      return `${quien} envió ${evento.sesion}`
    case "molestia":
      return `${quien} avisó de una molestia ${NIVEL[evento.nivel]} en ${enZona(evento.zona)}`
    case "fotos":
      return `${quien} mandó ${evento.fotos === 1 ? "1 foto" : `${evento.fotos} fotos`}`
    case "medida":
      return `${quien} apuntó una medida nueva`
  }
}

/** «1 foto», «3 fotos»: el plural bien dicho en cada lista. */
export function cuenta(cantidad: number, singular: string, plural: string): string {
  return `${cantidad} ${cantidad === 1 ? singular : plural}`
}
