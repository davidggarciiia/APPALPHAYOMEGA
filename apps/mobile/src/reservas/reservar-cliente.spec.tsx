import { fireEvent, render, screen, waitFor } from "@testing-library/react-native"
import type { MisReservas, SolicitudProducto } from "@alpha-omega/shared"

import { ErrorDePeticion, ErrorDeRed } from "../lib/http"
import { crearApiReservas } from "./api"
import {
  AHORA,
  EP,
  GRUPO,
  PLAN_ESENCIAL,
  SIN_SALDO,
  disponibilidad,
  en,
  producto,
  reserva,
  saldo,
  solicitud,
  uuid,
} from "./pruebas/datos"
import { servidorFalso, type Respuesta } from "./pruebas/servidor"
import { ReservarCliente } from "./reservar-cliente"

jest.mock("expo-crypto", () => ({ randomUUID: jest.fn() }))

const HUECOS = { "2026-10-06": ["10:00", "11:00", "17:00"], "2026-10-08": ["09:00"] }
const SIN_RESERVAS: MisReservas = { proximas: [], pasadas: [] }

/** El servidor de un cliente con saldo, dos servicios y un bono a la venta. */
function montar(cambios: Record<string, Respuesta> = {}) {
  const servidor = servidorFalso({
    "GET /planes/mi-saldo": saldo(),
    "GET /agenda/servicios": { servicios: [EP, GRUPO] },
    "GET /agenda/mis-reservas": SIN_RESERVAS,
    "GET /planes/productos": { productos: [producto(), PLAN_ESENCIAL] },
    "GET /planes/mis-solicitudes": { solicitudes: [] },
    "GET /agenda/disponibilidad": ({ ruta }: { ruta: string }) =>
      disponibilidad(ruta.includes(GRUPO.id) ? GRUPO.id : EP.id, HUECOS),
    ...cambios,
  })
  let n = 0
  const api = crearApiReservas(servidor.pedir, () => uuid(1, ++n))
  return { servidor, api }
}

async function elegirHueco(hora: string): Promise<void> {
  await fireEvent.press(await screen.findByRole("radio", { name: `A las ${hora}` }))
  expect(await screen.findByText("Confirma tu reserva")).toBeOnTheScreen()
}

