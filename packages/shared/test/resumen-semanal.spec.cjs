const { test } = require("node:test")
const assert = require("node:assert/strict")
const shared = require("../dist")

const uuid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`
const serie = () => ({
  sesionId: uuid(1),
  fecha: "2026-10-26",
  pesoKg: 62.5,
  repeticiones: 6,
  rir: null,
  estimado1RM: 75,
})
const ejercicio = () => ({
  ejercicioId: uuid(2),
  nombre: "Press banca",
  mejorSerie: serie(),
  mejorSerieAnterior: { ...serie(), fecha: "2026-10-19", pesoKg: 60, estimado1RM: 72 },
  comparacion: {
    direccion: "sube",
    diferenciaKg: 2.5,
    diferenciaRepeticiones: 0,
    diferencia1RM: 3,
  },
  estado: "Progresa",
  record: true,
})
const cliente = () => ({
  clienteId: uuid(3),
  nombre: "David",
  apellidos: "García",
  sesionesPrevistas: 3,
  sesionesEnviadas: 2,
  ejercicios: [ejercicio()],
  molestiasAbiertas: [
    {
      id: uuid(4),
      sesionId: uuid(1),
      zona: "hombro",
      intensidad: 4,
      nivel: "ambar",
      creadaEn: "2026-10-26T10:00:00Z",
    },
  ],
})
const resumen = () => ({ semana: "2026-10-26", clientes: [cliente()] })
function esquema() {
  assert.ok(shared.ResumenSemanalSchema, "Falta el contrato exportado del resumen semanal")
  return shared.ResumenSemanalSchema
}

test("resumen semanal: valida cargas, comparación, estado, récord y molestias", () => {
  assert.deepEqual(esquema().parse(resumen()), resumen())
})

test("resumen semanal: admite cartera vacía y clientes sin sesiones ni historial", () => {
  assert.deepEqual(esquema().parse({ semana: "2026-10-26", clientes: [] }), {
    semana: "2026-10-26",
    clientes: [],
  })
  const sinHistorial = {
    ...cliente(),
    apellidos: null,
    sesionesPrevistas: 0,
    sesionesEnviadas: 0,
    ejercicios: [],
    molestiasAbiertas: [],
  }
  assert.equal(
    esquema().safeParse({ semana: "2026-10-26", clientes: [sinHistorial] }).success,
    true,
  )
  const sinComparacion = {
    ...ejercicio(),
    mejorSerie: null,
    mejorSerieAnterior: null,
    comparacion: null,
    estado: null,
    record: false,
  }
  assert.equal(
    esquema().safeParse({
      semana: "2026-10-26",
      clientes: [{ ...sinHistorial, ejercicios: [sinComparacion] }],
    }).success,
    true,
  )
})

test("resumen semanal: exige un lunes y recuentos enteros no negativos", () => {
  for (const semana of ["2026-10-27", "2026-02-30", "ayer"]) {
    assert.equal(esquema().safeParse({ ...resumen(), semana }).success, false)
  }
  for (const campo of ["sesionesPrevistas", "sesionesEnviadas"]) {
    for (const valor of [-1, 1.5]) {
      assert.equal(
        esquema().safeParse({ ...resumen(), clientes: [{ ...cliente(), [campo]: valor }] }).success,
        false,
      )
    }
  }
})

test("resumen semanal: conserva diferencias negativas y los tres estados observados", () => {
  for (const [direccion, estado, signo] of [
    ["sube", "Progresa", 1],
    ["igual", "Estancado", 0],
    ["baja", "Baja", -1],
  ]) {
    const observado = {
      ...ejercicio(),
      estado,
      comparacion: {
        direccion,
        diferenciaKg: 2.5 * signo,
        diferenciaRepeticiones: signo,
        diferencia1RM: 3.2 * signo,
      },
    }
    assert.equal(
      esquema().safeParse({ ...resumen(), clientes: [{ ...cliente(), ejercicios: [observado] }] })
        .success,
      true,
    )
  }
})

test("serie del resumen: exige fuerza válida y conserva RIR nulo", () => {
  assert.ok(shared.SerieResumenSemanalSchema, "Falta el contrato exportado de la mejor serie")
  assert.deepEqual(shared.SerieResumenSemanalSchema.parse(serie()), serie())
  for (const cambios of [
    { sesionId: "sin-id" },
    { fecha: "2026-02-30" },
    { pesoKg: 0 },
    { pesoKg: 1001 },
    { repeticiones: 0 },
    { repeticiones: 1.5 },
    { repeticiones: 10001 },
    { rir: 6 },
    { estimado1RM: 0 },
  ]) {
    assert.equal(
      shared.SerieResumenSemanalSchema.safeParse({ ...serie(), ...cambios }).success,
      false,
    )
  }
})

test("resumen semanal: rechaza campos privados y vocabulario ajeno al contrato", () => {
  assert.equal(esquema().safeParse({ ...resumen(), borrador: {} }).success, false)
  for (const cambios of [{ borrador: {} }, { passwordHash: "privado" }]) {
    assert.equal(
      esquema().safeParse({ ...resumen(), clientes: [{ ...cliente(), ...cambios }] }).success,
      false,
    )
  }
  for (const cambios of [{ estado: "Sube carga" }, { record: "sí" }]) {
    assert.equal(
      esquema().safeParse({
        ...resumen(),
        clientes: [{ ...cliente(), ejercicios: [{ ...ejercicio(), ...cambios }] }],
      }).success,
      false,
    )
  }
})
