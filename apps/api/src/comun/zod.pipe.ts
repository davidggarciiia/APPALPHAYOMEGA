import { BadRequestException, Injectable, type PipeTransform } from "@nestjs/common"
import type { ZodType } from "zod"

/**
 * Valida la entrada de un endpoint contra un esquema de Zod.
 *
 * SPEC.md exige validar en el borde toda entrada que venga de fuera, antes de
 * tocar nada. Este pipe es ese borde: lo que pasa de aqui ya tiene la forma
 * declarada en `packages/shared`, y el resto del codigo puede confiar en ella.
 */
@Injectable()
export class ZodPipe<T> implements PipeTransform {
  constructor(private readonly esquema: ZodType<T>) {}

  transform(valor: unknown): T {
    const resultado = this.esquema.safeParse(valor)

    if (!resultado.success) {
      // Se devuelven las rutas de los campos que fallan, pero nunca los valores
      // recibidos: podrian ser una contrasena y acabarian en un log.
      const campos = resultado.error.issues.map((problema) => problema.path.join("."))
      throw new BadRequestException({
        mensaje: "La peticion no tiene la forma esperada",
        campos: [...new Set(campos)],
      })
    }

    return resultado.data
  }
}
