import { Controller, Get, ServiceUnavailableException } from "@nestjs/common"
import type { EstadoSalud } from "@alpha-omega/shared"

import { Publico } from "../identity/publico.decorator.js"

import { SaludService } from "./salud.service.js"

@Controller("salud")
export class SaludController {
  constructor(private readonly salud: SaludService) {}

  /**
   * El controlador no decide nada del dominio. Solo traduce el resultado a HTTP:
   * si la base no responde, devuelve 503 en lugar de un 200 con malas noticias
   * dentro, que es lo que un balanceador o una sonda necesita para actuar.
   */
  @Publico()
  @Get()
  async comprobar(): Promise<EstadoSalud> {
    const resultado = await this.salud.comprobar()

    if (resultado.estado !== "ok") {
      throw new ServiceUnavailableException(resultado)
    }

    return resultado
  }
}
