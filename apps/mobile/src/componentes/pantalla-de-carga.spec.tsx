import { act, fireEvent, render, screen } from "@testing-library/react-native"
import { AccessibilityInfo } from "react-native"

import { PantallaDeCarga } from "./pantalla-de-carga"

/** Reproductor falso: guarda lo que se le pidió y deja emitir sus eventos. */
type MockJugador = {
  fuente: unknown
  loop: boolean
  muted: boolean
  reproduciendo: boolean
  liberado: boolean
  status: string
  emitir: (evento: string, datos?: object) => void
}
type MockOyente = (datos?: object) => void
const mockJugadores: MockJugador[] = []

jest.mock("expo-video", () => {
  const React = jest.requireActual<typeof import("react")>("react")
  const { View } = jest.requireActual<typeof import("react-native")>("react-native")
  return {
    useVideoPlayer: (fuente: unknown, preparar?: (jugador: MockJugador) => void) => {
      const jugador = React.useState(() => {
        const oyentes = new Map<string, Set<MockOyente>>()
        const nuevo: MockJugador & {
          play: () => void
          addListener: (evento: string, oyente: MockOyente) => { remove: () => void }
        } = {
          fuente,
          loop: true,
          muted: false,
          reproduciendo: false,
          liberado: false,
          status: "loading",
          play: () => {
            nuevo.reproduciendo = true
          },
          addListener: (evento, oyente) => {
            const grupo = oyentes.get(evento) ?? new Set<MockOyente>()
            grupo.add(oyente)
            oyentes.set(evento, grupo)
            return { remove: () => grupo.delete(oyente) }
          },
          emitir: (evento, datos) => {
            for (const oyente of oyentes.get(evento) ?? []) oyente(datos)
          },
        }
        preparar?.(nuevo)
        mockJugadores.push(nuevo)
        return nuevo
      })[0]
      React.useEffect(
        () => () => {
          jugador.liberado = true
        },
        [jugador],
      )
      return jugador
    },
    VideoView: () => React.createElement(View, { testID: "video" }),
  }
})

const ANUNCIO = "Alpha & Omega Training, cargando"

async function avanzar(ms: number): Promise<void> {
  await act(async () => {
    await jest.advanceTimersByTimeAsync(ms)
  })
}

async function emitir(evento: string, datos?: object): Promise<void> {
  await act(() => {
    mockJugadores[0]?.emitir(evento, datos)
  })
}

const hayPantalla = (): boolean => screen.queryByRole("progressbar", { name: ANUNCIO }) !== null

beforeEach(() => {
  jest.useFakeTimers()
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(false)
})

afterEach(() => {
  mockJugadores.length = 0
  jest.useRealTimers()
  jest.restoreAllMocks()
})

