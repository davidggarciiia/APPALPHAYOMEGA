import { z } from "zod"
import { FechaAgendaSchema } from "./agenda"

/**
 * Fotografías privadas de evolución (ADR 0005). Son datos de salud: nunca hay
 * una dirección pública. La app sube directamente al almacén con un enlace
 * temporal que da la API tras comprobar permisos; el servidor verifica el
 * objeto antes de darlo por disponible y solo entrega lecturas temporales.
 *
 * La clave del objeto en el almacén y los enlaces firmados no forman parte de
 * ninguna respuesta que identifique la foto: la identidad es `id`.
 */

export const FORMATOS_FOTO = ["image/jpeg", "image/png", "image/webp"] as const
export const FormatoFotoSchema = z.enum(FORMATOS_FOTO)
export type FormatoFoto = z.infer<typeof FormatoFotoSchema>

/** La app reduce la imagen antes de subirla; esto es el límite del servidor. */
export const BYTES_MAXIMOS_FOTO = 8 * 1024 * 1024

/**
 * Vista corporal. Dos fotos solo se comparan si son de la misma vista; `otra`
 * lleva una etiqueta libre y solo se compara con la misma etiqueta.
 */
export const VistaFotoSchema = z.enum([
  "frente",
  "espalda",
  "perfilIzquierdo",
  "perfilDerecho",
  "otra",
])
export type VistaFoto = z.infer<typeof VistaFotoSchema>

const EtiquetaSchema = z
  .string()
  .trim()
  .min(1)
  .max(40)
  .regex(/^[^<>]*$/, "Escribe texto sin los signos < y >")

/**
 * `pendiente`: intención creada, objeto aún sin verificar. `disponible`:
 * confirmado y verificado. `eliminando`: se pidió borrar y el almacén aún no lo
 * confirmó (se reintenta). `eliminado`: retirado; su historial lo identifica.
 */
export const EstadoMedioSchema = z.enum(["pendiente", "disponible", "eliminando", "eliminado"])
export type EstadoMedio = z.infer<typeof EstadoMedioSchema>

/** Quién la aportó: el entrenador en una visita o el cliente en una solicitud. */
export const OrigenMedioSchema = z.enum(["profesional", "cliente"])
export type OrigenMedio = z.infer<typeof OrigenMedioSchema>

const DestinoSchema = z.discriminatedUnion("tipo", [
  z.strictObject({ tipo: z.literal("valoracion"), valoracionId: z.uuid() }),
  /** Una solicitud propia puede recibir fotos aunque aún no exista la visita. */
  z.strictObject({ tipo: z.literal("solicitud"), solicitudId: z.uuid() }),
])
export type DestinoMedio = z.infer<typeof DestinoSchema>

const conEtiquetaCoherente = <T extends { vista: VistaFoto; etiqueta: string | null }>(
  v: T,
): boolean => (v.vista === "otra") === (v.etiqueta !== null)

/** `POST /medios/subidas`. Reintentar con la misma operación devuelve el mismo medio. */
export const SolicitarSubidaSchema = z
  .strictObject({
    operacionId: z.uuid(),
    clienteId: z.uuid(),
    destino: DestinoSchema,
    vista: VistaFotoSchema,
    etiqueta: EtiquetaSchema.nullable(),
    fechaToma: FechaAgendaSchema,
    tipoMime: FormatoFotoSchema,
    bytes: z.number().int().min(1).max(BYTES_MAXIMOS_FOTO),
  })
  .refine(conEtiquetaCoherente, "La etiqueta solo acompaña a la vista «otra»")
export type SolicitarSubida = z.infer<typeof SolicitarSubidaSchema>

/** Enlace temporal de subida: caduca y solo sirve para ese objeto. No se guarda. */
export const EnlaceTemporalSchema = z.strictObject({
  url: z.url(),
  metodo: z.enum(["PUT", "GET"]),
  cabeceras: z.record(z.string(), z.string()),
  caducaEn: z.iso.datetime(),
})
export type EnlaceTemporal = z.infer<typeof EnlaceTemporalSchema>

const AutorSchema = z.strictObject({ id: z.uuid(), nombre: z.string().min(1).max(200) })

