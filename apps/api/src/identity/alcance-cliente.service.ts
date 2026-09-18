import { Injectable } from "@nestjs/common"

import { PrismaService } from "../prisma/prisma.service.js"

import type { Rol } from "@alpha-omega/shared"

/**
 * Segunda mitad del sistema de permisos: el rol dice QUE clase de cosas puedes
 * hacer, esto dice SOBRE QUIEN puedes hacerlas.
 *
 * Sin esta comprobacion, el nutricionista subcontratado tendria acceso a los
 * datos de salud de toda la cartera del entrenador, no solo a los de sus
 * clientes. La matriz de roles por si sola no lo impide: la fila dice
 * "solo asignados", y "solo asignados" no se puede expresar con un decorador.
 *
 * Lo consumiran tambien `nutricion` y `seguimiento-corporal`, por eso vive en un
 * servicio reutilizable y no dentro de un guard.
 */
@Injectable()
export class AlcanceClienteService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Decide si `usuario` puede acceder a los datos de `clienteId`.
   *
   * La regla se escribe como un switch exhaustivo sobre el rol. Si manana
   * apareciera un quinto rol, el compilador obliga a decidir aqui que puede ver,
   * en lugar de dejarlo caer en un valor por defecto permisivo.
   */
  async puedeAcceder(usuario: { sub: string; rol: Rol }, clienteId: string): Promise<boolean> {
    switch (usuario.rol) {
      case "entrenador":
        // Es su negocio y sus clientes.
        return true

      case "cliente":
        // Solo lo suyo. La comparacion es contra el identificador del token,
        // que el servidor verifico, no contra nada que mande la app.
        return usuario.sub === clienteId

      case "nutricionista":
        return this.tieneAsignado(usuario.sub, clienteId)

      case "empleado":
        // Solo ficha. No tiene ninguna relacion con los clientes.
        return false
    }
  }

  /**
   * Hay asignacion Y el cliente sigue siendo cliente.
   *
   * La fila de asignacion sobrevive a la baja a proposito: borrarla perderia el
   * rastro de quien tuvo acceso a los datos de salud de quien. Pero conservar el
   * rastro no es conservar el acceso. Sin la comprobacion de estado, dar de baja
   * a alguien le cortaba la entrada a su propia cuenta y dejaba al nutricionista
   * subcontratado viendo su peso, sus medidas y sus fotos igual que el dia
   * anterior.
   */
  async tieneAsignado(nutricionistaId: string, clienteId: string): Promise<boolean> {
    const asignacion = await this.prisma.asignacionNutricionista.findFirst({
      where: {
        nutricionistaId,
        clienteId,
        cliente: { estado: { not: "desactivado" } },
      },
      select: { id: true },
    })

    return asignacion !== null
  }

  /** Los clientes que un nutricionista tiene asignados. */
  async clientesDe(nutricionistaId: string): Promise<string[]> {
    const filas = await this.prisma.asignacionNutricionista.findMany({
      where: { nutricionistaId },
      select: { clienteId: true },
    })

    return filas.map((fila) => fila.clienteId)
  }
}
