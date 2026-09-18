import { BadRequestException, type PipeTransform } from "@nestjs/common"
import type { ZodType } from "zod"

/** Contrato de validación de catálogo, agenda y entrenamiento; identidad conserva el suyo. */
export class EntradaApiPipe<T> implements PipeTransform {
  constructor(private readonly esquema: ZodType<T>) {}

  transform(valor: unknown): T {
    const resultado = this.esquema.safeParse(valor)
    if (!resultado.success) {
      throw new BadRequestException({
        statusCode: 400,
        codigo: "solicitud_invalida",
        message: "Revisa los campos de la solicitud",
      })
    }
    return resultado.data
  }
}
