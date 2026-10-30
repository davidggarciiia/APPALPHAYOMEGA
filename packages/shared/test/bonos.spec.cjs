const assert = require("node:assert/strict")
const { test } = require("node:test")
const bonos = require("../dist")

const id = "00000000-0000-4000-8000-000000000001"
const carga = { operacionId: id, servicio: "entrenoPersonal", creditos: 10 }
const ajuste = { ...carga, creditos: -1, motivo: "Correccion de saldo" }
const movimiento = {
  id,
  clienteId: id,
  autorId: id,
  operacionId: id,
  servicio: "entrenoPersonal",
  tipo: "carga",
  cantidad: 10,
  mes: null,
  nota: null,
  creadoEn: "2026-10-30T12:00:00.000Z",
}
const saldo = {
  clienteId: id,
  saldos: [{ servicio: "entrenoPersonal", creditos: 10 }],
  seguimiento: { activo: true, mes: "2026-10", minutosDisponibles: 120 },
}

function esquema(nombre) {
  assert.ok(bonos[nombre], `Falta exportar ${nombre}`)
  return bonos[nombre]
}

test("bonos: distingue servicios del modelo y servicios ofrecidos", () => {
  for (const servicio of ["entrenoPersonal", "seguimiento", "quiromasaje"]) {
    assert.equal(esquema("ServicioReservaSchema").parse(servicio), servicio)
  }
  assert.equal(esquema("ServicioReservaSchema").safeParse("otro").success, false)
  assert.equal(esquema("ServicioConBonoSchema").parse("entrenoPersonal"), "entrenoPersonal")
  for (const servicio of ["seguimiento", "quiromasaje"]) {
    assert.equal(esquema("ServicioConBonoSchema").safeParse(servicio).success, false)
  }
  const servicios = [
    { id: "entrenoPersonal", nombre: "Entreno personal", unidad: "creditos" },
    { id: "seguimiento", nombre: "Seguimiento", unidad: "minutos" },
  ]
  assert.deepEqual(esquema("ListadoServiciosReservaSchema").parse({ servicios }), { servicios })
  for (const cambios of [{ id: "quiromasaje" }, { unidad: "euros" }, { nombre: 1 }]) {
    assert.equal(
      esquema("ServicioDisponibleSchema").safeParse({ ...servicios[0], ...cambios }).success,
      false,
    )
  }
})

test("bonos: carga creditos enteros positivos y limita cada operacion", () => {
  for (const creditos of [1, 10, 1_000_000]) {
    assert.equal(esquema("CargarBonoSchema").parse({ ...carga, creditos }).creditos, creditos)
  }
  for (const creditos of [0, -1, 1.5, 1_000_001, "10", NaN, Infinity]) {
    assert.equal(esquema("CargarBonoSchema").safeParse({ ...carga, creditos }).success, false)
  }
})

test("bonos: la nota de carga es opcional, nullable y se recorta", () => {
  assert.deepEqual(esquema("CargarBonoSchema").parse(carga), carga)
  assert.equal(esquema("CargarBonoSchema").parse({ ...carga, nota: null }).nota, null)
  assert.equal(
    esquema("CargarBonoSchema").parse({ ...carga, nota: "  Efectivo  " }).nota,
    "Efectivo",
  )
  assert.equal(
    esquema("CargarBonoSchema").safeParse({ ...carga, nota: "a".repeat(1000) }).success,
    true,
  )
  for (const nota of ["", "   ", "a".repeat(1001), 1]) {
    assert.equal(esquema("CargarBonoSchema").safeParse({ ...carga, nota }).success, false)
  }
})

test("bonos: los ajustes admiten ambos signos sin cero ni decimales", () => {
  for (const creditos of [-1_000_000, -1, 1, 1_000_000]) {
    assert.equal(esquema("AjustarBonoSchema").parse({ ...ajuste, creditos }).creditos, creditos)
  }
  for (const creditos of [0, 1.5, -1.5, 1_000_001, -1_000_001, "1", NaN, Infinity]) {
    assert.equal(esquema("AjustarBonoSchema").safeParse({ ...ajuste, creditos }).success, false)
  }
})

test("bonos: todo ajuste exige un motivo util de hasta 1000 caracteres", () => {
  assert.equal(
    esquema("AjustarBonoSchema").parse({ ...ajuste, motivo: "  Correccion  " }).motivo,
    "Correccion",
  )
  assert.equal(
    esquema("AjustarBonoSchema").safeParse({ ...ajuste, motivo: "a".repeat(1000) }).success,
    true,
  )
  for (const motivo of [undefined, null, "", "   ", "a".repeat(1001), 1]) {
    assert.equal(esquema("AjustarBonoSchema").safeParse({ ...ajuste, motivo }).success, false)
  }
})

