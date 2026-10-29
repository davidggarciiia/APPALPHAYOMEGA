import {
  AsignarPlanSchema,
  BloqueSchema,
  FaseDeBloqueSchema,
  PrescripcionSchema,
} from "@alpha-omega/shared"

const fase = { desde: 2, hasta: 3, nombre: "Descarga", detalle: null }
const ajustes = {
  rirCompuestos: { min: 3, max: 4 },
  rirAccesorios: { min: 3, max: 4 },
  factorSeries: 0.5,
  factorCarga: 0.875,
}
const id = (n: number): string => `10000000-0000-4000-8000-${String(n).padStart(12, "0")}`
const sesion = {
  id: id(1),
  nombre: "Fuerza",
  diaSemana: 1,
  ejercicios: [
    {
      id: id(2),
      ejercicioId: id(3),
      indicaciones: null,
      series: [{ id: id(4), tipoMedicion: "repeticiones", pesoKg: null, repeticiones: 8 }],
    },
  ],
}
const bloque = { objetivos: [], fases: [fase], deportes: [], notas: [] }
const plan = {
  operacionId: id(5),
  nombre: "Bloque",
  semanaInicial: "2026-10-26",
  semanas: 4,
  patron: { sesiones: [sesion] },
  bloque,
}

describe("fases con prescripción por semana", () => {
  it("conserva exactamente los planes antiguos y bloques de borrador sin ajustes", () => {
    expect(FaseDeBloqueSchema.parse(fase)).toEqual(fase)
    expect(BloqueSchema.parse(bloque)).toEqual(bloque)
    expect(AsignarPlanSchema.parse(plan)).toEqual(plan)
    expect(AsignarPlanSchema.parse({ ...plan, bloque: undefined }).bloque).toBeUndefined()
  })

  it("admite ajustes completos y parciales y los conserva al publicar", () => {
    const ajustada = { ...fase, ajustes }
    expect(FaseDeBloqueSchema.parse(ajustada)).toEqual(ajustada)
    expect(
      AsignarPlanSchema.parse({ ...plan, bloque: { ...bloque, fases: [ajustada] } }).bloque
        ?.fases[0]?.ajustes,
    ).toEqual(ajustes)
    expect(FaseDeBloqueSchema.parse({ ...fase, ajustes: { factorCarga: 1.1 } }).ajustes).toEqual({
      factorCarga: 1.1,
    })
    expect(FaseDeBloqueSchema.safeParse({ ...fase, ajustes: {} }).success).toBe(true)
  })

  it.each([
    { factorSeries: 0.29 },
    { factorSeries: 1.01 },
    { factorCarga: 0.49 },
    { factorCarga: 1.11 },
    { factorCarga: "0.9" },
    { factorCarga: Infinity },
    { factorCarga: NaN },
    { rirCompuestos: { min: 4, max: 3 } },
    { rirAccesorios: { min: 3, max: 2 } },
    { rirCompuestos: { min: -1, max: 3 } },
    { rirAccesorios: { min: 0, max: 6 } },
    { rirAccesorios: { min: 1.5, max: 2 } },
    { rirCompuestos: { min: 2 } },
    { desconocido: 1 },
    null,
  ])("rechaza ajustes inválidos: %j", (ajuste) => {
    expect(FaseDeBloqueSchema.safeParse({ ...fase, ajustes: ajuste }).success).toBe(false)
  })

  it("admite los límites inclusivos de factores y RIR", () => {
    for (const valores of [
      { factorSeries: 0.3, factorCarga: 0.5, rirCompuestos: { min: 0, max: 5 } },
      { factorSeries: 1, factorCarga: 1.1, rirAccesorios: { min: 5, max: 5 } },
    ]) {
      expect(FaseDeBloqueSchema.safeParse({ ...fase, ajustes: valores }).success).toBe(true)
    }
  })

  it("lee la fase de una sesión como copia independiente y opcional", () => {
    const prescripcion = {
      nombre: sesion.nombre,
      ejercicios: sesion.ejercicios.map((e) => ({ ...e, nombre: "Remo" })),
    }
    expect(PrescripcionSchema.parse(prescripcion)).toEqual(prescripcion)
    const conFase = { ...prescripcion, fase: { nombre: fase.nombre, ajustes } }
    expect(PrescripcionSchema.parse(conFase)).toEqual(conFase)
    expect(
      PrescripcionSchema.safeParse({
        ...conFase,
        fase: { nombre: fase.nombre, ajustes: { factorCarga: 0.4 } },
      }).success,
    ).toBe(false)
  })
})
