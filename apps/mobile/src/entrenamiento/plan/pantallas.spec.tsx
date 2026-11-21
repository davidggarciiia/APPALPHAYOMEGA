import { describe, it, jest } from "@jest/globals"
import { StyleSheet } from "react-native"
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native"
import { PrescripcionSchema, type EjercicioPrescrito, type PlanVigente } from "@alpha-omega/shared"

import { objetivoDeSerie } from "../sesion/modelo"
import { Guia, TEMAS_DE_LA_GUIA } from "./guia"
import { RutinaDeLaSemana, type DiaDelPlan } from "./rutina"
import { PlanCliente } from "./plan-cliente"
import type { ApiEntrenamiento } from "../api"
import { lunesDeSemana, sumarDias } from "../fechas"
import { almacenDispositivo } from "../almacen-dispositivo"
import { ErrorDePermiso, ErrorDeSesion } from "../../lib/http"

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
jest.mock("../ver-tecnica", () => {
  const React = jest.requireActual<typeof import("react")>("react")
  const { Modal, Text } = jest.requireActual<typeof import("react-native")>("react-native")
  return {
    VerTecnica: () =>
      React.createElement(
        Modal,
        { visible: true },
        React.createElement(Text, null, "Técnica abierta"),
      ),
  }
})

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

it("en Rutina conserva el objetivo y la nota del entrenador del plan vigente", async () => {
  const sesion = dia(2, lunesDeSemana(), "Empuje")
  const plan: PlanVigente = {
    id: u(50),
    nombre: "Bloque 1",
    semanaInicial: lunesDeSemana(),
    semanas: 6,
    version: 1,
    bloque: {
      objetivos: ["Ganar fuerza en banca"],
      fases: [],
      deportes: [],
      notas: ["No entrenes con dolor"],
    },
  }
  const api = {
    semana: jest.fn(async () => ({ sesiones: [sesion.resumen], total: 1 })),
    plan: jest.fn(async () => ({ plan })),
    leerCliente: jest.fn(async () => ({ agenda: sesion.resumen.agenda, prescripcion: empuje })),
  } as unknown as ApiEntrenamiento
  await render(<PlanCliente clienteId={u(99)} api={api} abrir={jest.fn()} pestana="rutina" />)
  expect(
    await screen.findByRole("button", { name: "Indicaciones del entrenador" }),
  ).toBeOnTheScreen()
  expect(screen.queryByText("Ganar fuerza en banca")).toBeNull()
  await fireEvent.press(screen.getByRole("button", { name: "Indicaciones del entrenador" }))
  expect(await screen.findByText("Ganar fuerza en banca")).toBeOnTheScreen()
  expect(screen.getByText("No entrenes con dolor")).toBeOnTheScreen()
})

it("el plan abre una sola sesión por foco y deja volver a abrirla", async () => {
  const sesion = dia(2, lunesDeSemana(), "Empuje")
  const api = {
    semana: jest.fn(async () => ({ sesiones: [sesion.resumen], total: 1 })),
    plan: jest.fn(async () => ({ plan: null })),
    leerCliente: jest.fn(async () => ({ agenda: sesion.resumen.agenda, prescripcion: empuje })),
  } as unknown as ApiEntrenamiento
  const abrir = jest.fn()
  const vista = await render(<PlanCliente clienteId={u(99)} api={api} abrir={abrir} />)
  await fireEvent.press(await screen.findByRole("button", { name: /: Empuje/ }))
  const boton = await screen.findByRole("button", { name: "Empezar Empuje" })
  await fireEvent.press(boton)
  await fireEvent.press(boton)
  expect(abrir).toHaveBeenCalledTimes(1)

  await vista.rerender(<PlanCliente clienteId={u(99)} api={{ ...api }} abrir={abrir} />)
  await fireEvent.press(await screen.findByRole("button", { name: /: Empuje/ }))
  await fireEvent.press(await screen.findByRole("button", { name: "Empezar Empuje" }))
  expect(abrir).toHaveBeenCalledTimes(1)

  mockFoco += 1
  await vista.rerender(<PlanCliente clienteId={u(99)} api={api} abrir={abrir} />)
  await fireEvent.press(await screen.findByRole("button", { name: "Empezar Empuje" }))
  expect(abrir).toHaveBeenCalledTimes(2)
})

