import { describe, expect, it, jest } from "@jest/globals"
import { fireEvent, render, screen } from "@testing-library/react-native"
import { PrescripcionSchema, type EjercicioPrescrito, type PlanVigente } from "@alpha-omega/shared"

import { objetivoDeSerie } from "../sesion/modelo"
import { BloqueDelPlan } from "./bloque"
import { Guia } from "./guia"
import { RutinaDeLaSemana, type DiaDelPlan } from "./rutina"
import { PlanCliente } from "./plan-cliente"
import type { ApiEntrenamiento } from "../api"
import { lunesDeSemana } from "../fechas"

let mockFoco = 0
jest.mock("expo-router", () => ({
  useFocusEffect: (efecto: () => void) =>
    jest.requireActual<typeof import("react")>("react").useEffect(efecto, [efecto, mockFoco]),
}))
jest.mock("../almacen-dispositivo", () => ({
  almacenDispositivo: { leer: jest.fn(), guardar: jest.fn(async () => undefined) },
}))
jest.mock("../../catalogo-ejercicios/use-catalogo", () => ({
  useCatalogo: () => ({ leer: jest.fn() }),
}))
jest.mock("../../catalogo-ejercicios/figura-ejercicio", () => ({
  useAccesoAFiguras: () => ({ base: "http://api", token: "t", renovar: jest.fn() }),
}))

