import { describe, expect, it, jest } from "@jest/globals"
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native"
import {
  CONFIGURACION_SEGUIMIENTO_INICIAL,
  SerieEvolucionSchema,
  type CambiarDia,
  type ConfiguracionSeguimiento,
  type DiaDeSeguimiento,
  type GuardarConfiguracionSeguimiento,
  type ListadoMedidas,
  type Medida,
  type PruebaFisica,
  type RegistrarPrueba,
} from "@alpha-omega/shared"
import type { Context } from "react"
import type { z } from "zod"

import type { ApiEntrenamiento } from "../entrenamiento/api"
import { hoyAgenda, lunesDeSemana, sumarDias } from "../entrenamiento/fechas"
import { fechaCorta } from "../entrenamiento/plan/modelo"
import { ErrorDePeticion, ErrorDeRed } from "../lib/http"
import type { PeticionAutenticada } from "../lib/peticion-autenticada"
import { crearApiSeguimiento, type ApiSeguimiento } from "./api"
import { HoyDiario } from "./hoy-diario"
import { ProgresoCliente } from "./progreso"
import type { ApiEvolucionAvisos, ApiValoracionesCliente } from "./valoraciones-api"

// Como en expo-router: el efecto corre al enfocar la pantalla y se limpia al salir.
jest.mock("expo-router", () => {
  const React = jest.requireActual<typeof import("react")>("react")
  const Enfoque = React.createContext(true)
  return {
    Enfoque,
    useFocusEffect: (efecto: () => void | (() => void)) => {
      const enfocada = React.useContext(Enfoque)
      React.useEffect(() => (enfocada ? efecto() : undefined), [efecto, enfocada])
    },
  }
})
const { Enfoque } = jest.requireMock<{ Enfoque: Context<boolean> }>("expo-router")
jest.mock("expo-crypto", () => ({ randomUUID: () => "30000000-0000-4000-8000-000000000001" }))

const CLIENTE = "10000000-0000-4000-8000-000000000000"

function api(dias: DiaDeSeguimiento[] = []): ApiSeguimiento {
  return {
    configuracion: jest.fn(async () => CONFIGURACION_SEGUIMIENTO_INICIAL),
    guardarConfiguracion: jest.fn(async () => CONFIGURACION_SEGUIMIENTO_INICIAL),
    cambiarDia: jest.fn(async (_c: string, fecha: string, cambio: CambiarDia) => ({
      fecha,
      pesoKg: null,
      pasos: null,
      suenoMin: null,
      creatina: null,
      ...dias[0],
      ...cambio,
      suplementos: cambio.suplementos ?? dias[0]?.suplementos ?? [],
    })),
    dias: jest.fn(async () => ({ dias })),
    medidas: jest.fn(async () => ({ medidas: [], fechaNacimiento: null })),
    registrarMedida: jest.fn(async () => {
      throw new Error("no usado")
    }),
    pruebas: jest.fn(async () => ({ pruebas: [] })),
    registrarPrueba: jest.fn(async () => {
      throw new Error("no usado")
    }),
    fuerza: jest.fn(async () => ({ ejercicios: [] })),
    consentimiento: jest.fn(async () => {
      throw new Error("no usado")
    }),
  }
}

