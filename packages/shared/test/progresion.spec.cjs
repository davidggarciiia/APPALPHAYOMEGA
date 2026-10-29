const assert = require("node:assert/strict")
const { test } = require("node:test")
const progresion = require("../dist")

const serie = (cambios = {}) => ({
  serieId: "serie-1",
  tipoMedicion: "repeticiones",
  hecha: true,
  pesoKg: 60,
  repeticiones: 10,
  rir: 2,
  ...cambios,
})

test("mejor serie: más kg, con las reps como desempate, conserva el registro y el orden", () => {
  assert.equal(typeof progresion.mejorSerieDeSesion, "function")
  const ganadora = Object.freeze(serie({ serieId: "ganadora", pesoKg: 65, repeticiones: 8 }))
  const series = Object.freeze([
    Object.freeze(serie({ repeticiones: 20 })),
    ganadora,
    Object.freeze(serie({ pesoKg: 65, repeticiones: 7 })),
  ])
  assert.equal(progresion.mejorSerieDeSesion(series), ganadora)
  assert.equal(series[1], ganadora)
})

test("mejor serie: excluye pendientes, omitidas, sin carga y otras unidades", () => {
  assert.equal(typeof progresion.mejorSerieDeSesion, "function")
  const valida = serie({ pesoKg: 20 })
  const descartadas = [
    serie({ hecha: false }),
    serie({ omitida: true }),
    serie({ pesoKg: null }),
    serie({ pesoKg: 0 }),
    serie({ repeticiones: null }),
    serie({ repeticiones: 0 }),
    { serieId: "tiempo", hecha: true, tipoMedicion: "tiempo", pesoKg: 100, segundos: 60 },
    { serieId: "distancia", hecha: true, tipoMedicion: "distancia", pesoKg: 100, metros: 20 },
  ]
  assert.equal(progresion.mejorSerieDeSesion([...descartadas, valida]), valida)
  assert.equal(progresion.mejorSerieDeSesion(descartadas), null)
  assert.equal(progresion.mejorSerieDeSesion([]), null)
})

test("mejor serie: empates conservan la primera serie y no usan el RIR", () => {
  assert.equal(typeof progresion.mejorSerieDeSesion, "function")
  const primera = serie({ rir: 0 })
  assert.equal(progresion.mejorSerieDeSesion([primera, serie({ rir: 5 })]), primera)
})

test("mejor semana: lunes UTC incluido y lunes siguiente excluido, incluso al cambiar de mes", () => {
  assert.equal(typeof progresion.mejorSerieDeSemana, "function")
  const ganadora = serie({ pesoKg: 70 })
  const sesiones = Object.freeze([
    Object.freeze({ fecha: "2026-11-02T00:00:00.000Z", series: [serie({ pesoKg: 100 })] }),
    Object.freeze({ fecha: "2026-10-25T23:59:59.999Z", series: [serie({ pesoKg: 100 })] }),
    Object.freeze({ fecha: "2026-11-01T23:59:59.999Z", series: [ganadora] }),
    Object.freeze({ fecha: "2026-10-26T00:00:00.000Z", series: [serie()] }),
  ])
  assert.equal(progresion.mejorSerieDeSemana(sesiones, "2026-10-26"), ganadora)
  assert.equal(sesiones[0].fecha, "2026-11-02T00:00:00.000Z")
  assert.equal(progresion.mejorSerieDeSemana([sesiones[3]], "2026-10-26"), sesiones[3].series[0])
})

test("mejor semana: compara instantes UTC y desempata por la sesión más antigua", () => {
  assert.equal(typeof progresion.mejorSerieDeSemana, "function")
  const primera = serie({ serieId: "primera" })
  const sesiones = [
    { fecha: "2026-10-26T01:00:00Z", series: [serie({ serieId: "posterior" })] },
    { fecha: "2026-10-26T01:00:00+01:00", series: [primera] },
    { fecha: "2026-10-26T00:30:00+01:00", series: [serie({ pesoKg: 100 })] },
  ]
  assert.equal(progresion.mejorSerieDeSemana(sesiones, "2026-10-26"), primera)
  assert.equal(progresion.mejorSerieDeSemana(sesiones.toReversed(), "2026-10-26"), primera)
})

