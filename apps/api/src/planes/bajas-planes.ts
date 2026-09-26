import { Injectable, type OnModuleInit } from "@nestjs/common"

import { RegistroDeBajas } from "../identity/bajas.js"

/**
 * Dar de baja a un cliente anula sus solicitudes pendientes. Sus cobros
 * pendientes se conservan: son deuda (SPEC-planes.md).
 */
@Injectable()
export class BajasPlanes implements OnModuleInit {
  constructor(private readonly registro: RegistroDeBajas) {}

  onModuleInit(): void {
    this.registro.registrar({
      alDarDeBaja: async (clienteId, autorId, tx) => {
        await tx.solicitudProducto.updateMany({
          where: { clienteId, estado: "pendiente" },
          data: { estado: "anulada", resueltaEn: new Date(), resueltaPorId: autorId },
        })
      },
    })
  }
}
