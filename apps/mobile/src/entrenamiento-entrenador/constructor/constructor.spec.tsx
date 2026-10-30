import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react-native"
import { Platform } from "react-native"
import type { NavigationAction } from "expo-router/react-navigation"
import {
  AsignarPlanSchema,
  SeriePrescritaDistanciaSchema,
  type AsignarPlan,
} from "@alpha-omega/shared"

import { crearApiEntrenamiento } from "../../entrenamiento/api"
import type { AlmacenLocal } from "../../entrenamiento/almacen-local"
import type { ApiRutinas } from "../api-rutinas"
import { crearPeticionAutenticada } from "../../lib/peticion-autenticada"
import { ErrorDePeticion } from "../../lib/http"
import * as movimiento from "../../componentes/movimiento"
import {
  catalogoEnMemoria,
  ejercicioDePrueba,
} from "../../catalogo-ejercicios/pruebas/catalogo-en-memoria"
import type { SesionConDistancia } from "../editor-modelo"
import { ConstructorPlan } from "./constructor"
import {
  desdeSesionEnRutina,
  nuevoDia,
  nuevoEjercicio,
  type EjercicioDelConstructor,
} from "./modelo"
import { ListaDeSeccion } from "./partes"
import { objetivoConUnidad, PanelEjercicio, TablaPrincipal } from "./tabla"

jest.mock("expo-crypto", () => ({
  randomUUID: jest.requireActual<typeof import("node:crypto")>("node:crypto").randomUUID,
}))
jest.mock("../../componentes/iconos", () => ({ Icono: () => null }))
jest.mock("react-native-safe-area-context", () => ({
  ...jest.requireActual("react-native-safe-area-context"),
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 18, left: 0 }),
}))
jest.mock("../../lib/direccion-api", () => ({ direccionDeLaApi: () => "http://localhost:3000" }))
jest.mock("../../catalogo-ejercicios/figura-ejercicio", () => ({
  useAccesoAFiguras: () => ({
    base: "http://localhost:3000",
    token: "t",
    renovar: async () => undefined,
  }),
}))
jest.mock("../../entrenamiento/almacen-dispositivo", () => ({ almacenDispositivo: {} }))

const mockDispatch = jest.fn()
const mockPreventRemove = jest.fn<
  void,
  [boolean, (evento: { data: { action: NavigationAction }; repeat: () => void }) => void]
>()
jest.mock("expo-router", () => ({
  useNavigation: () => ({ dispatch: mockDispatch }),
  useFocusEffect: (efecto: () => void) =>
    jest.requireActual<typeof import("react")>("react").useEffect(efecto, [efecto]),
}))
jest.mock("expo-router/react-navigation", () => ({
  usePreventRemove: (...args: Parameters<typeof mockPreventRemove>) => mockPreventRemove(...args),
}))

const { randomUUID } = jest.requireActual<typeof import("node:crypto")>("node:crypto")

async function prepararConstructor(
  almacen: AlmacenLocal = almacenEnMemoria(),
  rutinas: ApiRutinas = { listar: jest.fn(), leer: jest.fn(), crear: jest.fn(), editar: jest.fn() },
  nombreCliente = "Cliente",
) {
  const api = crearApiEntrenamiento(crearPeticionAutenticada(() => "token"))
  const asignar = jest.spyOn(api, "asignar").mockRejectedValue(Error("Respuesta perdida"))
  const vista = await render(
    <ConstructorPlan
      clienteId="20000000-0000-4000-8000-000000000000"
      cuentaId="30000000-0000-4000-8000-000000000000"
      nombreCliente={nombreCliente}
      almacen={almacen}
      api={api}
      catalogo={catalogoEnMemoria([
        ejercicioDePrueba("10000000-0000-4000-8000-000000000000", "Press banca", "pecho"),
      ])}
      rutinas={rutinas}
      nuevoId={randomUUID}
      terminado={jest.fn()}
      volver={jest.fn()}
    />,
  )
  return { asignar, vista }
}

async function completarDia(): Promise<void> {
  await fireEvent.changeText(await screen.findByLabelText("Nombre del día"), "Fuerza")
  await fireEvent.press(screen.getAllByRole("button", { name: "Añadir desde la biblioteca" })[0]!)
  await fireEvent.press(await screen.findByRole("button", { name: "Añadir Press banca" }))
  await esperarCierreHoja()
  await waitFor(() => expect(screen.queryByLabelText("Buscar ejercicio para añadir")).toBeNull())
}

it("identifica al cliente con nombre y apellidos al previsualizar su plan", async () => {
  await prepararConstructor(undefined, undefined, "David Gómez")
  await completarDia()
  await fireEvent.press(screen.getByRole("button", { name: "Ver como cliente" }))
  expect(screen.getByText("Así lo verá David Gómez")).toBeOnTheScreen()
})

it("identifica al cliente con nombre y apellidos antes de publicar su plan", async () => {
  await prepararConstructor(undefined, undefined, "David Gómez")
  await completarDia()
  await fireEvent.press(screen.getByRole("button", { name: "Publicar" }))
  expect(screen.getByText(/^David Gómez verá el plan en su app/)).toBeOnTheScreen()
})

it("identifica al destinatario de una nota del ejercicio con nombre y apellidos", async () => {
  const ejercicio = nuevoEjercicio(
    { id: randomUUID(), nombre: "Press banca" },
    "principal",
    randomUUID,
  )
  await render(
    <PanelEjercicio
      ejercicio={ejercicio}
      nombreCliente="David Gómez"
      cambiar={jest.fn()}
      verTecnica={jest.fn()}
    />,
  )
  await fireEvent.press(screen.getByRole("button", { name: "Más" }))
  expect(screen.getByLabelText("Nota para David Gómez")).toBeOnTheScreen()
})

async function esperarCierreHoja(): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 220))
  })
}

async function abrirDatos(): Promise<void> {
  await fireEvent.press(screen.getByRole("button", { name: "Editar datos del bloque" }))
  await screen.findByLabelText("Número de semanas")
}

async function cerrarDatos(): Promise<void> {
  await fireEvent.press(screen.getByRole("button", { name: "Listo" }))
  await esperarCierreHoja()
  await waitFor(() => expect(screen.queryByLabelText("Número de semanas")).toBeNull())
}

async function abrirDatosDia(): Promise<void> {
  await fireEvent.press(screen.getByRole("button", { name: "Editar datos del día" }))
  await screen.findByLabelText("Duración estimada")
}

it("mantiene 44 px en cada día y permite recorrer la semana en pantallas estrechas", async () => {
  await prepararConstructor()
  await abrirDatosDia()

  expect(screen.getAllByRole("radio")).toHaveLength(7)
  for (const dia of screen.getAllByRole("radio"))
    expect(dia).toHaveStyle({ width: 44, minHeight: 44 })
  expect(screen.getByTestId("selector-dia-semana")).toHaveProp("horizontal", true)
})

it("abre la vista del cliente sin deslizamiento con movimiento reducido", async () => {
  const reducido = jest.spyOn(movimiento, "useMovimientoReducido").mockReturnValue(true)
  try {
    await prepararConstructor()
    await screen.findByLabelText("Nombre del día")
    await completarDia()
    await fireEvent.press(screen.getByRole("button", { name: "Ver como cliente" }))

    expect(screen.getByTestId("vista-cliente")).toHaveProp("animationType", "none")
  } finally {
    await screen.unmount()
    reducido.mockRestore()
  }
})

async function cerrarDatosDia(): Promise<void> {
  await fireEvent.press(screen.getByRole("button", { name: "Listo" }))
  await esperarCierreHoja()
  await waitFor(() => expect(screen.queryByLabelText("Duración estimada")).toBeNull())
}

async function abrirDetalles(nombre: string): Promise<void> {
  await esperarCierreHoja()
  await fireEvent.press(screen.getByRole("button", { name: `${nombre}: editar detalles` }))
  await fireEvent.press(await screen.findByRole("button", { name: "Más" }))
}

async function cerrarDetalles(): Promise<void> {
  await fireEvent.press(screen.getByRole("button", { name: "Listo" }))
  await esperarCierreHoja()
  await waitFor(() => expect(screen.queryByRole("header", { name: "Editar ejercicio" })).toBeNull())
}

async function escribirNumero(
  unidad: "SERIES" | "REPS" | "KG" | "SEG" | "M",
  valor: string,
): Promise<void> {
  await fireEvent.press(screen.getByRole("button", { name: new RegExp(`^Escribir ${unidad}:`) }))
  await fireEvent.changeText(screen.getByLabelText(`Valor manual ${unidad}`), valor)
}

async function escribirEnPanel(etiqueta: string, valor: string): Promise<void> {
  await fireEvent.press(screen.getByRole("button", { name: new RegExp(`^Escribir ${etiqueta}:`) }))
  const entrada = within(screen.getByTestId("hoja-contenido")).getByLabelText(etiqueta)
  await fireEvent.changeText(entrada, valor)
}

async function cambiarSeries(nombre: string, valor: string): Promise<void> {
  await fireEvent.press(screen.getByRole("button", { name: `Series de ${nombre}` }))
  await escribirNumero("SERIES", valor)
  await fireEvent.press(screen.getByRole("button", { name: "Listo" }))
  await waitFor(() => expect(screen.queryByTestId("barra-ajuste")).toBeNull())
}

