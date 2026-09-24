import { describe, expect, it, jest } from "@jest/globals"
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native"
import {
  ComidaSchema,
  type Comida,
  type ComidaRegistrada,
  type EleccionDeComida,
} from "@alpha-omega/shared"

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

  it("corrige una comida ya registrada y después la quita", async () => {
    const registrar = jest.fn<(e: EleccionDeComida) => Promise<void>>(async () => undefined)
    const quitar = jest.fn<() => Promise<void>>(async () => undefined)
    await render(
      <ComidaDelDia
        comida={media}
        registrada={registrada({ tipo: "alternativa", alternativaId: u(11) })}
        registrar={registrar}
        quitar={quitar}
        volver={() => undefined}
      />,
    )
    // La opción en su grupo y el resumen de lo que ya consta como hecho.
    expect(screen.getAllByText("Tortitas de avena")).toHaveLength(2)
    await fireEvent.press(screen.getByRole("tab", { name: "Saladas" }))
    await fireEvent.press(screen.getByRole("radio", { name: /^Tostada con pavo/ }))
    await fireEvent.press(screen.getByRole("button", { name: "Registrar comida" }))
    await waitFor(() =>
      expect(registrar).toHaveBeenCalledWith({ tipo: "alternativa", alternativaId: u(12) }),
    )
    expect(await screen.findAllByText("Tostada con pavo")).toHaveLength(2)
    await fireEvent.press(screen.getByRole("button", { name: "Quitar de hechas" }))
    await waitFor(() => expect(screen.queryByText("Comida registrada")).toBeNull())
    expect(quitar).toHaveBeenCalledTimes(1)
  })
})

const unico = ComidaSchema.parse({
  id: u(3),
  nombre: "Cena",
  hora: "21:00",
  indicacion: null,
  forma: "alternativas",
  grupos: [
    {
      nombre: null,
      alternativas: [
        {
          id: u(31),
          titulo: "Tortilla francesa",
          alimentos: [{ nombre: "Huevo", cantidad: "2 ud" }],
          nota: null,
          macros: null,
        },
      ],
    },
  ],
})

function registrada(eleccion: EleccionDeComida, comidaId = u(1)): ComidaRegistrada {
  return {
    fecha: "2026-09-24",
    comidaId,
    dietaId: u(90),
    eleccion,
    registradaEn: "2026-09-24T10:00:00.000Z",
  }
}

/** Los tres formatos de comida, cómo se elige en cada uno y lo que se enviaría. */
const formatos: {
  nombre: string
  comida: Comida
  opcion: string
  elegir: () => Promise<void>
  eleccion: EleccionDeComida
}[] = [
  {
    nombre: "plato único",
    comida: unico,
    opcion: "Tortilla francesa",
    elegir: async () => {
      await fireEvent.press(screen.getByRole("radio", { name: /^Tortilla francesa/ }))
    },
    eleccion: { tipo: "alternativa", alternativaId: u(31) },
  },
  {
    nombre: "varios platos",
    comida: media,
    opcion: "Tortitas de avena",
    elegir: async () => {
      await fireEvent.press(screen.getByRole("tab", { name: "Saladas" }))
      await fireEvent.press(screen.getByRole("radio", { name: /^Tostada con pavo/ }))
    },
    eleccion: { tipo: "alternativa", alternativaId: u(12) },
  },
  {
    nombre: "intercambio",
    comida,
    opcion: "Arroz blanco",
    elegir: async () => {
      await fireEvent.press(screen.getByRole("radio", { name: "Patata, 255 g" }))
      await fireEvent.press(screen.getByRole("tab", { name: "Proteína" }))
      await fireEvent.press(screen.getByRole("radio", { name: "Merluza, 200 g" }))
    },
    eleccion: {
      tipo: "plato",
      elegidos: [
        { columna: "Hidrato", alimento: "Patata" },
        { columna: "Proteína", alimento: "Merluza" },
      ],
    },
  },
]

/** La última opción elegida sigue marcada. */
function elegidaMarcada(eleccion: EleccionDeComida): boolean {
  const nombre =
    eleccion.tipo === "plato"
      ? "Merluza, 200 g"
      : eleccion.tipo === "alternativa" && eleccion.alternativaId === u(31)
        ? /^Tortilla francesa/
        : /^Tostada con pavo/
  return screen.getByRole("radio", { name: nombre }).props.accessibilityState.checked === true
}

const SOLO_CONSULTA = "Tu profesional ha dejado esta comida solo para consultar."

