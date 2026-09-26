import { describe, expect, it, jest } from "@jest/globals"

import { ErrorDePeticion, ErrorDeRed } from "../lib/http"
import type { PeticionAutenticada } from "../lib/peticion-autenticada"
import { crearApiReservas, type ApiReservas } from "./api"
import {
  CLIENTE,
  EP,
  cobro,
  disponibilidad,
  en,
  producto,
  reserva,
  saldo,
  solicitud,
  uuid,
} from "./pruebas/datos"

jest.mock("expo-crypto", () => ({ randomUUID: jest.fn() }))

const R = reserva()
const AJUSTES = { antelacionMin: 120, horizonteDias: 28, cancelacionHoras: 24, intervaloMin: 60 }
const HORARIO = { franjas: [{ diaSemana: 1, inicioMin: 480, finMin: 840 }] }
const EXCEPCION = {
  id: uuid(11, 1),
  tipo: "cierre" as const,
  inicio: en("2026-10-08", "00:00"),
  fin: en("2026-10-09", "00:00"),
  motivo: "Formación",
  creadaEn: "2026-10-01T09:00:00+02:00",
}
const ACTIVACION = { solicitudId: null, saldo: saldo(), cobro: cobro() }

/** `pedir` que devuelve lo indicado y apunta cada llamada. */
function conRespuesta(respuesta: unknown) {
  const pedir = jest.fn(async (_ruta: string, esquema: { parse: (v: unknown) => unknown }) =>
    esquema.parse(respuesta),
  )
  let n = 0
  const api = crearApiReservas(pedir as unknown as PeticionAutenticada, () => uuid(1, ++n))
  const llamada = (i = 0) => {
    const [ruta, , opciones] = pedir.mock.calls[i] as unknown as [string, unknown, RequestInit?]
    return {
      ruta,
      metodo: opciones?.method ?? "GET",
      cuerpo:
        typeof opciones?.body === "string" ? (JSON.parse(opciones.body) as unknown) : undefined,
    }
  }
  return { api, pedir, llamada }
}

type Caso = [
  string,
  (api: ApiReservas) => Promise<unknown>,
  unknown,
  { ruta: string; metodo: string; cuerpo?: unknown },
]

