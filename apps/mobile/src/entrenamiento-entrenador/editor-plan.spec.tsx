import { fireEvent, render, screen, waitFor } from "@testing-library/react-native"
import { EditorPlan } from "./editor-plan"
import { crearApiEntrenamiento } from "../entrenamiento/api"
import { crearPeticionAutenticada } from "../lib/peticion-autenticada"
import type { AlmacenLocal } from "../entrenamiento/almacen-local"
import { ErrorDePeticion } from "../lib/http"
import {
  catalogoEnMemoria,
  ejercicioDePrueba,
} from "../catalogo-ejercicios/pruebas/catalogo-en-memoria"

jest.mock("expo-crypto", () => ({
  randomUUID: jest.requireActual<typeof import("node:crypto")>("node:crypto").randomUUID,
}))
jest.mock("../lib/direccion-api", () => ({ direccionDeLaApi: () => "http://localhost:3000" }))

it("revisa objetivos y conserva exactamente la operación tras un fallo de red", async () => {
  const api = crearApiEntrenamiento(crearPeticionAutenticada(() => "token"))
  const asignar = jest.spyOn(api, "asignar").mockRejectedValue(new Error("Sin red"))
  jest.spyOn(api, "semana").mockResolvedValue({ sesiones: [], total: 0 })
  const catalogo = catalogoEnMemoria([
    ejercicioDePrueba("10000000-0000-4000-8000-000000000000", "Remo", "espalda", []),
  ])
  let pendiente: unknown = null
  const almacen: AlmacenLocal = {
    habilitar: () => undefined,
    leer: async (_cuenta, _clave, esquema) =>
      pendiente === null ? null : esquema.parse(pendiente),
    guardar: async (_cuenta, _clave, datos) => {
      pendiente = datos
    },
    borrar: async () => {
      pendiente = null
    },
    listar: async () => [],
    limpiar: async () => undefined,
  }
  const pintar = () =>
    render(
      <EditorPlan
        cuentaId="30000000-0000-4000-8000-000000000000"
        almacen={almacen}
        clienteId="20000000-0000-4000-8000-000000000000"
        api={api}
        catalogo={catalogo}
        rutinas={{ listar: jest.fn(), leer: jest.fn(), crear: jest.fn(), editar: jest.fn() }}
        terminado={jest.fn()}
      />,
    )
  const pantalla = await pintar()
  await screen.findByLabelText("Nombre de sesión")
  await fireEvent.changeText(screen.getByLabelText("Nombre de sesión"), "Fuerza")
  await fireEvent.press(await screen.findByRole("button", { name: "Añadir Remo" }))
  await fireEvent.changeText(screen.getByLabelText("Repeticiones — Remo, serie 1"), "10")
  await fireEvent.press(screen.getByRole("button", { name: "Revisar asignación" }))
  expect(await screen.findByText("Serie 1: 10 rep")).toBeOnTheScreen()
  await fireEvent.press(screen.getByRole("button", { name: "Asignar entrenamiento" }))
  await waitFor(() => expect(asignar).toHaveBeenCalledTimes(1))
  await pantalla.unmount()
  const reabierta = await pintar()
  await screen.findByRole("button", { name: "Reintentar asignación" })
  await fireEvent.press(screen.getByRole("button", { name: "Reintentar asignación" }))
  await waitFor(() => expect(asignar).toHaveBeenCalledTimes(2))
  expect(asignar.mock.calls[1]).toEqual(asignar.mock.calls[0])
  expect(screen.queryByRole("button", { name: "Volver a editar" })).toBeNull()
  asignar.mockRejectedValueOnce(
    new ErrorDePeticion({
      statusCode: 409,
      codigo: "operacion_incompatible",
      message: "Cuenta desactivada",
    }),
  )
  await fireEvent.press(screen.getByRole("button", { name: "Reintentar asignación" }))
  await waitFor(() => expect(pendiente).toBeNull())
  await reabierta.unmount()
  await pintar()
  await screen.findByLabelText("Nombre de sesión")
})

it("revisa dos sesiones durante dos semanas y avisa de las sesiones existentes", async () => {
  const api = crearApiEntrenamiento(crearPeticionAutenticada(() => "token"))
  const asignar = jest.spyOn(api, "asignar").mockRejectedValue(new Error("sin red"))
  const semana = jest.spyOn(api, "semana").mockResolvedValue({ sesiones: [], total: 2 })
  const catalogo = catalogoEnMemoria([
    ejercicioDePrueba("10000000-0000-4000-8000-000000000000", "Remo", "espalda", []),
  ])
  const almacen: AlmacenLocal = {
    habilitar: jest.fn(),
    leer: async () => null,
    guardar: jest.fn(async () => undefined),
    borrar: jest.fn(async () => undefined),
    listar: async () => [],
    limpiar: async () => undefined,
  }
  await render(
    <EditorPlan
      cuentaId="30000000-0000-4000-8000-000000000000"
      clienteId="20000000-0000-4000-8000-000000000000"
      almacen={almacen}
      api={api}
      catalogo={catalogo}
      rutinas={{ listar: jest.fn(), leer: jest.fn(), crear: jest.fn(), editar: jest.fn() }}
      terminado={jest.fn()}
    />,
  )
  await fireEvent.changeText(await screen.findByLabelText("Nombre de sesión"), "Fuerza")
  await fireEvent.changeText(screen.getByLabelText("Lunes de inicio (AAAA-MM-DD)"), "2026-09-14")
  await fireEvent.changeText(screen.getByLabelText("Número de semanas"), "2")
  await fireEvent.press(await screen.findByRole("button", { name: "Añadir Remo" }))
  await fireEvent.changeText(screen.getByLabelText("Repeticiones — Remo, serie 1"), "10")
  await fireEvent.press(screen.getByRole("button", { name: "Añadir otra sesión" }))
  await fireEvent.changeText(screen.getByLabelText("Nombre de sesión"), "Resistencia")
  await fireEvent.press(screen.getByRole("button", { name: "Mié" }))
  await fireEvent.press(await screen.findByRole("button", { name: "Añadir Remo" }))
  await fireEvent.changeText(screen.getByLabelText("Repeticiones — Remo, serie 1"), "15")
  await fireEvent.press(screen.getByRole("button", { name: "Revisar asignación" }))
  await screen.findByText(/Se añadirán 4 sesiones. Ya hay 4 sesiones/)
  expect(semana.mock.calls.map((c) => c[1])).toEqual(["2026-09-14", "2026-09-21"])
  await fireEvent.press(screen.getByRole("button", { name: "Asignar entrenamiento" }))
  await waitFor(() => expect(asignar).toHaveBeenCalled())
  expect(asignar.mock.calls[0]?.[1]).toMatchObject({
    semanas: 2,
    patron: {
      sesiones: [
        { nombre: "Fuerza", diaSemana: 1 },
        { nombre: "Resistencia", diaSemana: 3 },
      ],
    },
  })
})
