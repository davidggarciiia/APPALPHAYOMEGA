import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native"
import { PanelHoySchema, type PanelHoy as Datos } from "@alpha-omega/shared"

import { ErrorDePermiso, ErrorDeRed } from "../lib/api"
import type { PeticionAutenticada } from "../lib/peticion-autenticada"
import { crearApiPanel, type ApiPanel } from "./api"
import { PanelHoy } from "./panel-hoy"

const mockPush = jest.fn()
/** El último efecto de foco, para simular que el entrenador vuelve a la pantalla. */
const mockFoco: { efecto: (() => void) | null } = { efecto: null }
jest.mock("expo-router", () => {
  const { useEffect } = jest.requireActual<typeof import("react")>("react")
  return {
    useFocusEffect: (efecto: () => void) => {
      mockFoco.efecto = efecto
      useEffect(efecto, [efecto])
    },
    useRouter: () => ({ push: mockPush }),
  }
})

const id = (n: number): string => `10000000-0000-4000-8000-${String(n).padStart(12, "0")}`
const ana = { id: id(1), nombre: "Ana López" }
const bruno = { id: id(2), nombre: "Bruno Díaz" }
const carla = { id: id(3), nombre: "Carla Gil" }
const hace = "2026-09-24T10:00:00.000Z"

function lleno(): Datos {
  return PanelHoySchema.parse({
    fecha: "2026-09-26",
    clientes: { activos: 12, pendientes: 2, bajas: 1, total: 15, sinConsentimiento: 3 },
    hoy: {
      total: 3,
      enviadas: 1,
      enCurso: 1,
      sesiones: [
        { sesionId: id(11), cliente: ana, sesion: "Empuje", estado: "enviada", enviadoEn: hace },
        { sesionId: id(12), cliente: bruno, sesion: "Pierna", estado: "enCurso", enviadoEn: null },
        { sesionId: id(13), cliente: carla, sesion: "Core", estado: "pendiente", enviadoEn: null },
      ],
    },
    porRevisar: {
      entrenamientos: {
        total: 2,
        elementos: [
          {
            sesionId: id(11),
            cliente: ana,
            sesion: "Empuje",
            fecha: "2026-09-26",
            enviadoEn: hace,
            esfuerzo: 8,
          },
        ],
      },
      molestias: {
        total: 1,
        elementos: [
          {
            id: id(21),
            sesionId: id(12),
            cliente: bruno,
            zona: "hombro",
            intensidad: 7,
            nivel: "rojo",
            ejercicio: "Press banca",
            creadaEn: hace,
          },
        ],
      },
      fotos: {
        total: 1,
        elementos: [{ solicitudId: id(31), cliente: ana, fotos: 3, recibidaEn: hace }],
      },
      comentarios: {
        total: 1,
        elementos: [
          { novedadId: id(41), sesionId: id(11), cliente: ana, sesion: "Empuje", creadaEn: hace },
        ],
      },
    },
    semana: {
      lunes: "2026-09-21",
      domingo: "2026-09-27",
      programadas: 9,
      enviadas: 6,
      adherencia: 66,
      restantes: 4,
      menorAdherencia: [{ cliente: bruno, programadas: 3, enviadas: 1, adherencia: 33 }],
    },
    actividad: [
      { tipo: "envio", id: id(11), cliente: ana, fecha: hace, sesionId: id(11), sesion: "Empuje" },
      {
        tipo: "molestia",
        id: id(21),
        cliente: bruno,
        fecha: hace,
        sesionId: id(12),
        zona: "hombro",
        nivel: "rojo",
      },
      { tipo: "fotos", id: id(31), cliente: ana, fecha: hace, fotos: 3 },
      { tipo: "medida", id: id(51), cliente: carla, fecha: hace },
    ],
  })
}

function vacio(): Datos {
  const lista = { total: 0, elementos: [] }
  return PanelHoySchema.parse({
    fecha: "2026-09-26",
    clientes: { activos: 0, pendientes: 0, bajas: 0, total: 0, sinConsentimiento: 0 },
    hoy: { total: 0, enviadas: 0, enCurso: 0, sesiones: [] },
    porRevisar: { entrenamientos: lista, molestias: lista, fotos: lista, comentarios: lista },
    semana: {
      lunes: "2026-09-21",
      domingo: "2026-09-27",
      programadas: 0,
      enviadas: 0,
      adherencia: null,
      restantes: 0,
      menorAdherencia: [],
    },
    actividad: [],
  })
}