describe("constructor móvil (D5)", () => {
  it("mantiene una sola barra de acciones y abre los datos del bloque en una hoja", async () => {
    await prepararConstructor()
    await screen.findByLabelText("Nombre del día")
    expect(screen.getAllByRole("button", { name: "Publicar" })).toHaveLength(1)
    expect(screen.getAllByRole("button", { name: "Ver como cliente" })).toHaveLength(1)
    expect(
      within(screen.getByTestId("pie-del-plan")).getByRole("button", { name: "Publicar" }),
    ).toBeOnTheScreen()
    expect(screen.queryByLabelText("Número de semanas")).toBeNull()
    await fireEvent.press(screen.getByRole("button", { name: "Editar datos del bloque" }))
    expect(await screen.findByLabelText("Número de semanas")).toBeOnTheScreen()
    expect(screen.getByLabelText("Lunes de inicio (AAAA-MM-DD)")).toHaveProp(
      "keyboardType",
      "numbers-and-punctuation",
    )
    await fireEvent.press(screen.getByRole("button", { name: "Listo" }))
    await esperarCierreHoja()
    await waitFor(() => expect(screen.queryByLabelText("Número de semanas")).toBeNull())
    expect(screen.getByLabelText("Nombre del día")).toBeOnTheScreen()
    expect(mockPreventRemove.mock.calls.at(-1)?.[0]).toBe(false)
  })

  it("autoguarda un cambio de la hoja de datos y lo conserva al cerrarla", async () => {
    const almacen = almacenEnMemoria()
    await prepararConstructor(almacen)
    await screen.findByLabelText("Nombre del día")
    await fireEvent.press(screen.getByRole("button", { name: "Editar datos del bloque" }))
    await fireEvent.changeText(await screen.findByLabelText("Número de semanas"), "8")
    await fireEvent.press(screen.getByRole("button", { name: "Cerrar hoja" }))
    await esperarCierreHoja()
    await waitFor(() => expect(screen.queryByLabelText("Número de semanas")).toBeNull())
    expect(mockPreventRemove.mock.calls.at(-1)?.[0]).toBe(true)
    await waitFor(
      () =>
        expect(almacen.datos.get("borrador-plan-20000000-0000-4000-8000-000000000000")).toEqual(
          expect.objectContaining({ semanas: "8" }),
        ),
      { timeout: 3000 },
    )
    await fireEvent.press(screen.getByRole("button", { name: "Editar datos del bloque" }))
    expect(screen.getByLabelText("Número de semanas")).toHaveDisplayValue("8")
  })

  it("añade desde la biblioteca en una hoja y la cierra al elegir un ejercicio", async () => {
    await prepararConstructor()
    await screen.findByLabelText("Nombre del día")
    expect(screen.queryByLabelText("Buscar ejercicio para añadir")).toBeNull()
    await fireEvent.press(screen.getByRole("button", { name: "Añadir desde la biblioteca" }))
    expect(await screen.findByLabelText("Buscar ejercicio para añadir")).toBeOnTheScreen()
    expect(screen.getByTestId("hoja-modal")).toBeOnTheScreen()
    await fireEvent.press(await screen.findByRole("button", { name: "Añadir Press banca" }))
    await esperarCierreHoja()
    await waitFor(() => expect(screen.queryByLabelText("Buscar ejercicio para añadir")).toBeNull())
    expect(screen.getByRole("button", { name: "Press banca: editar detalles" })).toBeOnTheScreen()
  })

  it("edita las cinco celdas con la barra y bloquea las acciones mientras la cifra manual es inválida", async () => {
    const rutinas: ApiRutinas = {
      listar: jest.fn(),
      leer: jest.fn(),
      crear: jest.fn(),
      editar: jest.fn(),
    }
    await prepararConstructor(almacenEnMemoria(), rutinas)
    await completarDia()
    for (const nombre of ["Series", "Repeticiones", "RIR", "Descanso"]) {
      expect(screen.getByRole("button", { name: `${nombre} de Press banca` })).toBeOnTheScreen()
    }
    expect(
      screen.getByRole("button", { name: /Carga inicial de Press banca: calibrar/ }),
    ).toBeOnTheScreen()
    expect(screen.queryByLabelText("Valor manual SERIES")).toBeNull()
    await cambiarSeries("Press banca", "4")
    expect(screen.getByRole("button", { name: "Series de Press banca" })).toHaveTextContent("4")
    await fireEvent.press(screen.getByRole("button", { name: "Repeticiones de Press banca" }))
    expect(screen.queryByLabelText("Valor manual REPS")).toBeNull()
    await escribirNumero("REPS", "0")
    expect(screen.getByLabelText("Valor manual REPS")).toHaveDisplayValue("0")
    expect(screen.getByRole("button", { name: "Publicar" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "Ver como cliente" })).toBeDisabled()
    const guardarPlantilla = screen.getByRole("button", { name: "Guardar como plantilla" })
    expect(guardarPlantilla).toBeDisabled()
    await fireEvent.press(guardarPlantilla)
    expect(rutinas.crear).not.toHaveBeenCalled()
    expect(screen.getByRole("button", { name: "Listo" })).toBeDisabled()
    await fireEvent.changeText(screen.getByLabelText("Valor manual REPS"), "9")
    await fireEvent.press(screen.getByRole("button", { name: "Listo" }))
    expect(screen.getByRole("button", { name: "Repeticiones de Press banca" })).toHaveTextContent(
      "9–10",
    )
    expect(screen.getByRole("button", { name: "Publicar" })).toBeEnabled()
  })

  it("autoguarda la nota editada en Más aunque se cierre la hoja sin pulsar Listo", async () => {
    const almacen = almacenEnMemoria()
    await prepararConstructor(almacen)
    await completarDia()
    await fireEvent.press(screen.getByRole("button", { name: "Press banca: editar detalles" }))
    expect(await screen.findByRole("header", { name: "Editar ejercicio" })).toBeOnTheScreen()
    expect(screen.queryByLabelText("Nota para Cliente")).toBeNull()
    await fireEvent.press(screen.getByRole("button", { name: "Más" }))
    await fireEvent.changeText(screen.getByLabelText("Nota para Cliente"), "Pausa de un segundo")
    await fireEvent.press(screen.getByRole("button", { name: "Cerrar hoja" }))
    await esperarCierreHoja()
    await waitFor(() => expect(screen.queryByLabelText("Nota para Cliente")).toBeNull())
    await waitFor(
      () =>
        expect(almacen.datos.get("borrador-plan-20000000-0000-4000-8000-000000000000")).toEqual(
          expect.objectContaining({
            dias: [
              expect.objectContaining({
                ejercicios: [expect.objectContaining({ nota: "Pausa de un segundo" })],
              }),
            ],
          }),
        ),
      { timeout: 3000 },
    )
    expect(mockPreventRemove.mock.calls.at(-1)?.[0]).toBe(true)
  })
})

it.each(["guardar", "publicar"] as const)(
  "no deja cancelar mientras espera %s el mismo plan",
  async (paso) => {
    const almacen = almacenEnMemoria()
    let liberar!: () => void
    const pausa = new Promise<void>((resolve) => {
      liberar = resolve
    })
    const guardar = almacen.guardar.bind(almacen)
    if (paso === "guardar")
      jest.spyOn(almacen, "guardar").mockImplementation(async (...args) => {
        await pausa
        await guardar(...args)
      })
    const { asignar } = await prepararConstructor(almacen)
    asignar.mockImplementation(async (_c, datos) => {
      if (paso === "publicar") await pausa
      return { id: randomUUID(), operacionId: datos.operacionId, sesiones: [] }
    })
    await completarDia()
    await fireEvent.press(screen.getByRole("button", { name: "Publicar" }))
    await fireEvent.press(await screen.findByRole("button", { name: "Publicar plan" }))
    try {
      const cancelar = await screen.findByRole("button", { name: "Cancelar" })
      expect(cancelar.props.accessibilityState?.disabled).toBe(true)
      await fireEvent.press(cancelar)
      expect(screen.getByRole("button", { name: "Publicando…" })).toBeTruthy()
    } finally {
      await act(async () => {
        liberar()
        await pausa
      })
    }
  },
)

it("pide confirmación del navegador al cerrar o recargar un plan editado sin publicación guardada", async () => {
  const plataforma = jest.replaceProperty(Platform, "OS", "web")
  const anteriorAgregar = Object.getOwnPropertyDescriptor(globalThis, "addEventListener")
  const anteriorQuitar = Object.getOwnPropertyDescriptor(globalThis, "removeEventListener")
  const oyentes = new Set<(evento: BeforeUnloadEvent) => void>()
  Object.defineProperty(globalThis, "addEventListener", {
    configurable: true,
    value: (tipo: string, listener: (e: BeforeUnloadEvent) => void) => {
      if (tipo === "beforeunload") oyentes.add(listener)
    },
  })
  Object.defineProperty(globalThis, "removeEventListener", {
    configurable: true,
    value: (tipo: string, listener: (e: BeforeUnloadEvent) => void) => {
      if (tipo === "beforeunload") oyentes.delete(listener)
    },
  })
  const { vista } = await prepararConstructor()
  const evento = () =>
    ({ preventDefault: jest.fn(), returnValue: undefined }) as unknown as BeforeUnloadEvent
  try {
    const inicial = evento()
    oyentes.forEach((listener) => listener(inicial))
    expect(inicial.preventDefault).not.toHaveBeenCalled()
    await fireEvent.changeText(screen.getByLabelText("Nombre del bloque"), "Plan no publicado")
    const editado = evento()
    oyentes.forEach((listener) => listener(editado))
    expect(editado.preventDefault).toHaveBeenCalledTimes(1)
    expect(editado.returnValue).toBe("")
    await fireEvent.changeText(screen.getByLabelText("Nombre del bloque"), "")
    const sinCambios = evento()
    oyentes.forEach((listener) => listener(sinCambios))
    expect(sinCambios.preventDefault).not.toHaveBeenCalled()
  } finally {
    await vista.unmount()
    plataforma.restore()
    if (anteriorAgregar) Object.defineProperty(globalThis, "addEventListener", anteriorAgregar)
    else Reflect.deleteProperty(globalThis, "addEventListener")
    if (anteriorQuitar) Object.defineProperty(globalThis, "removeEventListener", anteriorQuitar)
    else Reflect.deleteProperty(globalThis, "removeEventListener")
  }
})

