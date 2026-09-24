import { act, fireEvent, render, screen } from "@testing-library/react-native"
import {
  CONFIGURACION_SEGUIMIENTO_INICIAL,
  type ConfiguracionSeguimiento,
} from "@alpha-omega/shared"

import { EditorConfiguracionSeguimiento } from "./configuracion"

jest.mock("expo-crypto", () => ({ randomUUID: () => "30000000-0000-4000-8000-000000000001" }))

const inicial: ConfiguracionSeguimiento = {
  ...CONFIGURACION_SEGUIMIENTO_INICIAL,
  objetivoPeso: { direccion: "mantener", rangoKg: { minimo: 70, maximo: 75 } },
  pruebasPrescritas: [
    { id: "30000000-0000-4000-8000-000000000001", nombre: "Flexiones", unidad: "reps" },
  ],
}

it("protege todos los controles hasta confirmar el guardado y después permite editar", async () => {
  let confirmar!: (valor: ConfiguracionSeguimiento) => void
  const guardar = jest.fn(
    (_datos: ConfiguracionSeguimiento) =>
      new Promise<ConfiguracionSeguimiento>((resolve) => {
        confirmar = resolve
      }),
  )
  await render(
    <EditorConfiguracionSeguimiento valor={inicial} guardar={guardar} recargar={jest.fn()} />,
  )
  await fireEvent.changeText(screen.getByLabelText("Nombre de prueba 1"), "Flexiones estrictas")
  await fireEvent.press(screen.getByRole("button", { name: "Guardar seguimiento" }))

  expect(screen.getByText("Guardando…")).toBeTruthy()
  for (const boton of screen.getAllByRole("button")) expect(boton).toBeDisabled()
  for (const etiqueta of [
    "Rango mínimo (kg)",
    "Rango máximo (kg)",
    "Nombre de prueba 1",
    "Unidad de prueba 1",
  ]) {
    expect(screen.getByLabelText(etiqueta)).toBeDisabled()
  }
  await fireEvent.press(screen.getByRole("button", { name: "Ocultar Peso" }))
  await fireEvent.changeText(screen.getByLabelText("Nombre de prueba 1"), "Cambio durante envío")
  await fireEvent.press(screen.getByRole("button", { name: "Guardar seguimiento" }))
  expect(guardar).toHaveBeenCalledTimes(1)

  await act(async () => confirmar({ ...guardar.mock.calls[0]![0], revision: 1 }))
  expect(screen.getByText("Guardado · revisión 1")).toBeTruthy()
  expect(screen.getByDisplayValue("Flexiones estrictas")).toBeTruthy()
  expect(screen.getByRole("button", { name: "Ocultar Peso" })).toBeEnabled()
  await fireEvent.changeText(screen.getByLabelText("Nombre de prueba 1"), "Flexiones lentas")
  expect(screen.getByText("Cambios sin guardar")).toBeTruthy()
})

it("conserva la edición y desbloquea los controles si el guardado falla", async () => {
  const guardar = jest.fn(async () => {
    throw new Error("sin conexión")
  })
  await render(
    <EditorConfiguracionSeguimiento valor={inicial} guardar={guardar} recargar={jest.fn()} />,
  )
  await fireEvent.changeText(screen.getByLabelText("Rango mínimo (kg)"), "71,5")
  await fireEvent.press(screen.getByRole("button", { name: "Guardar seguimiento" }))
  expect(screen.getByText("Cambios sin guardar")).toBeTruthy()
  expect(screen.getByDisplayValue("71,5")).toBeTruthy()
  expect(screen.getByRole("button", { name: "Guardar seguimiento" })).toBeEnabled()
  expect(screen.getByLabelText("Rango mínimo (kg)")).toBeEnabled()
})
