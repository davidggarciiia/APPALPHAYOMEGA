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
  return { SemanaEntrenamiento: () => <Text>Calendario visible</Text> }
})
jest.mock("./plan/plan-cliente", () => {
  const Text = jest.requireActual<typeof import("react-native")>("react-native").Text
  return { PlanCliente: ({ pestana }: { pestana: string }) => <Text>Plan visible: {pestana}</Text> }
})

it("abre el calendario del cliente y conserva el acceso al plan", async () => {
  await render(<MiEntrenamiento />)
  expect(screen.getByText("Calendario visible")).toBeTruthy()
  await fireEvent.press(screen.getByRole("tab", { name: "Rutina" }))
  expect(screen.getByText("Plan visible: rutina")).toBeTruthy()
  await fireEvent.press(screen.getByRole("tab", { name: "Bloque" }))
  expect(screen.getByText("Plan visible: bloque")).toBeTruthy()
  await fireEvent.press(screen.getByRole("tab", { name: "Guía" }))
  expect(screen.getByText("Plan visible: guia")).toBeTruthy()
  await fireEvent.press(screen.getByRole("tab", { name: "Semana" }))
  expect(screen.getByText("Calendario visible")).toBeTruthy()
})
