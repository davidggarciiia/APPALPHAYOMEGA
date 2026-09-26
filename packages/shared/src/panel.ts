import { z } from "zod"

import { FechaAgendaSchema } from "./agenda"
import { ZonaDeMolestiaSchema } from "./molestias"

/**
 * Panel «Hoy» del entrenador (`GET /panel/hoy`): lo que pasa hoy en su cartera,
 * lo que espera su revisión y cómo va la semana, en una sola respuesta.
 *
 * Cada elemento lleva los identificadores que la app necesita para abrir su
 * destino: la sesión (`sesionId`), la ficha del cliente (`cliente.id`) o la
 * solicitud de fotos (`solicitudId`). Las listas van recortadas; los totales,
 * no: la pantalla dice «y 12 más» en lugar de cortar en silencio.
 *
 * Los clientes dados de baja no aparecen en ninguna lista ni cifra, salvo en
 * `clientes.bajas`.
 */

/** Cuántos elementos de cada lista de «Por revisar» viajan como mucho. */
export const MAXIMO_POR_REVISAR = 20
/** Cuántas sesiones de hoy viajan como mucho; el total va aparte. */
export const MAXIMO_HOY = 100
export const MAXIMO_ACTIVIDAD = 10
export const MAXIMO_MENOR_ADHERENCIA = 5

const CantidadSchema = z.number().int().nonnegative()
const PorcentajeSchema = z.number().int().min(0).max(100)
const NombreDeSesionSchema = z.string().min(1)

/** Nombre y apellidos juntos, como en la cartera. */
export const ClienteDelPanelSchema = z.strictObject({
  id: z.uuid(),
  nombre: z.string().min(1),
})
export type ClienteDelPanel = z.infer<typeof ClienteDelPanelSchema>

/** «En curso»: el cliente ya guardó algo de la sesión y todavía no la ha enviado. */
export const EstadoEntrenoDeHoySchema = z.enum(["pendiente", "enCurso", "enviada"])
export type EstadoEntrenoDeHoy = z.infer<typeof EstadoEntrenoDeHoySchema>

export const EntrenoDeHoySchema = z.strictObject({
  sesionId: z.uuid(),
  cliente: ClienteDelPanelSchema,
  sesion: NombreDeSesionSchema,
  estado: EstadoEntrenoDeHoySchema,
  enviadoEn: z.iso.datetime().nullable(),
})
export type EntrenoDeHoy = z.infer<typeof EntrenoDeHoySchema>

/** Sesión enviada que el entrenador aún no ha marcado como revisada. */
export const EnvioPorRevisarSchema = z.strictObject({
  sesionId: z.uuid(),
  cliente: ClienteDelPanelSchema,
  sesion: NombreDeSesionSchema,
  /** Día de la agenda en que tocaba. */
  fecha: FechaAgendaSchema,
  enviadoEn: z.iso.datetime(),
  /** Esfuerzo global del cierre (0 a 10), si el cliente lo apuntó. */
  esfuerzo: z.number().int().min(0).max(10).nullable(),
})
export type EnvioPorRevisar = z.infer<typeof EnvioPorRevisarSchema>

export const NivelDeMolestiaSchema = z.enum(["verde", "ambar", "rojo"])

export const MolestiaAbiertaSchema = z.strictObject({
  id: z.uuid(),
  sesionId: z.uuid(),
  cliente: ClienteDelPanelSchema,
  zona: ZonaDeMolestiaSchema,
  intensidad: z.number().int().min(0).max(10),
  nivel: NivelDeMolestiaSchema,
  /** Nombre del ejercicio en el que apareció, si fue en uno. */
  ejercicio: z.string().nullable(),
  creadaEn: z.iso.datetime(),
})
export type MolestiaAbierta = z.infer<typeof MolestiaAbiertaSchema>

/** Solicitud de fotos con fotos recibidas y sin revisar. */
export const FotosRecibidasSchema = z.strictObject({
  solicitudId: z.uuid(),
  cliente: ClienteDelPanelSchema,
  fotos: CantidadSchema,
  recibidaEn: z.iso.datetime(),
})
export type FotosRecibidas = z.infer<typeof FotosRecibidasSchema>

