import { render, screen, within } from "@testing-library/react-native"
import { TextInput } from "react-native"

import { Dialogo } from "./controles"

jest.mock("../../componentes/iconos", () => ({ Icono: () => null }))

/**
 * El gesto diario del cliente (apuntar peso, pasos, sueño) escribe dentro de un
 * Dialogo anclado abajo: sin esquivar el teclado, este tapaba el campo y «Guardar».
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