it("conserva el editor al recuperar un objetivo inválido y explica el fallo al previsualizar", async () => {
  const almacen = almacenEnMemoria()
  const dia = nuevoDia(randomUUID, 1)
  dia.nombre = "Fuerza"
  dia.ejercicios = [
    {
      ...nuevoEjercicio({ id: randomUUID(), nombre: "Press banca" }, "principal", randomUUID),
      objetivo: "0",
    },
  ]
  almacen.datos.set("borrador-plan-20000000-0000-4000-8000-000000000000", {
    v: 1,
    nombre: "Plan",
    semanaInicial: "2026-11-02",
    semanas: "6",
    dias: [dia],
    bloque: { objetivos: [], fases: [], deportes: [], notas: [] },
  })
  await prepararConstructor(almacen)
  await fireEvent.press(await screen.findByRole("button", { name: "Recuperar mi plan" }))
  expect(screen.getByRole("button", { name: "Repeticiones de Press banca" })).toHaveTextContent("0")
  await fireEvent.press(screen.getByRole("button", { name: "Ver como cliente" }))
  expect(screen.getByText(/Revisa el plan antes de previsualizar/)).toBeOnTheScreen()
})

it("conserva el editor mientras el lunes está incompleto", async () => {
  await prepararConstructor()
  await completarDia()
  await abrirDatos()
  await fireEvent.changeText(screen.getByLabelText("Lunes de inicio (AAAA-MM-DD)"), "2026-")
  expect(screen.getByDisplayValue("2026-")).toBeOnTheScreen()
  await cerrarDatos()
  expect(screen.getByText("Cliente · fecha de inicio pendiente · 6 semanas")).toBeOnTheScreen()
  expect(screen.queryByText(/undefined/)).toBeNull()
  await fireEvent.press(screen.getByRole("button", { name: "Ver como cliente" }))
  expect(screen.getByText(/Revisa el plan antes de previsualizar/)).toBeOnTheScreen()
  await abrirDatos()
  await fireEvent.changeText(screen.getByLabelText("Lunes de inicio (AAAA-MM-DD)"), "2026-10-26")
  await cerrarDatos()
  expect(screen.getByText("Cliente · empieza el 26 oct · 6 semanas")).toBeOnTheScreen()
})

it("bloquea una publicación nueva si no puede recuperar la operación pendiente", async () => {
  const almacen = almacenEnMemoria()
  jest.spyOn(almacen, "leer").mockRejectedValue(Error("Clave no disponible"))
  const { asignar } = await prepararConstructor(almacen)
  expect(await screen.findByText(/No se pudo recuperar la publicación pendiente/)).toBeOnTheScreen()
  expect(screen.queryByRole("button", { name: "Publicar" })).toBeNull()
  expect(asignar).not.toHaveBeenCalled()
})

it("conserva la operación pendiente si el servidor la rechaza y falla su borrado local", async () => {
  const almacen = almacenEnMemoria()
  jest.spyOn(almacen, "borrar").mockRejectedValue(Error("Disco no disponible"))
  const { asignar } = await prepararConstructor(almacen)
  asignar.mockRejectedValue(
    new ErrorDePeticion({
      statusCode: 409,
      codigo: "operacion_incompatible",
      message: "Cuenta desactivada",
    }),
  )
  await completarDia()
  await fireEvent.press(screen.getByRole("button", { name: "Publicar" }))
  await fireEvent.press(await screen.findByRole("button", { name: "Publicar plan" }))
  expect(
    await screen.findByText(
      "No se pudo limpiar la publicación pendiente. Reintenta antes de editar.",
    ),
  ).toBeTruthy()
  expect(screen.getByRole("button", { name: "Reintentar publicación" })).toBeTruthy()
  expect(almacen.datos.size).toBe(1)
  expect(screen.queryByLabelText("Nombre del día")).toBeNull()
})

function almacenEnMemoria(): AlmacenLocal & { datos: Map<string, unknown> } {
  const datos = new Map<string, unknown>()
  return {
    datos,
    habilitar: () => undefined,
    leer: async (_c, clave, esquema) => (datos.has(clave) ? esquema.parse(datos.get(clave)) : null),
    guardar: async (_c, clave, valor) => {
      datos.set(clave, JSON.parse(JSON.stringify(valor)))
    },
    borrar: async (_c, clave) => {
      datos.delete(clave)
    },
    listar: async () => [...datos.keys()],
    limpiar: async () => datos.clear(),
  }
}

it("reenvía exactamente el plan pendiente tras perder la respuesta, con los mismos ids de series", async () => {
  const api = crearApiEntrenamiento(crearPeticionAutenticada(() => "token"))
  const asignar = jest
    .spyOn(api, "asignar")
    .mockRejectedValueOnce(Error("Respuesta perdida tras confirmar"))
    .mockImplementation(async (_c, datos) => ({
      id: randomUUID(),
      operacionId: datos.operacionId,
      sesiones: [],
    }))
  const almacen = almacenEnMemoria()
  const terminado = jest.fn()
  await render(
    <ConstructorPlan
      clienteId="20000000-0000-4000-8000-000000000000"
      cuentaId="30000000-0000-4000-8000-000000000000"
      nombreCliente="Cliente"
      almacen={almacen}
      api={api}
      catalogo={catalogoEnMemoria([
        ejercicioDePrueba(
          "10000000-0000-4000-8000-000000000000",
          "Press banca con barra",
          "pecho",
          [],
        ),
      ])}
      rutinas={{ listar: jest.fn(), leer: jest.fn(), crear: jest.fn(), editar: jest.fn() }}
      nuevoId={randomUUID}
      terminado={terminado}
      volver={jest.fn()}
    />,
  )
  await fireEvent.changeText(screen.getByLabelText("Nombre del día"), "Fuerza")
  await fireEvent.press(screen.getAllByRole("button", { name: "Añadir desde la biblioteca" })[0]!)
  await fireEvent.press(await screen.findByRole("button", { name: "Añadir Press banca con barra" }))
  await fireEvent.press(screen.getByRole("button", { name: "Publicar" }))
  await fireEvent.press(await screen.findByRole("button", { name: "Publicar plan" }))
  await screen.findByRole("button", { name: "Reintentar publicación" })
  expect(almacen.datos.size).toBe(1)
  await fireEvent.press(screen.getByRole("button", { name: "Reintentar publicación" }))
  await fireEvent.press(await screen.findByRole("button", { name: "Publicar plan" }))
  await waitFor(() => expect(asignar).toHaveBeenCalledTimes(2))
  expect(asignar.mock.calls[1]).toEqual(asignar.mock.calls[0])
  await waitFor(() => expect(terminado).toHaveBeenCalledTimes(1))
  expect(almacen.datos.size).toBe(0)
})

it("arma un día con la tabla del diseño y publica el plan con su bloque", async () => {
  const api = crearApiEntrenamiento(crearPeticionAutenticada(() => "token"))
  const asignar = jest.spyOn(api, "asignar").mockImplementation(
    async (_c, datos: AsignarPlan) =>
      ({
        id: randomUUID(),
        operacionId: datos.operacionId,
        sesiones: [],
      }) as never,
  )
  const catalogo = catalogoEnMemoria([
    ejercicioDePrueba("10000000-0000-4000-8000-000000000000", "Press banca con barra", "pecho", []),
  ])
  const terminado = jest.fn()
  const almacen = almacenEnMemoria()
  await render(
    <ConstructorPlan
      clienteId="20000000-0000-4000-8000-000000000000"
      cuentaId="30000000-0000-4000-8000-000000000000"
      nombreCliente="David Gómez"
      almacen={almacen}
      api={api}
      catalogo={catalogo}
      rutinas={{ listar: jest.fn(), leer: jest.fn(), crear: jest.fn(), editar: jest.fn() }}
      nuevoId={randomUUID}
      terminado={terminado}
      volver={jest.fn()}
    />,
  )
  await fireEvent.changeText(screen.getByLabelText("Nombre del bloque"), "Bloque 1 · Recomposición")
  await fireEvent.changeText(screen.getByLabelText("Nombre del día"), "Empuje")
  await abrirDatosDia()
  await fireEvent.changeText(screen.getByLabelText("Duración estimada"), "100–115 min")
  await cerrarDatosDia()

  // Fase del bloque.
  await abrirDatos()
  await fireEvent.press(screen.getByRole("button", { name: "Añadir fase" }))
  await fireEvent.changeText(screen.getByLabelText("Nombre de la fase 1"), "Calibrar")
  await fireEvent.changeText(screen.getByLabelText("Última semana de la fase 1"), "2")
  await cerrarDatos()

  // Press banca desde la biblioteca, en la parte principal.
  await fireEvent.press(screen.getAllByRole("button", { name: "Añadir desde la biblioteca" })[0]!)
  await fireEvent.press(await screen.findByRole("button", { name: "Añadir Press banca con barra" }))
  await abrirDetalles("Press banca con barra")
  await fireEvent.press(
    screen.getByRole("button", { name: "RIR cada serie de Press banca con barra" }),
  )
  await fireEvent.press(
    screen.getByRole("button", { name: "Con carga externa de Press banca con barra" }),
  )
  await escribirEnPanel("Series de Press banca con barra", "4")
  await escribirEnPanel("Reps mín. de Press banca con barra", "6")
  await escribirEnPanel("Reps máx. de Press banca con barra", "6")
  await fireEvent.press(screen.getByRole("radio", { name: "RIR 3" }))
  await escribirEnPanel("Carga inicial de Press banca con barra en kg", "60")
  await fireEvent.press(screen.getByRole("button", { name: "Subida 2,5 kg" }))
  await cerrarDetalles()

  await fireEvent.press(screen.getByRole("button", { name: "Publicar" }))
  await fireEvent.press(await screen.findByRole("button", { name: "Publicar plan" }))
  await waitFor(() => expect(terminado).toHaveBeenCalled())

  const datos = asignar.mock.calls[0]![1]
  expect(datos.nombre).toBe("Bloque 1 · Recomposición")
  expect(datos.bloque?.fases).toEqual([{ desde: 1, hasta: 2, nombre: "Calibrar", detalle: null }])
  const sesion = datos.patron.sesiones[0]!
  expect(sesion).toEqual(expect.objectContaining({ nombre: "Empuje", duracion: "100–115 min" }))
  expect(sesion.ejercicios[0]).toEqual(
    expect.objectContaining({
      rir: { min: 3, max: 3 },
      modoRir: "cadaSerie",
      tipoCarga: "conCargaExterna",
      subidaKg: 2.5,
    }),
  )
  expect(sesion.ejercicios[0]!.series).toHaveLength(4)
  expect(sesion.ejercicios[0]!.series[0]).toEqual(
    expect.objectContaining({ pesoKg: 60, repeticiones: 6 }),
  )
  // Confirmada la publicación, no queda nada pendiente.
  expect(almacen.datos.size).toBe(0)
})

