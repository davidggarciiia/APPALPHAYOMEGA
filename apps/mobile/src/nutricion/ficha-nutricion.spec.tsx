import { describe, expect, it, jest } from "@jest/globals"
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native"
import type { BorradorDieta, DietaPublicada, DocumentoDieta } from "@alpha-omega/shared"
import { hoyAgenda } from "../entrenamiento/fechas"

import type { ApiSeguimiento } from "../seguimiento/api"
import type { ApiNutricion } from "./api"
import { FichaNutricion } from "./ficha-nutricion"

jest.mock("../componentes/iconos", () => ({ Icono: () => null }))

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
  it("conserva los objetivos sin publicar al consultar otra pestaña de la ficha", async () => {
    const { nutricion, seguimiento } = apis()
    await render(
      <FichaNutricion
        clienteId={CLIENTE}
        nombre="Cliente"
        api={nutricion}
        seguimiento={seguimiento}
        nuevoId={nuevoId}
        editar={() => undefined}
      />,
    )
    await screen.findByText("2.247 kcal · Mifflin-St Jeor")
    await fireEvent.changeText(screen.getByLabelText("Calorías del objetivo"), "2500")
    await fireEvent.press(screen.getByRole("tab", { name: "Seguimiento" }))
    await fireEvent.press(screen.getByRole("tab", { name: "Pauta" }))
    expect(screen.getByLabelText("Calorías del objetivo").props.value).toBe("2500")
  })

  it("pide confirmación antes de sustituir una pauta editada por el editor de comidas", async () => {
    const { nutricion, seguimiento } = apis()
    const editar = jest.fn()
    await render(
      <FichaNutricion
        clienteId={CLIENTE}
        nombre="Cliente"
        api={nutricion}
        seguimiento={seguimiento}
        nuevoId={nuevoId}
        editar={editar}
      />,
    )
    await screen.findByText("2.247 kcal · Mifflin-St Jeor")
    await fireEvent.changeText(screen.getByLabelText("Calorías del objetivo"), "2500")
    await fireEvent.press(screen.getByRole("tab", { name: "Historial" }))
    await fireEvent.press(await screen.findByRole("button", { name: "Nueva dieta desde cero" }))
    expect(editar).not.toHaveBeenCalled()
    await fireEvent.press(screen.getByRole("button", { name: "Seguir editando" }))
    await fireEvent.press(screen.getByRole("tab", { name: "Pauta" }))
    expect(screen.getByLabelText("Calorías del objetivo").props.value).toBe("2500")
  })

  it.each(["comidas", "dias"] as const)(
    "un fallo al cargar %s se muestra como desconocido y se puede reintentar sin perder la pauta",
    async (fallo) => {
      const { nutricion, seguimiento } = apis()
      const tipoId = nuevoId()
      const comidaId = nuevoId()
      const dieta: DietaPublicada = {
        id: nuevoId(),
        clienteId: CLIENTE,
        publicadaEn: "2026-09-24T10:00:00.000Z",
        documento: {
          formato: 1,
          nombre: "Una comida al día",
          indicaciones: [],
          semana: Array(7).fill(tipoId),
          tiposDeDia: [
            {
              id: tipoId,
              nombre: "Todos",
              objetivo: { kcal: 2400, proteinaG: null, hidratosG: null, grasaG: null },
              comidas: [
                {
                  id: comidaId,
                  nombre: "Comida",
                  hora: null,
                  indicacion: null,
                  forma: "intercambio",
                  columnas: [{ nombre: "Plato", alimentos: [{ nombre: "Arroz", cantidad: null }] }],
                },
              ],
            },
          ],
        },
      }
      nutricion.vigente = async () => ({ dieta, deNutricionista: true })
      const comidas = jest.fn<ApiNutricion["comidas"]>().mockResolvedValue({
        comidas: [
          {
            fecha: hoyAgenda(),
            comidaId,
            dietaId: dieta.id,
            eleccion: { tipo: "hecha" },
            registradaEn: "2026-09-24T10:00:00.000Z",
          },
        ],
      })
      const dias = jest.fn<ApiSeguimiento["dias"]>().mockResolvedValue({
        dias: [
          {
            fecha: hoyAgenda(),
            pesoKg: 80,
            pasos: 9000,
            suenoMin: 480,
            creatina: true,
            suplementos: [],
          },
        ],
      })
      if (fallo === "comidas") comidas.mockRejectedValueOnce(new Error("sin conexión"))
      else dias.mockRejectedValueOnce(new Error("sin conexión"))
      nutricion.comidas = comidas
      seguimiento.dias = dias
      await render(
        <FichaNutricion
          clienteId={CLIENTE}
          nombre="Cliente"
          api={nutricion}
          seguimiento={seguimiento}
          nuevoId={nuevoId}
          editar={() => undefined}
        />,
      )
      await screen.findByRole("alert")
      expect(
        screen.getByText(
          fallo === "comidas"
            ? /No se han podido cargar .*comidas/i
            : /No se han podido cargar .*registros diarios/i,
        ),
      ).toBeTruthy()
      expect(
        screen.getByLabelText(
          fallo === "comidas" ? "Comidas hechas: Desconocido" : "Peso medio: Desconocido",
        ),
      ).toBeTruthy()
      expect(screen.queryByText("0 de 7")).toBeNull()
      await fireEvent.press(screen.getByRole("tab", { name: "Seguimiento" }))
      if (fallo === "comidas") expect(screen.queryByText("0/1")).toBeNull()
      await fireEvent.press(screen.getByRole("tab", { name: "Pauta" }))
      await fireEvent.changeText(screen.getByLabelText("Calorías del objetivo"), "2500")
      await fireEvent.press(screen.getByRole("button", { name: "Reintentar seguimiento" }))
      await waitFor(() => expect(screen.queryByRole("alert")).toBeNull())
      expect(fallo === "comidas" ? comidas : dias).toHaveBeenCalledTimes(2)
      expect(screen.getByLabelText("Calorías del objetivo").props.value).toBe("2500")
      await fireEvent.press(screen.getByRole("tab", { name: "Seguimiento" }))
      expect(screen.getByText("1/1")).toBeTruthy()
    },
  )

  it.each(["publicar", "descartar"] as const)(
    "actualiza la ficha al %s desde el historial sin salir de la pantalla",
    async (accion) => {
      const { nutricion, seguimiento, guardar } = apis()
      const tipo = "00000000-0000-4000-8000-000000000001"
      const documento: DocumentoDieta = {
        formato: 1,
        nombre: "Octubre",
        tiposDeDia: [
          {
            id: tipo,
            nombre: "Todos los días",
            objetivo: { kcal: 2400, proteinaG: null, hidratosG: null, grasaG: null },
            comidas: [],
          },
        ],
        semana: Array.from({ length: 7 }, () => tipo),
        indicaciones: [],
      }
      let borrador: BorradorDieta | null = await guardar(CLIENTE, 0, documento)
      let dieta: DietaPublicada | null =
        accion === "publicar"
          ? null
          : {
              id: nuevoId(),
              clienteId: CLIENTE,
              publicadaEn: "2026-09-24T10:00:00.000Z",
              documento: {
                ...documento,
                tiposDeDia: [
                  {
                    ...documento.tiposDeDia[0]!,
                    objetivo: { kcal: 2000, proteinaG: null, hidratosG: null, grasaG: null },
                  },
                ],
              },
            }
      nutricion.vigente = async () => ({ dieta, deNutricionista: false })
      nutricion.borrador = async () => ({ borrador })
      nutricion.publicar = async () => {
        dieta = {
          id: nuevoId(),
          clienteId: CLIENTE,
          documento,
          publicadaEn: "2026-09-24T11:00:00.000Z",
        }
        borrador = null
        return dieta
      }
      nutricion.descartar = async () => {
        borrador = null
      }
      await render(
        <FichaNutricion
          clienteId={CLIENTE}
          nombre="Cliente"
          api={nutricion}
          seguimiento={seguimiento}
          nuevoId={nuevoId}
          editar={() => undefined}
        />,
      )
      await screen.findByDisplayValue("2400")
      await fireEvent.press(screen.getByRole("tab", { name: "Historial" }))
      const boton = accion === "publicar" ? "Publicar" : "Descartar borrador"
      await fireEvent.press(await screen.findByRole("button", { name: boton }))
      await fireEvent.press(
        screen.getByRole("button", {
          name: accion === "publicar" ? "Confirmar y publicar" : "Descartar borrador",
        }),
      )
      await screen.findByText(
        accion === "publicar" ? "Dieta publicada. El cliente ya la ve." : "Borrador descartado.",
      )
      if (accion === "publicar") {
        await waitFor(() => expect(screen.queryByText("Sin dieta publicada")).toBeNull())
        expect(screen.getByText("Octubre")).toBeTruthy()
      } else {
        await fireEvent.press(screen.getByRole("tab", { name: "Pauta" }))
        await waitFor(() =>
          expect(screen.getByLabelText("Calorías del objetivo").props.value).toBe("2000"),
        )
      }
    },
  )

  it("reintenta solo la publicación con la revisión ya guardada y la misma operación", async () => {
    const { nutricion, seguimiento, guardar } = apis()
    let intentos = 0
    const publicar = jest.fn(async (_cliente: string, _operacion: string, _revision: number) => {
      if (++intentos === 1) throw Error("Respuesta perdida")
      return {} as never
    })
    nutricion.publicar = publicar
    await render(
      <FichaNutricion
        clienteId={CLIENTE}
        nombre="Cliente"
        api={nutricion}
        seguimiento={seguimiento}
        nuevoId={nuevoId}
        editar={() => undefined}
      />,
    )
    await screen.findByText("2.247 kcal · Mifflin-St Jeor")
    await fireEvent.changeText(screen.getByLabelText("Calorías del objetivo"), "3250")
    for (let n = 0; n < 2; n++) {
      await fireEvent.press(screen.getAllByRole("button", { name: "Publicar cambios" })[0]!)
      await fireEvent.press(screen.getAllByRole("button", { name: "Publicar cambios" }).at(-1)!)
      await waitFor(() => expect(publicar).toHaveBeenCalledTimes(n + 1))
    }
    expect(guardar).toHaveBeenCalledTimes(1)
    expect(publicar.mock.calls[1]).toEqual(publicar.mock.calls[0])
    expect(publicar.mock.calls[1]![2]).toBe(1)
  })

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
