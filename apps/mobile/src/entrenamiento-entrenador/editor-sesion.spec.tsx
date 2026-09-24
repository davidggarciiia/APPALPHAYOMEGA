import { useState } from "react"
import { fireEvent, render, screen } from "@testing-library/react-native"
import { agregarEjercicio, convertirSesion, nuevaSesion } from "./editor-modelo"
import { EditorSesion } from "./editor-sesion"

jest.mock("expo-crypto", () => ({
  randomUUID: jest.requireActual<typeof import("node:crypto")>("node:crypto").randomUUID,
}))

it("permite configurar RIR y carga de un ejercicio desde el editor de sesión", async () => {
  const inicial = agregarEjercicio(nuevaSesion(), {
    id: "10000000-0000-4000-8000-000000000000",
    nombre: "Plancha",
  })
  inicial.nombre = "Core"
  inicial.ejercicios[0]!.series[0]!.objetivo = "30"
  let actual = inicial
  function Formulario(): React.JSX.Element {
    const [sesion, cambiar] = useState(inicial)
    actual = sesion
    return <EditorSesion valor={sesion} cambiar={cambiar} />
  }
  await render(<Formulario />)
  await fireEvent.press(screen.getByRole("button", { name: "RIR al finalizar Plancha" }))
  await fireEvent.press(screen.getByRole("button", { name: "Plancha sin carga externa" }))
  const ejercicio = convertirSesion(actual).ejercicios[0]!
  expect(ejercicio.modoRir).toBe("alFinalizarEjercicio")
  expect(ejercicio.tipoCarga).toBe("sinCarga")
  expect(screen.queryByLabelText(/Peso kg — Plancha/)).toBeNull()
})
