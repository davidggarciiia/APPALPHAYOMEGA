import { randomUUID } from "node:crypto"
import request from "supertest"
import {
  ErrorDeApiSchema,
  ListadoMedidasSchema,
  ListadoPruebasSchema,
  PaginaMedidasSchema,
  PaginaPruebasSchema,
} from "@alpha-omega/shared"
import { entornoEntrenamiento } from "./entrenamiento-ayuda.js"

/** Posición de una fila sintética: lo que ordena el histórico. */
interface Toma {
  id: string
  fecha: string
  creadoEn: string
  nombre: string
}

const NOMBRES = ["Flexiones", "Plancha", "Salto vertical"]

/**
 * 501 tomas sintéticas con empates: 360 días distintos apuntados a posteriori,
 * 20 de un mismo día separadas por milisegundos, 120 idénticas en fecha y
 * creación (decide el ID) y la más reciente, con un nombre que ordena al final.
 */
function tomas(): Toma[] {
  const lista: Toma[] = []
  const inicio = Date.UTC(2024, 0, 1)
  for (let k = 0; k < 360; k++)
    lista.push({
      id: randomUUID(),
      fecha: new Date(inicio + k * 86_400_000).toISOString().slice(0, 10),
      creadoEn: new Date(Date.UTC(2025, 11, 1) - k * 1000).toISOString(),
      nombre: NOMBRES[k % 3]!,
    })
  for (let k = 0; k < 20; k++)
    lista.push({
      id: randomUUID(),
      fecha: "2025-03-01",
      creadoEn: new Date(Date.UTC(2025, 2, 1, 8) + k).toISOString(),
      nombre: NOMBRES[k % 3]!,
    })
  for (let k = 0; k < 120; k++)
    lista.push({
      id: randomUUID(),
      fecha: "2025-06-01",
      creadoEn: "2025-06-01T09:00:00.000Z",
      nombre: NOMBRES[k % 3]!,
    })
  lista.push({
    id: randomUUID(),
    fecha: "2025-09-01",
    creadoEn: "2025-09-01T10:00:00.000Z",
    nombre: "Zancadas",
  })
  return lista
}

/** Del más reciente al más antiguo; el ID deshace los empates completos. */
function recientesPrimero(a: Toma, b: Toma): number {
  if (a.fecha !== b.fecha) return a.fecha < b.fecha ? 1 : -1
  if (a.creadoEn !== b.creadoEn) return a.creadoEn < b.creadoEn ? 1 : -1
  return a.id < b.id ? 1 : a.id > b.id ? -1 : 0
}

/** Manipula un cursor real para comprobar que el servidor lo valida. */
function alterar(cursor: string, cambio: (datos: Record<string, unknown>) => unknown): string {
  const datos = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as Record<
    string,
    unknown
  >
  return Buffer.from(JSON.stringify(cambio(datos))).toString("base64url")
}

