import { Injectable } from "@nestjs/common"

import { ServicioDeCorreo, type Correo } from "./correo.service.js"

/**
 * Implementacion que no envia nada: guarda los correos en memoria.
 *
 * Vive en `src` y no en `test` a proposito, porque la usan tanto los tests
 * unitarios como los de extremo a extremo, y un doble compartido entre los dos
 * no puede vivir dentro de ninguno.
 *
 * Los tests la inyectan en lugar de la real. Sin esto, la suite enviaria correos
 * de verdad: seria lenta, dependeria de que haya internet, gastaria cuota y
 * llenaria una bandeja de entrada real de basura.
 */
@Injectable()
export class CorreoEnMemoria extends ServicioDeCorreo {
  readonly enviados: Correo[] = []

  enviar(correo: Correo): Promise<void> {
    this.enviados.push(correo)
    return Promise.resolve()
  }

  /** El ultimo correo enviado a una direccion, o undefined si no hubo ninguno. */
  ultimoPara(direccion: string): Correo | undefined {
    return this.enviados.filter((correo) => correo.para === direccion).at(-1)
  }

  limpiar(): void {
    this.enviados.length = 0
  }
}
