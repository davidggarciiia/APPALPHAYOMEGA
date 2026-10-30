import { Pressable, Text } from "react-native"
import { router, Stack, type Href } from "expo-router"
import { act, fireEvent, renderRouter, screen, waitFor } from "expo-router/testing-library"

import type { AlmacenLocal } from "../../entrenamiento/almacen-local"
import { crearApiEntrenamiento } from "../../entrenamiento/api"
import { crearPeticionAutenticada } from "../../lib/peticion-autenticada"
import {
  catalogoEnMemoria,
  ejercicioDePrueba,
} from "../../catalogo-ejercicios/pruebas/catalogo-en-memoria"
import { ConstructorPlan } from "./constructor"
import { EditorDieta } from "../../nutricion/editor-dieta"
import type { ApiNutricion } from "../../nutricion/api"
import { useSalidaProtegida } from "../../componentes/salida-protegida"

// Las fronteras de dispositivo y API se sustituyen; el router, sus hooks y el
// navegador de Stack son los reales del SDK instalado.
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

const { randomUUID } = jest.requireActual<typeof import("node:crypto")>("node:crypto")
const CLIENTE = "20000000-0000-4000-8000-000000000001"
const RUTA_DEL_PLAN = `/entrenador/cliente/${CLIENTE}/plan`
afterEach(() => jest.useRealTimers())

it("rearma la salida protegida tras una acción interna y al volver de otra pantalla", async () => {
  const recargar = jest.fn()
  function Edicion(): React.JSX.Element {
    const { proteger, permitir, proteccion } = useSalidaProtegida(true)
    return (
      <>
        <Pressable accessibilityRole="button" onPress={() => proteger(recargar)}>
          <Text>Recargar</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={() => permitir(recargar)}>
          <Text>Guardar</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={() => proteger(() => router.back())}>
          <Text>Volver</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={() => proteger(() => router.push("/detalle" as Href))}
        >
          <Text>Ver detalle</Text>
        </Pressable>
        {proteccion}
      </>
    )
  }
  const vista = await renderRouter(
    {
      _layout: () => <Stack screenOptions={{ headerShown: false, animation: "none" }} />,
      index: () => (
        <Pressable accessibilityRole="button" onPress={() => router.push("/edicion" as Href)}>
          <Text>Editar</Text>
        </Pressable>
      ),
      edicion: Edicion,
      detalle: () => <Text>Detalle</Text>,
    },
    { initialUrl: "/" },
  )
  await fireEvent.press(screen.getByRole("button", { name: "Editar" }))
  await fireEvent.press(await screen.findByRole("button", { name: "Recargar" }))
  expect(recargar).not.toHaveBeenCalled()
  await fireEvent.press(screen.getByRole("button", { name: "Salir sin guardar" }))
  expect(recargar).toHaveBeenCalledTimes(1)
  expect(vista.getPathname()).toBe("/edicion")
  await fireEvent.press(screen.getByRole("button", { name: "Guardar" }))
  expect(recargar).toHaveBeenCalledTimes(2)
  await act(() => router.back())
  expect(vista.getPathname()).toBe("/edicion")
  await fireEvent.press(await screen.findByRole("button", { name: "Seguir editando" }))
  await fireEvent.press(screen.getByRole("button", { name: "Ver detalle" }))
  await fireEvent.press(screen.getByRole("button", { name: "Salir sin guardar" }))
  await waitFor(() => expect(vista.getPathname()).toBe("/detalle"))
  await act(() => router.back())
  await waitFor(() => expect(vista.getPathname()).toBe("/edicion"))
  await act(() => router.back())
  expect(vista.getPathname()).toBe("/edicion")
  await fireEvent.press(await screen.findByRole("button", { name: "Seguir editando" }))
  await fireEvent.press(screen.getByRole("button", { name: "Volver" }))
  expect(vista.getPathname()).toBe("/edicion")
  await fireEvent.press(await screen.findByRole("button", { name: "Salir sin guardar" }))
  await waitFor(() => expect(vista.getPathname()).toBe("/"))
})

it("Atrás en el editor de dieta conserva los cambios hasta confirmar el descarte", async () => {
  const api = {} as ApiNutricion
  const vista = await renderRouter(
    {
      _layout: () => <Stack screenOptions={{ headerShown: false, animation: "none" }} />,
      index: () => (
        <Pressable accessibilityRole="button" onPress={() => router.push("/dieta" as Href)}>
          <Text>Editar dieta</Text>
        </Pressable>
      ),
      dieta: () => (
        <EditorDieta
          clienteId={CLIENTE}
          api={api}
          origen="nueva"
          ids={randomUUID}
          volver={() => router.back()}
        />
      ),
    },
    { initialUrl: "/" },
  )
  await fireEvent.press(await screen.findByRole("button", { name: "Editar dieta" }))
  await fireEvent.changeText(await screen.findByLabelText("Nombre de la dieta"), "Dieta sin perder")
  await act(() => router.back())
  expect(vista.getPathname()).toBe("/dieta")
  await fireEvent.press(await screen.findByRole("button", { name: "Seguir editando" }))
  expect(screen.getByDisplayValue("Dieta sin perder")).toBeTruthy()
  await act(() => router.back())
  await fireEvent.press(await screen.findByRole("button", { name: "Salir sin guardar" }))
  await waitFor(() => expect(vista.getPathname()).toBe("/"))
})

