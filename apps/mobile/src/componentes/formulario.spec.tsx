import { describe, it, jest } from "@jest/globals"
import { useState } from "react"
import { fireEvent, render, screen } from "@testing-library/react-native"
import { BotonDestructivo, BotonPrincipal, BotonSecundario, Campo } from "./formulario"

describe.each<[string, typeof BotonPrincipal]>([
  ["principal", BotonPrincipal],
  ["secundario", BotonSecundario],
  ["destructivo", BotonDestructivo],
])("Botón %s", (_nombre, Boton) => {
  it("impide repetir una operación ocupada y conserva su nombre accesible", async () => {
    const guardar = jest.fn()
    await render(<Boton texto="Guardar" onPress={guardar} ocupado />)
    const boton = screen.getByRole("button", { name: "Guardar" })
    expect(boton).toBeDisabled()
    await fireEvent.press(boton)
    expect(guardar).not.toHaveBeenCalled()

    await screen.rerender(<Boton texto="Guardar" onPress={guardar} />)
    await fireEvent.press(screen.getByRole("button", { name: "Guardar" }))
    expect(guardar).toHaveBeenCalledTimes(1)
  })
})

it("un campo se encuentra por su etiqueta y comunica el error al usuario", async () => {
  function Formulario(): React.JSX.Element {
    const [peso, cambiar] = useState("")
    return (
      <Campo etiqueta="Peso en kg" value={peso} error="Revisa el peso" onChangeText={cambiar} />
    )
  }
  await render(<Formulario />)
  await fireEvent.changeText(screen.getByLabelText("Peso en kg"), "12,5")
  expect(screen.getByDisplayValue("12,5")).toBeOnTheScreen()
  expect(screen.getByRole("alert")).toHaveTextContent("Revisa el peso")
})

it("un botón deshabilitado conserva su texto sin anunciar una carga", async () => {
  const subir = jest.fn()
  await render(<BotonSecundario texto="Subir ejercicio" onPress={subir} deshabilitado />)
  const boton = screen.getByRole("button", { name: "Subir ejercicio" })
  expect(boton).toBeDisabled()
  expect(screen.getByText("Subir ejercicio")).toBeOnTheScreen()
  expect(boton.props.accessibilityState.busy).toBe(false)
  await fireEvent.press(boton)
  expect(subir).not.toHaveBeenCalled()
})
