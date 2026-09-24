import { describe, expect, it, jest } from "@jest/globals"
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native"
import {
  PublicacionValoracionSchema,
  crearPruebaEstandar,
  proyeccionPublica,
  type DefinicionCorporal,
  type DocumentoValoracion,
  type PautaRevision,
  type ProximaRevision,
  type PublicacionValoracion,
} from "@alpha-omega/shared"

import { ValoracionesCliente } from "./resumen-valoracion"
import type { ApiValoracionesCliente } from "./valoraciones-api"

jest.mock("expo-router", () => ({
  useFocusEffect: (efecto: () => void) =>
    jest.requireActual<typeof import("react")>("react").useEffect(efecto, [efecto]),
}))

// Datos sintéticos: ningún nombre ni valor pertenece a una persona real.
const CLIENTE = "10000000-0000-4000-8000-000000000000"
const AUTOR = { id: "70000000-0000-4000-8000-000000000001", nombre: "Entrenadora Demo" }
const uuid = (serie: number, n: number): string =>
  `${serie}0000000-0000-4000-8000-${String(n).padStart(12, "0")}`
const RECIENTE = uuid(2, 1)
const INICIAL = uuid(2, 2)

const corporal = (
  n: number,
  datos: Pick<DefinicionCorporal, "bloque" | "magnitud" | "nombre" | "unidad"> &
    Partial<DefinicionCorporal>,
): DefinicionCorporal => ({
  id: uuid(4, n),
  version: 1,
  zona: null,
  lateralidad: null,
  instrumento: null,
  protocolo: null,
  activa: true,
  ...datos,
})
const peso = corporal(1, { bloque: "medidas", magnitud: "peso", nombre: "Peso", unidad: "kg" })
const altura = corporal(2, {
  bloque: "medidas",
  magnitud: "altura",
  nombre: "Altura",
  unidad: "cm",
})
const cintura = corporal(3, {
  bloque: "medidas",
  magnitud: "perimetro",
  nombre: "Perímetro",
  unidad: "cm",
  zona: "Cintura",
})
const triceps = corporal(4, {
  bloque: "pliegues",
  magnitud: "pliegue",
  nombre: "Tríceps",
  unidad: "mm",
  lateralidad: "derecha",
  instrumento: "Plicómetro de prueba",
})
const visceral = corporal(5, {
  bloque: "bioimpedancia",
  magnitud: "grasaVisceral",
  nombre: "Grasa visceral",
  unidad: "indice",
})
const flexiones = crearPruebaEstandar("flexiones1min", uuid(5, 1))
const dominadas = crearPruebaEstandar("dominadas", uuid(5, 2), "Agarre prono")
const cooper = crearPruebaEstandar("cooper", uuid(5, 3))
const suspension = crearPruebaEstandar("suspension", uuid(5, 4))

const COMPLETO: DocumentoValoracion = {
  definiciones: {
    corporales: [peso, altura, cintura, triceps, visceral],
    pruebas: [flexiones, dominadas, cooper, suspension],
  },
  bloques: ["medidas", "pliegues", "bioimpedancia", "pruebas"],
  corporales: [
    { definicionId: peso.id, estado: "registrado", valor: 82.5 },
    { definicionId: altura.id, estado: "noRealizado", motivo: "Sin tallímetro ese día" },
    { definicionId: cintura.id, estado: "registrado", valor: 88 },
    { definicionId: triceps.id, estado: "registrado", valor: 12.4, lecturas: [12.2, 12.6, 12.4] },
    { definicionId: visceral.id, estado: "registrado", valor: 9 },
  ],
  pruebas: [
    {
      definicionId: flexiones.id,
      estado: "registrado",
      valores: { repeticiones: 31 },
      protocoloCompleto: false,
      fecha: "2026-09-12",
      notas: "Paró antes del minuto",
    },
    {
      definicionId: dominadas.id,
      estado: "registrado",
      valores: { repeticiones: 8 },
      protocoloCompleto: true,
      fecha: null,
      notas: null,
    },
    {
      definicionId: cooper.id,
      estado: "registrado",
      // Sin FC máxima ni recuperación: no se recogieron y no deben aparecer.
      valores: { distancia: 2450, duracion: 720, fcMedia: 152 },
      protocoloCompleto: true,
      fecha: "2026-09-10",
      notas: null,
    },
    { definicionId: suspension.id, estado: "noRealizado", motivo: "Molestias en la muñeca" },
  ],
  grasaPorPliegues: { valorPct: 18.5, metodo: "Jackson-Pollock 3 pliegues", fecha: "2026-09-10" },
  destacados: [peso.id, dominadas.id, altura.id],
  conclusion: "Buen punto de partida. Seguimos con el plan.",
  notasInternas: "Nota interna que no se publica",
}

