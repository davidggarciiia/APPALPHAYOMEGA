/* global URL, fetch, structuredClone -- Node 22 los trae de serie */
// Recorrido F09 (tasks/iteracion-3/pruebas-entrenamiento-fable.md) contra una API en marcha.
//
//   npm run build --workspace apps/api
//   node tasks/iteracion-3/recorrido-f09.mjs          # API en http://localhost:$API_PORT (3000)
//   RECORRIDO_API=http://localhost:3101 node tasks/iteracion-3/recorrido-f09.mjs
//
// Crea tres cuentas sintéticas (@recorrido-f09.test) y ejercicios con prefijo
// "recorrido-f09" en una base dedicada (_e2e_, _manual_, _test o _review_), recorre catálogo → rutina → plan → agenda →
// registro → resultado y borra solo lo suyo al final, como las pruebas e2e. No toca
// otras cuentas ni imprime tokens, contraseñas o datos de clientes.
import { randomBytes, randomUUID } from "node:crypto"
import { fileURLToPath } from "node:url"

const REPO = new URL("../../", import.meta.url)
const RAIZ = new URL("apps/api/dist/", REPO).href
process.chdir(fileURLToPath(REPO))
const { cargarEntornoLocal } = await import(RAIZ + "config/entorno.js")
cargarEntornoLocal()

if (
  process.env.NODE_ENV === "production" ||
  !/_(?:e2e_|manual_|test(?:_|$)|review_)/.test(process.env.POSTGRES_DB ?? "")
) {
  throw new Error("El recorrido necesita una base dedicada y nunca se ejecuta en producción")
}

// Fechas relativas a hoy en Madrid: el plan empieza el lunes de esta semana.
const DIA = 86_400_000
const hoyMadrid = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid" }).format(new Date())
const lunes = new Date(
  Date.parse(`${hoyMadrid}T00:00:00Z`) -
    ((new Date(`${hoyMadrid}T00:00:00Z`).getUTCDay() + 6) % 7) * DIA,
)
const fecha = (dias) => new Date(lunes.getTime() + dias * DIA).toISOString().slice(0, 10)
const { PrismaService } = await import(RAIZ + "prisma/prisma.service.js")
const { cifrarContrasena } = await import(RAIZ + "identity/contrasenas.js")

const API = process.env.RECORRIDO_API ?? `http://localhost:${process.env.API_PORT ?? "3000"}`
const SUFIJO = "@recorrido-f09.test"
const PREFIJO = "recorrido-f09"
const prisma = new PrismaService()
const informe = []
let fallos = 0
const anotar = (paso, ok, detalle = "") => {
  if (!ok) fallos++
  informe.push(`${ok ? "OK " : "MAL"} ${paso}${detalle ? " · " + detalle : ""}`)
}
const tokens = {}
const ids = {}

async function pedir(rol, metodo, ruta, cuerpo) {
  const r = await fetch(API + ruta, {
    method: metodo,
    headers: {
      ...(rol ? { Authorization: `Bearer ${tokens[rol]}` } : {}),
      "Content-Type": "application/json",
    },
    body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
  })
  const texto = await r.text()
  let body = null
  try {
    body = texto ? JSON.parse(texto) : null
  } catch {
    body = texto
  }
  return { status: r.status, body }
}

async function limpiar() {
  const usuarios = await prisma.usuario.findMany({
    where: { email: { endsWith: SUFIJO } },
    select: { id: true },
  })
  const uid = usuarios.map((u) => u.id)
  const sesiones = await prisma.sesionProgramada.findMany({
    where: { clienteId: { in: uid } },
    select: { id: true },
  })
  const sesionId = { in: sesiones.map((s) => s.id) }
  const ejercicios = { nombreNormalizado: { startsWith: PREFIJO } }
  await prisma.$transaction([
    prisma.lecturaNovedad.deleteMany({ where: { novedad: { sesionId } } }),
    prisma.novedadEntrenamiento.deleteMany({ where: { sesionId } }),
    prisma.operacionEntrenamiento.deleteMany({ where: { sesionId } }),
    prisma.referenciaEjercicio.deleteMany({ where: { sesionId } }),
    prisma.cambioDeFecha.deleteMany({ where: { sesionId } }),
    prisma.sesionEntrenamiento.deleteMany({ where: { id: sesionId } }),
    prisma.sesionProgramada.deleteMany({ where: { id: sesionId } }),
    prisma.planEntrenamiento.deleteMany({ where: { clienteId: { in: uid } } }),
    prisma.rutinaGuardada.deleteMany({ where: { creadorId: { in: uid } } }),
    prisma.contenidoDeEjercicio.deleteMany({ where: { ejercicio: ejercicios } }),
    prisma.ejercicio.deleteMany({ where: ejercicios }),
    prisma.usuario.deleteMany({ where: { id: { in: uid } } }),
  ])
}

