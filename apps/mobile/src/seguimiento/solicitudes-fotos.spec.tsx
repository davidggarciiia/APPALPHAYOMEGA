import { fireEvent, render, screen, waitFor } from "@testing-library/react-native"
import type { CrearSolicitudFotos, MedioFoto, SolicitudFotos } from "@alpha-omega/shared"

import { ErrorDeRed } from "../lib/http"
import type { ApiMedios } from "./medios-api"
import { SolicitudesFotos } from "./solicitudes-fotos"

jest.mock("expo-router", () => ({
  useFocusEffect: (efecto: () => void) =>
    jest.requireActual<typeof import("react")>("react").useEffect(efecto, [efecto]),
}))

const CLIENTE = "10000000-0000-4000-8000-000000000000"
const VISITA = "20000000-0000-4000-8000-000000000000"
let contador = 0
const nuevoId = () => `30000000-0000-4000-8000-${String(++contador).padStart(12, "0")}`

// Datos sintéticos.
const medio: MedioFoto = {
  id: "40000000-0000-4000-8000-000000000001",
  clienteId: CLIENTE,
  autor: { id: CLIENTE, nombre: "Cliente" },
  origen: "cliente",
  vista: "frente",
  etiqueta: null,
  fechaToma: "2026-09-25",
  estado: "disponible",
  tipoMime: "image/jpeg",
  bytes: 1000,
  valoracionId: null,
  solicitudId: "50000000-0000-4000-8000-000000000001",
  creadoEn: "2026-09-25T10:00:00.000Z",
  confirmadoEn: "2026-09-25T10:00:05.000Z",
}
function solicitud(cambios: Partial<SolicitudFotos> = {}): SolicitudFotos {
  return {
    id: "50000000-0000-4000-8000-000000000001",
    clienteId: CLIENTE,
    autor: { id: "60000000-0000-4000-8000-000000000001", nombre: "Entrenador" },
    vistas: ["frente", "espalda"],
    fechaLimite: "2026-10-01",
    mensaje: "Con la misma luz",
    estado: "pendiente",
    creadaEn: "2026-09-24T10:00:00.000Z",
    recibidaEn: null,
    revisadaEn: null,
    medios: [],
    ...cambios,
  }
}

function api(lista: SolicitudFotos[] = []) {
  return {
    solicitudes: jest.fn(async () => ({ solicitudes: lista })),
    pedirFotos: jest.fn(async (_c: string, d: CrearSolicitudFotos) =>
      solicitud({ vistas: d.vistas }),
    ),
    revisarSolicitud: jest.fn(async () => solicitud({ estado: "revisada" })),
    vincularFoto: jest.fn(async () => ({ ...medio, valoracionId: VISITA })),
  } satisfies Pick<ApiMedios, "solicitudes" | "pedirFotos" | "revisarSolicitud" | "vincularFoto">
}

it("el entrenador pide vistas concretas y un reintento reutiliza la operación", async () => {
  const falsa = api()
  falsa.pedirFotos.mockRejectedValueOnce(new ErrorDeRed())
  await render(
    <SolicitudesFotos clienteId={CLIENTE} api={falsa} modo="entrenador" nuevoId={nuevoId} />,
  )
  expect(await screen.findByText("Aún no has pedido fotos.")).toBeTruthy()
  await fireEvent.press(screen.getByRole("button", { name: "Pedir fotos al cliente" }))
  await fireEvent.press(screen.getByRole("checkbox", { name: "Espalda" }))
  await fireEvent.changeText(screen.getByLabelText("Fecha límite (AAAA-MM-DD, opcional)"), "1 oct")
  await fireEvent.press(screen.getByRole("button", { name: "Pedir fotos" }))
  expect(screen.getByText(/Escribe la fecha límite como AAAA-MM-DD/)).toBeTruthy()
  expect(falsa.pedirFotos).not.toHaveBeenCalled()
  await fireEvent.changeText(
    screen.getByLabelText("Fecha límite (AAAA-MM-DD, opcional)"),
    "2026-10-01",
  )
  await fireEvent.press(screen.getByRole("button", { name: "Pedir fotos" }))
  expect(await screen.findByText(/No hemos podido conectar/)).toBeTruthy()
  await fireEvent.press(screen.getByRole("button", { name: "Pedir fotos" }))
  await waitFor(() => expect(falsa.pedirFotos).toHaveBeenCalledTimes(2))
  const [primera, segunda] = falsa.pedirFotos.mock.calls
  expect(segunda![1]).toEqual({
    operacionId: primera![1].operacionId,
    vistas: ["frente", "espalda"],
    fechaLimite: "2026-10-01",
    mensaje: null,
  })
})

it("recibida no es revisada: el entrenador la revisa y puede incorporar la foto", async () => {
  const falsa = api([solicitud({ estado: "recibida", medios: [medio] })])
  await render(
    <SolicitudesFotos
      clienteId={CLIENTE}
      api={falsa}
      modo="entrenador"
      nuevoId={nuevoId}
      valoracionAbiertaId={VISITA}
    />,
  )
  expect(await screen.findByText("Recibida, sin revisar")).toBeTruthy()
  await fireEvent.press(
    screen.getByRole("button", { name: "Incorporar Frente a la visita en curso" }),
  )
  await waitFor(() => expect(falsa.vincularFoto).toHaveBeenCalledWith(CLIENTE, VISITA, medio.id))
  await fireEvent.press(await screen.findByRole("button", { name: "Marcar como revisada" }))
  await waitFor(() =>
    expect(falsa.revisarSolicitud).toHaveBeenCalledWith(
      CLIENTE,
      "50000000-0000-4000-8000-000000000001",
      expect.any(String),
    ),
  )
})

it("sin visita en curso no ofrece incorporar", async () => {
  const falsa = api([solicitud({ estado: "recibida", medios: [medio] })])
  await render(
    <SolicitudesFotos clienteId={CLIENTE} api={falsa} modo="entrenador" nuevoId={nuevoId} />,
  )
  await screen.findByText("Recibida, sin revisar")
  expect(screen.queryByRole("button", { name: /Incorporar/ })).toBeNull()
})

it("el cliente ve solo lo pendiente, sin acciones profesionales", async () => {
  const falsa = api([
    solicitud(),
    solicitud({ id: "50000000-0000-4000-8000-000000000002", estado: "revisada" }),
  ])
  await render(
    <SolicitudesFotos clienteId={CLIENTE} api={falsa} modo="cliente" nuevoId={nuevoId} />,
  )
  expect(await screen.findByText("Frente · Espalda")).toBeTruthy()
  expect(screen.getByText("Con la misma luz")).toBeTruthy()
  expect(screen.getAllByText("Pendiente")).toHaveLength(1)
  expect(screen.queryByText("Revisada")).toBeNull()
  expect(screen.queryByRole("button", { name: /Pedir fotos|revisada|Incorporar/ })).toBeNull()
})