describe("HoyDiario", () => {
  it("bloquea el diálogo durante un guardado lento y conserva el dato hasta confirmarlo", async () => {
    const seguimiento = api()
    let terminar!: (dia: DiaDeSeguimiento) => void
    seguimiento.cambiarDia = jest.fn(
      () =>
        new Promise<DiaDeSeguimiento>((resolve) => {
          terminar = resolve
        }),
    )
    await render(<HoyDiario clienteId={CLIENTE} api={seguimiento} objetivoPasos={null} />)
    await fireEvent.press(screen.getByRole("button", { name: "Peso: sin apuntar. Cambiar" }))
    await fireEvent.changeText(screen.getByLabelText("Peso (kg)"), "80")
    await fireEvent.press(screen.getByRole("button", { name: "Guardar" }))
    expect(screen.getByRole("button", { name: "Cancelar" }).props.accessibilityState.disabled).toBe(
      true,
    )
    expect(screen.getByLabelText("Peso (kg)").props.editable).toBe(false)
    await fireEvent.press(screen.getByRole("button", { name: "Guardar" }))
    expect(seguimiento.cambiarDia).toHaveBeenCalledTimes(1)
    await act(async () =>
      terminar({
        fecha: hoyAgenda(),
        pesoKg: 80,
        pasos: null,
        suenoMin: null,
        creatina: null,
        suplementos: [],
      }),
    )
    expect(await screen.findByText("80,0 kg")).toBeTruthy()
    await fireEvent.press(screen.getByRole("button", { name: "Sueño: sin apuntar. Cambiar" }))
    await fireEvent.changeText(screen.getByLabelText("Horas dormidas"), "7:40")
    expect(screen.getByDisplayValue("7:40")).toBeTruthy()
  })

  it("enseña lo apuntado hoy con el objetivo de pasos", async () => {
    const hoy = hoyAgenda()
    await render(
      <HoyDiario
        clienteId={CLIENTE}
        api={api([
          {
            fecha: hoy,
            pesoKg: 111.6,
            pasos: 3240,
            suenoMin: 460,
            creatina: null,
            suplementos: [],
          },
        ])}
        objetivoPasos={7000}
      />,
    )
    await waitFor(() => expect(screen.getByText("111,6 kg")).toBeTruthy())
    expect(screen.getByText("3.240 / 7.000")).toBeTruthy()
    expect(screen.getByText("7 h 40")).toBeTruthy()
  })

  it("apunta el peso con coma y marca la creatina", async () => {
    const seguimiento = api()
    await render(<HoyDiario clienteId={CLIENTE} api={seguimiento} objetivoPasos={null} />)
    await fireEvent.press(screen.getByRole("button", { name: "Peso: sin apuntar. Cambiar" }))
    await fireEvent.changeText(screen.getByLabelText("Peso (kg)"), "111,6")
    await fireEvent.press(screen.getByRole("button", { name: "Guardar" }))
    await waitFor(() =>
      expect(seguimiento.cambiarDia).toHaveBeenCalledWith(CLIENTE, hoyAgenda(), { pesoKg: 111.6 }),
    )
    await fireEvent.press(screen.getByRole("checkbox", { name: "Creatina tomada" }))
    await waitFor(() =>
      expect(seguimiento.cambiarDia).toHaveBeenCalledWith(CLIENTE, hoyAgenda(), { creatina: true }),
    )
  })

  it("no envía un peso imposible", async () => {
    const seguimiento = api()
    await render(<HoyDiario clienteId={CLIENTE} api={seguimiento} objetivoPasos={null} />)
    await fireEvent.press(screen.getByRole("button", { name: "Peso: sin apuntar. Cambiar" }))
    await fireEvent.changeText(screen.getByLabelText("Peso (kg)"), "1116")
    await fireEvent.press(screen.getByRole("button", { name: "Guardar" }))
    expect(screen.getByText("Escribe un peso entre 30 y 400 kg.")).toBeTruthy()
    expect(seguimiento.cambiarDia).not.toHaveBeenCalled()
  })
})

