import type { INestApplication } from "@nestjs/common"
import { Test } from "@nestjs/testing"
import request from "supertest"

import { AppModule } from "../src/app.module.js"
import { cifrarContrasena } from "../src/identity/contrasenas.js"
import { PrismaService } from "../src/prisma/prisma.service.js"

const SUFIJO = "@e2e-carrera.test"
const EMAIL = `usuario${SUFIJO}`
const CONTRASENA = "contrasena-de-prueba-carrera"

/**
 * Rotacion de tokens de refresco.
 *
 * La garantia que se protege aqui es que **una familia nunca tiene mas de un
 * token vivo**. Da igual cuantas peticiones lleguen a la vez o cuantas respuestas
 * se pierdan por el camino: si en algun momento hubiera dos tokens validos de la
 * misma sesion, la rotacion habria dejado de servir para lo que existe.
 *
 * Hay una excepcion medida y deliberada: un canje repetido en los primeros
 * segundos se trata como un reintento, no como un robo. Sin eso, un movil al que
 * el sistema mata a mitad de la rotacion deja al cliente fuera de su cuenta.
 */
describe("Rotacion del token de refresco", () => {
  let app: INestApplication
  let prisma: PrismaService

  async function entrar(): Promise<{ tokenAcceso: string; tokenRefresco: string }> {
    const respuesta = await request(app.getHttpServer())
      .post("/auth/login")
      .send({ email: EMAIL, contrasena: CONTRASENA })
      .expect(200)

    return respuesta.body
  }

  function refrescar(token: string): request.Test {
    return request(app.getHttpServer()).post("/auth/refresh").send({ tokenRefresco: token })
  }

  /** Cuantos tokens siguen vivos en toda la cuenta. */
  async function vivos(): Promise<number> {
    const usuario = await prisma.usuario.findUnique({ where: { email: EMAIL } })
    return prisma.tokenRefresco.count({
      where: { usuarioId: usuario?.id ?? "", revocadoEn: null },
    })
  }

  /** Envejece la revocacion de un token para sacarlo de la ventana de gracia. */
  async function envejecer(token: string): Promise<void> {
    await prisma.tokenRefresco.updateMany({
      where: { id: token.split(".")[0] ?? "" },
      data: { revocadoEn: new Date(Date.now() - 60 * 60 * 1000) },
    })
  }

  /**
   * Lanza las peticiones con el candado de la fila del usuario cogido, y no lo
   * suelta hasta que `cuantas` de ellas esperan en cola detras de el.
   *
   * Es el mismo candado que toma el canje antes de rotar. Retenerlo obliga a que
   * todas lean el token ANTES de que ninguna pueda rotarlo, que es la
   * temporizacion que con las suites en paralelo salia solo a veces. Sin esto,
   * el resultado dependia de como repartiera el planificador las peticiones.
   */
  async function conTodasEnCola<T>(cuantas: number, lanzar: () => Promise<T>): Promise<T> {
    const usuario = await prisma.usuario.findUniqueOrThrow({ where: { email: EMAIL } })

    const { enVuelo } = await prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT id FROM usuarios WHERE id = ${usuario.id} FOR UPDATE`
        const [yo] = await tx.$queryRaw<Array<{ pid: number }>>`SELECT pg_backend_pid() AS pid`

        const peticiones = lanzar()
        await esperarEnCola(yo?.pid ?? 0, cuantas)

        // Envuelto a proposito: devolver la promesa tal cual haria que la
        // transaccion la esperase, y las peticiones esperan a la transaccion.
        return { enVuelo: peticiones }
      },
      { timeout: 15_000 },
    )

    return enVuelo
  }

  /** Espera a que `cuantas` conexiones esten bloqueadas, directa o indirectamente, por `pid`. */
  async function esperarEnCola(pid: number, cuantas: number): Promise<void> {
    const limite = Date.now() + 10_000

    for (;;) {
      // Solo la primera en llegar espera a `pid`; las demas esperan a la que
      // tienen delante. Por eso se sigue la cadena entera y no un solo nivel.
      const [fila] = await prisma.$queryRaw<Array<{ n: number }>>`
        WITH RECURSIVE en_cola(pid) AS (
          SELECT pid FROM pg_stat_activity WHERE ${pid}::int = ANY(pg_blocking_pids(pid))
          UNION
          SELECT a.pid FROM pg_stat_activity a JOIN en_cola c ON c.pid = ANY(pg_blocking_pids(a.pid))
        )
        SELECT count(*)::int AS n FROM en_cola`

      const enCola = fila?.n ?? 0
      if (enCola >= cuantas) {
        return
      }
      if (Date.now() > limite) {
        throw new Error(`Solo ${enCola} de ${cuantas} peticiones llegaron a esperar el candado`)
      }
      await new Promise((resolver) => setTimeout(resolver, 10))
    }
  }

  beforeAll(async () => {
    const modulo = await Test.createTestingModule({ imports: [AppModule] }).compile()
    app = modulo.createNestApplication()
    await app.init()
    prisma = app.get(PrismaService)
  })

  beforeEach(async () => {
    await prisma.usuario.deleteMany({ where: { email: { endsWith: SUFIJO } } })
    await prisma.usuario.create({
      data: {
        email: EMAIL,
        nombre: "Prueba",
        passwordHash: await cifrarContrasena(CONTRASENA),
        rol: "cliente",
        estado: "activo",
      },
    })
  })

  afterAll(async () => {
    await prisma.usuario.deleteMany({ where: { email: { endsWith: SUFIJO } } })
    await app.close()
  })

  it("tras rotar queda exactamente un token vivo", async () => {
    const sesion = await entrar()
    expect(await vivos()).toBe(1)

    const renovada = await refrescar(sesion.tokenRefresco).expect(200)

    expect(renovada.body.tokenRefresco).not.toBe(sesion.tokenRefresco)
    expect(await vivos()).toBe(1)
  })

  it("cuatro canjes simultaneos no bifurcan la sesion", async () => {
    const sesion = await entrar()

    const respuestas = await Promise.all(
      Array.from({ length: 4 }, () => refrescar(sesion.tokenRefresco)),
    )

    // Alguna pudo atenderse como reintento, pero el resultado que importa es que
    // no quedan dos sesiones paralelas.
    expect(respuestas.every((r) => r.status === 200 || r.status === 401)).toBe(true)
    expect(await vivos()).toBe(1)
  })

  it("si los cuatro leen el token vivo, gana uno y los demas se rechazan sin cortar nada", async () => {
    const sesion = await entrar()

    const respuestas = await conTodasEnCola(4, () =>
      Promise.all(Array.from({ length: 4 }, () => refrescar(sesion.tokenRefresco))),
    )

    // Las perdedoras presentaron un token que estaba vivo cuando lo leyeron. No
    // es un reuso: es una carrera, y quien la gana es el propio usuario. Antes
    // del arreglo se trataban como robo y cortaban la familia, y el usuario se
    // quedaba sin sesion por haber refrescado en paralelo.
    const ganadoras = respuestas.filter((r) => r.status === 200)
    expect(ganadoras).toHaveLength(1)
    expect(respuestas.filter((r) => r.status === 401)).toHaveLength(3)
    expect(await vivos()).toBe(1)

    await refrescar(ganadoras[0]?.body.tokenRefresco).expect(200)
  })

  it("si cuatro reintentos leen el token ya rotado, solo uno se lleva la gracia", async () => {
    const sesion = await entrar()

    // Rotacion cuya respuesta se pierde. El movil reabre y lanza varias
    // peticiones a la vez, todas con el unico token que tiene: el viejo.
    await refrescar(sesion.tokenRefresco).expect(200)

    const respuestas = await conTodasEnCola(4, () =>
      Promise.all(Array.from({ length: 4 }, () => refrescar(sesion.tokenRefresco))),
    )

    const ganadoras = respuestas.filter((r) => r.status === 200)
    expect(ganadoras).toHaveLength(1)
    expect(await vivos()).toBe(1)

    await refrescar(ganadoras[0]?.body.tokenRefresco).expect(200)
  })

  it("un canje repetido justo despues se atiende como reintento", async () => {
    const sesion = await entrar()

    // Rotacion legitima cuya respuesta, imaginemos, nunca llego al movil porque
    // el sistema operativo mato la app.
    await refrescar(sesion.tokenRefresco).expect(200)

    // Al reabrir, el movil manda el unico token que tiene: el viejo.
    const reintento = await refrescar(sesion.tokenRefresco).expect(200)

    // Sigue dentro, con un token utilizable, y sin sesiones paralelas.
    expect(await vivos()).toBe(1)
    await refrescar(reintento.body.tokenRefresco).expect(200)
  })

  it("pasada la ventana de gracia, el token viejo corta la cadena entera", async () => {
    const sesion = await entrar()
    const renovada = await refrescar(sesion.tokenRefresco).expect(200)

    // Un token que reaparece una hora despues no es una respuesta perdida: es una
    // copia. No se sabe quien tiene el bueno, asi que se echa a los dos.
    await envejecer(sesion.tokenRefresco)

    await refrescar(sesion.tokenRefresco).expect(401)
    await refrescar(renovada.body.tokenRefresco).expect(401)
    expect(await vivos()).toBe(0)
  })

  it("con la gracia ya gastada, el token viejo se rechaza sin tumbar la sesion viva", async () => {
    const sesion = await entrar()
    await refrescar(sesion.tokenRefresco).expect(200)
    const reintento = await refrescar(sesion.tokenRefresco).expect(200)

    // Esto es lo que ve el servidor cuando la ultima de una rafaga de canjes
    // simultaneos llega despues de que las otras ya rotaran y reintentaran. Con
    // las suites en paralelo salia de vez en cuando y cortaba la familia; en
    // secuencia sale siempre.
    await refrescar(sesion.tokenRefresco).expect(401)

    expect(await vivos()).toBe(1)
    await refrescar(reintento.body.tokenRefresco).expect(200)
  })

  it("pasada la ventana, un token con la gracia ya gastada corta la cadena", async () => {
    const sesion = await entrar()
    await refrescar(sesion.tokenRefresco).expect(200)
    const reintento = await refrescar(sesion.tokenRefresco).expect(200)

    // La indulgencia de arriba dura lo que la ventana de gracia, ni un segundo
    // mas. Despues vuelve a ser la firma de una copia.
    await envejecer(sesion.tokenRefresco)

    await refrescar(sesion.tokenRefresco).expect(401)
    await refrescar(reintento.body.tokenRefresco).expect(401)
    expect(await vivos()).toBe(0)
  })

  it("cerrar sesion no admite ninguna indulgencia", async () => {
    const sesion = await entrar()

    await request(app.getHttpServer())
      .post("/auth/logout")
      .send({ tokenRefresco: sesion.tokenRefresco })
      .expect(204)

    // Aunque sea el mismo instante. Un boton de cerrar sesion que deja la sesion
    // viva treinta segundos es una mentira, no una comodidad.
    await refrescar(sesion.tokenRefresco).expect(401)
    expect(await vivos()).toBe(0)
  })

  it("el token de refresco nunca se guarda en claro", async () => {
    const sesion = await entrar()
    const secreto = sesion.tokenRefresco.split(".")[1] ?? ""

    const filas = await prisma.tokenRefresco.findMany()

    expect(filas.some((fila) => fila.hash.includes(secreto))).toBe(false)
  })

  it("la cadena hereda su fecha de nacimiento en cada rotacion", async () => {
    const sesion = await entrar()
    const idInicial = sesion.tokenRefresco.split(".")[0] ?? ""
    const primera = await prisma.tokenRefresco.findUnique({ where: { id: idInicial } })

    const renovada = await refrescar(sesion.tokenRefresco).expect(200)
    const idNuevo = String(renovada.body.tokenRefresco).split(".")[0] ?? ""
    const segunda = await prisma.tokenRefresco.findUnique({ where: { id: idNuevo } })

    // Misma familia y misma fecha de nacimiento. Sin esto, cada rotacion
    // reiniciaba el contador y una sesion robada duraba para siempre.
    expect(segunda?.familiaId).toBe(primera?.familiaId)
    expect(segunda?.familiaCreadaEn.getTime()).toBe(primera?.familiaCreadaEn.getTime())
  })
})
