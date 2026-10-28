import { HttpException, HttpStatus, Injectable, Logger } from "@nestjs/common"

/** Intentos que se permiten sin ninguna espera. */
const INTENTOS_LIBRES = 5

/** Tope de la espera, para que un bloqueo no sea permanente por accidente. */
const ESPERA_MAXIMA_SEGUNDOS = 900

/** Si no hay fallos durante este tiempo, el contador se olvida. */
const OLVIDO_MINUTOS = 60

/** Tope de claves en memoria, para que la tabla no crezca sin limite. */
const MAXIMO_DE_CLAVES = 10_000

type Registro = {
  fallos: number
  bloqueadoHasta: number
  ultimoIntento: number
}

/**
 * Limitacion de intentos de login. Requisito 6 de SPEC-identity.md.
 *
 * Sin esto, el login es una puerta que se puede aporrear sin coste: un atacante
 * prueba contrasenas a la velocidad que le permita la red, y de paso obliga al
 * servidor a calcular un hash Argon2id en cada intento, que es caro a proposito.
 * Es decir, sirve para colarse y ademas para tumbar el servidor.
 *
 * El contador vive en memoria. Eso significa que se pierde al reiniciar y que no
 * se comparte entre varias instancias del servidor. Es suficiente para el tamano
 * de este proyecto, que corre en una sola maquina. **Si algun dia el servidor se
 * replica, esto deja de valer** y hay que moverlo a la base de datos o a Redis.
 */
@Injectable()
export class LimitadorDeIntentos {
  private readonly registro = new Logger(LimitadorDeIntentos.name)
  private readonly intentos = new Map<string, Registro>()
  private readonly enCurso = new Map<string, number>()

  /** Reserva antes de BD/Argon2; los fallos terminados y en vuelo comparten cupo. */
  reservar(claves: string[]): () => void {
    const unicas = [...new Set(claves)]
    for (const clave of unicas) {
      this.comprobar(clave)
      const pendientes = this.enCurso.get(clave) ?? 0
      const fallos = this.intentos.get(clave)?.fallos ?? 0
      // Tras la espera se admite un intento para avanzar el backoff.
      const cupo = Math.max(1, INTENTOS_LIBRES + 1 - fallos)
      if (pendientes >= cupo) {
        throw new HttpException(
          {
            mensaje: "Demasiados intentos. Espera antes de volver a probar.",
            reintentarEnSegundos: 1,
          },
          HttpStatus.TOO_MANY_REQUESTS,
        )
      }
    }
    unicas.forEach((clave) => this.enCurso.set(clave, (this.enCurso.get(clave) ?? 0) + 1))
    let liberada = false
    return () => {
      if (liberada) return
      liberada = true
      for (const clave of unicas) {
        const restantes = (this.enCurso.get(clave) ?? 1) - 1
        if (restantes === 0) this.enCurso.delete(clave)
        else this.enCurso.set(clave, restantes)
      }
    }
  }

  /**
   * Lanza si la clave esta bloqueada ahora mismo.
   *
   * La clave combina correo y direccion de origen: asi un atacante que pruebe
   * mil correos desde una IP se bloquea igual que quien insista con un solo
   * correo, y a la vez un fallo desde la oficina no bloquea a nadie mas.
   */
  comprobar(clave: string): void {
    this.limpiarSiHaceFalta()

    const registro = this.intentos.get(clave)
    if (registro === undefined) {
      return
    }

    const ahora = Date.now()
    if (registro.ultimoIntento < ahora - OLVIDO_MINUTOS * 60 * 1000) {
      this.intentos.delete(clave)
      return
    }

    const restante = registro.bloqueadoHasta - ahora
    if (restante > 0) {
      const segundos = Math.ceil(restante / 1000)

      throw new HttpException(
        {
          mensaje: "Demasiados intentos. Espera antes de volver a probar.",
          reintentarEnSegundos: segundos,
        },
        HttpStatus.TOO_MANY_REQUESTS,
        { description: `Retry-After: ${String(segundos)}` },
      )
    }
  }

  /**
   * Apunta un fallo y calcula la siguiente espera.
   *
   * La espera crece al doble con cada fallo a partir del quinto: 1s, 2s, 4s,
   * 8s... hasta el tope. Los primeros intentos no molestan a quien simplemente
   * se ha equivocado de contrasena; la progresion hace inviable probar miles.
   */
  registrarFallo(clave: string): void {
    const ahora = Date.now()
    const previo = this.intentos.get(clave)
    const fallos = (previo?.fallos ?? 0) + 1

    let bloqueadoHasta = 0
    if (fallos > INTENTOS_LIBRES) {
      const segundos = Math.min(2 ** (fallos - INTENTOS_LIBRES - 1), ESPERA_MAXIMA_SEGUNDOS)
      bloqueadoHasta = ahora + segundos * 1000

      if (fallos === INTENTOS_LIBRES + 1) {
        // La clave puede contener un correo: no trasladar datos personales a logs.
        this.registro.warn("Limitando intentos de autenticación")
      }
    }

    this.intentos.set(clave, { fallos, bloqueadoHasta, ultimoIntento: ahora })
  }

  /** Un login correcto borra el historial de esa clave. */
  registrarExito(clave: string): void {
    this.intentos.delete(clave)
  }

  private limpiarSiHaceFalta(): void {
    if (this.intentos.size < MAXIMO_DE_CLAVES) {
      return
    }

    const limite = Date.now() - OLVIDO_MINUTOS * 60 * 1000
    for (const [clave, registro] of this.intentos) {
      if (registro.ultimoIntento < limite && registro.bloqueadoHasta < Date.now()) {
        this.intentos.delete(clave)
      }
    }

    // Si aun asi sigue llena, es que hay un ataque en curso con muchas claves
    // distintas. Se vacia entera: preferimos perder contadores a quedarnos sin
    // memoria, y el atacante tendria que empezar de cero de todos modos.
    if (this.intentos.size >= MAXIMO_DE_CLAVES) {
      this.registro.warn("Tabla de intentos llena. Se vacia por completo.")
      this.intentos.clear()
    }
  }
}
