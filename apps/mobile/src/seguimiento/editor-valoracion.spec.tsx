import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native"
import type {
  CambiarValoracion,
  CrearValoracion,
  DefinicionCorporal,
  ErrorDeApi,
  GuardarPlantillaValoracion,
  PlantillaValoracion,
  ValoracionProfesional,
} from "@alpha-omega/shared"

import { ErrorDePeticion, ErrorDeRed } from "../lib/http"
import { ValoracionesProfesional } from "./editor-valoracion"
import type { ApiValoraciones } from "./valoraciones-api"

jest.mock("expo-router", () => ({
  useFocusEffect: (efecto: () => void) =>
    jest.requireActual<typeof import("react")>("react").useEffect(efecto, [efecto]),
}))
jest.mock("../componentes/iconos", () => ({ Icono: () => null }))

const CLIENTE = "10000000-0000-4000-8000-000000000000"
const VISITA = "20000000-0000-4000-8000-000000000000"
let contador = 0
const nuevoId = () => `30000000-0000-4000-8000-${String(++contador).padStart(12, "0")}`

// Definiciones y valores sintéticos.
const peso: DefinicionCorporal = {
  id: "40000000-0000-4000-8000-000000000001",
  version: 1,
  bloque: "medidas",
  magnitud: "peso",
  nombre: "Peso",
  unidad: "kg",
  zona: null,
  lateralidad: null,
  instrumento: null,
  protocolo: null,
  activa: true,
}
const altura: DefinicionCorporal = {
  ...peso,
  id: "40000000-0000-4000-8000-000000000002",
  magnitud: "altura",
  nombre: "Altura",
  unidad: "cm",
}

function visita(
  revision = 1,
  valores: { peso?: number; altura?: number } = {},
): ValoracionProfesional {
  const resultado = (d: DefinicionCorporal, valor?: number) =>
    valor === undefined
      ? { definicionId: d.id, estado: "pendiente" as const }
      : { definicionId: d.id, estado: "registrado" as const, valor }
  return {
    id: VISITA,
    clienteId: CLIENTE,
    tipo: "inicial",
    anteriorId: null,
    estado: "borrador",
    creadaEn: "2026-09-24T08:00:00.000Z",
    publicacion: null,
    documentoVigente: null,
    borrador: {
      id: "50000000-0000-4000-8000-000000000000",
      revision,
      fechaToma: "2026-09-24",
      corrigePublicacionId: null,
      creadoEn: "2026-09-24T08:00:00.000Z",
      actualizadoEn: "2026-09-24T08:00:00.000Z",
      documento: {
        definiciones: { corporales: [peso, altura], pruebas: [] },
        bloques: ["medidas"],
        corporales: [resultado(peso, valores.peso), resultado(altura, valores.altura)],
        pruebas: [],
        grasaPorPliegues: null,
        destacados: [],
        conclusion: null,
        notasInternas: null,
      },
    },
  }
}

function api(
  plantilla: PlantillaValoracion = { revision: 1, corporales: [peso, altura], pruebas: [] },
) {
  let servidor: ValoracionProfesional | null = null
  const falsa = {
    plantilla: jest.fn(async () => plantilla),
    guardarPlantilla: jest.fn(async (_c: string, datos: GuardarPlantillaValoracion) => ({
      ...datos,
      revision: datos.revision + 1,
    })),
    listar: jest.fn(async () =>
      servidor
        ? {
            total: 1,
            valoraciones: [
              {
                id: VISITA,
                tipo: "inicial" as const,
                estado: "borrador" as const,
                fechaToma: "2026-09-24",
                publicadaEn: null,
                numeroPublicacion: null,
              },
            ],
          }
        : { total: 0, valoraciones: [] },
    ),
    leer: jest.fn(async () => servidor!),
    crear: jest.fn(async (_c: string, _d: CrearValoracion) => (servidor = visita())),
    cambiar: jest.fn(async (_c: string, _id: string, datos: CambiarValoracion) => {
      const [p, a] = datos.contenido.corporales
      servidor = visita(datos.revision + 1, {
        peso: p?.estado === "registrado" ? p.valor : undefined,
        altura: a?.estado === "registrado" ? a.valor : undefined,
      })
      return servidor
    }),
  } satisfies ApiValoraciones
  return falsa
}

