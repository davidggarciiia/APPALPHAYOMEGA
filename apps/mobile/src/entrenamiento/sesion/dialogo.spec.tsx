import { fireEvent, render, screen, within } from "@testing-library/react-native"
import { TextInput } from "react-native"

import { Dialogo } from "./controles"

jest.mock("../../componentes/iconos", () => ({ Icono: () => null }))

/**
 * El gesto diario del cliente (apuntar peso, pasos, sueño) escribe dentro de un
 * Dialogo: sin esquivar el teclado, este tapaba el campo y «Guardar».
 */
it("un diálogo con campo de texto esquiva el teclado para que no tape el campo ni los botones", async () => {
  await render(
    <Dialogo
      visible
      titulo="Apuntar peso"
      texto="Tu peso de hoy"
      confirmar="Guardar"
      cancelar="Cancelar"
      alConfirmar={() => undefined}
      alCancelar={() => undefined}
    >
      <TextInput accessibilityLabel="Peso" />
    </Dialogo>,
  )
  const esquiva = within(screen.getByTestId("dialogo-esquiva-teclado"))
  expect(esquiva.getByLabelText("Peso")).toBeOnTheScreen()
  expect(esquiva.getByRole("button", { name: "Guardar" })).toBeOnTheScreen()
  expect(esquiva.getByRole("button", { name: "Cancelar" })).toBeOnTheScreen()
})

it("centra el diálogo y bloquea confirmar, cancelar y Android mientras guarda", async () => {
  const confirmar = jest.fn()
  const cancelar = jest.fn()
  await render(
    <Dialogo
      visible
      titulo="¿Terminar ya?"
      texto="Quedan dos series"
      confirmar="Terminar y enviar"
      cancelar="Seguir entrenando"
      alConfirmar={confirmar}
      alCancelar={cancelar}
      ocupado
    />,
  )
  expect(screen.getByTestId("dialogo-esquiva-teclado")).toHaveStyle({
    justifyContent: "center",
    padding: 20,
  })
  expect(screen.getByRole("header", { name: "¿Terminar ya?" })).toHaveStyle({
    fontFamily: "Anton",
    fontSize: 24,
  })
  await fireEvent.press(screen.getByRole("button", { name: "Terminar y enviar" }))
  await fireEvent.press(screen.getByRole("button", { name: "Seguir entrenando" }))
  await fireEvent(screen.getByTestId("dialogo-modal"), "requestClose")
  expect(confirmar).not.toHaveBeenCalled()
  expect(cancelar).not.toHaveBeenCalled()
})
