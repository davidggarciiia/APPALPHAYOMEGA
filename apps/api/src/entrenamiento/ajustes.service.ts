import { ForbiddenException, Injectable } from "@nestjs/common"
import { type CambiarPrescripcion, type SesionEntrenador } from "@alpha-omega/shared"
import { PrismaService } from "../prisma/prisma.service.js"
import type { IdentidadVerificada } from "../identity/peticion.js"
import { SesionesService } from "./sesiones.service.js"
import { catalogoParaPrescribir, conflicto, prescripcionConNombres } from "./documentos.js"

@Injectable()
export class AjustesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sesiones: SesionesService,
  ) {}
  async ajustar(
    actor: IdentidadVerificada,
    id: string,
    datos: CambiarPrescripcion,
  ): Promise<SesionEntrenador> {
    if (actor.rol !== "entrenador") throw new ForbiddenException()
    return this.prisma.$transaction(async (tx) => {
      const fila = await this.sesiones.bloquear(tx, actor, id)
      const actual = this.sesiones.publica(fila)
      if (fila.iniciada || fila.enviadoEn !== null)
        throw conflicto(
          "operacion_incompatible",
          "La sesión ya se ha iniciado. Su prescripción se conserva.",
        )
      if (fila.revisionPrescripcion !== datos.revisionPrescripcion)
        throw conflicto(
          "revision_obsoleta",
          "La prescripción ha cambiado. Recarga antes de guardar.",
        )
      const nombres = await catalogoParaPrescribir(tx, datos.ejercicios)
      const prescripcion = {
        ...prescripcionConNombres(datos, nombres),
        ...(actual.prescripcion.fase && { fase: actual.prescripcion.fase }),
      }
      const nueva = await tx.sesionEntrenamiento.update({
        where: { id },
        data: { prescripcion, revisionPrescripcion: { increment: 1 } },
        include: { agenda: true },
      })
      await tx.referenciaEjercicio.deleteMany({ where: { sesionId: id } })
      await tx.referenciaEjercicio.createMany({
        data: datos.ejercicios.map((e) => ({
          sesionId: id,
          idPrescrito: e.id,
          ejercicioId: e.ejercicioId,
        })),
      })
      return this.sesiones.publica(nueva)
    })
  }
}
