import { useMemo } from "react"
import { randomUUID } from "expo-crypto"
import {
  ActivacionProductoSchema,
  ActivarProductoSchema,
  ActivarSolicitudSchema,
  AjustesAgendaSchema,
  CambiosAjustesAgendaSchema,
  CambiosProductoSchema,
  CambiosServicioSchema,
  CancelarReservaSchema,
  CobroSchema,
  CrearExcepcionSchema,
  DetalleSaldoSchema,
  DisponibilidadSchema,
  ExcepcionAgendaSchema,
  HorarioSemanalSchema,
  ListadoCobrosSchema,
  ListadoExcepcionesSchema,
  ListadoProductosSchema,
  ListadoReservasSchema,
  ListadoServiciosSchema,
  ListadoSolicitudesSchema,
  ListadoUsuariosSchema,
  MisReservasSchema,
  MoverReservaSchema,
  PedirProductoSchema,
  ProductoSchema,
  ReservarSchema,
  ReservaSchema,
  ResumenCobrosSchema,
  ResumenSaldoSchema,
  ServicioSchema,
  SolicitudProductoSchema,
  type ActivacionProducto,
  type ActivarProducto,
  type ActivarSolicitud,
  type AjustesAgenda,
  type CambiosAjustesAgenda,
  type CambiosProducto,
  type CambiosServicio,
  type CancelarReserva,
  type Cobro,
  type CrearExcepcion,
  type DetalleSaldo,
  type Disponibilidad,
  type EstadoCobro,
  type ExcepcionAgenda,
  type HorarioSemanal,
  type ListadoCobros,
  type ListadoExcepciones,
  type ListadoProductos,
  type ListadoReservas,
  type ListadoServicios,
  type ListadoSolicitudes,
  type MisReservas,
  type MoverReserva,
  type Producto,
  type Reserva,
  type ResumenCobros,
  type ResumenSaldo,
  type ResumenUsuario,
  type Servicio,
  type SolicitudProducto,
} from "@alpha-omega/shared"
import { z } from "zod"

import { ErrorDePeticion } from "../lib/http"
import type { PeticionAutenticada } from "../lib/peticion-autenticada"
import { useSesion } from "../sesion"

/** Lo que se pide al reservar. El id de operación lo pone la API. */
export type DatosReserva = { servicioId: string; inicio: string; personas: number }
export type DatosActivacion = Omit<ActivarProducto, "operacionId">

/** Lo que las pantallas de reservas y saldo necesitan del servidor. Las pruebas usan dobles. */
export type ApiReservas = {
  // Agenda, cliente y entrenador.
  servicios: () => Promise<ListadoServicios>
  /** Huecos libres desde `desde` (fecha local) durante `dias` días, de 1 a 14. */
  disponibilidad: (servicioId: string, desde: string, dias: number) => Promise<Disponibilidad>
  ajustes: () => Promise<AjustesAgenda>
  // Cliente.
  misReservas: () => Promise<MisReservas>
  reservar: (datos: DatosReserva) => Promise<Reserva>
  cancelarMia: (id: string, datos?: CancelarReserva) => Promise<Reserva>
  // Entrenador.
  guardarAjustes: (cambios: CambiosAjustesAgenda) => Promise<AjustesAgenda>
  reservas: (desde: string, hasta: string) => Promise<ListadoReservas>
  reservarPara: (clienteId: string, datos: DatosReserva) => Promise<Reserva>
  cancelar: (id: string, datos?: CancelarReserva) => Promise<Reserva>
  devolver: (id: string) => Promise<Reserva>
  mover: (id: string, datos: MoverReserva) => Promise<Reserva>
  horario: () => Promise<HorarioSemanal>
  guardarHorario: (horario: HorarioSemanal) => Promise<HorarioSemanal>
  excepciones: (desde: string, hasta: string) => Promise<ListadoExcepciones>
  crearExcepcion: (datos: CrearExcepcion) => Promise<ExcepcionAgenda>
  borrarExcepcion: (id: string) => Promise<void>
  cambiarServicio: (id: string, cambios: CambiosServicio) => Promise<Servicio>
  /** Clientes de la cartera a los que se puede reservar: pendientes y activos. */
  clientes: (buscar: string) => Promise<ResumenUsuario[]>
  // Planes, cliente.
  productos: () => Promise<ListadoProductos>
  miSaldo: () => Promise<ResumenSaldo>
  misSolicitudes: () => Promise<ListadoSolicitudes>
  pedirProducto: (productoId: string) => Promise<SolicitudProducto>
  anularSolicitud: (id: string) => Promise<SolicitudProducto>
  // Planes, entrenador.
  cambiarProducto: (id: string, cambios: CambiosProducto) => Promise<Producto>
  solicitudesPendientes: () => Promise<ListadoSolicitudes>
  activarSolicitud: (id: string, datos: ActivarSolicitud) => Promise<ActivacionProducto>
  rechazarSolicitud: (id: string) => Promise<SolicitudProducto>
  activarProducto: (clienteId: string, datos: DatosActivacion) => Promise<ActivacionProducto>
  saldoCliente: (clienteId: string) => Promise<DetalleSaldo>
  cobros: (filtros: {
    estado?: EstadoCobro
    clienteId?: string
    limite?: number
  }) => Promise<ListadoCobros>
  cobrar: (id: string) => Promise<Cobro>
  anularCobro: (id: string) => Promise<Cobro>
  resumenCobros: (mes: string) => Promise<ResumenCobros>
}

