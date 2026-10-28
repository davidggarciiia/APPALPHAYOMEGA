import { randomUUID } from "node:crypto"
import { jest } from "@jest/globals"
import request from "supertest"
import type { Prisma } from "@prisma/client"
import {
  ErrorDeApiSchema,
  ListadoValoracionesPublicadasSchema,
  ListadoValoracionesSchema,
  PlantillaValoracionSchema,
  ProximaRevisionSchema,
  PublicacionValoracionSchema,
  ValoracionClienteSchema,
  ValoracionCorporalSchema,
  ValoracionProfesionalSchema,
  VERSION_CONSENTIMIENTO,
  type ContenidoValoracion,
  type DefinicionCorporal,
  type DefinicionPrueba,
  type ValoracionProfesional,
} from "@alpha-omega/shared"
import { entornoEntrenamiento } from "./entrenamiento-ayuda.js"
import { ValoracionesService } from "../src/seguimiento/valoraciones.service.js"
import { esperarPausa } from "./concurrencia-ayuda.js"
import { ConsentimientoService } from "../src/identity/consentimiento.service.js"

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

describe("Valoraciones: publicar y corregir (V05)", () => {
  let entorno: Awaited<ReturnType<typeof entornoEntrenamiento>>
  beforeAll(async () => {
    entorno = await entornoEntrenamiento("valoraciones-publicacion")
    await request(entorno.app.getHttpServer())
      .put(`/seguimiento/clientes/${entorno.ids.cliente!}/plantilla-valoracion`)
      .set(entorno.como("entrenador"))
      .send({ revision: 0, corporales: [peso, pliegue], pruebas: [flexiones] })
      .expect(200)
  })
  afterAll(async () => {
    await entorno?.cerrar()
  })
  const http = () => entorno.app.getHttpServer()
  const ruta = (resto: string) => `/seguimiento/clientes/${entorno.ids.cliente!}/${resto}`

  async function visitaGuardada(): Promise<ValoracionProfesional> {
    const creada = ValoracionProfesionalSchema.parse(
      (
        await request(http())
          .post(ruta("valoraciones"))
          .set(entorno.como("entrenador"))
          .send({
            operacionId: randomUUID(),
            tipo: "inicial",
            fechaToma: "2026-09-24",
            bloques: ["medidas", "pliegues", "pruebas"],
          })
          .expect(201)
      ).body,
    )
    return ValoracionProfesionalSchema.parse(
      (
        await request(http())
          .put(ruta(`valoraciones/${creada.id}`))
          .set(entorno.como("entrenador"))
          .send({
            borradorId: creada.borrador!.id,
            revision: creada.borrador!.revision,
            fechaToma: "2026-09-24",
            contenido: {
              bloques: ["medidas", "pliegues", "pruebas"],
              corporales: [
                { definicionId: peso.id, estado: "registrado", valor: 82.4 },
                { definicionId: pliegue.id, estado: "pendiente", lecturas: [14.2] },
              ],
              pruebas: [
                {
                  definicionId: flexiones.id,
                  estado: "registrado",
                  valores: { repeticiones: 21 },
                  protocoloCompleto: true,
                  fecha: null,
                  notas: "Nota visible sintética",
                },
              ],
              grasaPorPliegues: null,
              destacados: [peso.id],
              conclusion: "Conclusión visible sintética",
              notasInternas: "Nota interna sintética",
            },
          })
          .expect(200)
      ).body,
    )
  }

  const publicar = (v: ValoracionProfesional, cambios: Record<string, unknown> = {}) =>
    request(http())
      .post(ruta(`valoraciones/${v.id}/publicaciones`))
      .set(entorno.como("entrenador"))
      .send({
        operacionId: randomUUID(),
        borradorId: v.borrador!.id,
        revision: v.borrador!.revision,
        sustituyePublicacionId: null,
        ...cambios,
      })

  it("publica una versión parcial que cada rol lee con su proyección; repetir no duplica", async () => {
    const v = await visitaGuardada()
    const operacionId = randomUUID()
    await publicar(v, { operacionId }).set(entorno.como("cliente")).expect(403)
    const primera = PublicacionValoracionSchema.parse(
      (await publicar(v, { operacionId }).expect(201)).body,
    )
    expect(primera).toMatchObject({ numero: 1, sustituyeId: null, fechaToma: "2026-09-24" })
    expect(JSON.stringify(primera)).not.toContain("Nota interna sintética")
    expect(primera.documento.corporales.map((r) => r.definicionId)).toEqual([peso.id])
    expect(primera.documento.pruebas[0]).toMatchObject({ notas: "Nota visible sintética" })

    const repetida = PublicacionValoracionSchema.parse(
      (await publicar(v, { operacionId }).expect(201)).body,
    )
    expect(repetida.id).toBe(primera.id)
    const otra = await publicar(v, { operacionId, revision: v.borrador!.revision + 7 }).expect(409)
    expect(ErrorDeApiSchema.parse(otra.body).codigo).toBe("operacion_incompatible")
    const cerrada = await publicar(v).expect(409)
    expect(ErrorDeApiSchema.parse(cerrada.body).codigo).toBe("estado_incompatible")

    const cliente = ValoracionClienteSchema.parse(
      (
        await request(http())
          .get(ruta(`valoraciones/${v.id}`))
          .set(entorno.como("cliente"))
          .expect(200)
      ).body,
    )
    expect(cliente.publicacion.id).toBe(primera.id)
    expect(JSON.stringify(cliente)).not.toContain("Nota interna sintética")
    expect(
      ListadoValoracionesPublicadasSchema.parse(
        (await request(http()).get(ruta("valoraciones")).set(entorno.como("cliente")).expect(200))
          .body,
      ).valoraciones.map((f) => [f.id, f.numeroPublicacion]),
    ).toEqual([[v.id, 1]])

    await entorno.prisma.asignacionNutricionista.create({
      data: { nutricionistaId: entorno.ids.nutricionista!, clienteId: entorno.ids.cliente! },
    })
    try {
      const corporal = ValoracionCorporalSchema.parse(
        (
          await request(http())
            .get(ruta(`valoraciones/${v.id}`))
            .set(entorno.como("nutricionista"))
            .expect(200)
        ).body,
      )
      expect(corporal.corporales.map((r) => r.definicionId)).toEqual([peso.id])
      expect(JSON.stringify(corporal)).not.toContain("Conclusión visible sintética")
    } finally {
      await entorno.prisma.asignacionNutricionista.deleteMany({
        where: { nutricionistaId: entorno.ids.nutricionista! },
      })
    }

    const profesional = ValoracionProfesionalSchema.parse(
      (
        await request(http())
          .get(ruta(`valoraciones/${v.id}`))
          .set(entorno.como("entrenador"))
          .expect(200)
      ).body,
    )
    expect(profesional).toMatchObject({ estado: "publicada", borrador: null })
    expect(profesional.documentoVigente?.notasInternas).toBe("Nota interna sintética")
  })

  it("una revisión obsoleta o un borrador ajeno no publican nada", async () => {
    const v = await visitaGuardada()
    const obsoleta = await publicar(v, { revision: v.borrador!.revision - 1 }).expect(409)
    expect(ErrorDeApiSchema.parse(obsoleta.body).codigo).toBe("revision_obsoleta")
    const ajeno = await publicar(v, { borradorId: randomUUID() }).expect(409)
    expect(ErrorDeApiSchema.parse(ajeno.body).codigo).toBe("estado_incompatible")
    const sustituye = await publicar(v, { sustituyePublicacionId: randomUUID() }).expect(409)
    expect(ErrorDeApiSchema.parse(sustituye.body).codigo).toBe("estado_incompatible")
    expect(
      await entorno.prisma.publicacionValoracion.count({ where: { valoracionId: v.id } }),
    ).toBe(0)
  })

  it("dos publicaciones simultáneas del mismo borrador dejan una sola versión", async () => {
    const v = await visitaGuardada()
    const [a, b] = await Promise.all([publicar(v), publicar(v)])
    expect([a.status, b.status].sort()).toEqual([201, 409])
    expect(
      await entorno.prisma.publicacionValoracion.count({ where: { valoracionId: v.id } }),
    ).toBe(1)
  })

  it("corregir parte del documento interno, sustituye la versión vigente y no crea otra visita", async () => {
    const v = await visitaGuardada()
    const primera = PublicacionValoracionSchema.parse((await publicar(v).expect(201)).body)
    const corregir = (operacionId = randomUUID()) =>
      request(http())
        .post(ruta("valoraciones"))
        .set(entorno.como("entrenador"))
        .send({ operacionId, corrigePublicacionId: primera.id })
    const operacionId = randomUUID()
    const correccion = ValoracionProfesionalSchema.parse(
      (await corregir(operacionId).expect(201)).body,
    )
    expect(correccion.id).toBe(v.id)
    expect(correccion.estado).toBe("corrigiendo")
    expect(correccion.borrador!.corrigePublicacionId).toBe(primera.id)
    expect(correccion.borrador!.revision).toBeGreaterThan(v.borrador!.revision)
    expect(correccion.borrador!.documento.notasInternas).toBe("Nota interna sintética")
    expect(correccion.borrador!.documento.corporales[1]).toEqual({
      definicionId: pliegue.id,
      estado: "pendiente",
      lecturas: [14.2],
    })
    expect(
      ValoracionProfesionalSchema.parse((await corregir(operacionId).expect(201)).body).borrador!
        .id,
    ).toBe(correccion.borrador!.id)
    expect(ErrorDeApiSchema.parse((await corregir().expect(409)).body).codigo).toBe(
      "estado_incompatible",
    )

    // Un guardado antiguo del borrador ya publicado no pisa la corrección.
    const antiguo = await request(http())
      .put(ruta(`valoraciones/${v.id}`))
      .set(entorno.como("entrenador"))
      .send({
        borradorId: v.borrador!.id,
        revision: correccion.borrador!.revision,
        fechaToma: "2026-09-24",
        contenido: {
          bloques: ["medidas", "pliegues", "pruebas"],
          corporales: [],
          pruebas: [],
          grasaPorPliegues: null,
          destacados: [],
          conclusion: null,
          notasInternas: null,
        },
      })
      .expect(409)
    expect(ErrorDeApiSchema.parse(antiguo.body).codigo).toBe("estado_incompatible")

    const guardada = ValoracionProfesionalSchema.parse(
      (
        await request(http())
          .put(ruta(`valoraciones/${v.id}`))
          .set(entorno.como("entrenador"))
          .send({
            borradorId: correccion.borrador!.id,
            revision: correccion.borrador!.revision,
            fechaToma: "2026-09-24",
            contenido: {
              ...correccion.borrador!.documento,
              definiciones: undefined,
              corporales: [
                { definicionId: peso.id, estado: "registrado", valor: 82.1 },
                { definicionId: pliegue.id, estado: "registrado", valor: 14.2, lecturas: [14.2] },
              ],
            },
          })
          .expect(200)
      ).body,
    )
    await publicar(guardada).expect(409)
    const segunda = PublicacionValoracionSchema.parse(
      (await publicar(guardada, { sustituyePublicacionId: primera.id }).expect(201)).body,
    )
    expect(segunda).toMatchObject({ numero: 2, sustituyeId: primera.id })
    expect(
      await entorno.prisma.publicacionValoracion.count({ where: { valoracionId: v.id } }),
    ).toBe(2)
    expect(
      await entorno.prisma.valoracion.count({ where: { clienteId: entorno.ids.cliente! } }),
    ).toBe(4)

    const cliente = ValoracionClienteSchema.parse(
      (
        await request(http())
          .get(ruta(`valoraciones/${v.id}`))
          .set(entorno.como("cliente"))
          .expect(200)
      ).body,
    )
    expect(cliente.publicacion).toMatchObject({ id: segunda.id, numero: 2 })
    const lista = ListadoValoracionesPublicadasSchema.parse(
      (await request(http()).get(ruta("valoraciones")).set(entorno.como("cliente")).expect(200))
        .body,
    )
    expect(lista.valoraciones.filter((f) => f.id === v.id)).toEqual([
      expect.objectContaining({ numeroPublicacion: 2 }),
    ])
  })
})