function api(...respuestas: Array<Datos | Error>): ApiPanel & {
  hoy: jest.Mock
  leerComentario: jest.Mock
} {
  const hoy = jest.fn()
  for (const respuesta of respuestas)
    hoy.mockImplementationOnce(async () => {
      if (respuesta instanceof Error) throw respuesta
      return respuesta
    })
  return { hoy, leerComentario: jest.fn(async () => ({ leidas: 1 })) }
}

beforeEach(() => {
  mockPush.mockClear()
  mockFoco.efecto = null
})

it("con datos: saludo, cifras del día, hoy, por revisar, semana, actividad y accesos", async () => {
  await render(<PanelHoy api={api(lleno())} nombre="David Gómez" />)

  expect(await screen.findByLabelText("Entrenos hoy: 3. 1 enviado · 1 en curso")).toBeTruthy()
  expect(screen.getByText("Hola, David")).toBeTruthy()
  expect(screen.getByText("Sábado, 26 de septiembre")).toBeTruthy()
  expect(
    screen.getByLabelText("Por revisar: 4. 2 entrenos · 1 de fotos · 1 comentario"),
  ).toBeTruthy()
  expect(screen.getByLabelText("Molestias: 1. Abiertas, sin responder")).toBeTruthy()
  expect(screen.getByLabelText("Adherencia: 66 %. 6 de 9 esta semana")).toBeTruthy()

  expect(screen.getByRole("button", { name: "Bruno Díaz, Pierna: En curso" })).toBeTruthy()
  expect(screen.getByRole("button", { name: "Carla Gil, Core: Pendiente" })).toBeTruthy()
  expect(screen.getByText("En curso")).toBeTruthy()

  expect(screen.getByText("Molestia roja en el hombro")).toBeTruthy()
  expect(screen.getByText("Y 1 entreno más")).toBeTruthy()
  expect(screen.getByText("Fotos recibidas")).toBeTruthy()
  expect(screen.getByText("Comentario sin leer")).toBeTruthy()

  expect(screen.getByText(/6 de 9 sesiones enviadas de lunes a hoy/)).toBeTruthy()
  expect(screen.getByText("Quedan 4 sesiones hasta el domingo.")).toBeTruthy()
  expect(screen.getByText("lun 21 – dom 27")).toBeTruthy()
  expect(screen.getByRole("progressbar", { name: "Adherencia de la semana" })).toBeTruthy()
  expect(screen.getByRole("button", { name: "Bruno Díaz: 1 de 3 enviadas, 33 %" })).toBeTruthy()

  expect(screen.getByText("Ana López envió Empuje")).toBeTruthy()
  expect(screen.getByText("Bruno Díaz avisó de una molestia roja en el hombro")).toBeTruthy()
  expect(screen.getByText("Ana López mandó 3 fotos")).toBeTruthy()
  expect(screen.getByText("Carla Gil apuntó una medida nueva")).toBeTruthy()

  expect(screen.getByText("12 clientes activos · 2 pendientes de activar · 1 baja")).toBeTruthy()
  expect(screen.getByText(/3 sin consentimiento de salud/)).toBeTruthy()
  for (const acceso of ["Clientes", "Rutinas", "Ejercicios", "Nutricionista", "Mi perfil"])
    expect(screen.getByRole("button", { name: acceso })).toBeTruthy()
})

it("sin datos: lo dice en cada bloque en vez de inventar cifras", async () => {
  await render(<PanelHoy api={api(vacio())} nombre="David" />)

  expect(await screen.findByText("Hoy no hay sesiones programadas.")).toBeTruthy()
  expect(screen.getByLabelText("Entrenos hoy: 0. Nada programado")).toBeTruthy()
  expect(screen.getByLabelText("Por revisar: 0. Todo al día")).toBeTruthy()
  expect(screen.getByLabelText("Adherencia: —. Nada programado aún")).toBeTruthy()
  expect(screen.getByText("Todo revisado. Nada pendiente.")).toBeTruthy()
  expect(screen.getByText("Aún no tocaba ninguna sesión esta semana.")).toBeTruthy()
  expect(screen.getByText("Tus clientes aún no han registrado nada.")).toBeTruthy()
  expect(screen.queryByRole("progressbar")).toBeNull()
  expect(screen.queryByText("Menor adherencia")).toBeNull()
  expect(screen.queryByText(/sin consentimiento/)).toBeNull()
})

