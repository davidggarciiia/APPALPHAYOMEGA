import { BadRequestException, Injectable, Logger, NotFoundException } from "@nestjs/common"
import type { AsignacionesDeNutricionista, ListadoUsuarios } from "@alpha-omega/shared"

import { PrismaService } from "../prisma/prisma.service.js"

/**
 * Quien ve a quien.
 *
 * El rol dice QUE clase de cosas puede hacer alguien; esto dice SOBRE QUIEN. Sin
 * una asignacion explicita, el nutricionista subcontratado no ve absolutamente
 * nada de un cliente (requisito 15), y eso incluye su peso, sus medidas y sus
 * fotos de evolucion cuando existan.
 *
 * Quitar una asignacion corta el acceso en la peticion siguiente, sin esperas ni
 * cierres de sesion: `AlcanceClienteService` consulta esta tabla cada vez.
 */
@Injectable()
export class AsignacionesService {
  private readonly registro = new Logger(AsignacionesService.name)

  constructor(private readonly prisma: PrismaService) {}

  /** Los clientes que ve un nutricionista. Para la pantalla del entrenador. */
  async deNutricionista(nutricionistaId: string): Promise<AsignacionesDeNutricionista> {
    await this.exigirRol(nutricionistaId, "nutricionista")

    const filas = await this.prisma.asignacionNutricionista.findMany({
      where: { nutricionistaId },
      select: { clienteId: true },
      orderBy: { desde: "asc" },
    })

    return { nutricionistaId, clienteIds: filas.map((fila) => fila.clienteId) }
  }

  /**
   * Da acceso a un cliente concreto.
   *
   * Idempotente: asignar dos veces no crea dos filas ni falla. Un segundo toque
   * en el movil es lo normal, no un error, y la pareja ya es unica en la base.
   */
  async asignar(quienAsigna: string, nutricionistaId: string, clienteId: string): Promise<void> {
    await this.exigirRol(nutricionistaId, "nutricionista")
    await this.exigirRol(clienteId, "cliente")

    await this.prisma.asignacionNutricionista.upsert({
      where: { nutricionistaId_clienteId: { nutricionistaId, clienteId } },
      create: { nutricionistaId, clienteId },
      update: {},
    })

    // Queda constancia de quien dio acceso a los datos de salud de quien. Solo
    // identificadores: en una traza no entran nombres, correos ni nada de salud.
    this.registro.log(`Asignacion: ${quienAsigna} da a ${nutricionistaId} acceso a ${clienteId}`)
  }

  /**
   * Retira el acceso.
   *
   * Idempotente tambien: retirar algo que ya no estaba deja el mundo como
   * querias, que es lo que la peticion pedia.
   */
  async retirar(quienRetira: string, nutricionistaId: string, clienteId: string): Promise<void> {
    const { count } = await this.prisma.asignacionNutricionista.deleteMany({
      where: { nutricionistaId, clienteId },
    })

    if (count > 0) {
      this.registro.log(
        `Asignacion retirada: ${quienRetira} corta ${nutricionistaId} -> ${clienteId}`,
      )
    }
  }

  /**
   * La lista del propio nutricionista.
   *
   * Es la unica via por la que ve nombres de clientes, y solo salen los suyos.
   * No reutiliza el listado del entrenador a proposito: aquel es la cartera
   * entera y basta con equivocarse de decorador una vez para enseñarsela.
   */
  async misClientes(nutricionistaId: string): Promise<ListadoUsuarios> {
    const usuarios = await this.prisma.usuario.findMany({
      where: {
        nutricionistasAsignados: { some: { nutricionistaId } },
        // Un cliente dado de baja desaparece de la lista del nutricionista
        // subcontratado. La fila de asignacion se conserva a proposito, para no
        // perder el rastro de quien tuvo acceso a que, pero conservar la fila no
        // es conservar el acceso: quien deja de ser cliente deja de verse.
        estado: { not: "desactivado" },
      },
      orderBy: [{ nombre: "asc" }, { apellidos: "asc" }],
      select: {
        id: true,
        nombre: true,
        apellidos: true,
        email: true,
        rol: true,
        estado: true,
      },
    })

    return { usuarios, total: usuarios.length }
  }

  /**
   * Comprueba que alguien existe y es lo que la ruta dice que es.
   *
   * Sin esto se podria asignar un cliente a otro cliente, o al empleado, y la
   * fila quedaria ahi sin que nada la mirase hasta el dia que alguien cambiara
   * de rol y heredara accesos que nadie le dio.
   */
  private async exigirRol(id: string, rol: "nutricionista" | "cliente"): Promise<void> {
    const usuario = await this.prisma.usuario.findUnique({
      where: { id },
      select: { rol: true },
    })

    if (usuario === null) {
      throw new NotFoundException("Esta cuenta no existe")
    }

    if (usuario.rol !== rol) {
      throw new BadRequestException(
        rol === "nutricionista"
          ? "Ese perfil no es el del nutricionista"
          : "Solo se asignan clientes al nutricionista",
      )
    }
  }
}