it("no publica si falta algo y dice qué", async () => {
  const api = crearApiEntrenamiento(crearPeticionAutenticada(() => "token"))
  const asignar = jest.spyOn(api, "asignar")
  await render(
    <ConstructorPlan
      clienteId="20000000-0000-4000-8000-000000000000"
      cuentaId="30000000-0000-4000-8000-000000000000"
      nombreCliente="David Gómez"
      almacen={almacenEnMemoria()}
      api={api}
      catalogo={catalogoEnMemoria([])}
      rutinas={{ listar: jest.fn(), leer: jest.fn(), crear: jest.fn(), editar: jest.fn() }}
      nuevoId={randomUUID}
      terminado={jest.fn()}
      volver={jest.fn()}
    />,
  )
  await fireEvent.press(screen.getByRole("button", { name: "Publicar" }))
  expect(screen.getByText(/Pon nombre a cada día/)).toBeOnTheScreen()
  expect(asignar).not.toHaveBeenCalled()
})

it("confirma el descarte de un plan que se ha editado y permite seguir trabajando", async () => {
  const volver = jest.fn()
  await render(
    <ConstructorPlan
      clienteId="20000000-0000-4000-8000-000000000000"
      cuentaId="30000000-0000-4000-8000-000000000000"
      nombreCliente="Cliente"
      almacen={almacenEnMemoria()}
      api={crearApiEntrenamiento(crearPeticionAutenticada(() => "token"))}
      catalogo={catalogoEnMemoria([])}
      rutinas={{ listar: jest.fn(), leer: jest.fn(), crear: jest.fn(), editar: jest.fn() }}
      nuevoId={randomUUID}
      terminado={jest.fn()}
      volver={volver}
    />,
  )
  await fireEvent.changeText(screen.getByLabelText("Nombre del bloque"), "Mi plan")
  await fireEvent.press(screen.getByRole("button", { name: "Volver a la ficha" }))
  expect(volver).not.toHaveBeenCalled()
  await fireEvent.press(await screen.findByRole("button", { name: "Seguir editando" }))
  expect(screen.getByDisplayValue("Mi plan")).toBeOnTheScreen()
  await fireEvent.press(screen.getByRole("button", { name: "Volver a la ficha" }))
  await fireEvent.press(await screen.findByRole("button", { name: "Salir sin guardar" }))
  expect(volver).toHaveBeenCalledTimes(1)
})

it("protege la retirada de la ruta y solo continúa Atrás tras confirmar el descarte", async () => {
  await render(
    <ConstructorPlan
      clienteId="20000000-0000-4000-8000-000000000000"
      cuentaId="30000000-0000-4000-8000-000000000000"
      nombreCliente="Cliente"
      almacen={almacenEnMemoria()}
      api={crearApiEntrenamiento(crearPeticionAutenticada(() => "token"))}
      catalogo={catalogoEnMemoria([])}
      rutinas={{ listar: jest.fn(), leer: jest.fn(), crear: jest.fn(), editar: jest.fn() }}
      nuevoId={randomUUID}
      terminado={jest.fn()}
      volver={jest.fn()}
    />,
  )
  await fireEvent.changeText(screen.getByLabelText("Nombre del bloque"), "Mi plan")
  expect(mockPreventRemove.mock.calls.at(-1)?.[0]).toBe(true)
  const accion: NavigationAction = { type: "GO_BACK" }
  const repetir = jest.fn(() => mockDispatch(accion))
  await act(() =>
    mockPreventRemove.mock.calls.at(-1)![1]({ data: { action: accion }, repeat: repetir }),
  )
  expect(mockDispatch).not.toHaveBeenCalled()
  expect(repetir).not.toHaveBeenCalled()
  await fireEvent.press(await screen.findByRole("button", { name: "Seguir editando" }))
  expect(screen.getByDisplayValue("Mi plan")).toBeOnTheScreen()
  expect(mockPreventRemove.mock.calls.at(-1)?.[0]).toBe(true)
  await act(() =>
    mockPreventRemove.mock.calls.at(-1)![1]({ data: { action: accion }, repeat: repetir }),
  )
  await fireEvent.press(await screen.findByRole("button", { name: "Salir sin guardar" }))
  expect(mockPreventRemove.mock.calls.at(-1)?.[0]).toBe(false)
  expect(mockDispatch).toHaveBeenCalledTimes(1)
  expect(mockDispatch).toHaveBeenCalledWith(accion)
  expect(repetir).toHaveBeenCalledTimes(1)
})

it("«Qué buscamos» deja escribir la línea siguiente tras un salto", async () => {
  const api = crearApiEntrenamiento(crearPeticionAutenticada(() => "token"))
  await render(
    <ConstructorPlan
      clienteId="20000000-0000-4000-8000-000000000000"
      cuentaId="30000000-0000-4000-8000-000000000000"
      nombreCliente="David Gómez"
      almacen={almacenEnMemoria()}
      api={api}
      catalogo={catalogoEnMemoria([])}
      rutinas={{ listar: jest.fn(), leer: jest.fn(), crear: jest.fn(), editar: jest.fn() }}
      nuevoId={randomUUID}
      terminado={jest.fn()}
      volver={jest.fn()}
    />,
  )
  await abrirDatos()
  const campo = screen.getByLabelText("Qué buscamos, uno por línea")
  await fireEvent.changeText(campo, "Bajar grasa sin perder músculo\n")
  expect(screen.getByLabelText("Qué buscamos, uno por línea")).toHaveProp(
    "value",
    "Bajar grasa sin perder músculo\n",
  )
})

it("exporta las cuatro partes con sus dosis, duraciones y vueltas sin insertar HTML", async () => {
  const plataforma = jest.replaceProperty(Platform, "OS", "web")
  const anteriorAgregar = Object.getOwnPropertyDescriptor(globalThis, "addEventListener")
  const anteriorQuitar = Object.getOwnPropertyDescriptor(globalThis, "removeEventListener")
  const navegador = new EventTarget()
  Object.defineProperty(globalThis, "addEventListener", {
    configurable: true,
    value: navegador.addEventListener.bind(navegador),
  })
  Object.defineProperty(globalThis, "removeEventListener", {
    configurable: true,
    value: navegador.removeEventListener.bind(navegador),
  })
  let vista: Awaited<ReturnType<typeof render>> | undefined
  const escribir = jest.fn<void, [string]>()
  const ventana = {
    document: { write: escribir, close: jest.fn() },
    focus: jest.fn(),
    print: jest.fn(),
  }
  const abrirAnterior = window.open
  window.open = jest.fn(() => ventana as unknown as Window)
  try {
    const nombres = ["Movilidad", "Fuerza", "Circuito físico", "Estirar"]
    vista = await render(
      <ConstructorPlan
        clienteId="20000000-0000-4000-8000-000000000000"
        cuentaId="30000000-0000-4000-8000-000000000000"
        nombreCliente="Cliente <seguro>"
        almacen={almacenEnMemoria()}
        api={crearApiEntrenamiento(crearPeticionAutenticada(() => "token"))}
        catalogo={catalogoEnMemoria(
          nombres.map((nombre) => ejercicioDePrueba(randomUUID(), nombre, "pecho", [])),
        )}
        rutinas={{ listar: jest.fn(), leer: jest.fn(), crear: jest.fn(), editar: jest.fn() }}
        nuevoId={randomUUID}
        terminado={jest.fn()}
        volver={jest.fn()}
      />,
    )
    await fireEvent.changeText(screen.getByLabelText("Nombre del bloque"), "Plan <seguro>")
    await fireEvent.changeText(screen.getByLabelText("Nombre del día"), "Día de prueba")
    await abrirDatosDia()
    await fireEvent.changeText(screen.getByLabelText("Duración estimada"), "50–60 min")
    for (const [parte, minutos] of [
      ["calentamiento", "8–10"],
      ["fuerza", "30"],
      ["cardio", "6"],
      ["calma", "5"],
    ] as const) {
      await fireEvent.changeText(screen.getByLabelText(`Minutos de ${parte}`), minutos)
    }
    await cerrarDatosDia()
    await fireEvent.press(screen.getByRole("button", { name: "Añadir desde la biblioteca" }))
    await fireEvent.press(await screen.findByRole("button", { name: "Añadir Fuerza" }))
    await fireEvent.press(screen.getByRole("button", { name: "Añadir calentamiento" }))
    await fireEvent.press(await screen.findByRole("button", { name: "Añadir Movilidad" }))
    await abrirDetalles("Movilidad")
    await fireEvent.changeText(
      screen.getByLabelText("Cómo se hace Movilidad"),
      "1×8 por lado <suave>",
    )
    await cerrarDetalles()
    await fireEvent.press(screen.getByRole("button", { name: "Añadir circuito" }))
    await fireEvent.press(await screen.findByRole("button", { name: "Añadir Circuito físico" }))
    await fireEvent.changeText(screen.getByLabelText("Nombre del circuito"), "Core <controlado>")
    await fireEvent.changeText(screen.getByLabelText("Vueltas del circuito"), "2")
    await fireEvent.changeText(screen.getByLabelText("Descanso entre vueltas"), "30 s")
    await fireEvent.press(screen.getByRole("button", { name: "Añadir vuelta a la calma" }))
    await fireEvent.press(await screen.findByRole("button", { name: "Añadir Estirar" }))
    await abrirDetalles("Estirar")
    await fireEvent.changeText(screen.getByLabelText("Cómo se hace Estirar"), "30 s por lado")
    await cerrarDetalles()
    await fireEvent.press(screen.getByRole("button", { name: "Exportar PDF" }))

    const html = escribir.mock.calls[0]![0]
    expect(html).toContain("<th>Pauta</th>")
    expect(html).toContain("<h3>Calentamiento</h3>")
    expect(html).toContain("<h3>Parte principal</h3>")
    expect(html).toContain("<h3>Circuito · Core &lt;controlado&gt;</h3>")
    expect(html).toContain("<h3>Vuelta a la calma</h3>")
    for (const nombre of nombres) expect(html).toContain(`<td>${nombre}</td>`)
    expect(html).toContain("3 × 8–10")
    expect(html).toContain("1×8 por lado &lt;suave&gt;")
    expect(html).toContain("30 s por lado")
    expect(html).toContain("2 vueltas · 30 s entre vueltas")
    for (const minutos of ["8–10", "30", "6", "5"])
      expect(html).toContain(`Duración: ${minutos} min`)
    expect(html).toContain("Duración estimada 50–60 min")
    expect(html).toContain("Plan &lt;seguro&gt;")
    expect(html).toContain("Cliente &lt;seguro&gt;")
    expect(html).not.toContain("<controlado>")
    expect(ventana.print).toHaveBeenCalledTimes(1)
  } finally {
    await vista?.unmount()
    window.open = abrirAnterior
    plataforma.restore()
    if (anteriorAgregar) Object.defineProperty(globalThis, "addEventListener", anteriorAgregar)
    else Reflect.deleteProperty(globalThis, "addEventListener")
    if (anteriorQuitar) Object.defineProperty(globalThis, "removeEventListener", anteriorQuitar)
    else Reflect.deleteProperty(globalThis, "removeEventListener")
  }
})

