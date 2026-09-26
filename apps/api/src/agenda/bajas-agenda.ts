import { Injectable, type OnModuleInit } from "@nestjs/common"

import { RegistroDeBajas } from "../identity/bajas.js"
import { ReservasService } from "./reservas.service.js"

/** Dar de baja a un cliente cancela sus reservas futuras con devolución (SPEC-agenda.md). */
@Injectable()
export class BajasAgenda implements OnModuleInit {
  constructor(
    private readonly registro: RegistroDeBajas,
    private readonly reservas: ReservasService,
  ) {}

  onModuleInit(): void {
    this.registro.registrar({
      alDarDeBaja: async (clienteId, autorId, tx) => {
        await this.reservas.cancelarFuturasDe(tx, clienteId, autorId)
      },
    })
  }
}
