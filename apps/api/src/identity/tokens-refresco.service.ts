import { createHash, randomBytes, randomUUID, timingSafeEqual } from "node:crypto"

import { Injectable, Logger, UnauthorizedException } from "@nestjs/common"

import { leerVariableOpcional } from "../config/entorno.js"
import { PrismaService } from "../prisma/prisma.service.js"

const DIAS_POR_DEFECTO = 30
const VIDA_MAXIMA_DIAS_POR_DEFECTO = 90
const BYTES_DE_SECRETO = 32
const GRACIA_SEGUNDOS = 30

/**
 * Lo minimo que necesita este servicio para escribir: o el cliente de siempre, o
 * el de una transaccion en curso. Se declara asi, por lo que usa, para no
 * depender de tipos internos de Prisma que cambian entre versiones.
 */
type ClientePrisma = Pick<PrismaService, "tokenRefresco">

export type SesionEmitida = {
  /** Lo que se entrega al cliente: `<id>.<secreto>`. */
  token: string
  /** Id de la fila. Va dentro del token de acceso para poder revocarlo. */
  id: string
}

/**
 * Emision, canje y revocacion de tokens de refresco.
 *
 * El token que ve el cliente tiene la forma `<id>.<secreto>`. El id permite
 * localizar la fila sin recorrer la tabla; el secreto es lo que se comprueba.
 * En la base solo vive el hash del secreto, asi que una copia robada de la base
 * de datos no contiene ninguna sesion utilizable.
 *
 * Cada login abre una FAMILIA. Las rotaciones sucesivas crean filas nuevas que
 * conservan la familia, y eso permite dos cosas que un token suelto no permite:
 * cortar de golpe todas las sesiones derivadas de un login, y ponerle una vida
 * maxima a la cadena para que rotar no la alargue para siempre.
 */
@Injectable()
export class TokensRefrescoService {
  private readonly registro = new Logger(TokensRefrescoService.name)

  constructor(private readonly prisma: PrismaService) {}

  /** Abre una familia nueva. Se usa al iniciar sesion con credenciales. */
  async emitir(usuarioId: string): Promise<SesionEmitida> {
    return this.crearFila(usuarioId, randomUUID(), new Date())
  }

  /**
   * Canjea un token por otro dentro de la misma familia.
   *
   * La revocacion del token usado es una escritura condicional: el predicado
   * exige que siga sin revocar. Si dos peticiones llegan a la vez, la base
   * arbitra y solo una toca una fila. La que pierde no obtiene una sesion
   * paralela, obtiene un rechazo.
   *
   * Si el token que llega YA estaba revocado hay dos lecturas posibles, y se
   * distinguen por el reloj. Dentro de unos segundos es una respuesta que se
   * perdio y el movil reintenta. Mas tarde es una copia robada, y entonces se
   * corta la familia entera porque no se sabe quien tiene el token legitimo.
   */
  async canjear(token: string): Promise<{ usuarioId: string; nuevo: SesionEmitida }> {
    const fila = await this.buscarFila(token)

    const { count } = await this.prisma.tokenRefresco.updateMany({
      where: { id: fila.id, revocadoEn: null },
      data: { revocadoEn: new Date(), motivoRevocacion: "rotacion" },
    })

    if (count !== 1) {
      // El token ya estaba revocado. Hay dos explicaciones muy distintas.
      //
      // Una: alguien esta usando una copia robada. Es lo que la rotacion existe
      // para detectar.
      //
      // La otra, mucho mas frecuente y del todo inocente: el movil pidio el
      // canje, el servidor rotó, y el sistema operativo mató la app antes de que
      // llegara la respuesta. Al reabrir, el movil manda el unico token que
      // tiene, que es el viejo. Con una cobertura irregular esto pasa a menudo, y
      // castigarlo revocando la familia deja al cliente fuera de su cuenta y
      // escribe una alarma de seguridad falsa.
      //
      // Se distinguen por el reloj: una respuesta perdida se reintenta en
      // segundos, un token robado aparece mucho despues. Dentro de la ventana se
      // trata como reintento y se emite uno nuevo de la misma familia.
      if (fila.motivoRevocacion === "rotacion" && this.dentroDeLaVentanaDeGracia(fila.revocadoEn)) {
        // La gracia se consume con una escritura condicional, igual que la
        // rotacion. Sin este candado, cuatro peticiones simultaneas la usaban las
        // cuatro y la sesion acababa bifurcada en varias cadenas vivas, que es
        // justo lo que la rotacion existe para impedir. Comprobado: quedaban tres.
        const { count: ganada } = await this.prisma.tokenRefresco.updateMany({
          where: { id: fila.id, motivoRevocacion: "rotacion" },
          data: { motivoRevocacion: "reintento" },
        })

        if (ganada !== 1) {
          // Otra peticion se llevo la gracia hace un instante. No hay motivo para
          // sospechar de nadie, asi que se rechaza sin tocar la familia: quien
          // tenga el token bueno sigue dentro.
          throw new UnauthorizedException("Sesion no valida")
        }

        this.registro.log(
          `Canje repetido dentro de la ventana de gracia. Se asume respuesta perdida, ` +
            `familia ${fila.familiaId} intacta.`,
        )

        // El sucesor existe y esta vivo, pero el cliente nunca llego a recibirlo:
        // es inalcanzable. Se retira para que la familia no acumule tokens vivos
        // que nadie tiene.
        await this.revocarFamilia(fila.familiaId, "rotacion")

        return {
          usuarioId: fila.usuarioId,
          nuevo: await this.crearFila(fila.usuarioId, fila.familiaId, fila.familiaCreadaEn),
        }
      }

      await this.revocarFamilia(fila.familiaId, "reuso")
      this.registro.warn(
        `Token de refresco reutilizado. Familia ${fila.familiaId} revocada por completo.`,
      )
      throw new UnauthorizedException("Sesion no valida")
    }

    return {
      usuarioId: fila.usuarioId,
      nuevo: await this.crearFila(fila.usuarioId, fila.familiaId, fila.familiaCreadaEn),
    }
  }