const conflicto = (): ErrorDePeticion =>
  new ErrorDePeticion({
    statusCode: 409,
    codigo: "revision_obsoleta",
    message: "La valoración ha cambiado",
  } satisfies ErrorDeApi)

async function abrirNueva(falsa: ReturnType<typeof api>): Promise<void> {
  await render(<ValoracionesProfesional clienteId={CLIENTE} api={falsa} nuevoId={nuevoId} />)
  await fireEvent.press(await screen.findByRole("button", { name: "Nueva valoración" }))
  await screen.findByText("Valoración inicial")
}

it("sin medidas en la plantilla ofrece añadir peso y altura explícitamente", async () => {
  const falsa = api({ revision: 0, corporales: [], pruebas: [] })
  await render(<ValoracionesProfesional clienteId={CLIENTE} api={falsa} nuevoId={nuevoId} />)
  await fireEvent.press(
    await screen.findByRole("button", { name: "Añadir peso y altura a la plantilla" }),
  )
  await waitFor(() => expect(falsa.guardarPlantilla).toHaveBeenCalled())
  const [, datos] = falsa.guardarPlantilla.mock.calls[0]!
  expect(datos.corporales.map((d) => [d.magnitud, d.unidad, d.version])).toEqual([
    ["peso", "kg", 1],
    ["altura", "cm", 1],
  ])
  expect(await screen.findByRole("button", { name: "Nueva valoración" })).toBeTruthy()
  expect(falsa.crear).not.toHaveBeenCalled()
})

it("crea una visita inicial con solo el bloque disponible y guarda peso y altura", async () => {
  const falsa = api()
  await abrirNueva(falsa)
  expect(falsa.crear).toHaveBeenCalledWith(
    CLIENTE,
    expect.objectContaining({ tipo: "inicial", bloques: ["medidas"] }),
  )
  expect(screen.queryByText(/Pliegues|Bioimpedancia|Pruebas|Fotos|Publicar/)).toBeNull()
  await fireEvent.changeText(screen.getByLabelText("Peso (kg)"), "80,5")
  await fireEvent.changeText(screen.getByLabelText("Altura (cm)"), "180")
  expect(screen.getByText("Cambios sin guardar")).toBeTruthy()
  await fireEvent.press(screen.getByRole("button", { name: "Guardar" }))
  await waitFor(() => expect(screen.getByText("Guardado")).toBeTruthy())
  expect(falsa.cambiar).toHaveBeenCalledWith(CLIENTE, VISITA, {
    borradorId: "50000000-0000-4000-8000-000000000000",
    revision: 1,
    fechaToma: "2026-09-24",
    contenido: expect.objectContaining({
      corporales: [
        { definicionId: peso.id, estado: "registrado", valor: 80.5 },
        { definicionId: altura.id, estado: "registrado", valor: 180 },
      ],
    }),
  })
})

it("un campo vacío queda pendiente, no a cero, y un valor fuera de rango no se envía", async () => {
  const falsa = api()
  await abrirNueva(falsa)
  await fireEvent.changeText(screen.getByLabelText("Peso (kg)"), "900")
  await fireEvent.press(screen.getByRole("button", { name: "Guardar" }))
  expect(screen.getByText(/Peso: escribe un valor entre 30 y 400 kg/)).toBeTruthy()
  expect(falsa.cambiar).not.toHaveBeenCalled()
  await fireEvent.changeText(screen.getByLabelText("Peso (kg)"), "")
  await fireEvent.press(screen.getByRole("checkbox", { name: "No realizado — Altura" }))
  await fireEvent.press(screen.getByRole("button", { name: "Guardar" }))
  await waitFor(() => expect(falsa.cambiar).toHaveBeenCalled())
  expect(falsa.cambiar.mock.calls[0]![2].contenido.corporales).toEqual([
    { definicionId: peso.id, estado: "pendiente" },
    { definicionId: altura.id, estado: "noRealizado", motivo: null },
  ])
})