const id = (valor: string): string => encodeURIComponent(valor)
const consulta = (valores: Record<string, string | number | undefined>): string =>
  Object.entries(valores)
    .filter(([, valor]) => valor !== undefined && valor !== "")
    .map(([clave, valor]) => `${clave}=${encodeURIComponent(String(valor))}`)
    .join("&")

/**
 * Ids de operación ligados a su contenido.
 *
 * Repetir la MISMA operación (misma ruta y mismo cuerpo) tras un fallo de red o
 * del servidor reutiliza el id, y el servidor devuelve la reserva que quizá ya
 * creó en lugar de gastar otra sesión. Cambiar el contenido es otra operación y
 * lleva otro id. Una respuesta definitiva (hecho, o un 400/409 del contrato)
 * cierra la operación: el siguiente intento ya es nuevo.
 */
function crearOperaciones(nuevoId: () => string) {
  const abiertas = new Map<string, string>()
  return async <T>(
    ruta: string,
    contenido: object,
    enviar: (operacionId: string) => Promise<T>,
  ): Promise<T> => {
    const clave = `${ruta} ${JSON.stringify(contenido)}`
    let operacionId = abiertas.get(clave)
    if (operacionId === undefined) {
      operacionId = nuevoId()
      abiertas.set(clave, operacionId)
    }
    try {
      const resultado = await enviar(operacionId)
      abiertas.delete(clave)
      return resultado
    } catch (error) {
      if (error instanceof ErrorDePeticion) abiertas.delete(clave)
      throw error
    }
  }
}

