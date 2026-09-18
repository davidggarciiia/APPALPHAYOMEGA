import {
  BadRequestException,
  ConflictException,
  HttpException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common"
import type {
  CambiosDeUsuario,
  CrearUsuario,
  FichaDeUsuario,
  FiltrosDeListado,
  ListadoUsuarios,
  ResultadoDeEnvio,
  UsuarioCreado,
  UsuarioPublico,
} from "@alpha-omega/shared"
import type { Prisma } from "@prisma/client"

import { PrismaService } from "../prisma/prisma.service.js"

import { ActivacionService } from "./activacion.service.js"
import { TokensRefrescoService } from "./tokens-refresco.service.js"

@Injectable()
export class UsuariosService {
  private readonly registro = new Logger(UsuariosService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly activacion: ActivacionService,
    private readonly refrescos: TokensRefrescoService,
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
    if (datos.rol === "entrenador") {
      // El negocio tiene un entrenador y su cuenta nace del seed, que es la
      // unica via. Dejar que esta ruta cree otro convierte el alta de clientes
      // en una fabrica de administradores: quien se cuele una vez con la sesion
      // del entrenador se fabrica una cuenta propia y ya no hace falta volver a
      // colarse. Que la app no ofrezca la opcion es comodidad, no una defensa.
      throw new BadRequestException("Desde aqui no se crean cuentas de entrenador")
    }

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
        orderBy: [{ nombre: "asc" }, { apellidos: "asc" }, { id: "asc" }],
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

  /** La ficha completa de una persona. La pantalla de edicion parte de aqui. */
  async leer(id: string): Promise<FichaDeUsuario> {
    return aFicha(await this.buscar(id))
  }

  /**
   * Corrige los datos de contacto de una ficha.
   *
   * El `data` se construye campo a campo. Escribir `data: { ...cambios }` seria
   * comodo y convertiria esta pantalla en un ascensor de permisos el dia que el
   * contrato dejara pasar un campo de mas.
   *
   * Se permite editar a alguien desactivado: corregir un telefono en una ficha
   * historica no le devuelve ningun acceso.
   */
  async actualizar(
    quienPregunta: string,
    id: string,
    cambios: CambiosDeUsuario,
  ): Promise<FichaDeUsuario> {
    this.comprobarQueNoEsUnoMismo(quienPregunta, id)
    await this.buscar(id)

    const actualizado = await this.prisma.usuario.update({
      where: { id },
      data: {
        ...(cambios.nombre !== undefined && { nombre: cambios.nombre }),
        ...(cambios.apellidos !== undefined && { apellidos: vacioEsNulo(cambios.apellidos) }),
        ...(cambios.telefono !== undefined && { telefono: vacioEsNulo(cambios.telefono) }),
        ...(cambios.fechaNacimiento !== undefined && {
          fechaNacimiento:
            cambios.fechaNacimiento === null ? null : new Date(cambios.fechaNacimiento),
        }),
      },
    })

    return aFicha(actualizado)
  }

  /**
   * Corrige el correo de quien todavia no ha activado.
   *
   * Un correo mal tecleado con la persona delante deja una cuenta que no recibe
   * nada y que no se puede borrar. Se acota a `pendiente` a proposito: en cuanto
   * alguien entra con esa direccion, cambiarla es cambiar de identidad y exigiria
   * verificar la nueva antes de aceptarla, o cualquiera se apropiaria de la
   * cuenta de otro.
   *
   * No reenvia nada. Corregir y volver a invitar son dos decisiones distintas, y
   * el entrenador puede querer revisar la ficha entera antes de mandar el correo.
   */
  async corregirCorreo(quienPregunta: string, id: string, email: string): Promise<FichaDeUsuario> {
    this.comprobarQueNoEsUnoMismo(quienPregunta, id)
    const usuario = await this.buscar(id)

    if (usuario.estado !== "pendiente") {
      throw new BadRequestException("Solo se puede corregir el correo de quien no ha activado")
    }

    if (email !== usuario.email) {
      // Se comprueba antes de escribir para poder decir que el correo ya existe,
      // en lugar de dejar que salga el error crudo de la restriccion unica.
      const ocupado = await this.prisma.usuario.findUnique({ where: { email } })

      if (ocupado !== null) {
        throw new ConflictException("Ya existe una cuenta con ese correo")
      }
    }

    return this.prisma.$transaction(async (tx) => {
      // La escritura comprueba de nuevo el estado y serializa la correccion con
      // activar y reenviar. Leer pendiente antes de la transaccion no basta.
      const cambiado = await tx.usuario.updateMany({
        where: { id, estado: "pendiente", email: usuario.email },
        data: { email },
      })
      if (cambiado.count !== 1) {
        throw new BadRequestException("El perfil ha cambiado. Vuelve a cargarlo")
      }
      if (email !== usuario.email) {
        await tx.tokenActivacion.updateMany({
          where: { usuarioId: id, usadoEn: null },
          data: { usadoEn: new Date() },
        })
      }
      return aFicha(await tx.usuario.findUniqueOrThrow({ where: { id } }))
    })
  }

  /**
   * Vuelve a mandar el enlace de activacion.
   *
   * El trabajo de verdad ya estaba hecho: `enviarEnlace` quema los enlaces vivos
   * antes de crear el nuevo, asi que "el reenvio invalida el anterior" se cumple
   * por construccion y no por una comprobacion que alguien pueda olvidar.
   *
   * Un fallo del proveedor de correo no es un error de la peticion: se devuelve
   * `correoEnviado: false`. Aqui importa mas que en el alta, porque al llegar el
   * fallo el enlace anterior YA esta quemado. Contestar con un error haria creer
   * al entrenador que no ha pasado nada, cuando su cliente se ha quedado sin
   * ningun enlace valido.
   */
  async reenviarActivacion(quienPregunta: string, id: string): Promise<ResultadoDeEnvio> {
    this.comprobarQueNoEsUnoMismo(quienPregunta, id)
    const usuario = await this.buscar(id)

    let correoEnviado = true
    try {
      await this.activacion.enviarEnlace(id)
    } catch (error) {
      // La negativa por estado ("este perfil no esta pendiente") es una respuesta
      // legitima y sube tal cual. Solo se traga el fallo del proveedor.
      if (error instanceof HttpException) {
        throw error
      }

      correoEnviado = false
      this.registro.error(
        `Reenvio de activacion fallido para ${id}: ` +
          (error instanceof Error ? error.message : String(error)),
      )
    }

    return { usuario: aFicha(usuario), correoEnviado }
  }

  /**
   * Da de baja a alguien.
   *
   * El estado y las credenciales se cambian juntos. El estado por si solo parece suficiente porque
   * el guard lee el estado en cada peticion y corta el acceso, pero eso solo
   * tapa las otras dos:
   *
   * 1. Las sesiones vivas se revocan. Si no, sus tokens de refresco siguen
   *    validos hasta treinta dias y volverian a servir el dia que se reactive la
   *    cuenta.
   * 2. Los enlaces de activacion vivos se queman. Si no, alguien dado de baja
   *    mientras estaba pendiente reactiva su cuenta abriendo un correo, y la
   *    decision del entrenador se deshace sola.
   *
   * No hay borrado duro en ninguna parte: el historico de entrenos tiene que
   * sobrevivir a la baja (requisito 14).
   */
  async desactivar(quienPregunta: string, id: string): Promise<FichaDeUsuario> {
    this.comprobarQueNoEsUnoMismo(quienPregunta, id)
    await this.buscar(id)

    const desactivado = await this.prisma.$transaction(async (tx) => {
      const actualizado = await tx.usuario.update({
        where: { id },
        data: { estado: "desactivado" },
      })

      await this.refrescos.revocarTodosDe(id, tx)
      await tx.tokenActivacion.updateMany({
        where: { usuarioId: id, usadoEn: null },
        data: { usadoEn: new Date() },
      })
      await tx.tokenRecuperacion.updateMany({
        where: { usuarioId: id, usadoEn: null },
        data: { usadoEn: new Date() },
      })

      return actualizado
    })

    this.registro.log(`Baja: ${quienPregunta} desactiva a ${id}`)

    return aFicha(desactivado)
  }

  /**
   * Deshace una baja.
   *
   * El estado se DERIVA de si hay contrasena, nunca se fija a `activo` a ciegas.
   * Un `activo` sin contrasena no puede iniciar sesion (no hay nada contra lo que
   * comprobar) y tampoco puede recibir un enlace nuevo (solo se manda a quien
   * esta pendiente): esa persona quedaria encerrada fuera de su cuenta sin
   * ninguna salida por la API.
   *
   * Reactivar no resucita nada. Ni las sesiones antiguas, que siguen revocadas,
   * ni los enlaces quemados: si vuelve a pendiente, hay que reenviarle uno a
   * proposito.
   */
  async reactivar(quienPregunta: string, id: string): Promise<FichaDeUsuario> {
    this.comprobarQueNoEsUnoMismo(quienPregunta, id)
    const usuario = await this.buscar(id)

    if (usuario.estado !== "desactivado") {
      // Idempotente: reactivar a quien ya entra no es un error, es un segundo
      // toque en un sotano con mala cobertura.
      return aFicha(usuario)
    }

    const reactivado = await this.prisma.usuario.update({
      where: { id },
      data: { estado: usuario.passwordHash === null ? "pendiente" : "activo" },
    })

    this.registro.log(`Alta de nuevo: ${quienPregunta} reactiva a ${id}`)

    return aFicha(reactivado)
  }

  /**
   * Nadie se administra a si mismo desde estas rutas.
   *
   * Solo hay un entrenador en el negocio: sin esta linea puede darse de baja o
   * quitarse su propio correo y quedarse sin forma de entrar ni de arreglarlo
   * desde la app. Se responde 400 y no 403 porque no es un problema de permisos
   * sino de a quien se apunta.
   */
  private comprobarQueNoEsUnoMismo(quienPregunta: string, id: string): void {
    if (quienPregunta === id) {
      throw new BadRequestException("Tu propia cuenta se administra desde tu perfil")
    }
  }

  /** Lee una ficha o responde 404. Antes de cualquier escritura por id. */
  private async buscar(id: string): Promise<UsuarioCompleto> {
    const usuario = await this.prisma.usuario.findUnique({ where: { id } })

    if (usuario === null) {
      // Sin esto, `update` con un id inexistente lanza P2025 y sale como un 500,
      // que es un fallo del servidor donde en realidad hay una peticion a alguien
      // que no existe.
      throw new NotFoundException("Esta cuenta no existe")
    }

    return usuario
  }
}

type UsuarioCompleto = {
  id: string
  email: string
  nombre: string
  apellidos: string | null
  telefono: string | null
  fechaNacimiento: Date | null
  passwordHash: string | null
  rol: UsuarioPublico["rol"]
  estado: UsuarioPublico["estado"]
  creadoEn: Date
}

/**
 * Un texto vacio es como un formulario dice "lo he borrado". Se guarda nulo para
 * que la base no distinga entre "sin telefono" y "telefono en blanco".
 */
function vacioEsNulo(valor: string | null): string | null {
  return valor === null || valor === "" ? null : valor
}

/**
 * Recorta la ficha que ve el entrenador, campo a campo como `aPublico`.
 *
 * El hash no sale nunca. Lo unico que se dice de la contrasena es si existe, y
 * eso es lo que permite a la pantalla anticipar a donde volvera alguien al
 * reactivarlo.
 */
export function aFicha(usuario: UsuarioCompleto): FichaDeUsuario {
  return {
    ...aPublico(usuario),
    telefono: usuario.telefono,
    // Solo la fecha, sin hora: guardar la hora de un cumpleanos no significa nada
    // y arrastra zonas horarias.
    fechaNacimiento: usuario.fechaNacimiento?.toISOString().slice(0, 10) ?? null,
    creadoEn: usuario.creadoEn.toISOString(),
    tieneContrasena: usuario.passwordHash !== null,
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
