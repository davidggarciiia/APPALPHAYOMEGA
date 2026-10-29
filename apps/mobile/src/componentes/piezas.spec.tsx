import { fireEvent, render, screen } from "@testing-library/react-native"
import { Text } from "react-native"

import { Chip, Fila, Pestanas, Tarjeta } from "./piezas"
import { tema } from "../tema"

it("el chip anuncia selección, amplía el toque y respeta deshabilitado", async () => {
  const elegir = jest.fn()
  await render(<Chip texto="Lunes" activo onPress={elegir} />)
  const chip = screen.getByRole("button", { name: "Lunes", selected: true })
  expect(chip.props.hitSlop).toBe(2)
  expect(chip).toHaveStyle({
    minHeight: 40,
    backgroundColor: tema.acentoSuave,
    borderColor: tema.acento,
  })
  await fireEvent.press(chip)
  expect(elegir).toHaveBeenCalledTimes(1)
  await screen.rerender(<Chip texto="Lunes" activo onPress={elegir} deshabilitado />)
  await fireEvent.press(screen.getByRole("button", { name: "Lunes" }))
  expect(elegir).toHaveBeenCalledTimes(1)
})

it("las pestañas mantienen selección y bloqueo en la variante segmentada", async () => {
  const cambiar = jest.fn()
  const opciones = [
    { valor: "semana", texto: "Semana" },
    { valor: "rutina", texto: "Rutina" },
  ]
  await render(
    <Pestanas
      opciones={opciones}
      activa="semana"
      cambiar={cambiar}
      variante="pil"
      bloquearCambio
    />,
  )
  expect(screen.getByRole("tab", { name: "Semana", selected: true })).toHaveStyle({
    minHeight: 44,
    backgroundColor: tema.superficieAlta,
  })
  const rutina = screen.getByRole("tab", { name: "Rutina" })
  expect(rutina).toBeDisabled()
  await fireEvent.press(rutina)
  expect(cambiar).not.toHaveBeenCalled()
})

it("la tarjeta normal tiene relleno y la lista mantiene filas de al menos 56", async () => {
  await render(
    <Tarjeta>
      <Text>Contenido</Text>
    </Tarjeta>,
  )
  expect(screen.getByTestId("tarjeta")).toHaveStyle({
    padding: 16,
    borderRadius: 20,
    backgroundColor: tema.superficie,
  })
  await screen.rerender(
    <Tarjeta variante="lista">
      <Fila primera>
        <Text>Fila uno</Text>
      </Fila>
      <Fila>
        <Text>Fila dos</Text>
      </Fila>
    </Tarjeta>,
  )
  expect(screen.getAllByTestId("tarjeta-fila")[1]).toHaveStyle({
    minHeight: 56,
    borderTopColor: tema.borde,
    borderTopWidth: 1,
  })
})
