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
        terminado={jest.fn()}
      />,
    )
  const pantalla = await pintar()
  await screen.findByLabelText("Nombre de sesión")
  await fireEvent.changeText(screen.getByLabelText("Nombre de sesión"), "Fuerza")
  await fireEvent.press(await screen.findByRole("button", { name: "Añadir Remo" }))
  await fireEvent.changeText(screen.getByLabelText("Repeticiones — Remo, serie 1"), "10")
  await fireEvent.press(screen.getByRole("button", { name: "Revisar asignación" }))
  expect(screen.getByText("Serie 1: 10 rep")).toBeOnTheScreen()
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
