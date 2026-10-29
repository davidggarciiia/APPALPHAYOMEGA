import { fireEvent, render, screen, waitFor } from "@testing-library/react-native"
import { AccessibilityInfo } from "react-native"

import { nuevoEjercicio } from "./modelo"
import { ListaDeSeccion } from "./partes"
import { TablaPrincipal } from "./tabla"

jest.mock("../../componentes/iconos", () => ({ Icono: () => null }))

const banca = {
  ...nuevoEjercicio({ id: "banca", nombre: "Press banca" }, "principal", () => "primero"),
  carga: "60",
  calibrar: false,
}
const remo = {
  ...nuevoEjercicio({ id: "remo", nombre: "Remo" }, "principal", () => "segundo"),
  carga: "40",
  calibrar: false,
}

afterEach(() => jest.restoreAllMocks())

it("anima las filas al añadir, quitar y cambiar de orden sin mezclar sus valores", async () => {
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(false)
  const mover = jest.fn()
  const quitar = jest.fn()
  const ajustar = jest.fn()
  const tabla = (ejercicios: (typeof banca)[]) => (
    <TablaPrincipal
      ejercicios={ejercicios}
      elegido={banca.id}
      elegir={jest.fn()}
      cambiar={jest.fn()}
      ajustar={ajustar}
      quitar={quitar}
      mover={mover}
      ancha={false}
    />
  )
  const vista = await render(tabla([banca]))
  await waitFor(() =>
    expect(screen.getByTestId("ejercicio-constructor-primero")).toHaveProp(
      "layout",
      expect.anything(),
    ),
  )

  await vista.rerender(tabla([banca, remo]))
  expect(screen.getByTestId("ejercicio-constructor-segundo")).toHaveProp(
    "entering",
    expect.anything(),
  )
  expect(screen.getByTestId("ejercicio-constructor-segundo")).toHaveProp(
    "exiting",
    expect.anything(),
  )
  await fireEvent.press(screen.getByRole("button", { name: "Subir Remo" }))
  expect(mover).toHaveBeenCalledWith(remo.id, -1)
  await vista.rerender(tabla([remo, banca]))
  expect(screen.getAllByTestId(/^ejercicio-constructor-/).map((fila) => fila.props.testID)).toEqual(
    ["ejercicio-constructor-segundo", "ejercicio-constructor-primero"],
  )
  expect(
    screen.getByRole("button", { name: "Carga inicial de Press banca en kg" }),
  ).toHaveTextContent("60")
  expect(screen.getByRole("button", { name: "Carga inicial de Remo en kg" })).toHaveTextContent(
    "40",
  )
  await fireEvent.press(screen.getByRole("button", { name: "Series de Press banca" }))
  expect(ajustar).toHaveBeenCalledWith(banca.id, "series")

  await fireEvent.press(screen.getByRole("button", { name: "Quitar Remo" }))
  expect(quitar).toHaveBeenCalledWith(remo.id)
  await vista.rerender(tabla([banca]))
  expect(screen.queryByTestId("ejercicio-constructor-segundo")).toBeNull()
  expect(screen.getByRole("button", { name: "Press banca: editar detalles" })).toHaveProp(
    "accessibilityState",
    {
      selected: true,
    },
  )
})

it.each(["calentamiento", "circuito", "final"] as const)(
  "anima las filas de %s y conserva la edición y retirada por identificador",
  async (seccion) => {
    jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(false)
    const elegir = jest.fn()
    const quitar = jest.fn()
    await render(
      <ListaDeSeccion
        ejercicios={[{ ...banca, seccion }]}
        elegido={null}
        elegir={elegir}
        cambiar={jest.fn()}
        quitar={quitar}
      />,
    )
    await waitFor(() =>
      expect(screen.getByTestId("ejercicio-constructor-primero")).toHaveProp(
        "layout",
        expect.anything(),
      ),
    )
    await fireEvent.press(screen.getByRole("button", { name: "Press banca: editar detalles" }))
    expect(elegir).toHaveBeenCalledWith(banca.id)
    await fireEvent.press(screen.getByRole("button", { name: "Quitar Press banca" }))
    expect(quitar).toHaveBeenCalledWith(banca.id)
  },
)

it("mantiene las listas utilizables sin transiciones con movimiento reducido", async () => {
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(true)
  const elegir = jest.fn()
  await render(
    <ListaDeSeccion
      ejercicios={[banca]}
      elegido={null}
      elegir={elegir}
      cambiar={jest.fn()}
      quitar={jest.fn()}
    />,
  )
  const fila = screen.getByTestId("ejercicio-constructor-primero")
  for (const animacion of ["entering", "exiting", "layout"])
    expect(fila.props[animacion]).toBeUndefined()
  await fireEvent.press(screen.getByRole("button", { name: "Press banca: editar detalles" }))
  expect(elegir).toHaveBeenCalledWith(banca.id)
})
