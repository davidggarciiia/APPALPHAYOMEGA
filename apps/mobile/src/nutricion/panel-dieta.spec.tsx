import { fireEvent, render, screen, waitFor } from "@testing-library/react-native"
import type { DocumentoDieta } from "@alpha-omega/shared"
import { ErrorDeRed } from "../lib/http"
import type { ApiNutricion } from "./api"
import { PanelDieta } from "./panel-dieta"

jest.mock("../componentes/iconos", () => ({ Icono: () => null }))

jest.mock("expo-router", () => ({
  useFocusEffect: (efecto: () => void) =>
    jest.requireActual<typeof import("react")>("react").useEffect(efecto, [efecto]),
}))
jest.mock("../lib/direccion-api", () => ({ direccionDeLaApi: () => "http://localhost:3000" }))

const CLIENTE = "20000000-0000-4000-8000-000000000000"
const TODOS = "00000000-0000-4000-8000-000000000001"

function documento(nombre: string): DocumentoDieta {
  return {
    formato: 1,
    nombre,
    tiposDeDia: [
      {
        id: TODOS,
        nombre: "Todos los días",
        objetivo: { kcal: 2000, proteinaG: null, hidratosG: null, grasaG: null },
        comidas: [],
      },
    ],
    semana: Array.from({ length: 7 }, () => TODOS),
    indicaciones: [],
  }
}

function api(cambios: Partial<ApiNutricion>): ApiNutricion {
  const falta = (): never => {
    throw new Error("no se usa")
  }
  return {
    vigente: jest.fn().mockResolvedValue({ dieta: null }),
    borrador: jest.fn().mockResolvedValue({
      borrador: {
        id: "50000000-0000-4000-8000-000000000000",
        clienteId: CLIENTE,
        revision: 3,
        documento: documento("Borrador de octubre"),
        actualizadoEn: "2026-09-24T10:00:00.000Z",
      },
    }),
    historico: jest.fn().mockResolvedValue({ dietas: [], total: 0 }),
    guardar: falta,
    publicar: falta,
    comidas: async () => ({ comidas: [] }),
    registrarComida: falta,
    quitarComida: falta,
    descartar: falta,
    delHistorico: falta,
    ...cambios,
  }
}

it("publicar pide confirmación y reintenta con la misma operación", async () => {
  const publicar = jest
    .fn()
    .mockRejectedValueOnce(new ErrorDeRed("Sin red"))
    .mockResolvedValueOnce({
      id: "50000000-0000-4000-8000-000000000000",
      clienteId: CLIENTE,
      documento: documento("Borrador de octubre"),
      publicadaEn: "2026-09-24T11:00:00.000Z",
    })
  const ids = ["70000000-0000-4000-8000-000000000001", "70000000-0000-4000-8000-000000000002"]
  const nuevoId = jest.fn(() => ids.shift() ?? "sin-id")
  await render(
    <PanelDieta clienteId={CLIENTE} api={api({ publicar })} editar={jest.fn()} nuevoId={nuevoId} />,
  )

  await fireEvent.press(await screen.findByRole("button", { name: "Publicar" }))
  expect(screen.getByText(/el cliente verá «Borrador de octubre»/)).toBeOnTheScreen()
  expect(publicar).not.toHaveBeenCalled()
  await fireEvent.press(screen.getByRole("button", { name: "Confirmar y publicar" }))
  expect(await screen.findByText(/no se publicará dos veces/)).toBeOnTheScreen()
  await fireEvent.press(screen.getByRole("button", { name: "Confirmar y publicar" }))
  await waitFor(() => expect(publicar).toHaveBeenCalledTimes(2))
  expect(publicar.mock.calls[1]).toEqual(publicar.mock.calls[0])
  expect(publicar.mock.calls[0]).toEqual([CLIENTE, "70000000-0000-4000-8000-000000000001", 3])
  expect(await screen.findByText("Dieta publicada. El cliente ya la ve.")).toBeOnTheScreen()
})

it("sin borrador ofrece editar la vigente o empezar de cero, y abre el histórico en lectura", async () => {
  const editar = jest.fn()
  const delHistorico = jest.fn().mockResolvedValue({
    id: "60000000-0000-4000-8000-000000000000",
    clienteId: CLIENTE,
    nombre: "Septiembre",
    estado: "archivada",
    publicadaEn: "2026-09-01T10:00:00.000Z",
    archivadaEn: "2026-09-24T10:00:00.000Z",
    publicadaPor: { id: "80000000-0000-4000-8000-000000000000", nombre: "Marta" },
    documento: documento("Septiembre"),
  })
  await render(
    <PanelDieta
      clienteId={CLIENTE}
      editar={editar}
      nuevoId={jest.fn()}
      api={api({
        borrador: jest.fn().mockResolvedValue({ borrador: null }),
        vigente: jest.fn().mockResolvedValue({
          dieta: {
            id: "90000000-0000-4000-8000-000000000000",
            clienteId: CLIENTE,
            documento: documento("Octubre"),
            publicadaEn: "2026-09-24T10:00:00.000Z",
          },
        }),
        historico: jest.fn().mockResolvedValue({
          total: 2,
          dietas: [
            {
              id: "90000000-0000-4000-8000-000000000000",
              nombre: "Octubre",
              estado: "publicada",
              publicadaEn: "2026-09-24T10:00:00.000Z",
              archivadaEn: null,
              publicadaPor: { id: "80000000-0000-4000-8000-000000000000", nombre: "Marta" },
            },
            {
              id: "60000000-0000-4000-8000-000000000000",
              nombre: "Septiembre",
              estado: "archivada",
              publicadaEn: "2026-09-01T10:00:00.000Z",
              archivadaEn: "2026-09-24T10:00:00.000Z",
              publicadaPor: { id: "80000000-0000-4000-8000-000000000000", nombre: "Marta" },
            },
          ],
        }),
        delHistorico,
      })}
    />,
  )
  await fireEvent.press(
    await screen.findByRole("button", { name: "Editar a partir de la vigente" }),
  )
  expect(editar).toHaveBeenCalledWith("vigente")
  await fireEvent.press(screen.getByRole("button", { name: "Nueva dieta desde cero" }))
  expect(editar).toHaveBeenCalledWith("nueva")
  await fireEvent.press(screen.getByRole("button", { name: "Ver Septiembre" }))
  expect(await screen.findByText("DIETA ANTERIOR · SOLO LECTURA")).toBeOnTheScreen()
  expect(screen.queryByRole("button", { name: "Editar Septiembre" })).toBeNull()
})