test("mejor semana: sin datos válidos o sin lunes válido devuelve null", () => {
  assert.equal(typeof progresion.mejorSerieDeSemana, "function")
  assert.equal(progresion.mejorSerieDeSemana([], "2026-10-26"), null)
  assert.equal(
    progresion.mejorSerieDeSemana([{ fecha: "fecha inválida", series: [serie()] }], "2026-10-26"),
    null,
  )
  for (const semana of ["2026-10-27", "2026-02-30", "inválida"]) {
    assert.equal(
      progresion.mejorSerieDeSemana([{ fecha: "2026-10-26", series: [serie()] }], semana),
      null,
    )
  }
})

test("1RM: Epley redondeado a décima conserva las repeticiones e ignora el RIR", () => {
  assert.equal(typeof progresion.estimar1RM, "function")
  assert.equal(progresion.estimar1RM(serie({ pesoKg: 62.5, repeticiones: 8, rir: 0 })), 79.2)
  assert.equal(progresion.estimar1RM(serie({ pesoKg: 62.5, repeticiones: 8, rir: 5 })), 79.2)
  assert.equal(
    progresion.estimar1RM({ tipoMedicion: "repeticiones", pesoKg: 60, repeticiones: 10 }),
    80,
  )
  assert.equal(progresion.estimar1RM(serie({ pesoKg: 60, repeticiones: 1 })), 62)
})

test("1RM: datos ausentes, pendientes, omitidos, carga cero y otras unidades no aplican", () => {
  assert.equal(typeof progresion.estimar1RM, "function")
  for (const valores of [
    undefined,
    null,
    serie({ pesoKg: null }),
    serie({ pesoKg: 0 }),
    serie({ repeticiones: null }),
    serie({ repeticiones: 0 }),
    serie({ hecha: false }),
    serie({ omitida: true }),
    { tipoMedicion: "tiempo", pesoKg: 100, segundos: 30 },
    { tipoMedicion: "distancia", pesoKg: 100, metros: 30 },
  ]) {
    assert.equal(progresion.estimar1RM(valores), null)
  }
})

test("comparación semanal: carga y repeticiones dirigen, las diferencias mantienen su signo", () => {
  assert.equal(typeof progresion.compararSemanas, "function")
  assert.deepEqual(progresion.compararSemanas(serie({ pesoKg: 62.5 }), serie()), {
    direccion: "sube",
    diferenciaKg: 2.5,
    diferenciaRepeticiones: 0,
    diferencia1RM: 3.3,
  })
  assert.deepEqual(progresion.compararSemanas(serie({ repeticiones: 9 }), serie()), {
    direccion: "baja",
    diferenciaKg: 0,
    diferenciaRepeticiones: -1,
    diferencia1RM: -2,
  })
  assert.deepEqual(progresion.compararSemanas(serie({ rir: 0 }), serie({ rir: 5 })), {
    direccion: "igual",
    diferenciaKg: 0,
    diferenciaRepeticiones: 0,
    diferencia1RM: 0,
  })
  assert.equal(progresion.compararSemanas(serie({ repeticiones: 11 }), serie()).direccion, "sube")
  assert.equal(
    progresion.compararSemanas(serie({ pesoKg: 62.5, repeticiones: 1 }), serie()).direccion,
    "sube",
  )
  assert.equal(
    progresion.compararSemanas(serie({ pesoKg: 57.5, repeticiones: 20 }), serie()).direccion,
    "baja",
  )
})

test("comparación semanal: no inventa cero cuando falta alguna semana o fuerza válida", () => {
  assert.equal(typeof progresion.compararSemanas, "function")
  for (const ausente of [null, serie({ pesoKg: null }), serie({ hecha: false })]) {
    assert.equal(progresion.compararSemanas(ausente, serie()), null)
    assert.equal(progresion.compararSemanas(serie(), ausente), null)
  }
  assert.equal(progresion.compararSemanas(null, null), null)
})

