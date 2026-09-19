import { AppState } from "react-native"
import { act, fireEvent, render, screen } from "@testing-library/react-native"
import { SemanaEntrenamiento } from "./semana"
import { crearApiEntrenamiento } from "./api"
import { crearPeticionAutenticada } from "../lib/peticion-autenticada"
import { fechaLegible, lunesDeSemana, sumarDias } from "./fechas"
import { AgendaSemanal } from "./agenda-semanal"

jest.mock("expo-router", () => ({
  useFocusEffect: (efecto: () => void) =>
    jest.requireActual<typeof import("react")>("react").useEffect(efecto, [efecto]),
}))
jest.mock("./almacen-dispositivo", () => ({ almacenDispositivo: {} }))
jest.mock("../lib/direccion-api", () => ({ direccionDeLaApi: () => "http://localhost:3000" }))

it("separa los resultados enviados de los pendientes en el inicio", async () => {
  const lunes = lunesDeSemana()
  const agenda = {
    clienteId: "cliente",
    fechaOriginal: lunes,
    fechaActual: lunes,
    estado: "abierta" as const,
    revision: 0,
  }
  const abrir = jest.fn()
  await render(
    <AgendaSemanal
      semana={lunes}
      resumenHoy
      cambiarSemana={jest.fn()}
      abrir={abrir}
      listado={{
        total: 2,
        sesiones: [
          { agenda: { ...agenda, id: "pendiente" }, nombre: "Sesión pendiente", enviadoEn: null },
          {
            agenda: { ...agenda, id: "enviado", estado: "cerrada" },
            nombre: "Sesión enviada",
            enviadoEn: "2026-09-14T10:00:00Z",
          },
        ],
      }}
    />,
  )
  expect(screen.getByRole("header", { name: "Últimos entrenos de la semana" })).toBeOnTheScreen()
  await fireEvent.press(
    screen.getByRole("button", { name: `Abrir Sesión enviada, ${fechaLegible(lunes)}, enviado` }),
  )
  expect(abrir).toHaveBeenCalledWith("enviado")
})

it("filtra por la fecha actual, abre la sesión y limpia el filtro al cambiar semana", async () => {
  AppState.currentState = "active"
  const lunes = lunesDeSemana()
  const martes = sumarDias(lunes, 1)
  const api = crearApiEntrenamiento(crearPeticionAutenticada(() => "token"))
  const abrir = jest.fn()
  const consultar = jest.spyOn(api, "semana").mockResolvedValue({
    sesiones: [
      {
        agenda: {
          id: "10000000-0000-4000-8000-000000000000",
          clienteId: "20000000-0000-4000-8000-000000000000",
          fechaOriginal: lunes,
          fechaActual: martes,
          estado: "abierta",
          revision: 1,
        },
        nombre: "Fuerza",
        enviadoEn: null,
      },
    ],
    total: 1,
  })
  await render(<SemanaEntrenamiento clienteId="cliente" api={api} abrir={abrir} />)
  await screen.findByRole("button", { name: `Abrir Fuerza, ${fechaLegible(martes)}, pendiente` })
  await fireEvent.press(screen.getByRole("button", { name: `${fechaLegible(lunes)} · 0 sesiones` }))
  expect(
    screen.queryByRole("button", { name: `Abrir Fuerza, ${fechaLegible(martes)}, pendiente` }),
  ).toBeNull()
  await fireEvent.press(
    screen.getByRole("button", { name: `${fechaLegible(martes)} · 1 sesiones` }),
  )
  await fireEvent.press(
    screen.getByRole("button", { name: `Abrir Fuerza, ${fechaLegible(martes)}, pendiente` }),
  )
  expect(abrir).toHaveBeenCalledWith("10000000-0000-4000-8000-000000000000")
  consultar.mockResolvedValue({ sesiones: [], total: 0 })
  await fireEvent.press(screen.getByRole("button", { name: "Semana siguiente" }))
  expect(await screen.findByText("No hay entrenamientos asignados esta semana.")).toBeOnTheScreen()
  expect(screen.queryByRole("button", { name: "Ver toda la semana" })).toBeNull()
})

it("el inicio sigue la semana actual al pasar de domingo a lunes", async () => {
  jest.useFakeTimers()
  jest.setSystemTime(new Date("2026-09-20T21:59:58Z"))
  AppState.currentState = "active"
  const api = crearApiEntrenamiento(crearPeticionAutenticada(() => "token"))
  const consultar = jest.spyOn(api, "semana").mockResolvedValue({ sesiones: [], total: 0 })
  const vista = await render(
    <SemanaEntrenamiento clienteId="cliente" api={api} abrir={jest.fn()} resumenHoy />,
  )
  expect(consultar).toHaveBeenLastCalledWith("cliente", "2026-09-14", expect.any(AbortSignal))
  await act(async () => {
    await jest.advanceTimersByTimeAsync(5000)
  })
  expect(consultar).toHaveBeenLastCalledWith("cliente", "2026-09-21", expect.any(AbortSignal))
  await vista.unmount()
  jest.useRealTimers()
})
