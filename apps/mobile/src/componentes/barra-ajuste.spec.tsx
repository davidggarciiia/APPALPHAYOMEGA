import { useState } from "react"
import { act, fireEvent, render, screen } from "@testing-library/react-native"
import { Dimensions, Keyboard, StyleSheet, type KeyboardEvent } from "react-native"
import * as Haptics from "expo-haptics"

import { BarraAjuste, type BarraAjusteProps } from "./barra-ajuste"

jest.mock("expo-haptics", () => ({ selectionAsync: jest.fn(() => Promise.resolve()) }))

function Controlada(props: Partial<BarraAjusteProps> = {}): React.JSX.Element {
  const [valor, cambiar] = useState<number | null>(props.valor ?? 0)
  return <BarraAjuste unidad="kg" alListo={jest.fn()} {...props} valor={valor} cambiar={cambiar} />
}

afterEach(() => {
  jest.useRealTimers()
  jest.restoreAllMocks()
})

it.each([
  ["kg", 0, undefined, 2.5],
  ["kg", 0.1, 0.2, 0.3],
  ["reps", 8, undefined, 9],
  ["seg", 30, undefined, 35],
  ["m", 20, undefined, 21],
  ["series", 3, undefined, 4],
] as const)(
  "ajusta %s con su paso y sin ruido decimal",
  async (unidad, valor, subidaKg, esperado) => {
    const cambiar = jest.fn()
    await render(
      <BarraAjuste
        unidad={unidad}
        valor={valor}
        subidaKg={subidaKg}
        cambiar={cambiar}
        alListo={jest.fn()}
      />,
    )
    await fireEvent.press(screen.getByRole("button", { name: "Aumentar" }))
    expect(cambiar).toHaveBeenCalledWith(esperado)
  },
)

it("respeta cero, límites y un paso de carga inválido", async () => {
  await render(<Controlada valor={0} subidaKg={0} />)
  expect(screen.getByRole("button", { name: "Disminuir" })).toBeDisabled()
  await fireEvent.press(screen.getByRole("button", { name: "Aumentar" }))
  expect(screen.getByRole("button", { name: "Escribir KG: 2,5" })).toBeOnTheScreen()
})

it("espera 400 ms, repite a 90 ms y acelera a 60 ms tras ocho pasos", async () => {
  jest.useFakeTimers()
  await render(<Controlada unidad="reps" />)
  const mas = screen.getByRole("button", { name: "Aumentar" })
  await fireEvent(mas, "pressIn")
  await act(() => jest.advanceTimersByTime(399))
  expect(screen.getByRole("button", { name: "Escribir REPS: 0" })).toBeOnTheScreen()
  await act(() => jest.advanceTimersByTime(1))
  expect(screen.getByRole("button", { name: "Escribir REPS: 1" })).toBeOnTheScreen()
  await act(() => jest.advanceTimersByTime(7 * 90))
  expect(screen.getByRole("button", { name: "Escribir REPS: 8" })).toBeOnTheScreen()
  await act(() => jest.advanceTimersByTime(59))
  expect(screen.getByRole("button", { name: "Escribir REPS: 8" })).toBeOnTheScreen()
  await act(() => jest.advanceTimersByTime(1))
  expect(screen.getByRole("button", { name: "Escribir REPS: 9" })).toBeOnTheScreen()
  await fireEvent(mas, "pressOut")
  await fireEvent.press(mas)
  expect(screen.getByRole("button", { name: "Escribir REPS: 9" })).toBeOnTheScreen()
  expect(Haptics.selectionAsync).toHaveBeenCalledTimes(5)
})