  /** Cierra la sesion revocando la familia entera. Borrarlo del movil no basta. */
  async revocar(token: string): Promise<void> {
    const fila = await this.buscarFila(token)
    await this.revocarFamilia(fila.familiaId, "cierre")
  }

  /**
   * Revoca todas las sesiones de un usuario.
   *
   * Es el boton de expulsion: se llama al desactivar una cuenta, al borrarla, al
   * cambiar la contrasena y al cambiar el rol.
   *
   * Acepta un cliente de transaccion para que quien da de baja pueda hacerlo en
   * la misma escritura que el cambio de estado. Es preferible a que el servicio
   * de usuarios escriba el `updateMany` por su cuenta: como se revoca un token
   * de refresco debe seguir sabiendolo un solo fichero.
   */
  async revocarTodosDe(usuarioId: string, cliente: ClientePrisma = this.prisma): Promise<void> {
    await cliente.tokenRefresco.updateMany({
      where: { usuarioId, revocadoEn: null },
      data: { revocadoEn: new Date(), motivoRevocacion: "cierre" },
    })
  }

  /**
   * Comprueba que la sesion a la que pertenece un token de acceso sigue viva.
   *
   * La usa el guard de autenticacion en cada peticion. Sin esto, un token de
   * acceso firmado sobrevive al cierre de sesion y a la desactivacion de la
   * cuenta hasta que caduca solo.
   */
  async sesionSigueViva(id: string): Promise<boolean> {
    const fila = await this.prisma.tokenRefresco.findUnique({
      where: { id },
      select: { revocadoEn: true, familiaCreadaEn: true },
    })

    return (
      fila !== null && fila.revocadoEn === null && !this.superaLaVidaMaxima(fila.familiaCreadaEn)
    )
  }

  private async crearFila(
    usuarioId: string,
    familiaId: string,
    familiaCreadaEn: Date,
  ): Promise<SesionEmitida> {
    const secreto = randomBytes(BYTES_DE_SECRETO).toString("base64url")

    const fila = await this.prisma.tokenRefresco.create({
      data: {
        usuarioId,
        hash: hashDe(secreto),
        familiaId,
        familiaCreadaEn,
        expiraEn: new Date(Date.now() + this.duracionEnMilisegundos()),
      },
    })

    return { token: `${fila.id}.${secreto}`, id: fila.id }
  }

