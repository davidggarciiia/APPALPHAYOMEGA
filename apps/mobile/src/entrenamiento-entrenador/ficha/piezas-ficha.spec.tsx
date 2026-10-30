import { act, fireEvent, render, screen } from "@testing-library/react-native"
import { AccessibilityInfo, Dimensions } from "react-native"
import { cancelAnimation, withRepeat, withTiming } from "react-native-reanimated"
import type { ListadoSesiones, Molestia, PlanVigente } from "@alpha-omega/shared"

import { BarraDeBloque } from "./barra-bloque"
import { TarjetaDeAccion } from "./tarjeta-accion"
import { TiraSemana } from "./tira-semana"

jest.mock("react-native-reanimated", () => ({
  ...jest.requireActual("react-native-reanimated/mock"),
  useSharedValue: (value: number) =>
    jest.requireActual<typeof import("react")>("react").useRef({ value }).current,
  withTiming: jest.fn((valor: number) => valor),
  withRepeat: jest.fn((valor: unknown) => valor),
  withDelay: jest.fn((_retraso: number, animacion: unknown) => animacion),
  cancelAnimation: jest.fn(),
}))

afterEach(() => jest.restoreAllMocks())

const plan: PlanVigente = {
  id: "plan",
  nombre: "Mes 2",
  semanaInicial: "2026-10-26",
  semanas: 4,
  version: 1,
  bloque: {
    objetivos: [],
    notas: [],
    deportes: [{ nombre: "K-1", dias: [4, 7], minutos: 60 }],
    fases: [
      { desde: 1, hasta: 2, nombre: "Calibrar", detalle: null },
      {
        desde: 3,
        hasta: 3,
        nombre: "Intensificación",
        detalle: null,
        ajustes: { factorCarga: 1.05 },
      },
      { desde: 4, hasta: 4, nombre: "Descarga", detalle: null, ajustes: { factorCarga: 0.8 } },
    ],
  },
}

const semana: ListadoSesiones = {
  total: 5,
  sesiones: ["2026-10-26", "2026-10-27", "2026-10-28", "2026-10-30", "2026-10-31"].map(
    (fecha, i) => ({
      agenda: {
        id: `sesion-${i}`,
        clienteId: "cliente",
        fechaOriginal: fecha,
        fechaActual: fecha,
        estado: "abierta",
        revision: 0,
      },
      nombre: ["Empuje", "Pierna", "Tracción", "Empuje", "Pierna"][i]!,
      enviadoEn: i < 3 ? `${fecha}T12:00:00Z` : null,
    }),
  ),
}

it("marca solo fases con ajustes y nombra las semanas completas para lectores", async () => {
  await render(<BarraDeBloque plan={plan} lunes="2026-10-26" />)
  expect(screen.getByRole("image")).toHaveAccessibilityValue({ now: 1, min: 1, max: 4 })
  expect(screen.getByRole("image").props.accessibilityLabel).toContain(
    "semana 3 es de intensificación",
  )
  expect(screen.getByText("S1")).toBeOnTheScreen()
  expect(screen.getByText("S3 · Intensificación")).toBeOnTheScreen()
  expect(screen.getByText("S4 · Descarga")).toBeOnTheScreen()
  expect(screen.getByTestId("bloque-semana-1")).not.toHaveStyle({ borderStyle: "dashed" })
  expect(screen.getByTestId("bloque-semana-3")).toHaveStyle({ borderStyle: "dashed" })
})

it("muestra la numeración real de las fases y el ajuste sin repetir semana ni puntos", async () => {
  const fases = [
    { desde: 1, hasta: 1, nombre: "Semana 5 · Doble progresión", detalle: null },
    {
      desde: 2,
      hasta: 2,
      nombre: "Semana 6 · Estímulo",
      detalle: null,
      ajustes: { factorCarga: 1.05 },
    },
    {
      desde: 3,
      hasta: 3,
      nombre: "Semana 7 · Descarga",
      detalle: null,
      ajustes: { factorCarga: 0.8 },
    },
    { desde: 4, hasta: 4, nombre: "Semana 8 · Vuelta", detalle: null },
  ]
  await render(
    <BarraDeBloque plan={{ ...plan, bloque: { ...plan.bloque!, fases } }} lunes="2026-11-02" />,
  )
  for (const etiqueta of ["S5", "S6 · Estímulo", "S7 · Descarga", "S8"]) {
    expect(screen.getByText(etiqueta)).toBeOnTheScreen()
  }
  expect(screen.getByTestId("bloque-semana-2")).toHaveStyle({ borderStyle: "dashed" })
  expect(screen.getByTestId("bloque-semana-3")).toHaveStyle({ borderStyle: "dashed" })
  expect(screen.getByTestId("bloque-semana-4")).not.toHaveStyle({ borderStyle: "dashed" })
  expect(screen.getByRole("image").props.accessibilityLabel).toContain("semana 6 es de estímulo")
  expect(screen.getByRole("image")).toHaveAccessibilityValue({ now: 2, min: 1, max: 4 })
})