it("cancela la retención al ocultar o desmontar", async () => {
  jest.useFakeTimers()
  const cambiar = jest.fn()
  const props = { unidad: "kg" as const, valor: 10, cambiar, alListo: jest.fn() }
  await render(<BarraAjuste {...props} />)
  await fireEvent(screen.getByRole("button", { name: "Aumentar" }), "pressIn")
  await screen.rerender(<BarraAjuste {...props} visible={false} />)
  await act(() => jest.advanceTimersByTime(1000))
  expect(cambiar).not.toHaveBeenCalled()
  await screen.rerender(<BarraAjuste {...props} />)
  await fireEvent(screen.getByRole("button", { name: "Aumentar" }), "pressIn")
  await screen.unmount()
  await act(() => jest.advanceTimersByTime(1000))
  expect(cambiar).not.toHaveBeenCalled()
})

it.each(["unidad", "deshabilitado"] as const)(
  "cancela también la liberación de un gesto al cambiar %s",
  async (cambio) => {
    jest.useFakeTimers()
    const cambiar = jest.fn()
    const props = { unidad: "kg" as const, valor: 10, cambiar, alListo: jest.fn() }
    await render(<BarraAjuste {...props} />)
    await fireEvent(screen.getByRole("button", { name: "Aumentar" }), "pressIn")
    await screen.rerender(
      <BarraAjuste
        {...props}
        unidad={cambio === "unidad" ? "reps" : "kg"}
        deshabilitado={cambio === "deshabilitado"}
      />,
    )
    await act(() => jest.advanceTimersByTime(1000))
    if (cambio === "deshabilitado") await screen.rerender(<BarraAjuste {...props} />)
    await fireEvent(screen.getByRole("button", { name: "Aumentar" }), "pressOut")
    await fireEvent.press(screen.getByRole("button", { name: "Aumentar" }))
    expect(cambiar).not.toHaveBeenCalled()
  },
)

it("acota el ajuste y detiene la repetición al alcanzar el máximo", async () => {
  jest.useFakeTimers()
  const cambiar = jest.fn()
  await render(
    <BarraAjuste unidad="kg" valor={9} maximo={10} cambiar={cambiar} alListo={jest.fn()} />,
  )
  await fireEvent(screen.getByRole("button", { name: "Aumentar" }), "pressIn")
  await act(() => jest.advanceTimersByTime(2000))
  expect(cambiar).toHaveBeenCalledTimes(1)
  expect(cambiar).toHaveBeenCalledWith(10)
})

it("abre entrada manual solo al tocar la cifra, valida y acepta coma decimal y cero", async () => {
  const cambiar = jest.fn()
  const alListo = jest.fn()
  await render(<BarraAjuste unidad="kg" valor={10} cambiar={cambiar} alListo={alListo} />)
  expect(screen.queryByLabelText("Valor manual KG")).toBeNull()
  await fireEvent.press(screen.getByRole("button", { name: "Escribir KG: 10" }))
  const campo = screen.getByLabelText("Valor manual KG")
  expect(campo.props).toMatchObject({
    keyboardType: "decimal-pad",
    selectTextOnFocus: true,
    autoFocus: true,
  })
  for (const invalido of ["", " ", "1e3", "-2", "1,2,3", "Infinity", "."]) {
    await fireEvent.changeText(campo, invalido)
    expect(screen.getByRole("button", { name: "Listo" })).toBeDisabled()
  }
  expect(cambiar).not.toHaveBeenCalled()
  await fireEvent.changeText(campo, "12,75")
  expect(cambiar).toHaveBeenLastCalledWith(12.75)
  await fireEvent.changeText(campo, ".5")
  expect(cambiar).toHaveBeenLastCalledWith(0.5)
  await fireEvent.changeText(campo, "0")
  expect(cambiar).toHaveBeenLastCalledWith(0)
  await fireEvent.press(screen.getByRole("button", { name: "Listo" }))
  expect(alListo).toHaveBeenCalledTimes(1)
})

