import { describe, expect, it, jest } from "@jest/globals"
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react-native"
import {
  MedioFotoSchema,
  SerieEvolucionSchema,
  type AccesoMedio,
  type Evolucion,
  type ListadoFotos,
  type MedioFoto,
  type PuntoEvolucion,
  type SerieEvolucion,
} from "@alpha-omega/shared"

import { EvolucionValoraciones } from "./evolucion-valoraciones"
import type { ApiMedios } from "./medios-api"
import type { ApiEvolucionAvisos } from "./valoraciones-api"

jest.mock("expo-router", () => ({
  useFocusEffect: (efecto: () => void) =>
    jest.requireActual<typeof import("react")>("react").useEffect(efecto, [efecto]),
}))

// Datos sintéticos: ningún valor, nombre, foto ni enlace pertenece a una persona real.
const CLIENTE = "10000000-0000-4000-8000-000000000000"
const ENTRENADORA = { id: "70000000-0000-4000-8000-000000000001", nombre: "Entrenadora Demo" }
const VISITA_ENERO = "20000000-0000-4000-8000-000000000001"
const VISITA_SEPTIEMBRE = "20000000-0000-4000-8000-000000000002"
const PUBLICACION = "21000000-0000-4000-8000-000000000001"
const ENERO = "2026-01-10"
const MAYO = "2026-05-10"
const SEPTIEMBRE = "2026-09-24"

const deVisita = (fecha: string, valor: number, extra: Partial<PuntoEvolucion> = {}) => ({
  fecha,
  valor,
  publicacionId: PUBLICACION,
  valoracionId: fecha === ENERO ? VISITA_ENERO : VISITA_SEPTIEMBRE,
  corregido: false,
  ...extra,
})
const deHistorico = (fecha: string, valor: number): PuntoEvolucion => ({
  fecha,
  valor,
  publicacionId: null,
  valoracionId: null,
  corregido: false,
})

function serie(
  datos: Pick<SerieEvolucion, "clave" | "nombre" | "unidad" | "puntos"> & Partial<SerieEvolucion>,
): SerieEvolucion {
  return SerieEvolucionSchema.parse({
    bloque: "medidas",
    origen: "valoracion",
    metodo: null,
    clasificada: true,
    ...datos,
  })
}

const cintura = (puntos: PuntoEvolucion[]): SerieEvolucion =>
  serie({
    clave: "c:40000000-0000-4000-8000-000000000001:1",
    nombre: "Cintura",
    unidad: "cm",
    metodo: "Cinta métrica · ombligo",
    puntos,
  })

type ApiFalsa = { evolucion: jest.Mock<ApiEvolucionAvisos["evolucion"]> }
function api(...respuestas: Array<Evolucion | Error>): ApiFalsa {
  const evolucion = jest.fn<ApiEvolucionAvisos["evolucion"]>()
  for (const r of respuestas)
    evolucion.mockImplementationOnce(async () => {
      if (r instanceof Error) throw r
      return r
    })
  return { evolucion }
}

/** La tarjeta de la serie con ese nombre (la enésima si hay varias). */
const tarjeta = (nombre: string, n = 0) => screen.getAllByTestId(`serie ${nombre}`)[n]!

