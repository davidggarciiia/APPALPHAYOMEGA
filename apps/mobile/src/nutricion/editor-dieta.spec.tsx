import { fireEvent, render, screen, waitFor } from "@testing-library/react-native"
import type { BorradorDieta, DocumentoDieta } from "@alpha-omega/shared"
import { ErrorDePeticion } from "../lib/http"
import type { ApiNutricion } from "./api"
import { EditorDieta } from "./editor-dieta"

jest.mock("../lib/direccion-api", () => ({ direccionDeLaApi: () => "http://localhost:3000" }))

const CLIENTE = "20000000-0000-4000-8000-000000000000"

function generador(): () => string {
  let n = 0
  return () => `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`
}

function api(cambios: Partial<ApiNutricion> = {}): ApiNutricion {
  const falta = (): never => {
    throw new Error("no se usa")
  }
  return {
    vigente: falta,
    borrador: falta,
    guardar: falta,
    publicar: falta,
    descartar: falta,
    historico: falta,
    delHistorico: falta,
    comidas: async () => ({ comidas: [] }),
    registrarComida: falta,
    quitarComida: falta,
    ...cambios,
  }
}

function borrador(documento: DocumentoDieta, revision: number): BorradorDieta {
  return {
    id: "50000000-0000-4000-8000-000000000000",
    clienteId: CLIENTE,
    revision,
    documento,
    actualizadoEn: "2026-09-24T10:00:00.000Z",
  }
}

it("guarda una dieta solo de objetivos con la revisión 0 y confirma el guardado", async () => {
  const guardar = jest.fn(async (_c: string, _r: number, documento: DocumentoDieta) =>
    borrador(documento, 1),
  )
  await render(
    <EditorDieta
      clienteId={CLIENTE}
      api={api({ guardar })}
      origen="nueva"
      ids={generador()}
      volver={jest.fn()}
    />,
  )
  await fireEvent.changeText(screen.getByLabelText("Nombre de la dieta"), "Objetivos de octubre")
  await fireEvent.changeText(screen.getByLabelText("Kcal — objetivo de Todos los días"), "2.100")
  await fireEvent.changeText(
    screen.getByLabelText("Proteína (g) — objetivo de Todos los días"),
    "150",
  )
  await fireEvent.press(screen.getByRole("button", { name: "Guardar borrador" }))
  await waitFor(() => expect(guardar).toHaveBeenCalledTimes(1))
  const [, revision, documento] = guardar.mock.calls[0]!
  expect(revision).toBe(0)
  expect(documento.tiposDeDia[0]?.objetivo).toEqual({
    kcal: 2100,
    proteinaG: 150,
    hidratosG: null,
    grasaG: null,
  })
  expect(await screen.findByText("Guardado")).toBeOnTheScreen()
})

it("no llama al servidor si falta algo y explica qué", async () => {
  const guardar = jest.fn()
  await render(
    <EditorDieta
      clienteId={CLIENTE}
      api={api({ guardar })}
      origen="nueva"
      ids={generador()}
      volver={jest.fn()}
    />,
  )
  await fireEvent.press(screen.getByRole("button", { name: "Guardar borrador" }))
  expect(await screen.findByText("Pon un nombre a la dieta.")).toBeOnTheScreen()
  expect(
    screen.getByText("Todos los días: añade una comida o algún número del objetivo."),
  ).toBeOnTheScreen()
  expect(guardar).not.toHaveBeenCalled()
})

it("ante un conflicto conserva la copia en pantalla y permite cargar la guardada", async () => {
  const guardar = jest
    .fn()
    .mockRejectedValue(
      new ErrorDePeticion({ statusCode: 409, codigo: "revision_obsoleta", message: "Ha cambiado" }),
    )
  const guardada: DocumentoDieta = {
    formato: 1,
    nombre: "La del nutricionista",
    tiposDeDia: [
      {
        id: "00000000-0000-4000-8000-000000000900",
        nombre: "Todos los días",
        objetivo: { kcal: 1900, proteinaG: null, hidratosG: null, grasaG: null },
        comidas: [],
      },
    ],
    semana: Array.from({ length: 7 }, () => "00000000-0000-4000-8000-000000000900"),
    indicaciones: [],
  }
  const leerBorrador = jest.fn().mockResolvedValue({ borrador: borrador(guardada, 4) })
  await render(
    <EditorDieta
      clienteId={CLIENTE}
      api={api({ guardar, borrador: leerBorrador })}
      origen="nueva"
      ids={generador()}
      volver={jest.fn()}
    />,
  )
  await fireEvent.changeText(screen.getByLabelText("Nombre de la dieta"), "Mi versión")
  await fireEvent.changeText(screen.getByLabelText("Kcal — objetivo de Todos los días"), "2000")
  await fireEvent.press(screen.getByRole("button", { name: "Guardar borrador" }))
  expect(
    await screen.findByText("Otra persona ha guardado esta dieta mientras la editabas"),
  ).toBeOnTheScreen()
  expect(screen.getByDisplayValue("Mi versión")).toBeOnTheScreen()
  await fireEvent.press(screen.getByRole("button", { name: "Cargar la versión guardada" }))
  expect(await screen.findByDisplayValue("La del nutricionista")).toBeOnTheScreen()
})