describe("ProgresoCliente", () => {
  const entrenamiento = {
    plan: jest.fn(async () => ({ plan: null })),
    semana: jest.fn(async () => ({ sesiones: [], total: 0 })),
  } as unknown as ApiEntrenamiento

  it("respeta los indicadores visibles y registra solo una prueba pautada", async () => {
    const seguimiento = api()
    const pruebaId = "50000000-0000-4000-8000-000000000001"
    seguimiento.configuracion = jest.fn(async (): Promise<ConfiguracionSeguimiento> => ({
      ...CONFIGURACION_SEGUIMIENTO_INICIAL,
      indicadores: ["pruebas", "peso"],
      pruebasPrescritas: [{ id: pruebaId, nombre: "Flexiones", unidad: "reps" }],
    }))
    seguimiento.registrarPrueba = jest.fn(async (_id: string, datos: RegistrarPrueba) => ({
      id: pruebaId,
      pruebaId,
      fecha: datos.fecha,
      nombre: "Flexiones",
      valor: datos.valor,
      unidad: "reps",
      creadoEn: new Date().toISOString(),
    }))
    await render(
      <ProgresoCliente
        clienteId={CLIENTE}
        seguimiento={seguimiento}
        entrenamiento={entrenamiento}
      />,
    )
    await waitFor(() => expect(screen.getByRole("tab", { name: "Pruebas físicas" })).toBeTruthy())
    expect(screen.queryByRole("tab", { name: "Fuerza" })).toBeNull()
    expect(screen.getByText("Pruebas pautadas")).toBeTruthy()
    expect(screen.getByText("Flexiones · reps")).toBeTruthy()
    await fireEvent.press(screen.getByRole("button", { name: "Añadir prueba" }))
    await fireEvent.press(screen.getByRole("button", { name: "Flexiones · reps" }))
    await fireEvent.changeText(screen.getByLabelText("Resultado"), "32")
    await fireEvent.press(screen.getByRole("button", { name: "Guardar" }))
    await waitFor(() =>
      expect(seguimiento.registrarPrueba).toHaveBeenCalledWith(
        CLIENTE,
        expect.objectContaining({ pruebaId, valor: 32 }),
      ),
    )
  })

  it("mantiene el histórico cuando ya no hay pruebas pautadas", async () => {
    const seguimiento = api()
    seguimiento.configuracion = jest.fn(async (): Promise<ConfiguracionSeguimiento> => ({
      ...CONFIGURACION_SEGUIMIENTO_INICIAL,
      indicadores: ["pruebas"],
      pruebasPrescritas: [],
    }))
    seguimiento.pruebas = jest.fn(async () => ({
      pruebas: [
        {
          id: "50000000-0000-4000-8000-000000000002",
          pruebaId: null,
          fecha: "2026-09-20",
          nombre: "Plancha",
          valor: 60,
          unidad: "s",
          creadoEn: new Date().toISOString(),
        },
      ],
    }))
    await render(
      <ProgresoCliente
        clienteId={CLIENTE}
        seguimiento={seguimiento}
        entrenamiento={entrenamiento}
      />,
    )
    await waitFor(() => expect(screen.getByText("Plancha")).toBeTruthy())
    expect(screen.queryByRole("button", { name: "Añadir prueba" })).toBeNull()
  })

  it("abre la evolución desde Progreso sin ocultar el resto del seguimiento", async () => {
    const evolucion = jest.fn(async (_clienteId: string) => ({ series: [] }))
    const valoraciones = {
      listarPublicadas: jest.fn(async () => ({ valoraciones: [], total: 0 })),
      leerPublicada: jest.fn(async () => {
        throw new Error("no usado")
      }),
      proximaRevision: jest.fn(async () => ({
        revision: 0,
        pauta: null,
        cumplidaPorId: null,
        actualizadaEn: null,
      })),
      evolucion,
    } as unknown as ApiValoracionesCliente & Pick<ApiEvolucionAvisos, "evolucion">
    await render(
      <ProgresoCliente
        clienteId={CLIENTE}
        seguimiento={api()}
        entrenamiento={entrenamiento}
        valoraciones={valoraciones}
      />,
    )

    const abrir = await screen.findByRole("button", { name: "Ver mi evolución" })
    expect(evolucion).not.toHaveBeenCalled()
    await fireEvent.press(abrir)
    await waitFor(() => expect(screen.getByRole("header", { name: "Tu evolución" })).toBeTruthy())
    expect(evolucion).toHaveBeenCalledWith(CLIENTE)
    expect(screen.getByRole("tab", { name: "Peso" })).toBeTruthy()
    expect(screen.getByRole("button", { name: "Ocultar mi evolución" })).toBeTruthy()
    await fireEvent.press(screen.getByRole("button", { name: "Ocultar mi evolución" }))
    expect(screen.queryByRole("header", { name: "Tu evolución" })).toBeNull()
  })

  it("ordena resultados de una prueba renombrada por fecha, no por nombre", async () => {
    const seguimiento = api()
    const pruebaId = "50000000-0000-4000-8000-000000000003"
    seguimiento.configuracion = jest.fn(async (): Promise<ConfiguracionSeguimiento> => ({
      ...CONFIGURACION_SEGUIMIENTO_INICIAL,
      indicadores: ["pruebas"],
      pruebasPrescritas: [{ id: pruebaId, nombre: "Flexiones", unidad: "reps" }],
    }))
    seguimiento.pruebas = jest.fn(async () => ({
      pruebas: [
        {
          id: "50000000-0000-4000-8000-000000000004",
          pruebaId,
          fecha: "2026-09-22",
          nombre: "Flexiones",
          valor: 40,
          unidad: "reps",
          creadoEn: "2026-09-22T10:00:00.000Z",
        },
        {
          id: "50000000-0000-4000-8000-000000000005",
          pruebaId,
          fecha: "2026-09-20",
          nombre: "Z-flexiones",
          valor: 30,
          unidad: "reps",
          creadoEn: "2026-09-20T10:00:00.000Z",
        },
      ],
    }))
    await render(
      <ProgresoCliente
        clienteId={CLIENTE}
        seguimiento={seguimiento}
        entrenamiento={entrenamiento}
      />,
    )
    await waitFor(() => expect(screen.getByText("40 reps")).toBeTruthy())
  })

  it("no presenta un resultado antiguo en una unidad nueva", async () => {
    const seguimiento = api()
    const pruebaId = "50000000-0000-4000-8000-000000000006"
    seguimiento.configuracion = jest.fn(async (): Promise<ConfiguracionSeguimiento> => ({
      ...CONFIGURACION_SEGUIMIENTO_INICIAL,
      indicadores: ["pruebas"],
      pruebasPrescritas: [{ id: pruebaId, nombre: "Carga", unidad: "kg" }],
    }))
    seguimiento.pruebas = jest.fn(async () => ({
      pruebas: [
        {
          id: "50000000-0000-4000-8000-000000000007",
          pruebaId,
          fecha: "2026-09-20",
          nombre: "Carga",
          valor: 30,
          unidad: "reps",
          creadoEn: "2026-09-20T10:00:00.000Z",
        },
      ],
    }))
    await render(
      <ProgresoCliente
        clienteId={CLIENTE}
        seguimiento={seguimiento}
        entrenamiento={entrenamiento}
      />,
    )
    await waitFor(() => expect(screen.getByText("Pendiente")).toBeTruthy())
    expect(screen.getByText("30 reps")).toBeTruthy()
  })

  it("permite al entrenador previsualizar y guardar cambios de configuración", async () => {
    const seguimiento = api()
    seguimiento.guardarConfiguracion = jest.fn(
      async (_id: string, datos: GuardarConfiguracionSeguimiento) => ({ ...datos, revision: 1 }),
    )
    await render(
      <ProgresoCliente
        clienteId={CLIENTE}
        seguimiento={seguimiento}
        entrenamiento={entrenamiento}
        modo="entrenador"
      />,
    )
    await waitFor(() => expect(screen.getByText("Vista previa del cliente")).toBeTruthy())
    await fireEvent.press(screen.getByRole("button", { name: "Ocultar Fuerza" }))
    expect(screen.getByText("Peso · Pasos · Sueño · Cintura · Pruebas físicas")).toBeTruthy()
    await fireEvent.press(screen.getByRole("button", { name: "Guardar seguimiento" }))
    await waitFor(() =>
      expect(seguimiento.guardarConfiguracion).toHaveBeenCalledWith(
        CLIENTE,
        expect.objectContaining({ indicadores: ["peso", "pasos", "sueno", "cintura", "pruebas"] }),
      ),
    )
  })

  it("el editor pauta un registro semanal, objetivo y prueba con unidad", async () => {
    const seguimiento = api()
    seguimiento.guardarConfiguracion = jest.fn(
      async (_id: string, datos: GuardarConfiguracionSeguimiento) => ({ ...datos, revision: 1 }),
    )
    await render(
      <ProgresoCliente
        clienteId={CLIENTE}
        seguimiento={seguimiento}
        entrenamiento={entrenamiento}
        modo="entrenador"
      />,
    )
    await waitFor(() => expect(screen.getByRole("button", { name: "Peso: semanal" })).toBeTruthy())
    await fireEvent.press(screen.getByRole("button", { name: "Peso: semanal" }))
    await fireEvent.press(screen.getByRole("button", { name: "Peso: día 5" }))
    await fireEvent.press(screen.getByRole("button", { name: "mantener" }))
    await fireEvent.changeText(screen.getByLabelText("Rango mínimo (kg)"), "80,0")
    await fireEvent.changeText(screen.getByLabelText("Rango máximo (kg)"), "85,0")
    await fireEvent.press(screen.getByRole("button", { name: "Añadir prueba pautada" }))
    const nombre = screen.getByLabelText(/^Nombre de prueba /)
    const unidad = screen.getByLabelText(/^Unidad de prueba /)
    await fireEvent.changeText(nombre, "Flexiones")
    await fireEvent.changeText(unidad, "reps")
    await fireEvent.press(screen.getByRole("button", { name: "Guardar seguimiento" }))
    await waitFor(() => expect(seguimiento.guardarConfiguracion).toHaveBeenCalled())
    const datos = (seguimiento.guardarConfiguracion as jest.Mock).mock
      .calls[0]![1] as GuardarConfiguracionSeguimiento
    expect(datos.registrosSolicitados.find((r) => r.indicador === "peso")).toEqual({
      indicador: "peso",
      frecuencia: "semanal",
      diaSemana: 5,
    })
    expect(datos.objetivoPeso).toEqual({
      direccion: "mantener",
      rangoKg: { minimo: 80, maximo: 85 },
    })
    expect(datos.pruebasPrescritas).toEqual([
      expect.objectContaining({ nombre: "Flexiones", unidad: "reps" }),
    ])
  })

  it("si la revisión es obsoleta conserva el borrador y ofrece recargar", async () => {
    const seguimiento = api()
    seguimiento.guardarConfiguracion = jest.fn(async () => {
      throw new ErrorDePeticion({
        statusCode: 409,
        codigo: "revision_obsoleta",
        message: "Conflicto",
      })
    })
    await render(
      <ProgresoCliente
        clienteId={CLIENTE}
        seguimiento={seguimiento}
        entrenamiento={entrenamiento}
        modo="entrenador"
      />,
    )
    await waitFor(() => expect(screen.getByRole("button", { name: "Ocultar Fuerza" })).toBeTruthy())
    await fireEvent.press(screen.getByRole("button", { name: "Ocultar Fuerza" }))
    await fireEvent.press(screen.getByRole("button", { name: "Guardar seguimiento" }))
    await waitFor(() => expect(screen.getByText("Revisión obsoleta")).toBeTruthy())
    expect(screen.getByText("Peso · Pasos · Sueño · Cintura · Pruebas físicas")).toBeTruthy()
    expect(screen.getByRole("button", { name: "Cargar versión guardada" })).toBeTruthy()
  })

  it("peso: media semanal, cambio desde el inicio y resumen de la semana", async () => {
    const hoy = hoyAgenda()
    const lunes = lunesDeSemana(hoy)
    const dias = [0, 1, 2].map((n) => ({
      fecha: sumarDias(hoy, n - 2),
      pesoKg: [112.1, 112.1, 111.6][n]!,
      pasos: 6000,
      suenoMin: 480,
      creatina: null,
      suplementos: [],
    }))
    const seguimiento = api(dias)
    seguimiento.medidas = jest.fn(async () => ({
      medidas: [
        {
          id: "40000000-0000-4000-8000-000000000001",
          fecha: sumarDias(hoy, -3),
          pesoKg: 112.2,
          cinturaCm: 109,
          grasaPct: 29.2,
          alturaCm: 196,
          creadoEn: new Date().toISOString(),
        },
      ],
      fechaNacimiento: "2005-03-10",
    }))
    await render(
      <ProgresoCliente
        clienteId={CLIENTE}
        seguimiento={seguimiento}
        entrenamiento={entrenamiento}
      />,
    )
    await waitFor(() => expect(screen.getByText("111,9 kg")).toBeTruthy())
    expect(screen.getByText(/−0,3 kg desde el inicio/)).toBeTruthy()
    expect(screen.getByText("Masa libre de grasa")).toBeTruthy()
    expect(screen.getByText("79,4 kg")).toBeTruthy()
    expect(screen.getByText(/196 cm · \d+ años/)).toBeTruthy()
    // Todo sale de la misma toma: no hace falta fechar cada valor.
    expect(screen.queryByText(/^Medida del /)).toBeNull()
    expect(entrenamiento.plan).toHaveBeenCalledWith(CLIENTE, lunes)

    await fireEvent.press(screen.getByRole("tab", { name: "Fuerza" }))
    expect(screen.getByText("Aún sin sesiones con carga.")).toBeTruthy()
  })

  describe("punto de partida", () => {
    // Datos sintéticos, con fechas fijas: la edad se calcula a la fecha de la toma, no a hoy.
    const ENERO = "2026-01-10"
    const SEPTIEMBRE = "2026-09-15"
    const medidasEneroSeptiembre = async (): Promise<ListadoMedidas> => ({
      medidas: [
        {
          id: "40000000-0000-4000-8000-000000000010",
          fecha: ENERO,
          pesoKg: 80,
          cinturaCm: null,
          grasaPct: null,
          alturaCm: 180,
          creadoEn: `${ENERO}T08:00:00.000Z`,
        },
        {
          id: "40000000-0000-4000-8000-000000000011",
          fecha: SEPTIEMBRE,
          pesoKg: null,
          cinturaCm: null,
          grasaPct: 20,
          alturaCm: null,
          creadoEn: `${SEPTIEMBRE}T08:00:00.000Z`,
        },
      ],
      fechaNacimiento: "2000-06-01",
    })

    it("no atribuye a enero una masa libre calculada con la grasa de septiembre", async () => {
      const seguimiento = api()
      seguimiento.medidas = jest.fn(medidasEneroSeptiembre)
      await render(
        <ProgresoCliente
          clienteId={CLIENTE}
          seguimiento={seguimiento}
          entrenamiento={entrenamiento}
        />,
      )

      expect(await screen.findByRole("header", { name: "Inicio · 10 ene" })).toBeTruthy()
      expect(screen.getByText("80,0 kg")).toBeTruthy()
      expect(screen.getByText("180 cm · 25 años")).toBeTruthy()
      // La grasa se muestra con su propia fecha y no se combina con el peso de enero.
      expect(screen.getByText("20,0 %")).toBeTruthy()
      expect(screen.getByText("Medida del 15 sep")).toBeTruthy()
      expect(screen.queryByText("Masa libre de grasa")).toBeNull()
      expect(screen.queryByText("64,0 kg")).toBeNull()
    })

    it("fecha la altura posterior y calcula la edad en la primera toma", async () => {
      const MARZO = "2026-03-05"
      const seguimiento = api()
      seguimiento.medidas = jest.fn(async (): Promise<ListadoMedidas> => ({
        medidas: [
          // Solo cintura: tiene su propia pestaña y no fecha el punto de partida.
          {
            id: "40000000-0000-4000-8000-000000000012",
            fecha: ENERO,
            pesoKg: null,
            cinturaCm: 94,
            grasaPct: null,
            alturaCm: null,
            creadoEn: `${ENERO}T08:00:00.000Z`,
          },
          {
            id: "40000000-0000-4000-8000-000000000013",
            fecha: MARZO,
            pesoKg: 80,
            cinturaCm: null,
            grasaPct: 20,
            alturaCm: null,
            creadoEn: `${MARZO}T08:00:00.000Z`,
          },
          {
            id: "40000000-0000-4000-8000-000000000014",
            fecha: SEPTIEMBRE,
            pesoKg: null,
            cinturaCm: null,
            grasaPct: null,
            alturaCm: 180,
            creadoEn: `${SEPTIEMBRE}T08:00:00.000Z`,
          },
        ],
        fechaNacimiento: "2000-04-01",
      }))
      await render(
        <ProgresoCliente
          clienteId={CLIENTE}
          seguimiento={seguimiento}
          entrenamiento={entrenamiento}
        />,
      )

      expect(await screen.findByRole("header", { name: "Inicio · 5 mar" })).toBeTruthy()
      expect(screen.getByText("64,0 kg")).toBeTruthy()
      // 25 años el 5 de marzo; con la fecha de la altura o la de hoy serían 26.
      expect(screen.getByText("180 cm · 25 años")).toBeTruthy()
      expect(screen.getByText("Altura del 15 sep")).toBeTruthy()
      expect(screen.queryByText(/^Medida del /)).toBeNull()
    })

    it("una corrección publicada no añade otro punto de partida", async () => {
      const PUBLICACION = "21000000-0000-4000-8000-000000000002"
      const VISITA = "20000000-0000-4000-8000-000000000003"
      const corregido = (valor: number) => ({
        fecha: "2025-12-01",
        valor,
        publicacionId: PUBLICACION,
        valoracionId: VISITA,
        corregido: true,
      })
      const evolucion = jest.fn(async (_clienteId: string) => ({
        series: [
          SerieEvolucionSchema.parse({
            clave: "c:60000000-0000-4000-8000-000000000001:1",
            nombre: "Peso de la visita",
            unidad: "kg",
            bloque: "medidas",
            origen: "valoracion",
            metodo: "Báscula de la sala",
            clasificada: true,
            puntos: [corregido(90)],
          }),
          SerieEvolucionSchema.parse({
            clave: "g:pliegues:Siete pliegues",
            nombre: "Grasa por pliegues",
            unidad: "%",
            bloque: "pliegues",
            origen: "valoracion",
            metodo: "Siete pliegues",
            clasificada: true,
            puntos: [corregido(25)],
          }),
        ],
      }))
      const valoraciones = {
        listarPublicadas: jest.fn(async () => ({ valoraciones: [], total: 0 })),
        leerPublicada: jest.fn(async () => {
          throw new Error("no usado")
        }),
        proximaRevision: jest.fn(async () => ({
          revision: 0,
          pauta: null,
          cumplidaPorId: null,
          actualizadaEn: null,
        })),
        evolucion,
      } as unknown as ApiValoracionesCliente & Pick<ApiEvolucionAvisos, "evolucion">
      const seguimiento = api()
      seguimiento.medidas = jest.fn(async () => {
        const datos = await medidasEneroSeptiembre()
        // Enero con peso y grasa en la misma toma: aquí sí hay masa libre.
        datos.medidas[0] = { ...datos.medidas[0]!, grasaPct: 20 }
        return datos
      })
      await render(
        <ProgresoCliente
          clienteId={CLIENTE}
          seguimiento={seguimiento}
          entrenamiento={entrenamiento}
          valoraciones={valoraciones}
        />,
      )

      await fireEvent.press(await screen.findByRole("button", { name: "Ver mi evolución" }))
      await waitFor(() => expect(screen.getByText("Grasa por pliegues")).toBeTruthy())
      // Un único bloque de inicio, fechado por las medidas; la visita corregida no lo sustituye.
      expect(screen.getAllByRole("header", { name: /^Inicio/ })).toHaveLength(1)
      expect(screen.getByRole("header", { name: "Inicio · 10 ene" })).toBeTruthy()
      expect(screen.getAllByText("Masa libre de grasa")).toHaveLength(1)
      expect(screen.getByText("64,0 kg")).toBeTruthy()
      expect(screen.queryByText("67,5 kg")).toBeNull()
      expect(seguimiento.medidas).toHaveBeenCalledTimes(1)
    })
  })

  it("la cintura apuntada hoy desde Inicio se consulta en Progreso", async () => {
    const hoy = hoyAgenda()
    const seguimiento = api()
    seguimiento.medidas = jest.fn(async () => ({
      medidas: [
        {
          id: "40000000-0000-4000-8000-000000000002",
          fecha: sumarDias(hoy, -7),
          pesoKg: null,
          cinturaCm: 94,
          grasaPct: null,
          alturaCm: null,
          creadoEn: "2026-09-17T07:00:00.000Z",
        },
        {
          id: "40000000-0000-4000-8000-000000000003",
          fecha: hoy,
          pesoKg: null,
          cinturaCm: 92.5,
          grasaPct: null,
          alturaCm: null,
          creadoEn: "2026-09-24T07:00:00.000Z",
        },
      ],
      fechaNacimiento: null,
    }))
    await render(
      <ProgresoCliente
        clienteId={CLIENTE}
        seguimiento={seguimiento}
        entrenamiento={entrenamiento}
      />,
    )
    await fireEvent.press(await screen.findByRole("tab", { name: "Cintura" }))
    // La cifra grande de la gráfica y la fila «Cintura» del resumen de la semana.
    expect(screen.getAllByText("92,5 cm")).toHaveLength(2)
    expect(screen.getByText(/Última medida.*−1,5 cm desde el inicio/s)).toBeTruthy()
  })
})