it("muestra el detalle de una sesión solo después de tocar su fila", async () => {
  const sesion = dia(2, lunesDeSemana(), "Empuje")
  const api = {
    semana: jest.fn(async () => ({ sesiones: [sesion.resumen], total: 1 })),
    plan: jest.fn(async () => ({ plan: null })),
    leerCliente: jest.fn(async () => ({ agenda: sesion.resumen.agenda, prescripcion: empuje })),
  } as unknown as ApiEntrenamiento
  await render(<PlanCliente clienteId={u(99)} api={api} abrir={jest.fn()} />)
  const fila = await screen.findByRole("button", { name: /: Empuje/ })
  expect(screen.queryByRole("button", { name: "Empezar Empuje" })).toBeNull()
  await fireEvent.press(fila)
  expect(screen.getByRole("button", { name: "Cerrar detalle" })).toBeOnTheScreen()
  expect(screen.getByRole("button", { name: "Empezar Empuje" })).toBeOnTheScreen()
  await fireEvent.press(screen.getByRole("button", { name: "Empezar Empuje" }))
  expect(screen.queryByRole("button", { name: "Cerrar detalle" })).toBeNull()
})

it("abre la técnica dentro del modal de detalle de la sesión", async () => {
  const sesion = dia(2, lunesDeSemana(), "Empuje")
  const api = {
    semana: jest.fn(async () => ({ sesiones: [sesion.resumen], total: 1 })),
    plan: jest.fn(async () => ({ plan: null })),
    leerCliente: jest.fn(async () => ({ agenda: sesion.resumen.agenda, prescripcion: empuje })),
  } as unknown as ApiEntrenamiento
  await render(<PlanCliente clienteId={u(99)} api={api} abrir={jest.fn()} />)
  await fireEvent.press(await screen.findByRole("button", { name: /: Empuje/ }))
  await fireEvent.press(screen.getByRole("button", { name: /Press banca con barra, 4×6/ }))
  let nodo = screen.getByText("Técnica abierta").parent
  const ancestros: string[] = []
  while (nodo) {
    ancestros.push(nodo.type)
    nodo = nodo.parent
  }
  expect(ancestros.filter((tipo) => tipo === "Modal")).toHaveLength(2)
})

it.each([new ErrorDeSesion(), new ErrorDePermiso()])(
  "retira el plan mostrado y no lee su copia cuando se rechaza el acceso: %s",
  async (error) => {
    const sesion = dia(2, lunesDeSemana(), "Empuje")
    const copia = {
      listado: { sesiones: [sesion.resumen], total: 1 },
      plan: null,
      prescripciones: { [sesion.resumen.agenda.id]: empuje },
    }
    jest
      .mocked(almacenDispositivo.leer)
      .mockImplementation(async (_cuenta, _clave, esquema) => esquema.parse(copia))
    const api = {
      semana: jest.fn(async () => copia.listado),
      plan: jest.fn(async () => ({ plan: null })),
      leerCliente: jest.fn(async () => ({ agenda: sesion.resumen.agenda, prescripcion: empuje })),
    } as unknown as ApiEntrenamiento
    const abrir = jest.fn()
    const vista = await render(<PlanCliente clienteId={u(99)} api={api} abrir={abrir} />)
    await fireEvent.press(await screen.findByRole("button", { name: /: Empuje/ }))
    await screen.findByRole("button", { name: "Empezar Empuje" })

    jest.mocked(api.semana).mockRejectedValue(error)
    mockFoco += 1
    await vista.rerender(<PlanCliente clienteId={u(99)} api={api} abrir={abrir} />)

    expect(
      await screen.findByText(
        error instanceof ErrorDeSesion
          ? "Tu sesión ha caducado. Vuelve a entrar."
          : "No tienes permiso para acceder a estos datos.",
      ),
    ).toBeOnTheScreen()
    expect(screen.queryByRole("button", { name: "Empezar Empuje" })).toBeNull()
    expect(screen.queryByRole("button", { name: "Reintentar" })).toBeNull()
    expect(almacenDispositivo.leer).not.toHaveBeenCalled()
  },
)

