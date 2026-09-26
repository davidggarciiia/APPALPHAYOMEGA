import type { Sesion } from "@alpha-omega/shared"
import { act, render, screen, waitFor } from "@testing-library/react-native"
import { Text } from "react-native"

import { borrarTokenRefresco, guardarTokenRefresco, leerTokenRefresco } from "./lib/almacen-seguro"
import { ErrorDeRed, ErrorDeSesion, refrescarSesion } from "./lib/api"
import { pedirAutenticado } from "./lib/transporte"
import { ProveedorDeSesion, useSesion } from "./sesion"

jest.mock("./lib/almacen-seguro", () => ({
  leerTokenRefresco: jest.fn(),
  guardarTokenRefresco: jest.fn(() => Promise.resolve()),
  borrarTokenRefresco: jest.fn(() => Promise.resolve()),
}))

jest.mock("./lib/api", () => ({
  ...jest.requireActual<object>("./lib/api"),
  refrescarSesion: jest.fn(),
  iniciarSesion: jest.fn(),
  cerrarSesionEnServidor: jest.fn(() => Promise.resolve()),
}))

jest.mock("./lib/direccion-api", () => ({ direccionDeLaApi: () => "https://api.prueba" }))

const leer = jest.mocked(leerTokenRefresco)
const guardar = jest.mocked(guardarTokenRefresco)
const borrar = jest.mocked(borrarTokenRefresco)
const refrescar = jest.mocked(refrescarSesion)

/** La sesion numero `n`: acceso `a<n>` y refresco `r<n>`. */
function sesion(n: number): Sesion {
  return {
    tokenAcceso: `a${String(n)}`,
    tokenRefresco: `r${String(n)}`,
    usuario: {
      id: "11111111-1111-4111-8111-111111111111",
      email: "cliente@ejemplo.com",
      nombre: "Cliente",
      apellidos: null,
      rol: "cliente",
      estado: "activo",
    },
  }
}

/** Un servidor de mentira que solo acepta el token de acceso que se le diga. */
function servidorQueAcepta(token: string | null): jest.Mock {
  const alPedir = jest.fn((_url: string, opciones: RequestInit) => {
    const cabeceras = (opciones.headers ?? {}) as Record<string, string>
    const valido = token !== null && cabeceras.Authorization === `Bearer ${token}`
    return Promise.resolve({
      status: valido ? 200 : 401,
      ok: valido,
      json: () => Promise.resolve({}),
    } as unknown as Response)
  })
  globalThis.fetch = alPedir as unknown as typeof fetch
  return alPedir
}

let contexto: ReturnType<typeof useSesion> | null = null

function Espia(): React.JSX.Element {
  contexto = useSesion()
  const { estado, sesionCaducada } = contexto
  const fase = estado.fase === "dentro" ? `dentro:${estado.tokenAcceso}` : estado.fase
  return <Text>{`${fase}${sesionCaducada ? " caducada" : ""}`}</Text>
}

/** Arranca la app con una sesion guardada que el servidor renueva a la numero 1. */
async function arrancarDentro(): Promise<void> {
  leer.mockResolvedValue("r0")
  refrescar.mockResolvedValueOnce(sesion(1))
  await render(
    <ProveedorDeSesion>
      <Espia />
    </ProveedorDeSesion>,
  )
  await screen.findByText("dentro:a1")
}

beforeEach(() => {
  jest.clearAllMocks()
  contexto = null
})

describe("La sesion se renueva sola mientras la app esta abierta", () => {
  it("renueva sin salir de la pantalla y guarda el refresco nuevo antes de usarlo", async () => {
    await arrancarDentro()
    const alPedir = servidorQueAcepta("a2")
    refrescar.mockResolvedValueOnce(sesion(2))

    await act(async () => {
      await pedirAutenticado("/perfil", "a1")
    })

    // Canjea el refresco que tiene en memoria (r1), no el que se leyo al arrancar.
    expect(refrescar).toHaveBeenLastCalledWith("r1")
    expect(guardar).toHaveBeenLastCalledWith("r2")

    // El refresco nuevo queda guardado antes de repetir la peticion con el
    // acceso nuevo: si la app muriera en medio, al volver no mandaria uno ya rotado.
    const guardadoEn = guardar.mock.invocationCallOrder.at(-1) ?? Infinity
    const repetidaEn = alPedir.mock.invocationCallOrder.at(-1) ?? -Infinity
    expect(guardadoEn).toBeLessThan(repetidaEn)

    expect(screen.getByText("dentro:a2")).toBeOnTheScreen()
  })

  it("si el servidor rechaza la renovacion, cierra la sesion y borra el token", async () => {
    await arrancarDentro()
    servidorQueAcepta(null)
    refrescar.mockRejectedValueOnce(new ErrorDeSesion("401"))

    await act(async () => {
      await expect(pedirAutenticado("/perfil", "a1")).rejects.toBeInstanceOf(ErrorDeSesion)
    })

    expect(borrar).toHaveBeenCalled()
    expect(screen.getByText("fuera caducada")).toBeOnTheScreen()
  })

  it("sin red, la renovacion falla pero la sesion sigue abierta y guardada", async () => {
    await arrancarDentro()
    servidorQueAcepta(null)
    refrescar.mockRejectedValueOnce(new ErrorDeRed("sin cobertura"))

    await act(async () => {
      await expect(pedirAutenticado("/perfil", "a1")).rejects.toBeInstanceOf(ErrorDeRed)
    })

    expect(borrar).not.toHaveBeenCalled()
    expect(screen.getByText("dentro:a1")).toBeOnTheScreen()
  })

  it("cerrar sesion mientras se renueva descarta la renovacion", async () => {
    await arrancarDentro()
    servidorQueAcepta("a2")

    let terminarRenovacion: (valor: Sesion) => void = () => undefined
    refrescar.mockReturnValueOnce(
      new Promise<Sesion>((resolver) => {
        terminarRenovacion = resolver
      }),
    )

    const peticion = pedirAutenticado("/perfil", "a1")
    const resultado = expect(peticion).rejects.toBeInstanceOf(ErrorDeSesion)

    // Se espera a que la renovacion este de verdad en vuelo: el primer canje fue
    // el del arranque, el segundo es este. Si se saliera antes, la renovacion ni
    // empezaria y el test no probaria la carrera.
    await waitFor(() => {
      expect(refrescar).toHaveBeenCalledTimes(2)
    })

    await act(async () => {
      await contexto?.salir()
    })
    await act(async () => {
      terminarRenovacion(sesion(2))
      await resultado
    })

    // La renovacion termino despues de salir: ni reabre la sesion ni guarda nada.
    expect(guardar).not.toHaveBeenCalledWith("r2")
    expect(screen.getByText("fuera")).toBeOnTheScreen()
  })
})