const CASOS: Caso[] = [
  [
    "servicios",
    (a) => a.servicios(),
    { servicios: [EP] },
    { ruta: "/agenda/servicios", metodo: "GET" },
  ],
  [
    "disponibilidad",
    (a) => a.disponibilidad(EP.id, "2026-10-05", 14),
    disponibilidad(EP.id, {}),
    {
      ruta: `/agenda/disponibilidad?servicioId=${EP.id}&desde=2026-10-05&dias=14`,
      metodo: "GET",
    },
  ],
  ["ajustes", (a) => a.ajustes(), AJUSTES, { ruta: "/agenda/ajustes", metodo: "GET" }],
  [
    "guardar ajustes",
    (a) => a.guardarAjustes({ cancelacionHoras: 12 }),
    AJUSTES,
    { ruta: "/agenda/ajustes", metodo: "PATCH", cuerpo: { cancelacionHoras: 12 } },
  ],
  [
    "mis reservas",
    (a) => a.misReservas(),
    { proximas: [R], pasadas: [] },
    { ruta: "/agenda/mis-reservas", metodo: "GET" },
  ],
  [
    "cancelar la mía",
    (a) => a.cancelarMia(R.id),
    R,
    { ruta: `/agenda/mis-reservas/${R.id}/cancelar`, metodo: "POST", cuerpo: {} },
  ],
  [
    "reservas de la semana",
    (a) => a.reservas("2026-10-05", "2026-10-11"),
    { reservas: [R] },
    { ruta: "/agenda/reservas?desde=2026-10-05&hasta=2026-10-11", metodo: "GET" },
  ],
  [
    "cancelar como entrenador",
    (a) => a.cancelar(R.id, { motivo: "Enfermo" }),
    R,
    { ruta: `/agenda/reservas/${R.id}/cancelar`, metodo: "POST", cuerpo: { motivo: "Enfermo" } },
  ],
  [
    "devolver",
    (a) => a.devolver(R.id),
    R,
    { ruta: `/agenda/reservas/${R.id}/devolver`, metodo: "POST" },
  ],
  [
    "mover",
    (a) => a.mover(R.id, { inicio: en("2026-10-09", "12:00"), revision: 3 }),
    R,
    {
      ruta: `/agenda/reservas/${R.id}`,
      metodo: "PATCH",
      cuerpo: { inicio: "2026-10-09T12:00:00+02:00", revision: 3 },
    },
  ],
  ["horario", (a) => a.horario(), HORARIO, { ruta: "/agenda/horario-semanal", metodo: "GET" }],
  [
    "guardar horario",
    (a) => a.guardarHorario(HORARIO),
    HORARIO,
    { ruta: "/agenda/horario-semanal", metodo: "PUT", cuerpo: HORARIO },
  ],
  [
    "excepciones",
    (a) => a.excepciones("2026-10-05", "2026-12-06"),
    { excepciones: [EXCEPCION] },
    { ruta: "/agenda/excepciones?desde=2026-10-05&hasta=2026-12-06", metodo: "GET" },
  ],
  [
    "crear excepción",
    (a) =>
      a.crearExcepcion({
        tipo: "cierre",
        inicio: EXCEPCION.inicio,
        fin: EXCEPCION.fin,
        motivo: "Formación",
      }),
    EXCEPCION,
    {
      ruta: "/agenda/excepciones",
      metodo: "POST",
      cuerpo: { tipo: "cierre", inicio: EXCEPCION.inicio, fin: EXCEPCION.fin, motivo: "Formación" },
    },
  ],
  [
    "borrar excepción",
    (a) => a.borrarExcepcion(EXCEPCION.id),
    null,
    { ruta: `/agenda/excepciones/${EXCEPCION.id}`, metodo: "DELETE" },
  ],
  [
    "cambiar servicio",
    (a) => a.cambiarServicio(EP.id, { reservable: false }),
    EP,
    { ruta: `/agenda/servicios/${EP.id}`, metodo: "PATCH", cuerpo: { reservable: false } },
  ],
  [
    "productos",
    (a) => a.productos(),
    { productos: [producto()] },
    { ruta: "/planes/productos", metodo: "GET" },
  ],
  [
    "cambiar producto",
    (a) => a.cambiarProducto(uuid(8, 1), { precioCentimos: 20000 }),
    producto(),
    { ruta: `/planes/productos/${uuid(8, 1)}`, metodo: "PATCH", cuerpo: { precioCentimos: 20000 } },
  ],
  ["mi saldo", (a) => a.miSaldo(), saldo(), { ruta: "/planes/mi-saldo", metodo: "GET" }],
  [
    "mis solicitudes",
    (a) => a.misSolicitudes(),
    { solicitudes: [] },
    { ruta: "/planes/mis-solicitudes", metodo: "GET" },
  ],
  [
    "anular solicitud",
    (a) => a.anularSolicitud(uuid(9, 1)),
    solicitud({ estado: "anulada" }),
    { ruta: `/planes/mis-solicitudes/${uuid(9, 1)}/anular`, metodo: "POST" },
  ],
  [
    "solicitudes pendientes",
    (a) => a.solicitudesPendientes(),
    { solicitudes: [solicitud()] },
    { ruta: "/planes/solicitudes?estado=pendiente", metodo: "GET" },
  ],
  [
    "activar solicitud",
    (a) =>
      a.activarSolicitud(uuid(9, 1), {
        importeCentimos: 19200,
        mesInicio: "actual",
        cobrado: false,
      }),
    { ...ACTIVACION, solicitudId: uuid(9, 1) },
    {
      ruta: `/planes/solicitudes/${uuid(9, 1)}/activar`,
      metodo: "POST",
      cuerpo: { importeCentimos: 19200, mesInicio: "actual", cobrado: false },
    },
  ],
  [
    "rechazar solicitud",
    (a) => a.rechazarSolicitud(uuid(9, 1)),
    solicitud({ estado: "rechazada" }),
    { ruta: `/planes/solicitudes/${uuid(9, 1)}/rechazar`, metodo: "POST" },
  ],
  [
    "saldo de un cliente",
    (a) => a.saldoCliente(CLIENTE.id),
    { resumen: saldo(), movimientos: [] },
    { ruta: `/planes/clientes/${CLIENTE.id}/saldo`, metodo: "GET" },
  ],
  [
    "cobros",
    (a) => a.cobros({ estado: "pendiente", clienteId: CLIENTE.id, limite: 50 }),
    { cobros: [cobro()] },
    {
      ruta: `/planes/cobros?estado=pendiente&clienteId=${CLIENTE.id}&limite=50`,
      metodo: "GET",
    },
  ],
  [
    "cobrar",
    (a) => a.cobrar(uuid(10, 1)),
    cobro({ estado: "cobrado", cobradoEn: "2026-10-05T10:00:00+02:00" }),
    { ruta: `/planes/cobros/${uuid(10, 1)}/cobrar`, metodo: "POST" },
  ],
  [
    "anular cobro",
    (a) => a.anularCobro(uuid(10, 1)),
    cobro({ estado: "anulado" }),
    { ruta: `/planes/cobros/${uuid(10, 1)}/anular`, metodo: "POST" },
  ],
  [
    "resumen de cobros",
    (a) => a.resumenCobros("2026-10-01"),
    { mes: "2026-10-01", cobradoCentimos: 0, cobrados: [], pendienteCentimos: 0, pendientes: [] },
    { ruta: "/planes/cobros/resumen?mes=2026-10-01", metodo: "GET" },
  ],
]