describe("Seguimiento: histórico paginado", () => {
  let entorno: Awaited<ReturnType<typeof entornoEntrenamiento>>
  const medidas = tomas()
  const pruebas = tomas()
  const masReciente = (lista: Toma[]) => [...lista].sort(recientesPrimero)[0]!
  const masAntigua = (lista: Toma[]) => [...lista].sort(recientesPrimero).at(-1)!
  const eliminadas = { medidas: new Set<string>(), pruebas: new Set<string>() }
  const vigentes = (lista: Toma[], tipo: keyof typeof eliminadas) =>
    lista.filter((t) => !eliminadas[tipo].has(t.id)).sort(recientesPrimero)

  beforeAll(async () => {
    entorno = await entornoEntrenamiento("seguimiento-paginacion")
    const { prisma, ids } = entorno
    await prisma.usuario.update({
      where: { id: ids.cliente! },
      data: { fechaNacimiento: new Date("1990-02-03T00:00:00Z") },
    })
    await prisma.medidaCorporal.createMany({
      data: medidas.map((t, i) => ({
        id: t.id,
        clienteId: ids.cliente!,
        autorId: ids.entrenador!,
        operacionId: randomUUID(),
        fecha: new Date(`${t.fecha}T00:00:00Z`),
        creadoEn: new Date(t.creadoEn),
        pesoKg: 70 + (i % 40) / 10,
        cinturaCm: null,
        grasaPct: null,
        alturaCm: null,
      })),
    })
    await prisma.pruebaFisica.createMany({
      data: pruebas.map((t, i) => ({
        id: t.id,
        clienteId: ids.cliente!,
        autorId: ids.entrenador!,
        operacionId: randomUUID(),
        fecha: new Date(`${t.fecha}T00:00:00Z`),
        creadoEn: new Date(t.creadoEn),
        nombre: t.nombre,
        valor: 10 + (i % 25),
        unidad: "reps",
      })),
    })
  })
  afterAll(async () => {
    await entorno?.cerrar()
  })

  const ruta = (clienteId: string, resto: string) => `/seguimiento/clientes/${clienteId}/${resto}`

  async function paginaMedidas(
    rol: string,
    clienteId: string,
    consulta: Record<string, string | number> = {},
  ) {
    const respuesta = await request(entorno.app.getHttpServer())
      .get(ruta(clienteId, "medidas/pagina"))
      .query(consulta)
      .set(entorno.como(rol))
      .expect(200)
    return PaginaMedidasSchema.parse(respuesta.body)
  }

  async function paginaPruebas(
    rol: string,
    clienteId: string,
    consulta: Record<string, string | number> = {},
  ) {
    const respuesta = await request(entorno.app.getHttpServer())
      .get(ruta(clienteId, "pruebas/pagina"))
      .query(consulta)
      .set(entorno.como(rol))
      .expect(200)
    return PaginaPruebasSchema.parse(respuesta.body)
  }

  /** Recorre todas las páginas y falla si un cursor se repite. */
  async function recorrer(
    leer: (consulta: Record<string, string | number>) => Promise<{
      filas: { id: string }[]
      siguienteCursor: string | null
    }>,
    limite: number,
  ): Promise<{ ids: string[]; paginas: number }> {
    const ids: string[] = []
    const cursores = new Set<string>()
    let cursor: string | null = null
    let paginas = 0
    do {
      const pagina: { filas: { id: string }[]; siguienteCursor: string | null } = await leer(
        cursor === null ? { limite } : { limite, cursor },
      )
      paginas++
      expect(pagina.filas.length).toBeLessThanOrEqual(limite)
      if (pagina.siguienteCursor !== null) {
        expect(pagina.filas).toHaveLength(limite)
        expect(cursores.has(pagina.siguienteCursor)).toBe(false)
        cursores.add(pagina.siguienteCursor)
      }
      ids.push(...pagina.filas.map((f) => f.id))
      cursor = pagina.siguienteCursor
    } while (cursor !== null && paginas < 1000)
    return { ids, paginas }
  }

  it("sin filas devuelve una página vacía y con una sola fila no ofrece cursor", async () => {
    const { ids, prisma } = entorno
    expect(await paginaMedidas("entrenador", ids.otro!)).toEqual({
      medidas: [],
      fechaNacimiento: null,
      siguienteCursor: null,
    })
    expect(await paginaPruebas("entrenador", ids.otro!)).toEqual({
      pruebas: [],
      siguienteCursor: null,
    })
    await prisma.medidaCorporal.create({
      data: {
        clienteId: ids.otro!,
        autorId: ids.entrenador!,
        operacionId: randomUUID(),
        fecha: new Date("2025-05-01T00:00:00Z"),
        pesoKg: 64.2,
      },
    })
    await prisma.pruebaFisica.create({
      data: {
        clienteId: ids.otro!,
        autorId: ids.entrenador!,
        operacionId: randomUUID(),
        fecha: new Date("2025-05-01T00:00:00Z"),
        nombre: "Plancha",
        valor: 45,
        unidad: "s",
      },
    })
    const unaMedida = await paginaMedidas("otro", ids.otro!)
    expect(unaMedida.medidas).toHaveLength(1)
    expect(unaMedida.siguienteCursor).toBeNull()
    const unaPrueba = await paginaPruebas("otro", ids.otro!, { limite: 1 })
    expect(unaPrueba.pruebas).toHaveLength(1)
    expect(unaPrueba.siguienteCursor).toBeNull()
  })

  it("recorre las 501 medidas sin duplicados, de la más reciente a la más antigua", async () => {
    const { ids } = entorno
    const esperadas = vigentes(medidas, "medidas").map((t) => t.id)
    const porDefecto = await paginaMedidas("cliente", ids.cliente!)
    expect(porDefecto.medidas).toHaveLength(500)
    expect(porDefecto.medidas[0]!.id).toBe(masReciente(medidas).id)
    expect(porDefecto.fechaNacimiento).toBe("1990-02-03")
    expect(porDefecto.siguienteCursor).not.toBeNull()
    const ultima = await paginaMedidas("cliente", ids.cliente!, {
      cursor: porDefecto.siguienteCursor!,
    })
    expect(ultima).toEqual({
      medidas: [expect.objectContaining({ id: masAntigua(medidas).id, fecha: "2024-01-01" })],
      fechaNacimiento: "1990-02-03",
      siguienteCursor: null,
    })

    // Páginas de 7: los cortes caen en empates completos y entre milisegundos.
    const recorrido = await recorrer(async (consulta) => {
      const pagina = await paginaMedidas("entrenador", ids.cliente!, consulta)
      expect(pagina.fechaNacimiento).toBe("1990-02-03")
      return { filas: pagina.medidas, siguienteCursor: pagina.siguienteCursor }
    }, 7)
    expect(recorrido.paginas).toBe(72)
    expect(new Set(recorrido.ids).size).toBe(501)
    expect(recorrido.ids).toEqual(esperadas)
  })

  it("recorre las 501 pruebas por fecha, sin agrupar por nombre al paginar", async () => {
    const { ids } = entorno
    const esperadas = vigentes(pruebas, "pruebas").map((t) => t.id)
    const porDefecto = await paginaPruebas("cliente", ids.cliente!)
    expect(porDefecto.pruebas).toHaveLength(500)
    expect(porDefecto.pruebas[0]).toMatchObject({
      id: masReciente(pruebas).id,
      nombre: "Zancadas",
      pruebaId: null,
    })
    const ultima = await paginaPruebas("cliente", ids.cliente!, {
      cursor: porDefecto.siguienteCursor!,
    })
    expect(ultima.pruebas.map((p) => p.id)).toEqual([masAntigua(pruebas).id])
    expect(ultima.siguienteCursor).toBeNull()

    const recorrido = await recorrer(async (consulta) => {
      const pagina = await paginaPruebas("entrenador", ids.cliente!, consulta)
      return { filas: pagina.pruebas, siguienteCursor: pagina.siguienteCursor }
    }, 7)
    expect(recorrido.paginas).toBe(72)
    expect(new Set(recorrido.ids).size).toBe(501)
    expect(recorrido.ids).toEqual(esperadas)
  })

  it("la ruta antigua de medidas incluye la más reciente, en orden ascendente y sin campos nuevos", async () => {
    const { app, como, ids } = entorno
    const respuesta = await request(app.getHttpServer())
      .get(ruta(ids.cliente!, "medidas"))
      .set(como("cliente"))
      .expect(200)
    const listado = ListadoMedidasSchema.parse(respuesta.body)
    expect(Object.keys(respuesta.body).sort()).toEqual(["fechaNacimiento", "medidas"])
    expect(listado.medidas).toHaveLength(500)
    expect(listado.medidas.at(-1)!.id).toBe(masReciente(medidas).id)
    expect(listado.medidas.map((m) => m.id)).not.toContain(masAntigua(medidas).id)
    expect(listado.medidas.map((m) => m.id)).toEqual(
      vigentes(medidas, "medidas")
        .slice(0, 500)
        .reverse()
        .map((t) => t.id),
    )
  })

  it("la ruta antigua de pruebas incluye la más reciente y conserva el orden por nombre", async () => {
    const { app, como, ids } = entorno
    const respuesta = await request(app.getHttpServer())
      .get(ruta(ids.cliente!, "pruebas"))
      .set(como("cliente"))
      .expect(200)
    const listado = ListadoPruebasSchema.parse(respuesta.body)
    expect(Object.keys(respuesta.body)).toEqual(["pruebas"])
    expect(listado.pruebas).toHaveLength(500)
    const recibidas = listado.pruebas.map((p) => p.id)
    expect(recibidas).toContain(masReciente(pruebas).id)
    expect(recibidas).not.toContain(masAntigua(pruebas).id)
    expect(new Set(recibidas)).toEqual(
      new Set(
        vigentes(pruebas, "pruebas")
          .slice(0, 500)
          .map((t) => t.id),
      ),
    )
    const orden = [...NOMBRES, "Zancadas"]
    for (let i = 1; i < listado.pruebas.length; i++) {
      const [a, b] = [listado.pruebas[i - 1]!, listado.pruebas[i]!]
      const nombre = orden.indexOf(a.nombre) - orden.indexOf(b.nombre)
      expect(nombre < 0 || (nombre === 0 && a.fecha <= b.fecha)).toBe(true)
    }
    expect(listado.pruebas.at(-1)!.nombre).toBe("Zancadas")
  })

  it("rechaza cursores y límites inválidos con 400", async () => {
    const { app, como, ids } = entorno
    const http = app.getHttpServer()
    const cursorMedidas = (await paginaMedidas("cliente", ids.cliente!, { limite: 3 }))
      .siguienteCursor!
    const cursorPruebas = (await paginaPruebas("cliente", ids.cliente!, { limite: 3 }))
      .siguienteCursor!
    const invalidos: [string, Record<string, string | number>][] = [
      ["medidas/pagina", { cursor: "" }],
      ["medidas/pagina", { cursor: "a".repeat(1001) }],
      ["medidas/pagina", { cursor: "no es un cursor" }],
      ["medidas/pagina", { cursor: Buffer.from("sin json").toString("base64url") }],
      ["medidas/pagina", { cursor: cursorMedidas.slice(0, cursorMedidas.length / 2) }],
      ["medidas/pagina", { cursor: `${cursorMedidas}!` }],
      ["pruebas/pagina", { cursor: cursorMedidas }],
      ["medidas/pagina", { cursor: cursorPruebas }],
      [
        "medidas/pagina",
        { cursor: alterar(cursorMedidas, (d) => ({ ...d, clienteId: ids.otro })) },
      ],
      ["medidas/pagina", { cursor: alterar(cursorMedidas, (d) => ({ ...d, i: "1 OR 1=1" })) }],
      ["medidas/pagina", { cursor: alterar(cursorMedidas, (d) => ({ ...d, f: "2025-02-30" })) }],
      ["medidas/pagina", { cursor: alterar(cursorMedidas, (d) => ({ ...d, c: "ayer" })) }],
      ["medidas/pagina", { cursor: alterar(cursorMedidas, () => ["fecha", "id"]) }],
      ["medidas/pagina", { cursor: alterar(cursorMedidas, () => null) }],
      ["medidas/pagina", { limite: 0 }],
      ["medidas/pagina", { limite: 501 }],
      ["pruebas/pagina", { limite: "muchas" }],
      ["pruebas/pagina", { limite: 1.5 }],
      ["pruebas/pagina", { desde: "2025-01-01" }],
    ]
    for (const [recurso, consulta] of invalidos) {
      const respuesta = await request(http)
        .get(ruta(ids.cliente!, recurso))
        .query(consulta)
        .set(como("cliente"))
      expect({ recurso, consulta, estado: respuesta.status }).toEqual({
        recurso,
        consulta,
        estado: 400,
      })
      ErrorDeApiSchema.parse(respuesta.body)
    }
  })

  it("aplica el alcance vigente y un cursor ajeno nunca cambia el cliente filtrado", async () => {
    const { app, como, ids, prisma } = entorno
    const http = app.getHttpServer()
    for (const recurso of ["medidas/pagina", "pruebas/pagina"]) {
      await request(http).get(ruta(ids.cliente!, recurso)).expect(401)
      await request(http).get(ruta(ids.otro!, recurso)).set(como("cliente")).expect(403)
      await request(http).get(ruta(ids.cliente!, recurso)).set(como("otro")).expect(403)
      await request(http).get(ruta(ids.cliente!, recurso)).set(como("empleado")).expect(403)
      await request(http).get(ruta(ids.cliente!, recurso)).set(como("nutricionista")).expect(403)
    }
    await prisma.asignacionNutricionista.create({
      data: { nutricionistaId: ids.nutricionista!, clienteId: ids.cliente! },
    })
    try {
      const medidasNutri = await paginaMedidas("nutricionista", ids.cliente!, { limite: 2 })
      expect(medidasNutri.medidas.map((m) => m.id)).toEqual(
        vigentes(medidas, "medidas")
          .slice(0, 2)
          .map((t) => t.id),
      )
      expect((await paginaPruebas("nutricionista", ids.cliente!)).pruebas).toHaveLength(500)
      await request(http)
        .get(ruta(ids.otro!, "medidas/pagina"))
        .set(como("nutricionista"))
        .expect(403)
    } finally {
      await prisma.asignacionNutricionista.delete({
        where: {
          nutricionistaId_clienteId: {
            nutricionistaId: ids.nutricionista!,
            clienteId: ids.cliente!,
          },
        },
      })
    }
    await request(http)
      .get(ruta(ids.cliente!, "pruebas/pagina"))
      .set(como("nutricionista"))
      .expect(403)

    // El cursor de un cliente, usado en la ruta de otro, solo filtra al de la ruta.
    const propias = new Set([...medidas, ...pruebas].map((t) => t.id))
    const cursorMedidas = (await paginaMedidas("entrenador", ids.cliente!, { limite: 10 }))
      .siguienteCursor!
    const ajenas = await paginaMedidas("entrenador", ids.otro!, { cursor: cursorMedidas })
    expect(ajenas.medidas).toHaveLength(1)
    expect(ajenas.medidas.some((m) => propias.has(m.id))).toBe(false)
    const cursorPruebas = (await paginaPruebas("entrenador", ids.cliente!, { limite: 10 }))
      .siguienteCursor!
    const ajenasPruebas = await paginaPruebas("entrenador", ids.otro!, { cursor: cursorPruebas })
    expect(ajenasPruebas.pruebas.map((p) => p.nombre)).toEqual(["Plancha"])
    expect(ajenasPruebas.pruebas.some((p) => propias.has(p.id))).toBe(false)
  })

  it("continúa tras borrar la fila del cursor y con 500 filas cabe en una sola página", async () => {
    const { ids, prisma } = entorno
    for (const tipo of ["medidas", "pruebas"] as const) {
      const lista = tipo === "medidas" ? medidas : pruebas
      const leer = async (consulta: Record<string, string | number>) => {
        if (tipo === "medidas") {
          const p = await paginaMedidas("entrenador", ids.cliente!, consulta)
          return { filas: p.medidas, siguienteCursor: p.siguienteCursor }
        }
        const p = await paginaPruebas("entrenador", ids.cliente!, consulta)
        return { filas: p.pruebas, siguienteCursor: p.siguienteCursor }
      }
      const orden = vigentes(lista, tipo)
      const primera = await leer({ limite: 50 })
      const cursorId = primera.filas.at(-1)!.id
      expect(cursorId).toBe(orden[49]!.id)
      if (tipo === "medidas") await prisma.medidaCorporal.delete({ where: { id: cursorId } })
      else await prisma.pruebaFisica.delete({ where: { id: cursorId } })
      eliminadas[tipo].add(cursorId)
      const segunda = await leer({ limite: 50, cursor: primera.siguienteCursor! })
      expect(segunda.filas.map((f) => f.id)).toEqual(orden.slice(50, 100).map((t) => t.id))

      const completa = await leer({})
      expect(completa.filas).toHaveLength(500)
      expect(completa.siguienteCursor).toBeNull()
      expect(completa.filas.map((f) => f.id)).toEqual(vigentes(lista, tipo).map((t) => t.id))
    }
    const antiguas = ListadoMedidasSchema.parse(
      (
        await request(entorno.app.getHttpServer())
          .get(ruta(ids.cliente!, "medidas"))
          .set(entorno.como("entrenador"))
          .expect(200)
      ).body,
    )
    expect(antiguas.medidas.map((m) => m.id)).toEqual(
      vigentes(medidas, "medidas")
        .reverse()
        .map((t) => t.id),
    )
  })
})