const PAUTADA = "60000000-0000-4000-8000-000000000001"
const idSintetico = (prefijo: string, n: number): string =>
  `${prefijo}-0000-4000-8000-${n.toString(16).padStart(12, "0")}`

/** Una cintura al día hasta hoy; la primera toma trae también peso y altura, y la última es 85,5. */
function medidasDiarias(total: number, hoy: string): Medida[] {
  return Array.from({ length: total }, (_, n) => {
    const fecha = sumarDias(hoy, n - total + 1)
    return {
      id: idSintetico("40000000", n),
      fecha,
      pesoKg: n === 0 ? 90 : null,
      cinturaCm: n === 0 ? 100 : n === total - 1 ? 85.5 : 90 + (n % 10),
      grasaPct: null,
      alturaCm: n === 0 ? 180 : null,
      creadoEn: `${fecha}T08:00:00.000Z`,
    }
  })
}

/** Una prueba al día: primero «Salto vertical»; después Plancha y la Flexiones pautada, que acaba en 45. */
function pruebasDiarias(total: number, hoy: string): PruebaFisica[] {
  return Array.from({ length: total }, (_, n) => {
    const fecha = sumarDias(hoy, n - total + 1)
    const base = { id: idSintetico("50000000", n), fecha, creadoEn: `${fecha}T08:00:00.000Z` }
    if (n === 0)
      return { ...base, pruebaId: null, nombre: "Salto vertical", valor: 30, unidad: "cm" }
    if (n % 2 === 1)
      return { ...base, pruebaId: null, nombre: "Plancha", valor: 60 + (n % 30), unidad: "s" }
    const valor = n === total - 1 ? 45 : 20 + (n % 15)
    return { ...base, pruebaId: PAUTADA, nombre: "Flexiones", valor, unidad: "reps" }
  })
}

