import { Injectable, NotFoundException } from "@nestjs/common"
import {
  BorradorValoracionSchema,
  DocumentoValoracionSchema,
  ProximaRevisionSchema,
  PublicacionValoracionSchema,
  ValoracionProfesionalSchema,
  problemasDelDocumento,
  proyeccionCorporal,
  proyeccionPublica,
  type BloqueValoracion,
  type CambiarValoracion,
  type ConsultarValoraciones,
  type CrearValoracion,
  type DefinicionesValoracion,
  type DocumentoValoracion,
  type EstadoValoracion,
  type GuardarProximaRevision,
  type ListadoValoraciones,
  type ListadoValoracionesPublicadas,
  type PlantillaValoracion,
  type ProximaRevision,
  type PublicacionValoracion,
  type PublicarValoracion,
  type ValoracionCliente,
  type ValoracionCorporal,
  type ValoracionProfesional,
} from "@alpha-omega/shared"
import {
  Prisma,
  type BorradorValoracion as FilaBorrador,
  PublicacionValoracion as FilaPublicacion,
  Usuario,
  Valoracion as FilaValoracion,
} from "@prisma/client"

import { fechaSql } from "../agenda/fechas.js"
import { conflicto, hashPeticion, invalida } from "../entrenamiento/documentos.js"
import type { IdentidadVerificada } from "../identity/peticion.js"
import { PrismaService } from "../prisma/prisma.service.js"
import { PlantillasValoracionService } from "./plantillas-valoracion.service.js"

const fecha = (valor: Date): string => valor.toISOString().slice(0, 10)
const esCodigo = (error: unknown, codigo: string): boolean =>
  typeof error === "object" && error !== null && "code" in error && error.code === codigo

type Autor = Pick<Usuario, "id" | "nombre" | "apellidos">
type FilaPublicacionCompleta = FilaPublicacion & {
  autor: Autor
  valoracion: FilaValoracion
  sustituidaPor: { id: string } | null
  borrador: { documento: Prisma.JsonValue }
}
type FilaCompleta = FilaValoracion & {
  borradores: FilaBorrador[]
  publicaciones: FilaPublicacionCompleta[]
}

const INCLUIR = {
  borradores: { where: { valoracionAbiertaId: { not: null } } },
  publicaciones: {
    orderBy: { numero: "desc" },
    take: 1,
    include: {
      autor: true,
      valoracion: true,
      sustituidaPor: { select: { id: true } },
      borrador: { select: { documento: true } },
    },
  },
} satisfies Prisma.ValoracionInclude

/** Copia de la plantilla para los bloques elegidos: solo definiciones activas, sin resultados. */
function copiaDePlantilla(
  plantilla: PlantillaValoracion,
  bloques: BloqueValoracion[],
): DefinicionesValoracion {
  return {
    corporales: plantilla.corporales.filter((d) => d.activa && bloques.includes(d.bloque)),
    pruebas: bloques.includes("pruebas") ? plantilla.pruebas.filter((d) => d.activa) : [],
  }
}

function documentoInicial(
  definiciones: DefinicionesValoracion,
  bloques: BloqueValoracion[],
): DocumentoValoracion {
  return DocumentoValoracionSchema.parse({
    definiciones,
    bloques,
    corporales: definiciones.corporales.map((d) => ({ definicionId: d.id, estado: "pendiente" })),
    pruebas: definiciones.pruebas.map((d) => ({ definicionId: d.id, estado: "pendiente" })),
    grasaPorPliegues: null,
    destacados: [],
    conclusion: null,
    notasInternas: null,
  })
}

function publicacion(fila: FilaPublicacionCompleta): PublicacionValoracion {
  return PublicacionValoracionSchema.parse({
    id: fila.id,
    valoracionId: fila.valoracionId,
    numero: fila.numero,
    sustituyeId: fila.sustituyeId,
    tipo: fila.valoracion.tipo,
    fechaToma: fecha(fila.fechaToma),
    autor: {
      id: fila.autor.id,
      nombre: [fila.autor.nombre, fila.autor.apellidos].filter(Boolean).join(" "),
    },
    publicadaEn: fila.publicadaEn.toISOString(),
    documento: fila.documento,
  })
}

