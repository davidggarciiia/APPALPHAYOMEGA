import { act, render, screen } from "@testing-library/react-native"
import { AccessibilityInfo } from "react-native"
import { cancelAnimation, withRepeat } from "react-native-reanimated"

import { Esqueleto, GrupoEsqueletos } from "./esqueleto"

jest.mock("react-native-reanimated", () => {
  const base = jest.requireActual("react-native-reanimated/mock")
  return { ...base, withRepeat: jest.fn(base.withRepeat), cancelAnimation: jest.fn() }
})

const oyentes = new Set<(valor: boolean) => void>()
const reducir = (valor: boolean): void => oyentes.forEach((oyente) => oyente(valor))
beforeEach(() => {
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(false)
  jest.spyOn(AccessibilityInfo, "addEventListener").mockImplementation((_evento, oyente) => {
    const cambio = oyente as unknown as (valor: boolean) => void
    oyentes.add(cambio)
    return { remove: () => oyentes.delete(cambio) } as unknown as ReturnType<
      typeof AccessibilityInfo.addEventListener
    >
  })
})
afterEach(() => {
  oyentes.clear()
  jest.restoreAllMocks()
})

it("barre con un brillo neutro diagonal y cancela el bucle cuando cambia el ajuste", async () => {
  await render(<Esqueleto ancho={200} alto={52} />)
  const decorativo = { includeHiddenElements: true }
  expect(screen.getByTestId("esqueleto-brillo", decorativo)).toBeOnTheScreen()
  expect(withRepeat).toHaveBeenCalledWith(expect.anything(), -1, false)
  await act(() => reducir(true))
  expect(screen.queryByTestId("esqueleto-brillo", decorativo)).toBeNull()
  expect(cancelAnimation).toHaveBeenCalled()
})

it("si movimiento reducido ya estaba activado no inicia el bucle", async () => {
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(true)
  await render(<Esqueleto ancho="100%" alto={100} radio={20} />)
  expect(withRepeat).not.toHaveBeenCalled()
  expect(screen.queryByTestId("esqueleto-brillo", { includeHiddenElements: true })).toBeNull()
})

it("un grupo de varios bloques comparte un solo barrido y todos se paran al reducir movimiento", async () => {
  await render(
    <GrupoEsqueletos>
      <Esqueleto />
      <Esqueleto />
      <Esqueleto />
    </GrupoEsqueletos>,
  )
  expect(withRepeat).toHaveBeenCalledTimes(1)
  expect(screen.getAllByTestId("esqueleto-brillo", { includeHiddenElements: true })).toHaveLength(3)
  await act(() => reducir(true))
  expect(screen.queryAllByTestId("esqueleto-brillo", { includeHiddenElements: true })).toHaveLength(
    0,
  )
})
