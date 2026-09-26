import { fireEvent, render, screen, waitFor } from "@testing-library/react-native"
import type { Reserva, ResumenCobros } from "@alpha-omega/shared"

import { ErrorDeConflictoAgenda } from "../lib/http"
import { AgendaEntrenador } from "./agenda-entrenador"
import { crearApiReservas } from "./api"
import {
  AHORA,
  CLIENTE,
  OTRA,
  PLAN_ESENCIAL,
  cobro,
  en,
  reserva,
  solicitud,
  uuid,
} from "./pruebas/datos"
import { servidorFalso, type Respuesta } from "./pruebas/servidor"

jest.mock("expo-crypto", () => ({ randomUUID: jest.fn() }))

/** Lunes 5: Marta a las 9:00 (ya pasada) y Lara a las 12:00. */
const MARTA = reserva({
  id: uuid(7, 2),
  cliente: OTRA,
  inicio: en("2026-10-05", "09:00"),
  fuenteSaldo: "Bono EP 6",
})
const LARA = reserva({ id: uuid(7, 1), inicio: en("2026-10-05", "12:00") })
const AJUSTES = { antelacionMin: 120, horizonteDias: 28, cancelacionHoras: 24, intervaloMin: 60 }
const LUNES = { diaSemana: 1, inicioMin: 9 * 60, finMin: 14 * 60 }

function montar(cambios: Record<string, Respuesta> = {}) {
  const servidor = servidorFalso({
    "GET /agenda/reservas": { reservas: [LARA, MARTA] },
    "GET /planes/solicitudes": { solicitudes: [] },
    "GET /agenda/horario-semanal": { franjas: [LUNES] },
    "GET /agenda/excepciones": { excepciones: [] },
    "GET /agenda/ajustes": AJUSTES,
    ...cambios,
  })
  let n = 0
  const api = crearApiReservas(servidor.pedir, () => uuid(1, ++n))
  return { servidor, api }
}

async function abrir(seccion: string): Promise<void> {
  await fireEvent.press(await screen.findByRole("tab", { name: new RegExp(`^${seccion}`) }))
}

