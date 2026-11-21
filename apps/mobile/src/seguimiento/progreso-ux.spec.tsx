import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native"
import {
  CONFIGURACION_SEGUIMIENTO_INICIAL,
  PublicacionValoracionSchema,
  proyeccionPublica,
  type DefinicionCorporal,
  type DocumentoValoracion,
  type Medida,
  type ProximaRevision,
  type PruebaFisica,
  type SolicitudFotos,
} from "@alpha-omega/shared"

import { ErrorDeRed, ErrorDelServidor } from "../lib/http"
import type { ApiSeguimiento } from "./api"
import type { ApiMedios } from "./medios-api"
import { ProgresoRedisenado } from "./progreso-redisenado"
import type { ApiEvolucionAvisos, ApiValoracionesCliente } from "./valoraciones-api"

// Pantallas montadas: `volverALaPantalla` repite el efecto de foco como al regresar a ella.
const mockEnfoques = new Set<() => void>()
jest.mock("expo-router", () => ({
  useFocusEffect: (efecto: () => void | (() => void)) => {
    const { useEffect, useState } = jest.requireActual<typeof import("react")>("react")
    const [foco, setFoco] = useState(0)
    useEffect(() => {
      const enfocar = (): void => setFoco((n) => n + 1)
      mockEnfoques.add(enfocar)
      return () => {
        mockEnfoques.delete(enfocar)
      }
    }, [])
    useEffect(efecto, [efecto, foco])
  },
}))
jest.mock("expo-crypto", () => ({ randomUUID: () => "10000000-0000-4000-8000-0000000000aa" }))

async function volverALaPantalla(): Promise<void> {
  await act(async () => {
    for (const enfocar of mockEnfoques) enfocar()
  })
}

const CLIENTE = "10000000-0000-4000-8000-000000000001"
const EQUIPO = "10000000-0000-4000-8000-000000000002"
const M1 = "40000000-0000-4000-8000-000000000001"
const M2 = "40000000-0000-4000-8000-000000000002"
const M3 = "40000000-0000-4000-8000-000000000003"
const P1 = "50000000-0000-4000-8000-000000000001"
const PRUEBA_PRESCRITA = "20000000-0000-4000-8000-000000000001"

const medida = (id: string, autorId: string, fecha: string, extra: Partial<Medida>): Medida => ({
  id,
  autorId,
  fecha,
  pesoKg: null,
  cinturaCm: null,
  grasaPct: null,
  alturaCm: null,
  creadoEn: `${fecha}T08:00:00.000Z`,
  ...extra,
})
const medidasIniciales = (): Medida[] => [
  medida(M1, CLIENTE, "2026-01-10", { pesoKg: 80, cinturaCm: 95, grasaPct: 20, alturaCm: 180 }),
  medida(M2, EQUIPO, "2026-02-10", { pesoKg: 78 }),
  medida(M3, CLIENTE, "2026-09-15", { pesoKg: 76 }),
]
const pruebaPlancha: PruebaFisica = {
  id: P1,
  autorId: CLIENTE,
  pruebaId: PRUEBA_PRESCRITA,
  fecha: "2026-09-15",
  nombre: "Plancha",
  valor: 60,
  unidad: "seg",
  creadoEn: "2026-09-15T08:00:00.000Z",
}