test("comparación semanal: normaliza las diferencias con cargas decimales", () => {
  assert.equal(
    progresion.compararSemanas(serie({ pesoKg: 10.2 }), serie({ pesoKg: 10.1 })).diferenciaKg,
    0.1,
  )
  assert.equal(
    progresion.compararSemanas(serie({ pesoKg: 10.1 }), serie({ pesoKg: 10.2 })).diferenciaKg,
    -0.1,
  )
})

const sesionesConSeries = (...series) =>
  series.map((s, indice) => ({
    fecha: `2026-10-${String(20 + indice).padStart(2, "0")}`,
    series: s,
  }))

test("estado: progresa con más kg o con más reps a los mismos kg", () => {
  assert.equal(typeof progresion.estadoDeProgresion, "function")
  assert.equal(
    progresion.estadoDeProgresion(
      sesionesConSeries([serie()], [serie({ pesoKg: 62.5, repeticiones: 6 })]),
    ),
    "Progresa",
  )
  assert.equal(
    progresion.estadoDeProgresion(sesionesConSeries([serie()], [serie({ repeticiones: 11 })])),
    "Progresa",
  )
  assert.equal(
    progresion.estadoDeProgresion(
      sesionesConSeries([serie()], [serie({ pesoKg: 57.5, repeticiones: 20 })]),
    ),
    null,
  )
})

test("estado: estancado exige las últimas tres sesiones iguales e ignora el RIR", () => {
  assert.equal(typeof progresion.estadoDeProgresion, "function")
  assert.equal(progresion.estadoDeProgresion(sesionesConSeries([serie()], [serie()])), null)
  assert.equal(
    progresion.estadoDeProgresion(
      sesionesConSeries([serie({ rir: 5 })], [serie()], [serie({ rir: 0 })]),
    ),
    "Estancado",
  )
  assert.equal(
    progresion.estadoDeProgresion(
      sesionesConSeries([serie()], [serie()], [serie({ repeticiones: 9 })]),
    ),
    null,
  )
})

test("estado: baja exige dos descensos consecutivos y se restablece cuando deja de bajar", () => {
  assert.equal(typeof progresion.estadoDeProgresion, "function")
  const descenso = sesionesConSeries([serie({ pesoKg: 70 })], [serie({ pesoKg: 65 })], [serie()])
  assert.equal(progresion.estadoDeProgresion(descenso), "Baja")
  assert.equal(
    progresion.estadoDeProgresion(
      sesionesConSeries([serie()], [serie({ repeticiones: 9 })], [serie({ repeticiones: 8 })]),
    ),
    "Baja",
  )
  assert.equal(progresion.estadoDeProgresion(descenso.slice(0, 2)), null)
  assert.equal(
    progresion.estadoDeProgresion([...descenso, { fecha: "2026-10-25", series: [serie()] }]),
    null,
  )
})

test("estado: ordena una copia por fecha y usa la mejor serie de cada sesión", () => {
  assert.equal(typeof progresion.estadoDeProgresion, "function")
  const sesiones = Object.freeze(
    sesionesConSeries([serie({ pesoKg: 55 }), serie()], [serie({ pesoKg: 62.5 })])
      .toReversed()
      .map(Object.freeze),
  )
  assert.equal(progresion.estadoDeProgresion(sesiones), "Progresa")
  assert.equal(sesiones[0].fecha, "2026-10-21")
})

test("estado: historial insuficiente o una sesión sin fuerza válida no crea una tendencia", () => {
  assert.equal(typeof progresion.estadoDeProgresion, "function")
  assert.equal(progresion.estadoDeProgresion([]), null)
  assert.equal(progresion.estadoDeProgresion(sesionesConSeries([serie()])), null)
  assert.equal(progresion.estadoDeProgresion(sesionesConSeries([serie()], [], [serie()])), null)
  assert.equal(
    progresion.estadoDeProgresion(
      sesionesConSeries([serie()], [serie()], [serie({ hecha: false })]),
    ),
    null,
  )
})

