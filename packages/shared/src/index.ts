import { z } from "zod"

/**
 * Vocabulario y contratos compartidos por la app y el servidor.
 *
 * Definidos una sola vez aqui. Si manana aparece un quinto rol, se cambia en
 * este fichero y el compilador senala cada sitio de los dos lados que hay que
 * tocar.
 *
 * Los contratos se escriben como esquemas de Zod y el tipo se deriva de ellos,
 * no al reves. Asi el mismo objeto sirve para comprobar en tiempo de ejecucion
 * lo que llega por la red y para tipar el codigo que lo usa.
 */

/** Los cuatro perfiles de SPEC-identity.md. No hay mas y no se anaden a la ligera. */
export const ROLES = ["cliente", "entrenador", "nutricionista", "empleado"] as const

export const RolSchema = z.enum(ROLES)
export type Rol = z.infer<typeof RolSchema>

/**
 * Existir y poder entrar son dos cosas distintas.
 *
 * - `pendiente`: el entrenador ha creado el perfil. Existe, se le pueden asignar
 *   entrenos y dietas, y todavia no puede iniciar sesion porque no tiene contrasena.
 * - `activo`: ha completado la activacion y entra con normalidad.
 * - `desactivado`: no entra, y su historico se conserva intacto.
 */
export const ESTADOS_USUARIO = ["pendiente", "activo", "desactivado"] as const

export const EstadoUsuarioSchema = z.enum(ESTADOS_USUARIO)
export type EstadoUsuario = z.infer<typeof EstadoUsuarioSchema>

/** Comprueba si un valor cualquiera es un rol valido. Util al leer datos de fuera. */
export function esRol(valor: unknown): valor is Rol {
  return RolSchema.safeParse(valor).success
}

/**
 * Respuesta de GET /salud.
 *
 * Vive aqui y no en el servidor porque es un contrato entre las dos partes: el
 * servidor lo produce y la app lo consume. Si cambia la forma, el compilador
 * rompe en los dos lados a la vez, que es justo lo que queremos.
 */
export const EstadoSaludSchema = z.object({
  estado: z.enum(["ok", "degradado"]),
  baseDeDatos: z.enum(["ok", "sin respuesta"]),
})

export type EstadoSalud = z.infer<typeof EstadoSaludSchema>

/**
 * Lo que la app envia a POST /auth/login.
 *
 * El limite de longitud no es cosmetico: sin el, alguien puede mandar una
 * contrasena de megabytes y obligar al servidor a calcular su hash, que es una
 * operacion cara a proposito. Eso es una denegacion de servicio gratuita.
 */
export const CredencialesSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  contrasena: z.string().min(1).max(200),
})

export type Credenciales = z.infer<typeof CredencialesSchema>

/** Datos del usuario que la app puede ver. Nunca incluye el hash de contrasena. */
export const UsuarioPublicoSchema = z.object({
  id: z.string(),
  email: z.string(),
  nombre: z.string(),
  apellidos: z.string().nullable(),
  rol: RolSchema,
  estado: EstadoUsuarioSchema,
})

export type UsuarioPublico = z.infer<typeof UsuarioPublicoSchema>

/**
 * El perfil completo de quien ha iniciado sesion, para su propia pantalla.
 *
 * Es mas ancho que `UsuarioPublico` a proposito: aqui caben datos de contacto que
 * no tienen por que viajar en cada respuesta de la API.
 */
export const PerfilPropioSchema = UsuarioPublicoSchema.extend({
  telefono: z.string().nullable(),
  /** En formato AAAA-MM-DD. Una fecha sin hora no necesita zona horaria. */
  fechaNacimiento: z.string().nullable(),
  fotoUrl: z.string().nullable(),
})

export type PerfilPropio = z.infer<typeof PerfilPropioSchema>

/**
 * Lo que se puede cambiar del perfil propio.
 *
 * El correo NO esta: cambiarlo es cambiar de identidad y exigiria verificar la
 * direccion nueva antes de aceptarla, o cualquiera se apropiaria de la cuenta de
 * otro. El rol y el estado tampoco, por motivos obvios.
 */
export const CambiosDePerfilSchema = z.object({
  nombre: z.string().trim().min(1).max(80).optional(),
  apellidos: z.string().trim().max(120).nullable().optional(),
  /**
   * Se acepta con espacios, signos y prefijo internacional. Validar telefonos con
   * una expresion estricta rechaza numeros legitimos de otros paises, y aqui el
   * dato solo sirve para que el entrenador llame a su cliente.
   */
  telefono: z
    .string()
    .trim()
    .max(30)
    .regex(
      /^[+()\d\s.-]*$/,
      "El teléfono solo puede llevar números, espacios y los signos + ( ) - .",
    )
    .nullable()
    .optional(),
  fechaNacimiento: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "La fecha va en formato AAAA-MM-DD")
    .nullable()
    .optional(),
})