async function preparar() {
  const datos = new Map<string, unknown>()
  const almacen: AlmacenLocal = {
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
  const api = crearApiEntrenamiento(crearPeticionAutenticada(() => "token"))
  const asignar = jest.spyOn(api, "asignar").mockImplementation(async (_cliente, solicitud) => ({
    id: randomUUID(),
    operacionId: solicitud.operacionId,
    sesiones: [],
  }))
  const catalogo = catalogoEnMemoria([
    ejercicioDePrueba("10000000-0000-4000-8000-000000000001", "Press banca con barra", "pecho"),
  ])
  const vista = await renderRouter(
    {
      _layout: () => <Stack screenOptions={{ headerShown: false, animation: "none" }} />,
      index: () => (
        <>
          <Text>Ficha de prueba</Text>
          <Pressable
            accessibilityRole="button"
            onPress={() =>
              router.push({ pathname: "/entrenador/cliente/[id]/plan", params: { id: CLIENTE } })
            }
          >
            <Text>Crear plan</Text>
          </Pressable>
        </>
      ),
      "entrenador/cliente/[id]/plan": () => (
        <ConstructorPlan
          clienteId={CLIENTE}
          cuentaId="30000000-0000-4000-8000-000000000001"
          nombreCliente="Cliente"
          almacen={almacen}
          api={api}
          catalogo={catalogo}
          rutinas={{ listar: jest.fn(), leer: jest.fn(), crear: jest.fn(), editar: jest.fn() }}
          nuevoId={randomUUID}
          terminado={() => router.back()}
          volver={() => router.back()}
        />
      ),
    },
    { initialUrl: "/" },
  )
  return { vista, asignar, datos }
}

it("Atrás del router conserva la ruta editada; cancelar conserva el texto y confirmar devuelve a la ficha", async () => {
  const { vista } = await preparar()
  await fireEvent.press(await screen.findByRole("button", { name: "Crear plan" }))
  await fireEvent.changeText(await screen.findByLabelText("Nombre del bloque"), "Mi plan editado")
  await act(() => router.back())
  expect(vista.getPathname()).toBe(RUTA_DEL_PLAN)
  expect(await screen.findByText("¿Salir sin guardar el plan?")).toBeTruthy()
  await fireEvent.press(screen.getByRole("button", { name: "Seguir editando" }))
  expect(screen.getByDisplayValue("Mi plan editado")).toBeTruthy()
  expect(vista.getPathname()).toBe(RUTA_DEL_PLAN)
  await act(() => router.back())
  await fireEvent.press(await screen.findByRole("button", { name: "Salir sin guardar" }))
  await waitFor(() => expect(vista.getPathname()).toBe("/"))
  expect(screen.getByText("Ficha de prueba")).toBeTruthy()
  expect(screen.queryByDisplayValue("Mi plan editado")).toBeNull()
})

it("publicar correctamente vuelve a la ficha sin pedir descartar el plan confirmado", async () => {
  const { vista, asignar, datos } = await preparar()
  await fireEvent.press(await screen.findByRole("button", { name: "Crear plan" }))
  await fireEvent.changeText(await screen.findByLabelText("Nombre del día"), "Fuerza")
  await fireEvent.press(screen.getAllByRole("button", { name: "Añadir desde la biblioteca" })[0]!)
  await fireEvent.press(await screen.findByRole("button", { name: "Añadir Press banca con barra" }))
  await waitFor(() => expect(screen.queryByLabelText("Buscar ejercicio para añadir")).toBeNull())
  await fireEvent.press(screen.getByRole("button", { name: "Publicar" }))
  await fireEvent.press(await screen.findByRole("button", { name: "Publicar plan" }))
  await waitFor(() => expect(vista.getPathname()).toBe("/"))
  expect(asignar).toHaveBeenCalledTimes(1)
  expect(datos.size).toBe(0)
  expect(screen.getByText("Ficha de prueba")).toBeTruthy()
  expect(screen.queryByText("¿Salir sin guardar el plan?")).toBeNull()
})

it("Atrás de Android cierra la hoja de datos y conserva sus cambios bajo la protección del router", async () => {
  const { vista } = await preparar()
  await fireEvent.press(await screen.findByRole("button", { name: "Crear plan" }))
  await fireEvent.press(await screen.findByRole("button", { name: "Editar datos del bloque" }))
  await fireEvent.changeText(await screen.findByLabelText("Número de semanas"), "8")
  await fireEvent(screen.getByTestId("hoja-modal"), "requestClose")
  // renderRouter instala temporizadores simulados; la transición se avanza explícitamente.
  await act(async () => {
    await jest.advanceTimersByTimeAsync(220)
  })
  await waitFor(() => expect(screen.queryByLabelText("Número de semanas")).toBeNull())
  expect(vista.getPathname()).toBe(RUTA_DEL_PLAN)
  await act(() => router.back())
  expect(await screen.findByText("¿Salir sin guardar el plan?")).toBeOnTheScreen()
  await fireEvent.press(screen.getByRole("button", { name: "Seguir editando" }))
  await fireEvent.press(screen.getByRole("button", { name: "Editar datos del bloque" }))
  expect(screen.getByLabelText("Número de semanas")).toHaveDisplayValue("8")
})