/**
 * Medidas y pruebas servidas como la API: páginas de 500, de lo más reciente a
 * lo más antiguo; las rutas anteriores, solo con las 500 más recientes. El resto
 * de lecturas son las de `api()`.
 */
function servidorDeHistorico(medidas: Medida[], pruebas: PruebaFisica[] = []) {
  const estado = {
    // En orden cronológico, como se registraron.
    medidas,
    pruebas,
    /** Las páginas siguientes a la primera esperan a que se resuelva. */
    retener: null as Promise<void> | null,
    /** Cuántas páginas siguientes fallan antes de responder. */
    fallos: 0,
    rutas: [] as string[],
  }
  function pagina<F>(filas: F[], ruta: string): { filas: F[]; siguienteCursor: string | null } {
    const desde = Number(/[?&]cursor=pos-(\d+)/.exec(ruta)?.[1] ?? 0)
    const recientes = [...filas].reverse()
    return {
      filas: recientes.slice(desde, desde + 500),
      siguienteCursor: desde + 500 < recientes.length ? `pos-${desde + 500}` : null,
    }
  }
  const pedir = async (ruta: string, esquema: z.ZodType<unknown>): Promise<unknown> => {
    estado.rutas.push(ruta)
    if (ruta.includes("cursor=")) {
      if (estado.retener) await estado.retener
      if (estado.fallos > 0) {
        estado.fallos -= 1
        throw new ErrorDeRed("Sin conexión")
      }
    }
    if (ruta.includes("/medidas/pagina?")) {
      const { filas, siguienteCursor } = pagina(estado.medidas, ruta)
      return esquema.parse({ medidas: filas, fechaNacimiento: null, siguienteCursor })
    }
    if (ruta.includes("/pruebas/pagina?")) {
      const { filas, siguienteCursor } = pagina(estado.pruebas, ruta)
      return esquema.parse({ pruebas: filas, siguienteCursor })
    }
    if (ruta.endsWith("/medidas"))
      return esquema.parse({ medidas: estado.medidas.slice(-500), fechaNacimiento: null })
    if (ruta.endsWith("/pruebas"))
      return esquema.parse({
        pruebas: estado.pruebas
          .slice(-500)
          .sort((a, b) => (a.nombre < b.nombre ? -1 : a.nombre > b.nombre ? 1 : 0)),
      })
    throw new Error(`Ruta no servida: ${ruta}`)
  }
  const real = crearApiSeguimiento(pedir as unknown as PeticionAutenticada)
  return { estado, seguimiento: { ...api(), medidas: real.medidas, pruebas: real.pruebas } }
}

