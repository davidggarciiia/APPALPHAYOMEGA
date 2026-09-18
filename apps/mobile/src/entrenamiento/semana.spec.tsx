import { AppState } from "react-native"
import { fireEvent, render, screen } from "@testing-library/react-native"
import { SemanaEntrenamiento } from "./semana"
import { crearApiEntrenamiento } from "./api"
import { crearPeticionAutenticada } from "../lib/peticion-autenticada"
import { fechaLegible, lunesDeSemana, sumarDias } from "./fechas"

jest.mock("expo-router", () => ({
  useFocusEffect: (efecto: () => void) =>
    jest.requireActual<typeof import("react")>("react").useEffect(efecto, [efecto]),
}))
jest.mock("./almacen-dispositivo", () => ({ almacenDispositivo: {} }))
jest.mock("../lib/direccion-api", () => ({ direccionDeLaApi: () => "http://localhost:3000" }))

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
  await screen.findByRole("button", { name: "Abrir Fuerza" })
  await fireEvent.press(screen.getByRole("button", { name: `${fechaLegible(lunes)} · 0 sesiones` }))
  expect(screen.queryByRole("button", { name: "Abrir Fuerza" })).toBeNull()
  await fireEvent.press(
    screen.getByRole("button", { name: `${fechaLegible(martes)} · 1 sesiones` }),
  )
  await fireEvent.press(screen.getByRole("button", { name: "Abrir Fuerza" }))
  expect(abrir).toHaveBeenCalledWith("10000000-0000-4000-8000-000000000000")
  consultar.mockResolvedValue({ sesiones: [], total: 0 })
  await fireEvent.press(screen.getByRole("button", { name: "Semana siguiente" }))
  expect(await screen.findByText("No hay entrenamientos asignados esta semana.")).toBeOnTheScreen()
  expect(screen.queryByRole("button", { name: "Ver toda la semana" })).toBeNull()
})