describe("RutinaDeLaSemana", () => {
  it("agrupa las sesiones por día con una fila seleccionable para cada una", async () => {
    const elegir = jest.fn<(id: string) => void>()
    await render(
      <RutinaDeLaSemana
        dias={[
          dia(1, "2026-09-21", "Tirón"),
          dia(2, "2026-09-24", "Empuje"),
          dia(3, "2026-09-24", "Pierna"),
        ]}
        elegido={u(1)}
        elegir={elegir}
        hoy="2026-09-24"
        verTecnica={() => undefined}
        abrir={() => undefined}
      />,
    )
    expect(screen.getAllByRole("header", { name: "jueves" })).toHaveLength(1)
    await fireEvent.press(screen.getByRole("button", { name: "jueves: Pierna" }))
    expect(elegir).toHaveBeenCalledWith(u(3))
  })

  it("mantiene el mismo tamaño fijo con nombres de sesión cortos y largos", async () => {
    const corto = dia(1, "2026-09-21", "Empuje")
    const largo = dia(2, "2026-09-22", "Torso completo y core final")
    const vista = await render(
      <RutinaDeLaSemana
        dias={[corto]}
        elegido={u(1)}
        elegir={() => undefined}
        hoy="2026-09-21"
        verTecnica={() => undefined}
        abrir={() => undefined}
      />,
    )
    const tituloCorto = screen.getByRole("header", { name: "Empuje" })
    const estiloCorto = StyleSheet.flatten(tituloCorto.props.style)
    expect(tituloCorto.props.adjustsFontSizeToFit).not.toBe(true)
    expect(tituloCorto.props.minimumFontScale).toBeUndefined()

    await vista.rerender(
      <RutinaDeLaSemana
        dias={[largo]}
        elegido={u(2)}
        elegir={() => undefined}
        hoy="2026-09-22"
        verTecnica={() => undefined}
        abrir={() => undefined}
      />,
    )
    const tituloLargo = screen.getByRole("header", { name: "Torso completo y core final" })
    const estiloLargo = StyleSheet.flatten(tituloLargo.props.style)
    expect(tituloLargo.props.adjustsFontSizeToFit).not.toBe(true)
    expect(tituloLargo.props.minimumFontScale).toBeUndefined()
    expect(estiloLargo.fontSize).toBe(estiloCorto.fontSize)
    expect(estiloLargo.lineHeight).toBe(estiloCorto.lineHeight)
  })

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
    expect(screen.getByRole("button", { name: "lunes: Tirón, hecha" })).toBeOnTheScreen()

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
    await fireEvent.press(screen.getByRole("button", { name: "jueves: Empuje" }))
    expect(elegir).toHaveBeenCalledWith(u(2))
    await fireEvent.press(screen.getByRole("button", { name: "Ver resumen Tirón" }))
    expect(abrir).toHaveBeenCalledWith(u(1))
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

describe("Rutina: nota, alternativas y acción de la sesión", () => {
  const conExtras = PrescripcionSchema.parse({
    nombre: "Empuje",
    ejercicios: [
      {
        id: u(2),
        ejercicioId: u(12),
        nombre: "Press banca con barra",
        indicaciones: null,
        nota: "Pausa de un segundo en el pecho",
        alternativas: ["Press con mancuernas", "Máquina de press"],
        series: [{ id: u(31), tipoMedicion: "repeticiones", pesoKg: 60, repeticiones: 6 }],
      },
      {
        id: u(3),
        ejercicioId: u(13),
        nombre: "Fondos",
        indicaciones: null,
        series: [{ id: u(32), tipoMedicion: "repeticiones", pesoKg: null, repeticiones: 10 }],
      },
    ],
  })
  const sesion = (enviado = false): DiaDelPlan => ({
    ...dia(1, "2026-09-24", "Empuje", enviado),
    prescripcion: conExtras,
  })
  const vista = (dias: DiaDelPlan[], extra = {}): React.JSX.Element => (
    <RutinaDeLaSemana
      dias={dias}
      elegido={dias[0]!.resumen.agenda.id}
      elegir={() => undefined}
      hoy="2026-09-24"
      verTecnica={() => undefined}
      abrir={() => undefined}
      {...extra}
    />
  )

  it("enseña la nota y las alternativas de cada ejercicio, y no inventa las que no hay", async () => {
    await render(vista([sesion()]))
    expect(screen.getByText("Pausa de un segundo en el pecho")).toBeOnTheScreen()
    expect(
      screen.getByText("Alternativas: Press con mancuernas, Máquina de press"),
    ).toBeOnTheScreen()
    expect(screen.getAllByText(/^Alternativas:/)).toHaveLength(1)
    expect(
      screen.getByRole("button", {
        name: "Press banca con barra, 6. Pausa de un segundo en el pecho. Alternativas: Press con mancuernas, Máquina de press. Ver técnica",
      }),
    ).toBeOnTheScreen()
    expect(screen.getByRole("button", { name: "Fondos, 10. Ver técnica" })).toBeOnTheScreen()
  })

  it.each([
    ["Empezar", false, {}],
    ["Continuar", false, { empezadas: { [u(1)]: true } }],
    ["Ver resumen", true, { empezadas: { [u(1)]: true } }],
  ])("la acción de la sesión se llama «%s»", async (texto, enviada, extra) => {
    const abrir = jest.fn<(id: string) => void>()
    await render(vista([sesion(enviada)], { abrir, ...extra }))
    await fireEvent.press(screen.getByRole("button", { name: `${texto} Empuje` }))
    expect(abrir).toHaveBeenCalledWith(u(1))
    expect(screen.queryByText("Abrir sesión")).toBeNull()
    expect(screen.queryByText("Ver lo que hiciste")).toBeNull()
  })
})

describe("Plan: semana compartida y sesión en curso", () => {
  const sesion = dia(2, lunesDeSemana(), "Empuje")
  const apiConBorrador = (borrador: unknown): ApiEntrenamiento =>
    ({
      semana: jest.fn(async () => ({ sesiones: [sesion.resumen], total: 1 })),
      plan: jest.fn(async () => ({ plan: null })),
      leerCliente: jest.fn(async () => ({
        agenda: sesion.resumen.agenda,
        prescripcion: empuje,
        enviadoEn: null,
        borrador,
      })),
    }) as unknown as ApiEntrenamiento

  it("ofrece continuar una sesión con series hechas en su borrador", async () => {
    const api = apiConBorrador({
      actualizadoEn: "2026-09-24T10:00:00.000Z",
      registro: {
        inicio: null,
        checkin: null,
        series: [{ serieId: u(31), hecha: true }],
        notas: null,
      },
    })
    await render(<PlanCliente clienteId={u(99)} api={api} abrir={jest.fn()} />)
    await fireEvent.press(await screen.findByRole("button", { name: /: Empuje/ }))
    expect(await screen.findByRole("button", { name: "Continuar Empuje" })).toBeOnTheScreen()
  })

  it("con el borrador vacío ofrece empezar", async () => {
    const api = apiConBorrador(null)
    await render(<PlanCliente clienteId={u(99)} api={api} abrir={jest.fn()} />)
    await fireEvent.press(await screen.findByRole("button", { name: /: Empuje/ }))
    expect(await screen.findByRole("button", { name: "Empezar Empuje" })).toBeOnTheScreen()
  })

  it("navega por semanas arriba, como Semana, y avisa a quien guarda la semana", async () => {
    const api = apiConBorrador(null)
    const elegirSemana = jest.fn()
    const lunes = lunesDeSemana()
    const siguiente = sumarDias(lunes, 7)
    const vista = await render(
      <PlanCliente
        clienteId={u(99)}
        api={api}
        abrir={jest.fn()}
        pestana="rutina"
        semanaElegida={lunes}
        elegirSemana={elegirSemana}
      />,
    )
    await screen.findByRole("button", { name: /: Empuje/ })
    expect(screen.queryByText("‹ Semana anterior")).toBeNull()
    await fireEvent.press(screen.getByRole("button", { name: "Semana siguiente" }))
    expect(elegirSemana).toHaveBeenCalledWith(siguiente)
    await vista.rerender(
      <PlanCliente
        clienteId={u(99)}
        api={api}
        abrir={jest.fn()}
        pestana="rutina"
        semanaElegida={siguiente}
        elegirSemana={elegirSemana}
      />,
    )
    await waitFor(() => expect(api.semana).toHaveBeenLastCalledWith(u(99), siguiente))
  })

  it("la Guía no lleva selector de semana", async () => {
    const api = apiConBorrador(null)
    await render(<PlanCliente clienteId={u(99)} api={api} abrir={jest.fn()} pestana="guia" />)
    expect(screen.queryByRole("button", { name: "Semana siguiente" })).toBeNull()
  })
})

describe("Guía del flujo actual de la sesión", () => {
  const textos = TEMAS_DE_LA_GUIA.map((tema) => `${tema.titulo} ${tema.texto}`).join(" ")

  it("no describe pasos que ya no existen", () => {
    expect(textos).not.toMatch(/check-in|RPE|0 a 10|La próxima vez|Esfuerzo global/)
  })

  it("cuenta cómo se marca, deshace y omite una serie, el descanso, la técnica y terminar", () => {
    expect(textos).toMatch(/casilla de la derecha/)
    expect(textos).toMatch(/Deshacer/)
    expect(textos).toMatch(/mantén pulsada la casilla/)
    expect(textos).toMatch(/−15 y \+15/)
    expect(textos).toMatch(/Saltar/)
    expect(textos).toMatch(/Ver técnica/)
    expect(textos).toMatch(/triángulo de aviso/)
    expect(textos).toMatch(/«Terminar»/)
  })

  it("despliega los temas nuevos al tocarlos", async () => {
    await render(<Guia />)
    for (const [titulo, texto] of [
      ["Cómo registrar la sesión", /«Siguiente»/],
      ["Descanso entre series", /con «Saltar» lo quitas/],
      ["Terminar la sesión", /te pregunta antes de enviar/],
    ] as const) {
      await fireEvent.press(screen.getByRole("button", { name: titulo }))
      expect(screen.getByText(texto)).toBeOnTheScreen()
    }
  })
})
