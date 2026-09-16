import { ConflictException, Injectable, Logger } from "@nestjs/common"
import type {
  CrearUsuario,
  FiltrosDeListado,
  ListadoUsuarios,
  UsuarioCreado,
  UsuarioPublico,
} from "@alpha-omega/shared"
import type { Prisma } from "@prisma/client"

import { PrismaService } from "../prisma/prisma.service.js"

import { ActivacionService } from "./activacion.service.js"

@Injectable()
export class UsuariosService {
  private readonly registro = new Logger(UsuariosService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly activacion: ActivacionService,
  ) {}

  /**
   * Da de alta a alguien. Es la unica via por la que nace una cuenta.
   *
   * El perfil nace **pendiente y sin contrasena**. Existe de inmediato, asi que
   * el entrenador puede planificarle entrenos el mismo dia, con la persona
   * todavia delante en el gimnasio y sin esperar a que abra su correo. La
   * activacion llega despues, cuando el titular quiera.
   *
   * Esa separacion es tambien lo que permitira migrar la cartera de clientes que
   * ya existe fuera de la app (requisito 2).
   */
  async crear(datos: CrearUsuario): Promise<UsuarioCreado> {
    const existente = await this.prisma.usuario.findUnique({ where: { email: datos.email } })

    if (existente !== null) {
      // Aqui si se dice que el correo ya existe, al contrario que en el login.
      // Quien llama es el entrenador sobre su propia cartera, no un desconocido
      // probando direcciones, y necesita entender por que no se ha creado.
      throw new ConflictException("Ya existe una cuenta con ese correo")
    }

    const creado = await this.prisma.usuario.create({
      data: {
        email: datos.email,
        nombre: datos.nombre,
        apellidos: datos.apellidos ?? null,
        rol: datos.rol,
        estado: "pendiente",
      },
    })

    // El alta y el envio son dos cosas distintas y pueden fallar por separado.
    //
    // Si el proveedor de correo se cae, perder la cuenta seria peor: el
    // entrenador acaba de teclear los datos con la persona delante. Se conserva,
    // se deja constancia en el log, y se dice la verdad en la respuesta para que
    // pueda reenviar el enlace en lugar de creer que ya salio.
    let correoEnviado = true
    try {
      await this.activacion.enviarEnlace(creado.id)
    } catch (error) {
      correoEnviado = false
      this.registro.error(
        `Cuenta ${creado.id} creada, pero el enlace de activacion no salio: ` +
          (error instanceof Error ? error.message : String(error)),
      )
    }

    return { ...aPublico(creado), correoEnviado }
  }

  /**
   * El listado que ve el entrenador.
   *
   * Excluye a quien pregunta: el entrenador no se administra a si mismo desde la
   * lista de su cartera, y verse ahi solo invita a desactivarse por error.
   *
   * Devuelve el total ademas de las filas. Una lista cortada en silencio es de
   * los fallos que mas tardan en descubrirse: todo parece bien hasta que alguien
   * pregunta por un cliente que no aparece.
   */
  async listar(quienPregunta: string, filtros: FiltrosDeListado): Promise<ListadoUsuarios> {
    const donde: Prisma.UsuarioWhereInput = {
      id: { not: quienPregunta },
      ...(filtros.rol !== undefined && { rol: filtros.rol }),
      ...(filtros.estado !== undefined && { estado: filtros.estado }),
      ...(filtros.buscar !== undefined &&
        filtros.buscar !== "" && {
          // Se busca tambien por correo porque es lo que el entrenador tiene a
          // mano cuando alguien le escribe.
          //
          // La comparacion ignora mayusculas pero NO ignora tildes: buscar
          // "Garcia" no encuentra a "García". Con una cartera de decenas de
          // personas se resuelve mirando la lista entera, asi que no compensa
          // todavia una columna normalizada ni una extension de Postgres.
          OR: [
            { nombre: { contains: filtros.buscar, mode: "insensitive" } },
            { apellidos: { contains: filtros.buscar, mode: "insensitive" } },
            { email: { contains: filtros.buscar, mode: "insensitive" } },
          ],
        }),
    }

    const [usuarios, total] = await Promise.all([
      this.prisma.usuario.findMany({
        where: donde,
        orderBy: [{ nombre: "asc" }, { apellidos: "asc" }],
        skip: filtros.desde,
        take: filtros.limite,
        select: {
          id: true,
          nombre: true,
          apellidos: true,
          email: true,
          rol: true,
          estado: true,
        },
      }),
      this.prisma.usuario.count({ where: donde }),
    ])

    return { usuarios, total }
  }
}

/**
 * Recorta lo que sale hacia la app.
 *
 * Se construye campo a campo en lugar de quitar los que sobran. Asi, el dia que
 * el modelo gane una columna sensible, no aparece sola en la respuesta: hay que
 * escribirla aqui a proposito.
 */
export function aPublico(usuario: {
  id: string
  email: string
  nombre: string
  apellidos: string | null
  rol: UsuarioPublico["rol"]
  estado: UsuarioPublico["estado"]
}): UsuarioPublico {
  return {
    id: usuario.id,
    email: usuario.email,
    nombre: usuario.nombre,
    apellidos: usuario.apellidos,
    rol: usuario.rol,
    estado: usuario.estado,
  }
}
