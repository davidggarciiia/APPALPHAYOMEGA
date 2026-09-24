import { randomUUID } from "node:crypto"
import request from "supertest"
import {
  ErrorDeApiSchema,
  ListadoValoracionesPublicadasSchema,
  ListadoValoracionesSchema,
  PlantillaValoracionSchema,
  ValoracionProfesionalSchema,
  type ContenidoValoracion,
  type DefinicionCorporal,
  type DefinicionPrueba,
  type ValoracionProfesional,
} from "@alpha-omega/shared"
import { entornoEntrenamiento } from "./entrenamiento-ayuda.js"

// Datos sintéticos: definiciones y valores inventados para la prueba.
const peso: DefinicionCorporal = {
  id: randomUUID(),
  version: 1,
  bloque: "medidas",
  magnitud: "peso",
  nombre: "Peso",
  unidad: "kg",
  zona: null,
  lateralidad: null,
  instrumento: "Báscula del centro",
  protocolo: null,
  activa: true,
}
const perimetro: DefinicionCorporal = {
  ...peso,
  id: randomUUID(),
  magnitud: "perimetro",
  nombre: "Perímetro A",
  unidad: "cm",
  zona: "Zona configurada",
  instrumento: "Cinta",
}
const inactiva: DefinicionCorporal = {
  ...perimetro,
  id: randomUUID(),
  nombre: "Retirada",
  activa: false,
}
const pliegue: DefinicionCorporal = {
  ...peso,
  id: randomUUID(),
  bloque: "pliegues",
  magnitud: "pliegue",
  nombre: "Punto A",
  unidad: "mm",
  instrumento: "Plicómetro",
}
const flexiones: DefinicionPrueba = {
  id: randomUUID(),
  version: 1,
  tipo: "flexiones1min",
  nombre: "Flexiones en 1 minuto",
  variante: null,
  protocolo: null,
  duracionPrescritaS: 60,
  instrumento: null,
  metricas: [
    {
      clave: "repeticiones",
      nombre: "Repeticiones",
      unidad: "reps",
      principal: true,
      opcional: false,
    },
  ],
  activa: true,
}