describe("EvolucionValoraciones", () => {
  it("compara el primer dato con el último, con unidad, fechas, procedencia y método", async () => {
    const falsa = api({
      series: [
        cintura([deVisita(ENERO, 94), deVisita(SEPTIEMBRE, 92.5)]),
        serie({
          clave: "c:40000000-0000-4000-8000-000000000002:1",
          nombre: "Peso",
          unidad: "kg",
          metodo: "Báscula de la sala",
          puntos: [deVisita(ENERO, 112.2), deVisita(SEPTIEMBRE, 111.6)],
        }),
      ],
    })
    await render(<EvolucionValoraciones clienteId={CLIENTE} api={falsa} modo="cliente" />)

    await waitFor(() => expect(screen.getByText("Cintura")).toBeTruthy())
    expect(falsa.evolucion).toHaveBeenCalledWith(CLIENTE)
    expect(screen.getByRole("header", { name: "Tu evolución" })).toBeTruthy()
    expect(screen.getByRole("header", { name: "Medidas" })).toBeTruthy()

    const cinturaCard = within(tarjeta("Cintura"))
    expect(cinturaCard.getByText("Unidad: cm · Origen: visita")).toBeTruthy()
    expect(cinturaCard.getByText("Método: Cinta métrica · ombligo")).toBeTruthy()
    expect(cinturaCard.getByLabelText("Cintura, primer dato, 10 ene 2026: 94 cm")).toBeTruthy()
    expect(cinturaCard.getByLabelText("Cintura, último dato, 24 sep 2026: 92,5 cm")).toBeTruthy()
    expect(
      cinturaCard.getByLabelText(
        "Diferencia de Cintura entre el 10 ene 2026 y el 24 sep 2026: menos 1,5 cm",
      ),
    ).toBeTruthy()
    expect(cinturaCard.getByText("−1,5 cm")).toBeTruthy()

    // Sin arrastrar decimales de la resta: 111,6 − 112,2 es −0,6 kg.
    expect(within(tarjeta("Peso")).getByText("−0,6 kg")).toBeTruthy()
    // Lectura neutral: sin juicios ni etiquetas de bueno o malo.
    expect(screen.queryByText(/mejor|peor|bien|mal\b|enhorabuena/i)).toBeNull()
  })

  it("con un único dato lo muestra y explica que falta otra fecha, sin diferencia", async () => {
    await render(
      <EvolucionValoraciones
        clienteId={CLIENTE}
        api={api({ series: [cintura([deVisita(ENERO, 94)])] })}
        modo="cliente"
      />,
    )
    await waitFor(() => expect(screen.getByText("Cintura")).toBeTruthy())
    const card = within(tarjeta("Cintura"))
    expect(card.getByText("94 cm")).toBeTruthy()
    expect(
      card.getByText(
        "Solo hay un dato, del 10 ene 2026. Para ver una diferencia hace falta otra fecha de esta misma serie.",
      ),
    ).toBeTruthy()
    expect(card.queryByText("Diferencia")).toBeNull()
    expect(card.queryByRole("button", { name: /Elegir otras fechas/ })).toBeNull()
  })

  it("una valoración parcial no rellena lo que no se tomó y un protocolo incompleto va aparte", async () => {
    const definicion = "50000000-0000-4000-8000-000000000001"
    await render(
      <EvolucionValoraciones
        clienteId={CLIENTE}
        api={api({
          series: [
            cintura([deVisita(ENERO, 94), deVisita(SEPTIEMBRE, 92.5)]),
            // La cadera solo se tomó en enero: en septiembre no hay dato, no hay cero.
            serie({
              clave: "c:40000000-0000-4000-8000-000000000003:1",
              nombre: "Cadera",
              unidad: "cm",
              puntos: [deVisita(ENERO, 104)],
            }),
            serie({
              clave: `p:${definicion}:1:repeticiones`,
              nombre: "Flexiones en 1 minuto",
              unidad: "reps",
              bloque: "pruebas",
              metodo: "60 s",
              puntos: [deVisita(ENERO, 20)],
            }),
            serie({
              clave: `p:${definicion}:1:repeticiones:incompleto`,
              nombre: "Flexiones en 1 minuto",
              unidad: "reps",
              bloque: "pruebas",
              metodo: "Protocolo incompleto · 60 s",
              puntos: [deVisita(SEPTIEMBRE, 12)],
            }),
          ],
        })}
        modo="cliente"
      />,
    )
    await waitFor(() => expect(screen.getByText("Cadera")).toBeTruthy())

    const cadera = within(tarjeta("Cadera"))
    expect(cadera.getByText("No consta en la valoración más reciente.")).toBeTruthy()
    expect(cadera.getByText("104 cm")).toBeTruthy()
    expect(screen.queryByText("0 cm")).toBeNull()
    expect(within(tarjeta("Cintura")).queryByText(/No consta/)).toBeNull()

    // Mismo nombre, series distintas: cada una con su método y sin diferencia entre ellas.
    const completa = within(tarjeta("Flexiones en 1 minuto", 0))
    const incompleta = within(tarjeta("Flexiones en 1 minuto", 1))
    expect(completa.getByText("Método: 60 s")).toBeTruthy()
    expect(incompleta.getByText("Método: Protocolo incompleto · 60 s")).toBeTruthy()
    expect(
      incompleta.getByText("Protocolo incompleto: no se compara con el protocolo completo."),
    ).toBeTruthy()
    expect(completa.queryByText(/Protocolo incompleto:/)).toBeNull()
    expect(screen.queryByText("−8 reps")).toBeNull()
    expect(screen.getAllByText("Diferencia")).toHaveLength(1)
  })

  it("dos series con el mismo nombre enseñan siempre su método, aunque no conste", async () => {
    await render(
      <EvolucionValoraciones
        clienteId={CLIENTE}
        api={api({
          series: [
            serie({
              clave: "g:pliegues:Jackson-Pollock 3",
              nombre: "Grasa por pliegues",
              unidad: "%",
              bloque: "pliegues",
              metodo: "Jackson-Pollock 3",
              puntos: [deVisita(ENERO, 24.1)],
            }),
            serie({
              clave: "g:pliegues:Durnin-Womersley",
              nombre: "Grasa por pliegues",
              unidad: "%",
              bloque: "pliegues",
              metodo: "Durnin-Womersley",
              puntos: [deVisita(SEPTIEMBRE, 22.8)],
            }),
            serie({
              clave: "c:40000000-0000-4000-8000-000000000004:1",
              nombre: "Peso",
              unidad: "kg",
              puntos: [deVisita(ENERO, 82.5)],
            }),
            serie({
              clave: "h:medida:pesoKg:historico",
              nombre: "Peso",
              unidad: "kg",
              bloque: null,
              origen: "historico",
              clasificada: false,
              puntos: [deHistorico("2025-11-02", 84)],
            }),
            serie({
              clave: "c:40000000-0000-4000-8000-000000000005:1",
              nombre: "Altura",
              unidad: "cm",
              puntos: [deVisita(ENERO, 176)],
            }),
          ],
        })}
        modo="cliente"
      />,
    )
    await waitFor(() => expect(screen.getByText("Altura")).toBeTruthy())
    expect(
      within(tarjeta("Grasa por pliegues", 0)).getByText("Método: Jackson-Pollock 3"),
    ).toBeTruthy()
    expect(
      within(tarjeta("Grasa por pliegues", 1)).getByText("Método: Durnin-Womersley"),
    ).toBeTruthy()
    expect(within(tarjeta("Peso", 0)).getByText("Método: sin indicar")).toBeTruthy()
    expect(within(tarjeta("Peso", 1)).getByText("Método: sin indicar")).toBeTruthy()
    // Un nombre único sin método no necesita la línea.
    expect(within(tarjeta("Altura")).queryByText(/Método:/)).toBeNull()
    expect(screen.queryByText("Diferencia")).toBeNull()
  })

  it("muestra el histórico sin clasificar después de las visitas y explica que no se compara", async () => {
    const series = [
      serie({
        clave: "h:dia:pesoKg",
        nombre: "Peso en ayunas",
        unidad: "kg",
        bloque: null,
        origen: "autorregistro",
        clasificada: false,
        puntos: [deHistorico("2026-09-01", 83.2), deHistorico("2026-09-20", 82.9)],
      }),
      serie({
        clave: "h:medida:cinturaCm:historico",
        nombre: "Cintura antigua",
        unidad: "cm",
        bloque: null,
        origen: "historico",
        clasificada: false,
        puntos: [deHistorico("2025-10-01", 97), deHistorico("2025-12-01", 96)],
      }),
      serie({
        clave: "p:50000000-0000-4000-8000-000000000002:1:segundos",
        nombre: "Plancha",
        unidad: "s",
        bloque: "pruebas",
        puntos: [deVisita(ENERO, 45)],
      }),
      cintura([deVisita(ENERO, 94), deVisita(SEPTIEMBRE, 92.5)]),
    ]
    const { rerender } = await render(
      <EvolucionValoraciones clienteId={CLIENTE} api={api({ series })} modo="cliente" />,
    )
    await waitFor(() => expect(screen.getByText("Peso en ayunas")).toBeTruthy())

    expect(screen.getAllByRole("header").map((h) => h.props.children)).toEqual([
      "Tu evolución",
      "Medidas",
      "Pruebas físicas",
      "Otros registros",
    ])
    const historico = within(tarjeta("Cintura antigua"))
    expect(historico.getByText("Unidad: cm · Origen: histórico sin clasificar")).toBeTruthy()
    expect(
      historico.getByText(
        "Sin método ni protocolo: se muestra, pero no se compara con las visitas.",
      ),
    ).toBeTruthy()
    // Dentro de su propia serie sí hay diferencia.
    expect(historico.getByText("−1 cm")).toBeTruthy()
    const propio = within(tarjeta("Peso en ayunas"))
    expect(propio.getByText("Unidad: kg · Origen: registrado por ti")).toBeTruthy()
    expect(propio.getByText(/no se compara con las visitas/)).toBeTruthy()
    expect(within(tarjeta("Cintura")).queryByText(/no se compara con las visitas/)).toBeNull()

    await rerender(
      <EvolucionValoraciones clienteId={CLIENTE} api={api({ series })} modo="entrenador" />,
    )
    await waitFor(() =>
      expect(
        within(tarjeta("Peso en ayunas")).getByText(
          "Unidad: kg · Origen: registrado por el cliente",
        ),
      ).toBeTruthy(),
    )
    expect(screen.getByRole("header", { name: "Evolución" })).toBeTruthy()
  })

  it("un cero registrado se muestra como cero y la ausencia nunca", async () => {
    await render(
      <EvolucionValoraciones
        clienteId={CLIENTE}
        api={api({
          series: [
            serie({
              clave: "p:50000000-0000-4000-8000-000000000003:1:repeticiones",
              nombre: "Dominadas",
              unidad: "reps",
              bloque: "pruebas",
              puntos: [deVisita(ENERO, 0), deVisita(SEPTIEMBRE, 3)],
            }),
            // Métrica opcional recogida solo en enero: en septiembre falta, no es cero.
            serie({
              clave: "p:50000000-0000-4000-8000-000000000004:1:altura",
              nombre: "Salto vertical · Altura",
              unidad: "cm",
              bloque: "pruebas",
              puntos: [deVisita(ENERO, 32)],
            }),
          ],
        })}
        modo="cliente"
      />,
    )
    await waitFor(() => expect(screen.getByText("Dominadas")).toBeTruthy())
    const dominadas = within(tarjeta("Dominadas"))
    expect(dominadas.getByLabelText("Dominadas, primer dato, 10 ene 2026: 0 reps")).toBeTruthy()
    expect(dominadas.getByText("+3 reps")).toBeTruthy()
    const salto = within(tarjeta("Salto vertical · Altura"))
    expect(salto.getByText("32 cm")).toBeTruthy()
    expect(salto.getByText(/Solo hay un dato/)).toBeTruthy()
    expect(screen.queryByText("0 cm")).toBeNull()
    expect(screen.queryByText(/−32 cm/)).toBeNull()
  })

  it("indica el punto corregido", async () => {
    await render(
      <EvolucionValoraciones
        clienteId={CLIENTE}
        api={api({
          series: [cintura([deVisita(ENERO, 94), deVisita(SEPTIEMBRE, 92, { corregido: true })])],
        })}
        modo="cliente"
      />,
    )
    await waitFor(() => expect(screen.getByText("Cintura")).toBeTruthy())
    const card = within(tarjeta("Cintura"))
    expect(card.getByText("Corregido")).toBeTruthy()
    expect(card.getByLabelText("Cintura, último dato, 24 sep 2026: 92 cm, corregido")).toBeTruthy()
    expect(card.getByLabelText("Cintura, primer dato, 10 ene 2026: 94 cm")).toBeTruthy()
  })

  it("permite elegir otras dos fechas de la misma serie", async () => {
    await render(
      <EvolucionValoraciones
        clienteId={CLIENTE}
        api={api({
          series: [cintura([deVisita(ENERO, 94), deVisita(MAYO, 93), deVisita(SEPTIEMBRE, 92.5)])],
        })}
        modo="cliente"
      />,
    )
    await waitFor(() => expect(screen.getByText("−1,5 cm")).toBeTruthy())
    expect(screen.getByLabelText(/^Cintura: 3 datos del 10 ene 2026 al 24 sep 2026/)).toBeTruthy()

    await fireEvent.press(screen.getByRole("button", { name: "Elegir otras fechas de Cintura" }))
    const primera = screen.getByLabelText("Primera fecha de Cintura")
    const segunda = screen.getByLabelText("Segunda fecha de Cintura")
    expect(
      within(primera).getByRole("radio", { name: "10 ene 2026" }).props.accessibilityState,
    ).toMatchObject({ checked: true })

    await fireEvent.press(within(primera).getByRole("radio", { name: "10 may 2026" }))
    expect(screen.getByLabelText("Cintura, 10 may 2026: 93 cm")).toBeTruthy()
    expect(screen.getByText("−0,5 cm")).toBeTruthy()
    expect(screen.queryByText("−1,5 cm")).toBeNull()

    // La misma fecha en los dos huecos no es una comparación.
    await fireEvent.press(within(segunda).getByRole("radio", { name: "10 may 2026" }))
    expect(screen.getByText("Elige dos fechas distintas para ver la diferencia.")).toBeTruthy()
    expect(screen.queryByText("Diferencia")).toBeNull()

    // En cualquier orden, la diferencia va de la fecha anterior a la posterior.
    await fireEvent.press(within(segunda).getByRole("radio", { name: "10 ene 2026" }))
    expect(
      screen.getByLabelText(
        "Diferencia de Cintura entre el 10 ene 2026 y el 10 may 2026: menos 1 cm",
      ),
    ).toBeTruthy()
  })

  it("sin datos lo dice y ante un error permite reintentar", async () => {
    const vacia = api({ series: [] })
    const { unmount } = await render(
      <EvolucionValoraciones clienteId={CLIENTE} api={vacia} modo="cliente" />,
    )
    await waitFor(() =>
      expect(screen.getByText(/^Aún no hay valoraciones publicadas ni registros\./)).toBeTruthy(),
    )
    await unmount()

    const falla = api(new Error("caída"), { series: [cintura([deVisita(ENERO, 94)])] })
    await render(<EvolucionValoraciones clienteId={CLIENTE} api={falla} modo="cliente" />)
    await waitFor(() =>
      expect(screen.getByText("No se pudo cargar la evolución. Revisa la conexión.")).toBeTruthy(),
    )
    expect(screen.queryByText("Cintura")).toBeNull()
    await fireEvent.press(screen.getByRole("button", { name: "Reintentar" }))
    await waitFor(() => expect(screen.getByText("Cintura")).toBeTruthy())
    expect(falla.evolucion).toHaveBeenCalledTimes(2)
    expect(screen.queryByText("No se pudo cargar la evolución. Revisa la conexión.")).toBeNull()
  })
})