it("notifica la validez manual y la libera al desmontarse", async () => {
  const alCambiarValidez = jest.fn()
  const vista = await render(
    <BarraAjuste
      unidad="kg"
      valor={10}
      cambiar={jest.fn()}
      alListo={jest.fn()}
      alCambiarValidez={alCambiarValidez}
    />,
  )
  expect(alCambiarValidez.mock.calls).toEqual([[true]])
  await fireEvent.press(screen.getByRole("button", { name: "Escribir KG: 10" }))
  const campo = screen.getByLabelText("Valor manual KG")
  alCambiarValidez.mockClear()
  await fireEvent.changeText(campo, "")
  expect(alCambiarValidez.mock.calls).toEqual([[false]])
  expect(screen.getByRole("button", { name: "Listo" })).toBeDisabled()
  await fireEvent.changeText(campo, "1,2,3")
  expect(alCambiarValidez.mock.calls).toEqual([[false]])
  await fireEvent.changeText(campo, "12,5")
  expect(alCambiarValidez.mock.calls).toEqual([[false], [true]])
  await fireEvent.changeText(campo, "")
  expect(alCambiarValidez).toHaveBeenLastCalledWith(false)
  await vista.unmount()
  expect(alCambiarValidez).toHaveBeenLastCalledWith(true)
})

it("mantiene salida 160 ms sin controles accesibles y cancela al desmontar", async () => {
  jest.useFakeTimers()
  const props = { unidad: "kg" as const, valor: 10, cambiar: jest.fn(), alListo: jest.fn() }
  await render(<BarraAjuste {...props} />)
  await screen.rerender(<BarraAjuste {...props} visible={false} />)
  expect(screen.queryByRole("button", { name: "Aumentar" })).toBeNull()
  expect(
    screen.getByTestId("barra-ajuste", { includeHiddenElements: true }).props.pointerEvents,
  ).toBe("none")
  await act(() => jest.advanceTimersByTime(159))
  expect(screen.getByTestId("barra-ajuste", { includeHiddenElements: true })).toBeOnTheScreen()
  await act(() => jest.advanceTimersByTime(1))
  expect(screen.queryByTestId("barra-ajuste", { includeHiddenElements: true })).toBeNull()
})

it("en cantidades usa number-pad y rechaza fracciones", async () => {
  const cambiar = jest.fn()
  await render(<BarraAjuste unidad="reps" valor={8} cambiar={cambiar} alListo={jest.fn()} />)
  await fireEvent.press(screen.getByRole("button", { name: "Escribir REPS: 8" }))
  const campo = screen.getByLabelText("Valor manual REPS")
  expect(campo.props.keyboardType).toBe("number-pad")
  await fireEvent.changeText(campo, "2.5")
  expect(cambiar).not.toHaveBeenCalled()
  await fireEvent.changeText(campo, "12")
  expect(cambiar).toHaveBeenCalledWith(12)
})

it("sincroniza la entrada manual al ajustar con ±, incluso después de texto inválido", async () => {
  await render(<Controlada valor={20} />)
  await fireEvent.press(screen.getByRole("button", { name: "Escribir KG: 20" }))
  const campo = screen.getByLabelText("Valor manual KG")
  await fireEvent.changeText(campo, "22,5")
  await fireEvent.press(screen.getByRole("button", { name: "Aumentar" }))
  expect(campo.props.value).toBe("25")
  await fireEvent.changeText(campo, "valor inválido")
  await fireEvent.press(screen.getByRole("button", { name: "Disminuir" }))
  expect(campo.props.value).toBe("22,5")
  expect(screen.getByRole("button", { name: "Listo" })).toBeEnabled()
})