function entorno(cambios: Partial<typeof CONFIGURACION_SEGUIMIENTO_INICIAL> = {}) {
  let medidas = medidasIniciales()
  let pruebas: PruebaFisica[] = [pruebaPlancha]
  const seguimiento = {
    configuracion: jest.fn(async () => ({
      ...CONFIGURACION_SEGUIMIENTO_INICIAL,
      indicadores: ["peso", "cintura", "pruebas"] as ("peso" | "cintura" | "pruebas")[],
      pruebasPrescritas: [{ id: PRUEBA_PRESCRITA, nombre: "Plancha", unidad: "seg" }],
      ...cambios,
    })),
    dias: jest.fn(async () => ({ dias: [] })),
    medidas: jest.fn(async () => ({ medidas: [...medidas], fechaNacimiento: null })),
    fuerza: jest.fn(async () => ({ ejercicios: [] })),
    pruebas: jest.fn(async () => ({ pruebas: [...pruebas] })),
    registrarMedida: jest.fn(
      async (_c: string, datos: { fecha: string; pesoKg: number | null }) => {
        const nueva = medida("40000000-0000-4000-8000-000000000009", CLIENTE, datos.fecha, {
          pesoKg: datos.pesoKg,
        })
        medidas = [...medidas, nueva]
        return nueva
      },
    ),
    registrarPrueba: jest.fn(async () => pruebaPlancha),
    borrarMedida: jest.fn(async (_c: string, id: string) => {
      const borrada = medidas.find((m) => m.id === id)!
      medidas = medidas.filter((m) => m.id !== id)
      return borrada
    }),
    borrarPrueba: jest.fn(async (_c: string, id: string) => {
      const borrada = pruebas.find((p) => p.id === id)!
      pruebas = pruebas.filter((p) => p.id !== id)
      return borrada
    }),
  }
  return seguimiento
}
type Entorno = ReturnType<typeof entorno>
const comoApi = (e: Entorno): ApiSeguimiento => e as unknown as ApiSeguimiento

const pintar = (e: Entorno, extra: Partial<React.ComponentProps<typeof ProgresoRedisenado>> = {}) =>
  render(<ProgresoRedisenado clienteId={CLIENTE} seguimiento={comoApi(e)} {...extra} />)

describe("primera carga y vuelta a la pantalla", () => {
  it("enseña un esqueleto accesible y no un texto suelto mientras carga", async () => {
    const e = entorno()
    e.configuracion.mockReturnValue(new Promise(() => undefined))
    await pintar(e)
    expect(screen.getByRole("progressbar", { name: "Cargando progreso" })).toBeOnTheScreen()
    expect(
      screen.getAllByTestId("esqueleto", { includeHiddenElements: true }).length,
    ).toBeGreaterThan(0)
    expect(screen.queryByText("Cargando…")).toBeNull()
  })

  it("al volver renueva en silencio: no vacía la pantalla ni cierra el detalle abierto", async () => {
    const e = entorno()
    await pintar(e)
    await fireEvent.press(await screen.findByRole("button", { name: /^Peso,/ }))
    expect(screen.getByRole("header", { name: "Peso" })).toBeOnTheScreen()
    // La renovación tarda: lo que se ve no cambia mientras tanto.
    e.medidas.mockImplementationOnce(() => new Promise(() => undefined))

    await volverALaPantalla()

    await waitFor(() => expect(e.medidas).toHaveBeenCalledTimes(2))
    expect(screen.getByRole("header", { name: "Peso" })).toBeOnTheScreen()
    expect(screen.queryByRole("progressbar")).toBeNull()
  })

  it("si renovar falla, conserva lo que ya se veía sin sustituirlo por un error", async () => {
    const e = entorno()
    await pintar(e)
    await screen.findByRole("button", { name: /^Peso,/ })
    e.medidas.mockRejectedValueOnce(new ErrorDeRed())

    await volverALaPantalla()

    await waitFor(() => expect(e.medidas).toHaveBeenCalledTimes(2))
    expect(screen.getByRole("button", { name: /^Peso,/ })).toBeOnTheScreen()
    expect(screen.queryByText(/No se pudo cargar tu progreso/)).toBeNull()
  })

  it("confirma el guardado de una medida y la deja a la vista sin recargar en negro", async () => {
    const e = entorno()
    await pintar(e)
    await fireEvent.press(await screen.findByRole("button", { name: "Añadir medida" }))
    await fireEvent.changeText(screen.getByLabelText("Peso (kg)"), "75,5")
    await fireEvent.press(screen.getByRole("button", { name: "Guardar" }))

    expect(await screen.findByText("Medida guardada.")).toBeOnTheScreen()
    expect(e.registrarMedida).toHaveBeenCalledWith(
      CLIENTE,
      expect.objectContaining({ pesoKg: 75.5 }),
    )
    expect(screen.queryByRole("progressbar")).toBeNull()
    expect(screen.getByRole("button", { name: /^Peso, 80 a 75,5 kg/ })).toBeOnTheScreen()
  })

  it("confirma el guardado de una prueba", async () => {
    const e = entorno()
    await pintar(e)
    await fireEvent.press(await screen.findByRole("button", { name: "Añadir prueba" }))
    await fireEvent.press(screen.getByRole("button", { name: "Plancha · seg" }))
    await fireEvent.changeText(screen.getByLabelText("Resultado"), "75")
    await fireEvent.press(screen.getByRole("button", { name: "Guardar" }))

    expect(await screen.findByText("Prueba guardada.")).toBeOnTheScreen()
    expect(e.registrarPrueba).toHaveBeenCalledTimes(1)
  })
})