it("durante un guardado lento bloquea el formulario y no envía dos veces", async () => {
  const falsa = api()
  let terminar!: () => void
  const pendiente = new Promise<void>((resolve) => {
    terminar = resolve
  })
  const guardar = falsa.cambiar.getMockImplementation()!
  falsa.cambiar.mockImplementationOnce(async (...args) => {
    await pendiente
    return guardar(...args)
  })
  await abrirNueva(falsa)
  await fireEvent.changeText(screen.getByLabelText("Peso (kg)"), "81")
  await fireEvent.press(screen.getByRole("button", { name: "Guardar" }))
  expect(screen.getAllByText("Guardando…").length).toBeGreaterThan(0)
  expect(screen.getByLabelText("Peso (kg)")).toBeDisabled()
  await fireEvent.press(screen.getByRole("button", { name: "Guardando…" }))
  await act(async () => terminar())
  expect(await screen.findByText("Guardado")).toBeTruthy()
  expect(falsa.cambiar).toHaveBeenCalledTimes(1)
})

it("un fallo de red conserva lo escrito y el reintento lo guarda", async () => {
  const falsa = api()
  falsa.cambiar.mockRejectedValueOnce(new ErrorDeRed())
  await abrirNueva(falsa)
  await fireEvent.changeText(screen.getByLabelText("Peso (kg)"), "82,4")
  await fireEvent.press(screen.getByRole("button", { name: "Guardar" }))
  expect(await screen.findByText("No se pudo guardar")).toBeTruthy()
  expect(screen.getByDisplayValue("82,4")).toBeTruthy()
  await fireEvent.press(screen.getByRole("button", { name: "Guardar" }))
  expect(await screen.findByText("Guardado")).toBeTruthy()
  expect(screen.getByDisplayValue("82,4")).toBeTruthy()
})

it("al volver y continuar recupera exactamente lo confirmado por el servidor", async () => {
  const falsa = api()
  await abrirNueva(falsa)
  await fireEvent.changeText(screen.getByLabelText("Peso (kg)"), "79,9")
  await fireEvent.press(screen.getByRole("button", { name: "Guardar" }))
  await screen.findByText("Guardado")
  await fireEvent.press(screen.getByText("Volver"))
  await fireEvent.press(await screen.findByRole("button", { name: "Continuar valoración" }))
  expect(await screen.findByDisplayValue("79,9")).toBeTruthy()
  expect(falsa.leer).toHaveBeenCalledWith(CLIENTE, VISITA)
})

it("un conflicto no pisa el servidor: permite cargar la versión guardada o conservar la edición", async () => {
  const falsa = api()
  await abrirNueva(falsa)
  falsa.cambiar.mockRejectedValueOnce(conflicto())
  falsa.leer.mockResolvedValueOnce(visita(3, { peso: 70 }))
  await fireEvent.changeText(screen.getByLabelText("Peso (kg)"), "85")
  await fireEvent.press(screen.getByRole("button", { name: "Guardar" }))
  expect(await screen.findByText("Otra edición se guardó antes")).toBeTruthy()
  expect(screen.getByDisplayValue("85")).toBeTruthy()
  await fireEvent.press(screen.getByRole("button", { name: "Conservar mi edición" }))
  await waitFor(() => expect(screen.getByText("Cambios sin guardar")).toBeTruthy())
  expect(screen.getByDisplayValue("85")).toBeTruthy()
  await fireEvent.press(screen.getByRole("button", { name: "Guardar" }))
  await waitFor(() => expect(falsa.cambiar).toHaveBeenCalledTimes(2))
  expect(falsa.cambiar.mock.calls[1]![2].revision).toBe(3)

  falsa.cambiar.mockRejectedValueOnce(conflicto())
  falsa.leer.mockResolvedValueOnce(visita(6, { peso: 71 }))
  await fireEvent.changeText(screen.getByLabelText("Peso (kg)"), "86")
  await fireEvent.press(screen.getByRole("button", { name: "Guardar" }))
  await fireEvent.press(await screen.findByRole("button", { name: "Cargar versión guardada" }))
  expect(await screen.findByDisplayValue("71")).toBeTruthy()
  expect(screen.getByText("Guardado")).toBeTruthy()
})