it("conserva la marca del ajuste cuando la fase solo nombra la semana", async () => {
  await render(
    <BarraDeBloque
      plan={{
        ...plan,
        bloque: {
          ...plan.bloque!,
          fases: [
            {
              desde: 1,
              hasta: 4,
              nombre: "Semana 5",
              detalle: null,
              ajustes: { factorCarga: 0.9 },
            },
          ],
        },
      }}
      lunes="2026-10-26"
    />,
  )
  expect(screen.getByText("S5 · Ajuste")).toBeOnTheScreen()
  expect(screen.getByText("S6 · Ajuste")).toBeOnTheScreen()
  expect(screen.getByTestId("bloque-semana-1")).toHaveStyle({ borderStyle: "dashed" })
  expect(screen.getByRole("image").props.accessibilityLabel).toContain("semana 5 es de ajuste")
})

it("no anima la barra con movimiento reducido ni reinicia el relleno en un refresco", async () => {
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(true)
  await render(<BarraDeBloque plan={plan} lunes="2026-11-02" />)
  expect(withTiming).not.toHaveBeenCalled()
  expect(withRepeat).not.toHaveBeenCalled()
  await screen.unmount()
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(false)
  await render(<BarraDeBloque plan={plan} lunes="2026-11-02" />)
  expect(withRepeat).toHaveBeenCalledTimes(1)
  jest.mocked(withTiming).mockClear()
  await screen.rerender(<BarraDeBloque plan={{ ...plan }} lunes="2026-11-02" />)
  expect(withTiming).not.toHaveBeenCalled()
})

it("detiene el pulso mientras hay una hoja y lo retoma sin repetir el relleno", async () => {
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(false)
  await render(<BarraDeBloque plan={plan} lunes="2026-11-02" />)
  jest.mocked(cancelAnimation).mockClear()
  jest.mocked(withRepeat).mockClear()
  jest.mocked(withTiming).mockClear()
  await screen.rerender(<BarraDeBloque plan={plan} lunes="2026-11-02" pausada />)
  expect(cancelAnimation).toHaveBeenCalled()
  expect(withRepeat).not.toHaveBeenCalled()
  expect(withTiming).not.toHaveBeenCalled()
  await screen.rerender(<BarraDeBloque plan={plan} lunes="2026-11-02" pausada={false} />)
  expect(withRepeat).toHaveBeenCalledTimes(1)
  expect(withTiming).not.toHaveBeenCalledWith(1, expect.objectContaining({ duration: 400 }))
})

it("la tira cuenta envíos sin revisión y distingue días pendientes, no hechos y descanso con K-1", async () => {
  const abrirSesion = jest.fn()
  const molestias = [{ sesionId: "sesion-1", estado: "abierta" }] as Molestia[]
  await render(
    <TiraSemana
      semana={semana}
      molestias={molestias}
      plan={plan}
      lunes="2026-10-26"
      hoy="2026-10-30"
      abrirSesion={abrirSesion}
    />,
  )
  expect(screen.getByText("3 de 5 hechas")).toBeOnTheScreen()
  expect(screen.queryAllByLabelText(/revis/i)).toHaveLength(0)
  const lunes = screen.getByRole("button", { name: "Lunes 26, Empuje: hecha." })
  await fireEvent.press(lunes)
  expect(abrirSesion).toHaveBeenCalledWith("sesion-0")
  expect(
    screen.getByRole("button", { name: /Martes 27.*hecha.*molestia abierta/ }),
  ).toBeOnTheScreen()
  expect(screen.getByRole("button", { name: /Viernes 30.*pendiente/ })).toBeSelected()
  expect(screen.getByLabelText("Jueves 29, sin fuerza. Además K-1.")).toBeOnTheScreen()
  expect(screen.getAllByText("K-1")).toHaveLength(2)
  await screen.rerender(
    <TiraSemana
      semana={semana}
      molestias={[]}
      plan={plan}
      lunes="2026-10-26"
      hoy="2026-11-01"
      abrirSesion={abrirSesion}
    />,
  )
  expect(screen.getByRole("button", { name: /Viernes 30.*no hecha/ })).toBeOnTheScreen()
})

it("el botón de tarjeta transmite la acción y no escribe cuando está deshabilitado", async () => {
  const onPress = jest.fn()
  await render(
    <TarjetaDeAccion
      titulo="Hombro · 7 de 10"
      detalle="Press inclinado · serie 2"
      accion="Responder"
      onPress={onPress}
      principal
      deshabilitado
    />,
  )
  const boton = screen.getByRole("button", { name: "Responder: Hombro · 7 de 10" })
  expect(boton).toBeDisabled()
  await act(() => fireEvent.press(boton))
  expect(onPress).not.toHaveBeenCalled()
})

it("con texto grande conserva los siete días en celdas de 56 y permite desplazarlos", async () => {
  const anterior = Dimensions.get("window")
  try {
    await act(() => Dimensions.set({ window: { ...anterior, width: 360, fontScale: 1.5 } }))
    await render(
      <TiraSemana
        semana={semana}
        molestias={[]}
        plan={plan}
        lunes="2026-10-26"
        hoy="2026-10-30"
        abrirSesion={jest.fn()}
      />,
    )
    expect(screen.getByRole("button", { name: /Lunes 26/ })).toHaveStyle({ width: 56 })
    expect(screen.getByLabelText("Domingo 1, sin fuerza. Además K-1.")).toHaveStyle({ width: 56 })
    expect(screen.getAllByRole("button")).toHaveLength(5)
  } finally {
    await act(() => Dimensions.set({ window: anterior }))
  }
})