describe("Valoraciones: integridad y operaciones concurrentes", () => {
  let entorno: Awaited<ReturnType<typeof entornoEntrenamiento>>
  beforeAll(async () => {
    entorno = await entornoEntrenamiento("valoraciones-integridad")
    await request(entorno.app.getHttpServer())
      .put(`/seguimiento/clientes/${entorno.ids.cliente!}/plantilla-valoracion`)
      .set(entorno.como("entrenador"))
      .send({ revision: 0, corporales: [peso], pruebas: [] })
      .expect(200)
  })
  afterAll(async () => {
    await entorno?.cerrar()
  })
  const ruta = (resto: string) =>
    `/seguimiento/clientes/${entorno.ids.cliente!}/valoraciones${resto}`
  async function guardar(contenido: ContenidoValoracion): Promise<ValoracionProfesional> {
    const http = entorno.app.getHttpServer()
    const creada = ValoracionProfesionalSchema.parse(
      (
        await request(http)
          .post(ruta(""))
          .set(entorno.como("entrenador"))
          .send({
            operacionId: randomUUID(),
            tipo: "inicial",
            fechaToma: "2026-09-24",
            bloques: contenido.bloques,
          })
          .expect(201)
      ).body,
    )
    return ValoracionProfesionalSchema.parse(
      (
        await request(http)
          .put(ruta(`/${creada.id}`))
          .set(entorno.como("entrenador"))
          .send({
            borradorId: creada.borrador!.id,
            revision: creada.borrador!.revision,
            fechaToma: "2026-09-24",
            contenido,
          })
          .expect(200)
      ).body,
    )
  }
  const contenido: ContenidoValoracion = {
    bloques: ["medidas", "fotos"],
    corporales: [{ definicionId: peso.id, estado: "registrado", valor: 80 }],
    pruebas: [],
    grasaPorPliegues: null,
    destacados: [],
    conclusion: null,
    notasInternas: null,
  }
  const publicar = (v: ValoracionProfesional, operacionId = randomUUID()) =>
    request(entorno.app.getHttpServer())
      .post(ruta(`/${v.id}/publicaciones`))
      .set(entorno.como("entrenador"))
      .send({
        operacionId,
        borradorId: v.borrador!.id,
        revision: v.borrador!.revision,
        sustituyePublicacionId: null,
      })

  it.each(["crear", "corregir", "cambiar", "publicar", "vincular"] as const)(
    "una retirada posterior al guard impide %s sin nuevas escrituras de salud",
    async (accion) => {
      const { app, prisma, ids, como } = entorno
      const v = await guardar(contenido)
      let publicacionId: string | undefined
      if (accion === "corregir")
        publicacionId = PublicacionValoracionSchema.parse((await publicar(v).expect(201)).body).id
      let medioId: string | undefined
      if (accion === "vincular") {
        const solicitud = await prisma.solicitudFotos.create({
          data: {
            clienteId: ids.cliente!,
            autorId: ids.entrenador!,
            operacionId: randomUUID(),
            vistas: ["frente"],
          },
        })
        const medio = await prisma.medioFoto.create({
          data: {
            clienteId: ids.cliente!,
            autorId: ids.cliente!,
            operacionId: randomUUID(),
            origen: "cliente",
            solicitudId: solicitud.id,
            vista: "frente",
            fechaToma: new Date("2026-09-24"),
            estado: "disponible",
            confirmadoEn: new Date(),
            tipoMime: "image/jpeg",
            bytes: 100,
            clave: `clientes/${ids.cliente!}/sintetica-${randomUUID()}`,
            subidaCaducaEn: new Date(Date.now() + 60000),
          },
        })
        medioId = medio.id
      }
      const estadoSalud = () =>
        Promise.all([
          prisma.valoracion.findMany({
            where: { clienteId: ids.cliente! },
            orderBy: { id: "asc" },
          }),
          prisma.borradorValoracion.findMany({
            where: { valoracion: { clienteId: ids.cliente! } },
            orderBy: { id: "asc" },
          }),
          prisma.publicacionValoracion.findMany({
            where: { valoracion: { clienteId: ids.cliente! } },
            orderBy: { id: "asc" },
          }),
          prisma.operacionValoracion.findMany({
            where: { valoracion: { clienteId: ids.cliente! } },
            orderBy: { operacionId: "asc" },
          }),
          prisma.medioFoto.findMany({
            where: { clienteId: ids.cliente! },
            orderBy: { id: "asc" },
          }),
        ])
      const anterior = await estadoSalud()
      const servicio = app.get(ConsentimientoService)
      const original = servicio.exigirVigente.bind(servicio)
      let avisar!: () => void
      let continuar!: () => void
      const dentro = new Promise<void>((resolve) => {
        avisar = resolve
      })
      const pausa = new Promise<void>((resolve) => {
        continuar = resolve
      })
      const espia = jest
        .spyOn(servicio, "exigirVigente")
        .mockImplementationOnce(async (...args) => {
          avisar()
          await pausa
          return original(...args)
        })
      const http = request(app.getHttpServer())
      const pendiente = (
        accion === "crear"
          ? http.post(ruta("")).send({
              operacionId: randomUUID(),
              tipo: "inicial",
              fechaToma: "2026-09-24",
              bloques: ["medidas"],
            })
          : accion === "corregir"
            ? http.post(ruta("")).send({
                operacionId: randomUUID(),
                corrigePublicacionId: publicacionId,
              })
            : accion === "cambiar"
              ? http.put(ruta(`/${v.id}`)).send({
                  borradorId: v.borrador!.id,
                  revision: v.borrador!.revision,
                  fechaToma: "2026-09-24",
                  contenido: {
                    ...contenido,
                    corporales: [{ definicionId: peso.id, estado: "registrado", valor: 91 }],
                  },
                })
              : accion === "publicar"
                ? http.post(ruta(`/${v.id}/publicaciones`)).send({
                    operacionId: randomUUID(),
                    borradorId: v.borrador!.id,
                    revision: v.borrador!.revision,
                    sustituyePublicacionId: null,
                  })
                : http.post(ruta(`/${v.id}/fotos`)).send({ medioId })
      )
        .set(como("entrenador"))
        .then((respuesta) => respuesta)
      try {
        await esperarPausa(dentro, pendiente)
        await request(app.getHttpServer())
          .delete("/consentimiento")
          .set(como("cliente"))
          .expect(200)
        continuar()
        const respuesta = await pendiente
        expect(respuesta.status).toBe(409)
        expect(ErrorDeApiSchema.parse(respuesta.body).codigo).toBe("consentimiento_pendiente")
        expect(await estadoSalud()).toEqual(anterior)
      } finally {
        continuar()
        await Promise.allSettled([pendiente])
        espia.mockRestore()
        await request(app.getHttpServer())
          .post("/consentimiento")
          .set(como("cliente"))
          .send({ version: VERSION_CONSENTIMIENTO, acepto: true })
          .expect(201)
      }
    },
  )

  it("un resultado desconocido rechaza todo el guardado y conserva la revisión anterior", async () => {
    const v = await guardar(contenido)
    await request(entorno.app.getHttpServer())
      .put(ruta(`/${v.id}`))
      .set(entorno.como("entrenador"))
      .send({
        borradorId: v.borrador!.id,
        revision: v.borrador!.revision,
        fechaToma: "2026-09-24",
        contenido: {
          ...contenido,
          corporales: [{ definicionId: randomUUID(), estado: "registrado", valor: 90 }],
        },
      })
      .expect(400)
    const actual = ValoracionProfesionalSchema.parse(
      (
        await request(entorno.app.getHttpServer())
          .get(ruta(`/${v.id}`))
          .set(entorno.como("entrenador"))
          .expect(200)
      ).body,
    )
    expect(actual.borrador).toEqual(v.borrador)
  })

  it("publica grasa por pliegues sin otros resultados ni conclusión", async () => {
    const grasaPorPliegues = { valorPct: 18.5, metodo: "Método sintético", fecha: "2026-09-24" }
    const v = await guardar({
      ...contenido,
      bloques: ["pliegues"],
      corporales: [],
      grasaPorPliegues,
    })
    const publicada = PublicacionValoracionSchema.parse((await publicar(v).expect(201)).body)
    expect(publicada.documento.grasaPorPliegues).toEqual(grasaPorPliegues)
  })

  it("publicar simultáneamente con el mismo UUID devuelve la misma publicación", async () => {
    const v = await guardar(contenido)
    const operacionId = randomUUID()
    const respuestas = await Promise.all([publicar(v, operacionId), publicar(v, operacionId)])
    expect(respuestas.map((r) => r.status)).toEqual([201, 201])
    expect(respuestas[0]!.body).toEqual(respuestas[1]!.body)
    expect(
      await entorno.prisma.publicacionValoracion.count({ where: { valoracionId: v.id } }),
    ).toBe(1)
  })

  it("una foto vinculada mientras se publica queda visible en la publicación", async () => {
    const v = await guardar(contenido)
    const { app, prisma, ids, como } = entorno
    const solicitud = await prisma.solicitudFotos.create({
      data: {
        clienteId: ids.cliente!,
        autorId: ids.entrenador!,
        operacionId: randomUUID(),
        vistas: ["frente"],
      },
    })
    const foto = await prisma.medioFoto.create({
      data: {
        clienteId: ids.cliente!,
        autorId: ids.cliente!,
        operacionId: randomUUID(),
        origen: "cliente",
        solicitudId: solicitud.id,
        vista: "frente",
        fechaToma: new Date("2026-09-24"),
        estado: "disponible",
        confirmadoEn: new Date(),
        tipoMime: "image/jpeg",
        bytes: 100,
        clave: `clientes/${ids.cliente!}/sintetica-${randomUUID()}`,
        subidaCaducaEn: new Date(Date.now() + 60000),
      },
    })
    const servicio = app.get(ValoracionesService) as unknown as {
      bloquearFila(clienteId: string, id: string, tx: Prisma.TransactionClient): Promise<unknown>
    }
    const original = servicio.bloquearFila.bind(servicio)
    let avisar!: () => void
    let continuar!: () => void
    let entrandoPublicacion!: () => void
    const dentro = new Promise<void>((resolve) => {
      avisar = resolve
    })
    const pausa = new Promise<void>((resolve) => {
      continuar = resolve
    })
    const publicando = new Promise<void>((resolve) => {
      entrandoPublicacion = resolve
    })
    const espia = jest
      .spyOn(servicio, "bloquearFila")
      .mockImplementationOnce(async (...args) => {
        const fila = await original(...args)
        avisar()
        await pausa
        return fila
      })
      .mockImplementationOnce(async (...args) => {
        entrandoPublicacion()
        return original(...args)
      })
    const vinculo = request(app.getHttpServer())
      .post(ruta(`/${v.id}/fotos`))
      .set(como("entrenador"))
      .send({ medioId: foto.id })
      .then((r) => r)
    let publicacion: ReturnType<typeof publicar> | undefined
    let respuestaPublicacion: Promise<request.Response> | undefined
    try {
      await esperarPausa(dentro, vinculo)
      publicacion = publicar(v)
      respuestaPublicacion = publicacion.then((r) => r)
      await esperarPausa(publicando, respuestaPublicacion)
      continuar()
      const [vinculada, publicada] = await Promise.all([vinculo, respuestaPublicacion])
      expect(vinculada.status).toBe(201)
      expect(publicada.status).toBe(201)
      expect(
        (await prisma.medioFoto.findUniqueOrThrow({ where: { id: foto.id } })).publicadaEn,
      ).not.toBeNull()
      const visibles = await request(app.getHttpServer())
        .get(ruta(`/${v.id}/fotos`))
        .set(como("cliente"))
        .expect(200)
      expect(visibles.body.fotos.map((f: { id: string }) => f.id)).toContain(foto.id)
    } finally {
      continuar()
      await Promise.allSettled([vinculo, respuestaPublicacion])
      espia.mockRestore()
    }
  })
})