const ejercicio = (cambios = {}) => ({
  id: "prescrito-1",
  ejercicioId: "ejercicio-1",
  nombre: "Press banca",
  indicaciones: null,
  tipoCarga: "conCargaExterna",
  modoRir: "cadaSerie",
  rir: { min: 2, max: 3 },
  subidaKg: 1.25,
  series: [
    {
      id: "serie-1",
      tipoMedicion: "repeticiones",
      pesoKg: 60,
      repeticiones: 8,
      repeticionesMax: 10,
    },
    {
      id: "serie-2",
      tipoMedicion: "repeticiones",
      pesoKg: 60,
      repeticiones: 8,
      repeticionesMax: 10,
    },
  ],
  ...cambios,
})
const seriesCompletas = () => [serie(), serie({ serieId: "serie-2" })]

test("sugerencia: todas las series al tope y RIR mínimo cumplido usan la subida prescrita", () => {
  assert.equal(typeof progresion.sugerenciaDeProgresion, "function")
  const prescrita = Object.freeze(ejercicio())
  const completadas = Object.freeze(seriesCompletas().map(Object.freeze))
  assert.deepEqual(progresion.sugerenciaDeProgresion(prescrita, completadas), {
    incrementoKg: 1.25,
  })
  assert.equal(completadas[0].pesoKg, 60)
  assert.deepEqual(
    progresion.sugerenciaDeProgresion(ejercicio(), [
      serie({ repeticiones: 11, rir: 5 }),
      serie({ serieId: "serie-2", rir: 3 }),
    ]),
    { incrementoKg: 1.25 },
  )
})

test("sugerencia: usa el tope propio de cada serie y la dosis fija cuando no hay rango", () => {
  assert.equal(typeof progresion.sugerenciaDeProgresion, "function")
  const prescrita = ejercicio({
    series: [
      {
        id: "serie-1",
        tipoMedicion: "repeticiones",
        pesoKg: 60,
        repeticiones: 8,
        repeticionesMax: 10,
      },
      { id: "serie-2", tipoMedicion: "repeticiones", pesoKg: 60, repeticiones: 6 },
    ],
  })
  assert.deepEqual(
    progresion.sugerenciaDeProgresion(prescrita, [
      serie(),
      serie({ serieId: "serie-2", repeticiones: 6 }),
    ]),
    { incrementoKg: 1.25 },
  )
  assert.equal(
    progresion.sugerenciaDeProgresion(prescrita, [
      serie({ repeticiones: 9 }),
      serie({ serieId: "serie-2" }),
    ]),
    null,
  )
})

for (const [nombre, cambios] of [
  ["pendiente", { hecha: false }],
  ["omitida", { hecha: false, omitida: true }],
  ["reps bajo el tope", { repeticiones: 9 }],
  ["reps nulas", { repeticiones: null }],
  ["carga nula", { pesoKg: null }],
  ["carga cero", { pesoKg: 0 }],
  ["RIR bajo", { rir: 1 }],
  ["RIR nulo", { rir: null }],
  ["RIR ausente", { rir: undefined }],
]) {
  test(`sugerencia: una serie ${nombre} impide la subida`, () => {
    assert.equal(typeof progresion.sugerenciaDeProgresion, "function")
    assert.equal(
      progresion.sugerenciaDeProgresion(ejercicio(), [
        serie(),
        serie({ serieId: "serie-2", ...cambios }),
      ]),
      null,
    )
  })
}

