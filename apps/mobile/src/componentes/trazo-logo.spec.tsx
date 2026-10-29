import { act, render, screen } from "@testing-library/react-native"
import { AccessibilityInfo } from "react-native"
import * as Haptics from "expo-haptics"

import emblema from "../../assets/emblema.png"
import fotograma from "../../assets/video/logo-carga.png"
import video from "../../assets/video/logo-carga.mp4"
import { TrazoLogo } from "./trazo-logo"

type Jugador = {
  fuente: unknown
  muted: boolean
  loop: boolean
  status: string
  pausado: boolean
  oyentes: Map<string, Set<(datos?: object) => void>>
  emitir: (evento: string, datos?: object) => void
}
const mockJugadores: Jugador[] = []
jest.mock("expo-video", () => {
  const React = jest.requireActual<typeof import("react")>("react")
  const { View } = jest.requireActual<typeof import("react-native")>("react-native")
  return {
    useVideoPlayer: (fuente: unknown, preparar: (jugador: Jugador) => void) =>
      React.useState(() => {
        const oyentes: Jugador["oyentes"] = new Map()
        const jugador = {
          fuente,
          muted: false,
          loop: false,
          status: "loading",
          pausado: false,
          oyentes,
          play: () => undefined,
          pause: () => {
            jugador.pausado = true
          },
          addListener: (evento: string, fn: (datos?: object) => void) => {
            const grupo = oyentes.get(evento) ?? new Set()
            grupo.add(fn)
            oyentes.set(evento, grupo)
            return { remove: () => grupo.delete(fn) }
          },
          emitir: (evento: string, datos?: object) => {
            for (const fn of oyentes.get(evento) ?? []) fn(datos)
          },
        }
        preparar(jugador)
        mockJugadores.push(jugador)
        return jugador
      })[0],
    VideoView: () => React.createElement(View, { testID: "trazo-logo-video" }),
  }
})
jest.mock("expo-haptics", () => ({
  notificationAsync: jest.fn(() => Promise.resolve()),
  impactAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: { Light: "light" },
  NotificationFeedbackType: { Success: "success", Warning: "warning", Error: "error" },
}))

let reducir: (valor: boolean) => void
const decorativo = { includeHiddenElements: true }
beforeEach(() => {
  jest.useFakeTimers()
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(false)
  jest.spyOn(AccessibilityInfo, "addEventListener").mockImplementation((_evento, oyente) => {
    reducir = oyente as unknown as (valor: boolean) => void
    return { remove: jest.fn() } as unknown as ReturnType<typeof AccessibilityInfo.addEventListener>
  })
})
afterEach(() => {
  mockJugadores.length = 0
  jest.useRealTimers()
  jest.restoreAllMocks()
})

it("reproduce la marca real una vez sin sonido y da un solo impacto a los 750 ms", async () => {
  await render(<TrazoLogo />)
  expect(mockJugadores[0]).toMatchObject({ fuente: video, loop: false, muted: true })
  expect(Haptics.notificationAsync).not.toHaveBeenCalled()
  await act(() => jest.advanceTimersByTime(749))
  expect(Haptics.notificationAsync).not.toHaveBeenCalled()
  await act(() => jest.advanceTimersByTime(1))
  expect(Haptics.notificationAsync).toHaveBeenCalledTimes(1)
  await act(() => mockJugadores[0]!.emitir("playToEnd"))
  expect(screen.queryByTestId("trazo-logo-video", decorativo)).toBeNull()
  expect(screen.getByTestId("trazo-logo-imagen", decorativo).props.source).toBe(fotograma)
})

it("la espera reducida usa el emblema real al 60 % y no crea un reproductor", async () => {
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(true)
  await render(<TrazoLogo bucle />)
  expect(mockJugadores).toHaveLength(0)
  expect(screen.getByTestId("trazo-logo-imagen", decorativo).props.source).toBe(emblema)
  expect(screen.getByTestId("trazo-logo-imagen", decorativo)).toHaveStyle({ opacity: 0.6 })
  await act(() => jest.advanceTimersByTime(5000))
  expect(Haptics.notificationAsync).not.toHaveBeenCalled()
})

it("reducir movimiento en mitad del vídeo lo para y retira todos los oyentes", async () => {
  await render(<TrazoLogo bucle />)
  const jugador = mockJugadores[0]!
  expect(jugador.loop).toBe(true)
  await act(() => reducir(true))
  expect(jugador.pausado).toBe(true)
  expect([...jugador.oyentes.values()].every((grupo) => grupo.size === 0)).toBe(true)
  expect(screen.queryByTestId("trazo-logo-video", decorativo)).toBeNull()
  expect(screen.getByTestId("trazo-logo-imagen", decorativo).props.source).toBe(emblema)
})

it("si falla queda el fotograma de reserva", async () => {
  await render(<TrazoLogo bucle />)
  await act(() => mockJugadores[0]!.emitir("statusChange", { status: "error" }))
  expect(screen.queryByTestId("trazo-logo-video", decorativo)).toBeNull()
  expect(screen.getByTestId("trazo-logo-imagen", decorativo).props.source).toBe(fotograma)
})

it("abandona un vídeo que no arranca en 1,5 segundos", async () => {
  await render(<TrazoLogo bucle />)
  await act(() => jest.advanceTimersByTime(1499))
  expect(screen.getByTestId("trazo-logo-video", decorativo)).toBeOnTheScreen()
  await act(() => jest.advanceTimersByTime(1))
  expect(screen.queryByTestId("trazo-logo-video", decorativo)).toBeNull()
  expect(mockJugadores[0]?.pausado).toBe(true)
})

it("al pasar de éxito terminado a espera vuelve a crear el vídeo en bucle", async () => {
  const vista = await render(<TrazoLogo />)
  await act(() => mockJugadores[0]!.emitir("playToEnd"))
  expect(screen.queryByTestId("trazo-logo-video", decorativo)).toBeNull()
  await vista.rerender(<TrazoLogo bucle />)
  expect(screen.getByTestId("trazo-logo-video", decorativo)).toBeOnTheScreen()
  expect(mockJugadores[1]).toMatchObject({ loop: true, muted: true })
})

it("el éxito reducido conserva la háptica y desmontar cancela un impacto pendiente", async () => {
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(true)
  const vista = await render(<TrazoLogo />)
  await act(() => jest.advanceTimersByTime(750))
  expect(Haptics.notificationAsync).toHaveBeenCalledTimes(1)
  await vista.unmount()
  await render(<TrazoLogo />)
  await screen.unmount()
  await act(() => jest.advanceTimersByTime(1000))
  expect(Haptics.notificationAsync).toHaveBeenCalledTimes(1)
})