test("bonos: las escrituras rechazan servicios no ofrecidos y campos inyectados", () => {
  for (const [nombre, datos] of [
    ["CargarBonoSchema", carga],
    ["AjustarBonoSchema", ajuste],
  ]) {
    for (const cambios of [
      { servicio: "quiromasaje" },
      { servicio: "seguimiento" },
      { operacionId: "invalido" },
      { clienteId: id },
      { autorId: id },
      { saldo: 1000 },
    ]) {
      assert.equal(esquema(nombre).safeParse({ ...datos, ...cambios }).success, false)
    }
  }
})

test("bonos: seguimiento activo exige un booleano y solo ese campo", () => {
  for (const activo of [true, false]) {
    assert.deepEqual(esquema("CambiarSeguimientoActivoSchema").parse({ activo }), { activo })
  }
  for (const datos of [
    {},
    { activo: "true" },
    { activo: 1 },
    { activo: null },
    { activo: true, clienteId: id },
  ]) {
    assert.equal(esquema("CambiarSeguimientoActivoSchema").safeParse(datos).success, false)
  }
})

test("bonos: el mes usa un ano valido y dos cifras entre 01 y 12", () => {
  for (const mes of ["0001-01", "2026-10", "9999-12"]) {
    assert.equal(esquema("MesBonoSchema").parse(mes), mes)
  }
  for (const mes of [
    "0000-01",
    "2026-00",
    "2026-13",
    "2026-1",
    "26-01",
    "10000-01",
    "2026-10-01",
    null,
  ]) {
    assert.equal(esquema("MesBonoSchema").safeParse(mes).success, false)
  }
})

test("bonos: los movimientos conservan tipo, autor, fecha y cantidades con signo", () => {
  for (const tipo of ["carga", "consumo", "devolucion", "ajuste"]) {
    const datos = { ...movimiento, tipo, cantidad: tipo === "consumo" ? -1 : 1 }
    assert.deepEqual(esquema("MovimientoBonoSchema").parse(datos), datos)
  }
  const seguimiento = {
    ...movimiento,
    servicio: "seguimiento",
    tipo: "consumo",
    cantidad: -60,
    mes: "2026-10",
    nota: "Sesion",
  }
  assert.deepEqual(esquema("MovimientoBonoSchema").parse(seguimiento), seguimiento)
  assert.equal(
    esquema("MovimientoBonoSchema").safeParse({ ...movimiento, servicio: "quiromasaje" }).success,
    true,
  )
  for (const cambios of [
    { cantidad: 0 },
    { cantidad: 1.5 },
    { cantidad: "1" },
    { tipo: "borrado" },
    { servicio: "otro" },
    { creadoEn: "2026-10-30" },
    { creadoEn: "invalido" },
    { mes: "2026-13" },
    { nota: 1 },
    { saldo: 20 },
  ]) {
    assert.equal(
      esquema("MovimientoBonoSchema").safeParse({ ...movimiento, ...cambios }).success,
      false,
    )
  }
  for (const campo of ["id", "clienteId", "autorId", "operacionId"]) {
    assert.equal(
      esquema("MovimientoBonoSchema").safeParse({ ...movimiento, [campo]: "invalido" }).success,
      false,
    )
  }
})

test("bonos: el signo del movimiento corresponde a su tipo", () => {
  for (const cantidad of [-5, 5]) {
    assert.equal(
      esquema("MovimientoBonoSchema").safeParse({ ...movimiento, tipo: "ajuste", cantidad })
        .success,
      true,
    )
  }
  for (const [tipo, cantidad] of [
    ["carga", -1],
    ["devolucion", -1],
    ["consumo", 1],
  ]) {
    assert.equal(
      esquema("MovimientoBonoSchema").safeParse({ ...movimiento, tipo, cantidad }).success,
      false,
    )
  }
})

test("bonos: solo los movimientos de seguimiento exigen un mes", () => {
  assert.equal(
    esquema("MovimientoBonoSchema").safeParse({
      ...movimiento,
      servicio: "seguimiento",
      tipo: "consumo",
      cantidad: -60,
      mes: null,
    }).success,
    false,
  )
  for (const servicio of ["entrenoPersonal", "quiromasaje"]) {
    assert.equal(
      esquema("MovimientoBonoSchema").safeParse({ ...movimiento, servicio, mes: "2026-10" })
        .success,
      false,
    )
  }
})

