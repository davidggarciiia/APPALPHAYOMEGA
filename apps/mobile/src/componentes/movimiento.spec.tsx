import { act, renderHook } from "@testing-library/react-native"
import { AccessibilityInfo } from "react-native"
import { cancelAnimation, withTiming } from "react-native-reanimated"

import { ANGULO, useDestello, useEstadoMovimiento, useMovimientoReducido } from "./movimiento"

jest.mock("react-native-reanimated", () => {
  const React = jest.requireActual<typeof import("react")>("react")
  const base = jest.requireActual("react-native-reanimated/mock")
  return {
    ...base,
    useSharedValue: (valor: number) => React.useState(() => ({ value: valor }))[0],
    // Deja el barrido en su primer fotograma para poder observar quién sigue visible.
    withTiming: jest.fn(() => 0),
    cancelAnimation: jest.fn(),
    useAnimatedStyle: (calcular: () => object) => calcular,
  }
})

let cambiar: (reducido: boolean) => void
beforeEach(() => {
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(false)
  jest.spyOn(AccessibilityInfo, "addEventListener").mockImplementation((_evento, oyente) => {
    cambiar = oyente as unknown as (reducido: boolean) => void
    return { remove: jest.fn() } as unknown as ReturnType<typeof AccessibilityInfo.addEventListener>
  })
})
afterEach(() => jest.restoreAllMocks())

it("conserva el ángulo de la marca en los destellos", () => {
  expect(ANGULO).toBe(20)
})

it("comparte una consulta y un oyente del sistema entre todas las animaciones montadas", async () => {
  const { result, unmount } = await renderHook(() => [
    useEstadoMovimiento(),
    useMovimientoReducido(),
    useDestello(200),
  ])
  expect(AccessibilityInfo.isReduceMotionEnabled).toHaveBeenCalledTimes(1)
  expect(AccessibilityInfo.addEventListener).toHaveBeenCalledTimes(1)
  expect(result.current[0]).toEqual({ reducido: false, listo: true })
  await act(() => cambiar(true))
  expect(result.current[0]).toEqual({ reducido: true, listo: true })
  expect(result.current[1]).toBe(true)
  const suscripcion = jest.mocked(AccessibilityInfo.addEventListener).mock.results[0]!.value
  await unmount()
  expect(suscripcion.remove).toHaveBeenCalledTimes(1)
})

it("un cambio del sistema gana a una consulta inicial que termina tarde", async () => {
  let resolver!: (valor: boolean) => void
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockReturnValue(
    new Promise((r) => {
      resolver = r
    }),
  )
  const { result } = await renderHook(useMovimientoReducido)
  expect(result.current).toBe(true)
  await act(() => cambiar(true))
  await act(() => resolver(false))
  expect(result.current).toBe(true)
})

it("solo mantiene visible el último destello entre componentes", async () => {
  const { result } = await renderHook(() => [useDestello(200), useDestello(300)])
  const primero = result.current[0]!
  const segundo = result.current[1]!
  const estilo = (destello: typeof primero) =>
    (destello.estilo as unknown as () => { opacity: number; transform: object[] })()
  await act(() => primero.disparar())
  expect(estilo(primero).opacity).toBe(0.75)
  await act(() => segundo.disparar())
  expect(estilo(primero).opacity).toBe(0)
  expect(estilo(segundo).opacity).toBe(0.75)
  expect(estilo(segundo).transform).toContainEqual({ skewX: "-20deg" })
  expect(cancelAnimation).toHaveBeenCalled()
})

it("cancela el destello activo al activar movimiento reducido y no admite otro", async () => {
  const { result } = await renderHook(() => useDestello(200))
  await act(() => result.current.disparar())
  await act(() => cambiar(true))
  jest.mocked(withTiming).mockClear()
  await act(() => result.current.disparar())
  const estilo = (result.current.estilo as unknown as () => { opacity: number })()
  expect(estilo.opacity).toBe(0)
  expect(withTiming).not.toHaveBeenCalled()
})

it("el barrido sigue la anchura compartida que cambia tras medir sin pedir otro render", async () => {
  const ancho = { value: 100 } as import("react-native-reanimated").SharedValue<number>
  const { result } = await renderHook(() => useDestello(ancho))
  const estilo = () =>
    (result.current.estilo as unknown as () => { transform: { translateX?: number }[] })()
  expect(estilo().transform[0]?.translateX).toBe(144)
  ancho.value = 220
  expect(estilo().transform[0]?.translateX).toBe(264)
})