describe("borrar un registro propio", () => {
  const abrirPeso = async (e: Entorno) => {
    await pintar(e)
    await fireEvent.press(await screen.findByRole("button", { name: /^Peso,/ }))
  }

  it("ofrece eliminar solo los registros del propio cliente, no los de su equipo", async () => {
    await abrirPeso(entorno())
    expect(
      screen.getByRole("button", { name: "Eliminar el registro del 10 ene 2026: 80 kg" }),
    ).toBeOnTheScreen()
    expect(
      screen.getByRole("button", { name: "Eliminar el registro del 15 sep 2026: 76 kg" }),
    ).toBeOnTheScreen()
    expect(screen.getByText("10 feb 2026: 78 kg")).toBeOnTheScreen()
    expect(
      screen.queryByRole("button", { name: /Eliminar el registro del 10 feb 2026/ }),
    ).toBeNull()
  })

  it("pide confirmación diciendo qué se borra, y al confirmar lo quita y lo avisa", async () => {
    const e = entorno()
    await abrirPeso(e)
    await fireEvent.press(
      screen.getByRole("button", { name: "Eliminar el registro del 10 ene 2026: 80 kg" }),
    )

    expect(
      await screen.findByRole("header", { name: "¿Eliminar este registro?" }),
    ).toBeOnTheScreen()
    expect(
      screen.getByText(
        /Medida del 10 ene 2026: peso 80 kg, cintura 95 cm, grasa 20 %, altura 180 cm\./,
      ),
    ).toBeOnTheScreen()
    expect(e.borrarMedida).not.toHaveBeenCalled()

    await fireEvent.press(screen.getByRole("button", { name: "Eliminar" }))

    await waitFor(() => expect(e.borrarMedida).toHaveBeenCalledWith(CLIENTE, M1))
    expect(await screen.findByText("Registro eliminado.")).toBeOnTheScreen()
    expect(screen.queryByText("10 ene 2026: 80 kg")).toBeNull()
    // El detalle sigue abierto con el resto del historial.
    expect(screen.getByRole("header", { name: "Peso" })).toBeOnTheScreen()
    expect(screen.getByText("15 sep 2026: 76 kg")).toBeOnTheScreen()
  })

  it("cancelar no borra nada", async () => {
    const e = entorno()
    await abrirPeso(e)
    await fireEvent.press(
      screen.getByRole("button", { name: "Eliminar el registro del 15 sep 2026: 76 kg" }),
    )
    await fireEvent.press(await screen.findByRole("button", { name: "Cancelar" }))
    expect(e.borrarMedida).not.toHaveBeenCalled()
    expect(screen.getByText("15 sep 2026: 76 kg")).toBeOnTheScreen()
  })

  it("si falla, lo dice en el cuadro, conserva el registro y deja reintentar", async () => {
    const e = entorno()
    e.borrarMedida.mockRejectedValueOnce(new ErrorDeRed())
    await abrirPeso(e)
    await fireEvent.press(
      screen.getByRole("button", { name: "Eliminar el registro del 15 sep 2026: 76 kg" }),
    )
    await fireEvent.press(await screen.findByRole("button", { name: "Eliminar" }))

    expect(await screen.findByText(/No hemos podido conectar/)).toBeOnTheScreen()
    expect(screen.getByRole("header", { name: "¿Eliminar este registro?" })).toBeOnTheScreen()
    expect(screen.queryByText("Registro eliminado.")).toBeNull()

    await fireEvent.press(screen.getByRole("button", { name: "Eliminar" }))
    await waitFor(() => expect(e.borrarMedida).toHaveBeenCalledTimes(2))
    expect(await screen.findByText("Registro eliminado.")).toBeOnTheScreen()
  })

  it("un 404 (ya no existía) se da por borrado", async () => {
    const e = entorno()
    // Otro dispositivo ya lo había borrado: el servidor responde 404.
    const borrarYa = e.borrarMedida.getMockImplementation()!
    e.borrarMedida.mockImplementationOnce(async (c, id) => {
      await borrarYa(c, id)
      throw new ErrorDelServidor(404)
    })
    await abrirPeso(e)
    await fireEvent.press(
      screen.getByRole("button", { name: "Eliminar el registro del 15 sep 2026: 76 kg" }),
    )
    await fireEvent.press(await screen.findByRole("button", { name: "Eliminar" }))

    expect(await screen.findByText("Registro eliminado.")).toBeOnTheScreen()
    expect(screen.queryByText("15 sep 2026: 76 kg")).toBeNull()
  })

  it("también permite eliminar una prueba propia", async () => {
    const e = entorno()
    await pintar(e)
    await fireEvent.press(await screen.findByRole("button", { name: /^Plancha,/ }))
    await fireEvent.press(
      screen.getByRole("button", { name: "Eliminar el registro del 15 sep 2026: 60 seg" }),
    )
    expect(await screen.findByText(/Prueba Plancha del 15 sep 2026: 60 seg\./)).toBeOnTheScreen()
    await fireEvent.press(screen.getByRole("button", { name: "Eliminar" }))

    await waitFor(() => expect(e.borrarPrueba).toHaveBeenCalledWith(CLIENTE, P1))
    // Era la única: el detalle se cierra y la fila desaparece.
    await waitFor(() => expect(screen.queryByRole("header", { name: "Plancha" })).toBeNull())
    expect(screen.queryByRole("button", { name: /^Plancha,/ })).toBeNull()
  })
})

