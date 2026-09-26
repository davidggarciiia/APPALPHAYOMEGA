import { Injectable } from "@nestjs/common"
import type { Prisma } from "@prisma/client"

/** Lo que otro módulo hace cuando se da de baja a un cliente, en la misma transacción. */
export interface ParticipanteDeBaja {
  alDarDeBaja(clienteId: string, autorId: string, tx: Prisma.TransactionClient): Promise<void>
}

/**
 * Registro de bajas (tasks/horarios/plan.md, «Módulos y baja de clientes»).
 *
 * Dar de baja cancela reservas futuras y anula solicitudes pendientes, pero
 * `identity` no puede importar `agenda` ni `planes` sin crear ciclos. Son ellos
 * los que se registran aquí al arrancar, e `identity` los ejecuta dentro de su
 * transacción sin conocerlos.
 */
@Injectable()
export class RegistroDeBajas {
  private readonly participantes: ParticipanteDeBaja[] = []

  registrar(participante: ParticipanteDeBaja): void {
    this.participantes.push(participante)
  }

  async ejecutar(clienteId: string, autorId: string, tx: Prisma.TransactionClient): Promise<void> {
    for (const participante of this.participantes)
      await participante.alDarDeBaja(clienteId, autorId, tx)
  }
}
