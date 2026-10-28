import { render, screen } from "@testing-library/react-native"
import type { Bloque } from "@alpha-omega/shared"

import { EditorDeBloque } from "./partes"

jest.mock("../../componentes/iconos", () => ({ Icono: () => null }))

const vacio: Bloque = { objetivos: [], fases: [], deportes: [], notas: [] }

describe("EditorDeBloque · fases", () => {
  it("sin fases no pinta un contenedor vacío: dejaba un hueco entre «Fases» y «Añadir fase»", async () => {
    await render(<EditorDeBloque bloque={vacio} semanas={6} cambiar={jest.fn()} />)
    expect(screen.getByRole("header", { name: "Fases" })).toBeOnTheScreen()
    expect(screen.getByRole("button", { name: "Añadir fase" })).toBeOnTheScreen()
    expect(screen.queryByTestId("fases")).toBeNull()
  })

  it("con fases las muestra", async () => {
    const conFase: Bloque = {
      ...vacio,
      fases: [{ desde: 1, hasta: 3, nombre: "Base", detalle: null }],
    }
    await render(<EditorDeBloque bloque={conFase} semanas={6} cambiar={jest.fn()} />)
    expect(screen.getByTestId("fases")).toBeOnTheScreen()
    expect(screen.getByDisplayValue("Base")).toBeOnTheScreen()
  })
})