describe("unidad de cada fila (D01)", () => {
  const GRANJERO = "10000000-0000-4000-8000-000000000011"
  // Datos sintéticos: un transporte con carga guardado en metros.
  const guardada: SesionConDistancia = {
    id: "20000000-0000-4000-8000-000000000011",
    nombre: "Fuerza",
    diaSemana: 1,
    ejercicios: [
      {
        id: "30000000-0000-4000-8000-000000000011",
        ejercicioId: GRANJERO,
        indicaciones: null,
        tipoCarga: "conCargaExterna",
        series: [1, 2].map((n) =>
          SeriePrescritaDistanciaSchema.parse({
            id: `40000000-0000-4000-8000-00000000001${n}`,
            tipoMedicion: "distancia",
            pesoKg: 32,
            metros: 20,
          }),
        ),
      },
    ],
  }
  const granjero = (): EjercicioDelConstructor =>
    desdeSesionEnRutina(guardada, { [GRANJERO]: "Paseo del granjero" }).ejercicios[0]!
  const banca = (): EjercicioDelConstructor =>
    nuevoEjercicio(
      { id: "10000000-0000-4000-8000-000000000012", nombre: "Press banca con barra" },
      "principal",
      randomUUID,
    )
  const plancha = (): EjercicioDelConstructor => ({
    ...nuevoEjercicio(
      { id: "10000000-0000-4000-8000-000000000013", nombre: "Plancha" },
      "principal",
      randomUUID,
    ),
    tipo: "tiempo",
    objetivo: "30",
  })
  const tabla = async (ejercicios: EjercicioDelConstructor[]): Promise<void> => {
    await render(
      <TablaPrincipal
        ejercicios={ejercicios}
        elegido={null}
        elegir={jest.fn()}
        cambiar={jest.fn()}
        ajustar={jest.fn()}
        quitar={jest.fn()}
        mover={jest.fn()}
        ancha
      />,
    )
  }

  it("la tabla principal nombra la unidad de cada fila y conserva la carga en metros", async () => {
    await tabla([banca(), granjero()])
    expect(screen.getByText("Reps / Metros")).toBeOnTheScreen()
    expect(screen.getByText("En metros")).toBeOnTheScreen()
    const metros = screen.getByLabelText("Metros de Paseo del granjero")
    expect(metros).toHaveTextContent("20")
    expect(screen.getByLabelText("Carga inicial de Paseo del granjero en kg")).toHaveTextContent(
      "32",
    )
    expect(screen.queryByLabelText(/^(Repeticiones|Segundos) de Paseo/)).toBeNull()
    expect(screen.getByLabelText("Repeticiones de Press banca con barra")).toHaveTextContent("8–10")
  })

  it("una tabla solo de repeticiones se ve como antes", async () => {
    await tabla([banca()])
    expect(screen.getByText("Reps")).toBeOnTheScreen()
    expect(screen.queryByText(/^En (segundos|metros)$/)).toBeNull()
  })

  it("una fila en segundos se nombra en segundos, no en repeticiones", async () => {
    await tabla([plancha()])
    expect(screen.getByText("Seg")).toBeOnTheScreen()
    expect(screen.getByText("En segundos")).toBeOnTheScreen()
    expect(screen.getByLabelText("Segundos de Plancha")).toHaveTextContent("30")
    expect(screen.queryByLabelText("Repeticiones de Plancha")).toBeNull()
  })

  it("el panel marca los metros de la fila y cambiar de unidad no arrastra la cantidad", async () => {
    const cambiar = jest.fn()
    await render(
      <PanelEjercicio
        ejercicio={granjero()}
        nombreCliente="Cliente de prueba"
        cambiar={cambiar}
        verTecnica={jest.fn()}
      />,
    )
    await fireEvent.press(screen.getByRole("button", { name: "Más" }))
    expect(
      screen.getByRole("button", { name: "Medir Paseo del granjero en metros" }),
    ).toHaveTextContent("✓ Metros")
    expect(screen.queryByLabelText("Se mide en segundos")).toBeNull()
    await fireEvent.press(
      screen.getByRole("button", { name: "Medir Paseo del granjero en repeticiones" }),
    )
    // La carga y los ids no se tocan; los 20 m nunca pasan a 20 repeticiones.
    expect(cambiar).toHaveBeenLastCalledWith(granjero().id, { tipo: "repeticiones", objetivo: "" })
  })

  it("al pautar se ofrecen las tres unidades y cambiar vacía el objetivo", async () => {
    const cambiar = jest.fn()
    const fila = banca()
    await render(
      <PanelEjercicio
        ejercicio={fila}
        nombreCliente="Cliente de prueba"
        cambiar={cambiar}
        verTecnica={jest.fn()}
      />,
    )
    await fireEvent.press(screen.getByRole("button", { name: "Más" }))
    expect(
      screen.getByRole("button", { name: "Medir Press banca con barra en repeticiones" }),
    ).toHaveTextContent("✓ Repeticiones")
    expect(
      screen.getAllByRole("button", { name: /^Medir Press banca con barra en / }),
    ).toHaveLength(3)
    // Tocar la unidad que ya tiene no borra el objetivo.
    await fireEvent.press(
      screen.getByRole("button", { name: "Medir Press banca con barra en repeticiones" }),
    )
    expect(cambiar).not.toHaveBeenCalled()
    await fireEvent.press(
      screen.getByRole("button", { name: "Medir Press banca con barra en segundos" }),
    )
    expect(cambiar).toHaveBeenLastCalledWith(fila.id, { tipo: "tiempo", objetivo: "" })
    // «8–10» nunca pasa a 8 m.
    await fireEvent.press(
      screen.getByRole("button", { name: "Medir Press banca con barra en metros" }),
    )
    expect(cambiar).toHaveBeenLastCalledWith(fila.id, { tipo: "distancia", objetivo: "" })
  })

  it("pauta un transporte en metros desde el panel y lo publica con su carga", async () => {
    const api = crearApiEntrenamiento(crearPeticionAutenticada(() => "token"))
    const asignar = jest
      .spyOn(api, "asignar")
      .mockImplementation(
        async (_c, datos: AsignarPlan) =>
          ({ id: randomUUID(), operacionId: datos.operacionId, sesiones: [] }) as never,
      )
    const terminado = jest.fn()
    await render(
      <ConstructorPlan
        clienteId="20000000-0000-4000-8000-000000000011"
        cuentaId="30000000-0000-4000-8000-000000000012"
        nombreCliente="Cliente de prueba"
        almacen={almacenEnMemoria()}
        api={api}
        catalogo={catalogoEnMemoria([
          ejercicioDePrueba(GRANJERO, "Paseo del granjero", "antebrazos", []),
        ])}
        rutinas={{ listar: jest.fn(), leer: jest.fn(), crear: jest.fn(), editar: jest.fn() }}
        nuevoId={randomUUID}
        terminado={terminado}
        volver={jest.fn()}
      />,
    )
    await fireEvent.changeText(screen.getByLabelText("Nombre del bloque"), "Bloque de prueba")
    await fireEvent.changeText(screen.getByLabelText("Nombre del día"), "Transportes")
    await fireEvent.press(screen.getAllByRole("button", { name: "Añadir desde la biblioteca" })[0]!)
    await fireEvent.press(await screen.findByRole("button", { name: "Añadir Paseo del granjero" }))
    await abrirDetalles("Paseo del granjero")
    await fireEvent.press(
      screen.getByRole("button", { name: "Con carga externa de Paseo del granjero" }),
    )
    await fireEvent.press(
      screen.getByRole("button", { name: "Medir Paseo del granjero en metros" }),
    )
    await escribirEnPanel("Series de Paseo del granjero", "2")
    await escribirEnPanel("Metros de Paseo del granjero", "20")
    await escribirEnPanel("Carga inicial de Paseo del granjero en kg", "32")
    await cerrarDetalles()

    await fireEvent.press(screen.getByRole("button", { name: "Publicar" }))
    await fireEvent.press(await screen.findByRole("button", { name: "Publicar plan" }))
    await waitFor(() => expect(terminado).toHaveBeenCalled())
    const datos = AsignarPlanSchema.parse(asignar.mock.calls[0]![1])
    const [transporte] = datos.patron.sesiones[0]!.ejercicios
    expect(transporte).toEqual(
      expect.objectContaining({ ejercicioId: GRANJERO, tipoCarga: "conCargaExterna" }),
    )
    expect(transporte!.series).toEqual([
      { id: expect.any(String), tipoMedicion: "distancia", pesoKg: 32, metros: 20 },
      { id: expect.any(String), tipoMedicion: "distancia", pesoKg: 32, metros: 20 },
    ])
  })

  it("la lista de calentamiento o final nombra la unidad de cada ejercicio", async () => {
    await render(
      <ListaDeSeccion
        ejercicios={[
          { ...granjero(), nombre: "Zancadas caminando", seccion: "final", tipoCarga: "sinCarga" },
          { ...plancha(), seccion: "final" },
          { ...banca(), nombre: "Sentadilla goblet", seccion: "calentamiento" },
        ]}
        elegido={null}
        elegir={jest.fn()}
        cambiar={jest.fn()}
        quitar={jest.fn()}
      />,
    )
    expect(
      screen.getByRole("button", { name: "Zancadas caminando: editar detalles" }),
    ).toHaveTextContent(/20 m/)
    expect(screen.getByRole("button", { name: "Plancha: editar detalles" })).toHaveTextContent(
      /30 s/,
    )
    expect(
      screen.getByRole("button", { name: "Sentadilla goblet: editar detalles" }),
    ).toHaveTextContent(/8–10/)
  })

  it("«Exportar PDF» escribe el objetivo con su unidad", () => {
    expect(objetivoConUnidad(banca())).toBe("8–10")
    expect(objetivoConUnidad(plancha())).toBe("30 s")
    expect(objetivoConUnidad(granjero())).toBe("20 m")
    expect(objetivoConUnidad({ ...plancha(), objetivo: "" })).toBe("")
  })
})

