import { useState } from "react"
import { fireEvent, render, screen } from "@testing-library/react-native"
import { SeriePrescritaDistanciaSchema, SesionEnRutinaSchema } from "@alpha-omega/shared"
import {
  agregarEjercicio,
  convertirSerie,
  convertirSesion,
  desdeSesion,
  nuevaSesion,
  type SesionConDistancia,
  type SesionEditable,
} from "./editor-modelo"
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

describe("Distancia en metros (D01)", () => {
  const GRANJERO = "10000000-0000-4000-8000-000000000001"
  const SERIE = "40000000-0000-4000-8000-000000000001"
  // Datos sintéticos: un transporte con carga guardado en metros.
  const guardada: SesionConDistancia = {
    id: "20000000-0000-4000-8000-000000000001",
    nombre: "Fuerza",
    diaSemana: 1,
    ejercicios: [
      {
        id: "30000000-0000-4000-8000-000000000001",
        ejercicioId: GRANJERO,
        indicaciones: null,
        tipoCarga: "conCargaExterna",
        series: [
          SeriePrescritaDistanciaSchema.parse({
            id: SERIE,
            tipoMedicion: "distancia",
            pesoKg: 32,
            metros: 20,
          }),
        ],
      },
    ],
  }

  async function editar(inicial: SesionEditable): Promise<() => SesionEditable> {
    let actual = inicial
    function Formulario(): React.JSX.Element {
      const [sesion, cambiar] = useState(inicial)
      actual = sesion
      return <EditorSesion valor={sesion} cambiar={cambiar} mostrarDia={false} />
    }
    await render(<Formulario />)
    return () => actual
  }

  it("una serie en metros se muestra y se edita en metros, con su carga e id", async () => {
    const actual = await editar(desdeSesion(guardada, { [GRANJERO]: "Paseo del granjero" }))
    expect(screen.getByRole("button", { name: "✓ Metros" })).toBeOnTheScreen()
    expect(screen.getByLabelText("Metros — Paseo del granjero, serie 1")).toHaveProp("value", "20")
    expect(screen.getByLabelText("Peso kg — Paseo del granjero, serie 1 (opcional)")).toHaveProp(
      "value",
      "32",
    )
    expect(screen.queryByLabelText(/^(Repeticiones|Segundos) — /)).toBeNull()

    await fireEvent.changeText(screen.getByLabelText("Metros — Paseo del granjero, serie 1"), "25")
    const ejercicio = actual().ejercicios[0]!
    expect(
      SeriePrescritaDistanciaSchema.parse(convertirSerie(ejercicio.series[0]!, ejercicio)),
    ).toEqual({ id: SERIE, tipoMedicion: "distancia", pesoKg: 32, metros: 25 })
  })

  it("al pautar se ofrecen metros, sin arrastrar las repeticiones escritas", async () => {
    const inicial = agregarEjercicio(nuevaSesion(), { id: GRANJERO, nombre: "Paseo del granjero" })
    inicial.nombre = "Fuerza"
    inicial.ejercicios[0]!.series[0]!.objetivo = "12"
    const actual = await editar(inicial)
    expect(screen.getByRole("button", { name: "✓ Repeticiones" })).toBeOnTheScreen()
    await fireEvent.press(screen.getByRole("button", { name: "Metros" }))
    expect(screen.getByRole("button", { name: "✓ Metros" })).toBeOnTheScreen()
    // Las 12 repeticiones no pasan a 12 m: el campo queda vacío.
    const metros = screen.getByLabelText("Metros — Paseo del granjero, serie 1")
    expect(metros).toHaveProp("value", "")
    await fireEvent.changeText(metros, "20")
    await fireEvent.changeText(
      screen.getByLabelText("Peso kg — Paseo del granjero, serie 1 (opcional)"),
      "32",
    )
    // Publicar: la sesión cumple el contrato público con los metros y la carga.
    const publicada = SesionEnRutinaSchema.parse(convertirSesion(actual()))
    expect(publicada.ejercicios[0]).toMatchObject({
      tipoCarga: "conCargaExterna",
      series: [
        {
          id: inicial.ejercicios[0]!.series[0]!.id,
          tipoMedicion: "distancia",
          pesoKg: 32,
          metros: 20,
        },
      ],
    })
  })

  it("cada campo nombra su unidad y las tres se ofrecen en cada serie", async () => {
    await editar(agregarEjercicio(nuevaSesion(), { id: GRANJERO, nombre: "Plancha" }))
    expect(screen.getByLabelText("Repeticiones — Plancha, serie 1")).toBeOnTheScreen()
    await fireEvent.press(screen.getByRole("button", { name: "Segundos" }))
    expect(screen.getByLabelText("Segundos — Plancha, serie 1")).toBeOnTheScreen()
    expect(
      screen.getAllByRole("button", { name: /^(✓ )?(Repeticiones|Segundos|Metros)$/ }),
    ).toHaveLength(3)
    await fireEvent.press(screen.getByRole("button", { name: "Añadir serie a Plancha" }))
    expect(
      screen.getAllByRole("button", { name: /^(✓ )?(Repeticiones|Segundos|Metros)$/ }),
    ).toHaveLength(6)
  })

  it("pasar una serie en metros a otra unidad conserva id y carga sin arrastrar la cantidad", async () => {
    const actual = await editar(desdeSesion(guardada, { [GRANJERO]: "Paseo del granjero" }))
    await fireEvent.press(screen.getByRole("button", { name: "Repeticiones" }))
    expect(actual().ejercicios[0]!.series[0]).toEqual({
      id: SERIE,
      tipoMedicion: "repeticiones",
      peso: "32",
      objetivo: "",
    })
    expect(screen.getByLabelText("Repeticiones — Paseo del granjero, serie 1")).toHaveProp(
      "value",
      "",
    )
  })
})