/** Lo que cualquier rol autorizado ve de una foto: sin clave de objeto ni enlaces. */
export const MedioFotoSchema = z
  .strictObject({
    id: z.uuid(),
    clienteId: z.uuid(),
    autor: AutorSchema,
    origen: OrigenMedioSchema,
    vista: VistaFotoSchema,
    etiqueta: EtiquetaSchema.nullable(),
    fechaToma: FechaAgendaSchema,
    estado: EstadoMedioSchema,
    tipoMime: FormatoFotoSchema,
    bytes: z.number().int().min(1).max(BYTES_MAXIMOS_FOTO),
    valoracionId: z.uuid().nullable(),
    solicitudId: z.uuid().nullable(),
    creadoEn: z.iso.datetime(),
    confirmadoEn: z.iso.datetime().nullable(),
  })
  .refine(conEtiquetaCoherente, "La etiqueta solo acompaña a la vista «otra»")
export type MedioFoto = z.infer<typeof MedioFotoSchema>

export const IntencionSubidaSchema = z.strictObject({
  medio: MedioFotoSchema,
  /** `null` si el medio ya está confirmado: no hay nada que subir. */
  subida: EnlaceTemporalSchema.nullable(),
})
export type IntencionSubida = z.infer<typeof IntencionSubidaSchema>

/** `GET /medios/:id/acceso`: lectura temporal, solo de medios disponibles. */
export const AccesoMedioSchema = z.strictObject({
  medioId: z.uuid(),
  lectura: EnlaceTemporalSchema,
})
export type AccesoMedio = z.infer<typeof AccesoMedioSchema>

export const ListadoFotosSchema = z.strictObject({ fotos: z.array(MedioFotoSchema) })
export type ListadoFotos = z.infer<typeof ListadoFotosSchema>

/** `POST valoraciones/:id/fotos`: el entrenador incorpora un medio ya confirmado. */
export const VincularFotoSchema = z.strictObject({ medioId: z.uuid() })
export type VincularFoto = z.infer<typeof VincularFotoSchema>

/**
 * Solicitud de fotos del entrenador al cliente. «Recibida» no es «revisada»:
 * revisarla es una acción explícita del profesional.
 */
export const EstadoSolicitudFotosSchema = z.enum(["pendiente", "recibida", "revisada"])
export type EstadoSolicitudFotos = z.infer<typeof EstadoSolicitudFotosSchema>

const VistasSolicitadasSchema = z
  .array(VistaFotoSchema.exclude(["otra"]))
  .min(1)
  .max(4)
  .refine((v) => new Set(v).size === v.length, "Vista repetida")

export const CrearSolicitudFotosSchema = z.strictObject({
  operacionId: z.uuid(),
  vistas: VistasSolicitadasSchema,
  /** Hasta cuándo se piden; `null` = sin fecha límite. */
  fechaLimite: FechaAgendaSchema.nullable(),
  /** Indicación breve para el cliente. */
  mensaje: z
    .string()
    .trim()
    .min(1)
    .max(200)
    .regex(/^[^<>]*$/, "Escribe texto sin los signos < y >")
    .nullable(),
})
export type CrearSolicitudFotos = z.infer<typeof CrearSolicitudFotosSchema>

export const SolicitudFotosSchema = z.strictObject({
  id: z.uuid(),
  clienteId: z.uuid(),
  autor: AutorSchema,
  vistas: VistasSolicitadasSchema,
  fechaLimite: FechaAgendaSchema.nullable(),
  mensaje: z.string().nullable(),
  estado: EstadoSolicitudFotosSchema,
  creadaEn: z.iso.datetime(),
  recibidaEn: z.iso.datetime().nullable(),
  revisadaEn: z.iso.datetime().nullable(),
  medios: z.array(MedioFotoSchema),
})
export type SolicitudFotos = z.infer<typeof SolicitudFotosSchema>

export const ListadoSolicitudesFotosSchema = z.strictObject({
  solicitudes: z.array(SolicitudFotosSchema),
})
export type ListadoSolicitudesFotos = z.infer<typeof ListadoSolicitudesFotosSchema>

/** `POST solicitudes-fotos/:id/revision`: acción explícita del entrenador. */
export const RevisarSolicitudFotosSchema = z.strictObject({ operacionId: z.uuid() })
export type RevisarSolicitudFotos = z.infer<typeof RevisarSolicitudFotosSchema>