describe("autoguardado del borrador (T-01)", () => {
  const CLAVE_BORRADOR = "borrador-plan-20000000-0000-4000-8000-000000000000"
  // Android puede matar el proceso en segundo plano: lo montado no puede vivir solo en memoria.
  const hastaGuardar = { timeout: 3000 }

  it("guarda ajustes editados en el borrador, los recupera y los publica (D10)", async () => {
    const almacen = almacenEnMemoria()
    const { vista } = await prepararConstructor(almacen)
    await completarDia()
    await abrirDatos()
    await fireEvent.press(screen.getByRole("button", { name: "Añadir fase" }))
    await fireEvent.changeText(screen.getByLabelText("Nombre de la fase 1"), "Descarga")
    await fireEvent.press(screen.getByRole("button", { name: "Descarga para la fase 1" }))
    await fireEvent.changeText(screen.getByLabelText("Carga en porcentaje de la fase 1"), "90")
    await cerrarDatos()
    const ajustes = {
      rirCompuestos: { min: 3, max: 4 },
      rirAccesorios: { min: 3, max: 4 },
      factorSeries: 0.5,
      factorCarga: 0.9,
    }
    await waitFor(
      () =>
        expect(almacen.datos.get(CLAVE_BORRADOR)).toEqual(
          expect.objectContaining({
            bloque: expect.objectContaining({ fases: [expect.objectContaining({ ajustes })] }),
          }),
        ),
      hastaGuardar,
    )
    await vista.unmount()
    const { asignar } = await prepararConstructor(almacen)
    asignar.mockImplementation(async (_c, datos) => ({
      id: randomUUID(),
      operacionId: datos.operacionId,
      sesiones: [],
    }))
    await fireEvent.press(await screen.findByRole("button", { name: "Recuperar mi plan" }))
    await abrirDatos()
    expect(screen.getByLabelText("Carga en porcentaje de la fase 1")).toHaveDisplayValue("90")
    await cerrarDatos()
    await fireEvent.press(screen.getByRole("button", { name: "Publicar" }))
    await fireEvent.press(await screen.findByRole("button", { name: "Publicar plan" }))
    await waitFor(() => expect(asignar).toHaveBeenCalledTimes(1))
    expect(AsignarPlanSchema.parse(asignar.mock.calls[0]![1]).bloque?.fases[0]?.ajustes).toEqual(
      ajustes,
    )
  })

  it("previsualiza cada semana incluso con fase textual solapada sin alterar el patrón (D10)", async () => {
    const { asignar } = await prepararConstructor()
    await completarDia()
    await abrirDatos()
    await fireEvent.press(screen.getByRole("button", { name: "Añadir fase" }))
    await fireEvent.changeText(screen.getByLabelText("Nombre de la fase 1"), "Base")
    await fireEvent.changeText(screen.getByLabelText("Última semana de la fase 1"), "6")
    await fireEvent.press(screen.getByRole("button", { name: "Añadir fase" }))
    await fireEvent.changeText(screen.getByLabelText("Primera semana de la fase 2"), "2")
    await fireEvent.changeText(screen.getByLabelText("Última semana de la fase 2"), "2")
    await fireEvent.changeText(screen.getByLabelText("Nombre de la fase 2"), "Descarga")
    await fireEvent.press(screen.getByRole("button", { name: "Descarga para la fase 2" }))
    await cerrarDatos()
    await fireEvent.press(screen.getByRole("button", { name: "Ver como cliente" }))
    const previa = within(screen.getByTestId("vista-cliente"))
    expect(previa.getByRole("button", { name: /Press banca, 3×8–10/ })).toBeOnTheScreen()
    await fireEvent.press(previa.getByRole("tab", { name: "Semana 2" }))
    expect(previa.getByRole("button", { name: /Press banca, 2×8–10, RIR 3–4/ })).toBeOnTheScreen()
    expect(previa.getByTestId("ajustes-semana-previa")).toHaveTextContent(/50 %/)
    await fireEvent.press(previa.getByRole("button", { name: "Cerrar la vista del cliente" }))
    await fireEvent.press(screen.getByRole("button", { name: "Publicar" }))
    await fireEvent.press(await screen.findByRole("button", { name: "Publicar plan" }))
    await waitFor(() => expect(asignar).toHaveBeenCalledTimes(1))
    expect(asignar.mock.calls[0]![1].patron.sesiones[0]!.ejercicios[0]!.series).toHaveLength(3)
  })

  it("autoguarda lo montado y lo ofrece al reabrir; recuperarlo lo devuelve tal cual", async () => {
    const almacen = almacenEnMemoria()
    const { vista } = await prepararConstructor(almacen)
    await completarDia()
    await waitFor(() => expect(almacen.datos.has(CLAVE_BORRADOR)).toBe(true), hastaGuardar)

    await vista.unmount()
    await prepararConstructor(almacen)
    expect(await screen.findByText(/Tienes un plan sin publicar guardado/)).toBeTruthy()
    await fireEvent.press(screen.getByRole("button", { name: "Recuperar mi plan" }))
    expect(await screen.findByDisplayValue("Fuerza")).toBeTruthy()
    expect(screen.queryByText(/Tienes un plan sin publicar guardado/)).toBeNull()
  })

  it("«Empezar de cero» descarta el borrador guardado", async () => {
    const almacen = almacenEnMemoria()
    const { vista } = await prepararConstructor(almacen)
    await completarDia()
    await waitFor(() => expect(almacen.datos.has(CLAVE_BORRADOR)).toBe(true), hastaGuardar)

    await vista.unmount()
    await prepararConstructor(almacen)
    await fireEvent.press(await screen.findByRole("button", { name: "Empezar de cero" }))
    expect(almacen.datos.has(CLAVE_BORRADOR)).toBe(false)
    expect(screen.queryByText(/Tienes un plan sin publicar guardado/)).toBeNull()
  })

  it("sin cambios no guarda nada y no molesta con el aviso", async () => {
    const almacen = almacenEnMemoria()
    await prepararConstructor(almacen)
    await screen.findByLabelText("Nombre del día")
    await new Promise((resolver) => setTimeout(resolver, 1100))
    expect(almacen.datos.has(CLAVE_BORRADOR)).toBe(false)
    expect(screen.queryByText(/Tienes un plan sin publicar guardado/)).toBeNull()
  })

  it("al publicar con éxito el borrador se borra", async () => {
    const almacen = almacenEnMemoria()
    const { asignar } = await prepararConstructor(almacen)
    asignar.mockImplementation(async (_c, datos) => ({
      id: randomUUID(),
      operacionId: datos.operacionId,
      sesiones: [],
    }))
    await completarDia()
    await waitFor(() => expect(almacen.datos.has(CLAVE_BORRADOR)).toBe(true), hastaGuardar)
    await fireEvent.press(screen.getByRole("button", { name: "Publicar" }))
    await fireEvent.press(await screen.findByRole("button", { name: "Publicar plan" }))
    await waitFor(() => expect(asignar).toHaveBeenCalledTimes(1), hastaGuardar)
    await waitFor(() => expect(almacen.datos.has(CLAVE_BORRADOR)).toBe(false), hastaGuardar)
  })
})

