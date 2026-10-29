import { act, fireEvent, render, screen } from "@testing-library/react-native"
import { AccessibilityInfo, Text } from "react-native"
import { cancelAnimation, withSpring } from "react-native-reanimated"

import { Chip, Fila, Pestanas, Tarjeta } from "./piezas"
import { tema } from "../tema"
import { INDICADOR } from "./movimiento"

jest.mock("react-native-reanimated", () => {
  const React = jest.requireActual<typeof import("react")>("react")
  const base = jest.requireActual("react-native-reanimated/mock")
  return {
    ...base,
    useSharedValue: (valor: number) => React.useState(() => ({ value: valor }))[0],
    useAnimatedStyle: (calcular: () => object) => calcular,
    withSpring: jest.fn(base.withSpring),
    cancelAnimation: jest.fn(),
  }
})

let reducir: (valor: boolean) => void
beforeEach(() => {
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(false)
  jest.spyOn(AccessibilityInfo, "addEventListener").mockImplementation((_evento, oyente) => {
    reducir = oyente as unknown as (valor: boolean) => void
    return { remove: jest.fn() } as unknown as ReturnType<typeof AccessibilityInfo.addEventListener>
  })
})
afterEach(() => jest.restoreAllMocks())

const opciones = [
  { valor: "semana", texto: "Semana" },
  { valor: "rutina", texto: "Rutina" },
]

const medir = async (nombre: string, x: number, width: number): Promise<void> => {
  await fireEvent(screen.getByRole("tab", { name: nombre }), "layout", {
    nativeEvent: { layout: { x, width, height: 44 } },
  })
}

const estiloAnimado = (id: string): object => {
  const estilos = screen.getByTestId(id).props.style as Array<object | (() => object)>
  const calcular = estilos.find((estilo): estilo is () => object => typeof estilo === "function")!
  return calcular()
}

it("el chip anuncia selección, amplía el toque y respeta deshabilitado", async () => {
  const elegir = jest.fn()
  await render(<Chip texto="Lunes" activo onPress={elegir} />)
  const chip = screen.getByRole("button", { name: "Lunes", selected: true })
  expect(chip.props.hitSlop).toBe(2)
  expect(chip).toHaveStyle({
    minHeight: 40,
    backgroundColor: tema.acentoSuave,
    borderColor: tema.acento,
  })
  await fireEvent.press(chip)
  expect(elegir).toHaveBeenCalledTimes(1)
  await screen.rerender(<Chip texto="Lunes" activo onPress={elegir} deshabilitado />)
  await fireEvent.press(screen.getByRole("button", { name: "Lunes" }))
  expect(elegir).toHaveBeenCalledTimes(1)
})

it("las pestañas mantienen selección y bloqueo en la variante segmentada", async () => {
  const cambiar = jest.fn()
  const opciones = [
    { valor: "semana", texto: "Semana" },
    { valor: "rutina", texto: "Rutina" },
  ]
  await render(
    <Pestanas
      opciones={opciones}
      activa="semana"
      cambiar={cambiar}
      variante="pil"
      bloquearCambio
    />,
  )
  expect(screen.getByRole("tab", { name: "Semana", selected: true })).toHaveStyle({
    minHeight: 44,
  })
  expect(screen.getByTestId("pestanas-segmento")).toHaveStyle({
    backgroundColor: tema.superficieAlta,
  })
  const rutina = screen.getByRole("tab", { name: "Rutina" })
  expect(rutina).toBeDisabled()
  await fireEvent.press(rutina)
  expect(cambiar).not.toHaveBeenCalled()
})

it("las pestañas cortas conservan un objetivo táctil de al menos 44 por 44", async () => {
  await render(
    <Pestanas opciones={[{ valor: "peso", texto: "Peso" }]} activa="peso" cambiar={jest.fn()} />,
  )
  expect(screen.getByRole("tab", { name: "Peso" })).toHaveStyle({ minWidth: 44, minHeight: 44 })
})

it("el fondo segmentado se desliza hasta la pestaña elegida y conserva la selección accesible", async () => {
  const cambiar = jest.fn()
  await render(<Pestanas opciones={opciones} activa="semana" cambiar={cambiar} variante="pil" />)
  await medir("Semana", 0, 80)
  await medir("Rutina", 84, 100)
  expect(withSpring).not.toHaveBeenCalled()
  expect(screen.getByTestId("pestanas-segmento")).toHaveStyle({
    backgroundColor: tema.superficieAlta,
    height: "100%",
    width: 80,
  })
  await fireEvent.press(screen.getByRole("tab", { name: "Rutina" }))
  expect(cambiar).toHaveBeenCalledWith("rutina")
  await screen.rerender(
    <Pestanas opciones={opciones} activa="rutina" cambiar={cambiar} variante="pil" />,
  )
  expect(screen.getByRole("tab", { name: "Rutina", selected: true })).toBeTruthy()
  expect(withSpring).toHaveBeenCalledWith(84, INDICADOR)
  expect(withSpring).toHaveBeenCalledWith(100, INDICADOR)
  expect(screen.getByTestId("pestanas-segmento")).toHaveStyle({ width: 100 })
})

it("al reducir movimiento cancela los muelles y cambia de segmento directamente", async () => {
  await render(<Pestanas opciones={opciones} activa="semana" cambiar={jest.fn()} variante="pil" />)
  await medir("Semana", 0, 80)
  await medir("Rutina", 84, 100)
  await act(() => reducir(true))
  jest.mocked(withSpring).mockClear()
  await screen.rerender(
    <Pestanas opciones={opciones} activa="rutina" cambiar={jest.fn()} variante="pil" />,
  )
  expect(withSpring).not.toHaveBeenCalled()
  expect(cancelAnimation).toHaveBeenCalled()
  expect(screen.getByTestId("pestanas-segmento")).toHaveStyle({ width: 100 })
  expect(estiloAnimado("pestanas-segmento")).toEqual({
    transform: [{ translateX: 84 }, { scaleX: 1 }],
  })
})

it("el subrayado conserva su forma y posición al cambiar de pestaña", async () => {
  await render(<Pestanas opciones={opciones} activa="semana" cambiar={jest.fn()} />)
  await medir("Semana", 0, 80)
  await medir("Rutina", 104, 100)
  await screen.rerender(<Pestanas opciones={opciones} activa="rutina" cambiar={jest.fn()} />)
  expect(screen.getByTestId("pestanas-indicador")).toHaveStyle({ height: 2 })
  expect(estiloAnimado("pestanas-indicador")).toEqual({
    transform: [{ translateX: 104 }, { scaleX: 100 }],
  })
})

it("la tarjeta normal tiene relleno y la lista mantiene filas de al menos 56", async () => {
  await render(
    <Tarjeta>
      <Text>Contenido</Text>
    </Tarjeta>,
  )
  expect(screen.getByTestId("tarjeta")).toHaveStyle({
    padding: 16,
    borderRadius: 20,
    backgroundColor: tema.superficie,
  })
  await screen.rerender(
    <Tarjeta variante="lista">
      <Fila primera>
        <Text>Fila uno</Text>
      </Fila>
      <Fila>
        <Text>Fila dos</Text>
      </Fila>
    </Tarjeta>,
  )
  expect(screen.getAllByTestId("tarjeta-fila")[1]).toHaveStyle({
    minHeight: 56,
    borderTopColor: tema.borde,
    borderTopWidth: 1,
  })
})