describe("Progreso con más de 500 registros", () => {
  const entrenamiento = {
    plan: jest.fn(async () => ({ plan: null })),
    semana: jest.fn(async () => ({ sesiones: [], total: 0 })),
  } as unknown as ApiEntrenamiento
  const conPruebaPautada = async (): Promise<ConfiguracionSeguimiento> => ({
    ...CONFIGURACION_SEGUIMIENTO_INICIAL,
    pruebasPrescritas: [{ id: PAUTADA, nombre: "Flexiones", unidad: "reps" }],
  })
  const progreso = (seguimiento: ApiSeguimiento, enfocada = true): React.JSX.Element => (
    <Enfoque.Provider value={enfocada}>
      <ProgresoCliente
        clienteId={CLIENTE}
        seguimiento={seguimiento}
        entrenamiento={entrenamiento}
      />
    </Enfoque.Provider>
  )
  const inicioDel = (fecha: string): { name: string } => ({
    name: `Inicio · ${fechaCorta(fecha)}`,
  })

  it("parte de la primera toma y enseña la última medida y prueba", async () => {
    const hoy = hoyAgenda()
    const { estado, seguimiento } = servidorDeHistorico(
      medidasDiarias(501, hoy),
      pruebasDiarias(501, hoy),
    )
    seguimiento.configuracion = jest.fn(conPruebaPautada)
    await render(progreso(seguimiento))

    // La primera toma solo llega en la segunda página.
    expect(await screen.findByRole("header", inicioDel(sumarDias(hoy, -500)))).toBeTruthy()
    expect(screen.getByText("90,0 kg")).toBeTruthy()
    await fireEvent.press(screen.getByRole("tab", { name: "Cintura" }))
    expect(screen.getByText(/Última medida.*−14,5 cm desde el inicio/s)).toBeTruthy()
    // La cifra grande y la fila «Cintura» de la semana usan la medida de hoy.
    expect(screen.getAllByText("85,5 cm")).toHaveLength(2)

    await fireEvent.press(screen.getByRole("tab", { name: "Pruebas físicas" }))
    expect(screen.getByText("Salto vertical")).toBeTruthy()
    // La prueba pautada, con su resultado más reciente.
    expect(screen.getByText("45 reps")).toBeTruthy()
    expect(estado.rutas.filter((ruta) => ruta.includes("/pagina?"))).toHaveLength(4)
  })

  it("si falla una página siguiente no enseña un histórico parcial y permite reintentar", async () => {
    const hoy = hoyAgenda()
    const { estado, seguimiento } = servidorDeHistorico(medidasDiarias(501, hoy))
    estado.fallos = 1
    await render(progreso(seguimiento))

    expect(
      await screen.findByText("No se pudo cargar tu progreso. Revisa la conexión."),
    ).toBeTruthy()
    expect(screen.queryByRole("header", { name: /^Inicio/ })).toBeNull()
    expect(screen.queryByText(/Última medida/)).toBeNull()

    await fireEvent.press(screen.getByRole("button", { name: "Reintentar" }))
    expect(await screen.findByRole("header", inicioDel(sumarDias(hoy, -500)))).toBeTruthy()
    expect(screen.queryByText("No se pudo cargar tu progreso. Revisa la conexión.")).toBeNull()
  })

  it("al salir de Progreso, una carga antigua no repuebla la pantalla", async () => {
    const hoy = hoyAgenda()
    const { estado, seguimiento } = servidorDeHistorico(medidasDiarias(501, hoy))
    const leer = seguimiento.medidas
    const leidas: ListadoMedidas[] = []
    seguimiento.medidas = async (clienteId) => {
      const listado = await leer(clienteId)
      leidas.push(listado)
      return listado
    }
    let soltar!: () => void
    estado.retener = new Promise<void>((resolve) => {
      soltar = resolve
    })
    const pantalla = await render(progreso(seguimiento))
    // La primera carga espera su segunda página de medidas.
    await waitFor(() => expect(estado.rutas.some((ruta) => ruta.includes("cursor="))).toBe(true))

    await pantalla.rerender(progreso(seguimiento, false))
    // Fuera de la pantalla se registra otra cintura hoy.
    estado.retener = null
    estado.medidas = [
      ...estado.medidas,
      {
        ...estado.medidas.at(-1)!,
        id: idSintetico("40000000", 999),
        cinturaCm: 84,
        creadoEn: `${hoy}T09:00:00.000Z`,
      },
    ]
    await pantalla.rerender(progreso(seguimiento, true))
    await fireEvent.press(await screen.findByRole("tab", { name: "Cintura" }))
    expect(screen.getAllByText("84 cm")).toHaveLength(2)

    await act(async () => soltar())
    await waitFor(() => expect(leidas).toHaveLength(2))
    // La carga anterior termina después con su propia última medida, pero ya no manda.
    expect(leidas[1]!.medidas.at(-1)!.cinturaCm).toBe(85.5)
    expect(screen.getAllByText("84 cm")).toHaveLength(2)
    expect(screen.queryByText("85,5 cm")).toBeNull()
  })

  it("con 5.000 medidas y 5.000 pruebas carga en 20 peticiones y pinta la última toma", async () => {
    const hoy = hoyAgenda()
    const { estado, seguimiento } = servidorDeHistorico(
      medidasDiarias(5000, hoy),
      pruebasDiarias(5000, hoy),
    )
    seguimiento.configuracion = jest.fn(conPruebaPautada)

    const inicio = performance.now()
    await render(progreso(seguimiento))
    await screen.findByRole("header", inicioDel(sumarDias(hoy, -4999)), { timeout: 20_000 })
    const carga = performance.now() - inicio
    expect(estado.rutas.filter((ruta) => ruta.includes("/medidas/pagina?"))).toHaveLength(10)
    expect(estado.rutas.filter((ruta) => ruta.includes("/pruebas/pagina?"))).toHaveLength(10)
    expect(estado.rutas.filter((ruta) => !ruta.includes("/pagina?"))).toHaveLength(0)
    // Margen amplio: detecta un recorrido cuadrático, no mide el dispositivo.
    expect(carga).toBeLessThan(5000)

    await fireEvent.press(screen.getByRole("tab", { name: "Cintura" }))
    // Con anchura, la gráfica dibuja los 5.000 puntos.
    await fireEvent(screen.getByRole("image"), "layout", {
      nativeEvent: { layout: { width: 360, height: 110 } },
    })
    expect(screen.getAllByText("85,5 cm")).toHaveLength(2)
    await fireEvent.press(screen.getByRole("tab", { name: "Pruebas físicas" }))
    expect(screen.getByText("Salto vertical")).toBeTruthy()
  }, 60_000)
})
