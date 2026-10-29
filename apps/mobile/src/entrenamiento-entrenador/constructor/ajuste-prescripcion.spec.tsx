import { act, fireEvent, render, screen } from "@testing-library/react-native"
import { useState } from "react"
import { Keyboard, StyleSheet, Text, type KeyboardEvent } from "react-native"

import { AjustePrescripcion, type CampoPrescripcion } from "./ajuste-prescripcion"
import { nuevoEjercicio, type EjercicioDelConstructor } from "./modelo"

const inicial = (): EjercicioDelConstructor => ({
  ...nuevoEjercicio({ id: "biblioteca", nombre: "Press" }, "principal", () => "press"),
  objetivo: "8–10",
  carga: "60",
  calibrar: false,
  subida: "2,5",
})
function Controlada({
  campo,
  ejercicio = inicial(),
  cambiar = jest.fn(),
  validez = jest.fn(),
}: {
  campo: CampoPrescripcion
  ejercicio?: EjercicioDelConstructor
  cambiar?: jest.Mock
  validez?: jest.Mock
}): React.JSX.Element {
  const [actual, setActual] = useState(ejercicio)
  return (
    <AjustePrescripcion
      ejercicio={actual}
      campo={campo}
      cerrar={jest.fn()}
      cambiar={(id, cambio) => {
        cambiar(id, cambio)
        setActual((e) => ({ ...e, ...cambio }))
      }}
      alCambiarValidez={validez}
    />
  )
}

it("ajusta series en uno y carga con subida y teclado decimal", async () => {
  const cambiar = jest.fn()
  await render(<Controlada campo="series" cambiar={cambiar} />)
  await fireEvent.press(screen.getByRole("button", { name: "Aumentar" }))
  expect(cambiar).toHaveBeenLastCalledWith("press", { series: "4" })
  await screen.unmount()
  await render(<Controlada campo="carga" cambiar={cambiar} />)
  await fireEvent.press(screen.getByRole("button", { name: "Aumentar" }))
  expect(cambiar).toHaveBeenLastCalledWith("press", { carga: "62,5", calibrar: false })
  await fireEvent.press(screen.getByRole("button", { name: "Escribir KG: 62,5" }))
  expect(screen.getByLabelText("Valor manual KG").props.keyboardType).toBe("decimal-pad")
})

it("edita mínimo y máximo de reps y escribe un único número cuando coinciden", async () => {
  const cambiar = jest.fn()
  await render(<Controlada campo="objetivo" cambiar={cambiar} />)
  await fireEvent.press(screen.getByRole("button", { name: "Aumentar" }))
  expect(cambiar).toHaveBeenLastCalledWith("press", { objetivo: "9–10" })
  await fireEvent.press(screen.getByRole("button", { name: "Aumentar" }))
  expect(cambiar).toHaveBeenLastCalledWith("press", { objetivo: "10" })
  await fireEvent.press(screen.getByRole("button", { name: "Reps máx." }))
  await fireEvent.press(screen.getByRole("button", { name: "Aumentar" }))
  expect(cambiar).toHaveBeenLastCalledWith("press", { objetivo: "10–11" })
})

it("en segundos del constructor avanza de uno en uno", async () => {
  const cambiar = jest.fn()
  await render(
    <Controlada
      campo="objetivo"
      ejercicio={{ ...inicial(), tipo: "tiempo", objetivo: "40" }}
      cambiar={cambiar}
    />,
  )
  expect(screen.queryByRole("button", { name: "Seg máx." })).toBeNull()
  await fireEvent.press(screen.getByRole("button", { name: "Aumentar" }))
  expect(cambiar).toHaveBeenLastCalledWith("press", { objetivo: "41" })
})

it("ofrece descanso rápido y Otro conserva un texto libre de hasta 30 caracteres", async () => {
  const cambiar = jest.fn()
  await render(<Controlada campo="descanso" cambiar={cambiar} />)
  for (const valor of ["60 s", "90 s", "2 min", "2–3 min"]) {
    await fireEvent.press(screen.getByRole("button", { name: `Descanso ${valor}` }))
    expect(cambiar).toHaveBeenLastCalledWith("press", { descanso: valor })
  }
  await fireEvent.press(screen.getByRole("button", { name: "Descanso Otro" }))
  const campo = screen.getByLabelText("Descanso de Press")
  expect(campo.props.maxLength).toBe(30)
  await fireEvent.changeText(campo, "Hasta recuperar el aliento")
  expect(cambiar).toHaveBeenLastCalledWith("press", { descanso: "Hasta recuperar el aliento" })
})

it("reutiliza RIR 0–5+ y no modifica rangos existentes al abrir", async () => {
  const cambiar = jest.fn()
  await render(
    <Controlada campo="rir" ejercicio={{ ...inicial(), rir: "2–3" }} cambiar={cambiar} />,
  )
  expect(cambiar).not.toHaveBeenCalled()
  await fireEvent.press(screen.getByRole("radio", { name: "RIR 5 o más" }))
  expect(cambiar).toHaveBeenLastCalledWith("press", { rir: "5" })
})

