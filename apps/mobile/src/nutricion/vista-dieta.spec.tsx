import { fireEvent, render, screen } from "@testing-library/react-native"
import type { DietaPublicada, DocumentoDieta } from "@alpha-omega/shared"
import type { AlmacenLocal } from "../entrenamiento/almacen-local"
import { ErrorDeRed } from "../lib/http"
import type { ApiNutricion } from "./api"
import { VistaDieta } from "./vista-dieta"

jest.mock("../componentes/iconos", () => ({ Icono: () => null }))

jest.mock("expo-router", () => ({
  useFocusEffect: (efecto: () => void) =>
    jest.requireActual<typeof import("react")>("react").useEffect(efecto, [efecto]),
}))
jest.mock("../lib/direccion-api", () => ({ direccionDeLaApi: () => "http://localhost:3000" }))

const CUENTA = "30000000-0000-4000-8000-000000000000"
const ENTRENO = "00000000-0000-4000-8000-000000000001"
const DESCANSO = "00000000-0000-4000-8000-000000000002"

function documento(): DocumentoDieta {
  return {
    formato: 1,
    nombre: "Plan de octubre",
    tiposDeDia: [
      {
        id: ENTRENO,
        nombre: "Entreno",
        objetivo: { kcal: 2300, proteinaG: 160, hidratosG: null, grasaG: null },
        comidas: [
          {
            forma: "alternativas",
            id: "00000000-0000-4000-8000-000000000010",
            nombre: "Desayuno",
            hora: "08:00",
            indicacion: null,
            grupos: [
              {
                nombre: "Opciones dulces",
                alternativas: [
                  {
                    id: "00000000-0000-4000-8000-000000000020",
                    titulo: "Tostadas con fruta",
                    alimentos: [
                      { nombre: "Pan integral", cantidad: "60 g" },
                      { nombre: "Pieza de fruta", cantidad: null },
                    ],
                    nota: null,
                    macros: null,
                  },
                ],
              },
            ],
          },
          {
            forma: "intercambio",
            id: "00000000-0000-4000-8000-000000000011",
            nombre: "Comida",
            hora: null,
            indicacion: null,
            columnas: [
              { nombre: "Proteína", alimentos: [{ nombre: "Pollo", cantidad: "al gusto" }] },
            ],
          },
        ],
      },
      {
        id: DESCANSO,
        nombre: "Descanso",
        objetivo: { kcal: 2100, proteinaG: null, hidratosG: null, grasaG: null },
        comidas: [],
      },
    ],
    // Lunes a sábado entreno; domingo descanso.
    semana: [ENTRENO, ENTRENO, ENTRENO, ENTRENO, ENTRENO, ENTRENO, DESCANSO],
    indicaciones: [{ titulo: "Cómo seguir el plan", texto: "Pesa los alimentos en crudo." }],
  }
}

function publicada(): DietaPublicada {
  return {
    id: "40000000-0000-4000-8000-000000000000",
    clienteId: CUENTA,
    documento: documento(),
    publicadaEn: "2026-09-24T10:00:00.000Z",
  }
}

function almacenEnMemoria(): AlmacenLocal & { datos: Map<string, unknown> } {
  const datos = new Map<string, unknown>()
  return {
    datos,
    habilitar: () => undefined,
    leer: async (_cuenta, clave, esquema) =>
      datos.has(clave) ? esquema.parse(datos.get(clave)) : null,
    guardar: async (_cuenta, clave, valor) => {
      datos.set(clave, JSON.parse(JSON.stringify(valor)))
    },
    borrar: async (_cuenta, clave) => {
      datos.delete(clave)
    },
    listar: async () => [...datos.keys()],
    limpiar: async () => datos.clear(),
  }
}

function api(vigente: ApiNutricion["vigente"]): ApiNutricion {
  const falta = (): never => {
    throw new Error("no se usa")
  }
  return {
    vigente,
    borrador: falta,
    guardar: falta,
    publicar: falta,
    descartar: falta,
    historico: falta,
    delHistorico: falta,
    comidas: async () => ({ comidas: [] }),
    registrarComida: falta,
    quitarComida: falta,
  }
}

afterEach(() => {
  jest.useRealTimers()
})

it("«Hoy» sigue el día de Madrid al pasar de domingo a lunes", async () => {
  jest.useFakeTimers()
  const almacen = almacenEnMemoria()
  const vigente = jest.fn().mockResolvedValue({ dieta: publicada() })
  jest.setSystemTime(new Date("2026-09-20T21:59:58Z")) // domingo 23:59:58 en Madrid
  const domingo = await render(
    <VistaDieta clienteId={CUENTA} cuenta={CUENTA} api={api(vigente)} almacen={almacen} />,
  )
  // Un día sin comidas enseña el objetivo, como «Nutrición sin nutricionista».
  expect(await screen.findByText("2.100")).toBeOnTheScreen()
  expect(screen.getByText("kcal al día")).toBeOnTheScreen()
  expect(screen.queryByText(/Proteína/)).toBeNull()
  await domingo.unmount()

  jest.setSystemTime(new Date("2026-09-20T22:00:01Z")) // lunes 00:00:01 en Madrid
  await render(
    <VistaDieta clienteId={CUENTA} cuenta={CUENTA} api={api(vigente)} almacen={almacen} />,
  )
  expect(await screen.findByRole("header", { name: "Hoy" })).toBeOnTheScreen()
  expect(screen.getByText("0 de 2")).toBeOnTheScreen()
})