describe("Valoraciones: próxima revisión y repetición (V07a)", () => {
  let entorno: Awaited<ReturnType<typeof entornoEntrenamiento>>
  let inicial: ValoracionProfesional
  beforeAll(async () => {
    entorno = await entornoEntrenamiento("valoraciones-revision")
    const http = entorno.app.getHttpServer()
    const base = `/seguimiento/clientes/${entorno.ids.cliente!}`
    await request(http)
      .put(`${base}/plantilla-valoracion`)
      .set(entorno.como("entrenador"))
      .send({ revision: 0, corporales: [peso], pruebas: [flexiones] })
      .expect(200)
    const creada = ValoracionProfesionalSchema.parse(
      (
        await request(http)
          .post(`${base}/valoraciones`)
          .set(entorno.como("entrenador"))
          .send({
            operacionId: randomUUID(),
            tipo: "inicial",
            fechaToma: "2026-09-24",
            bloques: ["medidas", "pruebas"],
          })
          .expect(201)
      ).body,
    )
    inicial = ValoracionProfesionalSchema.parse(
      (
        await request(http)
          .put(`${base}/valoraciones/${creada.id}`)
          .set(entorno.como("entrenador"))
          .send({
            borradorId: creada.borrador!.id,
            revision: creada.borrador!.revision,
            fechaToma: "2026-09-24",
            contenido: {
              bloques: ["medidas", "pruebas"],
              corporales: [{ definicionId: peso.id, estado: "registrado", valor: 90 }],
              pruebas: [
                {
                  definicionId: flexiones.id,
                  estado: "registrado",
                  valores: { repeticiones: 15 },
                  protocoloCompleto: true,
                  fecha: null,
                  notas: null,
                },
              ],
              grasaPorPliegues: null,
              destacados: [],
              conclusion: null,
              notasInternas: null,
            },
          })
          .expect(200)
      ).body,
    )
  })
  afterAll(async () => {
    await entorno?.cerrar()
  })
  const http = () => entorno.app.getHttpServer()
  const ruta = (resto: string) => `/seguimiento/clientes/${entorno.ids.cliente!}/${resto}`
  const pauta = { fecha: null, intervaloSemanas: 6, bloques: ["medidas", "pruebas"] }

  it("la pauta empieza sin programar, se guarda con revisión y se puede quitar", async () => {
    const url = ruta("proxima-revision")
    expect(
      ProximaRevisionSchema.parse(
        (await request(http()).get(url).set(entorno.como("cliente")).expect(200)).body,
      ),
    ).toEqual({ revision: 0, pauta: null, cumplidaPorId: null, actualizadaEn: null })
    await request(http()).get(url).set(entorno.como("nutricionista")).expect(403)
    await request(http())
      .put(url)
      .set(entorno.como("cliente"))
      .send({ revision: 0, pauta })
      .expect(403)
    const guardada = ProximaRevisionSchema.parse(
      (
        await request(http())
          .put(url)
          .set(entorno.como("entrenador"))
          .send({ revision: 0, pauta })
          .expect(200)
      ).body,
    )
    expect(guardada).toMatchObject({ revision: 1, pauta, cumplidaPorId: null })
    const conflicto = await request(http())
      .put(url)
      .set(entorno.como("entrenador"))
      .send({ revision: 0, pauta: null })
      .expect(409)
    expect(ErrorDeApiSchema.parse(conflicto.body).codigo).toBe("revision_obsoleta")
    const quitada = ProximaRevisionSchema.parse(
      (
        await request(http())
          .put(url)
          .set(entorno.como("entrenador"))
          .send({ revision: 1, pauta: null })
          .expect(200)
      ).body,
    )
    expect(quitada).toMatchObject({ revision: 2, pauta: null })
    expect(
      ProximaRevisionSchema.parse(
        (await request(http()).get(url).set(entorno.como("cliente")).expect(200)).body,
      ).pauta,
    ).toBeNull()
  })

  it("solo crear la revisión vinculada cumple la pauta; reintentar no la duplica", async () => {
    const url = ruta("proxima-revision")
    const actual = ProximaRevisionSchema.parse(
      (await request(http()).get(url).set(entorno.como("entrenador")).expect(200)).body,
    )
    const programada = ProximaRevisionSchema.parse(
      (
        await request(http())
          .put(url)
          .set(entorno.como("entrenador"))
          .send({
            revision: actual.revision,
            pauta: { ...pauta, fecha: "2026-11-05", intervaloSemanas: null },
          })
          .expect(200)
      ).body,
    )
    const crearRevision = (operacionId: string, cumplePauta: number | null) =>
      request(http())
        .post(ruta("valoraciones"))
        .set(entorno.como("entrenador"))
        .send({
          operacionId,
          tipo: "revision",
          fechaToma: "2026-11-05",
          bloques: ["medidas", "pruebas"],
          anteriorId: inicial.id,
          cumplePauta,
        })
    const obsoleta = await crearRevision(randomUUID(), programada.revision - 1).expect(409)
    expect(ErrorDeApiSchema.parse(obsoleta.body).codigo).toBe("revision_obsoleta")
    expect(
      await entorno.prisma.valoracion.count({ where: { clienteId: entorno.ids.cliente! } }),
    ).toBe(1)

    const operacionId = randomUUID()
    const revision = ValoracionProfesionalSchema.parse(
      (await crearRevision(operacionId, programada.revision).expect(201)).body,
    )
    const doc = revision.borrador!.documento
    expect(doc.definiciones.corporales.map((d) => d.id)).toEqual([peso.id])
    expect([...doc.corporales, ...doc.pruebas].every((r) => r.estado === "pendiente")).toBe(true)
    const cumplida = ProximaRevisionSchema.parse(
      (await request(http()).get(url).set(entorno.como("cliente")).expect(200)).body,
    )
    expect(cumplida).toMatchObject({
      cumplidaPorId: revision.id,
      revision: programada.revision + 1,
    })

    const repetida = ValoracionProfesionalSchema.parse(
      (await crearRevision(operacionId, programada.revision).expect(201)).body,
    )
    expect(repetida.id).toBe(revision.id)
    const segunda = await crearRevision(randomUUID(), cumplida.revision).expect(409)
    expect(ErrorDeApiSchema.parse(segunda.body).codigo).toBe("estado_incompatible")
    expect(
      await entorno.prisma.valoracion.count({ where: { clienteId: entorno.ids.cliente! } }),
    ).toBe(2)

    // Programar otra vez deja la pauta pendiente.
    const nueva = ProximaRevisionSchema.parse(
      (
        await request(http())
          .put(url)
          .set(entorno.como("entrenador"))
          .send({ revision: cumplida.revision, pauta })
          .expect(200)
      ).body,
    )
    expect(nueva.cumplidaPorId).toBeNull()
  })
})