try {
  await limpiar()
  const clave = randomBytes(18).toString("base64url")
  const passwordHash = await cifrarContrasena(clave)
  for (const [nombre, rol] of [
    ["entrenador", "entrenador"],
    ["ana", "cliente"],
    ["bruno", "cliente"],
  ]) {
    const email = `${nombre}${SUFIJO}`
    const u = await prisma.usuario.create({
      data: { email, nombre: `Recorrido ${nombre}`, passwordHash, rol, estado: "activo" },
    })
    ids[nombre] = u.id
    const r = await pedir(null, "POST", "/auth/login", { email, contrasena: clave })
    tokens[nombre] = r.body.tokenAcceso
  }

  // 1. Catálogo: crear, buscar, editar, retirar, reponer y figura.
  let r = await pedir("entrenador", "POST", "/ejercicios", {
    nombre: `${PREFIJO} sentadilla`,
    grupoPrincipal: "cuadriceps",
    gruposSecundarios: ["gluteos"],
    instrucciones: "Baja controlando.",
  })
  ids.sentadilla = r.body.id
  anotar("catálogo: crear sentadilla", r.status === 201)
  r = await pedir("entrenador", "POST", "/ejercicios", {
    nombre: `${PREFIJO} plancha`,
    grupoPrincipal: "abdomen",
    gruposSecundarios: [],
    instrucciones: "Cuerpo recto.",
  })
  ids.plancha = r.body.id
  r = await pedir("entrenador", "POST", "/ejercicios", {
    nombre: `${PREFIJO}  SENTADILLA`,
    grupoPrincipal: "cuadriceps",
    gruposSecundarios: [],
    instrucciones: "x",
  })
  anotar(
    "catálogo: nombre repetido rechazado",
    r.status === 409 && r.body.codigo === "nombre_duplicado",
    String(r.status),
  )
  r = await pedir("ana", "GET", `/ejercicios?buscar=${PREFIJO}`)
  anotar(
    "catálogo: el cliente busca y encuentra 2",
    r.status === 200 && r.body.total === 2,
    `total ${r.body.total}`,
  )
  r = await pedir("entrenador", "PATCH", `/ejercicios/${ids.sentadilla}`, {
    nombre: `${PREFIJO} sentadilla`,
    grupoPrincipal: "cuadriceps",
    gruposSecundarios: ["gluteos", "isquiotibiales"],
    instrucciones: "Baja controlando, rodillas hacia fuera.",
  })
  anotar("catálogo: editar ficha", r.status === 200 && r.body.gruposSecundarios.length === 2)
  r = await pedir("entrenador", "PUT", `/ejercicios/${ids.sentadilla}/figura`, {
    medioId: "vital-0054",
  })
  anotar("catálogo: asignar figura", r.status === 200 && r.body.figura?.medioId === "vital-0054")
  r = await pedir("entrenador", "POST", `/ejercicios/${ids.plancha}/retirar`)
  const retirada = await pedir("ana", "GET", `/ejercicios?buscar=${PREFIJO}`)
  const todos = await pedir("ana", "GET", `/ejercicios?buscar=${PREFIJO}&estado=todos`)
  anotar(
    "catálogo: retirar oculta al cliente y no le deja pedir retirados",
    r.status === 200 && retirada.body.total === 1 && todos.status === 403,
    `publicados ${retirada.body.total}, todos→${todos.status}`,
  )
  r = await pedir("entrenador", "POST", `/ejercicios/${ids.plancha}/reponer`)
  const repuesta = await pedir("ana", "GET", `/ejercicios?buscar=${PREFIJO}`)
  anotar("catálogo: reponer", r.status === 200 && repuesta.body.total === 2)

  // 2. Rutina guardada, reutilizada y adaptada.
  const serieReps = () => ({
    id: randomUUID(),
    tipoMedicion: "repeticiones",
    pesoKg: 40,
    repeticiones: 8,
  })
  const patron = {
    sesiones: [
      {
        id: randomUUID(),
        nombre: "Pierna y core",
        diaSemana: 4,
        ejercicios: [
          {
            id: randomUUID(),
            ejercicioId: ids.sentadilla,
            indicaciones: "Tempo 3-1-1",
            series: [serieReps(), serieReps()],
          },
          {
            id: randomUUID(),
            ejercicioId: ids.plancha,
            indicaciones: null,
            series: [{ id: randomUUID(), tipoMedicion: "tiempo", pesoKg: null, segundos: 30 }],
          },
        ],
      },
    ],
  }
  r = await pedir("entrenador", "POST", "/entrenamiento/rutinas", {
    nombre: `${PREFIJO} base`,
    patron,
  })
  const rutina = r.body
  anotar("rutinas: guardar", r.status === 201, String(r.status))
  r = await pedir("entrenador", "GET", `/entrenamiento/rutinas?buscar=${PREFIJO}`)
  anotar("rutinas: buscar", r.status === 200 && r.body.total === 1)
  r = await pedir("ana", "GET", "/entrenamiento/rutinas")
  anotar("rutinas: el cliente no las ve", r.status === 403, String(r.status))

  // Asignar a Ana 2 semanas y a Bruno 1 semana con la misma rutina.
  const planAna = {
    operacionId: randomUUID(),
    nombre: "Bloque Ana",
    semanaInicial: fecha(0),
    semanas: 2,
    patron: rutina.patron,
  }
  r = await pedir("entrenador", "POST", `/entrenamiento/clientes/${ids.ana}/planes`, planAna)
  anotar(
    "plan: asignar 2 semanas a Ana",
    r.status === 201 && r.body.sesiones.length === 2,
    `${r.status}, ${r.body.sesiones?.length} sesiones`,
  )
  const sesionesAna = r.body.sesiones
  const repetido = await pedir(
    "entrenador",
    "POST",
    `/entrenamiento/clientes/${ids.ana}/planes`,
    planAna,
  )
  anotar(
    "plan: repetir la misma operación no duplica",
    [200, 201].includes(repetido.status) && repetido.body.id === r.body.id,
    String(repetido.status),
  )
  r = await pedir("entrenador", "POST", `/entrenamiento/clientes/${ids.bruno}/planes`, {
    operacionId: randomUUID(),
    nombre: "Bloque Bruno",
    semanaInicial: fecha(0),
    semanas: 1,
    patron: rutina.patron,
  })
  anotar("plan: asignar 1 semana a Bruno", r.status === 201 && r.body.sesiones.length === 1)
  const sesionBruno = r.body.sesiones[0].agenda.id

  // Adaptar la rutina guardada después: no toca lo ya asignado.
  const adaptada = structuredClone(rutina.patron)
  adaptada.sesiones[0].ejercicios[0].series.push(serieReps())
  r = await pedir("entrenador", "PATCH", `/entrenamiento/rutinas/${rutina.id}`, {
    nombre: `${PREFIJO} base`,
    patron: adaptada,
    revision: rutina.revision,
  })
  const hoy = sesionesAna.find((s) => s.agenda.fechaOriginal === fecha(3)).agenda.id
  const leida = await pedir("entrenador", "GET", `/entrenamiento/sesiones/${hoy}`)
  anotar(
    "rutinas: adaptar la guardada no altera sesiones ya asignadas",
    r.status === 200 && leida.body.prescripcion.ejercicios[0].series.length === 2,
    `patch ${r.status}, series ${leida.body.prescripcion?.ejercicios[0].series.length}`,
  )

  // Ajuste puntual de la prescripción de una sesión de Ana: no toca a Bruno.
  const pres = leida.body.prescripcion
  r = await pedir("entrenador", "PATCH", `/entrenamiento/sesiones/${hoy}/prescripcion`, {
    revisionPrescripcion: leida.body.revisionPrescripcion,
    nombre: pres.nombre,
    ejercicios: pres.ejercicios.map(({ nombre: _n, ...resto }) => ({
      ...resto,
      series: resto.series.map((s) =>
        s.tipoMedicion === "repeticiones" ? { ...s, pesoKg: 45 } : s,
      ),
    })),
  })
  const deBruno = await pedir("entrenador", "GET", `/entrenamiento/sesiones/${sesionBruno}`)
  anotar(
    "sesión: ajustar la de Ana no cambia la de Bruno",
    r.status === 200 && deBruno.body.prescripcion.ejercicios[0].series[0].pesoKg === 40,
    `patch ${r.status}, Bruno ${deBruno.body.prescripcion?.ejercicios[0].series[0].pesoKg} kg`,
  )

  // 3. Agenda: Ana mueve la sesión de la semana siguiente; el entrenador lo ve.
  const siguiente = sesionesAna.find((s) => s.agenda.fechaOriginal === fecha(10)).agenda
  r = await pedir("ana", "PATCH", `/agenda/sesiones/${siguiente.id}/fecha`, {
    fecha: fecha(11),
    revision: siguiente.revision,
  })
  anotar(
    "agenda: Ana mueve el día",
    r.status === 200 && r.body.fechaActual === fecha(11),
    String(r.status),
  )
  const vistaEntrenador = await pedir(
    "entrenador",
    "GET",
    `/entrenamiento/sesiones/${siguiente.id}`,
  )
  const cambios = await pedir("entrenador", "GET", `/agenda/sesiones/${siguiente.id}/cambios`)
  anotar(
    "agenda: el entrenador ve la fecha nueva y quién la cambió",
    vistaEntrenador.body.agenda?.fechaActual === fecha(11) &&
      cambios.body.cambios?.[0]?.autorId === ids.ana,
  )
  r = await pedir("bruno", "GET", `/entrenamiento/sesiones/${siguiente.id}`)
  anotar(
    "agenda: otro cliente no ve la sesión de Ana",
    [403, 404].includes(r.status),
    String(r.status),
  )

  // 4. Registro: borrador privado y envío.
  const sesionAna = await pedir("ana", "GET", `/entrenamiento/sesiones/${hoy}`)
  const p = sesionAna.body.prescripcion
  const [s1, s2] = p.ejercicios[0].series
  const [t1] = p.ejercicios[1].series
  const registro = {
    series: [
      { serieId: s1.id, tipoMedicion: "repeticiones", pesoKg: 45, repeticiones: 8, hecha: true },
      {
        serieId: s2.id,
        tipoMedicion: "repeticiones",
        pesoKg: null,
        repeticiones: null,
        hecha: false,
      },
      { serieId: t1.id, tipoMedicion: "tiempo", pesoKg: null, segundos: 35, hecha: true },
    ],
    notas: "Recorrido sintético",
  }
  const revPres = sesionAna.body.revisionPrescripcion
  r = await pedir("ana", "PUT", `/entrenamiento/sesiones/${hoy}/borrador`, {
    operacionId: randomUUID(),
    revisionPrescripcion: revPres,
    revisionBorrador: 0,
    registro,
  })
  anotar("registro: guardar borrador privado", r.status === 200, String(r.status))
  const revBorrador = r.body?.revision
  const sinBorrador = await pedir("entrenador", "GET", `/entrenamiento/sesiones/${hoy}`)
  const sinResultado = await pedir("entrenador", "GET", `/entrenamiento/sesiones/${hoy}/resultado`)
  anotar(
    "registro: el entrenador no ve el borrador",
    !("borrador" in sinBorrador.body) && sinResultado.status === 404,
    `resultado ${sinResultado.status}`,
  )
  const nada = registro.series.map((s) =>
    s.tipoMedicion === "tiempo"
      ? { ...s, hecha: false, segundos: null }
      : { ...s, hecha: false, repeticiones: null, pesoKg: null },
  )
  r = await pedir("ana", "POST", `/entrenamiento/sesiones/${hoy}/enviar`, {
    operacionId: randomUUID(),
    revisionPrescripcion: revPres,
    revisionBorrador: revBorrador,
    registro: { ...registro, series: nada },
  })
  anotar("registro: enviar sin ninguna serie hecha se rechaza", r.status === 400, String(r.status))
  const unidadCambiada = [
    { serieId: s1.id, tipoMedicion: "tiempo", pesoKg: 45, segundos: 10, hecha: true },
    ...registro.series.slice(1),
  ]
  r = await pedir("ana", "POST", `/entrenamiento/sesiones/${hoy}/enviar`, {
    operacionId: randomUUID(),
    revisionPrescripcion: revPres,
    revisionBorrador: revBorrador,
    registro: { ...registro, series: unidadCambiada },
  })
  anotar("registro: cambiar la unidad de una serie se rechaza", r.status === 400, String(r.status))
  const envio = {
    operacionId: randomUUID(),
    revisionPrescripcion: revPres,
    revisionBorrador: revBorrador,
    registro,
  }
  r = await pedir("ana", "POST", `/entrenamiento/sesiones/${hoy}/enviar`, envio)
  anotar("registro: enviar", r.status === 200, String(r.status))
  const otraVez = await pedir("ana", "POST", `/entrenamiento/sesiones/${hoy}/enviar`, envio)
  anotar(
    "registro: reintentar el mismo envío es idempotente",
    otraVez.status === 200,
    String(otraVez.status),
  )
  const resultado = await pedir("entrenador", "GET", `/entrenamiento/sesiones/${hoy}/resultado`)
  const series = resultado.body?.series ?? []
  const buscar = (id) => series.find((s) => s.serieId === id)
  const exacto =
    resultado.status === 200 &&
    series.length === 3 &&
    buscar(s1.id)?.valores?.repeticiones === 8 &&
    buscar(s1.id)?.valores?.pesoKg === 45 &&
    buscar(s2.id)?.hecha === false &&
    buscar(t1.id)?.valores?.segundos === 35 &&
    resultado.body.notas === "Recorrido sintético"
  anotar(
    "resultado: el entrenador ve exactamente lo enviado (reps, omitida y tiempo)",
    exacto,
    String(resultado.status),
  )
  r = await pedir("ana", "PUT", `/entrenamiento/sesiones/${hoy}/borrador`, {
    operacionId: randomUUID(),
    revisionPrescripcion: revPres,
    revisionBorrador: revBorrador,
    registro,
  })
  anotar("registro: tras enviar ya no se edita", r.status === 409, String(r.status))
  r = await pedir("bruno", "GET", `/entrenamiento/sesiones/${hoy}/resultado`)
  anotar("resultado: otro cliente no lo ve", [403, 404].includes(r.status), String(r.status))

  // 5. Retirar un ejercicio no rompe el histórico.
  await pedir("entrenador", "POST", `/ejercicios/${ids.sentadilla}/retirar`)
  const historico = await pedir("entrenador", "GET", `/entrenamiento/sesiones/${hoy}/resultado`)
  const ficha = await pedir("ana", "GET", `/ejercicios/${ids.sentadilla}`)
  const figura = await fetch(`${API}/ejercicios/${ids.sentadilla}/figura`, {
    headers: { Authorization: `Bearer ${tokens.ana}` },
  })
  anotar(
    "histórico: un retirado sigue en el resultado, con su ficha y su figura",
    historico.status === 200 && ficha.body.estado === "retirado" && figura.status === 200,
    `resultado ${historico.status}, ficha ${ficha.body.estado}, figura ${figura.status}`,
  )
} catch (error) {
  fallos++
  informe.push(`MAL excepción: ${error.message}`)
} finally {
  await limpiar()
  const quedan = await prisma.usuario.count({ where: { email: { endsWith: SUFIJO } } })
  if (quedan !== 0) fallos++
  informe.push(`${quedan === 0 ? "OK " : "MAL"} limpieza: ${quedan} cuentas sintéticas restantes`)
  await prisma.$disconnect()
}
console.log(informe.join("\n"))
console.log(`\n${fallos === 0 ? "Recorrido completo sin fallos" : `${fallos} fallos`}`)
process.exitCode = fallos === 0 ? 0 : 1
