import { fireEvent, render, screen } from "@testing-library/react-native"

import { ErrorDeRed } from "../lib/api"
import { reserva, saldo, SIN_SALDO } from "./pruebas/datos"
import { ProximaCita } from "./proxima-cita"

const mockPush = jest.fn()
jest.mock("expo-router", () => {
  const { useEffect } = jest.requireActual<typeof import("react")>("react")
  return {
    useFocusEffect: (efecto: () => void) => useEffect(efecto, [efecto]),
    useRouter: () => ({ push: mockPush }),
  }
})

function api(proximas: ReturnType<typeof reserva>[], resumen = saldo()) {
  return {
    misReservas: jest.fn(async () => ({ proximas, pasadas: [] })),
    miSaldo: jest.fn(async () => resumen),
  }
}

beforeEach(() => mockPush.mockClear())

it("enseña la próxima reserva con su día y su hora de Madrid, y abre Reservar", async () => {
  await render(<ProximaCita api={api([reserva()])} />)

  const tarjeta = await screen.findByRole("button", {
    name: "Tu próxima cita: Jueves 8 de octubre, 10:00 – 11:00, EP individual. Abre tus reservas",
  })
  fireEvent.press(tarjeta)
  expect(mockPush).toHaveBeenCalledWith("/reservar")
})

it("sin reservas invita a reservar y dice cuántas sesiones le quedan", async () => {
  await render(<ProximaCita api={api([])} />)
  expect(
    await screen.findByRole("button", { name: "Reserva tu próxima sesión. Te quedan 2 sesiones" }),
  ).toBeTruthy()
})

it("sin saldo no promete sesiones", async () => {
  await render(<ProximaCita api={api([], SIN_SALDO)} />)
  expect(await screen.findByText("Elige un hueco con tu entrenador.")).toBeTruthy()
})

it("si falla la carga no ocupa sitio en el inicio", async () => {
  const fallida = {
    misReservas: jest.fn(async () => Promise.reject(new ErrorDeRed())),
    miSaldo: jest.fn(async () => saldo()),
  }
  await render(<ProximaCita api={fallida} />)
  await Promise.resolve()
  expect(screen.queryByRole("button")).toBeNull()
})
