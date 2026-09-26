import { fireEvent, render, screen } from "@testing-library/react-native"

import { crearApiReservas } from "./api"
import {
  AHORA,
  CLIENTE,
  OTRA,
  PLAN_ESENCIAL,
  cobro,
  en,
  producto,
  reserva,
  saldo,
  uuid,
} from "./pruebas/datos"
import { servidorFalso } from "./pruebas/servidor"
import { SaldoDelCliente } from "./saldo-cliente"

jest.mock("expo-crypto", () => ({ randomUUID: jest.fn() }))

describe("Saldo en la ficha del cliente", () => {
  it("enseña su saldo y sus reservas, y le activa un producto al cobrar", async () => {
    const suya = reserva({ inicio: en("2026-10-08", "10:00") })
    const ajena = reserva({ id: uuid(7, 5), cliente: OTRA, inicio: en("2026-10-08", "12:00") })
    const servidor = servidorFalso({
      [`GET /planes/clientes/${CLIENTE.id}/saldo`]: {
        resumen: saldo({
          bonos: [
            {
              id: uuid(12, 1),
              nombre: "Bono EP 6",
              clase: "ep",
              sesiones: 6,
              quedan: 4,
              primerUsoEn: "2026-09-01",
              caducaEn: "2027-09-01",
              compensacion: false,
            },
          ],
          disponibles: 6,
        }),
        movimientos: [],
      },
      "GET /agenda/reservas": { reservas: [suya, ajena] },
      "GET /planes/productos": { productos: [producto(), PLAN_ESENCIAL] },
      [`POST /planes/clientes/${CLIENTE.id}/activaciones`]: {
        solicitudId: null,
        saldo: saldo({ disponibles: 12 }),
        cobro: cobro({ concepto: "Bono EP 6", importeCentimos: 19200, estado: "cobrado" }),
      },
    })
    let n = 0
    const api = crearApiReservas(servidor.pedir, () => uuid(1, ++n))
    await render(<SaldoDelCliente clienteId={CLIENTE.id} api={api} ahora={() => AHORA} />)

    expect(await screen.findByLabelText("Le quedan 6 sesiones")).toBeOnTheScreen()
    expect(
      screen.getByText("Bono EP 6: quedan 4 de 6 · caduca el 1 de septiembre de 2027"),
    ).toBeOnTheScreen()
    expect(screen.getByText("Jueves 8 de octubre, 10:00 – 11:00")).toBeOnTheScreen()
    expect(screen.queryByText("Jueves 8 de octubre, 12:00 – 13:00")).toBeNull()

    await fireEvent.press(screen.getByRole("button", { name: "Activar producto" }))
    await fireEvent.press(await screen.findByRole("radio", { name: "Bono EP 6, Bono · 192 €" }))
    expect(screen.getByDisplayValue("192")).toBeOnTheScreen()
    // Un bono no pregunta por el mes de inicio.
    expect(screen.queryByRole("radio", { name: "El siguiente" })).toBeNull()
    await fireEvent.press(screen.getByRole("button", { name: "Activar" }))

    expect(
      await screen.findByText("Activado: Bono EP 6. Cobro de 192 € registrado."),
    ).toBeOnTheScreen()
    expect(servidor.a(`POST /planes/clientes/${CLIENTE.id}/activaciones`)[0]?.cuerpo).toEqual({
      operacionId: uuid(1, 1),
      productoId: uuid(8, 1),
      importeCentimos: 19200,
      mesInicio: "actual",
      cobrado: true,
    })
  })
})
