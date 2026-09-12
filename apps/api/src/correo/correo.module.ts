import { Global, Module } from "@nestjs/common"

import { CorreoConResend, ServicioDeCorreo } from "./correo.service.js"

/**
 * Envio de correo.
 *
 * Se expone por la clase abstracta `ServicioDeCorreo` y no por la
 * implementacion. Quien lo use pide el contrato, no Resend, asi que cambiar de
 * proveedor manana toca este fichero y ninguno mas. Y los tests sustituyen el
 * proveedor por un doble sin tocar el codigo que envia.
 */
@Global()
@Module({
  providers: [{ provide: ServicioDeCorreo, useClass: CorreoConResend }],
  exports: [ServicioDeCorreo],
})
export class CorreoModule {}