function proxima(
  fila: {
    revision: number
    pauta: Prisma.JsonValue
    cumplidaPorId: string | null
    actualizadoEn: Date
  } | null,
): ProximaRevision {
  if (!fila) return { revision: 0, pauta: null, cumplidaPorId: null, actualizadaEn: null }
  return ProximaRevisionSchema.parse({
    revision: fila.revision,
    pauta: fila.pauta,
    cumplidaPorId: fila.cumplidaPorId,
    actualizadaEn: fila.actualizadoEn.toISOString(),
  })
}

function estado(fila: FilaCompleta): EstadoValoracion {
  if (fila.publicaciones.length === 0) return "borrador"
  return fila.borradores.length > 0 ? "corrigiendo" : "publicada"
}

function profesional(fila: FilaCompleta): ValoracionProfesional {
  const borrador = fila.borradores[0]
  const vigente = fila.publicaciones[0]
  return ValoracionProfesionalSchema.parse({
    id: fila.id,
    clienteId: fila.clienteId,
    tipo: fila.tipo,
    anteriorId: fila.anteriorId,
    estado: estado(fila),
    creadaEn: fila.creadaEn.toISOString(),
    borrador: borrador
      ? BorradorValoracionSchema.parse({
          id: borrador.id,
          revision: borrador.revision,
          fechaToma: fecha(borrador.fechaToma),
          corrigePublicacionId: borrador.corrigePublicacionId,
          documento: borrador.documento,
          creadoEn: borrador.creadoEn.toISOString(),
          actualizadoEn: borrador.actualizadoEn.toISOString(),
        })
      : null,
    publicacion: vigente ? publicacion(vigente) : null,
    // El documento interno de la versión vigente, con sus notas y pendientes.
    documentoVigente: vigente ? vigente.borrador.documento : null,
  })
}

/**
 * Aplica los bloques pedidos sobre la copia guardada: un bloque nuevo añade las
 * definiciones activas de la plantilla vigente; quitar un bloque solo se admite
 * si no tiene ningún resultado anotado.
 */
function definicionesPara(
  actual: DocumentoValoracion,
  plantilla: PlantillaValoracion,
  cambio: CambiarValoracion["contenido"],
): DefinicionesValoracion {
  const nuevos = cambio.bloques.filter((b) => !actual.bloques.includes(b))
  const quitados = actual.bloques.filter((b) => !cambio.bloques.includes(b))
  const quitadas = new Set([
    ...actual.definiciones.corporales.filter((d) => quitados.includes(d.bloque)).map((d) => d.id),
    ...(quitados.includes("pruebas") ? actual.definiciones.pruebas.map((d) => d.id) : []),
  ])
  const anotado = [...actual.corporales, ...actual.pruebas, ...cambio.corporales, ...cambio.pruebas]
    .filter((r) => quitadas.has(r.definicionId))
    .some((r) => r.estado !== "pendiente")
  if (anotado || (quitados.includes("pliegues") && actual.grasaPorPliegues))
    throw invalida("Ese bloque ya tiene resultados: quítalos antes de retirarlo")
  const anadidas = copiaDePlantilla(plantilla, nuevos)
  const presentes = new Set([
    ...actual.definiciones.corporales.map((d) => d.id),
    ...actual.definiciones.pruebas.map((d) => d.id),
  ])
  return {
    corporales: [
      ...actual.definiciones.corporales.filter((d) => !quitadas.has(d.id)),
      ...anadidas.corporales.filter((d) => !presentes.has(d.id)),
    ],
    pruebas: [
      ...actual.definiciones.pruebas.filter((d) => !quitadas.has(d.id)),
      ...anadidas.pruebas.filter((d) => !presentes.has(d.id)),
    ],
  }
}

/** Resultados enviados más un `pendiente` para cada definición que no traiga el cambio. */
function completar(
  definiciones: DefinicionesValoracion,
  cambio: CambiarValoracion["contenido"],
): DocumentoValoracion {
  const conResultado = <R extends { definicionId: string }>(
    defs: { id: string }[],
    resultados: R[],
  ): (R | { definicionId: string; estado: "pendiente" })[] => {
    const ids = new Set(defs.map((d) => d.id))
    const dados = resultados.filter((r) => ids.has(r.definicionId))
    const faltan = defs.filter((d) => !dados.some((r) => r.definicionId === d.id))
    return [...dados, ...faltan.map((d) => ({ definicionId: d.id, estado: "pendiente" as const }))]
  }
  const documento = {
    ...cambio,
    definiciones,
    corporales: conResultado(definiciones.corporales, cambio.corporales),
    pruebas: conResultado(definiciones.pruebas, cambio.pruebas),
  }
  const problemas = problemasDelDocumento(documento as DocumentoValoracion)
  if (problemas.length > 0) throw invalida(problemas.join(". "))
  const leido = DocumentoValoracionSchema.safeParse(documento)
  if (!leido.success) throw invalida("La valoración no es válida")
  return leido.data
}

