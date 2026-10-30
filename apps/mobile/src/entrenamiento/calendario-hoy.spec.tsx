import { act, fireEvent, render, screen } from "@testing-library/react-native"
import type { ListadoSesiones } from "@alpha-omega/shared"

import { CalendarioHoy } from "./calendario-hoy"
import { fechaLegible, lunesDeSemana } from "./fechas"
import { ErrorDePermiso, ErrorDeSesion } from "../lib/http"

jest.mock("../componentes/iconos", () => ({ Icono: () => null }))
let mockFoco = 0
jest.mock("expo-router", () => ({
  useFocusEffect: (efecto: () => void) =>
    jest.requireActual<typeof import("react")>("react").useEffect(efecto, [efecto, mockFoco]),
}))

const hoy = "2028-02-15"
const propiedades = {
  semana: lunesDeSemana(hoy),
  hoy,
  sesiones: [],
  deportes: [],
  empezadas: {},
  abrir: jest.fn(),
}

it("pinta febrero bisiesto completo y navega entre diciembre y enero", async () => {
  await render(<CalendarioHoy {...propiedades} />)
  await fireEvent.press(screen.getByRole("button", { name: "Ver mes" }))
  expect(
    screen.getByRole("button", { name: `${fechaLegible("2028-02-29")}: descanso` }),
  ).toBeOnTheScreen()
  expect(screen.queryByLabelText(/30 feb/)).toBeNull()
  await fireEvent.press(screen.getByRole("button", { name: "Mes anterior" }))
  expect(screen.getByRole("header", { name: "enero de 2028" })).toBeOnTheScreen()
  await fireEvent.press(screen.getByRole("button", { name: "Mes anterior" }))
  expect(screen.getByRole("header", { name: "diciembre de 2027" })).toBeOnTheScreen()
  await fireEvent.press(screen.getByRole("button", { name: "Mes siguiente" }))
  expect(screen.getByRole("header", { name: "enero de 2028" })).toBeOnTheScreen()
})

it("ignora la respuesta de un mes que ya no está seleccionado", async () => {
  let resolverFebrero!: (sesiones: ListadoSesiones["sesiones"]) => void
  let resolverMarzo!: (sesiones: ListadoSesiones["sesiones"]) => void
  const cargarMes = jest.fn(
    (mes: string) =>
      new Promise<ListadoSesiones["sesiones"]>((resolver) => {
        if (mes === "2028-02") resolverFebrero = resolver
        else resolverMarzo = resolver
      }),
  )
  await render(<CalendarioHoy {...propiedades} cargarMes={cargarMes} />)
  await fireEvent.press(screen.getByRole("button", { name: "Ver mes" }))
  expect(screen.getByRole("progressbar", { name: "Cargando mes" })).toBeOnTheScreen()
  expect(screen.queryByLabelText(/descanso/)).toBeNull()
  await fireEvent.press(screen.getByRole("button", { name: "Mes siguiente" }))
  await act(async () => resolverMarzo([]))
  expect(
    screen.getByRole("button", { name: `${fechaLegible("2028-03-31")}: descanso` }),
  ).toBeOnTheScreen()
  await act(async () => resolverFebrero([]))
  expect(
    screen.getByRole("button", { name: `${fechaLegible("2028-03-31")}: descanso` }),
  ).toBeOnTheScreen()
  expect(screen.queryByLabelText(/29 feb/)).toBeNull()
})

it("anuncia pendiente, en curso y hecha y prioriza la sesión en curso", async () => {
  const agenda = {
    clienteId: "cliente",
    fechaOriginal: hoy,
    fechaActual: hoy,
    estado: "abierta" as const,
    revision: 0,
  }
  const abrir = jest.fn()
  await render(
    <CalendarioHoy
      {...propiedades}
      abrir={abrir}
      empezadas={{ activa: "2028-02-15T12:00:00Z" }}
      sesiones={[
        { agenda: { ...agenda, id: "pendiente" }, nombre: "Empuje", enviadoEn: null },
        { agenda: { ...agenda, id: "activa" }, nombre: "Tracción", enviadoEn: null },
        { agenda: { ...agenda, id: "hecha" }, nombre: "Pierna", enviadoEn: "2028-02-15T10:00:00Z" },
      ]}
    />,
  )
  await fireEvent.press(screen.getByRole("button", { name: "Ver mes" }))
  const dia = screen.getByRole("button", {
    name: `${fechaLegible(hoy)}, hoy: Empuje, pendiente, Tracción, en curso, Pierna, hecha`,
  })
  expect(dia).toHaveStyle({ minWidth: 44, minHeight: 52 })
  await fireEvent.press(dia)
  expect(abrir).toHaveBeenCalledWith("activa")
})

it("actualiza el mes al volver de una sesión", async () => {
  const cargarMes = jest.fn(async () => [])
  const vista = await render(<CalendarioHoy {...propiedades} cargarMes={cargarMes} />)
  await fireEvent.press(screen.getByRole("button", { name: "Ver mes" }))
  expect(cargarMes).toHaveBeenCalledTimes(1)
  mockFoco += 1
  await vista.rerender(<CalendarioHoy {...propiedades} cargarMes={cargarMes} />)
  expect(cargarMes).toHaveBeenCalledTimes(2)
})

it.each([
  [new ErrorDePermiso(), "No tienes permiso para acceder a estos datos."],
  [new ErrorDeSesion(), "Tu sesión ha caducado. Vuelve a entrar."],
])("retira el mes y no ofrece reintentar ante %s", async (error, mensaje) => {
  await render(
    <CalendarioHoy
      {...propiedades}
      cargarMes={jest.fn(async () => {
        throw error
      })}
    />,
  )
  await fireEvent.press(screen.getByRole("button", { name: "Ver mes" }))
  expect(await screen.findByText(mensaje)).toBeOnTheScreen()
  expect(screen.queryByRole("button", { name: "Reintentar mes" })).toBeNull()
  expect(screen.queryByLabelText(/descanso/)).toBeNull()
})