test("bonos: cada carga de seguimiento aporta exactamente 120 minutos", () => {
  const mensual = { ...movimiento, servicio: "seguimiento", mes: "2026-10", cantidad: 120 }
  assert.deepEqual(esquema("MovimientoBonoSchema").parse(mensual), mensual)
  for (const [tipo, cantidad] of [
    ["consumo", -60],
    ["devolucion", 60],
    ["ajuste", -60],
    ["ajuste", 60],
  ]) {
    assert.equal(
      esquema("MovimientoBonoSchema").safeParse({ ...mensual, tipo, cantidad }).success,
      true,
    )
  }
  for (const cantidad of [-120, 0, 1, 60, 119, 121, 240]) {
    assert.equal(esquema("MovimientoBonoSchema").safeParse({ ...mensual, cantidad }).success, false)
  }
})

test("bonos: el saldo expone creditos no negativos y cupo mensual de 0 a 120 minutos", () => {
  assert.deepEqual(esquema("SaldoBonosSchema").parse(saldo), saldo)
  assert.equal(esquema("SaldoBonosSchema").safeParse({ ...saldo, saldos: [] }).success, true)
  for (const creditos of [0, 1_000_001]) {
    assert.equal(
      esquema("SaldoBonosSchema").safeParse({
        ...saldo,
        saldos: [{ servicio: "entrenoPersonal", creditos }],
      }).success,
      true,
    )
  }
  for (const minutosDisponibles of [0, 1, 120]) {
    assert.equal(
      esquema("SaldoBonosSchema").safeParse({
        ...saldo,
        seguimiento: { ...saldo.seguimiento, minutosDisponibles },
      }).success,
      true,
    )
  }
  for (const minutosDisponibles of [-1, 121, 1.5, "60"]) {
    assert.equal(
      esquema("SaldoBonosSchema").safeParse({
        ...saldo,
        seguimiento: { ...saldo.seguimiento, minutosDisponibles },
      }).success,
      false,
    )
  }
  for (const saldos of [
    [{ servicio: "entrenoPersonal", creditos: -1 }],
    [{ servicio: "entrenoPersonal", creditos: 0.5 }],
    [{ servicio: "quiromasaje", creditos: 1 }],
    [{ servicio: "seguimiento", creditos: 1 }],
    [{ servicio: "entrenoPersonal", creditos: 1, autorId: id }],
  ]) {
    assert.equal(esquema("SaldoBonosSchema").safeParse({ ...saldo, saldos }).success, false)
  }
  for (const seguimiento of [
    { ...saldo.seguimiento, mes: "2026-00" },
    { ...saldo.seguimiento, activo: "true" },
    { ...saldo.seguimiento, autorId: id },
  ]) {
    assert.equal(esquema("SaldoBonosSchema").safeParse({ ...saldo, seguimiento }).success, false)
  }
  for (const cambios of [{ clienteId: "invalido" }, { autorId: id }]) {
    assert.equal(esquema("SaldoBonosSchema").safeParse({ ...saldo, ...cambios }).success, false)
  }
})

test("bonos: pagina los movimientos con valores por defecto y limites acotados", () => {
  assert.deepEqual(esquema("ConsultarMovimientosBonoSchema").parse({}), {
    limite: 30,
    desplazamiento: 0,
  })
  assert.deepEqual(
    esquema("ConsultarMovimientosBonoSchema").parse({ limite: "100", desplazamiento: "100000" }),
    { limite: 100, desplazamiento: 100000 },
  )
  assert.deepEqual(
    esquema("ConsultarMovimientosBonoSchema").parse({ limite: "1", desplazamiento: "0" }),
    { limite: 1, desplazamiento: 0 },
  )
  for (const datos of [
    { limite: 0 },
    { limite: 101 },
    { limite: 1.5 },
    { limite: "otro" },
    { desplazamiento: -1 },
    { desplazamiento: 100001 },
    { desplazamiento: 0.5 },
    { clienteId: id },
  ]) {
    assert.equal(esquema("ConsultarMovimientosBonoSchema").safeParse(datos).success, false)
  }
})

test("bonos: el listado de movimientos valida filas y total sin filtrar campos", () => {
  const listado = { movimientos: [movimiento], total: 1 }
  assert.deepEqual(esquema("ListadoMovimientosBonoSchema").parse(listado), listado)
  assert.deepEqual(esquema("ListadoMovimientosBonoSchema").parse({ movimientos: [], total: 0 }), {
    movimientos: [],
    total: 0,
  })
  for (const cambios of [
    { total: -1 },
    { total: 0.5 },
    { total: "1" },
    { clienteId: id },
    { movimientos: [{ ...movimiento, cantidad: 0 }] },
  ]) {
    assert.equal(
      esquema("ListadoMovimientosBonoSchema").safeParse({ ...listado, ...cambios }).success,
      false,
    )
  }
})