/** Comentario del cliente sobre una sesión que ESTE entrenador no ha leído. */
export const ComentarioSinLeerSchema = z.strictObject({
  novedadId: z.uuid(),
  sesionId: z.uuid(),
  cliente: ClienteDelPanelSchema,
  sesion: NombreDeSesionSchema,
  creadaEn: z.iso.datetime(),
})
export type ComentarioSinLeer = z.infer<typeof ComentarioSinLeerSchema>

function listaRecortada<T extends z.ZodType>(elemento: T) {
  return z.strictObject({
    total: CantidadSchema,
    elementos: z.array(elemento).max(MAXIMO_POR_REVISAR),
  })
}

export const AdherenciaDeClienteSchema = z.strictObject({
  cliente: ClienteDelPanelSchema,
  programadas: CantidadSchema,
  enviadas: CantidadSchema,
  adherencia: PorcentajeSchema,
})
export type AdherenciaDeCliente = z.infer<typeof AdherenciaDeClienteSchema>

const CamposDeActividad = {
  /** El de su origen: sesión, molestia, solicitud o medida. */
  id: z.uuid(),
  cliente: ClienteDelPanelSchema,
  fecha: z.iso.datetime(),
}

/**
 * Lo último que han hecho los clientes. Una medida no lleva sus valores: el
 * panel dice que hay una nueva y la ficha la enseña.
 */
export const ActividadDelPanelSchema = z.discriminatedUnion("tipo", [
  z.strictObject({
    tipo: z.literal("envio"),
    ...CamposDeActividad,
    sesionId: z.uuid(),
    sesion: NombreDeSesionSchema,
  }),
  z.strictObject({
    tipo: z.literal("molestia"),
    ...CamposDeActividad,
    sesionId: z.uuid(),
    zona: ZonaDeMolestiaSchema,
    nivel: NivelDeMolestiaSchema,
  }),
  z.strictObject({
    tipo: z.literal("fotos"),
    ...CamposDeActividad,
    fotos: CantidadSchema,
  }),
  z.strictObject({ tipo: z.literal("medida"), ...CamposDeActividad }),
])
export type ActividadDelPanel = z.infer<typeof ActividadDelPanelSchema>

export const PanelHoySchema = z.strictObject({
  /** Hoy en la zona de la agenda (Europe/Madrid). */
  fecha: FechaAgendaSchema,
  clientes: z.strictObject({
    activos: CantidadSchema,
    /** Dados de alta que todavía no han activado su cuenta. */
    pendientes: CantidadSchema,
    bajas: CantidadSchema,
    total: CantidadSchema,
    /** Activos o pendientes sin consentimiento de salud vigente. */
    sinConsentimiento: CantidadSchema,
  }),
  hoy: z.strictObject({
    total: CantidadSchema,
    enviadas: CantidadSchema,
    enCurso: CantidadSchema,
    sesiones: z.array(EntrenoDeHoySchema).max(MAXIMO_HOY),
  }),
  porRevisar: z.strictObject({
    entrenamientos: listaRecortada(EnvioPorRevisarSchema),
    molestias: listaRecortada(MolestiaAbiertaSchema),
    fotos: listaRecortada(FotosRecibidasSchema),
    comentarios: listaRecortada(ComentarioSinLeerSchema),
  }),
  /**
   * De lunes a hoy: lo que ya tocaba. Una sesión de hoy sin enviar cuenta como
   * programada y no enviada hasta que llegue. `restantes` son las de mañana al
   * domingo, que todavía no cuentan.
   */
  semana: z.strictObject({
    lunes: FechaAgendaSchema,
    domingo: FechaAgendaSchema,
    programadas: CantidadSchema,
    enviadas: CantidadSchema,
    /** `null` si no había nada programado hasta hoy. */
    adherencia: PorcentajeSchema.nullable(),
    restantes: CantidadSchema,
    /** Por debajo del 100 %, de menos a más. */
    menorAdherencia: z.array(AdherenciaDeClienteSchema).max(MAXIMO_MENOR_ADHERENCIA),
  }),
  actividad: z.array(ActividadDelPanelSchema).max(MAXIMO_ACTIVIDAD),
})
export type PanelHoy = z.infer<typeof PanelHoySchema>
