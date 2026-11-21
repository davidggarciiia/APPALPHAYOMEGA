const { test } = require("node:test")
const assert = require("node:assert/strict")
const {
  AsignarReservaSchema,
  CancelarReservaSchema,
  MarcarAsistenciaReservaSchema,
  ConsultarReservasSchema,
} = require("../dist")

const id = "11111111-1111-4111-8111-111111111111"
test("reservas: solo servicios ofrecidos y datos de asignación, sin saldo ni autor inyectados", () => {
  const datos = { operacionId: id, huecoId: id, clienteId: id, servicio: "entrenoPersonal" }
  assert.equal(AsignarReservaSchema.safeParse(datos).success, true)
  assert.equal(AsignarReservaSchema.safeParse({ ...datos, servicio: "seguimiento" }).success, true)
  for (const cambio of [
    { servicio: "quiromasaje" },
    { autorId: id },
    { cantidad: 0 },
    { clienteId: "x" },
  ])
    assert.equal(AsignarReservaSchema.safeParse({ ...datos, ...cambio }).success, false)
})
test("reservas: cancelación exige decisión explícita y asistencia un booleano", () => {
  assert.equal(CancelarReservaSchema.safeParse({ devolver: false }).success, true)
  assert.equal(CancelarReservaSchema.safeParse({ devolver: true }).success, true)
  for (const datos of [{}, { devolver: "sí" }, { devolver: true, cantidad: 2 }])
    assert.equal(CancelarReservaSchema.safeParse(datos).success, false)
  assert.equal(MarcarAsistenciaReservaSchema.safeParse({ asistio: false }).success, true)
  assert.equal(MarcarAsistenciaReservaSchema.safeParse({ asistio: true }).success, true)
  assert.equal(MarcarAsistenciaReservaSchema.safeParse({ asistio: null }).success, false)
})
test("reservas: consultas acotadas y paginadas", () => {
  assert.deepEqual(ConsultarReservasSchema.parse({ desde: "2099-01-01", hasta: "2099-01-31" }), {
    desde: "2099-01-01",
    hasta: "2099-01-31",
    limite: 100,
    desplazamiento: 0,
  })
  for (const cambio of [
    { hasta: "2098-12-31" },
    { hasta: "2100-01-02" },
    { limite: 101 },
    { clienteId: id },
  ])
    assert.equal(
      ConsultarReservasSchema.safeParse({ desde: "2099-01-01", hasta: "2099-01-31", ...cambio })
        .success,
      false,
    )
})
