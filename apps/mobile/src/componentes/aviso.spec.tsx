import { fireEvent, render, screen } from "@testing-library/react-native"
import { Aviso } from "./aviso"

it("anuncia el error y permite reintentar la operación", async () => {
  const reintentar = jest.fn()
  await render(<Aviso tipo="error" mensaje="No se pudo guardar" alReintentar={reintentar} />)
  expect(screen.getByRole("alert")).toHaveTextContent("No se pudo guardar")
  await fireEvent.press(screen.getByRole("button", { name: "Reintentar" }))
  expect(reintentar).toHaveBeenCalledTimes(1)
})

it("muestra la fecha de la copia sin añadir una acción cuando no se puede reintentar", async () => {
  await render(<Aviso tipo="conexion" mensaje="Sin conexión · copia del 28 oct" />)
  expect(screen.getByText("Sin conexión · copia del 28 oct")).toBeOnTheScreen()
  expect(screen.queryByRole("button")).toBeNull()
})
