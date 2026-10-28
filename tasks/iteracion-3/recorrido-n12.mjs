/* global URL, fetch -- Node 22 los trae de serie */
// Recorrido N12 de nutrición (tasks/nutricion/todo.md) contra una API en marcha.
//
//   npm run build --workspace apps/api
//   node tasks/iteracion-3/recorrido-n12.mjs          # API en http://localhost:$API_PORT (3000)
//   RECORRIDO_API=http://localhost:3101 node tasks/iteracion-3/recorrido-n12.mjs
//
// Crea cuentas sintéticas (@recorrido-n12.test) en una base dedicada (_e2e_, _manual_, _test o _review_), recorre los
// criterios de SPEC-nutricion.md que se pueden comprobar por HTTP y borra solo lo
// suyo al final. La dieta es inventada. Imprime el marcador que lleva el documento
// para buscarlo después en los registros del servidor (criterio 14).
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

const { PrismaService } = await import(RAIZ + "prisma/prisma.service.js")
const { cifrarContrasena } = await import(RAIZ + "identity/contrasenas.js")

const API = process.env.RECORRIDO_API ?? `http://localhost:${process.env.API_PORT ?? "3000"}`
const SUFIJO = "@recorrido-n12.test"
const MARCADOR = `marcador-${randomBytes(6).toString("hex")}`
const prisma = new PrismaService()
const informe = []
let fallos = 0
const anotar = (criterio, paso, ok, detalle = "") => {
  if (!ok) fallos++
  informe.push(`${ok ? "OK " : "MAL"} [${criterio}] ${paso}${detalle ? " · " + detalle : ""}`)
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
  const uid = { in: usuarios.map((u) => u.id) }
  await prisma.$transaction([
    prisma.dieta.deleteMany({ where: { clienteId: uid } }),
    prisma.asignacionNutricionista.deleteMany({
      where: { OR: [{ clienteId: uid }, { nutricionistaId: uid }] },
    }),
    prisma.usuario.deleteMany({ where: { id: uid } }),
  ])
}

/** Dieta inventada con la estructura completa de la referencia. */
function documento(nombre) {
  const entreno = randomUUID()
  const descanso = randomUUID()
  const alternativa = (titulo, alimentos) => ({
    id: randomUUID(),
    titulo,
    alimentos,
    nota: null,
    macros: null,
  })
  return {
    formato: 1,
    nombre,
    tiposDeDia: [
      {
        id: entreno,
        nombre: "Entreno",
        objetivo: { kcal: 2100, proteinaG: 150, hidratosG: 230, grasaG: 65 },
        comidas: [
          {
            id: randomUUID(),
            nombre: "Desayuno",
            hora: "08:00",
            indicacion: MARCADOR,
            forma: "alternativas",
            grupos: [
              {
                nombre: "Dulces",
                alternativas: [
                  alternativa("Opción 1", [
                    { nombre: "Avena", cantidad: "60 g" },
                    { nombre: "Canela", cantidad: "al gusto" },
                  ]),
                  alternativa("Opción 2", [{ nombre: "Pieza de fruta", cantidad: null }]),
                ],
              },
              {
                nombre: "Saladas",
                alternativas: [
                  alternativa("Opción 3", [{ nombre: "Pan integral", cantidad: "(25 g)" }]),
                ],
              },
            ],
          },
          {
            id: randomUUID(),
            nombre: "Comida",
            hora: null,
            indicacion: null,
            forma: "intercambio",
            columnas: [
              { nombre: "Proteína", alimentos: [{ nombre: "Pollo", cantidad: "150 g" }] },
              { nombre: "Hidratos", alimentos: [{ nombre: "Arroz", cantidad: "1 ud" }] },
            ],
          },
        ],
      },
      {
        id: descanso,
        nombre: "Descanso",
        objetivo: { kcal: 1800, proteinaG: 140, hidratosG: null, grasaG: null },
        comidas: [],
      },
    ],
    semana: [entreno, descanso, entreno, descanso, entreno, descanso, descanso],
    indicaciones: [{ titulo: "Agua", texto: "Dos litros al día." }],
  }
}