export function crearApiReservas(
  pedir: PeticionAutenticada,
  nuevoId: () => string = randomUUID,
): ApiReservas {
  const operacion = crearOperaciones(nuevoId)
  const post = <T>(ruta: string, esquema: z.ZodType<T>, cuerpo?: unknown): Promise<T> =>
    pedir(ruta, esquema, {
      method: "POST",
      ...(cuerpo === undefined ? {} : { body: JSON.stringify(cuerpo) }),
    })
  const patch = <T>(ruta: string, esquema: z.ZodType<T>, cuerpo: unknown): Promise<T> =>
    pedir(ruta, esquema, { method: "PATCH", body: JSON.stringify(cuerpo) })
  const reservarEn = (ruta: string, datos: DatosReserva): Promise<Reserva> =>
    operacion(ruta, datos, (operacionId) =>
      post(ruta, ReservaSchema, ReservarSchema.parse({ operacionId, ...datos })),
    )

  return {
    servicios: () => pedir("/agenda/servicios", ListadoServiciosSchema),
    disponibilidad: (servicioId, desde, dias) =>
      pedir(
        `/agenda/disponibilidad?${consulta({ servicioId, desde, dias })}`,
        DisponibilidadSchema,
      ),
    ajustes: () => pedir("/agenda/ajustes", AjustesAgendaSchema),
    misReservas: () => pedir("/agenda/mis-reservas", MisReservasSchema),
    reservar: (datos) => reservarEn("/agenda/mis-reservas", datos),
    cancelarMia: (reserva, datos = {}) =>
      post(
        `/agenda/mis-reservas/${id(reserva)}/cancelar`,
        ReservaSchema,
        CancelarReservaSchema.parse(datos),
      ),
    guardarAjustes: (cambios) =>
      patch("/agenda/ajustes", AjustesAgendaSchema, CambiosAjustesAgendaSchema.parse(cambios)),
    reservas: (desde, hasta) =>
      pedir(`/agenda/reservas?${consulta({ desde, hasta })}`, ListadoReservasSchema),
    reservarPara: (clienteId, datos) =>
      reservarEn(`/agenda/clientes/${id(clienteId)}/reservas`, datos),
    cancelar: (reserva, datos = {}) =>
      post(
        `/agenda/reservas/${id(reserva)}/cancelar`,
        ReservaSchema,
        CancelarReservaSchema.parse(datos),
      ),
    devolver: (reserva) => post(`/agenda/reservas/${id(reserva)}/devolver`, ReservaSchema),
    mover: (reserva, datos) =>
      patch(`/agenda/reservas/${id(reserva)}`, ReservaSchema, MoverReservaSchema.parse(datos)),
    horario: () => pedir("/agenda/horario-semanal", HorarioSemanalSchema),
    guardarHorario: (horario) =>
      pedir("/agenda/horario-semanal", HorarioSemanalSchema, {
        method: "PUT",
        body: JSON.stringify(HorarioSemanalSchema.parse(horario)),
      }),
    excepciones: (desde, hasta) =>
      pedir(`/agenda/excepciones?${consulta({ desde, hasta })}`, ListadoExcepcionesSchema),
    crearExcepcion: (datos) =>
      post("/agenda/excepciones", ExcepcionAgendaSchema, CrearExcepcionSchema.parse(datos)),
    borrarExcepcion: async (excepcion) => {
      await pedir(`/agenda/excepciones/${id(excepcion)}`, z.null(), { method: "DELETE" })
    },
    cambiarServicio: (servicio, cambios) =>
      patch(
        `/agenda/servicios/${id(servicio)}`,
        ServicioSchema,
        CambiosServicioSchema.parse(cambios),
      ),
    clientes: async (buscar) => {
      const listado = await pedir(
        `/usuarios?${consulta({ rol: "cliente", buscar: buscar.trim(), limite: 100, desde: 0 })}`,
        ListadoUsuariosSchema,
      )
      // A quien está de baja no se le reserva: la API lo rechazaría.
      return listado.usuarios.filter((usuario) => usuario.estado !== "desactivado")
    },
    productos: () => pedir("/planes/productos", ListadoProductosSchema),
    miSaldo: () => pedir("/planes/mi-saldo", ResumenSaldoSchema),
    misSolicitudes: () => pedir("/planes/mis-solicitudes", ListadoSolicitudesSchema),
    pedirProducto: (productoId) =>
      operacion("/planes/mis-solicitudes", { productoId }, (operacionId) =>
        post(
          "/planes/mis-solicitudes",
          SolicitudProductoSchema,
          PedirProductoSchema.parse({ operacionId, productoId }),
        ),
      ),
    anularSolicitud: (solicitud) =>
      post(`/planes/mis-solicitudes/${id(solicitud)}/anular`, SolicitudProductoSchema),
    cambiarProducto: (producto, cambios) =>
      patch(
        `/planes/productos/${id(producto)}`,
        ProductoSchema,
        CambiosProductoSchema.parse(cambios),
      ),
    solicitudesPendientes: () =>
      pedir(`/planes/solicitudes?${consulta({ estado: "pendiente" })}`, ListadoSolicitudesSchema),
    activarSolicitud: (solicitud, datos) =>
      post(
        `/planes/solicitudes/${id(solicitud)}/activar`,
        ActivacionProductoSchema,
        ActivarSolicitudSchema.parse(datos),
      ),
    rechazarSolicitud: (solicitud) =>
      post(`/planes/solicitudes/${id(solicitud)}/rechazar`, SolicitudProductoSchema),
    activarProducto: (clienteId, datos) => {
      const ruta = `/planes/clientes/${id(clienteId)}/activaciones`
      return operacion(ruta, datos, (operacionId) =>
        post(
          ruta,
          ActivacionProductoSchema,
          ActivarProductoSchema.parse({ operacionId, ...datos }),
        ),
      )
    },
    saldoCliente: (clienteId) =>
      pedir(`/planes/clientes/${id(clienteId)}/saldo`, DetalleSaldoSchema),
    cobros: ({ estado, clienteId, limite }) =>
      pedir(`/planes/cobros?${consulta({ estado, clienteId, limite })}`, ListadoCobrosSchema),
    cobrar: (cobro) => post(`/planes/cobros/${id(cobro)}/cobrar`, CobroSchema),
    anularCobro: (cobro) => post(`/planes/cobros/${id(cobro)}/anular`, CobroSchema),
    resumenCobros: (mes) =>
      pedir(`/planes/cobros/resumen?${consulta({ mes })}`, ResumenCobrosSchema),
  }
}

export function useReservas(): ApiReservas {
  const { pedir } = useSesion()
  return useMemo(() => crearApiReservas(pedir), [pedir])
}
