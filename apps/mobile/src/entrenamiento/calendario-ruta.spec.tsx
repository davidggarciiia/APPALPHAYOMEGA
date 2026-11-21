import { fireEvent, render, screen } from "@testing-library/react-native"

import MiEntrenamiento from "../../app/entrenamiento/index"

jest.mock("expo-router", () => ({ useRouter: () => ({ push: jest.fn() }) }))
jest.mock("../sesion", () => ({
  useSesion: () => ({
    estado: { fase: "dentro", usuario: { id: "cliente", rol: "cliente" } },
    salir: jest.fn(),
    reintentar: jest.fn(),
  }),
}))
jest.mock("./use-entrenamiento", () => ({ useEntrenamiento: () => ({}) }))
jest.mock("./semana", () => {
  const Text = jest.requireActual<typeof import("react-native")>("react-native").Text
  return {
    SemanaEntrenamiento: ({
      semanaElegida,
      elegirSemana,
    }: {
      semanaElegida: string
      elegirSemana: (lunes: string) => void
    }) => (
      <>
        <Text>Calendario visible</Text>
        <Text>Semana en calendario: {semanaElegida}</Text>
        <Text accessibilityRole="button" onPress={() => elegirSemana("2026-12-07")}>
          Avanzar calendario
        </Text>
      </>
    ),
  }
})
jest.mock("./plan/plan-cliente", () => {
  const Text = jest.requireActual<typeof import("react-native")>("react-native").Text
  return {
    PlanCliente: ({ pestana, semanaElegida }: { pestana: string; semanaElegida: string }) => (
      <Text>
        Plan visible: {pestana} · {semanaElegida}
      </Text>
    ),
  }
})

it("abre el calendario del cliente y conserva el acceso al plan", async () => {
  await render(<MiEntrenamiento />)
  expect(screen.getByText("Calendario visible")).toBeTruthy()
  await fireEvent.press(screen.getByRole("tab", { name: "Rutina" }))
  expect(screen.getByText(/^Plan visible: rutina/)).toBeTruthy()
  expect(screen.queryByRole("tab", { name: "Bloque" })).toBeNull()
  await fireEvent.press(screen.getByRole("tab", { name: "Guía" }))
  expect(screen.getByText(/^Plan visible: guia/)).toBeTruthy()
  await fireEvent.press(screen.getByRole("tab", { name: "Semana" }))
  expect(screen.getByText("Calendario visible")).toBeTruthy()
})

it("la ruta del cliente ofrece Semana, Rutina y Guía sin pestaña Bloque", async () => {
  await render(<MiEntrenamiento />)
  expect(screen.getByRole("tab", { name: "Semana" })).toBeOnTheScreen()
  expect(screen.getByRole("tab", { name: "Rutina" })).toBeOnTheScreen()
  expect(screen.getByRole("tab", { name: "Guía" })).toBeOnTheScreen()
  expect(screen.queryByRole("tab", { name: "Bloque" })).toBeNull()
})

it("la semana elegida en Semana es la que enseña Rutina y al revés", async () => {
  await render(<MiEntrenamiento />)
  await fireEvent.press(screen.getByRole("button", { name: "Avanzar calendario" }))
  expect(screen.getByText("Semana en calendario: 2026-12-07")).toBeTruthy()
  await fireEvent.press(screen.getByRole("tab", { name: "Rutina" }))
  expect(screen.getByText("Plan visible: rutina · 2026-12-07")).toBeTruthy()
  await fireEvent.press(screen.getByRole("tab", { name: "Semana" }))
  expect(screen.getByText("Semana en calendario: 2026-12-07")).toBeTruthy()
})
