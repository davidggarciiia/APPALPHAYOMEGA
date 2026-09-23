import { randomUUID } from "node:crypto"
import request from "supertest"
import {
  BorradorDietaSchema,
  DietaDelHistoricoSchema,
  DietaPublicadaSchema,
  ListadoDietasSchema,
} from "@alpha-omega/shared"
import { documentoDeObjetivos, entornoNutricion } from "./nutricion-ayuda.js"

describe("Histórico de dietas", () => {
  let entorno: Awaited<ReturnType<typeof entornoNutricion>>
  const base = (clienteId: string): string => `/nutricion/clientes/${clienteId}`
  const publicadas: string[] = []

  beforeAll(async () => {
    entorno = await entornoNutricion("historico")
    for (const nombre of ["Octubre", "Noviembre", "Diciembre"]) {
      const borrador = BorradorDietaSchema.parse(
        (
          await request(entorno.app.getHttpServer())
            .put(`${base(entorno.ids.cliente)}/borrador`)
            .set(entorno.como("entrenador"))
            .send({ revision: 0, documento: documentoDeObjetivos(nombre) })
            .expect(200)
        ).body,
      )
      const publicada = DietaPublicadaSchema.parse(
        (
          await request(entorno.app.getHttpServer())
            .post(`${base(entorno.ids.cliente)}/borrador/publicar`)
            .set(entorno.como("entrenador"))
            .send({ operacionId: randomUUID(), revision: borrador.revision })
            .expect(200)
        ).body,
      )
      publicadas.push(publicada.id)
    }
  })
  afterAll(async () => {
    await entorno?.cerrar()
  })

  it("lista la vigente y las archivadas, de la más reciente a la más antigua, con el total real", async () => {
    const { app, como, ids } = entorno
    const pagina = ListadoDietasSchema.parse(
      (
        await request(app.getHttpServer())
          .get(`${base(ids.cliente)}/historico?limite=2`)
          .set(como("nutricionista"))
          .expect(200)
      ).body,
    )
    expect(pagina.total).toBe(3)
    expect(pagina.dietas.map((dieta) => [dieta.nombre, dieta.estado])).toEqual([
      ["Diciembre", "publicada"],
      ["Noviembre", "archivada"],
    ])
    expect(pagina.dietas[0]?.publicadaPor.nombre).toBe("entrenador")
  })

  it("abre una dieta archivada completa, pero solo del cliente de la ruta", async () => {
    const { app, como, ids } = entorno
    const primera = DietaDelHistoricoSchema.parse(
      (
        await request(app.getHttpServer())
          .get(`${base(ids.cliente)}/dietas/${publicadas[0]}`)
          .set(como("entrenador"))
          .expect(200)
      ).body,
    )
    expect(primera.documento.nombre).toBe("Octubre")
    expect(primera.archivadaEn).not.toBeNull()
    await request(app.getHttpServer())
      .get(`${base(ids.otro)}/dietas/${publicadas[0]}`)
      .set(como("entrenador"))
      .expect(404)
  })

  it("el cliente y quien no tiene acceso no ven el histórico", async () => {
    const { app, como, ids } = entorno
    for (const cuenta of ["cliente", "otro", "nutriAjeno", "empleado"] as const) {
      await request(app.getHttpServer())
        .get(`${base(ids.cliente)}/historico`)
        .set(como(cuenta))
        .expect(403)
      await request(app.getHttpServer())
        .get(`${base(ids.cliente)}/dietas/${publicadas[0]}`)
        .set(como(cuenta))
        .expect(403)
    }
    await request(app.getHttpServer())
      .get(`${base(ids.cliente)}/historico`)
      .expect(401)
  })
})
