import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native"
import { AppState, type AppStateStatus } from "react-native"
import type { ListadoNovedades, ListadoAvisosSeguimiento } from "@alpha-omega/shared"
import { useSesion } from "../sesion"
import { listarUsuarios } from "../lib/api"
import { ProveedorNotificaciones, BotonNotificaciones } from "./contexto"
import { BandejaNotificaciones } from "./bandeja"

let mockRuta = "/"
const mockPush = jest.fn()
const mockEntrenamiento = { novedades: jest.fn(), leerNovedades: jest.fn() }
const mockSeguimiento = { avisos: jest.fn(), leerAvisos: jest.fn() }
jest.mock("expo-router", () => ({
  usePathname: () => mockRuta,
  useRouter: () => ({ push: mockPush }),
  useFocusEffect: (efecto: () => void) =>
    jest.requireActual<typeof import("react")>("react").useEffect(efecto, [efecto]),
}))
jest.mock("../sesion", () => ({ useSesion: jest.fn() }))
jest.mock("../lib/api", () => ({ listarUsuarios: jest.fn() }))
jest.mock("../entrenamiento/use-entrenamiento", () => ({
  useEntrenamiento: () => mockEntrenamiento,
}))
jest.mock("../seguimiento/use-valoraciones", () => ({ useValoraciones: () => mockSeguimiento }))

const novedades: ListadoNovedades = {
  novedades: ["fecha_cambiada", "entrenamiento_enviado", "molestia"].map((tipo, i) => ({
    id: `aviso-${i}`,
    tipo: tipo as "fecha_cambiada",
    clienteId: "cliente",
    sesionId: "sesion",
    sesionNombre: "Fuerza A",
    autor: { id: "autor", nombre: "Lara García", rol: "cliente" },
    creadaEn: "2026-10-28T10:00:00.000Z",
    leidaEn: null,
  })),
  total: 3,
  sinLeer: 3,
}
const avisos: ListadoAvisosSeguimiento = {
  avisos: [
    {
      id: "foto",
      clienteId: "cliente",
      tipo: "fotosRecibidas",
      autor: { id: "cliente", nombre: "Lara García" },
      creadoEn: "2026-10-28T10:00:00.000Z",
      vigente: true,
      leidoEn: null,
      destino: { tipo: "solicitud", solicitudId: "solicitud" },
    },
  ],
  sinLeer: 1,
}

beforeEach(() => {
  jest.spyOn(AppState, "addEventListener").mockImplementation(() => ({ remove: jest.fn() }))
  mockRuta = "/"
  jest.mocked(useSesion).mockReturnValue({
    estado: {
      fase: "dentro",
      usuario: { id: "cliente", nombre: "Lara", apellidos: "García", rol: "cliente" },
    },
    pedir: jest.fn(),
  } as unknown as ReturnType<typeof useSesion>)
  mockEntrenamiento.novedades.mockResolvedValue(novedades)
  mockEntrenamiento.leerNovedades.mockResolvedValue({ leidas: 1 })
  mockSeguimiento.avisos.mockResolvedValue({ avisos: [], sinLeer: 0 })
  mockSeguimiento.leerAvisos.mockResolvedValue({ avisos: [], sinLeer: 0 })
  jest.mocked(listarUsuarios).mockResolvedValue({
    usuarios: [
      {
        id: "cliente",
        nombre: "Lara",
        apellidos: "García",
        email: "lara@prueba.local",
        rol: "cliente",
        estado: "activo",
      },
    ],
    total: 1,
  })
})

function Pantalla() {
  return (
    <ProveedorNotificaciones>
      <BotonNotificaciones />
      <BandejaNotificaciones />
    </ProveedorNotificaciones>
  )
}

it.each(["cliente", "entrenador"] as const)(
  "abre la bandeja desde el botón accesible del %s sin confirmar lecturas al entrar",
  async (rol) => {
    const sesion = jest.mocked(useSesion).getMockImplementation()!()
    jest.mocked(useSesion).mockReturnValue({
      ...sesion,
      estado: { ...sesion.estado, usuario: { id: rol, nombre: "Ana", apellidos: "Pérez", rol } },
    } as ReturnType<typeof useSesion>)
    await render(<Pantalla />)
    const boton = await screen.findByRole("button", { name: "Notificaciones, 3 sin leer" })
    expect(boton).toHaveStyle({ minWidth: 44, minHeight: 44 })
    expect(
      screen.getByTestId("punto-notificaciones", { includeHiddenElements: true }),
    ).toBeOnTheScreen()
    await fireEvent.press(boton)
    expect(mockPush).toHaveBeenCalledWith("/notificaciones")
    expect(mockEntrenamiento.leerNovedades).not.toHaveBeenCalled()
  },
)

it("sustituye las novedades de la ficha: conserva los tres eventos, confirma solo el abierto y navega con nombre completo", async () => {
  jest.mocked(useSesion).mockReturnValue({
    estado: { fase: "dentro", usuario: { id: "entrenador", rol: "entrenador" } },
    pedir: jest.fn(),
  } as unknown as ReturnType<typeof useSesion>)
  mockRuta = "/notificaciones"
  await render(<Pantalla />)
  expect(await screen.findByText("Lara García cambió el día de Fuerza A")).toBeOnTheScreen()
  expect(screen.getByText("Lara García envió Fuerza A")).toBeOnTheScreen()
  await fireEvent.press(screen.getByRole("button", { name: /comunicó una molestia en Fuerza A/ }))
  await waitFor(() =>
    expect(mockEntrenamiento.leerNovedades).toHaveBeenCalledWith("sesion", {
      novedadIds: ["aviso-2"],
    }),
  )
  expect(mockPush).toHaveBeenCalledWith({
    pathname: "/entrenamiento/[id]",
    params: { id: "sesion", nombre: "Lara García" },
  })
  expect(screen.getByRole("button", { name: "Notificaciones, 2 sin leer" })).toBeOnTheScreen()
})