it("sube sobre el teclado y retira sus suscripciones al desmontar", async () => {
  const eventos = new Map<string, (evento: KeyboardEvent) => void>()
  const quitar = jest.fn()
  jest.spyOn(Keyboard, "addListener").mockImplementation((nombre, escuchar) => {
    eventos.set(nombre, escuchar)
    return { remove: quitar } as unknown as ReturnType<typeof Keyboard.addListener>
  })
  await render(<Controlada />)
  await act(() =>
    eventos.get("keyboardDidShow")?.({
      endCoordinates: { screenY: 400, height: 400 },
    } as KeyboardEvent),
  )
  expect(StyleSheet.flatten(screen.getByTestId("barra-ajuste").props.style).bottom).toBeGreaterThan(
    20,
  )
  await act(() => eventos.get("keyboardDidHide")?.({} as KeyboardEvent))
  expect(StyleSheet.flatten(screen.getByTestId("barra-ajuste").props.style).bottom).toBe(20)
  await screen.unmount()
  expect(quitar).toHaveBeenCalledTimes(4)
})

it("RIR reutiliza sus seis chips y mantiene Listo accesible", async () => {
  const cambiar = jest.fn()
  await render(
    <BarraAjuste unidad="rir" valor={0} objetivo={3} cambiar={cambiar} alListo={jest.fn()} />,
  )
  await fireEvent.press(screen.getByRole("radio", { name: "RIR 5 o más" }))
  expect(cambiar).toHaveBeenCalledWith(5)
  expect(screen.getByRole("button", { name: "Listo" })).toBeEnabled()
})

it.each([
  [999.75, 1],
  [12.5, 1.8],
  [999.75, 1.8],
])("adapta %s con fuente %s al ancho de 360 sin truncar el valor", async (valor, fontScale) => {
  const window = Dimensions.get("window")
  const screenSize = Dimensions.get("screen")
  try {
    await act(() => Dimensions.set({ window: { ...window, width: 360, fontScale } }))
    await render(<Controlada valor={valor} />)
    const completo = String(valor).replace(".", ",")
    const cifra = screen.getByText(completo)
    expect(cifra.props).toMatchObject({ numberOfLines: 1, adjustsFontSizeToFit: true })
    expect(cifra.props.minimumFontScale).toBeGreaterThan(0)
    expect(cifra.props.minimumFontScale).toBeLessThan(1)
    expect(cifra).toHaveStyle({ width: "100%" })
    const escribir = screen.getByRole("button", { name: `Escribir KG: ${completo}` })
    expect(escribir).toHaveStyle({ width: "100%" })
    await fireEvent.press(escribir)
    expect(screen.getByLabelText("Valor manual KG")).toHaveStyle({ width: "100%" })
    expect(screen.getByLabelText("Valor manual KG").props.value).toBe(completo)
  } finally {
    await act(() => Dimensions.set({ window, screen: screenSize }))
  }
})

it("mantiene el marcador habitual para cifras cortas con fuente normal", async () => {
  const window = Dimensions.get("window")
  const screenSize = Dimensions.get("screen")
  try {
    await act(() => Dimensions.set({ window: { ...window, fontScale: 1 } }))
    await render(<Controlada valor={60} />)
    expect(screen.queryByTestId("ajuste-cifra-adaptable")).toBeNull()
    expect(screen.getByRole("button", { name: "Escribir KG: 60" })).toBeOnTheScreen()
  } finally {
    await act(() => Dimensions.set({ window, screen: screenSize }))
  }
})

it("sincroniza un cambio externo del valor manteniendo abierto el teclado", async () => {
  const props = { unidad: "kg" as const, valor: 60, cambiar: jest.fn(), alListo: jest.fn() }
  await render(<BarraAjuste {...props} />)
  await fireEvent.press(screen.getByRole("button", { name: "Escribir KG: 60" }))
  await screen.rerender(<BarraAjuste {...props} valor={80} />)
  expect(screen.getByLabelText("Valor manual KG").props.value).toBe("80")
})

it("preserva la coma decimal parcial cuando el cambio procede de la entrada manual", async () => {
  await render(<Controlada valor={60} />)
  await fireEvent.press(screen.getByRole("button", { name: "Escribir KG: 60" }))
  await fireEvent.changeText(screen.getByLabelText("Valor manual KG"), "0,")
  expect(screen.getByLabelText("Valor manual KG").props.value).toBe("0,")
})
