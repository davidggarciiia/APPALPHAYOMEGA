import { randomUUID } from "node:crypto"
import request from "supertest"
import {
  EvolucionSchema,
  PublicacionValoracionSchema,
  ValoracionProfesionalSchema,
  crearPruebaEstandar,
  type ContenidoValoracion,
  type DefinicionCorporal,
  type DefinicionPrueba,
  type Evolucion,
  type PublicacionValoracion,
  type SerieEvolucion,
  type ValoracionProfesional,
} from "@alpha-omega/shared"
import { entornoEntrenamiento } from "./entrenamiento-ayuda.js"

// Datos sintéticos: definiciones, fechas y valores inventados para la prueba.
const peso: DefinicionCorporal = {
  id: randomUUID(),
  version: 1,
  bloque: "medidas",
  magnitud: "peso",
  nombre: "Peso",
  unidad: "kg",
  zona: null,
  lateralidad: null,
  instrumento: "Báscula sintética",
  protocolo: null,
  activa: true,
}
const cintura: DefinicionCorporal = {
  ...peso,
  id: randomUUID(),
  magnitud: "perimetro",
  nombre: "Perímetro de cintura",
  unidad: "cm",
  zona: "Cintura",
  instrumento: "Cinta",
}
const pliegue: DefinicionCorporal = {
  ...peso,
  id: randomUUID(),
  bloque: "pliegues",
  magnitud: "pliegue",
  nombre: "Punto A",
  unidad: "mm",
  zona: "Zona A",
  lateralidad: "derecha",
  instrumento: "Plicómetro",
}
const flexiones: DefinicionPrueba = crearPruebaEstandar("flexiones1min", randomUUID())
const cooper: DefinicionPrueba = crearPruebaEstandar("cooper", randomUUID())
/** Prueba prescrita del histórico, anterior a las valoraciones. */
const pruebaLegada = randomUUID()

const TODOS = ["medidas", "pliegues", "pruebas"] as const
const SIN_PLIEGUES = ["medidas", "pruebas"] as const