try {
  await limpiar()
  const clave = randomBytes(18).toString("base64url")
  const passwordHash = await cifrarContrasena(clave)
  for (const [nombre, rol, estado] of [
    ["entrenador", "entrenador", "activo"],
    ["nutri", "nutricionista", "activo"],
    ["empleado", "empleado", "activo"],
    ["ana", "cliente", "activo"],
    ["bruno", "cliente", "activo"],
    ["pendiente", "cliente", "pendiente"],
  ]) {
    const email = `${nombre}${SUFIJO}`
    const u = await prisma.usuario.create({
      data: { email, nombre: `Recorrido ${nombre}`, passwordHash, rol, estado },
    })
    ids[nombre] = u.id
    if (estado === "activo") {
      const r = await pedir(null, "POST", "/auth/login", { email, contrasena: clave })
      tokens[nombre] = r.body.tokenAcceso
    }
  }
  const ruta = (cliente, resto = "") => `/nutricion/clientes/${ids[cliente]}${resto}`

  // 1. Borrador completo; el cliente no ve nada hasta publicar.
  let r = await pedir("entrenador", "PUT", ruta("ana", "/borrador"), {
    revision: 0,
    documento: documento("Plan de prueba 1"),
  })
  anotar(1, "el entrenador crea el borrador completo", r.status === 200, String(r.status))
  const rev0 = r.body.revision
  r = await pedir("ana", "GET", ruta("ana", "/dieta"))
  anotar(1, "sin publicar, el cliente no ve dieta", r.status === 200 && r.body.dieta === null)
  r = await pedir("ana", "GET", ruta("ana", "/borrador"))
  anotar(4, "el cliente no lee el borrador", r.status === 403, String(r.status))

  // 7. Dos guardados con la misma revisión: el segundo no pisa al primero.
  r = await pedir("entrenador", "PUT", ruta("ana", "/borrador"), {
    revision: rev0,
    documento: documento("Plan de prueba 1"),
  })
  const rev1 = r.body?.revision
  const pisar = await pedir("entrenador", "PUT", ruta("ana", "/borrador"), {
    revision: rev0,
    documento: documento("Otro"),
  })
  anotar(
    7,
    "dos guardados con la misma revisión: el segundo recibe revision_obsoleta",
    r.status === 200 && pisar.status === 409 && pisar.body.codigo === "revision_obsoleta",
  )

  // 2 y 8. Publicar, repetir la publicación y leer.
  const operacion = randomUUID()
  r = await pedir("entrenador", "POST", ruta("ana", "/borrador/publicar"), {
    operacionId: operacion,
    revision: rev1,
  })
  const primera = r.body?.id
  anotar(2, "publicar", r.status === 200, String(r.status))
  r = await pedir("entrenador", "POST", ruta("ana", "/borrador/publicar"), {
    operacionId: operacion,
    revision: rev1,
  })
  anotar(8, "repetir la publicación da la misma dieta", r.status === 200 && r.body?.id === primera)
  r = await pedir("ana", "GET", ruta("ana", "/dieta"))
  const leida = r.body?.dieta?.documento
  anotar(2, "el cliente ve la dieta publicada", r.status === 200 && r.body.dieta?.id === primera)
  anotar(
    11,
    "cantidades en texto libre sin cambios y alimento sin cantidad",
    leida?.tiposDeDia[0].comidas[0].grupos[0].alternativas[0].alimentos[1].cantidad ===
      "al gusto" &&
      leida?.tiposDeDia[0].comidas[0].grupos[1].alternativas[0].alimentos[0].cantidad ===
        "(25 g)" &&
      leida?.tiposDeDia[0].comidas[0].grupos[0].alternativas[1].alimentos[0].cantidad === null,
  )
  anotar(
    15,
    "un tipo de día sin comidas con objetivo se publica tal cual",
    leida?.tiposDeDia[1].comidas.length === 0 && leida?.tiposDeDia[1].objetivo.kcal === 1800,
  )
  anotar(
    2,
    "el cliente no recibe quién la publicó",
    r.body?.dieta && !("publicadaPor" in r.body.dieta),
  )

  // 3. Otro cliente no la obtiene.
  for (const resto of ["/dieta", "/borrador", "/historico"]) {
    r = await pedir("bruno", "GET", ruta("ana", resto))
    anotar(3, `Bruno pide ${resto} de Ana`, [403, 404].includes(r.status), String(r.status))
  }

  // 4. El cliente no guarda, publica ni descarta.
  r = await pedir("ana", "PUT", ruta("ana", "/borrador"), {
    revision: 0,
    documento: documento("x"),
  })
  const publicar = await pedir("ana", "POST", ruta("ana", "/borrador/publicar"), {
    operacionId: randomUUID(),
    revision: 1,
  })
  const descartar = await pedir("ana", "POST", ruta("ana", "/borrador/descartar"), { revision: 1 })
  anotar(
    4,
    "el cliente no guarda, publica ni descarta",
    r.status === 403 && publicar.status === 403 && descartar.status === 403,
    `${r.status}/${publicar.status}/${descartar.status}`,
  )

  // 6. Empleado y sin sesión.
  const rutas = [
    ["GET", "/dieta"],
    ["GET", "/borrador"],
    ["PUT", "/borrador"],
    ["POST", "/borrador/publicar"],
    ["POST", "/borrador/descartar"],
    ["GET", "/historico"],
  ]
  const empleado = []
  const anonimo = []
  for (const [metodo, resto] of rutas) {
    empleado.push(
      (await pedir("empleado", metodo, ruta("ana", resto), metodo === "GET" ? undefined : {}))
        .status,
    )
    anonimo.push(
      (await pedir(null, metodo, ruta("ana", resto), metodo === "GET" ? undefined : {})).status,
    )
  }
  anotar(
    6,
    "el empleado recibe denegación en todas",
    empleado.every((s) => s === 403),
    empleado.join(","),
  )
  anotar(
    6,
    "sin sesión, denegación en todas",
    anonimo.every((s) => s === 401),
    anonimo.join(","),
  )

  // 5. Nutricionista: sin asignación, con ella y tras perderla.
  r = await pedir("nutri", "GET", ruta("ana", "/borrador"))
  anotar(5, "nutricionista sin asignación", r.status === 403 || r.status === 404, String(r.status))
  r = await pedir("entrenador", "PUT", `/nutricionistas/${ids.nutri}/clientes/${ids.ana}`)
  anotar(
    5,
    "el entrenador asigna la nutricionista",
    [200, 201, 204].includes(r.status),
    String(r.status),
  )
  r = await pedir("nutri", "PUT", ruta("ana", "/borrador"), {
    revision: 0,
    documento: documento("Plan de prueba 2"),
  })
  const rev2 = r.body?.revision
  const segunda = await pedir("nutri", "POST", ruta("ana", "/borrador/publicar"), {
    operacionId: randomUUID(),
    revision: rev2,
  })
  anotar(5, "con asignación edita y publica", r.status === 200 && segunda.status === 200)

  // 2. La segunda publicación archiva la primera: el profesional la ve, el cliente no.
  r = await pedir("nutri", "GET", ruta("ana", "/historico"))
  const estados = Object.fromEntries((r.body?.dietas ?? []).map((d) => [d.id, d.estado]))
  anotar(
    2,
    "histórico: la primera archivada, la segunda vigente, con autor",
    estados[primera] === "archivada" &&
      estados[segunda.body?.id] === "publicada" &&
      r.body.dietas.every((d) => d.publicadaPor?.nombre),
  )
  r = await pedir("ana", "GET", ruta("ana", `/dietas/${primera}`))
  const hist = await pedir("ana", "GET", ruta("ana", "/historico"))
  anotar(
    2,
    "el cliente no ve el histórico",
    r.status === 403 && hist.status === 403,
    `${r.status}/${hist.status}`,
  )
  r = await pedir("ana", "GET", ruta("ana", "/dieta"))
  anotar(2, "el cliente ve solo la última", r.body?.dieta?.id === segunda.body?.id)

  // 5. Pierde la asignación: la siguiente petición se deniega.
  await pedir("entrenador", "DELETE", `/nutricionistas/${ids.nutri}/clientes/${ids.ana}`)
  r = await pedir("nutri", "GET", ruta("ana", "/dieta"))
  anotar(5, "tras retirar la asignación, denegado", [403, 404].includes(r.status), String(r.status))

  // 10 y 15. Validaciones del documento.
  const sinNada = documento("Inválida")
  sinNada.tiposDeDia[1].objetivo = null
  r = await pedir("entrenador", "PUT", ruta("bruno", "/borrador"), {
    revision: 0,
    documento: sinNada,
  })
  anotar(
    15,
    "tipo sin comidas ni números se rechaza",
    r.status === 400 && r.body.codigo === "solicitud_invalida",
  )
  const negativa = documento("Negativa")
  negativa.tiposDeDia[0].objetivo.kcal = -5
  r = await pedir("entrenador", "PUT", ruta("bruno", "/borrador"), {
    revision: 0,
    documento: negativa,
  })
  anotar(10, "kcal negativas se rechazan", r.status === 400)
  const sinNumeros = documento("Sin números")
  sinNumeros.tiposDeDia[0].objetivo = null
  r = await pedir("entrenador", "PUT", ruta("bruno", "/borrador"), {
    revision: 0,
    documento: sinNumeros,
  })
  anotar(
    10,
    "una dieta sin kcal en un tipo con comidas es válida",
    r.status === 200,
    String(r.status),
  )

  // 13. Pendiente sí; dado de baja no, y conserva el histórico.
  r = await pedir("entrenador", "PUT", ruta("pendiente", "/borrador"), {
    revision: 0,
    documento: documento("Pendiente"),
  })
  const pub = await pedir("entrenador", "POST", ruta("pendiente", "/borrador/publicar"), {
    operacionId: randomUUID(),
    revision: r.body?.revision,
  })
  anotar(13, "a un cliente pendiente se le publica", r.status === 200 && pub.status === 200)
  await pedir("entrenador", "POST", `/usuarios/${ids.ana}/desactivar`)
  r = await pedir("entrenador", "PUT", ruta("ana", "/borrador"), {
    revision: 0,
    documento: documento("Baja"),
  })
  const histBaja = await pedir("entrenador", "GET", ruta("ana", "/historico"))
  anotar(
    13,
    "cliente de baja: no se guarda, histórico conservado",
    r.status === 409 && r.body.codigo === "operacion_incompatible" && histBaja.body?.total === 2,
    `${r.status}, histórico ${histBaja.body?.total}`,
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
console.log(`\nMarcador del documento: ${MARCADOR}`)
console.log(fallos === 0 ? "Recorrido completo sin fallos" : `${fallos} fallos`)
process.exitCode = fallos === 0 ? 0 : 1