/** Solo peso; la altura quedó pendiente y no se publica. */
const PARCIAL: DocumentoValoracion = {
  definiciones: { corporales: [peso, altura], pruebas: [] },
  bloques: ["medidas"],
  corporales: [
    { definicionId: peso.id, estado: "registrado", valor: 81.2 },
    { definicionId: altura.id, estado: "pendiente" },
  ],
  pruebas: [],
  grasaPorPliegues: null,
  destacados: [],
  conclusion: null,
  notasInternas: null,
}

function publicacion({
  doc = COMPLETO,
  ...datos
}: Partial<Omit<PublicacionValoracion, "documento">> & {
  doc?: DocumentoValoracion
} = {}): PublicacionValoracion {
  return PublicacionValoracionSchema.parse({
    id: uuid(6, 1),
    valoracionId: RECIENTE,
    numero: 1,
    sustituyeId: null,
    tipo: "revision",
    fechaToma: "2026-09-10",
    autor: AUTOR,
    publicadaEn: "2026-09-11T09:00:00.000Z",
    documento: proyeccionPublica(doc),
    ...datos,
  })
}

const SIN_PAUTA: ProximaRevision = {
  revision: 0,
  pauta: null,
  cumplidaPorId: null,
  actualizadaEn: null,
}

/** Servidor falso: las publicaciones van de la más reciente a la más antigua. */
function api(publicaciones: PublicacionValoracion[], proxima = SIN_PAUTA) {
  return {
    listarPublicadas: jest.fn<ApiValoracionesCliente["listarPublicadas"]>(
      async (_c, limite = 20, desplazamiento = 0) => ({
        total: publicaciones.length,
        valoraciones: publicaciones.slice(desplazamiento, desplazamiento + limite).map((p) => ({
          id: p.valoracionId,
          tipo: p.tipo,
          fechaToma: p.fechaToma,
          publicadaEn: p.publicadaEn,
          numeroPublicacion: p.numero,
        })),
      }),
    ),
    leerPublicada: jest.fn<ApiValoracionesCliente["leerPublicada"]>(async (_c, id) => ({
      publicacion: publicaciones.find((p) => p.valoracionId === id)!,
    })),
    proximaRevision: jest.fn<ApiValoracionesCliente["proximaRevision"]>(async () => proxima),
  }
}

