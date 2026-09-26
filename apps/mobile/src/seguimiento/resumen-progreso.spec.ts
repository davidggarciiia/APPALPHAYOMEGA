import { describe, expect, it } from "@jest/globals"
import {
  CONFIGURACION_SEGUIMIENTO_INICIAL,
  type ConfiguracionSeguimiento,
  type DiaDeSeguimiento,
  type Medida,
  type ProximaRevision,
} from "@alpha-omega/shared"

import { cifrasClave } from "./resumen-progreso"

// Datos sintéticos, con fechas fijas.
const HOY = "2026-09-26"
let n = 0
function medida(fecha: string, datos: Partial<Medida>): Medida {
  n += 1
  return {
    id: `40000000-0000-4000-8000-${String(n).padStart(12, "0")}`,
    fecha,
    pesoKg: null,
    cinturaCm: null,
    grasaPct: null,
    alturaCm: null,
    creadoEn: `${fecha}T08:00:00.000Z`,
    ...datos,
  }
}
const dia = (fecha: string, pesoKg: number | null): DiaDeSeguimiento => ({
  fecha,
  pesoKg,
  pasos: null,
  suenoMin: null,
  creatina: null,
  suplementos: [],
})
const config = (cambios: Partial<ConfiguracionSeguimiento> = {}): ConfiguracionSeguimiento => ({
  ...CONFIGURACION_SEGUIMIENTO_INICIAL,
  ...cambios,
})
const proxima = (cambios: Partial<ProximaRevision> = {}): ProximaRevision => ({
  revision: 1,
  pauta: null,
  cumplidaPorId: null,
  actualizadaEn: null,
  ...cambios,
})
const porClave = (cifras: ReturnType<typeof cifrasClave>) =>
  Object.fromEntries(cifras.map((c) => [c.clave, c]))

describe("resumen de Progreso", () => {
  it("peso: la media de 7 días frente al primer peso medido, con su fecha", () => {
    const cifras = porClave(
      cifrasClave({
        configuracion: config({ objetivoPeso: { direccion: "bajar", rangoKg: null } }),
        dias: [dia("2026-09-24", 112.1), dia("2026-09-25", 112.1), dia("2026-09-26", 111.6)],
        medidas: [medida("2026-01-10", { pesoKg: 114.2, alturaCm: 196 })],
        hoy: HOY,
      }),
    )
    expect(cifras.peso).toEqual({
      clave: "peso",
      titulo: "Peso",
      valor: "111,9 kg",
      nota: "Media de 7 días",
      cambio: "−2,3 kg desde el 10 ene",
      sentido: "favorable",
    })
  })

  it("peso: sin pesos diarios usa la última medida; sin objetivo no califica el cambio", () => {
    const cifras = porClave(
      cifrasClave({
        configuracion: config(),
        dias: [],
        medidas: [
          medida("2026-09-15", { pesoKg: 81.5 }),
          medida("2026-01-10", { pesoKg: 80 }),
          medida("2026-05-02", { cinturaCm: 90 }),
        ],
        hoy: HOY,
      }),
    )
    expect(cifras.peso).toMatchObject({
      valor: "81,5 kg",
      nota: "Medida del 15 sep",
      cambio: "+1,5 kg desde el 10 ene",
      sentido: "neutral",
    })
  })

  it("un solo dato no tiene cambio y el mismo valor dice «sin cambios»", () => {
    const soloUno = porClave(
      cifrasClave({
        configuracion: config(),
        dias: [],
        medidas: [medida("2026-09-15", { cinturaCm: 92.5 })],
        hoy: HOY,
      }),
    )
    expect(soloUno.cintura).toMatchObject({ valor: "92,5 cm", cambio: null })
    const igual = porClave(
      cifrasClave({
        configuracion: config(),
        dias: [],
        medidas: [medida("2026-09-01", { cinturaCm: 94 }), medida("2026-09-15", { cinturaCm: 94 })],
        hoy: HOY,
      }),
    )
    expect(igual.cintura).toMatchObject({ valor: "94 cm", cambio: "Sin cambios desde el 1 sep" })
  })

  it("grasa y cintura comparan cada medida consigo misma, aunque vengan en tomas distintas", () => {
    const cifras = porClave(
      cifrasClave({
        configuracion: config(),
        dias: [],
        medidas: [
          medida("2026-01-10", { pesoKg: 80, cinturaCm: 94 }),
          medida("2026-03-05", { grasaPct: 22 }),
          medida("2026-09-15", { grasaPct: 20.5, cinturaCm: 91 }),
        ],
        hoy: HOY,
      }),
    )
    expect(cifras.grasa).toMatchObject({
      valor: "20,5 %",
      nota: "Medida del 15 sep",
      cambio: "−1,5 % desde el 5 mar",
    })
    expect(cifras.cintura).toMatchObject({ valor: "91 cm", cambio: "−3,0 cm desde el 10 ene" })
    // Nada de masa libre ni otros valores calculados con tomas de fechas distintas.
    expect(Object.keys(cifras)).toEqual(["peso", "grasa", "cintura"])
  })

  it("solo enseña lo que el entrenador deja ver", () => {
    const medidas = [medida("2026-09-15", { pesoKg: 80, grasaPct: 20, cinturaCm: 90 })]
    const sinPeso = cifrasClave({
      configuracion: config({ indicadores: ["cintura", "pasos"] }),
      dias: [dia("2026-09-26", 80)],
      medidas,
      hoy: HOY,
    })
    expect(sinPeso.map((c) => c.clave)).toEqual(["grasa", "cintura"])
    const niPesoNiCintura = cifrasClave({
      configuracion: config({ indicadores: ["pasos", "sueno"] }),
      dias: [dia("2026-09-26", 80)],
      medidas,
      hoy: HOY,
    })
    expect(niPesoNiCintura).toEqual([])
  })

  it("próxima revisión: fecha con lo que falta, intervalo, sin programar o ya realizada", () => {
    const revision = (p: ProximaRevision) =>
      cifrasClave({ configuracion: config(), dias: [], medidas: [], proxima: p, hoy: HOY })[0]
    expect(revision(proxima())).toMatchObject({ valor: "Sin programar", nota: null })
    expect(
      revision(
        proxima({ pauta: { fecha: "2026-11-05", intervaloSemanas: null, bloques: ["medidas"] } }),
      ),
    ).toMatchObject({ titulo: "Próxima revisión", valor: "5 nov", nota: "Dentro de 40 días" })
    expect(
      revision(proxima({ pauta: { fecha: null, intervaloSemanas: 6, bloques: ["medidas"] } })),
    ).toMatchObject({ valor: "Cada 6 semanas", nota: null })
    expect(
      revision(
        proxima({
          pauta: { fecha: "2026-09-20", intervaloSemanas: null, bloques: ["medidas"] },
          cumplidaPorId: "20000000-0000-4000-8000-000000000001",
        }),
      ),
    ).toMatchObject({ valor: "20 sep", nota: "Ya realizada", sentido: "favorable" })
    // Sin consultarla (ficha del entrenador) no aparece.
    expect(cifrasClave({ configuracion: config(), dias: [], medidas: [], hoy: HOY })).toEqual([])
  })
})
