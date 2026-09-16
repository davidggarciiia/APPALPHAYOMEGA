import { Injectable, NotFoundException } from "@nestjs/common"
import type { CambiosDePerfil, PerfilPropio } from "@alpha-omega/shared"

import { PrismaService } from "../prisma/prisma.service.js"

@Injectable()
export class PerfilService {
  constructor(private readonly prisma: PrismaService) {}

  async leer(usuarioId: string): Promise<PerfilPropio> {
    const usuario = await this.prisma.usuario.findUnique({ where: { id: usuarioId } })

    if (usuario === null) {
      // El guard ya comprobo que existe, asi que llegar aqui significa que la
      // cuenta se borro entre una cosa y otra. Raro, pero no imposible.
      throw new NotFoundException("Este perfil ya no existe")
    }

    return aPerfil(usuario)
  }

  /**
   * Guarda los cambios del perfil propio.
   *
   * Solo se tocan los campos que vienen en la peticion. Enviar un objeto vacio no
   * borra nada, y enviar `null` en un campo opcional si lo vacia: son dos
   * intenciones distintas y el tipo las distingue.
   */
  async actualizar(usuarioId: string, cambios: CambiosDePerfil): Promise<PerfilPropio> {
    const actualizado = await this.prisma.usuario.update({
      where: { id: usuarioId },
      data: {
        ...(cambios.nombre !== undefined && { nombre: cambios.nombre }),
        ...(cambios.apellidos !== undefined && { apellidos: cambios.apellidos }),
        ...(cambios.telefono !== undefined && {
          // Un texto vacio es la forma que tiene un formulario de decir "lo he
          // borrado". Se guarda como nulo para que la base no distinga entre
          // "sin telefono" y "telefono en blanco".
          telefono: cambios.telefono === null || cambios.telefono === "" ? null : cambios.telefono,
        }),
        ...(cambios.fechaNacimiento !== undefined && {
          fechaNacimiento:
            cambios.fechaNacimiento === null ? null : new Date(cambios.fechaNacimiento),
        }),
      },
    })

    return aPerfil(actualizado)
  }
}

/**
 * Recorta lo que sale hacia la app, campo a campo.
 *
 * Si el modelo gana una columna sensible manana, no aparece sola en la respuesta:
 * hay que escribirla aqui a proposito.
 */
function aPerfil(usuario: {
  id: string
  email: string
  nombre: string
  apellidos: string | null
  telefono: string | null
  fechaNacimiento: Date | null
  fotoUrl: string | null
  rol: PerfilPropio["rol"]
  estado: PerfilPropio["estado"]
}): PerfilPropio {
  return {
    id: usuario.id,
    email: usuario.email,
    nombre: usuario.nombre,
    apellidos: usuario.apellidos,
    telefono: usuario.telefono,
    // Solo la fecha, sin hora. Guardar la hora de un cumpleanos no significa nada
    // y arrastra problemas de zona horaria: en Madrid podria mostrarse un dia
    // antes que en la base.
    fechaNacimiento: usuario.fechaNacimiento?.toISOString().slice(0, 10) ?? null,
    fotoUrl: usuario.fotoUrl,
    rol: usuario.rol,
    estado: usuario.estado,
  }
}