it("duplica una alternativa con un identificador nuevo", async () => {
  const guardar = jest.fn(async (_c: string, _r: number, documento: DocumentoDieta) =>
    borrador(documento, 1),
  )
  await render(
    <EditorDieta
      clienteId={CLIENTE}
      api={api({ guardar })}
      origen="nueva"
      ids={generador()}
      volver={jest.fn()}
    />,
  )
  await fireEvent.changeText(screen.getByLabelText("Nombre de la dieta"), "Con desayuno")
  await fireEvent.press(screen.getByRole("button", { name: "+ Comida" }))
  await fireEvent.press(screen.getByRole("button", { name: "Desayuno, desplegar" }))
  await fireEvent.changeText(screen.getByLabelText("Título del plato"), "Tostadas")
  await fireEvent.changeText(screen.getByLabelText("Alimento 1 — Tostadas"), "Pan integral")
  await fireEvent.changeText(screen.getByLabelText("Cantidad 1 — Tostadas"), "60 g")
  await fireEvent.press(screen.getByRole("button", { name: "Duplicar Tostadas" }))
  await fireEvent.press(screen.getByRole("button", { name: "Guardar borrador" }))
  await waitFor(() => expect(guardar).toHaveBeenCalledTimes(1))
  const comida = guardar.mock.calls[0]![2].tiposDeDia[0]!.comidas[0]!
  if (comida.forma !== "alternativas") throw new Error("forma inesperada")
  const [primera, segunda] = comida.grupos[0]!.alternativas
  expect(segunda?.alimentos).toEqual([{ nombre: "Pan integral", cantidad: "60 g" }])
  expect(segunda?.id).not.toBe(primera?.id)
})

it("permite elegir la forma de cada comida y propone intercambio para Comida y Cena", async () => {
  await render(
    <EditorDieta
      clienteId={CLIENTE}
      api={api()}
      origen="nueva"
      ids={generador()}
      volver={jest.fn()}
    />,
  )
  for (let n = 0; n < 3; n++) {
    await fireEvent.press(screen.getByRole("button", { name: "+ Comida" }))
  }
  await fireEvent.press(screen.getByRole("button", { name: "Comida, desplegar" }))
  expect(screen.getByRole("radio", { name: "Intercambio" })).toBeChecked()
  await fireEvent.press(screen.getByRole("radio", { name: "Platos completos" }))
  expect(
    screen.getByText(/los grupos de intercambio.*quedarán fuera de la dieta/i),
  ).toBeOnTheScreen()
  expect(screen.getByRole("radio", { name: "Intercambio" })).toBeChecked()
  await fireEvent.press(screen.getByRole("button", { name: "Cambiar a platos completos" }))
  expect(screen.getByRole("radio", { name: "Platos completos" })).toBeChecked()
})

it("avisa antes de apartar platos completos y deja cancelar el cambio sin perderlos", async () => {
  await render(
    <EditorDieta
      clienteId={CLIENTE}
      api={api()}
      origen="nueva"
      ids={generador()}
      volver={jest.fn()}
    />,
  )
  await fireEvent.press(screen.getByRole("button", { name: "+ Comida" }))
  await fireEvent.press(screen.getByRole("button", { name: "Desayuno, desplegar" }))
  await fireEvent.changeText(screen.getByLabelText("Título del plato"), "Tostadas")
  await fireEvent.changeText(screen.getByLabelText("Alimento 1 — Tostadas"), "Pan")

  await fireEvent.press(screen.getByRole("radio", { name: "Intercambio" }))
  expect(screen.getByText(/los platos completos.*quedarán fuera de la dieta/i)).toBeOnTheScreen()
  expect(screen.getByRole("radio", { name: "Platos completos" })).toBeChecked()
  await fireEvent.press(screen.getByRole("button", { name: "Cancelar cambio" }))
  expect(screen.getByDisplayValue("Tostadas")).toBeOnTheScreen()
  expect(screen.queryByText(/quedarán fuera de la dieta/i)).toBeNull()

  await fireEvent.press(screen.getByRole("radio", { name: "Intercambio" }))
  await fireEvent.press(screen.getByRole("button", { name: "Cambiar a intercambio" }))
  expect(screen.getByRole("radio", { name: "Intercambio" })).toBeChecked()
})