describe("fotos desde la evolución", () => {
  const foto = (n: number, datos: Partial<MedioFoto>): MedioFoto =>
    MedioFotoSchema.parse({
      id: `30000000-0000-4000-8000-${String(n).padStart(12, "0")}`,
      clienteId: CLIENTE,
      autor: ENTRENADORA,
      origen: "profesional",
      vista: "frente",
      etiqueta: null,
      fechaToma: SEPTIEMBRE,
      estado: "disponible",
      tipoMime: "image/jpeg",
      bytes: 120_000,
      valoracionId: null,
      solicitudId: null,
      creadoEn: "2026-09-24T09:00:00.000Z",
      confirmadoEn: "2026-09-24T09:01:00.000Z",
      ...datos,
    })
  const propia = foto(1, {
    fechaToma: ENERO,
    origen: "cliente",
    autor: { id: CLIENTE, nombre: "Clienta Demo" },
    creadoEn: "2026-01-10T09:00:00.000Z",
  })
  const deLaEntrenadora = foto(2, {})

  function apiFotos(...respuestas: Array<ListadoFotos | Error>) {
    const fotosDeCliente = jest.fn<ApiMedios["fotosDeCliente"]>()
    for (const r of respuestas)
      fotosDeCliente.mockImplementationOnce(async () => {
        if (r instanceof Error) throw r
        return r
      })
    return {
      fotosDeCliente,
      acceso: jest.fn(async (medioId: string): Promise<AccesoMedio> => ({
        medioId,
        lectura: {
          url: `https://almacen.test/lectura/${medioId}?firma=1`,
          metodo: "GET",
          cabeceras: {},
          caducaEn: "2099-01-01T00:00:00.000Z",
        },
      })),
      borrar: jest.fn<ApiMedios["borrar"]>(),
    }
  }

  it("sin fotos no ofrece el comparador", async () => {
    await render(
      <EvolucionValoraciones clienteId={CLIENTE} api={api({ series: [] })} modo="cliente" />,
    )
    await waitFor(() => expect(screen.getByText(/^Aún no hay valoraciones/)).toBeTruthy())
    expect(screen.queryByRole("button", { name: "Comparar fotos" })).toBeNull()
  })

  it("«Comparar fotos» abre el comparador con las fotos del cliente", async () => {
    const medios = apiFotos({ fotos: [deLaEntrenadora, propia] })
    const puedeBorrar = jest.fn((f: MedioFoto) => f.origen === "cliente")
    await render(
      <EvolucionValoraciones
        clienteId={CLIENTE}
        api={api({ series: [] })}
        fotos={{ api: medios, puedeBorrar }}
        modo="cliente"
      />,
    )
    // El comparador no pide nada hasta que se abre.
    expect(medios.fotosDeCliente).not.toHaveBeenCalled()
    await fireEvent.press(screen.getByRole("button", { name: "Comparar fotos" }))
    expect(medios.fotosDeCliente).toHaveBeenCalledWith(CLIENTE)

    expect(await screen.findByLabelText("Frente, 10 ene 2026")).toBeTruthy()
    expect(await screen.findByLabelText("Frente, 24 sep 2026")).toBeTruthy()
    expect(
      screen.getByRole("button", { name: "Eliminar la foto de Frente, 10 ene 2026" }),
    ).toBeTruthy()
    expect(
      screen.queryByRole("button", { name: "Eliminar la foto de Frente, 24 sep 2026" }),
    ).toBeNull()

    // Cerrar retira las imágenes de la pantalla.
    await fireEvent.press(screen.getByRole("button", { name: "Ocultar fotos" }))
    expect(screen.queryByLabelText("Frente, 10 ene 2026")).toBeNull()
  })

  it("si las fotos no cargan, lo dice y permite reintentar", async () => {
    const medios = apiFotos(new Error("caída"), { fotos: [propia] })
    await render(
      <EvolucionValoraciones
        clienteId={CLIENTE}
        api={api({ series: [] })}
        fotos={{ api: medios, puedeBorrar: () => false }}
        modo="cliente"
      />,
    )
    await fireEvent.press(screen.getByRole("button", { name: "Comparar fotos" }))
    expect(await screen.findByText("No se pudieron cargar las fotos.")).toBeTruthy()
    await fireEvent.press(screen.getByRole("button", { name: "Reintentar cargar las fotos" }))
    expect(await screen.findByText(/Solo hay una foto de frente/)).toBeTruthy()
    expect(medios.fotosDeCliente).toHaveBeenCalledTimes(2)
  })
})