describe.each(formatos)("ComidaDelDia · $nombre", ({ comida: plato, opcion, elegir, eleccion }) => {
  it("con el registro desactivado muestra la pauta sin ofrecer guardar", async () => {
    const registrar = jest.fn<(e: EleccionDeComida) => Promise<void>>(async () => undefined)
    const quitar = jest.fn<() => Promise<void>>(async () => undefined)
    await render(
      <ComidaDelDia
        comida={plato}
        registrar={registrar}
        quitar={quitar}
        volver={() => undefined}
        motivoSoloLectura="registroDesactivado"
      />,
    )
    expect(screen.getByText(SOLO_CONSULTA)).toBeTruthy()
    expect(screen.getByText(opcion)).toBeTruthy()
    expect(screen.queryByText(/Sin conexión/)).toBeNull()
    expect(screen.queryByRole("button", { name: "Registrar comida" })).toBeNull()
    expect(screen.queryByRole("button", { name: /Reintentar/ })).toBeNull()
    await elegir()
    expect(screen.queryByRole("button", { name: "Registrar comida" })).toBeNull()
    expect(registrar).not.toHaveBeenCalled()
    expect(quitar).not.toHaveBeenCalled()
  })

  it("con el registro desactivado conserva lo ya registrado sin permitir quitarlo", async () => {
    const quitar = jest.fn<() => Promise<void>>(async () => undefined)
    await render(
      <ComidaDelDia
        comida={plato}
        registrada={registrada({ tipo: "hecha" }, plato.id)}
        registrar={async () => undefined}
        quitar={quitar}
        volver={() => undefined}
        motivoSoloLectura="registroDesactivado"
      />,
    )
    expect(screen.getByText("Comida registrada")).toBeTruthy()
    expect(screen.getByText(SOLO_CONSULTA)).toBeTruthy()
    expect(screen.queryByRole("button", { name: "Quitar de hechas" })).toBeNull()
    expect(quitar).not.toHaveBeenCalled()
  })

  it("sin conexión conserva la elección, ofrece reintentar y registra al volver la red", async () => {
    const registrar = jest.fn<(e: EleccionDeComida) => Promise<void>>(async () => undefined)
    let conectar!: () => void
    const reintentar = jest.fn(
      () =>
        new Promise<void>((resolve) => {
          conectar = resolve
        }),
    )
    const pantalla = (motivo?: "sinConexion") => (
      <ComidaDelDia
        comida={plato}
        registrar={registrar}
        quitar={async () => undefined}
        volver={() => undefined}
        reintentar={reintentar}
        motivoSoloLectura={motivo}
      />
    )
    const { rerender } = await render(pantalla("sinConexion"))
    expect(screen.getByText(/^Sin conexión/)).toBeTruthy()
    expect(screen.queryByText(SOLO_CONSULTA)).toBeNull()
    expect(screen.queryByRole("button", { name: "Registrar comida" })).toBeNull()
    await elegir()

    // Un reintento que no encuentra red no finge haber guardado nada.
    await fireEvent.press(screen.getByRole("button", { name: "Reintentar conexión" }))
    expect(screen.getByRole("button", { name: "Reintentar conexión", busy: true })).toBeTruthy()
    await act(async () => conectar())
    expect(await screen.findByText(/^Sigues sin conexión/)).toBeTruthy()
    expect(reintentar).toHaveBeenCalledTimes(1)
    expect(elegidaMarcada(eleccion)).toBe(true)
    expect(screen.queryByText("Comida registrada")).toBeNull()
    expect(registrar).not.toHaveBeenCalled()

    // Vuelve la red: la misma elección se registra con confirmación del servidor.
    await rerender(pantalla())
    expect(screen.queryByText(/sin conexión/i)).toBeNull()
    expect(elegidaMarcada(eleccion)).toBe(true)
    await fireEvent.press(screen.getByRole("button", { name: "Registrar comida" }))
    await waitFor(() => expect(registrar).toHaveBeenCalledWith(eleccion))
    expect(await screen.findByText("Comida registrada")).toBeTruthy()
  })

  it("con conexión solo confirma cuando el servidor responde", async () => {
    let responder!: () => void
    const registrar = jest.fn(
      (_e: EleccionDeComida) =>
        new Promise<void>((resolve) => {
          responder = resolve
        }),
    )
    await render(
      <ComidaDelDia
        comida={plato}
        registrar={registrar}
        quitar={async () => undefined}
        volver={() => undefined}
      />,
    )
    expect(screen.queryByText(SOLO_CONSULTA)).toBeNull()
    expect(screen.queryByText(/Sin conexión/)).toBeNull()
    await elegir()
    await fireEvent.press(screen.getByRole("button", { name: "Registrar comida" }))
    expect(registrar).toHaveBeenCalledWith(eleccion)
    expect(screen.queryByText("Comida registrada")).toBeNull()
    await act(async () => responder())
    expect(await screen.findByText("Comida registrada")).toBeTruthy()
    expect(screen.getByRole("button", { name: "Quitar de hechas" })).toBeTruthy()
  })
})
