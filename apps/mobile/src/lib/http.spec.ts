import { afterEach, beforeEach, describe, it, jest } from "@jest/globals"
import { z } from "zod"
import * as http from "./http"
import * as autenticada from "./peticion-autenticada"
import { consultarSalud, ErrorDePermiso, ErrorDelServidor, ErrorDeRed, ErrorDeSesion } from "./api"

jest.mock("./direccion-api", () => ({ direccionDeLaApi: () => "http://localhost:3000" }))

const fetchSimulado = jest.spyOn(globalThis, "fetch")

beforeEach(() => {
  fetchSimulado.mockReset()
})
afterEach(() => {
  jest.useRealTimers()
})

describe("Tiempo límite y lectura de respuestas", () => {
  it("corta a los diez segundos y libera el temporizador tras una respuesta rápida", async () => {
    jest.useFakeTimers()
    fetchSimulado.mockImplementationOnce(
      (_url, opciones) =>
        new Promise((_resolve, reject) => {
          opciones?.signal?.addEventListener("abort", () => reject(new Error("Tiempo agotado")))
        }),
    )
    const lento = expect(http.pedir("/salud")).rejects.toBeInstanceOf(ErrorDeRed)
    await jest.advanceTimersByTimeAsync(10_000)
    await lento
    expect(jest.getTimerCount()).toBe(0)

    fetchSimulado.mockResolvedValueOnce(new Response(JSON.stringify({ ok: true })))
    await http.pedir("/salud")
    expect(jest.getTimerCount()).toBe(0)
  })

  it("respeta una cancelación externa sin descartar la sesión", async () => {
    const controlador = new AbortController()
    fetchSimulado.mockImplementationOnce(
      (_url, opciones) =>
        new Promise((_resolve, reject) => {
          opciones?.signal?.addEventListener("abort", () => reject(new Error("Cancelada")))
        }),
    )
    const resultado = http.pedir("/salud", { signal: controlador.signal })
    controlador.abort()
    await expect(resultado).rejects.toBeInstanceOf(ErrorDeRed)
    await expect(resultado).rejects.not.toBeInstanceOf(ErrorDeSesion)
  })

  it.each([200, 400, 409])(
    "un corte al descargar el cuerpo HTTP %i también es un fallo de red",
    async (status) => {
      const respuesta = new Response(null, { status })
      jest.spyOn(respuesta, "json").mockRejectedValue(new TypeError("Conexión interrumpida"))
      fetchSimulado.mockResolvedValue(respuesta)
      await expect(http.pedir("/salud")).rejects.toBeInstanceOf(ErrorDeRed)
    },
  )

  it("un JSON mal formado no se presenta como un fallo de cobertura", async () => {
    fetchSimulado.mockResolvedValue(new Response("<html>Esto no es JSON</html>"))
    const resultado = http.pedir("/salud")
    await expect(resultado).rejects.toMatchObject({ name: "SyntaxError" })
    await expect(resultado).rejects.not.toBeInstanceOf(ErrorDeRed)
  })
})

describe("Compatibilidad del transporte de identidad", () => {
  it("conecta también cuando el entorno nativo no ofrece AbortSignal.timeout", async () => {
    const original = Object.getOwnPropertyDescriptor(AbortSignal, "timeout")
    Object.defineProperty(AbortSignal, "timeout", { value: undefined, configurable: true })
    fetchSimulado.mockResolvedValue(
      new Response(JSON.stringify({ estado: "ok", baseDeDatos: "ok" })),
    )
    try {
      await expect(consultarSalud()).resolves.toEqual({ estado: "ok", baseDeDatos: "ok" })
    } finally {
      if (original) Object.defineProperty(AbortSignal, "timeout", original)
      else Reflect.deleteProperty(AbortSignal, "timeout")
    }
  })

  it.each<[number, typeof ErrorDeSesion | typeof ErrorDePermiso]>([
    [401, ErrorDeSesion],
    [403, ErrorDePermiso],
  ])("mantiene la distinción del estado %i", async (estado, TipoError) => {
    fetchSimulado.mockResolvedValue(new Response(null, { status: estado }))
    await expect(consultarSalud()).rejects.toBeInstanceOf(TipoError)
  })

  it("conserva el estado numérico de errores antiguos sin código de dominio", async () => {
    fetchSimulado.mockResolvedValue(
      new Response(JSON.stringify({ statusCode: 409, message: "Correo ocupado" }), { status: 409 }),
    )
    const resultado = consultarSalud()
    await expect(resultado).rejects.toBeInstanceOf(ErrorDelServidor)
    await expect(resultado).rejects.toMatchObject({ codigo: 409 })
  })

  it("un fallo de red no se convierte en una credencial rechazada", async () => {
    fetchSimulado.mockRejectedValue(new TypeError("Network request failed"))
    const resultado = consultarSalud()
    await expect(resultado).rejects.toBeInstanceOf(ErrorDeRed)
    await expect(resultado).rejects.not.toBeInstanceOf(ErrorDeSesion)
  })
})

