import { BadRequestException } from "@nestjs/common"
import { FechaAgendaSchema } from "@alpha-omega/shared"
import { z } from "zod"

import { fechaSql } from "../agenda/fechas.js"

/** Qué histórico recorre un cursor: el de medidas no vale para pruebas. */
export type HistoricoPaginado = "medidas" | "pruebas"

/** Lo que ordena el histórico: fecha de la toma, creación e ID para los empates. */
interface Posicion {
  fecha: Date
  creadoEn: Date
  id: string
}

/** Las rutas anteriores siguen devolviendo como mucho esta cantidad, ahora las más recientes. */
export const LIMITE_LISTADO_ANTERIOR = 500

const CursorSchema = z.strictObject({
  v: z.literal(1),
  h: z.enum(["medidas", "pruebas"]),
  f: FechaAgendaSchema,
  c: z.iso.datetime(),
  i: z.uuid(),
})

/** De la toma más reciente a la más antigua, con un orden total y estable. */
export function ordenReciente(): [{ fecha: "desc" }, { creadoEn: "desc" }, { id: "desc" }] {
  return [{ fecha: "desc" }, { creadoEn: "desc" }, { id: "desc" }]
}

function cursorInvalido(): BadRequestException {
  return new BadRequestException({
    statusCode: 400,
    codigo: "solicitud_invalida",
    message: "La página pedida no es válida. Vuelve a cargar el histórico.",
  })
}

/**
 * Lee un cursor recibido. Solo aporta la posición; el cliente lo fija siempre
 * la ruta, y la fila del cursor puede haberse borrado sin impedir seguir.
 */
export function leerCursor(historico: HistoricoPaginado, texto: string): Posicion {
  if (!/^[A-Za-z0-9_-]+$/.test(texto)) throw cursorInvalido()
  let datos: unknown
  try {
    datos = JSON.parse(Buffer.from(texto, "base64url").toString("utf8"))
  } catch {
    throw cursorInvalido()
  }
  const cursor = CursorSchema.safeParse(datos)
  if (!cursor.success || cursor.data.h !== historico) throw cursorInvalido()
  const fecha = fechaSql(cursor.data.f)
  const creadoEn = new Date(cursor.data.c)
  if (
    Number.isNaN(fecha.getTime()) ||
    fecha.toISOString().slice(0, 10) !== cursor.data.f ||
    Number.isNaN(creadoEn.getTime())
  )
    throw cursorInvalido()
  return { fecha, creadoEn, id: cursor.data.i }
}

/** Condición común a medidas y pruebas; se añade a la del cliente, nunca la sustituye. */
interface Anteriores {
  OR?: [
    { fecha: { lt: Date } },
    { fecha: Date; creadoEn: { lt: Date } },
    { fecha: Date; creadoEn: Date; id: { lt: string } },
  ]
}

/** Filas estrictamente anteriores a la posición, en el mismo orden que `ordenReciente`. */
export function anterioresA(posicion: Posicion | undefined): Anteriores {
  if (posicion === undefined) return {}
  const { fecha, creadoEn, id } = posicion
  return {
    OR: [
      { fecha: { lt: fecha } },
      { fecha, creadoEn: { lt: creadoEn } },
      { fecha, creadoEn, id: { lt: id } },
    ],
  }
}

/**
 * Recibe `limite + 1` filas en `ordenReciente`: la sobrante solo indica que
 * hay más, y el cursor apunta a la última entregada.
 */
export function cortarPagina<F extends Posicion>(
  historico: HistoricoPaginado,
  filas: F[],
  limite: number,
): { filas: F[]; siguienteCursor: string | null } {
  if (filas.length <= limite) return { filas, siguienteCursor: null }
  const pagina = filas.slice(0, limite)
  const ultima = pagina[pagina.length - 1]!
  const cursor: z.infer<typeof CursorSchema> = {
    v: 1,
    h: historico,
    f: ultima.fecha.toISOString().slice(0, 10),
    c: ultima.creadoEn.toISOString(),
    i: ultima.id,
  }
  return {
    filas: pagina,
    siguienteCursor: Buffer.from(JSON.stringify(cursor)).toString("base64url"),
  }
}
