import { fireEvent, render, screen } from "@testing-library/react-native"
import { AgendaSemanal } from "./agenda-semanal"
import { fechaLegible, hoyAgenda, lunesDeSemana } from "./fechas"

let mockFoco = 0
jest.mock("expo-router", () => ({
  useFocusEffect: (efecto: () => void) =>
    jest.requireActual<typeof import("react")>("react").useEffect(efecto, [efecto, mockFoco]),
}))
jest.mock("../componentes/iconos", () => ({ Icono: () => null }))

const hoy = hoyAgenda()
const listado = {
  total: 1,
  sesiones: [
    {
      agenda: {
        id: "sesion",
        clienteId: "cliente",
        fechaOriginal: hoy,
        fechaActual: hoy,
        estado: "abierta" as const,
        revision: 0,
      },
      nombre: "Fuerza",
      enviadoEn: null,
    },
  ],
}

it("la fila abre una sola sesión y permite abrirla al volver a la agenda", async () => {
  const abrir = jest.fn()
  const propiedades = {
    semana: lunesDeSemana(),
    listado,
    cambiarSemana: jest.fn(),
    abrir,
    resumenHoy: false,
  }
  const vista = await render(<AgendaSemanal {...propiedades} />)
  const nombre = `Empezar Fuerza, ${fechaLegible(hoy)}, pendiente`
  await fireEvent.press(screen.getByRole("button", { name: nombre }))
  await fireEvent.press(screen.getByRole("button", { name: nombre }))
  expect(abrir).toHaveBeenCalledTimes(1)

  mockFoco += 1
  await vista.rerender(<AgendaSemanal {...propiedades} />)
  await fireEvent.press(screen.getByRole("button", { name: nombre }))
  expect(abrir).toHaveBeenCalledTimes(2)
})

it.each(["tarjeta", "día"])(
  "comparte la guarda al abrir primero desde %s y después desde la otra entrada",
  async (primera) => {
    const abrir = jest.fn()
    await render(
      <AgendaSemanal
        semana={lunesDeSemana()}
        listado={listado}
        cambiarSemana={jest.fn()}
        abrir={abrir}
        resumenHoy
      />,
    )
    const tarjeta = screen.getByRole("button", { name: "Empezar Fuerza" })
    const dia = screen.getByRole("button", { name: `${fechaLegible(hoy)}, hoy: Fuerza` })
    await fireEvent.press(primera === "tarjeta" ? tarjeta : dia)
    await fireEvent.press(primera === "tarjeta" ? dia : tarjeta)
    expect(abrir).toHaveBeenCalledTimes(1)
    expect(abrir).toHaveBeenCalledWith("sesion")
  },
)
