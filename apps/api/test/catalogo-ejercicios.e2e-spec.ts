import { EjercicioSchema, ListadoEjerciciosSchema } from "@alpha-omega/shared"
import request from "supertest"

import {
  ID_INEXISTENTE,
  crearCuenta,
  levantar,
  limpiar,
  type Cuenta,
  type Entorno,
} from "./ayudantes.js"

const SUFIJO = "@e2e-catalogo.test"
const PREFIJO = "e2e-catalogo"

describe("Catálogo de ejercicios", () => {
  let entorno: Entorno
  let entrenador: Cuenta
  let cliente: Cuenta
  let nutricionista: Cuenta
  let empleado: Cuenta

  const nuevo = (nombre: string): Record<string, unknown> => ({
    nombre: `${PREFIJO} ${nombre}`,
    grupoPrincipal: "pecho",
    gruposSecundarios: ["triceps"],
    instrucciones: "Bajar controlando y empujar.",
  })

  async function crear(nombre: string): Promise<string> {
    const respuesta = await request(entorno.servidor())
      .post("/ejercicios")
      .set("Authorization", entrenador.cabecera)
      .send(nuevo(nombre))
      .expect(201)
    return EjercicioSchema.parse(respuesta.body).id
  }

  beforeAll(async () => {
    entorno = await levantar()
  })

  beforeEach(async () => {
    await limpiar(entorno, SUFIJO, PREFIJO)
    entrenador = await crearCuenta(entorno, "entrenador", "entrenador", SUFIJO)
    cliente = await crearCuenta(entorno, "cliente", "cliente", SUFIJO)
    nutricionista = await crearCuenta(entorno, "nutricionista", "nutricionista", SUFIJO)
    empleado = await crearCuenta(entorno, "empleado", "empleado", SUFIJO)
  })

  afterAll(async () => {
    await limpiar(entorno, SUFIJO, PREFIJO)
    await entorno.app.close()
  })

  it("el entrenador crea un ejercicio sin figura ni vídeo y el cliente lo lee", async () => {
    const id = await crear("Press")
    const ficha = await request(entorno.servidor())
      .get(`/ejercicios/${id}`)
      .set("Authorization", cliente.cabecera)
      .expect(200)
    const ejercicio = EjercicioSchema.parse(ficha.body)
    expect(ejercicio).toMatchObject({ estado: "publicado", figura: null, video: null })
    expect(ejercicio.gruposSecundarios).toEqual(["triceps"])
  })

  it("busca por nombre sin tildes ni mayúsculas y filtra por grupo secundario", async () => {
    await crear("Sentadilla Búlgara")
    await crear("Remo")
    const porNombre = await request(entorno.servidor())
      .get("/ejercicios")
      .query({ buscar: `${PREFIJO} SENTADILLA bulgara` })
      .set("Authorization", cliente.cabecera)
      .expect(200)
    expect(ListadoEjerciciosSchema.parse(porNombre.body).ejercicios.map((e) => e.nombre)).toEqual([
      `${PREFIJO} Sentadilla Búlgara`,
    ])
    const porGrupo = await request(entorno.servidor())
      .get("/ejercicios")
      .query({ buscar: PREFIJO, grupo: "triceps" })
      .set("Authorization", cliente.cabecera)
      .expect(200)
    expect(ListadoEjerciciosSchema.parse(porGrupo.body).total).toBe(2)
  })

  it("devuelve el total real aunque el límite corte la lista", async () => {
    await crear("Uno")
    await crear("Dos")
    await crear("Tres")
    const respuesta = await request(entorno.servidor())
      .get("/ejercicios")
      .query({ buscar: PREFIJO, limite: 2 })
      .set("Authorization", entrenador.cabecera)
      .expect(200)
    const listado = ListadoEjerciciosSchema.parse(respuesta.body)
    expect(listado.ejercicios).toHaveLength(2)
    expect(listado.total).toBe(3)
  })

  it("un nombre repetido, aunque cambien espacios y mayúsculas, es 409 y no crea nada", async () => {
    const id = await crear("Press militar")
    const repetido = await request(entorno.servidor())
      .post("/ejercicios")
      .set("Authorization", entrenador.cabecera)
      .send({ ...nuevo("x"), nombre: `  ${PREFIJO.toUpperCase()}   PRESS militar ` })
      .expect(409)
    expect(repetido.body).toMatchObject({ codigo: "nombre_duplicado", ejercicioId: id })
    expect(
      await entorno.prisma.ejercicio.count({
        where: { nombreNormalizado: { startsWith: PREFIJO } },
      }),
    ).toBe(1)
  })

  it("editar a un nombre ocupado es 409; editar el propio conserva el id", async () => {
    const uno = await crear("Uno")
    await crear("Dos")
    await request(entorno.servidor())
      .patch(`/ejercicios/${uno}`)
      .set("Authorization", entrenador.cabecera)
      .send(nuevo("Dos"))
      .expect(409)
    const editado = await request(entorno.servidor())
      .patch(`/ejercicios/${uno}`)
      .set("Authorization", entrenador.cabecera)
      .send({ ...nuevo("Uno bis"), gruposSecundarios: ["hombros", "biceps"] })
      .expect(200)
    expect(EjercicioSchema.parse(editado.body)).toMatchObject({
      id: uno,
      gruposSecundarios: ["hombros", "biceps"],
    })
  })

  it("un grupo fuera del vocabulario es 400 y no crea nada", async () => {
    await request(entorno.servidor())
      .post("/ejercicios")
      .set("Authorization", entrenador.cabecera)
      .send({ ...nuevo("Raro"), grupoPrincipal: "dorsales" })
      .expect(400)
    expect(
      await entorno.prisma.ejercicio.count({
        where: { nombreNormalizado: { startsWith: PREFIJO } },
      }),
    ).toBe(0)
  })

  it("retirar lo saca de la búsqueda, se sigue abriendo por id y reponer lo devuelve", async () => {
    const id = await crear("Retirable")
    const buscar = async (): Promise<number> => {
      const respuesta = await request(entorno.servidor())
        .get("/ejercicios")
        .query({ buscar: PREFIJO })
        .set("Authorization", cliente.cabecera)
        .expect(200)
      return ListadoEjerciciosSchema.parse(respuesta.body).total
    }
    for (let vez = 0; vez < 2; vez++) {
      await request(entorno.servidor())
        .post(`/ejercicios/${id}/retirar`)
        .set("Authorization", entrenador.cabecera)
        .expect(200)
    }
    expect(await buscar()).toBe(0)
    const ficha = await request(entorno.servidor())
      .get(`/ejercicios/${id}`)
      .set("Authorization", cliente.cabecera)
      .expect(200)
    expect(ficha.body.estado).toBe("retirado")
    const retirados = await request(entorno.servidor())
      .get("/ejercicios")
      .query({ buscar: PREFIJO, estado: "retirado" })
      .set("Authorization", entrenador.cabecera)
      .expect(200)
    expect(ListadoEjerciciosSchema.parse(retirados.body).total).toBe(1)
    await request(entorno.servidor())
      .post(`/ejercicios/${id}/reponer`)
      .set("Authorization", entrenador.cabecera)
      .expect(200)
    expect(await buscar()).toBe(1)
  })

  it("devuelve varios ejercicios por id, también retirados", async () => {
    const uno = await crear("Uno")
    const dos = await crear("Dos")
    await request(entorno.servidor())
      .post(`/ejercicios/${dos}/retirar`)
      .set("Authorization", entrenador.cabecera)
      .expect(200)
    const respuesta = await request(entorno.servidor())
      .get("/ejercicios/por-id")
      .query({ ids: `${uno},${dos},${ID_INEXISTENTE}` })
      .set("Authorization", cliente.cabecera)
      .expect(200)
    expect(
      ListadoEjerciciosSchema.parse(respuesta.body)
        .ejercicios.map((e) => e.id)
        .sort(),
    ).toEqual([uno, dos].sort())
  })

  it("un id inexistente es 404 y uno mal formado es 400", async () => {
    await request(entorno.servidor())
      .get(`/ejercicios/${ID_INEXISTENTE}`)
      .set("Authorization", entrenador.cabecera)
      .expect(404)
    await request(entorno.servidor())
      .get("/ejercicios/no-es-un-id")
      .set("Authorization", entrenador.cabecera)
      .expect(400)
  })

  describe("denegaciones", () => {
    it("el cliente no crea, edita, retira, repone ni ve retirados", async () => {
      const id = await crear("Ajeno")
      const servidor = entorno.servidor()
      await request(servidor)
        .post("/ejercicios")
        .set("Authorization", cliente.cabecera)
        .send(nuevo("C"))
        .expect(403)
      await request(servidor)
        .patch(`/ejercicios/${id}`)
        .set("Authorization", cliente.cabecera)
        .send(nuevo("C"))
        .expect(403)
      await request(servidor)
        .post(`/ejercicios/${id}/retirar`)
        .set("Authorization", cliente.cabecera)
        .expect(403)
      await request(servidor)
        .post(`/ejercicios/${id}/reponer`)
        .set("Authorization", cliente.cabecera)
        .expect(403)
      await request(servidor)
        .get("/ejercicios")
        .query({ estado: "retirado" })
        .set("Authorization", cliente.cabecera)
        .expect(403)
      await request(servidor)
        .get("/ejercicios")
        .query({ estado: "todos" })
        .set("Authorization", cliente.cabecera)
        .expect(403)
    })

    it("nutricionista y empleado no llegan a ninguna ruta, y sin sesión es 401", async () => {
      const id = await crear("Cerrado")
      const rutas: Array<[string, string]> = [
        ["get", "/ejercicios"],
        ["get", `/ejercicios/${id}`],
        ["get", `/ejercicios/por-id?ids=${id}`],
        ["post", "/ejercicios"],
        ["patch", `/ejercicios/${id}`],
        ["post", `/ejercicios/${id}/retirar`],
        ["post", `/ejercicios/${id}/reponer`],
      ]
      for (const [metodo, ruta] of rutas) {
        const pedir = (): request.Test =>
          metodo === "get"
            ? request(entorno.servidor()).get(ruta)
            : metodo === "patch"
              ? request(entorno.servidor()).patch(ruta).send(nuevo("N"))
              : request(entorno.servidor()).post(ruta).send(nuevo("N"))
        for (const cuenta of [nutricionista, empleado]) {
          await pedir().set("Authorization", cuenta.cabecera).expect(403)
        }
        const anonima = pedir()
        await anonima.expect(401)
      }
    })
  })

  it("no existe ruta de borrado", async () => {
    const id = await crear("Eterno")
    const respuesta = await request(entorno.servidor())
      .delete(`/ejercicios/${id}`)
      .set("Authorization", entrenador.cabecera)
    expect([404, 405]).toContain(respuesta.status)
    expect(await entorno.prisma.ejercicio.count({ where: { id } })).toBe(1)
  })
})