describe("Punto de acceso autenticado", () => {
  const respuestaSchema = z.strictObject({ ok: z.boolean() })

  it("lee el token vigente y combina Headers sin alterar los del consumidor", async () => {
    let token = "primer-token"
    const pedir = autenticada.crearPeticionAutenticada(() => token)
    const headers = new Headers({ Authorization: "Bearer antiguo", "X-Prueba": "se-conserva" })
    fetchSimulado.mockImplementation(async () => new Response(JSON.stringify({ ok: true })))

    await pedir("/ejercicios", respuestaSchema, { headers })
    token = "segundo-token"
    await pedir("/ejercicios", respuestaSchema, { headers })

    const primera = new Headers(fetchSimulado.mock.calls[0]?.[1]?.headers)
    const segunda = new Headers(fetchSimulado.mock.calls[1]?.[1]?.headers)
    expect(primera.get("Authorization")).toBe("Bearer primer-token")
    expect(segunda.get("Authorization")).toBe("Bearer segundo-token")
    expect(segunda.get("X-Prueba")).toBe("se-conserva")
    expect(segunda.get("Content-Type")).toBe("application/json")
    expect(headers.get("Authorization")).toBe("Bearer antiguo")
  })

  it("sin token no envía una petición anónima ni reutiliza uno anterior", async () => {
    const pedir = autenticada.crearPeticionAutenticada(() => null)
    await expect(pedir("/ejercicios", respuestaSchema)).rejects.toBeInstanceOf(ErrorDeSesion)
    expect(fetchSimulado).not.toHaveBeenCalled()
  })

  it("un 403 no renueva credenciales ni se transforma en cierre de sesión", async () => {
    const pedir = autenticada.crearPeticionAutenticada(() => "token")
    fetchSimulado.mockResolvedValue(new Response(null, { status: 403 }))
    const resultado = pedir("/ejercicios", respuestaSchema)
    await expect(resultado).rejects.toBeInstanceOf(ErrorDePermiso)
    await expect(resultado).rejects.not.toBeInstanceOf(ErrorDeSesion)
    expect(fetchSimulado).toHaveBeenCalledTimes(1)
  })

  it("el reintento explícito conserva el cuerpo y el id de operación originales", async () => {
    const pedir = autenticada.crearPeticionAutenticada(() => "token")
    const body = JSON.stringify({ operacionId: "11111111-1111-4111-8111-111111111111", semanas: 2 })
    fetchSimulado.mockRejectedValueOnce(new TypeError("Sin conexión"))
    await expect(
      pedir("/planes", respuestaSchema, { method: "POST", body }),
    ).rejects.toBeInstanceOf(ErrorDeRed)
    expect(fetchSimulado).toHaveBeenCalledTimes(1)

    fetchSimulado.mockResolvedValueOnce(new Response(JSON.stringify({ ok: true })))
    await expect(pedir("/planes", respuestaSchema, { method: "POST", body })).resolves.toEqual({
      ok: true,
    })
    expect(fetchSimulado.mock.calls.map(([, opciones]) => opciones?.body)).toEqual([body, body])
  })
})

describe("Contratos de peticiones nuevas", () => {
  it.each<[number, string]>([
    [400, "solicitud_invalida"],
    [409, "nombre_duplicado"],
  ])("ofrece el detalle validado para HTTP %i", async (statusCode, codigo) => {
    const detalle = { statusCode, codigo, message: "Revisa el nombre" }
    fetchSimulado.mockResolvedValue(new Response(JSON.stringify(detalle), { status: statusCode }))
    const resultado = http.pedir("/ejercicios")
    await expect(resultado).rejects.toBeInstanceOf(http.ErrorDePeticion)
    await expect(resultado).rejects.toBeInstanceOf(ErrorDelServidor)
    await expect(resultado).rejects.toMatchObject({ codigo: statusCode, detalle })
  })

  it.each([
    "<html>Fallo del proxy</html>",
    JSON.stringify({ statusCode: 400, codigo: "solicitud_invalida", message: "Estado mezclado" }),
    JSON.stringify({ statusCode: 409, codigo: "desconocido", message: "Otro contrato" }),
  ])("conserva el estado HTTP si el error no cumple el contrato (%s)", async (body) => {
    fetchSimulado.mockResolvedValue(new Response(body, { status: 409 }))
    const resultado = http.pedir("/ejercicios")
    await expect(resultado).rejects.toBeInstanceOf(ErrorDelServidor)
    await expect(resultado).rejects.not.toBeInstanceOf(http.ErrorDePeticion)
    await expect(resultado).rejects.toMatchObject({ codigo: 409 })
  })

  it("valida la respuesta antes de entregarla al consumidor", async () => {
    const schema = z.strictObject({ nombre: z.string() })
    fetchSimulado.mockResolvedValueOnce(new Response(JSON.stringify({ nombre: "Sentadilla" })))
    await expect(http.pedirJson("/ejercicios/uno", schema)).resolves.toEqual({
      nombre: "Sentadilla",
    })

    fetchSimulado.mockResolvedValueOnce(new Response(JSON.stringify({ nombre: 42 })))
    await expect(http.pedirJson("/ejercicios/uno", schema)).rejects.toBeInstanceOf(z.ZodError)
  })

  it("acepta 204 sin intentar interpretar un cuerpo JSON", async () => {
    fetchSimulado.mockResolvedValue(new Response(null, { status: 204 }))
    await expect(http.pedirJson("/auth/logout", z.null(), { method: "POST" })).resolves.toBeNull()
  })
})