describe("elegir una plantilla (T-02)", () => {
  const plantilla = {
    id: "70000000-0000-4000-8000-000000000000",
    revision: 1,
    nombre: "Plantilla pierna",
    patron: {
      sesiones: [
        {
          id: "70000000-0000-4000-8000-000000000001",
          nombre: "Pierna",
          diaSemana: 3,
          ejercicios: [],
        },
      ],
    },
  }
  const rutinas = (): ApiRutinas => ({
    listar: jest.fn(async () => ({ rutinas: [plantilla], total: 1 })) as never,
    leer: jest.fn(),
    crear: jest.fn(),
    editar: jest.fn(),
  })
  const elegirPlantilla = async (): Promise<void> => {
    await abrirDatos()
    await fireEvent.press(screen.getByRole("button", { name: "Partir de una plantilla" }))
    await fireEvent.press(await screen.findByRole("button", { name: "Elegir Plantilla pierna" }))
    await esperarCierreHoja()
  }

  it("con lo montado pregunta antes de sustituirlo y «Conservar lo mío» no cambia nada", async () => {
    await prepararConstructor(almacenEnMemoria(), rutinas())
    await completarDia()
    await elegirPlantilla()
    expect(await screen.findByText("¿Sustituir lo que has montado?")).toBeTruthy()
    await fireEvent.press(screen.getByRole("button", { name: "Conservar lo mío" }))
    expect(screen.queryByText("¿Sustituir lo que has montado?")).toBeNull()
    expect(screen.getByDisplayValue("Fuerza")).toBeTruthy()
    expect(screen.queryByDisplayValue("Plantilla pierna")).toBeNull()
  })

  it("al confirmar, la plantilla reemplaza lo montado", async () => {
    await prepararConstructor(almacenEnMemoria(), rutinas())
    await completarDia()
    await elegirPlantilla()
    await fireEvent.press(await screen.findByRole("button", { name: "Sustituir por la plantilla" }))
    expect(await screen.findByDisplayValue("Plantilla pierna")).toBeTruthy()
    expect(screen.queryByDisplayValue("Fuerza")).toBeNull()
  })

  it("sin nada montado la carga directamente, sin preguntar", async () => {
    await prepararConstructor(almacenEnMemoria(), rutinas())
    await elegirPlantilla()
    expect(await screen.findByDisplayValue("Plantilla pierna")).toBeTruthy()
    expect(screen.queryByText("¿Sustituir lo que has montado?")).toBeNull()
  })
})

describe("quitar un día (T-04)", () => {
  // «Quitar día» elimina todos los ejercicios de ese día: no puede ser un toque suelto.
  const conDosDias = async (): Promise<void> => {
    await prepararConstructor()
    await completarDia()
    await fireEvent.press(screen.getByRole("button", { name: "Añadir día" }))
    await fireEvent.press(await screen.findByText(/Lun · Fuerza/))
  }

  it("con ejercicios pregunta antes y «Conservarlo» no quita nada", async () => {
    await conDosDias()
    await fireEvent.press(screen.getByRole("button", { name: "Quitar día" }))
    expect(await screen.findByText("¿Quitar este día?")).toBeTruthy()
    await fireEvent.press(screen.getByRole("button", { name: "Conservarlo" }))
    expect(screen.queryByText("¿Quitar este día?")).toBeNull()
    expect(screen.getByText(/Lun · Fuerza/)).toBeTruthy()
  })

  it("al confirmar, el día se quita", async () => {
    await conDosDias()
    await fireEvent.press(screen.getByRole("button", { name: "Quitar día" }))
    await fireEvent.press(await screen.findByRole("button", { name: "Quitar este día" }))
    expect(screen.queryByText(/Lun · Fuerza/)).toBeNull()
  })

  it("un día vacío se quita directamente, sin preguntar", async () => {
    await prepararConstructor()
    await fireEvent.press(await screen.findByRole("button", { name: "Añadir día" }))
    await fireEvent.press(screen.getByRole("button", { name: "Quitar día" }))
    expect(screen.queryByText("¿Quitar este día?")).toBeNull()
    expect(screen.queryByText(/Mar · Sin nombre/)).toBeNull()
  })
})

describe("errores de publicación (T-05)", () => {
  it.each([
    [{ carga: "-5", calibrar: false }, /carga inicial.*0/i],
    [{ subida: "0" }, /subida/i],
    [{ subida: "51" }, /subida.*50/i],
    [{ nota: "x".repeat(301) }, /nota.*300/i],
    [{ indicaciones: "x".repeat(2001) }, /indicaciones.*2000/i],
    [{ descanso: "x".repeat(31) }, /descanso.*30/i],
    [{ alternativas: "x".repeat(81) }, /alternativas.*80/i],
  ] satisfies Array<[Partial<EjercicioDelConstructor>, RegExp]>)(
    "señala día, ejercicio y campo al publicar %j",
    async (cambio, campo) => {
      const almacen = almacenEnMemoria()
      const dias = [nuevoDia(randomUUID, 1), nuevoDia(randomUUID, 3)]
      dias.forEach((dia, n) => {
        dia.nombre = n === 0 ? "Fuerza" : "Pierna"
        dia.ejercicios = [
          nuevoEjercicio(
            { id: "10000000-0000-4000-8000-000000000000", nombre: "Press banca" },
            "principal",
            randomUUID,
          ),
        ]
      })
      Object.assign(dias[1]!.ejercicios[0]!, cambio)
      almacen.datos.set("borrador-plan-20000000-0000-4000-8000-000000000000", {
        v: 1,
        nombre: "Plan",
        semanaInicial: "2026-11-02",
        semanas: "6",
        dias,
        bloque: { objetivos: [], fases: [], deportes: [], notas: [] },
      })
      const { asignar } = await prepararConstructor(almacen)
      await fireEvent.press(await screen.findByRole("button", { name: "Recuperar mi plan" }))
      await fireEvent.press(screen.getByRole("button", { name: "Publicar" }))
      const mensaje = screen.getByRole("alert").props.children as string
      expect(mensaje).toMatch(/miércoles.*Pierna.*Press banca/i)
      expect(mensaje).toMatch(campo)
      expect(screen.getByLabelText("Nombre del día").props.value).toBe("Pierna")
      expect(asignar).not.toHaveBeenCalled()
      expect(screen.queryByText("¿Publicar el plan?")).toBeNull()
    },
  )

  it("nombra las semanas del plan cuando su número está fuera de rango", async () => {
    await prepararConstructor()
    await completarDia()
    await abrirDatos()
    await fireEvent.changeText(screen.getByLabelText("Número de semanas"), "53")
    await cerrarDatos()
    await fireEvent.press(screen.getByRole("button", { name: "Publicar" }))
    expect(screen.getByRole("alert").props.children).toMatch(/semanas.*52/i)
  })

  it("limita el descanso al tamaño admitido al escribir", async () => {
    await prepararConstructor()
    await completarDia()
    await abrirDetalles("Press banca")
    await fireEvent.press(screen.getByRole("button", { name: "Descanso Otro" }))
    expect(
      within(screen.getByTestId("hoja-contenido")).getByLabelText("Descanso de Press banca").props
        .maxLength,
    ).toBe(30)
  })
})

