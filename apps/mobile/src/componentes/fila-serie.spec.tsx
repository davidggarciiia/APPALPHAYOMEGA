import { fireEvent, render, screen, userEvent, within } from "@testing-library/react-native"
import { useState } from "react"
import { AccessibilityInfo, StyleSheet } from "react-native"
import { cancelAnimation, withTiming } from "react-native-reanimated"
import * as Reanimated from "react-native-reanimated"

import { tema } from "../tema"
import { FilaSerie } from "./fila-serie"
import { vibrar } from "./botones"

jest.mock("./botones", () => ({ vibrar: jest.fn() }))
jest.mock("react-native-reanimated", () => {
  const doble = jest.requireActual<typeof import("react-native-reanimated")>(
    "react-native-reanimated/mock",
  )
  return {
    ...doble,
    cancelAnimation: jest.fn(doble.cancelAnimation),
    withTiming: jest.fn(doble.withTiming),
    interpolateColor: (valor: number, _entrada: number[], salida: string[]) =>
      salida[valor >= 1 ? 1 : 0],
  }
})

afterEach(() => {
  jest.useRealTimers()
  jest.restoreAllMocks()
})

const props = {
  numero: 1,
  etiqueta: "Sentadilla",
  cantidadSugerida: 8,
  pesoSugerido: 60,
  rirObjetivo: 3,
  tipoMedicion: "repeticiones" as const,
  tipoCarga: "conCargaExterna" as const,
  modoRir: "cadaSerie" as const,
  alEnfocar: jest.fn(),
  alCambiarHecha: jest.fn(),
}

it("espera a que el padre acepte la serie antes de anunciar éxito", async () => {
  await render(<FilaSerie {...props} />)
  await fireEvent.press(screen.getByRole("checkbox"))
  expect(props.alCambiarHecha).toHaveBeenCalledWith(true)
  expect(vibrar).not.toHaveBeenCalled()
  // Una validación puede rechazar el marcado y mantener la misma fila pendiente.
  await screen.rerender(<FilaSerie {...props} />)
  expect(vibrar).not.toHaveBeenCalled()
  await screen.rerender(<FilaSerie {...props} hecha />)
  expect(vibrar).toHaveBeenCalledTimes(1)
  expect(vibrar).toHaveBeenCalledWith("exito")
  await screen.rerender(<FilaSerie {...props} hecha enfocada="peso" />)
  expect(vibrar).toHaveBeenCalledTimes(1)
})

it("al marcar dos filas seguidas termina la fase de la primera antes de animar la segunda", async () => {
  // El doble oficial recrea el objeto; en nativo useSharedValue conserva su identidad.
  const crearCompartido = Reanimated.useSharedValue
  jest.spyOn(Reanimated, "useSharedValue").mockImplementation(function useCompartidoEstable(valor) {
    return useState(() => crearCompartido(valor))[0]
  })
  const filas = (primera: boolean, segunda: boolean): React.JSX.Element => (
    <>
      <FilaSerie {...props} numero={1} hecha={primera} />
      <FilaSerie {...props} numero={2} hecha={segunda} />
    </>
  )
  await render(filas(false, false))
  jest.mocked(cancelAnimation).mockClear()
  await screen.rerender(filas(true, false))
  const fasePrimera = jest.mocked(cancelAnimation).mock.calls[0]![0]
  expect(fasePrimera.value).toBe(1)
  jest.mocked(cancelAnimation).mockClear()
  await screen.rerender(filas(true, true))
  expect(jest.mocked(cancelAnimation).mock.calls.some(([fase]) => fase === fasePrimera)).toBe(true)
  expect(fasePrimera.value).toBe(1)
  await screen.unmount()
  jest.mocked(cancelAnimation).mockClear()
  await render(<FilaSerie {...props} />)
  await screen.rerender(<FilaSerie {...props} hecha />)
  expect(jest.mocked(cancelAnimation).mock.calls.some(([fase]) => fase === fasePrimera)).toBe(false)
})