describe("Evolución: publicaciones vigentes e histórico en series comparables (E01a)", () => {
  let entorno: Awaited<ReturnType<typeof entornoEntrenamiento>>
  let inicial: ValoracionProfesional
  let revision: ValoracionProfesional
  let borrador: ValoracionProfesional
  let tercera: ValoracionProfesional
  let pubInicial: PublicacionValoracion
  let pubRevision: PublicacionValoracion
  let pubCorregida: PublicacionValoracion
  let pubTercera: PublicacionValoracion

  const http = () => entorno.app.getHttpServer()
  const ruta = (resto: string, clienteId = entorno.ids.cliente!) =>
    `/seguimiento/clientes/${clienteId}/${resto}`

  async function crear(cuerpo: Record<string, unknown>): Promise<ValoracionProfesional> {
    return ValoracionProfesionalSchema.parse(
      (
        await request(http())
          .post(ruta("valoraciones"))
          .set(entorno.como("entrenador"))
          .send({ operacionId: randomUUID(), ...cuerpo })
          .expect(201)
      ).body,
    )
  }

  async function guardar(
    v: ValoracionProfesional,
    cambios: Partial<ContenidoValoracion>,
  ): Promise<ValoracionProfesional> {
    const d = v.borrador!.documento
    const contenido: ContenidoValoracion = {
      bloques: d.bloques,
      corporales: d.corporales,
      pruebas: d.pruebas,
      grasaPorPliegues: d.grasaPorPliegues,
      destacados: d.destacados,
      conclusion: d.conclusion,
      notasInternas: d.notasInternas,
      ...cambios,
    }
    return ValoracionProfesionalSchema.parse(
      (
        await request(http())
          .put(ruta(`valoraciones/${v.id}`))
          .set(entorno.como("entrenador"))
          .send({
            borradorId: v.borrador!.id,
            revision: v.borrador!.revision,
            fechaToma: v.borrador!.fechaToma,
            contenido,
          })
          .expect(200)
      ).body,
    )
  }

  async function publicar(
    v: ValoracionProfesional,
    sustituyePublicacionId: string | null = null,
  ): Promise<PublicacionValoracion> {
    return PublicacionValoracionSchema.parse(
      (
        await request(http())
          .post(ruta(`valoraciones/${v.id}/publicaciones`))
          .set(entorno.como("entrenador"))
          .send({
            operacionId: randomUUID(),
            borradorId: v.borrador!.id,
            revision: v.borrador!.revision,
            sustituyePublicacionId,
          })
          .expect(201)
      ).body,
    )
  }

  async function evolucion(rol: string, consulta = ""): Promise<Evolucion> {
    return EvolucionSchema.parse(
      (
        await request(http())
          .get(ruta(`evolucion${consulta}`))
          .set(entorno.como(rol))
          .expect(200)
      ).body,
    )
  }

  const serie = (e: Evolucion, clave: string): SerieEvolucion => {
    const encontrada = e.series.find((s) => s.clave === clave)
    if (!encontrada) throw new Error(`Falta la serie ${clave}: ${e.series.map((s) => s.clave)}`)
    return encontrada
  }
  const valores = (s: SerieEvolucion) => s.puntos.map((p) => [p.fecha, p.valor])
  const claves = (e: Evolucion) => e.series.map((s) => s.clave)
  const c = (d: DefinicionCorporal, version = d.version) => `c:${d.id}:${version}`
  const p = (d: DefinicionPrueba, clave: string, version = d.version) =>
    `p:${d.id}:${version}:${clave}`

  beforeAll(async () => {
    entorno = await entornoEntrenamiento("evolucion-valoraciones")
    const { como, ids, prisma } = entorno
    const plantilla = ruta("plantilla-valoracion")
    await request(http())
      .put(plantilla)
      .set(como("entrenador"))
      .send({ revision: 0, corporales: [peso, cintura, pliegue], pruebas: [flexiones, cooper] })
      .expect(200)

    // Histórico previo: autorregistro del cliente, medidas del equipo, pruebas y día.
    const medida = (rol: string, fecha: string, valores: Record<string, number | null>) =>
      request(http())
        .post(ruta("medidas"))
        .set(como(rol))
        .send({
          operacionId: randomUUID(),
          fecha,
          pesoKg: null,
          cinturaCm: null,
          grasaPct: null,
          alturaCm: null,
          ...valores,
        })
        .expect(201)
    await medida("cliente", "2026-05-04", { pesoKg: 84.2 })
    await medida("entrenador", "2026-06-01", { pesoKg: 83, grasaPct: 21.5, alturaCm: 178 })
    await request(http())
      .post(ruta("pruebas"))
      .set(como("entrenador"))
      .send({
        operacionId: randomUUID(),
        fecha: "2026-06-01",
        nombre: "Flexiones seguidas",
        valor: 32,
        unidad: "reps",
      })
      .expect(201)
    await prisma.pruebaFisica.create({
      data: {
        clienteId: ids.cliente!,
        autorId: ids.cliente!,
        operacionId: randomUUID(),
        pruebaId: pruebaLegada,
        fecha: new Date("2026-05-11T00:00:00.000Z"),
        nombre: "Plancha",
        valor: 75,
        unidad: "s",
      },
    })
    await request(http())
      .put(ruta("dias/2026-06-01"))
      .set(como("cliente"))
      .send({ pesoKg: 83.4 })
      .expect(200)
    // Un día sin peso no es un peso cero.
    await request(http())
      .put(ruta("dias/2026-06-02"))
      .set(como("cliente"))
      .send({ pasos: 8000 })
      .expect(200)

    // Visita inicial el mismo día que el histórico del equipo; flexiones otro día.
    inicial = await guardar(
      await crear({ tipo: "inicial", fechaToma: "2026-06-01", bloques: TODOS }),
      {
        corporales: [
          { definicionId: peso.id, estado: "registrado", valor: 83.1 },
          { definicionId: cintura.id, estado: "registrado", valor: 90.5 },
          { definicionId: pliegue.id, estado: "registrado", valor: 14.2, lecturas: [14.2, 14.4] },
        ],
        grasaPorPliegues: { valorPct: 18.4, metodo: "Método sintético", fecha: "2026-06-01" },
        pruebas: [
          {
            definicionId: flexiones.id,
            estado: "registrado",
            valores: { repeticiones: 25 },
            protocoloCompleto: true,
            fecha: "2026-06-03",
            notas: null,
          },
          {
            definicionId: cooper.id,
            estado: "registrado",
            valores: { distancia: 2400, duracion: 720, fcFinal: 172 },
            protocoloCompleto: true,
            fecha: null,
            notas: null,
          },
        ],
      },
    )
    pubInicial = await publicar(inicial)

    // Revisión, publicada y después corregida.
    revision = await guardar(
      await crear({
        tipo: "revision",
        fechaToma: "2026-07-06",
        bloques: SIN_PLIEGUES,
        anteriorId: inicial.id,
        cumplePauta: null,
      }),
      {
        corporales: [
          { definicionId: peso.id, estado: "registrado", valor: 81.9 },
          { definicionId: cintura.id, estado: "noRealizado", motivo: null },
        ],
        pruebas: [
          {
            definicionId: flexiones.id,
            estado: "registrado",
            valores: { repeticiones: 28 },
            protocoloCompleto: true,
            fecha: null,
            notas: null,
          },
          {
            definicionId: cooper.id,
            estado: "registrado",
            valores: { distancia: 1900, duracion: 540 },
            protocoloCompleto: false,
            fecha: null,
            notas: null,
          },
        ],
      },
    )
    pubRevision = await publicar(revision)
    const correccion = await crear({ corrigePublicacionId: pubRevision.id })
    const corregida = await guardar(correccion, {
      corporales: correccion.borrador!.documento.corporales.map((r) =>
        r.definicionId === peso.id
          ? { definicionId: peso.id, estado: "registrado" as const, valor: 81.6 }
          : r,
      ),
    })
    pubCorregida = await publicar(corregida, pubRevision.id)

    // Borrador sin publicar: nunca aparece.
    borrador = await guardar(
      await crear({
        tipo: "revision",
        fechaToma: "2026-07-20",
        bloques: SIN_PLIEGUES,
        anteriorId: revision.id,
        cumplePauta: null,
      }),
      { corporales: [{ definicionId: peso.id, estado: "registrado", valor: 80.5 }] },
    )

    // Cambiar instrumento y variante sube la versión: otra serie.
    await request(http())
      .put(plantilla)
      .set(como("entrenador"))
      .send({
        revision: 1,
        corporales: [{ ...peso, instrumento: "Báscula nueva", version: 2 }, cintura, pliegue],
        pruebas: [{ ...flexiones, variante: "Rodillas apoyadas", version: 2 }, cooper],
      })
      .expect(200)
    tercera = await guardar(
      await crear({
        tipo: "revision",
        fechaToma: "2026-08-10",
        bloques: SIN_PLIEGUES,
        anteriorId: revision.id,
        cumplePauta: null,
      }),
      {
        corporales: [{ definicionId: peso.id, estado: "registrado", valor: 80.9 }],
        pruebas: [
          {
            definicionId: flexiones.id,
            estado: "registrado",
            valores: { repeticiones: 30 },
            protocoloCompleto: true,
            fecha: null,
            notas: null,
          },
        ],
      },
    )
    pubTercera = await publicar(tercera)
    // Prepara cuatro visitas e histórico por HTTP: más que el plazo por defecto de Jest.
  }, 30_000)

  afterAll(async () => {
    await entorno?.cerrar()
  }, 30_000)

  it("une inicial, revisión y corrección: la corrección sustituye su punto sin duplicar la visita", async () => {
    const e = await evolucion("entrenador")
    expect(new Set(claves(e)).size).toBe(e.series.length)
    const pesos = serie(e, c(peso))
    expect(pesos).toMatchObject({
      nombre: "Peso",
      unidad: "kg",
      bloque: "medidas",
      origen: "valoracion",
      metodo: "Báscula sintética",
      clasificada: true,
    })
    expect(pesos.puntos).toEqual([
      {
        fecha: "2026-06-01",
        valor: 83.1,
        publicacionId: pubInicial.id,
        valoracionId: inicial.id,
        corregido: false,
      },
      {
        fecha: "2026-07-06",
        valor: 81.6,
        publicacionId: pubCorregida.id,
        valoracionId: revision.id,
        corregido: true,
      },
    ])
    // La versión sustituida se conserva como auditoría, pero no aporta puntos.
    const puntos = e.series.flatMap((s) => s.puntos)
    expect(puntos.some((punto) => punto.publicacionId === pubRevision.id)).toBe(false)
    for (const s of e.series) {
      const visitas = s.puntos.map((punto) => punto.valoracionId).filter((id) => id !== null)
      expect(new Set(visitas).size).toBe(visitas.length)
    }

    // La prueba usa su propia fecha si se hizo otro día que la visita.
    const reps = serie(e, p(flexiones, "repeticiones"))
    expect(reps).toMatchObject({
      nombre: "Flexiones en 1 minuto",
      unidad: "reps",
      bloque: "pruebas",
    })
    expect(reps.metodo).toContain("60 s")
    expect(reps.puntos.map((punto) => [punto.fecha, punto.valor, punto.corregido])).toEqual([
      ["2026-06-03", 25, false],
      ["2026-07-06", 28, true],
    ])

    // Un «no realizado» no es un punto.
    const cinturas = serie(e, c(cintura))
    expect(valores(cinturas)).toEqual([["2026-06-01", 90.5]])
    expect(cinturas.metodo).toBe("Cintura · Cinta")
    expect(serie(e, c(pliegue))).toMatchObject({
      bloque: "pliegues",
      unidad: "mm",
      metodo: "Zona A · derecha · Plicómetro",
    })
    expect(valores(serie(e, "g:pliegues:Método sintético"))).toEqual([["2026-06-01", 18.4]])
  })

  it("un borrador nunca aparece", async () => {
    for (const rol of ["entrenador", "cliente"]) {
      const e = await evolucion(rol)
      const puntos = e.series.flatMap((s) => s.puntos)
      expect(puntos.some((punto) => punto.valoracionId === borrador.id)).toBe(false)
      expect(puntos.some((punto) => punto.valor === 80.5)).toBe(false)
    }
  })

  it("cambiar variante, instrumento o versión abre otra serie", async () => {
    const e = await evolucion("entrenador")
    expect(valores(serie(e, c(peso, 2)))).toEqual([["2026-08-10", 80.9]])
    expect(serie(e, c(peso, 2)).metodo).toBe("Báscula nueva")
    expect(valores(serie(e, c(peso, 1)))).toEqual([
      ["2026-06-01", 83.1],
      ["2026-07-06", 81.6],
    ])
    const v2 = serie(e, p(flexiones, "repeticiones", 2))
    expect(v2.metodo).toContain("Rodillas apoyadas")
    expect(v2.puntos).toEqual([
      {
        fecha: "2026-08-10",
        valor: 30,
        publicacionId: pubTercera.id,
        valoracionId: tercera.id,
        corregido: false,
      },
    ])
    expect(valores(serie(e, p(flexiones, "repeticiones", 1)))).toHaveLength(2)
  })

  it("unidades y métricas distintas nunca comparten serie; un protocolo incompleto va aparte", async () => {
    const e = await evolucion("entrenador")
    expect(serie(e, p(cooper, "distancia"))).toMatchObject({ nombre: "Cooper", unidad: "m" })
    expect(valores(serie(e, p(cooper, "distancia")))).toEqual([["2026-06-01", 2400]])
    expect(serie(e, p(cooper, "duracion")).unidad).toBe("s")
    expect(serie(e, p(cooper, "fcFinal"))).toMatchObject({ unidad: "lpm" })
    // Una métrica opcional no recogida no crea serie ni cero.
    expect(claves(e)).not.toContain(p(cooper, "fcMedia"))
    const incompleta = serie(e, `${p(cooper, "distancia")}:incompleto`)
    expect(valores(incompleta)).toEqual([["2026-07-06", 1900]])
    expect(incompleta.metodo).toContain("Protocolo incompleto")
    // Cada clave agrupa una sola unidad y un solo origen.
    const porClave = new Map<string, string>()
    for (const s of e.series) {
      expect(porClave.get(s.clave)).toBeUndefined()
      porClave.set(s.clave, `${s.unidad}|${s.origen}`)
    }
  })

  it("el histórico va en series propias, sin clasificar, aunque coincida la fecha con una visita", async () => {
    const e = await evolucion("entrenador")
    expect(serie(e, "h:medida:pesoKg:historico")).toEqual({
      clave: "h:medida:pesoKg:historico",
      nombre: "Peso",
      unidad: "kg",
      bloque: null,
      origen: "historico",
      metodo: null,
      clasificada: false,
      puntos: [
        {
          fecha: "2026-06-01",
          valor: 83,
          publicacionId: null,
          valoracionId: null,
          corregido: false,
        },
      ],
    })
    expect(serie(e, "h:medida:pesoKg:autorregistro")).toMatchObject({
      origen: "autorregistro",
      clasificada: false,
    })
    expect(valores(serie(e, "h:medida:pesoKg:autorregistro"))).toEqual([["2026-05-04", 84.2]])
    expect(valores(serie(e, "h:medida:grasaPct:historico"))).toEqual([["2026-06-01", 21.5]])
    expect(serie(e, "h:medida:grasaPct:historico").unidad).toBe("%")
    expect(valores(serie(e, "h:medida:alturaCm:historico"))).toEqual([["2026-06-01", 178]])
    // Campos que nunca se anotaron no se convierten en cero.
    expect(claves(e).some((clave) => clave.startsWith("h:medida:cinturaCm"))).toBe(false)
    expect(serie(e, "h:dia:pesoKg")).toMatchObject({ origen: "autorregistro", clasificada: false })
    expect(valores(serie(e, "h:dia:pesoKg"))).toEqual([["2026-06-01", 83.4]])

    // Mismo día (2026-06-01): tres procedencias, tres series.
    const delDia = e.series.filter((s) =>
      s.puntos.some((punto) => punto.fecha === "2026-06-01" && s.unidad === "kg"),
    )
    expect(delDia.map((s) => s.clave).sort()).toEqual(
      [c(peso), "h:dia:pesoKg", "h:medida:pesoKg:historico"].sort(),
    )

    // Las «flexiones seguidas» del histórico nunca se mezclan con la prueba de la visita.
    const libres = serie(e, "h:prueba-libre:Flexiones seguidas|reps:historico")
    expect(libres).toMatchObject({ nombre: "Flexiones seguidas", unidad: "reps", bloque: null })
    expect(valores(libres)).toEqual([["2026-06-01", 32]])
    expect(valores(serie(e, `h:prueba:${pruebaLegada}:s:autorregistro`))).toEqual([
      ["2026-05-11", 75],
    ])
    for (const s of e.series) {
      const deVisita = s.origen === "valoracion"
      expect(s.clasificada).toBe(deVisita)
      expect(s.puntos.every((punto) => (punto.valoracionId !== null) === deVisita)).toBe(true)
      const fechas = s.puntos.map((punto) => punto.fecha)
      expect(fechas).toEqual([...fechas].sort())
    }
  })

  it("filtra por periodo y omite las series que se quedan sin puntos", async () => {
    const e = await evolucion("entrenador", "?desde=2026-06-02&hasta=2026-07-31")
    expect(valores(serie(e, c(peso)))).toEqual([["2026-07-06", 81.6]])
    expect(valores(serie(e, p(flexiones, "repeticiones")))).toEqual([
      ["2026-06-03", 25],
      ["2026-07-06", 28],
    ])
    expect(claves(e).some((clave) => clave.startsWith("h:"))).toBe(false)
    expect(claves(e)).not.toContain(c(peso, 2))
    expect(claves(e)).not.toContain(c(cintura))
    for (const s of e.series) {
      expect(s.puntos.length).toBeGreaterThan(0)
      expect(s.puntos.every((punto) => punto.fecha >= "2026-06-02")).toBe(true)
      expect(s.puntos.every((punto) => punto.fecha <= "2026-07-31")).toBe(true)
    }
    const desde = await evolucion("entrenador", "?desde=2026-08-01")
    expect(claves(desde).sort()).toEqual([c(peso, 2), p(flexiones, "repeticiones", 2)].sort())
    const hasta = await evolucion("entrenador", "?hasta=2026-05-31")
    expect(claves(hasta).sort()).toEqual(
      ["h:medida:pesoKg:autorregistro", `h:prueba:${pruebaLegada}:s:autorregistro`].sort(),
    )
    for (const consulta of ["?desde=2026-08-01&hasta=2026-07-01", "?desde=ayer", "?limite=3"])
      await request(http())
        .get(ruta(`evolucion${consulta}`))
        .set(entorno.como("entrenador"))
        .expect(400)
  })

  it("el cliente ve lo publicado y su histórico; el nutricionista asignado, sin pruebas", async () => {
    const { como, ids, prisma } = entorno
    const entrenador = await evolucion("entrenador")
    expect(await evolucion("cliente")).toEqual(entrenador)

    await request(http()).get(ruta("evolucion")).set(como("nutricionista")).expect(403)
    await prisma.asignacionNutricionista.create({
      data: { nutricionistaId: ids.nutricionista!, clienteId: ids.cliente! },
    })
    try {
      const nutricion = await evolucion("nutricionista")
      const esPrueba = (clave: string) => clave.startsWith("p:") || clave.startsWith("h:prueba")
      expect(claves(nutricion).some(esPrueba)).toBe(false)
      expect(nutricion.series).toEqual(entrenador.series.filter((s) => !esPrueba(s.clave)))
      expect(claves(nutricion)).toEqual(
        expect.arrayContaining([
          c(peso),
          c(cintura),
          c(pliegue),
          "g:pliegues:Método sintético",
          "h:medida:pesoKg:historico",
          "h:dia:pesoKg",
        ]),
      )
    } finally {
      await prisma.asignacionNutricionista.deleteMany({
        where: { nutricionistaId: ids.nutricionista! },
      })
    }
    await request(http()).get(ruta("evolucion")).set(como("nutricionista")).expect(403)
  })

  it("nadie ve la evolución de otro cliente", async () => {
    const { como, ids } = entorno
    await request(http()).get(ruta("evolucion")).set(como("otro")).expect(403)
    await request(http()).get(ruta("evolucion", ids.otro!)).set(como("cliente")).expect(403)
    await request(http()).get(ruta("evolucion")).set(como("empleado")).expect(403)
    await request(http()).get(ruta("evolucion")).expect(401)
    await request(http()).get(ruta("evolucion", randomUUID())).set(como("entrenador")).expect(404)
  })
})
