import { fireEvent, render, screen } from "@testing-library/react-native"
import { StyleSheet } from "react-native"

import { tema } from "../tema"
import { ChipsRir } from "./chips-rir"

it("expone seis opciones controladas, incluido cero y cinco o más", async () => {
  const cambiar = jest.fn()
  await render(<ChipsRir valor={0} objetivo={3} cambiar={cambiar} etiqueta="RIR de la serie" />)
  expect(screen.getAllByRole("radio")).toHaveLength(6)
  expect(screen.getByRole("radio", { name: /RIR 0/ })).toBeChecked()
  const cinco = screen.getByRole("radio", { name: /RIR 5 o más/ })
  await fireEvent.press(cinco)
  expect(cambiar).toHaveBeenCalledWith(5)
  expect(cinco).not.toBeChecked()
})

it("distingue el objetivo y avisa por debajo sin depender solo del color", async () => {
  await render(<ChipsRir valor={1} objetivo={3} cambiar={jest.fn()} />)
  const bajo = screen.getByRole("radio", { name: "RIR 1, por debajo del objetivo" })
  expect(StyleSheet.flatten(bajo.props.style)).toMatchObject({
    borderStyle: "dashed",
    borderColor: tema.aviso,
    minHeight: 48,
    minWidth: 46,
  })
  expect(
    StyleSheet.flatten(screen.getByRole("radio", { name: "RIR 3, objetivo" }).props.style),
  ).toMatchObject({ borderStyle: "dashed", borderColor: tema.acento })
})

it("no admite cambios cuando está deshabilitado", async () => {
  const cambiar = jest.fn()
  await render(<ChipsRir valor={null} cambiar={cambiar} deshabilitado />)
  const cero = screen.getByRole("radio", { name: "RIR 0" })
  expect(cero).toBeDisabled()
  await fireEvent.press(cero)
  expect(cambiar).not.toHaveBeenCalled()
})
