import { afterEach, describe, expect, it, jest } from "@jest/globals"
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native"
import { AccessibilityInfo, Platform } from "react-native"
import type { Figura } from "@alpha-omega/shared"

import { FiguraDeEjercicio, type AccesoAFiguras } from "./figura-ejercicio"

/** Reproductor falso: guarda lo que se le pidió y deja emitir su estado. */
type MockJugador = {
  fuente: unknown
  loop: boolean
  muted: boolean
  reproduciendo: boolean
  liberado: boolean
  pausas: number
  release: () => void
  status: string
  emitir: (status: string) => void
}
type MockOyente = (evento: { status: string }) => void
const mockJugadores: MockJugador[] = []
const mockFocos: Array<{ salir: () => void; entrar: () => void }> = []

jest.mock("expo-video", () => {
  const React = jest.requireActual<typeof import("react")>("react")
  const { View } = jest.requireActual<typeof import("react-native")>("react-native")
  function crear(fuente: unknown): MockJugador {
    const oyentes = new Set<MockOyente>()
    const jugador = {
      fuente,
      loop: false,
      muted: false,
      reproduciendo: false,
      liberado: false,
      pausas: 0,
      status: "loading",
      play: () => {
        if (jugador.liberado) throw new Error("Cannot use shared object that was already released")
        jugador.reproduciendo = true
      },
      pause: () => {
        if (jugador.liberado) throw new Error("Cannot use shared object that was already released")
        jugador.pausas++
        jugador.reproduciendo = false
      },
      release: () => {
        jugador.liberado = true
        jugador.reproduciendo = false
      },
      addListener: (_nombre: string, oyente: MockOyente) => {
        oyentes.add(oyente)
        return { remove: () => oyentes.delete(oyente) }
      },
      emitir: (status: string) => {
        jugador.status = status
        for (const oyente of oyentes) oyente({ status })
      },
    }
    mockJugadores.push(jugador)
    return jugador
  }
  return {
    useVideoPlayer: (fuente: unknown, preparar?: (jugador: MockJugador) => void) => {
      const jugador = React.useState(() => {
        const jugador = crear(fuente)
        preparar?.(jugador)
        return jugador
      })[0]
      // Expo libera el SharedObject en el cleanup del hook, registrado antes
      // de los efectos de foco que use el componente consumidor.
      React.useEffect(() => () => jugador.release(), [jugador])
      return jugador
    },
    VideoView: () => React.createElement(View, { testID: "video" }),
  }
})
jest.mock("expo-router", () => ({
  useFocusEffect: (efecto: () => (() => void) | void) =>
    jest.requireActual<typeof import("react")>("react").useEffect(() => {
      let limpiar = efecto()
      const foco = {
        salir: () => {
          limpiar?.()
          limpiar = undefined
        },
        entrar: () => {
          limpiar = efecto()
        },
      }
      mockFocos.push(foco)
      return () => {
        foco.salir()
        mockFocos.splice(mockFocos.indexOf(foco), 1)
      }
    }, [efecto]),
}))
jest.mock("../sesion", () => ({ useSesion: jest.fn() }))
jest.mock("../lib/direccion-api", () => ({ direccionDeLaApi: () => "http://localhost:3000" }))

const EJERCICIO = "3f2b8c1e-4d5a-4f6b-8a9c-0d1e2f3a4b01"
const VITAL: Figura = {
  medioId: "vital-0054",
  version: "1",
  origen: "licenciado",
  licencia: "Vital Animations EULA 2026.1 · paquete gratuito",
  sinConexion: true,
}
const MOVEKIT: Figura = { ...VITAL, medioId: "movekit-pull-ups", sinConexion: false }
const URL_VITAL = `http://localhost:3000/ejercicios/${EJERCICIO}/figura?v=vital-0054.1`

function acceso(token: string | null = "token-1"): AccesoAFiguras & {
  renovar: jest.Mock<(id: string) => Promise<void>>
} {
  return {
    base: "http://localhost:3000",
    token,
    renovar: jest.fn<(id: string) => Promise<void>>().mockResolvedValue(undefined),
  }
}

async function pintar(datos: AccesoAFiguras, figura: Figura = VITAL) {
  return render(
    <FiguraDeEjercicio
      acceso={datos}
      ejercicioId={EJERCICIO}
      figura={figura}
      nombre="Sentadilla trasera"
    />,
  )
}

afterEach(() => {
  mockJugadores.length = 0
  mockFocos.length = 0
  jest.restoreAllMocks()
})

