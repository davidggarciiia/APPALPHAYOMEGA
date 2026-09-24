import { describe, expect, it, jest } from "@jest/globals"
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native"
import {
  CONFIGURACION_SEGUIMIENTO_INICIAL,
  type CambiarDia,
  type ConfiguracionSeguimiento,
  type DiaDeSeguimiento,
  type GuardarConfiguracionSeguimiento,
  type RegistrarPrueba,
} from "@alpha-omega/shared"

import type { ApiEntrenamiento } from "../entrenamiento/api"
import { hoyAgenda, lunesDeSemana, sumarDias } from "../entrenamiento/fechas"
import { ErrorDePeticion } from "../lib/http"
import type { ApiSeguimiento } from "./api"
import { HoyDiario } from "./hoy-diario"
import { ProgresoCliente } from "./progreso"
import type { ApiEvolucionAvisos, ApiValoracionesCliente } from "./valoraciones-api"

jest.mock("expo-router", () => ({
  useFocusEffect: (efecto: () => void) =>
    jest.requireActual<typeof import("react")>("react").useEffect(efecto, [efecto]),
}))
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
    expect(screen.getByText(/−0,3 kg respecto al inicio/)).toBeTruthy()
    expect(screen.getByText("Masa libre de grasa")).toBeTruthy()
    expect(screen.getByText("79,4 kg")).toBeTruthy()
    expect(screen.getByText(/196 cm · \d+ años/)).toBeTruthy()
    expect(entrenamiento.plan).toHaveBeenCalledWith(CLIENTE, lunes)

    await fireEvent.press(screen.getByRole("tab", { name: "Fuerza" }))
    expect(screen.getByText(/Cuando envíes sesiones con carga/)).toBeTruthy()
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
    expect(screen.getByText(/Última medida.*−1,5 cm respecto al inicio/s)).toBeTruthy()
  })
})
