import { Injectable, Logger } from "@nestjs/common"
import { Resend } from "resend"

import { leerVariable, leerVariableOpcional } from "../config/entorno.js"

export type Correo = {
  para: string
  asunto: string
  html: string
  texto: string
}

/**
 * Contrato de envio de correo.
 *
 * Existe como interfaz para que los tests puedan sustituirlo por un doble que no
 * toque la red. Un test que envie correos de verdad es lento, depende de que
 * haya internet, y acaba llenando una bandeja de entrada real de basura.
 */
export abstract class ServicioDeCorreo {
  abstract enviar(correo: Correo): Promise<void>
}

/**
 * Remitente por defecto.
 *
 * Es el dominio de pruebas de Resend, que solo permite enviar a la direccion con
 * la que se registro la cuenta. Sirve para desarrollar.
 *
 * Para invitar a clientes de verdad hay que verificar el dominio en Resend y
 * cambiar CORREO_REMITENTE en el entorno. No hay que tocar codigo.
 * Ver docs/PENDIENTE-PARA-PRODUCCION.md, punto 1.
 */
const REMITENTE_DE_PRUEBAS = "Alpha & Omega <onboarding@resend.dev>"

@Injectable()
export class CorreoConResend extends ServicioDeCorreo {
  private readonly registro = new Logger(CorreoConResend.name)
  private clienteCacheado: Resend | null = null

  async enviar(correo: Correo): Promise<void> {
    const remitente = leerVariableOpcional("CORREO_REMITENTE", REMITENTE_DE_PRUEBAS)

    const respuesta = await this.cliente().emails.send({
      from: remitente,
      to: correo.para,
      subject: correo.asunto,
      html: correo.html,
      text: correo.texto,
    })

    if (respuesta.error !== null) {
      // El mensaje del proveedor se registra, pero no se propaga hacia el
      // cliente: podria delatar si una direccion existe, y quien pidio la accion
      // no puede hacer nada con el.
      this.registro.error(`Resend rechazo el envio: ${respuesta.error.message}`)
      throw new Error("No se ha podido enviar el correo")
    }

    this.registro.log(`Correo enviado a ${enmascarar(correo.para)}: ${correo.asunto}`)
  }

  /**
   * El cliente se construye al primer envio y no al arrancar.
   *
   * Asi el servidor levanta aunque falte la clave, y solo falla quien intente
   * enviar. Durante el desarrollo eso importa: no poder arrancar la API porque
   * no has configurado el correo seria absurdo.
   */
  private cliente(): Resend {
    this.clienteCacheado ??= new Resend(leerVariable("RESEND_API_KEY"))
    return this.clienteCacheado
  }
}

/**
 * Deja la direccion reconocible en los logs sin escribirla entera.
 *
 * Un correo es un dato personal. Los logs se copian, se pegan en chats y acaban
 * en sitios que nadie previo.
 */
function enmascarar(direccion: string): string {
  const arroba = direccion.indexOf("@")
  if (arroba <= 1) {
    return "***"
  }

  return `${direccion.slice(0, 2)}***${direccion.slice(arroba)}`
}