export type CambiosDePerfil = z.infer<typeof CambiosDePerfilSchema>

/**
 * Una fila del listado que ve el entrenador.
 *
 * Deliberadamente estrecho: lo justo para pintar una lista y decidir a quién
 * abrir. Los datos de contacto no viajan aquí, solo en la ficha de cada uno.
 */
export const ResumenUsuarioSchema = z.object({
  id: z.string(),
  nombre: z.string(),
  apellidos: z.string().nullable(),
  email: z.string(),
  rol: RolSchema,
  estado: EstadoUsuarioSchema,
})

export type ResumenUsuario = z.infer<typeof ResumenUsuarioSchema>

/**
 * Resultado de un listado.
 *
 * Lleva `total` además de las filas para que la app pueda decir "mostrando 50 de
 * 120" en lugar de cortar en silencio. Una lista truncada sin avisar es de los
 * errores que más tardan en descubrirse: todo parece correcto hasta que alguien
 * pregunta por un cliente que no aparece.
 */
export const ListadoUsuariosSchema = z.object({
  usuarios: z.array(ResumenUsuarioSchema),
  total: z.number().int().nonnegative(),
})

export type ListadoUsuarios = z.infer<typeof ListadoUsuariosSchema>

/**
 * Identificador de usuario que viaja en una ruta.
 *
 * Se valida igual que un cuerpo. Una ruta es entrada de fuera, y sin esto un
 * identificador con cualquier forma llega hasta Prisma y sale como un error 500
 * en lugar de un 400 honesto.
 */
export const IdUsuarioSchema = z.uuid()

/**
 * La ficha que el entrenador ve de otra persona.
 *
 * No extiende `PerfilPropioSchema` porque aquella arrastra `fotoUrl`, que salió
 * de la tarea 15 hacia `seguimiento-corporal`. Y no se ensancha
 * `UsuarioPublicoSchema`, que viaja dentro de cada respuesta de login y de
 * refresco: añadirle el teléfono lo metería en todas ellas.
 */
export const FichaDeUsuarioSchema = UsuarioPublicoSchema.extend({
  telefono: z.string().nullable(),
  /** En formato AAAA-MM-DD, igual que en el perfil propio. */
  fechaNacimiento: z.string().nullable(),
  /** Fecha de alta, en ISO. El entrenador quiere saber desde cuándo está. */
  creadoEn: z.string(),
  /**
   * Si tiene contraseña. Derivado, nunca el hash.
   *
   * Es lo que permite a la pantalla decir de antemano a dónde volverá alguien al
   * reactivarlo: quien nunca activó vuelve a pendiente, quien ya tenía
   * contraseña vuelve a activo.
   */
  tieneContrasena: z.boolean(),
})

export type FichaDeUsuario = z.infer<typeof FichaDeUsuarioSchema>

/**
 * Lo que el entrenador puede cambiar de la ficha de otra persona.
 *
 * Es gemelo de `CambiosDePerfilSchema` y aun así se escribe aparte a propósito.
 * Son dos permisos distintos sobre dos sujetos distintos: aquel lo usan los
 * cuatro roles sobre sí mismos, y un campo que se añada allí no puede aparecer
 * aquí por herencia, ni al revés.
 *
 * Estricto: un cuerpo que traiga `rol` o `estado` es un 400 ruidoso y no un
 * campo que se descarta en silencio. Este es el punto obvio por el que alguien
 * intentaría ascenderse, y el contrato tiene que decir que no.
 */
export const CambiosDeUsuarioSchema = z.strictObject({
  nombre: z.string().trim().min(1).max(80).optional(),
  apellidos: z.string().trim().max(120).nullable().optional(),
  telefono: z
    .string()
    .trim()
    .max(30)
    .regex(
      /^[+()\d\s.-]*$/,
      "El teléfono solo puede llevar números, espacios y los signos + ( ) - .",
    )
    .nullable()
    .optional(),
  fechaNacimiento: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "La fecha va en formato AAAA-MM-DD")
    .nullable()
    .optional(),
})

export type CambiosDeUsuario = z.infer<typeof CambiosDeUsuarioSchema>

/**
 * Corregir el correo de quien todavía no ha activado.
 *
 * Existe porque un correo mal tecleado en el gimnasio deja una cuenta que nunca
 * recibirá nada y que no se puede borrar (requisito 14). Solo vale mientras el
 * perfil está pendiente: en cuanto alguien entra con esa dirección, cambiarla es
 * cambiar de identidad y exigiría verificar la nueva antes de aceptarla.
 */
