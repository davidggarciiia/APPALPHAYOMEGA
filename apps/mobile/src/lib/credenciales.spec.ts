import type { Sesion } from "@alpha-omega/shared"

import { guardarTokenRefresco, leerTokenRefresco } from "./almacen-seguro"
import { refrescarSesion } from "./api"
import {
  escucharCredenciales,
  establecerCredenciales,
  olvidarCredenciales,
  pedirAutenticado,
  renovarAcceso,
} from "./credenciales"
import { ErrorDeRed, ErrorDeSesion, pedir } from "./http"

jest.mock("./api", () => ({ refrescarSesion: jest.fn() }))
jest.mock("./http", () => ({ ...jest.requireActual("./http"), pedir: jest.fn() }))

const refrescar = refrescarSesion as jest.MockedFunction<typeof refrescarSesion>
const pedirMock = pedir as jest.MockedFunction<typeof pedir>

function sesion(n: number): Sesion {
  return {
    tokenAcceso: `acceso-${String(n)}`,
    tokenRefresco: `refresco-${String(n)}`,
    usuario: {
      id: "u",
      email: "a@b.c",
      nombre: "Ana",
      apellidos: null,
      rol: "cliente",
      estado: "activo",
    },
  }
}

function cabecera(llamada: number): string {
  const opciones = pedirMock.mock.calls[llamada]?.[1]
  return (opciones?.headers as Record<string, string> | undefined)?.Authorization ?? ""
}

describe("Renovación de la sesión durante el uso", () => {
  beforeEach(async () => {
    jest.clearAllMocks()
    await olvidarCredenciales()
    establecerCredenciales(sesion(1))
    await guardarTokenRefresco("refresco-1")
  })

  it("dos peticiones que reciben 401 a la vez provocan una sola renovación", async () => {
    let soltar: (valor: Sesion) => void = () => undefined
    refrescar.mockReturnValue(new Promise((resolver) => (soltar = resolver)))
    pedirMock.mockImplementation(async (_ruta, opciones) => {
      const token = (opciones?.headers as Record<string, string>).Authorization
      if (token === "Bearer acceso-1") {
        throw new ErrorDeSesion("401")
      }
      return { ok: token }
    })
    const a = pedirAutenticado("/a")
    const b = pedirAutenticado("/b")
    await new Promise((resolver) => setTimeout(resolver, 0))
    soltar(sesion(2))
    await expect(a).resolves.toEqual({ ok: "Bearer acceso-2" })
    await expect(b).resolves.toEqual({ ok: "Bearer acceso-2" })
    expect(refrescar).toHaveBeenCalledTimes(1)
    expect(refrescar).toHaveBeenCalledWith("refresco-1")
    // El refresco nuevo quedó guardado antes de usarse.
    await expect(leerTokenRefresco()).resolves.toBe("refresco-2")
  })

  it("si otra petición ya renovó, no se vuelve a renovar", async () => {
    refrescar.mockResolvedValue(sesion(2))
    await renovarAcceso("acceso-1")
    const token = await renovarAcceso("acceso-1")
    expect(token).toBe("acceso-2")
    expect(refrescar).toHaveBeenCalledTimes(1)
  })

  it("una caída de red no cierra la sesión ni borra el refresco", async () => {
    const eventos: string[] = []
    const dejar = escucharCredenciales((evento) => eventos.push(evento.tipo))
    refrescar.mockRejectedValue(new ErrorDeRed("sin red"))
    await expect(renovarAcceso("acceso-1")).rejects.toBeInstanceOf(ErrorDeRed)
    await expect(leerTokenRefresco()).resolves.toBe("refresco-1")
    expect(eventos).toEqual([])
    dejar()
  })

  it("un 401 al renovar sí caduca la sesión y borra el refresco", async () => {
    const eventos: string[] = []
    const dejar = escucharCredenciales((evento) => eventos.push(evento.tipo))
    refrescar.mockRejectedValue(new ErrorDeSesion("401"))
    await expect(renovarAcceso("acceso-1")).rejects.toBeInstanceOf(ErrorDeSesion)
    await expect(leerTokenRefresco()).resolves.toBeNull()
    expect(eventos).toEqual(["caducada"])
    dejar()
  })

  it("cerrar sesión durante una renovación descarta su resultado", async () => {
    let soltar: (valor: Sesion) => void = () => undefined
    refrescar.mockReturnValue(new Promise((resolver) => (soltar = resolver)))
    const renovacion = renovarAcceso("acceso-1")
    const salida = olvidarCredenciales()
    soltar(sesion(2))
    await expect(renovacion).rejects.toBeInstanceOf(ErrorDeSesion)
    await salida
    await expect(leerTokenRefresco()).resolves.toBe("refresco-1")
  })

  it("un fallo que no es de sesión no se reintenta", async () => {
    pedirMock.mockRejectedValue(new ErrorDeRed("sin red"))
    await expect(pedirAutenticado("/a", { method: "PUT" })).rejects.toBeInstanceOf(ErrorDeRed)
    expect(pedirMock).toHaveBeenCalledTimes(1)
    expect(cabecera(0)).toBe("Bearer acceso-1")
  })
})