it("muestra sugerencias, conserva cero y enfoca celdas sin campos de teclado", async () => {
  await render(<FilaSerie {...props} peso={0} cantidad={null} />)
  expect(screen.getByText("0")).toBeOnTheScreen()
  expect(screen.getByText("8")).toHaveStyle({ color: tema.marcador })
  await fireEvent.press(screen.getByRole("button", { name: /Peso — Sentadilla/ }))
  expect(props.alEnfocar).toHaveBeenCalledWith("peso")
  expect(screen.queryAllByRole("textbox")).toHaveLength(0)
})

it("deja el contenedor de la fila sin rol de botón ni parada de teclado redundante", async () => {
  await render(<FilaSerie {...props} />)
  const fila = screen.getByLabelText("Serie 1 — Sentadilla")
  expect(fila.props.accessibilityRole).toBe("none")
  expect(fila.props.tabIndex).toBe(-1)
  expect(screen.getAllByRole("button")).toHaveLength(3)
  expect(screen.getByRole("checkbox", { name: "Hecha — Sentadilla, serie 1" })).toBeOnTheScreen()
})

it("quita columnas según tipo de carga y modo RIR", async () => {
  await render(<FilaSerie {...props} tipoCarga="sinCarga" modoRir="alFinalizarEjercicio" />)
  expect(screen.queryByRole("button", { name: /Peso —/ })).toBeNull()
  expect(screen.queryByRole("button", { name: /RIR —/ })).toBeNull()
  expect(screen.getByRole("button", { name: /Repeticiones —/ })).toBeOnTheScreen()
})

it("marca y desmarca mediante callbacks con háptica solo al completar", async () => {
  await render(<FilaSerie {...props} />)
  const check = screen.getByRole("checkbox", { name: "Hecha — Sentadilla, serie 1" })
  await fireEvent.press(check)
  expect(props.alCambiarHecha).toHaveBeenCalledWith(true)
  await screen.rerender(<FilaSerie {...props} hecha />)
  expect(vibrar).toHaveBeenCalledWith("exito")
  expect(screen.getByRole("checkbox")).toBeChecked()
  expect(screen.getByTestId("fila-serie")).toHaveStyle({ backgroundColor: tema.exitoFila })
  await fireEvent.press(screen.getByRole("checkbox"))
  expect(props.alCambiarHecha).toHaveBeenLastCalledWith(false)
  expect(vibrar).toHaveBeenCalledTimes(1)
})

it("ofrece omitir tras 500 ms, recuperación al tocar y acciones para lector", async () => {
  jest.useFakeTimers()
  const alOmitir = jest.fn(),
    alRecuperar = jest.fn()
  await render(<FilaSerie {...props} alOmitir={alOmitir} alRecuperar={alRecuperar} />)
  await userEvent
    .setup()
    .longPress(screen.getByLabelText("Serie 1 — Sentadilla"), { duration: 500 })
  expect(alOmitir).toHaveBeenCalledTimes(1)
  const celda = screen.getByRole("button", { name: /Peso —/ })
  await userEvent.setup().longPress(celda, { duration: 500 })
  expect(alOmitir).toHaveBeenCalledTimes(2)
  expect(vibrar).toHaveBeenCalledWith("aviso")
  await screen.rerender(
    <FilaSerie {...props} omitida alOmitir={alOmitir} alRecuperar={alRecuperar} />,
  )
  expect(screen.getByTestId("fila-serie")).toHaveStyle({ opacity: 0.5 })
  await fireEvent.press(screen.getByLabelText("Serie 1 — Sentadilla, omitida"))
  expect(alRecuperar).toHaveBeenCalledTimes(1)
  await fireEvent.press(screen.getByRole("button", { name: /Peso —/ }))
  expect(alRecuperar).toHaveBeenCalledTimes(2)
  await fireEvent(screen.getByRole("checkbox"), "accessibilityAction", {
    nativeEvent: { actionName: "recuperar" },
  })
  expect(alRecuperar).toHaveBeenCalledTimes(3)
})

