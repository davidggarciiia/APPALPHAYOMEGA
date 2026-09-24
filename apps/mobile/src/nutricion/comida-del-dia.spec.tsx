import { describe, expect, it, jest } from "@jest/globals"
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native"
import { ComidaSchema, type EleccionDeComida } from "@alpha-omega/shared"

import { ComidaDelDia } from "./comida-del-dia"

jest.mock("../componentes/iconos", () => ({ Icono: () => null }))

const u = (n: number): string => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`

const media = ComidaSchema.parse({
  id: u(1),
  nombre: "Media mañana",
  hora: "11:00",
  indicacion: "café o infusión libre",
  forma: "alternativas",
  grupos: [
    {
      nombre: "Dulces",
      alternativas: [
        {
          id: u(11),
          titulo: "Tortitas de avena",
          alimentos: [{ nombre: "Avena", cantidad: "40 g" }],
          nota: null,
          macros: null,
        },
      ],
    },
    {
      nombre: "Saladas",
      alternativas: [
        {
          id: u(12),
          titulo: "Tostada con pavo",
          alimentos: [{ nombre: "Pavo", cantidad: "80 g" }],
          nota: null,
          macros: null,
        },
      ],
    },
  ],
})

const comida = ComidaSchema.parse({
  id: u(2),
  nombre: "Comida",
  hora: "14:00",
  indicacion: "verdura libre",
  forma: "intercambio",
  columnas: [
    {
      nombre: "Hidrato",
      alimentos: [
        { nombre: "Arroz blanco", cantidad: "50 g" },
        { nombre: "Patata", cantidad: "255 g" },
      ],
    },
    {
      nombre: "Proteína",
      alimentos: [
        { nombre: "Pollo", cantidad: "150 g" },
        { nombre: "Merluza", cantidad: "200 g" },
      ],
    },
  ],
})

describe("ComidaDelDia", () => {
  it("elige una opción de otro grupo y la guarda", async () => {
    const registrar = jest.fn<(e: EleccionDeComida) => Promise<void>>(async () => undefined)
    const volver = jest.fn()
    await render(
      <ComidaDelDia
        comida={media}
        registrar={registrar}
        quitar={async () => undefined}
        volver={volver}
      />,
    )
    expect(screen.getByText("Elige un plato completo · café o infusión libre")).toBeTruthy()
    await fireEvent.press(screen.getByRole("tab", { name: "Saladas" }))
    await fireEvent.press(screen.getByRole("radio", { name: /^Tostada con pavo/ }))
    await fireEvent.press(screen.getByRole("button", { name: "Registrar comida" }))
    await waitFor(() => expect(screen.getByText("Comida registrada")).toBeTruthy())
    expect(volver).not.toHaveBeenCalled()
    expect(registrar).toHaveBeenCalledWith({ tipo: "alternativa", alternativaId: u(12) })
  })

  it("no registra un plato completo hasta que el cliente lo elige", async () => {
    const registrar = jest.fn<(e: EleccionDeComida) => Promise<void>>(async () => undefined)
    await render(
      <ComidaDelDia
        comida={media}
        registrar={registrar}
        quitar={async () => undefined}
        volver={() => undefined}
      />,
    )
    await fireEvent.press(screen.getByRole("button", { name: "Registrar comida" }))
    expect(registrar).not.toHaveBeenCalled()
    expect(screen.getByText("Elige un plato completo antes de guardar.")).toBeTruthy()
  })

  it("exige elegir un alimento de cada grupo antes de guardar", async () => {
    const registrar = jest.fn<(e: EleccionDeComida) => Promise<void>>(async () => undefined)
    await render(
      <ComidaDelDia
        comida={comida}
        registrar={registrar}
        quitar={async () => undefined}
        volver={() => undefined}
      />,
    )
    expect(screen.getByText("Tu plato")).toBeTruthy()
    expect(screen.getAllByText("Elige un alimento")).toHaveLength(2)
    await fireEvent.press(screen.getByRole("button", { name: "Registrar comida" }))
    expect(registrar).not.toHaveBeenCalled()
    await fireEvent.press(screen.getByRole("radio", { name: "Patata, 255 g" }))
    await fireEvent.press(screen.getByRole("tab", { name: "Proteína" }))
    await fireEvent.press(screen.getByRole("radio", { name: "Merluza, 200 g" }))
    await fireEvent.press(screen.getByRole("button", { name: "Registrar comida" }))
    await waitFor(() =>
      expect(registrar).toHaveBeenCalledWith({
        tipo: "plato",
        elegidos: [
          { columna: "Hidrato", alimento: "Patata" },
          { columna: "Proteína", alimento: "Merluza" },
        ],
      }),
    )
    expect(screen.getByText("Comida registrada")).toBeTruthy()
  })

  it("conserva el plato elegido cuando falla la red", async () => {
    const registrar = jest.fn<(e: EleccionDeComida) => Promise<void>>(async () => {
      throw new Error("Sin red")
    })
    await render(
      <ComidaDelDia
        comida={comida}
        registrar={registrar}
        quitar={async () => undefined}
        volver={() => undefined}
      />,
    )
    await fireEvent.press(screen.getByRole("radio", { name: "Patata, 255 g" }))
    await fireEvent.press(screen.getByRole("tab", { name: "Proteína" }))
    await fireEvent.press(screen.getByRole("radio", { name: "Merluza, 200 g" }))
    await fireEvent.press(screen.getByRole("button", { name: "Registrar comida" }))
    expect(await screen.findByText("No se pudo guardar la comida.")).toBeTruthy()
    expect(screen.getByText("Patata")).toBeTruthy()
    expect(
      screen.getByRole("radio", { name: "Merluza, 200 g" }).props.accessibilityState.checked,
    ).toBe(true)
  })

  it("sin conexión se ve pero no se guarda", async () => {
    const registrar = jest.fn<(e: EleccionDeComida) => Promise<void>>(async () => undefined)
    await render(
      <ComidaDelDia
        comida={comida}
        registrar={registrar}
        quitar={async () => undefined}
        volver={() => undefined}
        soloLectura
      />,
    )
    await fireEvent.press(screen.getByRole("button", { name: "Registrar comida" }))
    expect(registrar).not.toHaveBeenCalled()
    expect(screen.getByText(/Sin conexión/)).toBeTruthy()
  })
})