  private async buscarFila(token: string): Promise<{
    id: string
    usuarioId: string
    familiaId: string
    familiaCreadaEn: Date
    revocadoEn: Date | null
    motivoRevocacion: "rotacion" | "cierre" | "reuso" | "reintento" | null
  }> {
    const separador = token.indexOf(".")
    if (separador === -1) {
      throw new UnauthorizedException("Sesion no valida")
    }

    const id = token.slice(0, separador)
    const secreto = token.slice(separador + 1)

    const fila = await this.prisma.tokenRefresco.findUnique({ where: { id } })

    // Un token inexistente, uno caducado, uno con el secreto equivocado y uno
    // cuya cadena supero la vida maxima dan el mismo error. Distinguirlos diria
    // a un atacante si un identificador existe.
    //
    // Ojo: aqui NO se rechaza por `revocadoEn`. Un token ya revocado tiene que
    // llegar hasta `canjear` para que detecte la reutilizacion y corte la
    // familia. Cortar antes perderia esa senal.
    if (
      fila === null ||
      fila.expiraEn.getTime() <= Date.now() ||
      this.superaLaVidaMaxima(fila.familiaCreadaEn) ||
      !coincideElHash(fila.hash, secreto)
    ) {
      throw new UnauthorizedException("Sesion no valida")
    }

    return {
      id: fila.id,
      usuarioId: fila.usuarioId,
      familiaId: fila.familiaId,
      familiaCreadaEn: fila.familiaCreadaEn,
      revocadoEn: fila.revocadoEn,
      motivoRevocacion: fila.motivoRevocacion,
    }
  }

  /**
   * Cuanto se tolera un canje repetido antes de tratarlo como robo.
   *
   * Corta a proposito: es el tiempo que tarda un movil en reintentar tras perder
   * una respuesta, no el que tarda un atacante en usar un token copiado. Alargarla
   * abriria una ventana real en la que dos personas comparten sesion.
   */
  private dentroDeLaVentanaDeGracia(revocadoEn: Date | null): boolean {
    if (revocadoEn === null) {
      return false
    }

    const segundos = Number(
      leerVariableOpcional("REFRESCO_GRACIA_SEGUNDOS", String(GRACIA_SEGUNDOS)),
    )
    const tope = Number.isFinite(segundos) && segundos >= 0 ? segundos : GRACIA_SEGUNDOS

    return Date.now() - revocadoEn.getTime() <= tope * 1000
  }

  private async revocarFamilia(
    familiaId: string,
    motivo: "cierre" | "reuso" | "rotacion" | "reintento",
  ): Promise<void> {
    await this.prisma.tokenRefresco.updateMany({
      where: { familiaId, revocadoEn: null },
      data: { revocadoEn: new Date(), motivoRevocacion: motivo },
    })
  }

  /**
   * Una cadena de rotaciones no puede durar para siempre.
   *
   * Sin este tope, cada canje reiniciaba los treinta dias, asi que una sesion
   * robada que se fuera refrescando duraba indefinidamente. Al alcanzarlo se
   * vuelve a pedir la contrasena.
   */
  private superaLaVidaMaxima(familiaCreadaEn: Date): boolean {
    const dias = Number(
      leerVariableOpcional("REFRESCO_VIDA_MAXIMA_DIAS", String(VIDA_MAXIMA_DIAS_POR_DEFECTO)),
    )
    const tope = Number.isFinite(dias) && dias > 0 ? dias : VIDA_MAXIMA_DIAS_POR_DEFECTO

    return Date.now() - familiaCreadaEn.getTime() > tope * 24 * 60 * 60 * 1000
  }

  private duracionEnMilisegundos(): number {
    const dias = Number(leerVariableOpcional("REFRESCO_DIAS", String(DIAS_POR_DEFECTO)))
    const valido = Number.isFinite(dias) && dias > 0 ? dias : DIAS_POR_DEFECTO

    return valido * 24 * 60 * 60 * 1000
  }
}

function hashDe(secreto: string): string {
  return createHash("sha256").update(secreto).digest("hex")
}

/**
 * Comparacion en tiempo constante.
 *
 * Un `===` corriente corta en cuanto encuentra el primer caracter distinto, y
 * esa diferencia de tiempo es medible: permite ir adivinando el hash caracter a
 * caracter. Aqui el riesgo es pequeno porque el secreto es aleatorio, pero la
 * version correcta cuesta lo mismo de escribir.
 */
function coincideElHash(guardado: string, secreto: string): boolean {
  const calculado = Buffer.from(hashDe(secreto), "hex")
  const esperado = Buffer.from(guardado, "hex")

  if (calculado.length !== esperado.length) {
    return false
  }

  return timingSafeEqual(calculado, esperado)
}