/**
 * Visitas de valoración. Quién puede tocar a quién lo deciden `@Roles` y
 * `AlcanceClienteGuard`; aquí se filtra además lo que ve cada rol, antes de
 * construir la respuesta: el cliente y el nutricionista nunca reciben
 * borradores ni notas internas.
 */
@Injectable()
export class ValoracionesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly plantillas: PlantillasValoracionService,
  ) {}

  private async clienteActivo(clienteId: string): Promise<void> {
    const cliente = await this.prisma.usuario.findFirst({
      where: { id: clienteId, rol: "cliente" },
      select: { estado: true },
    })
    if (!cliente) throw new NotFoundException("Cliente no disponible")
    if (cliente.estado === "desactivado")
      throw conflicto("operacion_incompatible", "Este cliente está dado de baja")
  }

  private async fila(
    clienteId: string,
    id: string,
    cliente: Prisma.TransactionClient | PrismaService = this.prisma,
  ): Promise<FilaCompleta> {
    const fila = await cliente.valoracion.findFirst({ where: { id, clienteId }, include: INCLUIR })
    if (!fila) throw new NotFoundException("Valoración no disponible")
    return fila
  }

  async crear(
    actor: IdentidadVerificada,
    clienteId: string,
    datos: CrearValoracion,
  ): Promise<ValoracionProfesional> {
    await this.clienteActivo(clienteId)
    if ("corrigePublicacionId" in datos) return this.corregir(actor, clienteId, datos)
    const { operacionId, ...peticion } = datos
    const huella = hashPeticion({ clienteId, ...peticion })
    const repetida = async (): Promise<ValoracionProfesional | null> => {
      const previa = await this.prisma.operacionValoracion.findUnique({
        where: { autorId_operacionId: { autorId: actor.sub, operacionId } },
      })
      if (!previa) return null
      if (previa.hashPeticion !== huella)
        throw conflicto("operacion_incompatible", "Esta operación ya se utilizó con otro contenido")
      return profesional(await this.fila(clienteId, previa.valoracionId))
    }
    const antes = await repetida()
    if (antes) return antes
    try {
      const id = await this.prisma.$transaction(async (tx) => {
        if (peticion.tipo === "revision") {
          const anterior = await tx.valoracion.findFirst({
            where: { id: peticion.anteriorId, clienteId },
            select: { id: true },
          })
          if (!anterior) throw new NotFoundException("Valoración anterior no disponible")
        }
        const plantilla = await this.plantillas.leer(clienteId, tx)
        const documento = documentoInicial(
          copiaDePlantilla(plantilla, peticion.bloques),
          peticion.bloques,
        )
        const valoracion = await tx.valoracion.create({
          data: {
            clienteId,
            autorId: actor.sub,
            tipo: peticion.tipo,
            anteriorId: peticion.tipo === "revision" ? peticion.anteriorId : null,
          },
        })
        if (peticion.tipo === "revision" && peticion.cumplePauta !== null)
          await this.cumplirPauta(tx, clienteId, peticion.cumplePauta, valoracion.id)
        const borrador = await tx.borradorValoracion.create({
          data: {
            valoracionId: valoracion.id,
            valoracionAbiertaId: valoracion.id,
            autorId: actor.sub,
            fechaToma: fechaSql(peticion.fechaToma),
            documento,
          },
        })
        await tx.operacionValoracion.create({
          data: {
            autorId: actor.sub,
            operacionId,
            tipo: "crear",
            hashPeticion: huella,
            valoracionId: valoracion.id,
            borradorId: borrador.id,
          },
        })
        return valoracion.id
      })
      return profesional(await this.fila(clienteId, id))
    } catch (error) {
      // Dos peticiones con la misma operación a la vez: la segunda lee la primera.
      if (esCodigo(error, "P2002")) {
        const ganadora = await repetida()
        if (ganadora) return ganadora
      }
      throw error
    }
  }

  /**
   * Abre una corrección de la publicación vigente: un borrador nuevo sobre la
   * misma visita, copia del documento interno que produjo esa versión (con sus
   * notas y pendientes). Su `revision` continúa la del borrador publicado, para
   * que una edición antigua nunca coincida con la de la corrección.
   */
  private async corregir(
    actor: IdentidadVerificada,
    clienteId: string,
    datos: Extract<CrearValoracion, { corrigePublicacionId: string }>,
  ): Promise<ValoracionProfesional> {
    const { operacionId, corrigePublicacionId } = datos
    const huella = hashPeticion({ clienteId, corrigePublicacionId })
    const repetida = async (): Promise<ValoracionProfesional | null> => {
      const previa = await this.prisma.operacionValoracion.findUnique({
        where: { autorId_operacionId: { autorId: actor.sub, operacionId } },
      })
      if (!previa) return null
      if (previa.hashPeticion !== huella)
        throw conflicto("operacion_incompatible", "Esta operación ya se utilizó con otro contenido")
      return profesional(await this.fila(clienteId, previa.valoracionId))
    }
    const antes = await repetida()
    if (antes) return antes
    try {
      const id = await this.prisma.$transaction(async (tx) => {
        const vigente = await tx.publicacionValoracion.findFirst({
          where: { id: corrigePublicacionId, valoracion: { clienteId } },
          include: { borrador: true, sustituidaPor: { select: { id: true } } },
        })
        if (!vigente) throw new NotFoundException("Publicación no disponible")
        if (vigente.sustituidaPor)
          throw conflicto("estado_incompatible", "Solo se corrige la versión vigente")
        const abierto = await tx.borradorValoracion.findUnique({
          where: { valoracionAbiertaId: vigente.valoracionId },
          select: { id: true },
        })
        if (abierto)
          throw conflicto("estado_incompatible", "Esta valoración ya tiene un borrador abierto")
        const borrador = await tx.borradorValoracion.create({
          data: {
            valoracionId: vigente.valoracionId,
            valoracionAbiertaId: vigente.valoracionId,
            autorId: actor.sub,
            corrigePublicacionId: vigente.id,
            revision: vigente.borrador.revision + 1,
            fechaToma: vigente.fechaToma,
            documento: DocumentoValoracionSchema.parse(vigente.borrador.documento),
          },
        })
        await tx.operacionValoracion.create({
          data: {
            autorId: actor.sub,
            operacionId,
            tipo: "corregir",
            hashPeticion: huella,
            valoracionId: vigente.valoracionId,
            borradorId: borrador.id,
          },
        })
        return vigente.valoracionId
      })
      return profesional(await this.fila(clienteId, id))
    } catch (error) {
      if (esCodigo(error, "P2002")) {
        const ganadora = await repetida()
        if (ganadora) return ganadora
        throw conflicto("estado_incompatible", "Esta valoración ya tiene un borrador abierto")
      }
      throw error
    }
  }

  /**
   * Publica exactamente la revisión indicada del borrador abierto. La versión
   * es inmutable; repetir la operación devuelve la misma publicación.
   */
  async publicar(
    actor: IdentidadVerificada,
    clienteId: string,
    id: string,
    datos: PublicarValoracion,
  ): Promise<PublicacionValoracion> {
    await this.clienteActivo(clienteId)
    const { operacionId, ...peticion } = datos
    const huella = hashPeticion({ clienteId, valoracionId: id, ...peticion })
    const obsoleta = () =>
      conflicto("revision_obsoleta", "La valoración ha cambiado. Recarga antes de publicar.")
    const leerPublicacion = async (publicacionId: string): Promise<PublicacionValoracion> =>
      publicacion(
        await this.prisma.publicacionValoracion.findUniqueOrThrow({
          where: { id: publicacionId },
          include: INCLUIR.publicaciones.include,
        }),
      )
    const repetida = async (): Promise<PublicacionValoracion | null> => {
      const previa = await this.prisma.operacionValoracion.findUnique({
        where: { autorId_operacionId: { autorId: actor.sub, operacionId } },
      })
      if (!previa) return null
      if (previa.hashPeticion !== huella || !previa.publicacionId)
        throw conflicto("operacion_incompatible", "Esta operación ya se utilizó con otro contenido")
      return leerPublicacion(previa.publicacionId)
    }
    const antes = await repetida()
    if (antes) return antes
    try {
      const publicacionId = await this.prisma.$transaction(async (tx) => {
        const fila = await this.fila(clienteId, id, tx)
        const borrador = fila.borradores[0]
        if (!borrador)
          throw conflicto("estado_incompatible", "Esta valoración no tiene un borrador abierto")
        if (borrador.id !== datos.borradorId)
          throw conflicto("estado_incompatible", "Ese borrador ya no es el que está abierto")
        if (borrador.revision !== datos.revision) throw obsoleta()
        const vigente = fila.publicaciones[0] ?? null
        const esperada = borrador.corrigePublicacionId
        if (datos.sustituyePublicacionId !== esperada || (vigente?.id ?? null) !== esperada)
          throw conflicto(
            "estado_incompatible",
            esperada
              ? "Una corrección sustituye a la versión vigente que corrige"
              : "Esta valoración ya se publicó: corrígela",
          )
        const publico = proyeccionPublica(DocumentoValoracionSchema.parse(borrador.documento))
        if (publico.corporales.length + publico.pruebas.length === 0 && !publico.conclusion)
          throw invalida("Anota algún resultado o una conclusión antes de publicar")
        const cerrado = await tx.borradorValoracion.updateMany({
          where: { id: borrador.id, revision: datos.revision, valoracionAbiertaId: id },
          data: { valoracionAbiertaId: null },
        })
        if (cerrado.count !== 1) throw obsoleta()
        const nueva = await tx.publicacionValoracion.create({
          data: {
            valoracionId: id,
            borradorId: borrador.id,
            numero: (vigente?.numero ?? 0) + 1,
            sustituyeId: vigente?.id ?? null,
            fechaToma: borrador.fechaToma,
            autorId: actor.sub,
            documento: publico,
          },
        })
        await tx.operacionValoracion.create({
          data: {
            autorId: actor.sub,
            operacionId,
            tipo: "publicar",
            hashPeticion: huella,
            valoracionId: id,
            borradorId: borrador.id,
            publicacionId: nueva.id,
          },
        })
        return nueva.id
      })
      return leerPublicacion(publicacionId)
    } catch (error) {
      // Otra publicación del mismo borrador ganó la carrera.
      if (esCodigo(error, "P2002")) {
        const ganadora = await repetida()
        if (ganadora) return ganadora
        throw obsoleta()
      }
      throw error
    }
  }

  /** Solo esta acción marca cumplida la pauta; leerla o abrirla no. */
  private async cumplirPauta(
    tx: Prisma.TransactionClient,
    clienteId: string,
    revision: number,
    valoracionId: string,
  ): Promise<void> {
    const actual = await tx.proximaRevisionValoracion.findUnique({ where: { clienteId } })
    if (!actual || actual.pauta === null)
      throw conflicto("estado_incompatible", "No hay una próxima revisión pautada que cumplir")
    if (actual.revision !== revision)
      throw conflicto("revision_obsoleta", "La próxima revisión ha cambiado. Recarga.")
    if (actual.cumplidaPorId)
      throw conflicto("estado_incompatible", "Esa revisión pautada ya se realizó")
    const cumplida = await tx.proximaRevisionValoracion.updateMany({
      where: { clienteId, revision, cumplidaPorId: null },
      data: { cumplidaPorId: valoracionId, revision: { increment: 1 } },
    })
    if (cumplida.count !== 1)
      throw conflicto("revision_obsoleta", "La próxima revisión ha cambiado. Recarga.")
  }

  async proximaRevision(clienteId: string): Promise<ProximaRevision> {
    const fila = await this.prisma.proximaRevisionValoracion.findUnique({ where: { clienteId } })
    return proxima(fila)
  }

  /** Guardar una pauta nueva (o quitarla) la deja otra vez pendiente. */
  async guardarProximaRevision(
    clienteId: string,
    datos: GuardarProximaRevision,
  ): Promise<ProximaRevision> {
    await this.clienteActivo(clienteId)
    const obsoleta = () =>
      conflicto("revision_obsoleta", "La próxima revisión ha cambiado. Recarga antes de guardar.")
    const pauta = datos.pauta ?? Prisma.DbNull
    try {
      const fila =
        datos.revision === 0
          ? await this.prisma.proximaRevisionValoracion.create({
              data: { clienteId, revision: 1, pauta },
            })
          : await this.prisma.proximaRevisionValoracion.update({
              where: { clienteId, revision: datos.revision },
              data: { revision: { increment: 1 }, pauta, cumplidaPorId: null },
            })
      return proxima(fila)
    } catch (error) {
      if (esCodigo(error, "P2002") || esCodigo(error, "P2025")) throw obsoleta()
      throw error
    }
  }

  async cambiar(
    clienteId: string,
    id: string,
    datos: CambiarValoracion,
  ): Promise<ValoracionProfesional> {
    await this.clienteActivo(clienteId)
    const obsoleta = () =>
      conflicto("revision_obsoleta", "La valoración ha cambiado. Recarga antes de guardar.")
    await this.prisma.$transaction(async (tx) => {
      const fila = await this.fila(clienteId, id, tx)
      const borrador = fila.borradores[0]
      if (!borrador)
        throw conflicto("estado_incompatible", "Esta valoración no tiene un borrador abierto")
      if (borrador.id !== datos.borradorId)
        throw conflicto("estado_incompatible", "Ese borrador ya no es el que está abierto")
      if (borrador.revision !== datos.revision) throw obsoleta()
      const actual = DocumentoValoracionSchema.parse(borrador.documento)
      const plantilla = await this.plantillas.leer(clienteId, tx)
      const documento = completar(
        definicionesPara(actual, plantilla, datos.contenido),
        datos.contenido,
      )
      const cambiadas = await tx.borradorValoracion.updateMany({
        where: { id: borrador.id, revision: datos.revision, valoracionAbiertaId: id },
        data: {
          revision: { increment: 1 },
          fechaToma: fechaSql(datos.fechaToma),
          documento,
        },
      })
      if (cambiadas.count !== 1) throw obsoleta()
    })
    return profesional(await this.fila(clienteId, id))
  }

  /**
   * Lectura por rol. Para cliente y nutricionista una visita sin publicación
   * responde igual que una inexistente: no revela que haya un borrador.
   */
  async leer(
    actor: IdentidadVerificada,
    clienteId: string,
    id: string,
  ): Promise<ValoracionProfesional | ValoracionCliente | ValoracionCorporal> {
    if (actor.rol === "entrenador") return profesional(await this.fila(clienteId, id))
    const vigente = await this.prisma.publicacionValoracion.findFirst({
      where: { valoracionId: id, valoracion: { clienteId }, sustituidaPor: null },
      include: {
        autor: true,
        valoracion: true,
        sustituidaPor: { select: { id: true } },
        borrador: { select: { documento: true } },
      },
    })
    if (!vigente) throw new NotFoundException("Valoración no disponible")
    const publicada = publicacion(vigente)
    return actor.rol === "cliente" ? { publicacion: publicada } : proyeccionCorporal(publicada)
  }

  async listar(
    actor: IdentidadVerificada,
    clienteId: string,
    consulta: ConsultarValoraciones,
  ): Promise<ListadoValoraciones | ListadoValoracionesPublicadas> {
    const soloPublicadas = actor.rol !== "entrenador"
    const where: Prisma.ValoracionWhereInput = {
      clienteId,
      ...(soloPublicadas && { publicaciones: { some: {} } }),
    }
    const [total, filas] = await this.prisma.$transaction([
      this.prisma.valoracion.count({ where }),
      this.prisma.valoracion.findMany({
        where,
        include: INCLUIR,
        orderBy: [{ creadaEn: "desc" }, { id: "desc" }],
        skip: consulta.desplazamiento,
        take: consulta.limite,
      }),
    ])
    // Cliente y nutricionista ven solo lo publicado, sin saber si hay una corrección en curso.
    if (soloPublicadas)
      return {
        total,
        valoraciones: filas.map((fila) => {
          const vigente = fila.publicaciones[0]!
          return {
            id: fila.id,
            tipo: fila.tipo,
            fechaToma: fecha(vigente.fechaToma),
            publicadaEn: vigente.publicadaEn.toISOString(),
            numeroPublicacion: vigente.numero,
          }
        }),
      }
    return {
      total,
      valoraciones: filas.map((fila) => {
        const vigente = fila.publicaciones[0]
        return {
          id: fila.id,
          tipo: fila.tipo,
          estado: estado(fila),
          fechaToma: fecha(fila.borradores[0]?.fechaToma ?? vigente?.fechaToma ?? fila.creadaEn),
          publicadaEn: vigente?.publicadaEn.toISOString() ?? null,
          numeroPublicacion: vigente?.numero ?? null,
        }
      }),
    }
  }
}