it("muestra alternativas, intercambio e indicaciones tal como se escribieron", async () => {
  jest.useFakeTimers()
  jest.setSystemTime(new Date("2026-09-21T08:00:00Z")) // lunes
  await render(
    <VistaDieta
      clienteId={CUENTA}
      cuenta={CUENTA}
      api={api(jest.fn().mockResolvedValue({ dieta: publicada() }))}
      almacen={almacenEnMemoria()}
    />,
  )
  await fireEvent.press(await screen.findByRole("button", { name: "Ver la dieta de la semana" }))
  expect(await screen.findByText("2300")).toBeOnTheScreen()
  expect(screen.getByText("160 g")).toBeOnTheScreen()
  expect(screen.getByText("Opciones dulces")).toBeOnTheScreen()
  expect(screen.getByText("60 g")).toBeOnTheScreen()
  expect(screen.getByText("Pieza de fruta")).toBeOnTheScreen()
  expect(screen.getByText("al gusto")).toBeOnTheScreen()
  expect(screen.getByText("Elige un alimento de cada grupo y combínalos.")).toBeOnTheScreen()
  expect(screen.getByRole("header", { name: "Cómo seguir el plan" })).toBeOnTheScreen()
})

it("sin dieta publicada lo dice en lugar de enseñar un ejemplo", async () => {
  await render(
    <VistaDieta
      clienteId={CUENTA}
      cuenta={CUENTA}
      api={api(jest.fn().mockResolvedValue({ dieta: null }))}
      almacen={almacenEnMemoria()}
    />,
  )
  expect(await screen.findByText(/Tu dieta aún no está publicada/)).toBeOnTheScreen()
})

it("sin conexión enseña la última copia y, si no hay, pide conexión", async () => {
  const almacen = almacenEnMemoria()
  const vigente = jest.fn().mockResolvedValueOnce({ dieta: publicada() })
  const primera = await render(
    <VistaDieta clienteId={CUENTA} cuenta={CUENTA} api={api(vigente)} almacen={almacen} />,
  )
  expect(await screen.findByText("Dieta de tu entrenador")).toBeOnTheScreen()
  await primera.unmount()
  expect(almacen.datos.has("dieta-vigente")).toBe(true)

  vigente.mockRejectedValue(new ErrorDeRed("Sin red"))
  const sinRed = await render(
    <VistaDieta clienteId={CUENTA} cuenta={CUENTA} api={api(vigente)} almacen={almacen} />,
  )
  expect(await screen.findByText(/Sin conexión · copia del/)).toBeOnTheScreen()
  // Sin conexión se ve la dieta y se puede consultar el plato; no se marca desde el resumen.
  expect(screen.getByRole("button", { name: /^Desayuno, ahora: / })).toBeOnTheScreen()
  expect(screen.queryByRole("checkbox", { name: "Desayuno hecha" })).toBeNull()
  await sinRed.unmount()

  await render(
    <VistaDieta
      clienteId={CUENTA}
      cuenta={CUENTA}
      api={api(vigente)}
      almacen={almacenEnMemoria()}
    />,
  )
  expect(await screen.findByText(/Necesitas conexión para descargar tu dieta/)).toBeOnTheScreen()
})

it("abre la elección de comida sin registrarla desde el círculo del resumen", async () => {
  jest.useFakeTimers()
  jest.setSystemTime(new Date("2026-09-21T08:30:00Z")) // lunes 10:30 en Madrid
  const registrarComida = jest.fn()
  const abrirComida = jest.fn()
  await render(
    <VistaDieta
      clienteId={CUENTA}
      cuenta={CUENTA}
      api={{
        ...api(jest.fn().mockResolvedValue({ dieta: publicada(), deNutricionista: true })),
        registrarComida,
      }}
      almacen={almacenEnMemoria()}
      abrirComida={abrirComida}
    />,
  )
  expect(await screen.findByText("Dieta de tu nutricionista")).toBeOnTheScreen()
  expect(screen.getByRole("button", { name: /^Desayuno, ahora: / })).toBeOnTheScreen()
  expect(screen.queryByRole("checkbox", { name: "Desayuno hecha" })).toBeNull()
  await fireEvent.press(screen.getByRole("button", { name: /^Desayuno, ahora: / }))
  expect(abrirComida).toHaveBeenCalledWith(documento().tiposDeDia[0]?.comidas[0])
  expect(registrarComida).not.toHaveBeenCalled()
  expect(screen.getByText("0 de 2")).toBeOnTheScreen()
})