export const CorreoDeUsuarioSchema = z.strictObject({
  email: z.string().trim().toLowerCase().email().max(254),
})

export type CorreoDeUsuario = z.infer<typeof CorreoDeUsuarioSchema>

/**
 * A quién ve un nutricionista.
 *
 * Solo identificadores. La pantalla del entrenador ya tiene los nombres de su
 * cartera, y repetirlos aquí sería mandar dos veces los mismos datos de
 * personas por la red para pintar una lista de interruptores.
 */
export const AsignacionesDeNutricionistaSchema = z.object({
  nutricionistaId: z.string(),
  clienteIds: z.array(z.string()),
})

export type AsignacionesDeNutricionista = z.infer<typeof AsignacionesDeNutricionistaSchema>

/**
 * Lo que devuelve reenviar el enlace de activación.
 *
 * Lleva `correoEnviado` por el mismo motivo que el alta, y aquí importa más: al
 * reenviar, el enlace anterior **ya está quemado**. Contestar con un error
 * genérico le diría al entrenador que no ha pasado nada, cuando en realidad su
 * cliente se ha quedado sin ningún enlace válido.
 */
export const ResultadoDeEnvioSchema = z.object({
  usuario: FichaDeUsuarioSchema,
  correoEnviado: z.boolean(),
})

export type ResultadoDeEnvio = z.infer<typeof ResultadoDeEnvioSchema>

/** Filtros del listado. Llegan por query, así que todo es texto. */
export const FiltrosDeListadoSchema = z.object({
  buscar: z.string().trim().max(80).optional(),
  rol: RolSchema.optional(),
  estado: EstadoUsuarioSchema.optional(),
  limite: z.coerce.number().int().min(1).max(200).default(100),
  desde: z.coerce.number().int().nonnegative().default(0),
})

export type FiltrosDeListado = z.infer<typeof FiltrosDeListadoSchema>

/**
 * Lo que devuelve POST /auth/login.
 *
 * Dos tokens con papeles distintos. El de acceso dura minutos y viaja en cada
 * peticion. El de refresco dura semanas, vive en el almacen seguro del
 * dispositivo y solo se usa para pedir un token de acceso nuevo.
 */
export const SesionSchema = z.object({
  tokenAcceso: z.string().min(1),
  tokenRefresco: z.string().min(1),
  usuario: UsuarioPublicoSchema,
})

export type Sesion = z.infer<typeof SesionSchema>

/** Cuerpo de POST /auth/refresh y POST /auth/logout. */
export const PeticionRefrescoSchema = z.object({
  tokenRefresco: z.string().min(1).max(500),
})

export type PeticionRefresco = z.infer<typeof PeticionRefrescoSchema>

/**
 * Contrasena que el usuario elige al activar su cuenta o al recuperarla.
 *
 * El minimo es de longitud y no de "una mayuscula, un numero y un simbolo". Esas
 * reglas empujan a la gente hacia contrasenas cortas y retorcidas que acaban
 * apuntadas en un papel, mientras que una frase larga es mas facil de recordar y
 * mucho mas dificil de adivinar.
 *
 * El maximo no es cosmetico: sin el, alguien manda megabytes y obliga al
 * servidor a calcular su hash, que es una operacion cara a proposito.
 */
export const ContrasenaNuevaSchema = z
  .string()
  .min(10, "Usa al menos 10 caracteres. Una frase que recuerdes sirve.")
  .max(200)

/** Lo que el entrenador envia para dar de alta a alguien. */
export const CrearUsuarioSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  nombre: z.string().trim().min(1).max(80),
  apellidos: z.string().trim().max(120).optional(),
  rol: RolSchema,
})

export type CrearUsuario = z.infer<typeof CrearUsuarioSchema>

/**
 * Lo que devuelve el alta.
 *
 * Lleva `correoEnviado` porque las dos cosas pueden ir por separado: la cuenta
 * se crea y el correo puede no salir. Perder la cuenta por un fallo del proveedor
 * de correo seria peor, y decir que se envio cuando no se envio es lo que deja a
 * un cliente esperando un enlace que nunca llega.
 */
export const UsuarioCreadoSchema = UsuarioPublicoSchema.extend({
  correoEnviado: z.boolean(),
})

export type UsuarioCreado = z.infer<typeof UsuarioCreadoSchema>

/** Lo que el titular envia al abrir el enlace de activacion. */
export const ActivacionSchema = z.object({
  token: z.string().min(1).max(500),
  contrasena: ContrasenaNuevaSchema,
})

export type Activacion = z.infer<typeof ActivacionSchema>
