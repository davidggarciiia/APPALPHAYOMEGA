import { sumarDiasFecha, VERSION_CONSENTIMIENTO, type UsuarioCreado } from "@alpha-omega/shared"
import type { NestExpressApplication } from "@nestjs/platform-express"

import { ServicioDeCorreo, type Correo } from "../correo/correo.service.js"
import { cifrarContrasena } from "../identity/contrasenas.js"
import type { PrismaService } from "../prisma/prisma.service.js"
import type { ApiDemo, Cuenta } from "./api-demo.js"
import { instante, type ClaveCliente } from "./contexto-demo.js"
import { DOMINIO_DEMO } from "./seguridad-demo.js"

/** Personas inventadas. Nombres, fechas y correos no corresponden a nadie real. */
type Persona = {
  email: string
  nombre: string
  apellidos: string
  fechaNacimiento: string
  /** Hace cuántos días se dio de alta, para que la ficha no parezca de hoy. */
  altaHaceDias: number
}

const correo = (local: string): string => `${local}@${DOMINIO_DEMO}`

export const ENTRENADOR_DEMO: Persona = {
  email: correo("entrenador"),
  nombre: "Álex",
  apellidos: "Romero",
  fechaNacimiento: "1988-04-12",
  altaHaceDias: 150,
}

export const NUTRICIONISTA_DEMO: Persona = {
  email: correo("irene.soler"),
  nombre: "Irene",
  apellidos: "Soler",
  fechaNacimiento: "1990-11-03",
  altaHaceDias: 120,
}

export const CLIENTES_DEMO: Record<ClaveCliente, Persona> = {
  lucia: {
    email: correo("lucia.martin"),
    nombre: "Lucía",
    apellidos: "Martín",
    fechaNacimiento: "1992-03-18",
    altaHaceDias: 88,
  },
  marcos: {
    email: correo("marcos.gil"),
    nombre: "Marcos",
    apellidos: "Gil",
    fechaNacimiento: "1985-07-02",
    altaHaceDias: 55,
  },
  sara: {
    email: correo("sara.ortega"),
    nombre: "Sara",
    apellidos: "Ortega",
    fechaNacimiento: "1996-12-09",
    altaHaceDias: 26,
  },
  javier: {
    email: correo("javier.ruiz"),
    nombre: "Javier",
    apellidos: "Ruiz",
    fechaNacimiento: "1979-05-27",
    altaHaceDias: 2,
  },
  nerea: {
    email: correo("nerea.campos"),
    nombre: "Nerea",
    apellidos: "Campos",
    fechaNacimiento: "1994-09-21",
    altaHaceDias: 72,
  },
  pablo: {
    email: correo("pablo.vidal"),
    nombre: "Pablo",
    apellidos: "Vidal",
    fechaNacimiento: "1990-01-30",
    altaHaceDias: 64,
  },
}

/**
 * Los correos de activación no salen del proceso: se quedan en este buzón.
 * Sin esto, dar de alta a los clientes de demo por la API enviaría correos de
 * verdad a direcciones inventadas.
 */
export function interceptarCorreo(app: NestExpressApplication): Correo[] {
  const buzon: Correo[] = []
  const servicio = app.get(ServicioDeCorreo)
  servicio.enviar = (mensaje: Correo): Promise<void> => {
    buzon.push(mensaje)
    return Promise.resolve()
  }
  return buzon
}

function tokenDeActivacion(buzon: Correo[], email: string): string {
  const mensaje = [...buzon].reverse().find((m) => m.para === email)
  const token = mensaje?.texto.match(/token=([^\s&]+)/)?.[1]
  if (!token) throw new Error(`No llegó el enlace de activación de ${email}`)
  return decodeURIComponent(token)
}

export type Cuentas = {
  entrenador: Cuenta
  nutricionista: Cuenta
  clientes: Record<Exclude<ClaveCliente, "javier">, Cuenta>
  ids: Record<ClaveCliente, string>
}

/**
 * Crea las cuentas. El entrenador de demo nace como el del seed (la API no
 * crea entrenadores); los demás, por el alta real del entrenador y el enlace de
 * activación, salvo Javier, que se queda pendiente y sin contraseña.
 */
