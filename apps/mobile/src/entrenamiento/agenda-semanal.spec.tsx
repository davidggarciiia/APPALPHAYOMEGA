import { fireEvent, render, screen } from "@testing-library/react-native"
import { AgendaSemanal } from "./agenda-semanal"
import { fechaLegible, hoyAgenda, lunesDeSemana, sumarDias } from "./fechas"

let mockFoco = 0
jest.mock("expo-router", () => ({
  useFocusEffect: (efecto: () => void) =>
    jest.requireActual<typeof import("react")>("react").useEffect(efecto, [efecto, mockFoco]),
}))
jest.mock("../componentes/iconos", () => ({ Icono: () => null }))
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}))

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

it("cambia el día desde una hoja y mantiene la revisión de la agenda", async () => {
  const fechaNueva = sumarDias(lunesDeSemana(), hoy === lunesDeSemana() ? 1 : 0)
  const mover = jest.fn(async () => ({
    ...listado.sesiones[0]!.agenda,
    fechaActual: fechaNueva,
    revision: 1,
  }))
  const actualizado = jest.fn(async () => undefined)
  await render(
    <AgendaSemanal
      semana={lunesDeSemana()}
      listado={listado}
      cambiarSemana={jest.fn()}
      abrir={jest.fn()}
      resumenHoy={false}
      api={{ mover, cambios: jest.fn() } as never}
      actualizado={actualizado}
    />,
  )
  await fireEvent.press(screen.getByRole("button", { name: "Cambiar día de Fuerza" }))
  expect(screen.getByTestId("hoja-modal")).toBeOnTheScreen()
  expect(screen.getByText("Tu entrenador ve el cambio")).toBeOnTheScreen()
  await fireEvent.press(screen.getByRole("button", { name: fechaLegible(fechaNueva) }))
  expect(mover).toHaveBeenCalledWith("sesion", { fecha: fechaNueva, revision: 0 })
  expect(actualizado).toHaveBeenCalledTimes(1)
})

it("en descanso muestra la próxima sesión sin ofrecer empezar", async () => {
  const { sumarDias } = jest.requireActual<typeof import("./fechas")>("./fechas")
  await render(
    <AgendaSemanal
      semana={lunesDeSemana()}
      listado={{
        ...listado,
        sesiones: [
          {
            ...listado.sesiones[0]!,
            agenda: { ...listado.sesiones[0]!.agenda, fechaActual: sumarDias(hoy, 1) },
          },
        ],
      }}
      cambiarSemana={jest.fn()}
      abrir={jest.fn()}
      resumenHoy
    />,
  )
  expect(screen.getByText("Mañana · Fuerza")).toBeOnTheScreen()
  expect(screen.queryByRole("button", { name: "Empezar Fuerza" })).toBeNull()
})

it("despliega el mes, abre sesiones de otra semana y vuelve a la tira semanal", async () => {
  const fecha = `${hoy.slice(0, 7)}-${hoy.slice(-2) === "01" ? "20" : "01"}`
  const abrir = jest.fn()
  const cargarMes = jest.fn(async () => [
    ...listado.sesiones,
    {
      ...listado.sesiones[0]!,
      nombre: "Tracción",
      agenda: { ...listado.sesiones[0]!.agenda, id: "otra", fechaActual: fecha },
      enviadoEn: "2026-10-01T12:00:00Z",
    },
  ])
  await render(
    <AgendaSemanal
      semana={lunesDeSemana()}
      listado={listado}
      cambiarSemana={jest.fn()}
      abrir={abrir}
      resumenHoy
      cargarMes={cargarMes}
    />,
  )
  const desplegar = screen.getByRole("button", { name: "Ver mes" })
  expect(desplegar.props.accessibilityState).toEqual({ expanded: false })
  await fireEvent.press(desplegar)
  expect(cargarMes).toHaveBeenCalledWith(hoy.slice(0, 7))
  const dia = await screen.findByRole("button", {
    name: `${fechaLegible(fecha)}: Tracción, hecha`,
  })
  await fireEvent.press(dia)
  expect(abrir).toHaveBeenCalledWith("otra")
  const plegar = screen.getByRole("button", { name: "Ver semana" })
  expect(plegar.props.accessibilityState).toEqual({ expanded: true })
  await fireEvent.press(plegar)
  expect(screen.getByRole("button", { name: "Ver mes" })).toBeOnTheScreen()
  expect(screen.queryByRole("button", { name: "Mes siguiente" })).toBeNull()
})

it("al tocar un día libre del mes dice que no hay sesión", async () => {
  await render(
    <AgendaSemanal
      semana={lunesDeSemana()}
      listado={{ total: 0, sesiones: [] }}
      cambiarSemana={jest.fn()}
      abrir={jest.fn()}
      resumenHoy
      cargarMes={jest.fn(async () => [])}
    />,
  )
  await fireEvent.press(screen.getByRole("button", { name: "Ver mes" }))
  const fecha = `${hoy.slice(0, 7)}-01`
  await fireEvent.press(
    await screen.findByRole("button", { name: `${fechaLegible(fecha)}: descanso` }),
  )
  expect(screen.getByText(`Sin sesión el ${fechaLegible(fecha)}`)).toBeOnTheScreen()
})
