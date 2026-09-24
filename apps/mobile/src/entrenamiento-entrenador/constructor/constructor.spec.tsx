import { fireEvent, render, screen, waitFor } from "@testing-library/react-native"
import type { AsignarPlan } from "@alpha-omega/shared"

import { crearApiEntrenamiento } from "../../entrenamiento/api"
import type { AlmacenLocal } from "../../entrenamiento/almacen-local"
import { crearPeticionAutenticada } from "../../lib/peticion-autenticada"
import {
  catalogoEnMemoria,
  ejercicioDePrueba,
} from "../../catalogo-ejercicios/pruebas/catalogo-en-memoria"
import { ConstructorPlan } from "./constructor"

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

const { randomUUID } = jest.requireActual<typeof import("node:crypto")>("node:crypto")

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