describe("Reservar, cliente", () => {
  it("reserva el hueco con el cuerpo exacto y reintenta con el mismo operacionId sin perder la selección", async () => {
    let intentos = 0
    const { servidor, api } = montar({
      "POST /agenda/mis-reservas": () => {
        intentos++
        if (intentos === 1) throw new ErrorDeRed("Network request failed")
        return reserva({ inicio: en("2026-10-06", "10:00") })
      },
    })
    await render(<ReservarCliente api={api} ahora={() => AHORA} />)

    expect(await screen.findByLabelText("Te quedan 2 sesiones")).toBeOnTheScreen()
    expect(screen.getByText("Plan de octubre: quedan 2 de 2")).toBeOnTheScreen()
    // Catorce días desde hoy, en la hora de Madrid.
    expect(servidor.a("GET /agenda/disponibilidad")[0]?.ruta).toBe(
      `/agenda/disponibilidad?servicioId=${EP.id}&desde=2026-10-05&dias=14`,
    )
    expect(
      screen.getByRole("radio", { name: "lunes 5 de octubre, sin huecos libres" }),
    ).toBeOnTheScreen()
    expect(
      screen.getByRole("radio", { name: "martes 6 de octubre, 3 huecos libres", checked: true }),
    ).toBeOnTheScreen()
    expect(screen.getByText("Mañana")).toBeOnTheScreen()
    expect(screen.getByText("Tarde")).toBeOnTheScreen()

    await elegirHueco("10:00")
    expect(screen.getByText("De 10:00 a 11:00")).toBeOnTheScreen()
    expect(screen.getByText("Se descuenta 1 sesión de tu plan de octubre.")).toBeOnTheScreen()

    await fireEvent.press(screen.getByRole("button", { name: "Reservar" }))
    expect(
      await screen.findByText("No hemos podido conectar. Revisa tu conexión."),
    ).toBeOnTheScreen()
    // La hoja sigue abierta con la misma hora.
    expect(screen.getByText("De 10:00 a 11:00")).toBeOnTheScreen()

    await fireEvent.press(screen.getByRole("button", { name: "Reintentar la reserva" }))
    expect(await screen.findByText("¡Reservado!")).toBeOnTheScreen()

    const cuerpos = servidor.a("POST /agenda/mis-reservas").map((l) => l.cuerpo)
    expect(cuerpos).toEqual([
      {
        operacionId: uuid(1, 1),
        servicioId: EP.id,
        inicio: "2026-10-06T10:00:00+02:00",
        personas: 1,
      },
      {
        operacionId: uuid(1, 1),
        servicioId: EP.id,
        inicio: "2026-10-06T10:00:00+02:00",
        personas: 1,
      },
    ])
    // Tras reservar se vuelven a pedir los huecos y el saldo.
    await waitFor(() => expect(servidor.a("GET /agenda/disponibilidad")).toHaveLength(2))
    await waitFor(() => expect(servidor.a("GET /planes/mi-saldo")).toHaveLength(2))
  })

  it("en grupo pide las personas y dice cuánto se paga en el centro", async () => {
    const { servidor, api } = montar({
      "POST /agenda/mis-reservas": reserva({
        servicio: { id: GRUPO.id, codigo: GRUPO.codigo, nombre: GRUPO.nombre, duracionMin: 60 },
        inicio: en("2026-10-06", "17:00"),
        personas: 3,
        fuenteSaldo: null,
        cobroCentimos: 6000,
      }),
    })
    await render(<ReservarCliente api={api} ahora={() => AHORA} />)
    await fireEvent.press(await screen.findByRole("radio", { name: /^EP en pareja o grupo/ }))
    expect(await screen.findByText("2 × 25 € = 50 €, se paga en el centro")).toBeOnTheScreen()
    await fireEvent.press(screen.getByRole("button", { name: "Más personas" }))
    expect(screen.getByText("3 × 20 € = 60 €, se paga en el centro")).toBeOnTheScreen()

    await elegirHueco("17:00")
    expect(screen.getAllByText("3 × 20 € = 60 €, se paga en el centro").length).toBeGreaterThan(0)
    await fireEvent.press(screen.getByRole("button", { name: "Reservar" }))
    expect(await screen.findByText("¡Reservado!")).toBeOnTheScreen()
    expect(servidor.a("POST /agenda/mis-reservas")[0]?.cuerpo).toEqual({
      operacionId: uuid(1, 1),
      servicioId: GRUPO.id,
      inicio: "2026-10-06T17:00:00+02:00",
      personas: 3,
    })
  })

  it("sin_saldo al reservar lleva a «Consigue más sesiones» y abre los productos", async () => {
    const { api } = montar({
      "POST /agenda/mis-reservas": () => {
        throw new ErrorDePeticion({
          statusCode: 409,
          codigo: "sin_saldo",
          message: "No te quedan sesiones",
        })
      },
    })
    await render(<ReservarCliente api={api} ahora={() => AHORA} />)
    await elegirHueco("11:00")
    // Con saldo, los productos empiezan plegados.
    expect(screen.queryByRole("button", { name: /^Lo quiero/ })).toBeNull()

    await fireEvent.press(screen.getByRole("button", { name: "Reservar" }))
    expect(
      await screen.findByText(
        "No te quedan sesiones para esa fecha. Pide un plan o un bono aquí abajo.",
      ),
    ).toBeOnTheScreen()
    expect(screen.getByRole("button", { name: "Lo quiero: Bono EP 6, 192 €" })).toBeOnTheScreen()
    expect(
      screen.getByRole("button", { name: "Ocultar planes y bonos", expanded: true }),
    ).toBeOnTheScreen()
    expect(screen.queryByText("Confirma tu reserva")).toBeNull()
  })

  it("hueco_no_disponible recarga los huecos y lo explica", async () => {
    let lecturas = 0
    const { servidor, api } = montar({
      "GET /agenda/disponibilidad": () => {
        lecturas++
        return disponibilidad(
          EP.id,
          lecturas === 1 ? HUECOS : { "2026-10-06": ["11:00", "17:00"], "2026-10-08": ["09:00"] },
        )
      },
      "POST /agenda/mis-reservas": () => {
        throw new ErrorDePeticion({
          statusCode: 409,
          codigo: "hueco_no_disponible",
          message: "Ese hueco ya no está libre",
        })
      },
    })
    await render(<ReservarCliente api={api} ahora={() => AHORA} />)
    await elegirHueco("10:00")
    await fireEvent.press(screen.getByRole("button", { name: "Reservar" }))

    expect(
      await screen.findByText(
        "Ese hueco acaba de ocuparse o ya no se puede reservar. Te enseñamos los que quedan libres.",
      ),
    ).toBeOnTheScreen()
    await waitFor(() => expect(servidor.a("GET /agenda/disponibilidad")).toHaveLength(2))
    await waitFor(() => expect(screen.queryByRole("radio", { name: "A las 10:00" })).toBeNull())
    // El día elegido se conserva.
    expect(
      screen.getByRole("radio", { name: "martes 6 de octubre, 2 huecos libres", checked: true }),
    ).toBeOnTheScreen()
  })

  it("avisa de que la sesión no se devuelve antes de cancelar fuera de plazo", async () => {
    const tarde = reserva({
      inicio: en("2026-10-05", "18:00"),
      cancelarSinPerderHasta: en("2026-10-04", "18:00"),
    })
    const { servidor, api } = montar({
      "GET /agenda/mis-reservas": { proximas: [tarde], pasadas: [] },
      [`POST /agenda/mis-reservas/${tarde.id}/cancelar`]: {
        ...tarde,
        estado: "cancelada",
        cancelacion: {
          en: "2026-10-05T10:00:00+02:00",
          porEntrenador: false,
          motivo: null,
          sesionDevuelta: false,
        },
      },
    })
    await render(<ReservarCliente api={api} ahora={() => AHORA} />)
    expect(
      await screen.findByText("Ha pasado el plazo: si cancelas, la sesión no se devuelve."),
    ).toBeOnTheScreen()

    await fireEvent.press(
      screen.getByRole("button", {
        name: "Cancelar la reserva del lunes 5 de octubre a las 18:00",
      }),
    )
    expect(
      await screen.findByText(
        "Ya pasó el plazo para cancelar sin perder la sesión (terminó el domingo 4 de octubre a las 18:00). Si cancelas, el hueco se libera pero la sesión no se devuelve.",
      ),
    ).toBeOnTheScreen()
    // Todavía no se ha cancelado nada.
    expect(servidor.a(`POST /agenda/mis-reservas/${tarde.id}/cancelar`)).toHaveLength(0)

    await fireEvent.press(screen.getByRole("button", { name: "Cancelar reserva" }))
    expect(
      await screen.findByText(
        "Reserva cancelada. La sesión no se devuelve porque ya había pasado el plazo.",
      ),
    ).toBeOnTheScreen()
    expect(servidor.a(`POST /agenda/mis-reservas/${tarde.id}/cancelar`)[0]?.cuerpo).toEqual({})
  })

  it("dentro de plazo dice que recupera la sesión", async () => {
    const aTiempo = reserva()
    const { api } = montar({ "GET /agenda/mis-reservas": { proximas: [aTiempo], pasadas: [] } })
    await render(<ReservarCliente api={api} ahora={() => AHORA} />)
    await fireEvent.press(
      await screen.findByRole("button", {
        name: "Cancelar la reserva del jueves 8 de octubre a las 10:00",
      }),
    )
    expect(await screen.findByText("Estás a tiempo: recuperas la sesión.")).toBeOnTheScreen()
    expect(screen.queryByText(/Ya pasó el plazo/)).toBeNull()
  })

  it("«Lo quiero» crea una solicitud y se puede anular", async () => {
    let solicitudes: SolicitudProducto[] = []
    const { servidor, api } = montar({
      "GET /planes/mi-saldo": SIN_SALDO,
      "GET /planes/mis-solicitudes": () => ({ solicitudes }),
      "POST /planes/mis-solicitudes": () => {
        solicitudes = [solicitud()]
        return solicitudes[0]
      },
      [`POST /planes/mis-solicitudes/${uuid(9, 1)}/anular`]: () => {
        const anulada = solicitud({ estado: "anulada", resueltaEn: "2026-10-05T10:05:00+02:00" })
        solicitudes = []
        return anulada
      },
    })
    await render(<ReservarCliente api={api} ahora={() => AHORA} />)
    // Sin saldo, los productos ya están abiertos.
    expect(await screen.findByText(/Tu entrenador lo activará cuando le pagues/)).toBeOnTheScreen()
    expect(screen.getByText("Vale un año desde la primera sesión")).toBeOnTheScreen()

    await fireEvent.press(screen.getByRole("button", { name: "Lo quiero: Bono EP 6, 192 €" }))
    expect(await screen.findByText("Pedido: Bono EP 6")).toBeOnTheScreen()
    expect(servidor.a("POST /planes/mis-solicitudes")[0]?.cuerpo).toEqual({
      operacionId: uuid(1, 1),
      productoId: uuid(8, 1),
    })
    expect(
      screen.getByRole("button", { name: "Bono EP 6, ya pedido", disabled: true }),
    ).toBeOnTheScreen()

    await fireEvent.press(screen.getByRole("button", { name: "Anular la petición de Bono EP 6" }))
    expect(await screen.findByText("Has anulado la petición de Bono EP 6.")).toBeOnTheScreen()
    expect(screen.queryByText("Pedido: Bono EP 6")).toBeNull()
    expect(screen.getByRole("button", { name: "Lo quiero: Bono EP 6, 192 €" })).toBeOnTheScreen()
  })
})