test("sugerencia: no omite prescritas que faltan ni confunde otros ejercicios", () => {
  assert.equal(typeof progresion.sugerenciaDeProgresion, "function")
  assert.equal(progresion.sugerenciaDeProgresion(ejercicio(), [serie()]), null)
  assert.equal(progresion.sugerenciaDeProgresion(ejercicio(), []), null)
  assert.equal(progresion.sugerenciaDeProgresion(ejercicio({ series: [] }), []), null)
  assert.equal(
    progresion.sugerenciaDeProgresion(ejercicio(), [serie(), serie({ serieId: "otra-serie" })]),
    null,
  )
  assert.deepEqual(
    progresion.sugerenciaDeProgresion(ejercicio(), [
      ...seriesCompletas(),
      serie({ serieId: "otro-ejercicio", hecha: false }),
    ]),
    { incrementoKg: 1.25 },
  )
})

test("sugerencia: no sube sin objetivo RIR, sin carga, en calibración, tiempo o distancia", () => {
  assert.equal(typeof progresion.sugerenciaDeProgresion, "function")
  for (const cambios of [{ rir: undefined }, { tipoCarga: "sinCarga" }, { calibrar: true }]) {
    assert.equal(progresion.sugerenciaDeProgresion(ejercicio(cambios), seriesCompletas()), null)
  }
  for (const [tipoMedicion, cantidad] of [
    ["tiempo", { segundos: 30 }],
    ["distancia", { metros: 30 }],
  ]) {
    const prescrita = ejercicio({
      series: [{ id: "serie-1", tipoMedicion, pesoKg: 60, ...cantidad }],
    })
    const realizada = {
      serieId: "serie-1",
      hecha: true,
      pesoKg: 60,
      rir: 2,
      tipoMedicion,
      ...cantidad,
    }
    assert.equal(progresion.sugerenciaDeProgresion(prescrita, [realizada]), null)
    assert.equal(
      progresion.sugerenciaDeProgresion(ejercicio(), [realizada, serie({ serieId: "serie-2" })]),
      null,
    )
  }
})

test("sugerencia: RIR cero o uno cumplen si así lo prescribe el entrenador", () => {
  assert.equal(typeof progresion.sugerenciaDeProgresion, "function")
  for (const min of [0, 1]) {
    assert.deepEqual(
      progresion.sugerenciaDeProgresion(
        ejercicio({ rir: { min, max: min } }),
        seriesCompletas().map((s) => ({ ...s, rir: min })),
      ),
      { incrementoKg: 1.25 },
    )
  }
})

test("sugerencia: RIR final único no acredita todas las series; todos conocidos sí", () => {
  assert.equal(typeof progresion.sugerenciaDeProgresion, "function")
  const prescrita = ejercicio({ modoRir: "alFinalizarEjercicio" })
  assert.equal(
    progresion.sugerenciaDeProgresion(prescrita, [
      serie({ rir: null }),
      serie({ serieId: "serie-2" }),
    ]),
    null,
  )
  assert.deepEqual(progresion.sugerenciaDeProgresion(prescrita, seriesCompletas()), {
    incrementoKg: 1.25,
  })
})

test("sugerencia: sin subida prescrita usa 5 kg inferior y 2,5 kg superior", () => {
  assert.equal(typeof progresion.sugerenciaDeProgresion, "function")
  const prescrita = ejercicio({ subidaKg: undefined })
  for (const grupo of ["gluteos", "cuadriceps", "isquiotibiales", "gemelos"]) {
    assert.deepEqual(progresion.sugerenciaDeProgresion(prescrita, seriesCompletas(), grupo), {
      incrementoKg: 5,
    })
  }
  for (const grupo of ["pecho", "espalda", "hombros", "biceps", "triceps", "antebrazos"]) {
    assert.deepEqual(progresion.sugerenciaDeProgresion(prescrita, seriesCompletas(), grupo), {
      incrementoKg: 2.5,
    })
  }
  assert.equal(progresion.sugerenciaDeProgresion(prescrita, seriesCompletas()), null)
  assert.equal(progresion.sugerenciaDeProgresion(prescrita, seriesCompletas(), "abdomen"), null)
  assert.deepEqual(progresion.sugerenciaDeProgresion(ejercicio(), seriesCompletas(), "abdomen"), {
    incrementoKg: 1.25,
  })
})