const u = (n: number): string => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`

const empuje = PrescripcionSchema.parse({
  nombre: "Empuje",
  partes: { calentamiento: "8–10", fuerza: "70–85" },
  circuito: { nombre: "Core", vueltas: 2 },
  ejercicios: [
    {
      id: u(1),
      ejercicioId: u(11),
      nombre: "Band pull-apart",
      indicaciones: null,
      seccion: "calentamiento",
      dosis: "2×12",
      series: [{ id: u(21), tipoMedicion: "repeticiones", pesoKg: null, repeticiones: 12 }],
    },
    {
      id: u(2),
      ejercicioId: u(12),
      nombre: "Press banca con barra",
      indicaciones: null,
      rir: { min: 3, max: 3 },
      descanso: "2–3 min",
      series: [1, 2, 3, 4].map((n) => ({
        id: u(30 + n),
        tipoMedicion: "repeticiones",
        pesoKg: 67.5,
        repeticiones: 6,
      })),
    },
    {
      id: u(3),
      ejercicioId: u(13),
      nombre: "Tijeras",
      indicaciones: null,
      seccion: "circuito",
      series: [{ id: u(41), tipoMedicion: "repeticiones", pesoKg: null, repeticiones: 20 }],
    },
  ],
})

function dia(id: number, fecha: string, nombre: string, enviado = false): DiaDelPlan {
  return {
    resumen: {
      agenda: {
        id: u(id),
        clienteId: u(99),
        fechaOriginal: fecha,
        fechaActual: fecha,
        estado: enviado ? "cerrada" : "abierta",
        revision: 0,
      },
      nombre,
      enviadoEn: enviado ? `${fecha}T19:00:00.000Z` : null,
    },
    prescripcion: { ...empuje, nombre },
  }
}

it("el plan abre una sola sesión por foco y deja volver a abrirla", async () => {
  const sesion = dia(2, lunesDeSemana(), "Empuje")
  const api = {
    semana: jest.fn(async () => ({ sesiones: [sesion.resumen], total: 1 })),
    plan: jest.fn(async () => ({ plan: null })),
    leerCliente: jest.fn(async () => ({ agenda: sesion.resumen.agenda, prescripcion: empuje })),
  } as unknown as ApiEntrenamiento
  const abrir = jest.fn()
  const vista = await render(<PlanCliente clienteId={u(99)} api={api} abrir={abrir} />)
  const boton = await screen.findByRole("button", { name: "Abrir sesión" })
  await fireEvent.press(boton)
  await fireEvent.press(boton)
  expect(abrir).toHaveBeenCalledTimes(1)

  await vista.rerender(<PlanCliente clienteId={u(99)} api={{ ...api }} abrir={abrir} />)
  await fireEvent.press(await screen.findByRole("button", { name: "Abrir sesión" }))
  expect(abrir).toHaveBeenCalledTimes(1)

  mockFoco += 1
  await vista.rerender(<PlanCliente clienteId={u(99)} api={api} abrir={abrir} />)
  await fireEvent.press(await screen.findByRole("button", { name: "Abrir sesión" }))
  expect(abrir).toHaveBeenCalledTimes(2)
})

describe("RutinaDeLaSemana", () => {
  it("enseña el día elegido por partes, con dosis, RIR y descanso", async () => {
    const verTecnica = jest.fn<(e: EjercicioPrescrito) => void>()
    await render(
      <RutinaDeLaSemana
        dias={[dia(1, "2026-09-21", "Tirón", true), dia(2, "2026-09-24", "Empuje")]}
        elegido={u(2)}
        elegir={() => undefined}
        hoy="2026-09-24"
        verTecnica={verTecnica}
        abrir={() => undefined}
      />,
    )
    expect(screen.getByText("jueves · hoy")).toBeTruthy()
    expect(screen.getByRole("header", { name: "Empuje" })).toBeTruthy()
    expect(screen.getByText("Calentamiento")).toBeTruthy()
    expect(screen.getByText("Core")).toBeTruthy()
    expect(screen.getByText("2 vueltas")).toBeTruthy()
    expect(screen.getByText("4×6")).toBeTruthy()
    expect(screen.getByText("RIR 3 · 2–3 min")).toBeTruthy()

    await fireEvent.press(screen.getByRole("button", { name: /Press banca con barra, 4×6/ }))
    expect(verTecnica).toHaveBeenCalledWith(
      expect.objectContaining({ nombre: "Press banca con barra" }),
    )
  })

  it("cambia de día y ofrece ver lo hecho en una sesión enviada", async () => {
    const elegir = jest.fn<(id: string) => void>()
    const abrir = jest.fn<(id: string) => void>()
    await render(
      <RutinaDeLaSemana
        dias={[dia(1, "2026-09-21", "Tirón", true), dia(2, "2026-09-24", "Empuje")]}
        elegido={u(1)}
        elegir={elegir}
        hoy="2026-09-24"
        verTecnica={() => undefined}
        abrir={abrir}
      />,
    )
    await fireEvent.press(screen.getByRole("tab", { name: "jueves: Empuje" }))
    expect(elegir).toHaveBeenCalledWith(u(2))
    await fireEvent.press(screen.getByRole("button", { name: "Ver lo que hiciste" }))
    expect(abrir).toHaveBeenCalledWith(u(1))
  })
})

describe("BloqueDelPlan", () => {
  const plan: PlanVigente = {
    id: u(50),
    nombre: "Bloque 1",
    semanaInicial: "2026-09-21",
    semanas: 6,
    version: 1,
    bloque: {
      objetivos: ["Compatible con el K-1"],
      fases: [
        { desde: 1, hasta: 2, nombre: "Calibrar", detalle: "RIR 3 · accesorios 2–3" },
        { desde: 3, hasta: 4, nombre: "Progresar", detalle: null },
      ],
      deportes: [{ nombre: "K-1", dias: [4, 7], minutos: 60 }],
      notas: ["Nada de K-1 los miércoles"],
    },
  }

  it("sitúa la semana, marca la fase de ahora y enseña deportes y notas", async () => {
    await render(
      <BloqueDelPlan
        plan={plan}
        lunes="2026-09-28"
        dias={[dia(2, "2026-10-01", "Empuje")]}
        hoy="2026-10-01"
      />,
    )
    expect(screen.getByText("Bloque 1 · semana 2 de 6")).toBeTruthy()
    expect(screen.getByText("21 sep – 1 nov")).toBeTruthy()
    expect(screen.getByText("Ahora")).toBeTruthy()
    expect(screen.getByText("K-1: jueves y domingo, 60 min")).toBeTruthy()
    expect(screen.getByText("Nada de K-1 los miércoles")).toBeTruthy()
    expect(screen.getByText("70–85")).toBeTruthy()
  })

  it("sin plan explica que aún no hay bloque", async () => {
    await render(<BloqueDelPlan plan={null} lunes="2026-09-28" dias={[]} hoy="2026-10-01" />)
    expect(screen.getByText(/no forma parte de ningún bloque/)).toBeTruthy()
  })
})

describe("Guia", () => {
  it("despliega un tema al tocarlo", async () => {
    await render(<Guia />)
    expect(screen.queryByText(/doble progresión: primero sumas/)).toBeNull()
    await fireEvent.press(screen.getByRole("button", { name: "Cómo subir las cargas" }))
    expect(screen.getByText(/doble progresión: primero sumas/)).toBeTruthy()
  })

  it("explica cada unidad con el mismo formato que la sesión (D01)", async () => {
    // Una serie sintética de cada unidad, leída como en la sesión en curso.
    const ejemplos = [
      objetivoDeSerie({
        id: u(1),
        tipoMedicion: "repeticiones",
        pesoKg: null,
        repeticiones: 8,
        repeticionesMax: 10,
      }),
      objetivoDeSerie({ id: u(2), tipoMedicion: "tiempo", pesoKg: null, segundos: 30 }),
      objetivoDeSerie({ id: u(3), tipoMedicion: "distancia", pesoKg: 32, metros: 20 }),
    ]
    expect(ejemplos).toEqual(["8–10", "30 s", "20 m"])
    await render(<Guia />)
    await fireEvent.press(screen.getByRole("button", { name: "Cómo se mide cada serie" }))
    expect(
      screen.getByText(/«8–10» son repeticiones, «30 s» son segundos y «20 m» son metros/),
    ).toBeTruthy()
    expect(screen.getByText(/en esa misma unidad/)).toBeTruthy()
  })
})