describe("Valoraciones: plantilla, visitas y borradores (V03)", () => {
  let entorno: Awaited<ReturnType<typeof entornoEntrenamiento>>
  beforeAll(async () => {
    entorno = await entornoEntrenamiento("valoraciones")
  })
  afterAll(async () => {
    await entorno?.cerrar()
  })
  const ruta = (clienteId: string, resto: string) => `/seguimiento/clientes/${clienteId}/${resto}`
  const http = () => entorno.app.getHttpServer()

  async function crear(
    cuerpo: Record<string, unknown>,
    rol = "entrenador",
    esperado = 201,
  ): Promise<request.Response> {
    return request(http())
      .post(ruta(entorno.ids.cliente!, "valoraciones"))
      .set(entorno.como(rol))
      .send(cuerpo)
      .expect(esperado)
  }

  function contenido(v: ValoracionProfesional, cambios: Partial<ContenidoValoracion> = {}) {
    const d = v.borrador!.documento
    const actual: ContenidoValoracion = {
      bloques: d.bloques,
      corporales: d.corporales,
      pruebas: d.pruebas,
      grasaPorPliegues: d.grasaPorPliegues,
      destacados: d.destacados,
      conclusion: d.conclusion,
      notasInternas: d.notasInternas,
    }
    return { ...actual, ...cambios }
  }

  it("la plantilla es del entrenador: versiona cambios de medida y rechaza revisiones obsoletas", async () => {
    const url = ruta(entorno.ids.cliente!, "plantilla-valoracion")
    const vacia = PlantillaValoracionSchema.parse(
      (await request(http()).get(url).set(entorno.como("entrenador")).expect(200)).body,
    )
    expect(vacia).toEqual({ revision: 0, corporales: [], pruebas: [] })
    await request(http()).get(url).set(entorno.como("cliente")).expect(403)
    await request(http()).get(url).set(entorno.como("nutricionista")).expect(403)
    const datos = {
      revision: 0,
      corporales: [peso, perimetro, inactiva, pliegue],
      pruebas: [flexiones],
    }
    await request(http()).put(url).set(entorno.como("cliente")).send(datos).expect(403)
    const guardada = PlantillaValoracionSchema.parse(
      (await request(http()).put(url).set(entorno.como("entrenador")).send(datos).expect(200)).body,
    )
    expect(guardada.revision).toBe(1)
    // Cambiar el instrumento sin subir la versión no se admite; renombrar sí.
    await request(http())
      .put(url)
      .set(entorno.como("entrenador"))
      .send({
        ...guardada,
        corporales: [{ ...peso, instrumento: "Otra" }, perimetro, inactiva, pliegue],
      })
      .expect(400)
    await request(http())
      .put(url)
      .set(entorno.como("entrenador"))
      .send({ ...guardada, corporales: [peso, perimetro, pliegue] })
      .expect(400)
    const renombrada = PlantillaValoracionSchema.parse(
      (
        await request(http())
          .put(url)
          .set(entorno.como("entrenador"))
          .send({
            ...guardada,
            corporales: [{ ...peso, nombre: "Peso en báscula" }, perimetro, inactiva, pliegue],
          })
          .expect(200)
      ).body,
    )
    expect(renombrada.corporales[0]).toMatchObject({ nombre: "Peso en báscula", version: 1 })
    ErrorDeApiSchema.parse(
      (await request(http()).put(url).set(entorno.como("entrenador")).send(guardada).expect(409))
        .body,
    )
  })

  it("crea una visita con copia de la plantilla y es idempotente por operación", async () => {
    const operacionId = randomUUID()
    const cuerpo = {
      operacionId,
      tipo: "inicial",
      fechaToma: "2026-09-24",
      bloques: ["medidas", "pruebas"],
    }
    await crear(cuerpo, "cliente", 403)
    await crear(cuerpo, "nutricionista", 403)
    const creada = ValoracionProfesionalSchema.parse((await crear(cuerpo)).body)
    expect(creada).toMatchObject({
      tipo: "inicial",
      estado: "borrador",
      anteriorId: null,
      publicacion: null,
    })
    const documento = creada.borrador!.documento
    expect(documento.definiciones.corporales.map((d) => d.id)).toEqual([peso.id, perimetro.id])
    expect(documento.definiciones.pruebas.map((d) => d.id)).toEqual([flexiones.id])
    expect(
      [...documento.corporales, ...documento.pruebas].every((r) => r.estado === "pendiente"),
    ).toBe(true)
    const repetida = ValoracionProfesionalSchema.parse((await crear(cuerpo)).body)
    expect(repetida.id).toBe(creada.id)
    expect(
      ErrorDeApiSchema.parse(
        (await crear({ ...cuerpo, fechaToma: "2026-09-23" }, "entrenador", 409)).body,
      ).codigo,
    ).toBe("operacion_incompatible")
    expect(
      await entorno.prisma.valoracion.count({ where: { clienteId: entorno.ids.cliente! } }),
    ).toBe(1)
  })

  it("guarda y relee un borrador parcial; una revisión obsoleta no pisa lo guardado", async () => {
    const creada = ValoracionProfesionalSchema.parse(
      (
        await crear({
          operacionId: randomUUID(),
          tipo: "inicial",
          fechaToma: "2026-09-24",
          bloques: ["medidas", "pruebas"],
        })
      ).body,
    )
    const url = ruta(entorno.ids.cliente!, `valoraciones/${creada.id}`)
    const cambio = {
      borradorId: creada.borrador!.id,
      revision: creada.borrador!.revision,
      fechaToma: "2026-09-22",
      contenido: contenido(creada, {
        corporales: [
          { definicionId: peso.id, estado: "registrado", valor: 80.5 },
          { definicionId: perimetro.id, estado: "noRealizado", motivo: null },
        ],
        pruebas: [
          {
            definicionId: flexiones.id,
            estado: "registrado",
            valores: { repeticiones: 0 },
            protocoloCompleto: true,
            fecha: null,
            notas: null,
          },
        ],
        conclusion: "Conclusión sintética",
        notasInternas: "Nota interna sintética",
        destacados: [peso.id],
      }),
    }
    await request(http()).put(url).set(entorno.como("cliente")).send(cambio).expect(403)
    const guardada = ValoracionProfesionalSchema.parse(
      (await request(http()).put(url).set(entorno.como("entrenador")).send(cambio).expect(200))
        .body,
    )
    expect(guardada.borrador!.revision).toBe(creada.borrador!.revision + 1)
    const releida = ValoracionProfesionalSchema.parse(
      (await request(http()).get(url).set(entorno.como("entrenador")).expect(200)).body,
    )
    expect(releida.borrador).toEqual(guardada.borrador)
    expect(releida.borrador!.fechaToma).toBe("2026-09-22")
    expect(releida.borrador!.documento.pruebas[0]).toMatchObject({ valores: { repeticiones: 0 } })

    const obsoleto = await request(http())
      .put(url)
      .set(entorno.como("entrenador"))
      .send({ ...cambio, contenido: { ...cambio.contenido, conclusion: "Otra" } })
      .expect(409)
    expect(ErrorDeApiSchema.parse(obsoleto.body).codigo).toBe("revision_obsoleta")
    const ajeno = await request(http())
      .put(url)
      .set(entorno.como("entrenador"))
      .send({ ...cambio, borradorId: randomUUID(), revision: guardada.borrador!.revision })
      .expect(409)
    expect(ErrorDeApiSchema.parse(ajeno.body).codigo).toBe("estado_incompatible")
    const intacta = ValoracionProfesionalSchema.parse(
      (await request(http()).get(url).set(entorno.como("entrenador")).expect(200)).body,
    )
    expect(intacta.borrador!.documento.conclusion).toBe("Conclusión sintética")

    await request(http())
      .put(url)
      .set(entorno.como("entrenador"))
      .send({
        ...cambio,
        revision: intacta.borrador!.revision,
        contenido: {
          ...cambio.contenido,
          corporales: [{ definicionId: peso.id, estado: "registrado", valor: 900 }],
        },
      })
      .expect(400)
  })

  it("añadir un bloque trae sus definiciones y no se retira uno con resultados", async () => {
    const creada = ValoracionProfesionalSchema.parse(
      (
        await crear({
          operacionId: randomUUID(),
          tipo: "inicial",
          fechaToma: "2026-09-24",
          bloques: ["medidas"],
        })
      ).body,
    )
    const url = ruta(entorno.ids.cliente!, `valoraciones/${creada.id}`)
    const conPliegues = ValoracionProfesionalSchema.parse(
      (
        await request(http())
          .put(url)
          .set(entorno.como("entrenador"))
          .send({
            borradorId: creada.borrador!.id,
            revision: creada.borrador!.revision,
            fechaToma: "2026-09-24",
            contenido: contenido(creada, {
              bloques: ["medidas", "pliegues"],
              corporales: [{ definicionId: peso.id, estado: "registrado", valor: 81 }],
            }),
          })
          .expect(200)
      ).body,
    )
    const doc = conPliegues.borrador!.documento
    expect(doc.definiciones.corporales.map((d) => d.id)).toEqual([
      peso.id,
      perimetro.id,
      pliegue.id,
    ])
    expect(doc.corporales.find((r) => r.definicionId === pliegue.id)?.estado).toBe("pendiente")
    await request(http())
      .put(url)
      .set(entorno.como("entrenador"))
      .send({
        borradorId: conPliegues.borrador!.id,
        revision: conPliegues.borrador!.revision,
        fechaToma: "2026-09-24",
        contenido: contenido(conPliegues, { bloques: ["pliegues"] }),
      })
      .expect(400)
  })

  it("una revisión copia definiciones, nunca resultados, y exige una visita anterior del cliente", async () => {
    const { prisma, ids } = entorno
    const anterior = await prisma.valoracion.findFirstOrThrow({
      where: { clienteId: ids.cliente! },
      orderBy: { creadaEn: "asc" },
    })
    const base = {
      tipo: "revision",
      fechaToma: "2026-10-24",
      bloques: ["medidas", "pruebas"],
      cumplePauta: null,
    }
    // Sin próxima revisión pautada no hay nada que cumplir todavía.
    await crear(
      { ...base, operacionId: randomUUID(), anteriorId: anterior.id, cumplePauta: 1 },
      "entrenador",
      409,
    )
    await crear({ ...base, operacionId: randomUUID(), anteriorId: randomUUID() }, "entrenador", 404)
    const revision = ValoracionProfesionalSchema.parse(
      (await crear({ ...base, operacionId: randomUUID(), anteriorId: anterior.id })).body,
    )
    expect(revision).toMatchObject({ tipo: "revision", anteriorId: anterior.id })
    const doc = revision.borrador!.documento
    expect([...doc.corporales, ...doc.pruebas].every((r) => r.estado === "pendiente")).toBe(true)
    expect(doc.conclusion).toBeNull()
    expect(doc.notasInternas).toBeNull()
  })

  it("cliente y nutricionista no ven borradores; nadie ve datos de otro cliente", async () => {
    const { prisma, ids, como } = entorno
    const visita = await prisma.valoracion.findFirstOrThrow({ where: { clienteId: ids.cliente! } })
    const lista = ruta(ids.cliente!, "valoraciones")
    const porId = ruta(ids.cliente!, `valoraciones/${visita.id}`)
    expect(
      ListadoValoracionesPublicadasSchema.parse(
        (await request(http()).get(lista).set(como("cliente")).expect(200)).body,
      ),
    ).toEqual({ valoraciones: [], total: 0 })
    await request(http()).get(porId).set(como("cliente")).expect(404)
    await request(http()).get(porId).set(como("nutricionista")).expect(403)
    await request(http()).get(porId).set(como("otro")).expect(403)
    await request(http())
      .get(ruta(ids.otro!, `valoraciones/${visita.id}`))
      .set(como("entrenador"))
      .expect(404)
    await prisma.asignacionNutricionista.create({
      data: { nutricionistaId: ids.nutricionista!, clienteId: ids.cliente! },
    })
    try {
      await request(http()).get(porId).set(como("nutricionista")).expect(404)
      expect(
        ListadoValoracionesPublicadasSchema.parse(
          (await request(http()).get(lista).set(como("nutricionista")).expect(200)).body,
        ).total,
      ).toBe(0)
    } finally {
      await prisma.asignacionNutricionista.deleteMany({
        where: { nutricionistaId: ids.nutricionista! },
      })
    }
  })

  it("el historial del entrenador se pagina", async () => {
    const url = ruta(entorno.ids.cliente!, "valoraciones")
    const todas = ListadoValoracionesSchema.parse(
      (await request(http()).get(url).set(entorno.como("entrenador")).expect(200)).body,
    )
    expect(todas.total).toBeGreaterThanOrEqual(3)
    const pagina = ListadoValoracionesSchema.parse(
      (
        await request(http())
          .get(`${url}?limite=1&desplazamiento=1`)
          .set(entorno.como("entrenador"))
          .expect(200)
      ).body,
    )
    expect(pagina.total).toBe(todas.total)
    expect(pagina.valoraciones.map((v) => v.id)).toEqual([todas.valoraciones[1]!.id])
    expect(todas.valoraciones.every((v) => v.estado === "borrador")).toBe(true)
    await request(http()).get(`${url}?limite=0`).set(entorno.como("entrenador")).expect(400)
  })
})