it("si falla la carga, lo explica, ofrece reintentar y conserva los accesos", async () => {
  const conFallo = api(new ErrorDeRed("sin red"), lleno())
  await render(<PanelHoy api={conFallo} nombre="David" />)

  expect(await screen.findByText("No hemos podido conectar. Revisa tu conexión.")).toBeTruthy()
  expect(screen.queryByLabelText(/^Entrenos hoy/)).toBeNull()
  expect(screen.getByRole("button", { name: "Clientes" })).toBeTruthy()

  await fireEvent.press(screen.getByRole("button", { name: "Reintentar" }))
  expect(await screen.findByLabelText("Entrenos hoy: 3. 1 enviado · 1 en curso")).toBeTruthy()
  expect(conFallo.hoy).toHaveBeenCalledTimes(2)
  expect(screen.queryByText("No hemos podido conectar. Revisa tu conexión.")).toBeNull()
})

it("sin permiso no ofrece reintentar contra una puerta cerrada", async () => {
  await render(<PanelHoy api={api(new ErrorDePermiso("403"))} nombre="David" />)

  expect(await screen.findByText("Esta pantalla es solo para el entrenador.")).toBeTruthy()
  expect(screen.queryByRole("button", { name: "Reintentar" })).toBeNull()
})

it("al volver a la pantalla lo pide de nuevo y, si falla, conserva lo último", async () => {
  const panel = api(lleno(), new ErrorDeRed("sin red"))
  await render(<PanelHoy api={panel} nombre="David" />)
  expect(await screen.findByLabelText("Molestias: 1. Abiertas, sin responder")).toBeTruthy()

  await act(async () => {
    mockFoco.efecto?.()
  })

  expect(await screen.findByText(/No se ha podido actualizar/)).toBeTruthy()
  expect(panel.hoy).toHaveBeenCalledTimes(2)
  expect(screen.getByLabelText("Molestias: 1. Abiertas, sin responder")).toBeTruthy()
  expect(screen.getByRole("button", { name: "Reintentar" })).toBeTruthy()
})

it("cada elemento abre su destino", async () => {
  const panel = api(lleno())
  await render(<PanelHoy api={panel} nombre="David" />)
  await screen.findByText("Molestia roja en el hombro")
  const pulsar = async (nombre: RegExp | string): Promise<void> => {
    await fireEvent.press(screen.getByRole("button", { name: nombre }))
  }
  const ficha = (clienteId: string, pestana?: string): object => ({
    pathname: "/entrenador/cliente/[id]",
    params: pestana ? { id: clienteId, pestana } : { id: clienteId },
  })

  await pulsar(/^Entreno enviado\. Ana López · Empuje/)
  expect(mockPush).toHaveBeenLastCalledWith({
    pathname: "/entrenamiento/[id]",
    params: { id: id(11) },
  })
  await pulsar(/^Molestia roja en el hombro\. Bruno Díaz/)
  expect(mockPush).toHaveBeenLastCalledWith(ficha(bruno.id))
  await pulsar(/^Fotos recibidas\. Ana López/)
  expect(mockPush).toHaveBeenLastCalledWith(ficha(ana.id, "progreso"))
  await pulsar(/^Comentario sin leer\. Ana López · Empuje/)
  expect(mockPush).toHaveBeenLastCalledWith(ficha(ana.id, "sesiones"))
  await waitFor(() => expect(panel.leerComentario).toHaveBeenCalledWith(id(11), id(41)))

  await pulsar("Bruno Díaz, Pierna: En curso")
  expect(mockPush).toHaveBeenLastCalledWith({
    pathname: "/entrenamiento/[id]",
    params: { id: id(12) },
  })
  await pulsar("Bruno Díaz: 1 de 3 enviadas, 33 %")
  expect(mockPush).toHaveBeenLastCalledWith(ficha(bruno.id, "sesiones"))
  await pulsar(/^Carla Gil apuntó una medida nueva/)
  expect(mockPush).toHaveBeenLastCalledWith(ficha(carla.id, "progreso"))
  await pulsar("Clientes")
  expect(mockPush).toHaveBeenLastCalledWith("/cartera")
  await pulsar("Nutricionista")
  expect(mockPush).toHaveBeenLastCalledWith("/nutricionista")
})

it("pide el panel y marca el comentario leído en sus rutas", async () => {
  const pedir = jest.fn(async () => ({}))
  const panel = crearApiPanel(pedir as unknown as PeticionAutenticada)
  await panel.hoy()
  expect(pedir).toHaveBeenLastCalledWith("/panel/hoy", PanelHoySchema)
  await panel.leerComentario(id(11), id(41))
  expect(pedir).toHaveBeenLastCalledWith(
    `/entrenamiento/sesiones/${id(11)}/novedades/leidas`,
    expect.anything(),
    { method: "POST", body: JSON.stringify({ novedadIds: [id(41)] }) },
  )
})
