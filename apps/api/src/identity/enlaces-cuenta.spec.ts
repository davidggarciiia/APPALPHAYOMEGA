import type { PrismaService } from "../prisma/prisma.service.js"
import type { ServicioDeCorreo } from "../correo/correo.service.js"
import { ActivacionService } from "./activacion.service.js"
import { RecuperacionService } from "./recuperacion.service.js"
import { LimitadorDeIntentos } from "./limitador-intentos.service.js"
import type { TokensRefrescoService } from "./tokens-refresco.service.js"
import { enlaceDeCuenta, validarEnlacesDeCuenta } from "./enlaces-cuenta.js"

const id = "00000000-0000-4000-8000-000000000001"
const originales = { ...process.env }
afterEach(() => {
  for (const clave of ["NODE_ENV", "ACTIVACION_URL_BASE", "RECUPERACION_URL_BASE"]) {
    if (originales[clave] === undefined) delete process.env[clave]
    else process.env[clave] = originales[clave]
  }
})

function entorno() {
  const enviados: Array<{ texto: string; html: string }> = []
  const tx = {
    usuario: {
      findUnique: async () => ({
        id,
        email: "sintetico@example.test",
        nombre: "Prueba",
        estado: "activo",
      }),
      findUniqueOrThrow: async () => ({ id, email: "sintetico@example.test", nombre: "Prueba" }),
      updateMany: async () => ({ count: 1 }),
    },
    tokenActivacion: { updateMany: async () => ({}), create: async () => ({ id }) },
    tokenRecuperacion: { updateMany: async () => ({}), create: async () => ({ id }) },
  }
  const prisma = {
    ...tx,
    $transaction: async <T>(f: (cliente: typeof tx) => Promise<T>) => f(tx),
  } as unknown as PrismaService
  const correo = {
    enviar: async (mensaje: { texto: string; html: string }) => {
      enviados.push(mensaje)
    },
  } as unknown as ServicioDeCorreo
  return {
    enviados,
    activacion: new ActivacionService(prisma, correo),
    recuperacion: new RecuperacionService(
      prisma,
      correo,
      new LimitadorDeIntentos(),
      {} as TokensRefrescoService,
    ),
  }
}

it("la recuperación usa el destino HTTPS configurado", async () => {
  process.env.RECUPERACION_URL_BASE = "https://alphayomegatraining.com/restablecer"
  const e = entorno()
  await e.recuperacion.solicitar("sintetico@example.test", "127.0.0.1")
  expect(e.enviados[0]?.texto).toContain(`https://alphayomegatraining.com/restablecer?token=${id}.`)
})

it.each(["activacion", "recuperacion"] as const)(
  "producción rechaza un enlace %s con esquema sin verificar",
  async (tipo) => {
    process.env.NODE_ENV = "production"
    process.env.ACTIVACION_URL_BASE = "alphaomega://activar"
    process.env.RECUPERACION_URL_BASE = "alphaomega://restablecer"
    const e = entorno()
    const envio =
      tipo === "activacion"
        ? e.activacion.enviarEnlace(id)
        : e.recuperacion.solicitar("sintetico@example.test", "127.0.0.1")
    await expect(envio).rejects.toThrow(/HTTPS/)
    expect(e.enviados).toHaveLength(0)
  },
)

it("en desarrollo conserva los dos destinos de la app y codifica el token", () => {
  process.env.NODE_ENV = "test"
  delete process.env.ACTIVACION_URL_BASE
  delete process.env.RECUPERACION_URL_BASE
  expect(enlaceDeCuenta("activacion", "id.secreto+&")).toBe(
    "alphaomega://activar?token=id.secreto%2B%26",
  )
  expect(enlaceDeCuenta("recuperacion", "id.secreto")).toBe(
    "alphaomega://restablecer?token=id.secreto",
  )
})

it("valida los dos destinos HTTPS antes de arrancar en producción", () => {
  process.env.NODE_ENV = "production"
  process.env.ACTIVACION_URL_BASE = "https://alphayomegatraining.com/activar"
  process.env.RECUPERACION_URL_BASE = "https://alphayomegatraining.com/restablecer"
  expect(validarEnlacesDeCuenta).not.toThrow()
  for (const variable of ["ACTIVACION_URL_BASE", "RECUPERACION_URL_BASE"]) {
    const valor = process.env[variable]
    delete process.env[variable]
    expect(validarEnlacesDeCuenta).toThrow(variable)
    process.env[variable] = valor
  }
})

it.each([
  "https://usuario:clave@example.test/activar",
  "https://example.test/activar?token=otro",
  "https://example.test/activar#fragmento",
  "javascript:alert(1)",
  "ftp://example.test/activar",
  "una URL inválida",
])("rechaza un destino ambiguo o inseguro: %s", (base) => {
  process.env.NODE_ENV = "test"
  process.env.ACTIVACION_URL_BASE = base
  expect(() => enlaceDeCuenta("activacion", "id.secreto")).toThrow("ACTIVACION_URL_BASE")
})
