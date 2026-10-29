import { act, renderHook } from "@testing-library/react-native"
import { AccessibilityInfo } from "react-native"

import { useAnimacionLista } from "./lista-animada"

afterEach(() => jest.restoreAllMocks())

it("anima entradas por la diagonal y salidas en su continuación", async () => {
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(false)
  const { result } = await renderHook(useAnimacionLista)
  const entrada = result.current.entering?.()
  const salida = result.current.exiting?.()
  expect(entrada?.initialValues.transform).toEqual([{ translateX: 8 }, { translateY: -22 }])
  expect(salida?.initialValues).toEqual({
    opacity: 1,
    transform: [{ translateX: 0 }, { translateY: 0 }],
  })
  expect(salida?.animations.transform).toEqual([{ translateX: -8 }, { translateY: 22 }])
  expect(result.current.layout).toBeDefined()
})

it("no instala animaciones mientras consulta el ajuste ni con movimiento reducido", async () => {
  let resolver!: (reducido: boolean) => void
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockReturnValue(
    new Promise((r) => {
      resolver = r
    }),
  )
  const { result } = await renderHook(useAnimacionLista)
  expect(result.current).toEqual({})
  await act(() => resolver(true))
  expect(result.current).toEqual({})
})

it("retira entrada, salida y layout cuando cambia la preferencia del sistema", async () => {
  let cambiar!: (reducido: boolean) => void
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(false)
  jest.spyOn(AccessibilityInfo, "addEventListener").mockImplementation((_evento, oyente) => {
    cambiar = oyente as unknown as typeof cambiar
    return { remove: jest.fn() } as unknown as ReturnType<typeof AccessibilityInfo.addEventListener>
  })
  const { result } = await renderHook(useAnimacionLista)
  expect(result.current.layout).toBeDefined()
  await act(() => cambiar(true))
  expect(result.current).toEqual({})
})