describe("lo que se pide es lo que se enseña", () => {
  it("la grasa y la altura anotadas se ven en Medidas", async () => {
    await pintar(entorno())
    expect(
      await screen.findByRole("button", { name: /^Grasa corporal anotada, 20 %/ }),
    ).toBeOnTheScreen()
    expect(screen.getByRole("button", { name: "Altura, 180 cm · 10 ene 2026" })).toBeOnTheScreen()
  })
})

describe("objetivo, próxima revisión y fotos pendientes arriba", () => {
  const proxima = (pauta: ProximaRevision["pauta"], cumplidaPorId: string | null = null) =>
    ({
      evolucion: async () => ({ series: [] }),
      listarPublicadas: async () => ({ valoraciones: [], total: 0 }),
      proximaRevision: async () => ({ revision: 1, pauta, cumplidaPorId, actualizadaEn: null }),
    }) as unknown as ApiValoracionesCliente & Pick<ApiEvolucionAvisos, "evolucion">

  it("muestra el objetivo de peso con su rango", async () => {
    const e = entorno({ objetivoPeso: { direccion: "bajar", rangoKg: { minimo: 70, maximo: 75 } } })
    await pintar(e)
    expect(
      await screen.findByLabelText("Objetivo de peso: Bajar de peso · entre 70 y 75 kg"),
    ).toBeOnTheScreen()
  })

  it("no muestra el objetivo si el peso no es un indicador activo", async () => {
    const e = entorno({
      indicadores: ["cintura"],
      objetivoPeso: { direccion: "subir", rangoKg: null },
    })
    await pintar(e)
    await screen.findByRole("button", { name: /^Cintura,/ })
    expect(screen.queryByText("Objetivo de peso")).toBeNull()
  })

  it("muestra la próxima revisión con su fecha y abre las valoraciones", async () => {
    await pintar(entorno(), {
      valoraciones: proxima({ fecha: "2026-11-30", intervaloSemanas: null, bloques: ["medidas"] }),
    })
    await fireEvent.press(
      await screen.findByRole("button", {
        name: "Próxima revisión: 30 nov 2026. Ver valoraciones",
      }),
    )
    expect(await screen.findByText(/Aún no tienes valoraciones publicadas/)).toBeOnTheScreen()
  })

  it("una revisión pautada ya realizada o sin programar no ocupa sitio arriba", async () => {
    await pintar(entorno(), { valoraciones: proxima(null) })
    await screen.findByRole("button", { name: /^Peso,/ })
    expect(screen.queryByText("Próxima revisión")).toBeNull()
  })

  const solicitud = (cambios: Partial<SolicitudFotos> = {}): SolicitudFotos => ({
    id: "20000000-0000-4000-8000-000000000009",
    clienteId: CLIENTE,
    autor: { id: EQUIPO, nombre: "Entrenador" },
    vistas: ["frente", "espalda"],
    fechaLimite: "2026-11-05",
    mensaje: null,
    estado: "pendiente",
    creadaEn: "2026-10-19T10:00:00.000Z",
    recibidaEn: null,
    revisadaEn: null,
    medios: [],
    ...cambios,
  })
  const conSolicitudes = (lista: SolicitudFotos[]) =>
    ({
      fotosDeCliente: async () => ({ fotos: [] }),
      solicitudes: async () => ({ solicitudes: lista }),
    }) as unknown as ApiMedios

  it("la fila de fotos pendientes dice cuántas son y hasta cuándo", async () => {
    await pintar(entorno(), { medios: conSolicitudes([solicitud()]) })
    expect(
      await screen.findByRole("button", {
        name: "Fotos pendientes: 2 fotos, antes del 5 nov 2026",
      }),
    ).toBeOnTheScreen()
    expect(screen.getByText("2 fotos · antes del 5 nov 2026")).toBeOnTheScreen()
  })

  it("con una sola foto y sin fecha límite lo dice en singular y sin plazo", async () => {
    await pintar(entorno(), {
      medios: conSolicitudes([solicitud({ vistas: ["frente"], fechaLimite: null })]),
    })
    expect(
      await screen.findByRole("button", { name: "Fotos pendientes: 1 foto" }),
    ).toBeOnTheScreen()
  })
})