it("distingue foco y RIR bajo, con objetivos táctiles de 44", async () => {
  await render(<FilaSerie {...props} enfocada="peso" rir={1} />)
  expect(screen.getByRole("button", { name: /Peso —/ })).toHaveStyle({ borderColor: tema.acento })
  const rir = screen.getByRole("button", {
    name: /RIR — Sentadilla, serie 1: 1, por debajo del objetivo/,
  })
  expect(within(rir).getByText("1")).toHaveStyle({ color: tema.aviso })
  expect(rir.props.accessibilityHint).toContain("ajuste")
  for (const boton of [...screen.getAllByRole("button"), screen.getByRole("checkbox")]) {
    expect(StyleSheet.flatten(boton.props.style).minHeight).toBeGreaterThanOrEqual(44)
  }
})

it("bloquea edición, marcado, omisión y recuperación", async () => {
  const alOmitir = jest.fn()
  await render(<FilaSerie {...props} deshabilitado alOmitir={alOmitir} />)
  await fireEvent.press(screen.getByRole("checkbox"))
  await fireEvent(screen.getByRole("button", { name: /Peso —/ }), "longPress")
  expect(props.alCambiarHecha).not.toHaveBeenCalled()
  expect(alOmitir).not.toHaveBeenCalled()
})

it("no reproduce la finalización al montar hecha ni al resolver reducir movimiento", async () => {
  await render(<FilaSerie {...props} hecha />)
  expect(withTiming).not.toHaveBeenCalled()
  await screen.rerender(<FilaSerie {...props} />)
  expect(withTiming).toHaveBeenCalledWith(0, expect.objectContaining({ duration: 120 }))
  await screen.rerender(<FilaSerie {...props} hecha />)
  expect(withTiming).toHaveBeenCalledWith(1, expect.objectContaining({ duration: 220 }))
})

it("con movimiento reducido cambia al instante y mantiene la háptica de completar", async () => {
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(true)
  await render(<FilaSerie {...props} />)
  await fireEvent.press(screen.getByRole("checkbox"))
  await screen.rerender(<FilaSerie {...props} hecha />)
  expect(withTiming).not.toHaveBeenCalled()
  expect(screen.queryByTestId("serie-destello", { includeHiddenElements: true })).toBeNull()
  expect(vibrar).toHaveBeenCalledWith("exito")
})

it.each([false, true])(
  "muestra la mejora de récord sin ocultarla al reducir movimiento (%s)",
  async (reducido) => {
    jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(reducido)
    await render(<FilaSerie {...props} />)
    await screen.rerender(<FilaSerie {...props} hecha recordPersonal="+2,5 kg" />)
    expect(screen.getByLabelText("Récord personal: +2,5 kg")).toHaveStyle({ color: tema.acento })
    expect(screen.getByText("+2,5 kg")).toHaveProp("accessibilityLiveRegion", "polite")
    if (reducido) expect(withTiming).not.toHaveBeenCalled()
  },
)

it("permite deshacer y remarcar sin repetir el destello del récord", async () => {
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(false)
  await render(<FilaSerie {...props} />)
  await screen.rerender(<FilaSerie {...props} hecha recordPersonal="+2 reps" />)
  expect(withTiming).toHaveBeenCalledWith(1, expect.objectContaining({ duration: 420 }))
  jest.mocked(withTiming).mockClear()
  await screen.rerender(<FilaSerie {...props} destelloAlCompletar={false} />)
  expect(screen.queryByLabelText(/^Récord personal:/)).toBeNull()
  await screen.rerender(<FilaSerie {...props} hecha destelloAlCompletar={false} />)
  expect(withTiming).not.toHaveBeenCalledWith(1, expect.objectContaining({ duration: 420 }))
  expect(screen.getByRole("checkbox")).toBeChecked()
})