it("mantiene el contador al cambiar de pestaña sin recorrer de nuevo toda la cartera", async () => {
  const vista = await render(<Pantalla />)
  await screen.findByRole("button", { name: "Notificaciones, 3 sin leer" })
  const llamadas = mockEntrenamiento.novedades.mock.calls.length
  mockRuta = "/nutricion"
  await vista.rerender(<Pantalla />)
  expect(mockEntrenamiento.novedades).toHaveBeenCalledTimes(llamadas)
  mockRuta = "/notificaciones"
  await vista.rerender(<Pantalla />)
  await waitFor(() => expect(mockEntrenamiento.novedades).toHaveBeenCalledTimes(llamadas + 1))
})

it("actualiza la campana al volver del segundo plano sin cambiar de ruta", async () => {
  let cambiar!: (estado: AppStateStatus) => void
  const quitar = jest.fn()
  const escuchar = jest
    .spyOn(AppState, "addEventListener")
    .mockImplementation((_tipo, listener) => {
      cambiar = listener
      return { remove: quitar }
    })
  try {
    const vista = await render(<Pantalla />)
    await screen.findByRole("button", { name: "Notificaciones, 3 sin leer" })
    mockEntrenamiento.novedades.mockResolvedValue({ ...novedades, sinLeer: 4 })
    await act(async () => {
      cambiar("background")
      cambiar("active")
    })
    expect(
      await screen.findByRole("button", { name: "Notificaciones, 4 sin leer" }),
    ).toBeOnTheScreen()
    await vista.unmount()
    expect(quitar).toHaveBeenCalled()
  } finally {
    escuchar.mockRestore()
  }
})

it("actualiza el contador al leer una notificación de la segunda página", async () => {
  const eventos = Array.from({ length: 9 }, (_, i) => ({
    ...novedades.novedades[0]!,
    id: `pagina-${i}`,
    sesionNombre: `Fuerza ${i + 1}`,
  }))
  mockEntrenamiento.novedades.mockImplementation(async (_id, desde = 0) => ({
    novedades: eventos.slice(desde, desde + 8),
    total: 9,
    sinLeer: 9,
  }))
  await render(<Pantalla />)
  await screen.findByRole("button", { name: "Notificaciones, 9 sin leer" })
  await fireEvent.press(screen.getByRole("button", { name: "Ver más novedades" }))
  await fireEvent.press(await screen.findByRole("button", { name: /cambió el día de Fuerza 9/ }))
  expect(mockEntrenamiento.leerNovedades).toHaveBeenCalledWith("sesion", {
    novedadIds: ["pagina-8"],
  })
  expect(screen.getByRole("button", { name: "Notificaciones, 8 sin leer" })).toBeOnTheScreen()
})

it("lleva fotos recibidas del entrenador a la ficha de Progreso conservando su lectura", async () => {
  jest.mocked(useSesion).mockReturnValue({
    estado: { fase: "dentro", usuario: { id: "entrenador", rol: "entrenador" } },
    pedir: jest.fn(),
  } as unknown as ReturnType<typeof useSesion>)
  mockSeguimiento.avisos.mockResolvedValue(avisos)
  mockRuta = "/notificaciones"
  await render(<Pantalla />)
  await fireEvent.press(await screen.findByRole("button", { name: /Lara García envió fotos/ }))
  expect(mockSeguimiento.leerAvisos).toHaveBeenCalledWith("cliente", ["foto"])
  expect(mockPush).toHaveBeenCalledWith({
    pathname: "/entrenador/cliente/[id]",
    params: { id: "cliente", pestana: "progreso" },
  })
})

it("muestra vacío sin punto y permite reintentar una carga fallida", async () => {
  mockEntrenamiento.novedades.mockRejectedValueOnce(new Error("Sin red"))
  const vista = await render(<Pantalla />)
  await screen.findByText("No se pudieron cargar las notificaciones.")
  expect(screen.queryByText("No tienes notificaciones.")).toBeNull()
  mockEntrenamiento.novedades.mockResolvedValue({ novedades: [], total: 0, sinLeer: 0 })
  await fireEvent.press(screen.getByRole("button", { name: "Reintentar notificaciones" }))
  expect(await screen.findByText("No tienes notificaciones.")).toBeOnTheScreen()
  expect(screen.queryByTestId("punto-notificaciones", { includeHiddenElements: true })).toBeNull()
  await act(async () => vista.unmount())
})

it("retira los avisos anteriores si falla la comprobación de acceso al volver a la bandeja", async () => {
  const vista = await render(<Pantalla />)
  await screen.findByText("Lara García cambió el día de Fuerza A")
  mockEntrenamiento.novedades.mockRejectedValueOnce(new Error("Acceso revocado"))
  mockRuta = "/notificaciones"
  await vista.rerender(<Pantalla />)
  await screen.findByText("No se pudieron cargar las notificaciones.")
  expect(screen.queryByText("Lara García cambió el día de Fuerza A")).toBeNull()
  expect(screen.getByRole("button", { name: "Notificaciones" })).toBeOnTheScreen()
})