describe("enlace /progreso?abrir=…", () => {
  const sinPendientes = {
    fotosDeCliente: async () => ({ fotos: [] }),
    solicitudes: async () => ({ solicitudes: [] }),
  } as unknown as ApiMedios
  const sinValoraciones = {
    evolucion: async () => ({ series: [] }),
    listarPublicadas: async () => ({ valoraciones: [], total: 0 }),
    proximaRevision: async () => ({
      revision: 0,
      pauta: null,
      cumplidaPorId: null,
      actualizadaEn: null,
    }),
  } as unknown as ApiValoracionesCliente & Pick<ApiEvolucionAvisos, "evolucion">

  it("abrir=fotos abre directamente las solicitudes de fotos y avisa de que lo consumió", async () => {
    const alAbrir = jest.fn()
    await pintar(entorno(), { medios: sinPendientes, abrir: "fotos", alAbrir })
    expect(await screen.findByText("Fotos que te pide tu entrenador")).toBeOnTheScreen()
    expect(alAbrir).toHaveBeenCalledTimes(1)
  })

  it("abrir=valoraciones abre directamente las valoraciones", async () => {
    const alAbrir = jest.fn()
    await pintar(entorno(), { valoraciones: sinValoraciones, abrir: "valoraciones", alAbrir })
    expect(await screen.findByText(/Aún no tienes valoraciones publicadas/)).toBeOnTheScreen()
    expect(alAbrir).toHaveBeenCalledTimes(1)
  })

  it("un enlace nuevo con la pantalla ya abierta también abre, una vez por enlace", async () => {
    const e = entorno()
    const alAbrir = jest.fn()
    const vista = await pintar(e, { medios: sinPendientes, valoraciones: sinValoraciones })
    await screen.findByRole("button", { name: /^Peso,/ })
    expect(alAbrir).not.toHaveBeenCalled()

    await vista.rerender(
      <ProgresoRedisenado
        clienteId={CLIENTE}
        seguimiento={comoApi(e)}
        medios={sinPendientes}
        valoraciones={sinValoraciones}
        abrir="valoraciones"
        alAbrir={alAbrir}
      />,
    )
    expect(await screen.findByText(/Aún no tienes valoraciones publicadas/)).toBeOnTheScreen()
    // Un nuevo render con el mismo valor no vuelve a abrir ni a avisar.
    await vista.rerender(
      <ProgresoRedisenado
        clienteId={CLIENTE}
        seguimiento={comoApi(e)}
        medios={sinPendientes}
        valoraciones={sinValoraciones}
        abrir="valoraciones"
        alAbrir={alAbrir}
      />,
    )
    expect(alAbrir).toHaveBeenCalledTimes(1)
  })

  it("sin la API necesaria, ignora el parámetro en lugar de abrir una pantalla vacía", async () => {
    const alAbrir = jest.fn()
    await pintar(entorno(), { abrir: "fotos", alAbrir })
    await screen.findByRole("button", { name: /^Peso,/ })
    expect(screen.queryByText("Fotos que te pide tu entrenador")).toBeNull()
    expect(alAbrir).not.toHaveBeenCalled()
  })
})