describe("ValoracionesCliente", () => {
  it("muestra la carga mientras llegan los datos", async () => {
    const falsa = api([])
    falsa.listarPublicadas.mockReturnValue(new Promise(() => {}))
    await render(<ValoracionesCliente clienteId={CLIENTE} api={falsa} />)
    expect(screen.getByText("Cargando tus valoraciones…")).toBeTruthy()
  })

  it("explica que aún no hay valoraciones sin pedir ninguna", async () => {
    const falsa = api([])
    await render(<ValoracionesCliente clienteId={CLIENTE} api={falsa} />)
    await waitFor(() =>
      expect(screen.getByText(/Aún no tienes valoraciones publicadas/)).toBeTruthy(),
    )
    expect(screen.getByText("Sin programar")).toBeTruthy()
    expect(falsa.listarPublicadas).toHaveBeenCalledWith(CLIENTE, 10, 0)
    expect(falsa.proximaRevision).toHaveBeenCalledWith(CLIENTE)
    expect(falsa.leerPublicada).not.toHaveBeenCalled()
    expect(screen.queryByText("Historial de valoraciones")).toBeNull()
  })

  it("resume la última publicación con autor, fecha, conclusión y corrección", async () => {
    const falsa = api([publicacion({ numero: 2, sustituyeId: uuid(6, 9) })])
    await render(<ValoracionesCliente clienteId={CLIENTE} api={falsa} />)
    await waitFor(() => expect(screen.getByText("Revisión")).toBeTruthy())
    expect(screen.getByText("Corregida")).toBeTruthy()
    expect(screen.getByText("Tomada el 10 sep 2026 · por Entrenadora Demo")).toBeTruthy()
    expect(screen.getByText("Buen punto de partida. Seguimos con el plan.")).toBeTruthy()
    expect(falsa.leerPublicada).toHaveBeenCalledWith(CLIENTE, RECIENTE)
  })

  it("enseña los destacados con su unidad y sin inventar un cero", async () => {
    await render(
      <ValoracionesCliente clienteId={CLIENTE} api={api([publicacion({ tipo: "inicial" })])} />,
    )
    await waitFor(() => expect(screen.getByText("Valoración inicial")).toBeTruthy())
    expect(screen.queryByText("Corregida")).toBeNull()
    expect(screen.getByText("Peso")).toBeTruthy()
    expect(screen.getByText("82,5 kg")).toBeTruthy()
    expect(screen.getByText("Dominadas · Agarre prono")).toBeTruthy()
    expect(screen.getByText("8 reps")).toBeTruthy()
    // La altura no se midió: se dice, no se convierte en 0.
    expect(screen.getByText("Altura")).toBeTruthy()
    expect(screen.getByText("No realizado")).toBeTruthy()
    expect(screen.queryByText("0 cm")).toBeNull()
    // Lo que el entrenador no destacó se queda en el detalle.
    expect(screen.queryByText("Perímetro · Cintura")).toBeNull()
  })

  const pauta = (datos: Partial<PautaRevision>): PautaRevision => ({
    fecha: null,
    intervaloSemanas: null,
    bloques: ["medidas", "pruebas"],
    ...datos,
  })
  it.each<[string, ProximaRevision["pauta"], string | null, string]>([
    ["una fecha", pauta({ fecha: "2026-10-08" }), null, "8 oct 2026"],
    ["un intervalo", pauta({ intervaloSemanas: 6 }), null, "Cada 6 semanas"],
    ["nada", null, null, "Sin programar"],
    [
      "una revisión ya hecha",
      pauta({ fecha: "2026-09-10" }),
      RECIENTE,
      "La revisión pautada ya se realizó.",
    ],
  ])("indica la próxima revisión cuando hay %s, sin controles", async (_, p, cumplida, texto) => {
    const falsa = api([], { ...SIN_PAUTA, revision: 3, pauta: p, cumplidaPorId: cumplida })
    await render(<ValoracionesCliente clienteId={CLIENTE} api={falsa} />)
    await waitFor(() => expect(screen.getByText(texto)).toBeTruthy())
    expect(screen.getByRole("header", { name: "Próxima revisión" })).toBeTruthy()
    if (p) expect(screen.getByText("Medidas · Pruebas físicas")).toBeTruthy()
    expect(screen.queryAllByRole("button")).toHaveLength(0)
  })

  it("abre el detalle de una publicación anterior agrupado por bloques", async () => {
    const falsa = api([
      publicacion({ doc: PARCIAL, fechaToma: "2026-11-05" }),
      publicacion({ id: uuid(6, 2), valoracionId: INICIAL, tipo: "inicial", numero: 2 }),
    ])
    await render(<ValoracionesCliente clienteId={CLIENTE} api={falsa} />)
    const fila = await screen.findByRole("button", {
      name: "Abrir valoración inicial del 10 sep 2026, corregida",
    })
    await fireEvent.press(fila)
    await waitFor(() => expect(screen.getByRole("header", { name: "Medidas" })).toBeTruthy())
    expect(falsa.leerPublicada).toHaveBeenCalledWith(CLIENTE, INICIAL)
    for (const bloque of ["Pliegues", "Bioimpedancia", "Pruebas físicas"])
      expect(screen.getByRole("header", { name: bloque })).toBeTruthy()

    // Medidas: zona, valor con coma y un no realizado con su motivo.
    expect(screen.getByText("Perímetro · Cintura")).toBeTruthy()
    expect(screen.getByText("88 cm")).toBeTruthy()
    expect(screen.getByText("Sin tallímetro ese día")).toBeTruthy()
    // Pliegues: lateralidad, lecturas, instrumento y la grasa que calculó el entrenador.
    expect(screen.getByText("Tríceps · derecha")).toBeTruthy()
    expect(screen.getByText("12,4 mm")).toBeTruthy()
    expect(screen.getByText("Lecturas: 12,2 · 12,6 · 12,4 mm")).toBeTruthy()
    expect(screen.getByText("Instrumento: Plicómetro de prueba")).toBeTruthy()
    expect(screen.getByText("18,5 % · Jackson-Pollock 3 pliegues · 10 sep 2026")).toBeTruthy()
    expect(screen.getByText("Calculada por tu entrenador")).toBeTruthy()
    // Bioimpedancia: el índice del fabricante no es kg ni %.
    expect(screen.getByText("9 (índice del fabricante)")).toBeTruthy()
    // Pruebas: principal con su unidad, protocolo incompleto, otra fecha y notas.
    expect(screen.getByText("Flexiones en 1 minuto")).toBeTruthy()
    expect(screen.getByText("31 reps")).toBeTruthy()
    expect(screen.getByText("Protocolo incompleto")).toBeTruthy()
    expect(screen.getByText("Hecha el 12 sep 2026")).toBeTruthy()
    expect(screen.getByText("Paró antes del minuto")).toBeTruthy()
    // Cooper: el resto de métricas con nombre y unidad; las no recogidas no aparecen.
    expect(screen.getByText("2450 m")).toBeTruthy()
    expect(screen.getByText("Duración: 720 s")).toBeTruthy()
    expect(screen.getByText("FC media: 152 lpm")).toBeTruthy()
    expect(screen.queryByText(/FC máxima/)).toBeNull()
    expect(screen.getByText("Instrumento: Banda pectoral")).toBeTruthy()
    // Misma fecha que la visita: no se repite.
    expect(screen.queryByText("Hecha el 10 sep 2026")).toBeNull()
    expect(screen.getByText("Molestias en la muñeca")).toBeTruthy()
    expect(screen.getAllByText("No realizado")).toHaveLength(2)
    expect(screen.getAllByText("Protocolo incompleto")).toHaveLength(1)
    // Nada interno ni ningún control profesional: solo «Volver».
    expect(screen.queryByText("Nota interna que no se publica")).toBeNull()
    expect(screen.getAllByRole("button")).toHaveLength(1)

    await fireEvent.press(screen.getByRole("button", { name: "Volver al resumen" }))
    expect(screen.getByRole("header", { name: "Historial de valoraciones" })).toBeTruthy()
  })

  it("en una valoración parcial enseña solo lo publicado", async () => {
    const falsa = api([publicacion({ doc: PARCIAL })])
    await render(<ValoracionesCliente clienteId={CLIENTE} api={falsa} />)
    await fireEvent.press(
      await screen.findByRole("button", { name: "Ver el detalle de tu última valoración" }),
    )
    expect(screen.getByRole("header", { name: "Medidas" })).toBeTruthy()
    expect(screen.getByText("81,2 kg")).toBeTruthy()
    expect(screen.queryByText("Altura")).toBeNull()
    for (const bloque of ["Pliegues", "Bioimpedancia", "Pruebas físicas"])
      expect(screen.queryByRole("header", { name: bloque })).toBeNull()
    // La última ya estaba cargada: abrirla no vuelve a pedirla.
    expect(falsa.leerPublicada).toHaveBeenCalledTimes(1)
  })

  it("«Ver más» pide la página siguiente del historial", async () => {
    const doce = Array.from({ length: 12 }, (_, n) =>
      publicacion({
        id: uuid(6, n + 1),
        valoracionId: uuid(2, n + 1),
        tipo: n === 11 ? "inicial" : "revision",
        fechaToma: `2026-09-${String(28 - n * 2).padStart(2, "0")}`,
        doc: PARCIAL,
      }),
    )
    const falsa = api(doce)
    await render(<ValoracionesCliente clienteId={CLIENTE} api={falsa} />)
    await screen.findByRole("button", { name: "Abrir revisión del 10 sep 2026" })
    expect(
      screen.queryByRole("button", { name: "Abrir valoración inicial del 6 sep 2026" }),
    ).toBeNull()

    await fireEvent.press(screen.getByRole("button", { name: "Ver más valoraciones" }))
    await screen.findByRole("button", { name: "Abrir valoración inicial del 6 sep 2026" })
    expect(falsa.listarPublicadas).toHaveBeenLastCalledWith(CLIENTE, 10, 10)
    expect(screen.queryByRole("button", { name: "Ver más valoraciones" })).toBeNull()
  })

  it("avisa del error y reintenta", async () => {
    const falsa = api([publicacion()])
    falsa.listarPublicadas.mockRejectedValueOnce(new Error("sin conexión"))
    await render(<ValoracionesCliente clienteId={CLIENTE} api={falsa} />)
    await waitFor(() =>
      expect(
        screen.getByText("No se pudieron cargar tus valoraciones. Revisa la conexión."),
      ).toBeTruthy(),
    )
    await fireEvent.press(screen.getByRole("button", { name: "Reintentar" }))
    await waitFor(() => expect(screen.getByText("Revisión")).toBeTruthy())
    expect(screen.queryByText(/No se pudieron cargar/)).toBeNull()
    expect(falsa.listarPublicadas).toHaveBeenCalledTimes(2)
  })
})