it("permite retirar una carga opcional y confirmar sin volver a cero", async () => {
  const cambiar = jest.fn()
  const validez = jest.fn()
  await render(<Controlada campo="carga" cambiar={cambiar} validez={validez} />)
  await fireEvent.press(screen.getByRole("button", { name: "Escribir KG: 60" }))
  await fireEvent.changeText(screen.getByLabelText("Valor manual KG"), "")
  expect(cambiar).toHaveBeenLastCalledWith("press", { carga: "", calibrar: false })
  expect(validez).toHaveBeenLastCalledWith(true)
  expect(screen.getByRole("button", { name: "Listo" })).toBeEnabled()
  await fireEvent.press(screen.getByRole("button", { name: "Listo" }))
  expect(screen.getByRole("button", { name: "Escribir KG: —" })).toBeOnTheScreen()
})

it("permite volver a Sin objetivo después de elegir un RIR", async () => {
  const cambiar = jest.fn()
  await render(<Controlada campo="rir" cambiar={cambiar} />)
  await fireEvent.press(screen.getByRole("radio", { name: "RIR 3" }))
  await fireEvent.press(screen.getByRole("button", { name: "Sin objetivo" }))
  expect(cambiar).toHaveBeenLastCalledWith("press", { rir: "" })
  expect(screen.getByRole("radio", { name: "RIR 3" }).props.accessibilityState.checked).toBe(false)
  expect(screen.getByRole("button", { name: "Listo" })).toBeEnabled()
})

it("texto numérico inválido bloquea Listo y publicación sin cambiar el modelo", async () => {
  const cambiar = jest.fn()
  const validez = jest.fn()
  await render(<Controlada campo="series" cambiar={cambiar} validez={validez} />)
  await fireEvent.press(screen.getByRole("button", { name: "Escribir SERIES: 3" }))
  await fireEvent.changeText(screen.getByLabelText("Valor manual SERIES"), "31")
  expect(cambiar).not.toHaveBeenCalled()
  expect(screen.getByRole("button", { name: "Listo" })).toBeDisabled()
  expect(validez).toHaveBeenLastCalledWith(false)
})

it("no descarta una entrada inválida al intentar cambiar al otro límite", async () => {
  const validez = jest.fn()
  await render(<Controlada campo="objetivo" validez={validez} />)
  await fireEvent.press(screen.getByRole("button", { name: "Escribir REPS: 8" }))
  await fireEvent.changeText(screen.getByLabelText("Valor manual REPS"), "11")
  expect(screen.getByRole("button", { name: "Reps máx." })).toBeDisabled()
  await fireEvent.press(screen.getByRole("button", { name: "Reps máx." }))
  expect(screen.getByLabelText("Valor manual REPS").props.value).toBe("11")
  expect(validez).toHaveBeenLastCalledWith(false)
})

it("el descanso libre sube sobre el teclado y retira sus suscripciones", async () => {
  const eventos = new Map<string, (e: KeyboardEvent) => void>()
  const quitar = jest.fn()
  const escuchar = jest.spyOn(Keyboard, "addListener").mockImplementation((nombre, callback) => {
    eventos.set(nombre, callback)
    return { remove: quitar } as unknown as ReturnType<typeof Keyboard.addListener>
  })
  try {
    await render(<Controlada campo="descanso" />)
    const barra = screen.getByTestId("barra-ajuste")
    expect(StyleSheet.flatten(barra.props.style).bottom).toBe(20)
    await act(() =>
      eventos.get("keyboardDidShow")?.({ endCoordinates: { screenY: 400 } } as KeyboardEvent),
    )
    expect(StyleSheet.flatten(barra.props.style).bottom).toBeGreaterThan(20)
    await screen.unmount()
    expect(quitar).toHaveBeenCalledTimes(4)
  } finally {
    escuchar.mockRestore()
  }
})

it.each(["series", "descanso"] as const)(
  "mantiene el aviso fuera y encima de la tarjeta de %s",
  async (campo) => {
    await render(
      <AjustePrescripcion
        ejercicio={inicial()}
        campo={campo}
        cambiar={jest.fn()}
        cerrar={jest.fn()}
        aviso={<Text testID="aviso-retirada">Ejercicio quitado</Text>}
      />,
    )
    const barra = screen.getByTestId("barra-ajuste")
    const tarjeta = screen.getByTestId("tarjeta-ajuste")
    const aviso = screen.getByTestId("aviso-retirada")
    expect(barra.children).toEqual([aviso.parent, tarjeta])
    expect(aviso.parent).toHaveStyle({ marginBottom: 12 })
    expect(StyleSheet.flatten(tarjeta.props.style).position).toBeUndefined()
  },
)