describe("Figura de un ejercicio en el móvil", () => {
  it("el desmontaje tolera la liberación de Expo anterior al cleanup de foco", async () => {
    const vista = await pintar(acceso())
    const jugador = mockJugadores[0]!
    await expect(vista.unmount()).resolves.toBeUndefined()
    expect(jugador.liberado).toBe(true)
    expect(jugador.pausas).toBe(0)
  })

  it("perder foco sin desmontar pausa y volver reanuda el mismo jugador", async () => {
    await pintar(acceso())
    const jugador = mockJugadores[0]!
    await act(() => mockFocos[0]!.salir())
    expect(jugador).toMatchObject({ liberado: false, reproduciendo: false, pausas: 1 })
    await act(() => mockFocos[0]!.entrar())
    expect(jugador.reproduciendo).toBe(true)
    expect(mockJugadores).toHaveLength(1)
  })

  it("volver al foco respeta la pausa elegida por la persona", async () => {
    await pintar(acceso())
    await fireEvent.press(screen.getByRole("button", { name: "Pausar la animación" }))
    await act(() => {
      mockFocos[0]!.salir()
      mockFocos[0]!.entrar()
    })
    expect(mockJugadores[0]?.reproduciendo).toBe(false)
  })

  it("pide el clip con la sesión, en bucle, sin sonido y con caché si la licencia lo permite", async () => {
    await pintar(acceso())

    expect(mockJugadores).toHaveLength(1)
    const [jugador] = mockJugadores
    expect(jugador?.fuente).toEqual({
      uri: URL_VITAL,
      headers: { Authorization: "Bearer token-1" },
      useCaching: true,
    })
    expect(jugador).toMatchObject({ loop: true, muted: true, reproduciendo: true })
    expect(
      screen.getByRole("image", { name: "Animación de la técnica: Sentadilla trasera" }),
    ).toBeTruthy()
  })

  it("un clip solo para streaming no se guarda en el móvil", async () => {
    await pintar(acceso(), MOVEKIT)

    expect(mockJugadores[0]?.fuente).toMatchObject({ useCaching: false })
  })

  it("una versión nueva del medio cambia la dirección, así que no sirve la caché vieja", async () => {
    await pintar(acceso(), { ...VITAL, version: "2" })

    expect(mockJugadores[0]?.fuente).toMatchObject({
      uri: `http://localhost:3000/ejercicios/${EJERCICIO}/figura?v=vital-0054.2`,
    })
  })

  it("se puede pausar y reanudar", async () => {
    await pintar(acceso())

    await fireEvent.press(screen.getByRole("button", { name: "Pausar la animación" }))
    expect(mockJugadores[0]?.reproduciendo).toBe(false)

    await fireEvent.press(screen.getByRole("button", { name: "Reanudar la animación" }))
    expect(mockJugadores[0]?.reproduciendo).toBe(true)
  })

  it("salir de la pantalla la para", async () => {
    const vista = await pintar(acceso())
    const [jugador] = mockJugadores

    await vista.unmount()

    expect(jugador?.reproduciendo).toBe(false)
  })

  it("quien pide menos movimiento la ve parada hasta que la reanude", async () => {
    jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(true)

    await pintar(acceso())

    expect(await screen.findByRole("button", { name: "Reanudar la animación" })).toBeTruthy()
    expect(mockJugadores[0]?.reproduciendo).toBe(false)
  })

  it("si el clip falla avisa sin bloquear, renueva la sesión y reintenta con el token nuevo", async () => {
    const datos = acceso()
    const vista = await pintar(datos, MOVEKIT)

    await act(() => {
      mockJugadores[0]?.emitir("error")
    })
    expect(screen.getByText(/solo se ve con conexión/)).toBeTruthy()

    datos.renovar.mockImplementation(async () => {
      await vista.rerender(
        <FiguraDeEjercicio
          acceso={{ ...datos, token: "token-2" }}
          ejercicioId={EJERCICIO}
          figura={MOVEKIT}
          nombre="Sentadilla trasera"
        />,
      )
    })
    await fireEvent.press(screen.getByRole("button", { name: "Reintentar" }))

    await waitFor(() => {
      expect(mockJugadores).toHaveLength(2)
    })
    expect(datos.renovar).toHaveBeenCalledWith(EJERCICIO)
    expect(mockJugadores[1]?.fuente).toMatchObject({ headers: { Authorization: "Bearer token-2" } })
  })

  it("sin sesión no intenta reproducir", async () => {
    await pintar(acceso(null))

    expect(mockJugadores).toHaveLength(0)
    expect(screen.getByText(/No se ha podido cargar la animación/)).toBeTruthy()
  })
})

describe("Figura de un ejercicio en la web", () => {
  function comoWeb(): void {
    jest.replaceProperty(Platform, "OS", "web")
  }

  it("descarga con la sesión y reproduce el archivo local, que libera al salir", async () => {
    comoWeb()
    const archivo = new Blob(["mp4"])
    const pedirArchivo = jest
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(archivo, { status: 200 }))
    jest.spyOn(URL, "createObjectURL").mockReturnValue("blob:figura")
    const liberarUrl = jest.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined)

    const vista = await pintar(acceso())

    await waitFor(() => {
      expect(mockJugadores).toHaveLength(1)
    })
    expect(pedirArchivo).toHaveBeenCalledWith(
      URL_VITAL,
      expect.objectContaining({ headers: { Authorization: "Bearer token-1" } }),
    )
    expect(mockJugadores[0]?.fuente).toEqual({ uri: "blob:figura" })

    await vista.unmount()
    expect(liberarUrl).toHaveBeenCalledWith("blob:figura")
  })

  it("con el token caducado renueva una vez; si sigue rechazado, avisa", async () => {
    comoWeb()
    jest.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 401 }))
    const datos = acceso()

    await pintar(datos)

    expect(await screen.findByText(/No se ha podido cargar la animación/)).toBeTruthy()
    expect(datos.renovar).toHaveBeenCalledTimes(1)
    expect(mockJugadores).toHaveLength(0)
  })
})