describe("botón atrás de Android dentro de una valoración", () => {
  const peso: DefinicionCorporal = {
    id: "40000000-0000-4000-8000-0000000000a1",
    version: 1,
    bloque: "medidas",
    magnitud: "peso",
    nombre: "Peso",
    unidad: "kg",
    zona: null,
    lateralidad: null,
    instrumento: null,
    protocolo: null,
    activa: true,
  }
  const documento: DocumentoValoracion = {
    definiciones: { corporales: [peso], pruebas: [] },
    bloques: ["medidas"],
    corporales: [{ definicionId: peso.id, estado: "registrado", valor: 81.2 }],
    pruebas: [],
    grasaPorPliegues: null,
    destacados: [],
    conclusion: null,
    notasInternas: null,
  }
  const publicacion = PublicacionValoracionSchema.parse({
    id: "60000000-0000-4000-8000-000000000001",
    valoracionId: "20000000-0000-4000-8000-0000000000b1",
    numero: 1,
    sustituyeId: null,
    tipo: "revision",
    fechaToma: "2026-09-10",
    autor: { id: EQUIPO, nombre: "Entrenadora Demo" },
    publicadaEn: "2026-09-11T09:00:00.000Z",
    documento: proyeccionPublica(documento),
  })
  const valoraciones = {
    evolucion: async () => ({ series: [] }),
    listarPublicadas: async () => ({
      total: 1,
      valoraciones: [
        {
          id: publicacion.valoracionId,
          tipo: publicacion.tipo,
          fechaToma: publicacion.fechaToma,
          publicadaEn: publicacion.publicadaEn,
          numeroPublicacion: 1,
        },
      ],
    }),
    leerPublicada: async () => ({ publicacion }),
    proximaRevision: async () => ({
      revision: 0,
      pauta: null,
      cumplidaPorId: null,
      actualizadaEn: null,
    }),
  } as unknown as ApiValoracionesCliente & Pick<ApiEvolucionAvisos, "evolucion">

  /** Lo que hace Android al pulsar atrás: llega como `onRequestClose` al modal abierto. */
  const atras = async (): Promise<void> => {
    let modal = screen.getByRole("button", { name: "Volver a progreso" }).parent
    while (modal && (modal.type as unknown) !== "Modal") modal = modal.parent
    if (!modal) throw new Error("No hay un modal abierto")
    await fireEvent(modal, "requestClose")
  }

  it("atrás sube un nivel (valoración → lista) y solo el segundo cierra el modal", async () => {
    await pintar(entorno(), { valoraciones })
    await fireEvent.press(await screen.findByRole("button", { name: "Ver valoraciones" }))
    await fireEvent.press(
      await screen.findByRole("button", { name: "Ver el detalle de tu última valoración" }),
    )
    expect(await screen.findByRole("button", { name: "Volver al resumen" })).toBeOnTheScreen()

    await atras()
    expect(screen.queryByRole("button", { name: "Volver al resumen" })).toBeNull()
    expect(screen.getByText("Última valoración")).toBeOnTheScreen()

    await atras()
    expect(screen.queryByText("Última valoración")).toBeNull()
    expect(screen.getByRole("button", { name: /^Peso,/ })).toBeOnTheScreen()
  })
})
