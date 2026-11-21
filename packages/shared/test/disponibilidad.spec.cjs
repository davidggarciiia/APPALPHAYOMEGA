const assert = require("node:assert/strict")
const { test } = require("node:test")
const contratos = require("../dist")

const id = "00000000-0000-4000-8000-000000000001"
const apertura = {
  operacionId: id,
  fecha: "2027-03-21",
  horaInicio: "10:30",
  servicios: ["seguimiento"],
}
function esquema(nombre) {
  assert.ok(contratos[nombre], `Falta exportar ${nombre}`)
  return contratos[nombre]
}

test("disponibilidad: apertura local con duración 60 y una semana por defecto", () => {
  assert.deepEqual(esquema("AbrirHuecosSchema").parse(apertura), {
    ...apertura,
    duracionMinutos: 60,
    semanas: 1,
  })
  assert.equal(
    esquema("AbrirHuecosSchema").parse({ ...apertura, duracionMinutos: 1, semanas: 52 }).semanas,
    52,
  )
  assert.equal(
    esquema("AbrirHuecosSchema").parse({ ...apertura, duracionMinutos: 480 }).duracionMinutos,
    480,
  )
})

test("disponibilidad: rechaza fechas, horas, servicios, límites y campos ajenos", () => {
  for (const cambio of [
    { fecha: "2027-02-29" },
    { fecha: "2027-3-21" },
    { fecha: "0000-01-01" },
    { horaInicio: "24:00" },
    { horaInicio: "9:00" },
    { horaInicio: "10:60" },
    { duracionMinutos: 0 },
    { duracionMinutos: 481 },
    { duracionMinutos: 1.5 },
    { semanas: 0 },
    { semanas: 53 },
    { semanas: "2" },
    { servicios: [] },
    { servicios: ["quiromasaje"] },
    { servicios: ["seguimiento", "seguimiento"] },
    { entrenadorId: id },
    { operacionId: "incorrecto" },
    { estado: "libre" },
  ])
    assert.equal(
      esquema("AbrirHuecosSchema").safeParse({ ...apertura, ...cambio }).success,
      false,
      JSON.stringify(cambio),
    )
  assert.equal(
    esquema("AbrirHuecosSchema").safeParse({
      ...apertura,
      servicios: ["entrenoPersonal", "seguimiento"],
    }).success,
    true,
  )
})

test("disponibilidad: consultas paginadas por rango local de hasta 366 días", () => {
  const rango = { desde: "2027-01-01", hasta: "2027-12-31" }
  assert.deepEqual(esquema("ConsultarHuecosSchema").parse(rango), {
    ...rango,
    limite: 100,
    desplazamiento: 0,
  })
  assert.deepEqual(
    esquema("ConsultarHuecosSchema").parse({ ...rango, limite: "1", desplazamiento: "2" }),
    { ...rango, limite: 1, desplazamiento: 2 },
  )
  for (const cambio of [
    { desde: "2028-01-01" },
    { hasta: "2028-01-03" },
    { limite: 101 },
    { limite: 0 },
    { desplazamiento: -1 },
    { desplazamiento: 100001 },
    { entrenadorId: id },
    { desde: "2027-02-30" },
  ])
    assert.equal(esquema("ConsultarHuecosSchema").safeParse({ ...rango, ...cambio }).success, false)
})

test("disponibilidad: las respuestas conservan identidad, horario local e instantes", () => {
  const hueco = {
    id,
    entrenadorId: id,
    fecha: "2027-03-21",
    horaInicio: "10:30",
    inicioEn: "2027-03-21T09:30:00.000Z",
    finEn: "2027-03-21T10:30:00.000Z",
    duracionMinutos: 60,
    servicios: ["seguimiento"],
    estado: "libre",
    creadoEn: "2026-10-30T12:00:00.000Z",
    cerradoEn: null,
  }
  assert.deepEqual(esquema("HuecoDisponibilidadSchema").parse(hueco), hueco)
  assert.deepEqual(esquema("ListadoHuecosSchema").parse({ huecos: [hueco], total: 1 }), {
    huecos: [hueco],
    total: 1,
  })
  for (const estado of ["libre", "reservado", "cerrado"])
    assert.equal(esquema("HuecoDisponibilidadSchema").safeParse({ ...hueco, estado }).success, true)
  for (const cambio of [
    { id: "no" },
    { clienteId: id },
    { servicios: ["quiromasaje"] },
    { estado: "otro" },
    { inicioEn: "2027-03-21" },
  ])
    assert.equal(
      esquema("HuecoDisponibilidadSchema").safeParse({ ...hueco, ...cambio }).success,
      false,
    )
  assert.equal(esquema("ListadoHuecosSchema").safeParse({ huecos: [], total: -1 }).success, false)
})