describe("API de reservas y saldo", () => {
  it.each(CASOS)(
    "%s: ruta, método y cuerpo del contrato",
    async (_nombre, hacer, respuesta, esperada) => {
      const { api, llamada } = conRespuesta(respuesta)
      await hacer(api)
      expect(llamada()).toEqual({ cuerpo: undefined, ...esperada })
    },
  )

  it("reservar lleva operacionId y lo reutiliza al repetir la MISMA reserva tras un fallo de red", async () => {
    const { api, pedir, llamada } = conRespuesta(R)
    pedir.mockRejectedValueOnce(new ErrorDeRed("Sin conexión"))
    const datos = { servicioId: EP.id, inicio: en("2026-10-08", "10:00"), personas: 1 }
    await expect(api.reservar(datos)).rejects.toBeInstanceOf(ErrorDeRed)
    await api.reservar(datos)
    // Una vez hecha, la siguiente reserva igual es otra operación.
    await api.reservar(datos)
    const cuerpo = { servicioId: EP.id, inicio: "2026-10-08T10:00:00+02:00", personas: 1 }
    expect([llamada(0), llamada(1), llamada(2)]).toEqual([
      {
        ruta: "/agenda/mis-reservas",
        metodo: "POST",
        cuerpo: { operacionId: uuid(1, 1), ...cuerpo },
      },
      {
        ruta: "/agenda/mis-reservas",
        metodo: "POST",
        cuerpo: { operacionId: uuid(1, 1), ...cuerpo },
      },
      {
        ruta: "/agenda/mis-reservas",
        metodo: "POST",
        cuerpo: { operacionId: uuid(1, 2), ...cuerpo },
      },
    ])
  })

  it("otro contenido u otra respuesta definitiva del servidor es otra operación", async () => {
    const { api, pedir, llamada } = conRespuesta(R)
    pedir.mockRejectedValueOnce(new ErrorDeRed("Sin conexión"))
    pedir.mockRejectedValueOnce(
      new ErrorDePeticion({ statusCode: 409, codigo: "sin_saldo", message: "Sin saldo" }),
    )
    const a = { servicioId: EP.id, inicio: en("2026-10-08", "10:00"), personas: 1 }
    const b = { ...a, inicio: en("2026-10-08", "11:00") }
    await expect(api.reservar(a)).rejects.toBeInstanceOf(ErrorDeRed)
    await expect(api.reservar(b)).rejects.toBeInstanceOf(ErrorDePeticion)
    await api.reservar(b)
    await api.reservar(a)
    const ids = [0, 1, 2, 3].map((i) => (llamada(i).cuerpo as { operacionId: string }).operacionId)
    // «a» conserva su id pendiente; «b» estrena uno tras el 409.
    expect(ids).toEqual([uuid(1, 1), uuid(1, 2), uuid(1, 3), uuid(1, 1)])
  })

  it("reservar para un cliente, pedir y activar productos llevan su propio operacionId", async () => {
    const reservar = conRespuesta(R)
    await reservar.api.reservarPara(CLIENTE.id, {
      servicioId: EP.id,
      inicio: en("2026-10-08", "10:00"),
      personas: 2,
    })
    expect(reservar.llamada()).toEqual({
      ruta: `/agenda/clientes/${CLIENTE.id}/reservas`,
      metodo: "POST",
      cuerpo: {
        operacionId: uuid(1, 1),
        servicioId: EP.id,
        inicio: "2026-10-08T10:00:00+02:00",
        personas: 2,
      },
    })

    const pedirProducto = conRespuesta(solicitud())
    await pedirProducto.api.pedirProducto(uuid(8, 1))
    expect(pedirProducto.llamada()).toEqual({
      ruta: "/planes/mis-solicitudes",
      metodo: "POST",
      cuerpo: { operacionId: uuid(1, 1), productoId: uuid(8, 1) },
    })

    const activar = conRespuesta(ACTIVACION)
    await activar.api.activarProducto(CLIENTE.id, {
      productoId: uuid(8, 1),
      importeCentimos: 19200,
      mesInicio: "siguiente",
      cobrado: true,
    })
    expect(activar.llamada()).toEqual({
      ruta: `/planes/clientes/${CLIENTE.id}/activaciones`,
      metodo: "POST",
      cuerpo: {
        operacionId: uuid(1, 1),
        productoId: uuid(8, 1),
        importeCentimos: 19200,
        mesInicio: "siguiente",
        cobrado: true,
      },
    })
  })

  it("los clientes a los que se reserva excluyen las bajas", async () => {
    const usuario = (id: string, estado: "pendiente" | "activo" | "desactivado") => ({
      id,
      nombre: id,
      apellidos: null,
      email: `${id}@prueba.local`,
      rol: "cliente" as const,
      estado,
    })
    const { api, llamada } = conRespuesta({
      usuarios: [usuario("a", "activo"), usuario("b", "desactivado"), usuario("c", "pendiente")],
      total: 3,
    })
    const clientes = await api.clientes(" lara ")
    expect(clientes.map((c) => c.id)).toEqual(["a", "c"])
    expect(llamada().ruta).toBe("/usuarios?rol=cliente&buscar=lara&limite=100&desde=0")
  })

  it("una respuesta que no cumple el contrato no llega a la pantalla", async () => {
    const { api } = conRespuesta({ servicios: [{ ...EP, duracionMin: "60" }] })
    await expect(api.servicios()).rejects.toThrow()
  })
})