export async function crearCuentas(
  prisma: PrismaService,
  api: ApiDemo,
  buzon: Correo[],
  contrasena: string,
): Promise<Cuentas> {
  await prisma.usuario.create({
    data: {
      email: ENTRENADOR_DEMO.email,
      nombre: ENTRENADOR_DEMO.nombre,
      apellidos: ENTRENADOR_DEMO.apellidos,
      fechaNacimiento: new Date(`${ENTRENADOR_DEMO.fechaNacimiento}T00:00:00Z`),
      passwordHash: await cifrarContrasena(contrasena),
      rol: "entrenador",
      estado: "activo",
    },
  })
  const entrenador = await api.entrar(ENTRENADOR_DEMO.email, contrasena)

  async function alta(persona: Persona, rol: "cliente" | "nutricionista"): Promise<string> {
    const creado = await api.pedir<UsuarioCreado>(entrenador, "POST", "/usuarios", {
      email: persona.email,
      nombre: persona.nombre,
      apellidos: persona.apellidos,
      rol,
    })
    await api.pedir(entrenador, "PATCH", `/usuarios/${creado.id}`, {
      fechaNacimiento: persona.fechaNacimiento,
    })
    return creado.id
  }

  async function activar(persona: Persona): Promise<Cuenta> {
    await api.pedir(null, "POST", "/auth/activar", {
      token: tokenDeActivacion(buzon, persona.email),
      contrasena,
    })
    return api.entrar(persona.email, contrasena)
  }

  await alta(NUTRICIONISTA_DEMO, "nutricionista")
  const nutricionista = await activar(NUTRICIONISTA_DEMO)

  const ids = {} as Record<ClaveCliente, string>
  const clientes = {} as Cuentas["clientes"]
  for (const [clave, persona] of Object.entries(CLIENTES_DEMO) as [ClaveCliente, Persona][]) {
    ids[clave] = await alta(persona, "cliente")
    if (clave === "javier") continue
    const cuenta = await activar(persona)
    clientes[clave] = cuenta
    // El consentimiento de datos de salud lo da el propio cliente, como en la app.
    await api.pedir(cuenta, "POST", "/consentimiento", {
      version: VERSION_CONSENTIMIENTO,
      acepto: true,
    })
  }

  // Irene lleva la nutrición de Lucía y de Sara.
  for (const clave of ["lucia", "sara"] as const)
    await api.pedir(entrenador, "PUT", `/nutricionistas/${nutricionista.id}/clientes/${ids[clave]}`)

  return { entrenador, nutricionista, clientes, ids }
}

/**
 * Altas, consentimientos y asignaciones con la fecha en que habrían ocurrido.
 * La API no deja fechar en pasado: solo se mueven marcas de tiempo.
 */
export async function fecharCuentas(
  prisma: PrismaService,
  cuentas: Cuentas,
  hoy: string,
): Promise<void> {
  const haceDias = (dias: number): Date => instante(sumarDiasFecha(hoy, -dias), 10, 15)
  const personas: [string, Persona][] = [
    [cuentas.entrenador.id, ENTRENADOR_DEMO],
    [cuentas.nutricionista.id, NUTRICIONISTA_DEMO],
    ...(Object.entries(CLIENTES_DEMO) as [ClaveCliente, Persona][]).map(
      ([clave, persona]): [string, Persona] => [cuentas.ids[clave], persona],
    ),
  ]
  for (const [id, persona] of personas) {
    const alta = haceDias(persona.altaHaceDias)
    await prisma.$executeRaw`
      UPDATE "usuarios" SET "creadoEn" = ${alta} WHERE "id" = ${id}`
    await prisma.consentimientoSalud.updateMany({
      where: { usuarioId: id },
      data: { aceptadoEn: new Date(alta.getTime() + 3_600_000) },
    })
    await prisma.tokenActivacion.updateMany({
      where: { usuarioId: id, usadoEn: { not: null } },
      data: { creadoEn: alta, usadoEn: new Date(alta.getTime() + 3_000_000) },
    })
  }
  for (const clave of ["lucia", "sara"] as const)
    await prisma.asignacionNutricionista.updateMany({
      where: { nutricionistaId: cuentas.nutricionista.id, clienteId: cuentas.ids[clave] },
      data: { desde: haceDias(CLIENTES_DEMO[clave].altaHaceDias - 1) },
    })
}
