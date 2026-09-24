import { describe, expect, it, jest } from "@jest/globals"
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native"
import type { BorradorDieta, DocumentoDieta } from "@alpha-omega/shared"

import type { ApiSeguimiento } from "../seguimiento/api"
import type { ApiNutricion } from "./api"
import { FichaNutricion } from "./ficha-nutricion"

jest.mock("expo-router", () => ({
  useFocusEffect: (efecto: () => void) =>
    jest.requireActual<typeof import("react")>("react").useEffect(efecto, [efecto]),
}))

const CLIENTE = "10000000-0000-4000-8000-000000000000"
let n = 0
const nuevoId = (): string => `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`

function apis() {
  const guardar = jest.fn(
    async (_c: string, revision: number, documento: DocumentoDieta): Promise<BorradorDieta> => ({
      id: "50000000-0000-4000-8000-000000000000",
      clienteId: CLIENTE,
      revision: revision + 1,
      documento,
      actualizadoEn: "2026-09-24T10:00:00.000Z",
    }),
  )
  const publicar = jest.fn(async () => {
    throw new Error("se sustituye")
  })
  const falta = (): never => {
    throw new Error("no se usa")
  }
  const nutricion = {
    vigente: async () => ({ dieta: null, deNutricionista: false }),
    borrador: async () => ({ borrador: null }),
    guardar,
    publicar,
    descartar: falta,
    historico: async () => ({ dietas: [], total: 0 }),
    delHistorico: falta,
    comidas: async () => ({ comidas: [] }),
    registrarComida: falta,
    quitarComida: falta,
  } as unknown as ApiNutricion
  const seguimiento = {
    medidas: async () => ({
      medidas: [
        {
          id: "40000000-0000-4000-8000-000000000001",
          fecha: "2026-09-15",
          pesoKg: 112.2,
          cinturaCm: 110,
          grasaPct: 29.2,
          alturaCm: 196,
          creadoEn: "2026-09-15T08:00:00.000Z",
        },
      ],
      fechaNacimiento: "2005-03-10",
    }),
    dias: async () => ({ dias: [] }),
  } as unknown as ApiSeguimiento
  return { nutricion, seguimiento, guardar, publicar }
}

describe("FichaNutricion", () => {
  it("calcula el gasto con las medidas y publica el objetivo", async () => {
    const { nutricion, seguimiento, guardar } = apis()
    const publicar = jest.fn(async () => ({}) as never)
    nutricion.publicar = publicar
    await render(
      <FichaNutricion
        clienteId={CLIENTE}
        nombre="David Gómez"
        api={nutricion}
        seguimiento={seguimiento}
        nuevoId={nuevoId}
        editar={() => undefined}
      />,
    )
    // 112,2 kg, 196 cm y 21 años (a 24/09/2026): basal de Mifflin-St Jeor.
    expect(await screen.findByText("2.247 kcal · Mifflin-St Jeor")).toBeTruthy()
    await fireEvent.changeText(screen.getByLabelText("Calorías del objetivo"), "3250")
    expect(screen.getByText("366 g")).toBeTruthy()
    expect(screen.getByText("203 g")).toBeTruthy()
    expect(screen.getByText("108 g")).toBeTruthy()
    expect(screen.getByText("Déficit de unos 230 kcal, un 7 %")).toBeTruthy()

    await fireEvent.press(screen.getAllByRole("button", { name: "Publicar cambios" })[0]!)
    await fireEvent.press(screen.getAllByRole("button", { name: "Publicar cambios" }).at(-1)!)
    await waitFor(() => expect(publicar).toHaveBeenCalled())
    const documento = guardar.mock.calls[0]![2]
    expect(documento.tiposDeDia[0]!.objetivo).toEqual({
      kcal: 3250,
      hidratosG: 366,
      proteinaG: 203,
      grasaG: 108,
    })
    expect(documento.calculo).toEqual(
      expect.objectContaining({
        pesoKg: 112.2,
        alturaCm: 196,
        sexo: "hombre",
        factorActividad: 1.55,
      }),
    )
  })
})