describe("Pantalla de carga con el vídeo del logo", () => {
  it("anuncia la carga, se puede saltar y reproduce el clip una vez y sin sonido", async () => {
    await render(<PantallaDeCarga lista={false} />)

    expect(screen.getByRole("progressbar", { name: ANUNCIO })).toBeOnTheScreen()
    // Mientras suena el clip no hace falta indicador.
    expect(screen.queryByTestId("indicador-de-carga")).toBeNull()
    expect(screen.getByRole("button", { name: "Saltar introducción" })).toBeOnTheScreen()
    expect(screen.getByTestId("video")).toBeOnTheScreen()
    expect(mockJugadores).toHaveLength(1)
    expect(mockJugadores[0]).toMatchObject({ muted: true, loop: false, reproduciendo: true })
  })

  it("se cierra con un fundido cuando la app está lista y el clip termina", async () => {
    await render(<PantallaDeCarga lista />)
    await emitir("playingChange", { isPlaying: true })
    await emitir("playToEnd")

    // Durante el fundido sigue pintada, pero ya no captura toques.
    expect(hayPantalla()).toBe(true)
    expect(screen.getByTestId("pantalla-de-carga")).toHaveStyle({ pointerEvents: "none" })
    await avanzar(300)
    expect(hayPantalla()).toBe(false)
  })

  it("con la app lista antes, espera a que acabe el clip", async () => {
    await render(<PantallaDeCarga lista />)
    await emitir("playingChange", { isPlaying: true })
    await avanzar(1000)

    expect(hayPantalla()).toBe(true)
    expect(screen.getByTestId("pantalla-de-carga")).toHaveStyle({ pointerEvents: "auto" })
    await emitir("playToEnd")
    await avanzar(300)
    expect(hayPantalla()).toBe(false)
  })

  it("si la app tarda, deja el logo quieto con un indicador hasta que esté lista", async () => {
    const vista = await render(<PantallaDeCarga lista={false} />)
    await emitir("playingChange", { isPlaying: true })
    await emitir("playToEnd")

    expect(screen.queryByTestId("video")).toBeNull()
    expect(screen.getByTestId("indicador-de-carga")).toBeOnTheScreen()
    await avanzar(10_000)
    expect(hayPantalla()).toBe(true)

    await vista.rerender(<PantallaDeCarga lista />)
    await avanzar(300)
    expect(hayPantalla()).toBe(false)
  })

  it("tocarla salta el clip y libera el reproductor", async () => {
    await render(<PantallaDeCarga lista />)
    await emitir("playingChange", { isPlaying: true })

    await fireEvent.press(screen.getByRole("button", { name: "Saltar introducción" }))
    expect(screen.queryByTestId("video")).toBeNull()
    expect(screen.queryByRole("button", { name: "Saltar introducción" })).toBeNull()
    expect(mockJugadores[0]?.liberado).toBe(true)
    await avanzar(300)
    expect(hayPantalla()).toBe(false)
  })

  it("si el vídeo falla, sigue con el logo quieto y no bloquea", async () => {
    await render(<PantallaDeCarga lista />)
    await emitir("statusChange", { status: "error" })

    expect(screen.queryByTestId("video")).toBeNull()
    await avanzar(300)
    expect(hayPantalla()).toBe(false)
  })

  it("si el vídeo no arranca en 1,5 s, sigue con el logo quieto", async () => {
    await render(<PantallaDeCarga lista />)
    await avanzar(1499)
    expect(screen.getByTestId("video")).toBeOnTheScreen()

    await avanzar(1)
    expect(screen.queryByTestId("video")).toBeNull()
    await avanzar(300)
    expect(hayPantalla()).toBe(false)
  })

  it("si arranca pero no avisa del fin, lo da por acabado tras su duración", async () => {
    await render(<PantallaDeCarga lista />)
    await avanzar(1000)
    await emitir("playingChange", { isPlaying: true })
    await avanzar(1499)
    expect(hayPantalla()).toBe(true)

    await avanzar(1)
    await avanzar(300)
    expect(hayPantalla()).toBe(false)
  })

  it("con «reducir movimiento» no carga el vídeo: logo quieto unos 600 ms y fundido", async () => {
    jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(true)
    await render(<PantallaDeCarga lista />)

    expect(mockJugadores).toHaveLength(0)
    expect(screen.queryByTestId("video")).toBeNull()
    await avanzar(599)
    expect(screen.getByRole("button", { name: "Saltar introducción" })).toBeOnTheScreen()
    await avanzar(1)
    await avanzar(300)
    expect(hayPantalla()).toBe(false)
  })

  it("si no se puede consultar «reducir movimiento», reproduce igualmente", async () => {
    jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockRejectedValue(new Error("sin API"))
    await render(<PantallaDeCarga lista />)

    expect(screen.getByTestId("video")).toBeOnTheScreen()
  })

  it("no reaparece en la misma ejecución", async () => {
    const vista = await render(<PantallaDeCarga lista />)
    await emitir("playToEnd")
    await avanzar(300)
    expect(hayPantalla()).toBe(false)

    await vista.rerender(<PantallaDeCarga lista={false} />)
    await vista.rerender(<PantallaDeCarga lista />)
    await avanzar(5000)
    expect(hayPantalla()).toBe(false)
    expect(mockJugadores).toHaveLength(1)
  })
})