describe("deshacer una retirada (T-04)", () => {
  const prepararRetiradas = async (fases = 3, deportes = 3, recuperar = true) => {
    const almacen = almacenEnMemoria()
    const dia = nuevoDia(randomUUID, 1)
    dia.nombre = "Fuerza"
    dia.ejercicios = ["Primero", "Segundo", "Tercero"].map((nombre) =>
      nuevoEjercicio(
        { id: "10000000-0000-4000-8000-000000000000", nombre },
        "principal",
        randomUUID,
      ),
    )
    almacen.datos.set("borrador-plan-20000000-0000-4000-8000-000000000000", {
      v: 1,
      nombre: "Plan",
      semanaInicial: "2026-11-02",
      semanas: "6",
      dias: [dia],
      bloque: {
        objetivos: [],
        fases: Array.from(
          { length: fases },
          (_, n) => ["Base", "Fuerza", "Descarga"][n] ?? `Fase ${n + 1}`,
        ).map((nombre, n) => ({
          nombre,
          desde: n + 1,
          hasta: n + 1,
          detalle: null,
        })),
        deportes: ["Correr", "Nadar", "Bici", "Caminar"]
          .slice(0, deportes)
          .map((nombre) => ({ nombre, dias: [4], minutos: 60 })),
        notas: [],
      },
    })
    await prepararConstructor(almacen)
    const boton = await screen.findByRole("button", { name: "Recuperar mi plan" })
    if (recuperar) await fireEvent.press(boton)
    return almacen
  }

  it("restaura solo el ejercicio en su posición y conserva las ediciones posteriores", async () => {
    await prepararRetiradas()
    await fireEvent.press(screen.getByRole("button", { name: "Quitar Segundo" }))
    expect(screen.queryByLabelText("Series de Segundo")).toBeNull()
    await cambiarSeries("Tercero", "5")
    await fireEvent.press(screen.getByRole("button", { name: "Deshacer" }))
    expect(screen.getAllByLabelText(/^Series de /).map((c) => c.props.accessibilityLabel)).toEqual([
      "Series de Primero",
      "Series de Segundo",
      "Series de Tercero",
    ])
    expect(screen.getByLabelText("Series de Tercero")).toHaveTextContent("5")
    expect(screen.queryByRole("button", { name: "Deshacer" })).toBeNull()
  })

  it("restaura solo la fase en su posición y conserva las ediciones posteriores", async () => {
    await prepararRetiradas()
    await abrirDatos()
    await fireEvent.press(screen.getByRole("button", { name: "Quitar la fase 2" }))
    await fireEvent.changeText(screen.getByLabelText("Detalle de la fase 2"), "Editado después")
    await fireEvent.press(screen.getByRole("button", { name: "Deshacer" }))
    expect(
      [1, 2, 3].map((n) => screen.getByLabelText(`Nombre de la fase ${n}`).props.value),
    ).toEqual(["Base", "Fuerza", "Descarga"])
    expect(screen.getByLabelText("Detalle de la fase 3").props.value).toBe("Editado después")
  })

  it("restaura solo el deporte en su posición y conserva las ediciones posteriores", async () => {
    await prepararRetiradas()
    await abrirDatos()
    await fireEvent.press(screen.getByRole("button", { name: "Quitar Nadar" }))
    await fireEvent.changeText(screen.getByLabelText("Minutos de Bici"), "90")
    await fireEvent.press(screen.getByRole("button", { name: "Deshacer" }))
    expect([1, 2, 3].map((n) => screen.getByLabelText(`Deporte ${n}`).props.value)).toEqual([
      "Correr",
      "Nadar",
      "Bici",
    ])
    expect(screen.getByLabelText("Minutos de Bici").props.value).toBe("90")
  })

  it("otra retirada sustituye la barra anterior aunque sea de otro tipo", async () => {
    await prepararRetiradas()
    await fireEvent.press(screen.getByRole("button", { name: "Quitar Segundo" }))
    await abrirDatos()
    await fireEvent.press(screen.getByRole("button", { name: "Quitar Nadar" }))
    expect(screen.getAllByRole("button", { name: "Deshacer" })).toHaveLength(1)
    await fireEvent.press(screen.getByRole("button", { name: "Deshacer" }))
    expect(screen.getByLabelText("Deporte 2").props.value).toBe("Nadar")
    expect(screen.queryByLabelText("Series de Segundo")).toBeNull()
  })

  it("la barra desaparece a los cinco segundos y el borrador conserva la retirada", async () => {
    const almacen = await prepararRetiradas()
    jest.useFakeTimers()
    try {
      await fireEvent.press(screen.getByRole("button", { name: "Quitar Segundo" }))
      await act(async () => {
        jest.advanceTimersByTime(4999)
      })
      expect(screen.getByRole("button", { name: "Deshacer" })).toBeTruthy()
      await act(async () => {
        jest.advanceTimersByTime(1)
      })
      expect(screen.queryByRole("button", { name: "Deshacer" })).toBeNull()
      const copia = almacen.datos.get("borrador-plan-20000000-0000-4000-8000-000000000000") as {
        dias: Array<{ ejercicios: Array<{ nombre: string }> }>
      }
      expect(copia.dias[0]!.ejercicios.map((e) => e.nombre)).toEqual(["Primero", "Tercero"])
    } finally {
      jest.useRealTimers()
    }
  })

  it("una segunda fase con el mismo nombre e índice recibe cinco segundos completos para deshacer", async () => {
    await prepararRetiradas()
    await abrirDatos()
    await fireEvent.changeText(screen.getByLabelText("Nombre de la fase 2"), "Base")
    jest.useFakeTimers()
    try {
      await fireEvent.press(screen.getByRole("button", { name: "Quitar la fase 1" }))
      await act(async () => {
        jest.advanceTimersByTime(4000)
      })
      await fireEvent.press(screen.getByRole("button", { name: "Quitar la fase 1" }))
      await act(async () => {
        jest.advanceTimersByTime(4999)
      })
      expect(screen.getByRole("button", { name: "Deshacer" })).toBeOnTheScreen()
      expect(screen.getByLabelText("Nombre de la fase 1")).toHaveDisplayValue("Descarga")
      await act(async () => {
        jest.advanceTimersByTime(1)
      })
      expect(screen.queryByRole("button", { name: "Deshacer" })).toBeNull()
    } finally {
      jest.useRealTimers()
    }
  })

  it("recupera los ajustes de una fase sin nombre al deshacer su retirada (D10)", async () => {
    await prepararConstructor()
    await screen.findByLabelText("Nombre del día")
    await abrirDatos()
    await fireEvent.press(screen.getByRole("button", { name: "Añadir fase" }))
    await fireEvent.press(screen.getByRole("button", { name: "Descarga para la fase 1" }))
    await fireEvent.changeText(screen.getByLabelText("Carga en porcentaje de la fase 1"), "90")
    await fireEvent.press(screen.getByRole("button", { name: "Quitar la fase 1" }))
    await fireEvent.press(screen.getByRole("button", { name: "Deshacer" }))
    expect(screen.getByLabelText("Nombre de la fase 1")).toHaveDisplayValue("")
    expect(screen.getByLabelText("Carga en porcentaje de la fase 1")).toHaveDisplayValue("90")
    expect(screen.getByLabelText("Series en porcentaje de la fase 1")).toHaveDisplayValue("50")
  })

  it.each(["fase", "deporte"])("quitar una %s vacía no ofrece deshacer", async (tipo) => {
    await prepararConstructor()
    await screen.findByLabelText("Nombre del día")
    await abrirDatos()
    await fireEvent.press(
      screen.getByRole("button", { name: tipo === "fase" ? "Añadir fase" : "Añadir deporte" }),
    )
    await fireEvent.press(
      screen.getByRole("button", { name: tipo === "fase" ? "Quitar la fase 1" : "Quitar " }),
    )
    expect(screen.queryByRole("button", { name: "Deshacer" })).toBeNull()
  })
  it.each(["fase", "deporte"])(
    "reserva la plaza del elemento retirado (%s) hasta deshacer o agotar el plazo",
    async (tipo) => {
      await prepararRetiradas(8, 4)
      await abrirDatos()
      jest.useFakeTimers()
      try {
        await fireEvent.press(
          screen.getByRole("button", {
            name: tipo === "fase" ? "Quitar la fase 2" : "Quitar Nadar",
          }),
        )
        const anadir = tipo === "fase" ? "Añadir fase" : "Añadir deporte"
        expect(screen.queryByRole("button", { name: anadir })).toBeNull()
        await act(async () => {
          jest.advanceTimersByTime(5000)
        })
        expect(screen.getByRole("button", { name: anadir })).toBeTruthy()
      } finally {
        jest.useRealTimers()
      }
    },
  )

  it.each(["Quitar Segundo", "Quitar la fase 2", "Quitar Nadar"])(
    "dos activaciones de Deshacer no duplican lo quitado con %s",
    async (quitar) => {
      await prepararRetiradas()
      if (quitar !== "Quitar Segundo") await abrirDatos()
      await fireEvent.press(screen.getByRole("button", { name: quitar }))
      const deshacer = screen.getByRole("button", { name: "Deshacer" }).props.onClick as () => void
      await act(() => {
        deshacer()
        deshacer()
      })
      expect(screen.getAllByLabelText(/^Series de /)).toHaveLength(3)
      if (quitar === "Quitar Segundo") await abrirDatos()
      expect(screen.getAllByLabelText(/^Nombre de la fase /)).toHaveLength(3)
      expect(screen.getAllByLabelText(/^Deporte \d/)).toHaveLength(3)
    },
  )

  it("recuperar el borrador descarta la retirada de la edición anterior", async () => {
    await prepararRetiradas(3, 3, false)
    await abrirDatos()
    await fireEvent.press(screen.getByRole("button", { name: "Añadir fase" }))
    await fireEvent.changeText(screen.getByLabelText("Nombre de la fase 1"), "Otra fase")
    await fireEvent.press(screen.getByRole("button", { name: "Quitar la fase 1" }))
    expect(screen.getByRole("button", { name: "Deshacer" })).toBeTruthy()
    await cerrarDatos()
    await fireEvent.press(screen.getByRole("button", { name: "Recuperar mi plan" }))
    expect(screen.queryByRole("button", { name: "Deshacer" })).toBeNull()
    await abrirDatos()
    expect(screen.getAllByLabelText(/^Nombre de la fase /)).toHaveLength(3)
  })
})

it("no serializa el plan por tecla y sigue protegiendo y autoguardando los cambios (T-07)", async () => {
  const almacen = almacenEnMemoria()
  await prepararConstructor(almacen)
  await screen.findByLabelText("Nombre del día")
  const original = JSON.stringify
  const serializados: unknown[] = []
  const serializar = jest
    .spyOn(JSON, "stringify")
    .mockImplementation((...args: Parameters<typeof JSON.stringify>) => {
      const valor = args[0] as { dias?: unknown; bloque?: unknown } | null
      if (valor && typeof valor === "object" && "dias" in valor && "bloque" in valor)
        serializados.push(valor)
      return original(...args)
    })
  jest.useFakeTimers()
  try {
    await fireEvent.changeText(screen.getByLabelText("Nombre del bloque"), "P")
    await fireEvent.changeText(screen.getByLabelText("Nombre del bloque"), "Plan")
    await fireEvent.changeText(screen.getByLabelText("Nombre del día"), "Fuerza")
    expect(serializados).toHaveLength(0)
    expect(mockPreventRemove.mock.calls.at(-1)?.[0]).toBe(true)
    await act(async () => {
      jest.advanceTimersByTime(800)
    })
    expect(almacen.datos.get("borrador-plan-20000000-0000-4000-8000-000000000000")).toEqual(
      expect.objectContaining({ nombre: "Plan" }),
    )
  } finally {
    serializar.mockRestore()
    jest.useRealTimers()
  }
})

describe("acciones y mensajes junto al botón (T-06)", () => {
  it("permite publicar desde el pie y muestra allí el campo que falta", async () => {
    await prepararConstructor()
    await screen.findByLabelText("Nombre del día")
    await fireEvent.press(screen.getByRole("button", { name: "Publicar" }))
    expect(within(screen.getByTestId("pie-del-plan")).getByRole("alert")).toHaveTextContent(
      /Pon nombre a cada día/,
    )
    await completarDia()
    await fireEvent.press(screen.getByRole("button", { name: "Publicar" }))
    expect(screen.getByText("¿Publicar el plan?")).toBeTruthy()
  })

  it.each(["correcto", "fallido"])(
    "un doble toque guarda una sola plantilla con resultado %s visible",
    async (resultado) => {
      let liberar!: () => void
      const pausa = new Promise<void>((resolve) => {
        liberar = resolve
      })
      const rutinas: ApiRutinas = {
        listar: jest.fn(),
        leer: jest.fn(),
        editar: jest.fn(),
        crear: jest.fn(async () => {
          await pausa
          if (resultado === "fallido") throw new Error("No se pudo guardar esta plantilla.")
          return {} as never
        }),
      }
      await prepararConstructor(almacenEnMemoria(), rutinas)
      await completarDia()
      const guardar = screen.getByRole("button", { name: "Guardar como plantilla" })
      await fireEvent.press(guardar)
      await fireEvent.press(guardar)
      try {
        expect(rutinas.crear).toHaveBeenCalledTimes(1)
        expect(
          screen.getByRole("button", { name: "Guardando plantilla…" }).props.accessibilityState,
        ).toEqual(expect.objectContaining({ busy: true, disabled: true }))
      } finally {
        await act(async () => {
          liberar()
          await pausa
        })
      }
      const acciones = within(screen.getByTestId("acciones-del-dia"))
      if (resultado === "correcto")
        expect(acciones.getByText("Guardado como plantilla en Rutinas.")).toBeTruthy()
      else
        expect(acciones.getByRole("alert")).toHaveTextContent("No se pudo guardar esta plantilla.")
    },
  )
})