describe("Agenda del entrenador", () => {
  it("lista las reservas del día en orden y cancela con motivo", async () => {
    let reservas: Reserva[] = [LARA, MARTA]
    const { servidor, api } = montar({
      "GET /agenda/reservas": () => ({ reservas }),
      [`POST /agenda/reservas/${LARA.id}/cancelar`]: () => {
        const cancelada: Reserva = {
          ...LARA,
          estado: "cancelada",
          cancelacion: {
            en: "2026-10-05T10:01:00+02:00",
            porEntrenador: true,
            motivo: "Me ha surgido algo",
            sesionDevuelta: true,
          },
        }
        reservas = [cancelada, MARTA]
        return cancelada
      },
    })
    await render(<AgendaEntrenador api={api} ahora={() => AHORA} />)

    expect(screen.getByRole("tab", { name: "Agenda", selected: true })).toBeOnTheScreen()
    expect(screen.getByRole("tab", { name: "Horario", selected: false })).toBeOnTheScreen()
    expect(await screen.findByText("Semana del 5 oct al 11 oct")).toBeOnTheScreen()
    expect(servidor.a("GET /agenda/reservas")[0]?.ruta).toBe(
      "/agenda/reservas?desde=2026-10-05&hasta=2026-10-11",
    )
    expect(
      screen.getByRole("radio", { name: "lunes 5 de octubre, 2 reservas", checked: true }),
    ).toBeOnTheScreen()
    // En orden de hora, con cliente, servicio, personas y de dónde sale la sesión.
    const horas = screen.getAllByText(/^\d\d:\d\d – \d\d:\d\d$/).map((t) => t.props.children)
    expect(horas).toEqual(["09:00 – 10:00", "12:00 – 13:00"])
    expect(screen.getByText("EP individual · 1 persona · Plan de octubre")).toBeOnTheScreen()
    expect(screen.getByText("Pasada")).toBeOnTheScreen()
    expect(screen.getByText("Confirmada")).toBeOnTheScreen()
    // La pasada no se cancela ni se mueve.
    expect(screen.queryByRole("button", { name: /^Cancelar la reserva de Marta/ })).toBeNull()

    await fireEvent.press(
      screen.getByRole("button", {
        name: "Cancelar la reserva de Lara García del lunes 5 de octubre a las 12:00",
      }),
    )
    expect(await screen.findByText("¿Cancelar la reserva de Lara García?")).toBeOnTheScreen()
    await fireEvent.changeText(screen.getByLabelText("Motivo (opcional)"), "Me ha surgido algo")
    await fireEvent.press(screen.getByRole("button", { name: "Cancelar reserva" }))

    expect(await screen.findByText("Reserva de Lara García cancelada.")).toBeOnTheScreen()
    expect(servidor.a(`POST /agenda/reservas/${LARA.id}/cancelar`)[0]?.cuerpo).toEqual({
      motivo: "Me ha surgido algo",
    })
    expect(await screen.findByText("Cancelada por ti · sesión devuelta")).toBeOnTheScreen()
    expect(screen.getByText("Motivo: Me ha surgido algo")).toBeOnTheScreen()
  })

  it("devuelve a mano la sesión de una reserva pasada, una sola vez", async () => {
    let reservas: Reserva[] = [LARA, MARTA]
    const { servidor, api } = montar({
      "GET /agenda/reservas": () => ({ reservas }),
      [`POST /agenda/reservas/${MARTA.id}/devolver`]: () => {
        const devuelta = { ...MARTA, devueltaAMano: true }
        reservas = [LARA, devuelta]
        return devuelta
      },
    })
    await render(<AgendaEntrenador api={api} ahora={() => AHORA} />)
    // La de Lara todavía no ha pasado: no se puede devolver.
    expect(
      await screen.findByRole("button", {
        name: "Devolver la sesión de la reserva de Marta del lunes 5 de octubre a las 09:00",
      }),
    ).toBeOnTheScreen()
    expect(
      screen.queryByRole("button", { name: /^Devolver la sesión de la reserva de Lara/ }),
    ).toBeNull()

    await fireEvent.press(
      screen.getByRole("button", {
        name: "Devolver la sesión de la reserva de Marta del lunes 5 de octubre a las 09:00",
      }),
    )
    expect(await screen.findByText("¿Devolver la sesión a Marta?")).toBeOnTheScreen()
    await fireEvent.press(screen.getByRole("button", { name: "Devolver sesión" }))

    expect(await screen.findByText("Sesión devuelta a Marta.")).toBeOnTheScreen()
    expect(servidor.a(`POST /agenda/reservas/${MARTA.id}/devolver`)[0]?.cuerpo).toBeUndefined()
    expect(await screen.findByText("Pasada · sesión devuelta a mano")).toBeOnTheScreen()
    expect(screen.queryByRole("button", { name: /^Devolver la sesión/ })).toBeNull()
  })

  it("mueve una reserva a un hueco libre con su revisión", async () => {
    const { servidor, api } = montar({
      "GET /agenda/disponibilidad": {
        servicioId: LARA.servicio.id,
        zona: "Europe/Madrid",
        dias: [
          { fecha: "2026-10-05", huecos: [] },
          {
            fecha: "2026-10-06",
            huecos: [{ inicio: en("2026-10-06", "16:00"), fin: en("2026-10-06", "17:00") }],
          },
        ],
      },
      [`PATCH /agenda/reservas/${LARA.id}`]: {
        ...LARA,
        inicio: en("2026-10-06", "16:00"),
        revision: 1,
      },
    })
    await render(<AgendaEntrenador api={api} ahora={() => AHORA} />)
    await fireEvent.press(
      await screen.findByRole("button", {
        name: "Mover la reserva de Lara García del lunes 5 de octubre a las 12:00",
      }),
    )
    await fireEvent.press(await screen.findByRole("radio", { name: "A las 16:00" }))
    await fireEvent.press(
      screen.getByRole("button", { name: "Mover al martes 6 de octubre a las 16:00" }),
    )
    expect(
      await screen.findByText("Reserva de Lara García movida al martes 6 de octubre a las 16:00."),
    ).toBeOnTheScreen()
    expect(servidor.a(`PATCH /agenda/reservas/${LARA.id}`)[0]?.cuerpo).toEqual({
      inicio: "2026-10-06T16:00:00+02:00",
      revision: 0,
    })
  })

  it("el 409 del horario enseña las reservas afectadas y no da el cambio por guardado", async () => {
    const { servidor, api } = montar({
      "PUT /agenda/horario-semanal": () => {
        throw new ErrorDeConflictoAgenda({
          statusCode: 409,
          codigo: "reservas_afectadas",
          message: "Hay reservas fuera del horario",
          conflictos: [LARA],
        })
      },
    })
    await render(<AgendaEntrenador api={api} ahora={() => AHORA} />)
    await abrir("Horario")
    await fireEvent.press(
      await screen.findByRole("button", { name: "Quitar la franja del lunes de 09:00 a 14:00" }),
    )
    await fireEvent.press(screen.getByRole("button", { name: "Guardar horario" }))

    expect(
      await screen.findByText(
        "No se ha guardado el horario: estas reservas quedarían fuera de tu horario. Muévelas o cancélalas desde la Agenda y vuelve a guardar.",
      ),
    ).toBeOnTheScreen()
    expect(screen.getByText("Lunes 5 de octubre, 12:00 – 13:00")).toBeOnTheScreen()
    expect(screen.getByText("Lara García · EP individual")).toBeOnTheScreen()
    expect(screen.queryByText("Horario guardado.")).toBeNull()
    // El cambio sigue pendiente de guardar.
    expect(
      screen.getByRole("button", { name: "Guardar horario", disabled: false }),
    ).toBeOnTheScreen()
    expect(screen.getByRole("button", { name: "Descartar cambios" })).toBeOnTheScreen()
    expect(servidor.a("PUT /agenda/horario-semanal")[0]?.cuerpo).toEqual({ franjas: [] })
  })

  it("edita una franja y guarda el horario con el cuerpo exacto", async () => {
    const { servidor, api } = montar({
      "PUT /agenda/horario-semanal": ({ cuerpo }: { cuerpo: unknown }) => cuerpo,
    })
    await render(<AgendaEntrenador api={api} ahora={() => AHORA} />)
    await abrir("Horario")
    expect(
      await screen.findByRole("button", { name: "Guardar horario", disabled: true }),
    ).toBeOnTheScreen()
    await fireEvent.press(
      screen.getByRole("button", { name: "Editar la franja del lunes de 09:00 a 14:00" }),
    )
    await fireEvent.press(screen.getByRole("button", { name: "Más fin" }))
    await fireEvent.press(screen.getByRole("button", { name: "Añadir franja el martes" }))
    await fireEvent.press(screen.getByRole("button", { name: "Guardar horario" }))

    expect(await screen.findByText("Horario guardado.")).toBeOnTheScreen()
    expect(servidor.a("PUT /agenda/horario-semanal")[0]?.cuerpo).toEqual({
      franjas: [
        { diaSemana: 1, inicioMin: 540, finMin: 870 },
        { diaSemana: 2, inicioMin: 540, finMin: 840 },
      ],
    })
  })

  it("activa una solicitud con el importe, el mes de inicio y el cobro elegidos", async () => {
    const pedida = solicitud({
      producto: { id: PLAN_ESENCIAL.id, nombre: "Presencial Esencial", tipo: "plan" },
      precioCentimos: 10000,
    })
    const { servidor, api } = montar({
      "GET /planes/solicitudes": { solicitudes: [pedida] },
      [`POST /planes/solicitudes/${pedida.id}/activar`]: {
        solicitudId: pedida.id,
        saldo: {
          clienteId: CLIENTE.id,
          fecha: "2026-10-05",
          ep: { mesActual: null, mesSiguiente: null, bonos: [], disponibles: 0 },
          suscripciones: [],
        },
        cobro: cobro({
          concepto: "Presencial Esencial",
          importeCentimos: 9000,
          origenTipo: "producto",
        }),
      },
    })
    await render(<AgendaEntrenador api={api} ahora={() => AHORA} />)
    expect(await screen.findByRole("tab", { name: "Solicitudes, 1 pendientes" })).toBeOnTheScreen()
    await abrir("Solicitudes")
    await fireEvent.press(
      await screen.findByRole("button", { name: "Activar Presencial Esencial para Lara García" }),
    )
    expect(screen.getByDisplayValue("100")).toBeOnTheScreen()
    await fireEvent.changeText(screen.getByLabelText("Importe (€)"), "90")
    await fireEvent.press(screen.getByRole("radio", { name: "El siguiente" }))
    await fireEvent.press(screen.getByRole("radio", { name: "Pendiente" }))
    await fireEvent.press(screen.getByRole("button", { name: "Activar" }))

    expect(
      await screen.findByText(
        "Activado: Presencial Esencial para Lara García. Cobro de 90 € pendiente.",
      ),
    ).toBeOnTheScreen()
    expect(servidor.a(`POST /planes/solicitudes/${pedida.id}/activar`)[0]?.cuerpo).toEqual({
      importeCentimos: 9000,
      mesInicio: "siguiente",
      cobrado: false,
    })
    expect(screen.queryByRole("button", { name: /^Activar Presencial/ })).toBeNull()
  })

  it("marca un cobro como cobrado y lo pasa a los cobrados del mes", async () => {
    const debe = cobro()
    let resumen: ResumenCobros = {
      mes: "2026-10-01",
      cobradoCentimos: 0,
      cobrados: [],
      pendienteCentimos: 5000,
      pendientes: [debe],
    }
    const { servidor, api } = montar({
      "GET /planes/cobros/resumen": () => resumen,
      [`POST /planes/cobros/${debe.id}/cobrar`]: () => {
        const cobrado = {
          ...debe,
          estado: "cobrado" as const,
          cobradoEn: "2026-10-05T10:02:00+02:00",
        }
        resumen = {
          ...resumen,
          cobradoCentimos: 5000,
          cobrados: [cobrado],
          pendienteCentimos: 0,
          pendientes: [],
        }
        return cobrado
      },
    })
    await render(<AgendaEntrenador api={api} ahora={() => AHORA} />)
    await abrir("Cobros")
    expect(await screen.findByText("octubre de 2026")).toBeOnTheScreen()
    expect(servidor.a("GET /planes/cobros/resumen")[0]?.ruta).toBe(
      "/planes/cobros/resumen?mes=2026-10-01",
    )
    expect(screen.getByText("Nada cobrado este mes.")).toBeOnTheScreen()

    await fireEvent.press(
      screen.getByRole("button", { name: "Marcar cobrados 50 € de Lara García" }),
    )
    expect(await screen.findByText("Cobrados 50 € de Lara García.")).toBeOnTheScreen()
    await waitFor(() => expect(screen.getByText("Nadie te debe nada.")).toBeOnTheScreen())
    expect(screen.getByText("EP en pareja · 2 personas · el lunes 5 de octubre")).toBeOnTheScreen()
    expect(servidor.a(`POST /planes/cobros/${debe.id}/cobrar`)).toHaveLength(1)
  })
})
