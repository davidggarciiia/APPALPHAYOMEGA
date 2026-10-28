import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native"
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
import {
  catalogoEnMemoria,
  ejercicioDePrueba,
} from "../../catalogo-ejercicios/pruebas/catalogo-en-memoria"
import type { SesionConDistancia } from "../editor-modelo"
import { ConstructorPlan } from "./constructor"
import { desdeSesionEnRutina, nuevoEjercicio, type EjercicioDelConstructor } from "./modelo"
import { ListaDeSeccion } from "./partes"
import { objetivoConUnidad, PanelEjercicio, TablaPrincipal } from "./tabla"

jest.mock("expo-crypto", () => ({
  randomUUID: jest.requireActual<typeof import("node:crypto")>("node:crypto").randomUUID,
}))
jest.mock("../../componentes/iconos", () => ({ Icono: () => null }))
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
  [boolean, (evento: { data: { action: NavigationAction } }) => void]
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
) {
  const api = crearApiEntrenamiento(crearPeticionAutenticada(() => "token"))
  const asignar = jest.spyOn(api, "asignar").mockRejectedValue(Error("Respuesta perdida"))
  const vista = await render(
    <ConstructorPlan
      clienteId="20000000-0000-4000-8000-000000000000"
      cuentaId="30000000-0000-4000-8000-000000000000"
      nombreCliente="Cliente"
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
}

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

it("conserva el editor al escribir un objetivo inválido y explica el fallo al previsualizar", async () => {
  await prepararConstructor()
  await completarDia()
  await fireEvent.changeText(screen.getByLabelText("Repeticiones de Press banca"), "0")
  expect(screen.getByDisplayValue("0")).toBeOnTheScreen()
  await fireEvent.press(screen.getByRole("button", { name: "Ver como cliente" }))
  expect(screen.getByText(/Revisa el plan antes de previsualizar/)).toBeOnTheScreen()
})

it("conserva el editor mientras el lunes está incompleto", async () => {
  await prepararConstructor()
  await completarDia()
  await fireEvent.changeText(screen.getByLabelText("Lunes de inicio (AAAA-MM-DD)"), "2026-")
  expect(screen.getByDisplayValue("2026-")).toBeOnTheScreen()
  expect(screen.getByText("Cliente · fecha de inicio pendiente · 6 semanas")).toBeOnTheScreen()
  expect(screen.queryByText(/undefined/)).toBeNull()
  await fireEvent.press(screen.getByRole("button", { name: "Ver como cliente" }))
  expect(screen.getByText(/Revisa el plan antes de previsualizar/)).toBeOnTheScreen()
  await fireEvent.changeText(screen.getByLabelText("Lunes de inicio (AAAA-MM-DD)"), "2026-10-26")
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
  await fireEvent.changeText(screen.getByLabelText("Duración estimada"), "100–115 min")

  // Fase del bloque.
  await fireEvent.press(screen.getByRole("button", { name: "Añadir fase" }))
  await fireEvent.changeText(screen.getByLabelText("Nombre de la fase 1"), "Calibrar")
  await fireEvent.changeText(screen.getByLabelText("Última semana de la fase 1"), "2")

  // Press banca desde la biblioteca, en la parte principal.
  await fireEvent.press(screen.getAllByRole("button", { name: "Añadir desde la biblioteca" })[0]!)
  await fireEvent.press(await screen.findByRole("button", { name: "Añadir Press banca con barra" }))
  await fireEvent.press(
    screen.getByRole("button", { name: "Press banca con barra: editar detalles" }),
  )
  await fireEvent.press(
    screen.getByRole("button", { name: "RIR cada serie de Press banca con barra" }),
  )
  await fireEvent.press(
    screen.getByRole("button", { name: "Con carga externa de Press banca con barra" }),
  )
  await fireEvent.changeText(screen.getByLabelText("Series de Press banca con barra"), "4")
  await fireEvent.changeText(screen.getByLabelText("Repeticiones de Press banca con barra"), "6")
  await fireEvent.changeText(screen.getByLabelText("RIR de Press banca con barra"), "3")
  await fireEvent.press(
    screen.getByRole("button", { name: /Carga inicial de Press banca con barra: calibrar/ }),
  )
  await fireEvent.changeText(
    screen.getByLabelText("Carga inicial de Press banca con barra en kg"),
    "60",
  )
  await fireEvent.changeText(screen.getByLabelText("Subida de Press banca con barra en kg"), "2,5")

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
  await act(() => mockPreventRemove.mock.calls.at(-1)![1]({ data: { action: accion } }))
  expect(mockDispatch).not.toHaveBeenCalled()
  await fireEvent.press(await screen.findByRole("button", { name: "Seguir editando" }))
  expect(screen.getByDisplayValue("Mi plan")).toBeOnTheScreen()
  expect(mockPreventRemove.mock.calls.at(-1)?.[0]).toBe(true)
  await act(() => mockPreventRemove.mock.calls.at(-1)![1]({ data: { action: accion } }))
  await fireEvent.press(await screen.findByRole("button", { name: "Salir sin guardar" }))
  expect(mockPreventRemove.mock.calls.at(-1)?.[0]).toBe(false)
  expect(mockDispatch).toHaveBeenCalledTimes(1)
  expect(mockDispatch).toHaveBeenCalledWith(accion)
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
    await fireEvent.changeText(screen.getByLabelText("Duración estimada"), "50–60 min")
    for (const [parte, minutos] of [
      ["calentamiento", "8–10"],
      ["fuerza", "30"],
      ["cardio", "6"],
      ["calma", "5"],
    ] as const) {
      await fireEvent.changeText(screen.getByLabelText(`Minutos de ${parte}`), minutos)
    }
    await fireEvent.press(screen.getByRole("button", { name: "Añadir desde la biblioteca" }))
    await fireEvent.press(await screen.findByRole("button", { name: "Añadir Fuerza" }))
    await fireEvent.press(screen.getByRole("button", { name: "Añadir calentamiento" }))
    await fireEvent.press(await screen.findByRole("button", { name: "Añadir Movilidad" }))
    await fireEvent.changeText(
      screen.getByLabelText("Cómo se hace Movilidad"),
      "1×8 por lado <suave>",
    )
    await fireEvent.press(screen.getByRole("button", { name: "Añadir circuito" }))
    await fireEvent.press(await screen.findByRole("button", { name: "Añadir Circuito físico" }))
    await fireEvent.changeText(screen.getByLabelText("Nombre del circuito"), "Core <controlado>")
    await fireEvent.changeText(screen.getByLabelText("Vueltas del circuito"), "2")
    await fireEvent.changeText(screen.getByLabelText("Descanso entre vueltas"), "30 s")
    await fireEvent.press(screen.getByRole("button", { name: "Añadir vuelta a la calma" }))
    await fireEvent.press(await screen.findByRole("button", { name: "Añadir Estirar" }))
    await fireEvent.changeText(screen.getByLabelText("Cómo se hace Estirar"), "30 s por lado")
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
    expect(metros).toHaveProp("value", "20")
    expect(metros).toHaveProp("placeholder", "m")
    expect(screen.getByLabelText("Carga inicial de Paseo del granjero en kg")).toHaveProp(
      "value",
      "32",
    )
    expect(screen.queryByLabelText(/^(Repeticiones|Segundos) de Paseo/)).toBeNull()
    expect(screen.getByLabelText("Repeticiones de Press banca con barra")).toHaveProp(
      "placeholder",
      "8–10",
    )
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
    expect(screen.getByLabelText("Segundos de Plancha")).toHaveProp("value", "30")
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
    await fireEvent.press(
      screen.getByRole("button", { name: "Paseo del granjero: editar detalles" }),
    )
    await fireEvent.press(
      screen.getByRole("button", { name: "Con carga externa de Paseo del granjero" }),
    )
    await fireEvent.press(
      screen.getByRole("button", { name: "Medir Paseo del granjero en metros" }),
    )
    await fireEvent.changeText(screen.getByLabelText("Series de Paseo del granjero"), "2")
    await fireEvent.changeText(screen.getByLabelText("Metros de Paseo del granjero"), "20")
    await fireEvent.press(
      screen.getByRole("button", { name: /Carga inicial de Paseo del granjero: calibrar/ }),
    )
    await fireEvent.changeText(
      screen.getByLabelText("Carga inicial de Paseo del granjero en kg"),
      "32",
    )

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
    const metros = screen.getByLabelText("Metros de Zancadas caminando")
    expect(metros).toHaveProp("value", "20")
    expect(metros).toHaveProp("placeholder", "m")
    expect(screen.getByLabelText("Segundos de Plancha")).toHaveProp("placeholder", "s")
    expect(screen.getByLabelText("Repeticiones de Sentadilla goblet")).toHaveProp(
      "placeholder",
      "reps",
    )
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
    await fireEvent.press(screen.getByRole("button", { name: "Partir de una plantilla" }))
    await fireEvent.press(await screen.findByRole("button", { name: "Elegir Plantilla pierna" }))
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
