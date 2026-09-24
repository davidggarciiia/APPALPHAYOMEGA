import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals"
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react-native"
import { Platform, StyleSheet } from "react-native"
import { MedioFotoSchema, type AccesoMedio, type MedioFoto } from "@alpha-omega/shared"

import { ComparadorFotos } from "./comparador-fotos"
import type { ApiMedios } from "./medios-api"

// Datos sintéticos: ninguna foto, nombre ni enlace pertenece a una persona real.
const CLIENTE = "10000000-0000-4000-8000-000000000000"
const ENTRENADORA = { id: "70000000-0000-4000-8000-000000000001", nombre: "Entrenadora Demo" }
const CLIENTA = { id: "70000000-0000-4000-8000-000000000002", nombre: "Clienta Demo" }
const FUTURO = "2099-01-01T00:00:00.000Z"
const PASADO = "2000-01-01T00:00:00.000Z"
const id = (n: number): string => `30000000-0000-4000-8000-${String(n).padStart(12, "0")}`

function foto(n: number, datos: Partial<MedioFoto>): MedioFoto {
  return MedioFotoSchema.parse({
    id: id(n),
    clienteId: CLIENTE,
    autor: ENTRENADORA,
    origen: "profesional",
    vista: "frente",
    etiqueta: null,
    fechaToma: "2026-09-24",
    estado: "disponible",
    tipoMime: "image/jpeg",
    bytes: 120_000,
    valoracionId: null,
    solicitudId: null,
    creadoEn: "2026-09-24T09:00:00.000Z",
    confirmadoEn: "2026-09-24T09:01:00.000Z",
    ...datos,
  })
}

const frenteEnero = foto(1, { fechaToma: "2026-01-10", creadoEn: "2026-01-10T09:00:00.000Z" })
const frenteMayo = foto(2, { fechaToma: "2026-05-10", creadoEn: "2026-05-10T09:00:00.000Z" })
const frenteSeptiembre = foto(3, { fechaToma: "2026-09-24" })
const espaldaSeptiembre = foto(4, { vista: "espalda" })

type Api = Pick<ApiMedios, "acceso" | "borrar">

/** Cada petición de acceso devuelve un enlace distinto, como el servidor. */
function apiFalsa(): {
  acceso: jest.Mock<ApiMedios["acceso"]>
  borrar: jest.Mock<ApiMedios["borrar"]>
} {
  let firma = 0
  return {
    acceso: jest.fn(async (medioId: string): Promise<AccesoMedio> => {
      firma += 1
      return lectura(medioId, firma, FUTURO)
    }),
    borrar: jest.fn<ApiMedios["borrar"]>(),
  }
}
const lectura = (medioId: string, firma: number, caducaEn: string): AccesoMedio => ({
  medioId,
  lectura: {
    url: `https://almacen.test/lectura/${medioId}?firma=${firma}`,
    metodo: "GET",
    cabeceras: { "x-firma-prueba": String(firma) },
    caducaEn,
  },
})
const pedidasPara = (api: Api, medio: MedioFoto): number =>
  (api.acceso as jest.Mock<ApiMedios["acceso"]>).mock.calls.filter(([m]) => m === medio.id).length
const fuente = (
  imagen: ReturnType<typeof screen.getByLabelText>,
): { uri: string; headers: Record<string, string>; cache: string } =>
  imagen.props.source as { uri: string; headers: Record<string, string>; cache: string }

const nadie = (): boolean => false

describe("comparar dos fechas de la misma vista", () => {
  it("por defecto muestra la foto más antigua y la más reciente de la vista, con enlaces temporales", async () => {
    const api = apiFalsa()
    await render(
      <ComparadorFotos
        fotos={[frenteSeptiembre, espaldaSeptiembre, frenteEnero, frenteMayo]}
        api={api}
        puedeBorrar={nadie}
      />,
    )

    const antigua = await screen.findByLabelText("Frente, 10 ene 2026")
    const reciente = await screen.findByLabelText("Frente, 24 sep 2026")
    // En iOS `reload` salta la caché del cargador y el `no-store` del servidor
    // evita el disco. Android va aparte: ver «sin caché corporal persistente».
    expect(fuente(antigua)).toEqual({
      uri: `https://almacen.test/lectura/${frenteEnero.id}?firma=1`,
      headers: { "x-firma-prueba": "1" },
      cache: "reload",
    })
    expect(fuente(reciente).uri).toContain(frenteSeptiembre.id)
    expect(screen.queryByLabelText("Frente, 10 may 2026")).toBeNull()
    expect(screen.queryByLabelText("Espalda, 24 sep 2026")).toBeNull()
    expect(pedidasPara(api, frenteMayo)).toBe(0)
    expect(pedidasPara(api, espaldaSeptiembre)).toBe(0)
    expect(screen.getByRole("radio", { name: "Frente" }).props.accessibilityState).toMatchObject({
      checked: true,
    })

    // Otra fecha de la misma vista en la segunda foto.
    const segunda = screen.getByLabelText("Fecha de la segunda foto")
    await fireEvent.press(within(segunda).getByRole("radio", { name: "10 may 2026" }))
    expect(await screen.findByLabelText("Frente, 10 may 2026")).toBeTruthy()
    expect(screen.queryByLabelText("Frente, 24 sep 2026")).toBeNull()
    expect(screen.getByLabelText("Frente, 10 ene 2026")).toBeTruthy()

    // La fecha que ya ocupa la otra foto no se puede elegir dos veces.
    const primera = screen.getByLabelText("Fecha de la primera foto")
    expect(
      within(primera).getByRole("radio", { name: "10 may 2026" }).props.accessibilityState,
    ).toMatchObject({ disabled: true })
  })

  it("una vista con una sola foto se explica y no se completa con otra vista ni otra fecha", async () => {
    const api = apiFalsa()
    await render(
      <ComparadorFotos
        fotos={[frenteEnero, frenteSeptiembre, espaldaSeptiembre]}
        api={api}
        puedeBorrar={nadie}
      />,
    )
    await screen.findByLabelText("Frente, 24 sep 2026")

    await fireEvent.press(screen.getByRole("radio", { name: "Espalda" }))

    expect(await screen.findByLabelText("Espalda, 24 sep 2026")).toBeTruthy()
    expect(
      screen.getByText(
        "Solo hay una foto de espalda (24 sep 2026). Para comparar hace falta otra de la misma vista con otra fecha.",
      ),
    ).toBeTruthy()
    expect(screen.queryByLabelText(/^Frente, /)).toBeNull()
    expect(screen.queryByLabelText("Fecha de la segunda foto")).toBeNull()
  })

  it("solo ofrece las vistas con fotos; las pendientes no cuentan y «otra» se agrupa por etiqueta", async () => {
    const api = apiFalsa()
    const pendiente = foto(5, { vista: "perfilDerecho", estado: "pendiente", confirmadoEn: null })
    const frentePendiente = foto(6, {
      fechaToma: "2026-07-01",
      estado: "pendiente",
      confirmadoEn: null,
    })
    const brazo = foto(7, { vista: "otra", etiqueta: "Brazo contraído" })
    const brazoAntes = foto(8, {
      vista: "otra",
      etiqueta: "Brazo contraído",
      fechaToma: "2026-03-01",
    })
    const pierna = foto(9, { vista: "otra", etiqueta: "Pierna" })
    await render(
      <ComparadorFotos
        fotos={[
          frenteEnero,
          frenteSeptiembre,
          frentePendiente,
          pendiente,
          brazo,
          brazoAntes,
          pierna,
        ]}
        api={api}
        puedeBorrar={nadie}
      />,
    )
    await screen.findByLabelText("Frente, 24 sep 2026")

    const vistas = screen.getByLabelText("Vista")
    expect(
      within(vistas)
        .getAllByRole("radio")
        .map((r) => r.props.accessibilityLabel),
    ).toEqual(["Frente", "Brazo contraído", "Pierna"])
    expect(screen.queryByRole("radio", { name: "Espalda" })).toBeNull()
    expect(screen.queryByRole("radio", { name: "Perfil derecho" })).toBeNull()
    expect(screen.queryByRole("radio", { name: "1 jul 2026" })).toBeNull()
    expect(pedidasPara(api, frentePendiente)).toBe(0)
    // Una vista con solo una foto pendiente tampoco tiene fotos.
    expect(
      screen.getByText("Sin fotos de espalda, perfil izquierdo ni perfil derecho."),
    ).toBeTruthy()

    await fireEvent.press(screen.getByRole("radio", { name: "Brazo contraído" }))
    expect(await screen.findByLabelText("Brazo contraído, 1 mar 2026")).toBeTruthy()
    expect(await screen.findByLabelText("Brazo contraído, 24 sep 2026")).toBeTruthy()
    expect(screen.queryByLabelText(/^Pierna, /)).toBeNull()
  })

  it("sin fotos lo dice y no pide ningún enlace", async () => {
    const api = apiFalsa()
    await render(<ComparadorFotos fotos={[]} api={api} puedeBorrar={nadie} />)
    expect(screen.getByText("Aún no hay fotos para comparar.")).toBeTruthy()
    expect(screen.queryByLabelText("Vista")).toBeNull()
    expect(api.acceso).not.toHaveBeenCalled()
  })

  it("una foto retirada se identifica sin pedir enlace ni sustituirla por otra fecha", async () => {
    const api = apiFalsa()
    const retirada = foto(10, { fechaToma: "2026-01-10", estado: "eliminado" })
    const retirandose = foto(11, { fechaToma: "2026-09-24", estado: "eliminando" })
    await render(
      <ComparadorFotos fotos={[retirada, frenteMayo, retirandose]} api={api} puedeBorrar={nadie} />,
    )

    expect(screen.getAllByText("Foto retirada")).toHaveLength(2)
    expect(screen.getByLabelText("Frente, 10 ene 2026: foto retirada")).toBeTruthy()
    // El lector también oye que el almacén aún no ha terminado de borrarla.
    expect(
      screen.getByLabelText(
        "Frente, 24 sep 2026: foto retirada. El borrado del almacén aún no ha terminado.",
      ),
    ).toBeTruthy()
    expect(screen.queryByLabelText("Frente, 10 may 2026")).toBeNull()
    expect(api.acceso).not.toHaveBeenCalled()
    expect(
      within(screen.getByLabelText("Fecha de la primera foto")).getByRole("radio", {
        name: "10 ene 2026, foto retirada",
      }),
    ).toBeTruthy()
  })

  it("dos fotos de la misma vista y el mismo día se nombran por quién las subió en todas sus etiquetas", async () => {
    const api = apiFalsa()
    const deLaEntrenadora = foto(13, { creadoEn: "2026-09-24T09:00:00.000Z" })
    const deLaClienta = foto(14, {
      autor: CLIENTA,
      origen: "cliente",
      creadoEn: "2026-09-24T18:00:00.000Z",
    })
    // La de la clienta no carga: su error y su «Reintentar» también se distinguen.
    const accesoNormal = api.acceso.getMockImplementation()!
    api.acceso.mockImplementation(async (medioId: string) => {
      if (medioId === deLaClienta.id) throw new Error("sin red")
      return accesoNormal(medioId)
    })
    await render(
      <ComparadorFotos fotos={[deLaClienta, deLaEntrenadora]} api={api} puedeBorrar={() => true} />,
    )

    const DE_LA_ENTRENADORA = "Frente, 24 sep 2026, subida por Entrenadora Demo"
    const DE_LA_CLIENTA = "Frente, 24 sep 2026, subida por Clienta Demo"
    expect(await screen.findByLabelText(DE_LA_ENTRENADORA)).toBeTruthy()
    expect(await screen.findByLabelText(`No se ha podido cargar la foto de ${DE_LA_CLIENTA}.`))
    expect(
      screen.getByRole("button", { name: `Reintentar la foto de ${DE_LA_CLIENTA}` }),
    ).toBeTruthy()
    expect(screen.queryByLabelText("Frente, 24 sep 2026")).toBeNull()
    expect(
      screen.getByText(
        "Las dos fotos son del mismo día (24 sep 2026): una la subió Entrenadora Demo y la otra, Clienta Demo.",
      ),
    ).toBeTruthy()

    // El mismo rótulo que en el selector de fechas.
    const primera = screen.getByLabelText("Fecha de la primera foto")
    expect(
      within(primera).getByRole("radio", { name: "24 sep 2026, subida por Entrenadora Demo" }).props
        .accessibilityState,
    ).toMatchObject({ checked: true })
    expect(
      within(primera).getByRole("radio", { name: "24 sep 2026, subida por Clienta Demo" }).props
        .accessibilityState,
    ).toMatchObject({ disabled: true })
    expect(within(primera).getByText("24 sep 2026 · Clienta Demo")).toBeTruthy()

    expect(
      screen.getByRole("button", { name: `Eliminar la foto de ${DE_LA_CLIENTA}` }),
    ).toBeTruthy()
    await fireEvent.press(
      screen.getByRole("button", { name: `Eliminar la foto de ${DE_LA_ENTRENADORA}` }),
    )
    expect(
      screen.getByText(
        `${DE_LA_ENTRENADORA}. Se borrará la imagen y en el historial constará como foto retirada. No se puede deshacer.`,
      ),
    ).toBeTruthy()
  })

  it("dos fotos del mismo día y de la misma persona se numeran", async () => {
    const api = apiFalsa()
    const manana = foto(18, { creadoEn: "2026-09-24T09:00:00.000Z" })
    const tarde = foto(19, { creadoEn: "2026-09-24T18:00:00.000Z" })
    await render(<ComparadorFotos fotos={[tarde, manana]} api={api} puedeBorrar={nadie} />)

    const imagen = await screen.findByLabelText("Frente, 24 sep 2026, subida por Entrenadora Demo")
    const segunda = await screen.findByLabelText(
      "Frente, 24 sep 2026, subida por Entrenadora Demo (2)",
    )
    expect(fuente(imagen).uri).toContain(manana.id)
    expect(fuente(segunda).uri).toContain(tarde.id)
    expect(
      screen.getByText(
        "Las dos fotos son del mismo día (24 sep 2026) y las subió Entrenadora Demo.",
      ),
    ).toBeTruthy()
  })

  it("una foto «otra» con el nombre de una vista estándar se nombra «Otra: …»", async () => {
    const api = apiFalsa()
    const otraFrente = foto(15, { vista: "otra", etiqueta: "Frente" })
    const otraPerfil = foto(16, { vista: "otra", etiqueta: "perfil izquierdo" })
    await render(
      <ComparadorFotos
        fotos={[otraPerfil, frenteEnero, otraFrente]}
        api={api}
        puedeBorrar={nadie}
      />,
    )
    await screen.findByLabelText("Frente, 10 ene 2026")

    expect(
      within(screen.getByLabelText("Vista"))
        .getAllByRole("radio")
        .map((r) => r.props.accessibilityLabel),
    ).toEqual(["Frente", "Otra: Frente", "Otra: perfil izquierdo"])
    // La vista estándar sigue sin fotos aunque una «otra» se llame igual.
    expect(
      screen.getByText("Sin fotos de espalda, perfil izquierdo ni perfil derecho."),
    ).toBeTruthy()

    await fireEvent.press(screen.getByRole("radio", { name: "Otra: Frente" }))
    expect(await screen.findByLabelText("Otra: Frente, 24 sep 2026")).toBeTruthy()
    expect(
      screen.getByText(
        "Solo hay una foto de «Otra: Frente» (24 sep 2026). Para comparar hace falta otra de la misma vista con otra fecha.",
      ),
    ).toBeTruthy()
    expect(screen.queryByLabelText("Frente, 10 ene 2026")).toBeNull()
  })

  it("dice qué vistas estándar no tienen fotos", async () => {
    const api = apiFalsa()
    const izquierdo = foto(20, { vista: "perfilIzquierdo" })
    const derecho = foto(21, { vista: "perfilDerecho" })
    const pierna = foto(22, { vista: "otra", etiqueta: "Pierna" })
    const vista = await render(
      <ComparadorFotos
        fotos={[frenteEnero, frenteSeptiembre, espaldaSeptiembre]}
        api={api}
        puedeBorrar={nadie}
      />,
    )
    expect(screen.getByText("Sin fotos de perfil izquierdo ni perfil derecho.")).toBeTruthy()

    await vista.rerender(
      <ComparadorFotos
        fotos={[frenteEnero, frenteSeptiembre, espaldaSeptiembre, izquierdo]}
        api={api}
        puedeBorrar={nadie}
      />,
    )
    expect(screen.getByText("Sin fotos de perfil derecho.")).toBeTruthy()

    await vista.rerender(
      <ComparadorFotos
        fotos={[frenteEnero, espaldaSeptiembre, izquierdo, derecho]}
        api={api}
        puedeBorrar={nadie}
      />,
    )
    expect(screen.queryByText(/^Sin fotos de/)).toBeNull()

    await vista.rerender(<ComparadorFotos fotos={[pierna]} api={api} puedeBorrar={nadie} />)
    expect(
      screen.getByText("Sin fotos de frente, espalda, perfil izquierdo ni perfil derecho."),
    ).toBeTruthy()
    await screen.findByLabelText("Pierna, 24 sep 2026")
  })

  it("si la foto elegida desaparece de la lista lo avisa y vuelve a la más antigua y la más reciente", async () => {
    const api = apiFalsa()
    const frenteJulio = foto(17, { fechaToma: "2026-07-15", creadoEn: "2026-07-15T09:00:00.000Z" })
    const vista = await render(
      <ComparadorFotos
        fotos={[frenteEnero, frenteMayo, frenteSeptiembre]}
        api={api}
        puedeBorrar={nadie}
      />,
    )
    await screen.findByLabelText("Frente, 24 sep 2026")
    await fireEvent.press(
      within(screen.getByLabelText("Fecha de la segunda foto")).getByRole("radio", {
        name: "10 may 2026",
      }),
    )
    await screen.findByLabelText("Frente, 10 may 2026")

    await vista.rerender(
      <ComparadorFotos
        fotos={[frenteEnero, frenteJulio, frenteSeptiembre]}
        api={api}
        puedeBorrar={nadie}
      />,
    )
    const AVISO =
      "La foto elegida (Frente, 10 may 2026) ha dejado de estar en la lista. Se vuelve a comparar la más antigua con la más reciente."
    expect(screen.getByText(AVISO)).toBeTruthy()
    expect(await screen.findByLabelText("Frente, 10 ene 2026")).toBeTruthy()
    expect(await screen.findByLabelText("Frente, 24 sep 2026")).toBeTruthy()
    expect(screen.queryByLabelText("Frente, 15 jul 2026")).toBeNull()
    expect(
      within(screen.getByLabelText("Fecha de la segunda foto")).getByRole("radio", {
        name: "24 sep 2026",
      }).props.accessibilityState,
    ).toMatchObject({ checked: true })

    // Si la foto vuelve a llegar, no reaparece en silencio: la vuelta fue explícita.
    await vista.rerender(
      <ComparadorFotos
        fotos={[frenteEnero, frenteMayo, frenteJulio, frenteSeptiembre]}
        api={api}
        puedeBorrar={nadie}
      />,
    )
    expect(screen.queryByLabelText("Frente, 10 may 2026")).toBeNull()
    expect(screen.getByLabelText("Frente, 24 sep 2026")).toBeTruthy()
    expect(screen.getByText(AVISO)).toBeTruthy()

    // Elegir otra fecha retira el aviso.
    await fireEvent.press(
      within(screen.getByLabelText("Fecha de la segunda foto")).getByRole("radio", {
        name: "15 jul 2026",
      }),
    )
    expect(await screen.findByLabelText("Frente, 15 jul 2026")).toBeTruthy()
    expect(screen.queryByText(AVISO)).toBeNull()
  })

  it("aunque desaparezca la foto por defecto, la misma foto no ocupa los dos huecos", async () => {
    const api = apiFalsa()
    const vista = await render(
      <ComparadorFotos
        fotos={[frenteEnero, frenteMayo, frenteSeptiembre]}
        api={api}
        puedeBorrar={nadie}
      />,
    )
    await screen.findByLabelText("Frente, 24 sep 2026")
    await fireEvent.press(
      within(screen.getByLabelText("Fecha de la primera foto")).getByRole("radio", {
        name: "10 may 2026",
      }),
    )
    await screen.findByLabelText("Frente, 10 may 2026")

    // Desaparece la más reciente, que no se eligió a mano; la de mayo pasa a ser la última.
    await vista.rerender(
      <ComparadorFotos fotos={[frenteEnero, frenteMayo]} api={api} puedeBorrar={nadie} />,
    )
    expect(await screen.findByLabelText("Frente, 10 ene 2026")).toBeTruthy()
    expect(screen.getAllByLabelText("Frente, 10 may 2026")).toHaveLength(1)
    expect(screen.queryByText(/ha dejado de estar en la lista/)).toBeNull()
  })
})

describe("enlaces temporales", () => {
  it("si la imagen falla pide un enlace nuevo una sola vez y después ofrece reintentar", async () => {
    const api = apiFalsa()
    await render(
      <ComparadorFotos fotos={[frenteEnero, frenteSeptiembre]} api={api} puedeBorrar={nadie} />,
    )
    const imagen = await screen.findByLabelText("Frente, 10 ene 2026")
    const primerEnlace = fuente(imagen).uri

    await fireEvent(imagen, "error", { nativeEvent: { error: "403" } })
    await waitFor(() =>
      expect(fuente(screen.getByLabelText("Frente, 10 ene 2026")).uri).not.toBe(primerEnlace),
    )
    expect(pedidasPara(api, frenteEnero)).toBe(2)

    await fireEvent(screen.getByLabelText("Frente, 10 ene 2026"), "error", {
      nativeEvent: { error: "403" },
    })
    expect(await screen.findByText("No se ha podido cargar la foto.")).toBeTruthy()
    expect(screen.queryByLabelText("Frente, 10 ene 2026")).toBeNull()
    expect(pedidasPara(api, frenteEnero)).toBe(2)
    // La otra foto sigue a la vista: el fallo de una no se lleva la comparación.
    expect(screen.getByLabelText("Frente, 24 sep 2026")).toBeTruthy()

    await fireEvent.press(
      screen.getByRole("button", { name: "Reintentar la foto de Frente, 10 ene 2026" }),
    )
    expect(await screen.findByLabelText("Frente, 10 ene 2026")).toBeTruthy()
    expect(pedidasPara(api, frenteEnero)).toBe(3)
  })

  it("un enlace ya caducado se renueva una vez; si el nuevo también falla, error recuperable", async () => {
    const api = apiFalsa()
    api.acceso
      .mockResolvedValueOnce(lectura(frenteEnero.id, 91, PASADO))
      .mockResolvedValueOnce(lectura(frenteEnero.id, 92, FUTURO))
    await render(<ComparadorFotos fotos={[frenteEnero]} api={api} puedeBorrar={nadie} />)

    const imagen = await screen.findByLabelText("Frente, 10 ene 2026")
    expect(fuente(imagen).uri).toBe(`https://almacen.test/lectura/${frenteEnero.id}?firma=92`)
    expect(pedidasPara(api, frenteEnero)).toBe(2)

    // La renovación ya se usó: si esta imagen también falla, no se insiste.
    await fireEvent(imagen, "error", { nativeEvent: { error: "403" } })
    expect(await screen.findByText("No se ha podido cargar la foto.")).toBeTruthy()
    expect(pedidasPara(api, frenteEnero)).toBe(2)

    // Reintentar vuelve a tener una renovación, pero no más. La renovada se
    // intenta cargar aunque parezca caducada: decide la carga, no el reloj.
    api.acceso
      .mockResolvedValueOnce(lectura(frenteEnero.id, 93, PASADO))
      .mockResolvedValueOnce(lectura(frenteEnero.id, 94, PASADO))
    await fireEvent.press(
      screen.getByRole("button", { name: "Reintentar la foto de Frente, 10 ene 2026" }),
    )
    const renovada = await screen.findByLabelText("Frente, 10 ene 2026")
    expect(fuente(renovada).uri).toBe(`https://almacen.test/lectura/${frenteEnero.id}?firma=94`)
    expect(pedidasPara(api, frenteEnero)).toBe(4)

    await fireEvent(renovada, "error", { nativeEvent: { error: "403" } })
    expect(await screen.findByText("No se ha podido cargar la foto.")).toBeTruthy()
    expect(screen.queryByLabelText("Frente, 10 ene 2026")).toBeNull()
    expect(pedidasPara(api, frenteEnero)).toBe(4)
  })

  it("tras una carga correcta vuelve a poder renovar el enlace una vez", async () => {
    const api = apiFalsa()
    await render(<ComparadorFotos fotos={[frenteEnero]} api={api} puedeBorrar={nadie} />)
    const error = async (): Promise<void> => {
      await fireEvent(screen.getByLabelText("Frente, 10 ene 2026"), "error", {
        nativeEvent: { error: "403" },
      })
    }
    const cargada = async (): Promise<void> => {
      await fireEvent(screen.getByLabelText("Frente, 10 ene 2026"), "load", {
        nativeEvent: { source: { width: 300, height: 400 } },
      })
    }
    const enlaceActual = (): string => fuente(screen.getByLabelText("Frente, 10 ene 2026")).uri

    await screen.findByLabelText("Frente, 10 ene 2026")
    await error()
    await waitFor(() => expect(enlaceActual()).toContain("firma=2"))
    await cargada()

    // Más tarde el enlace caduca y la imagen vuelve a pedirse (al girar el
    // móvil o cambiar de tamaño): se renueva otra vez en lugar de dar error.
    await error()
    await waitFor(() => expect(enlaceActual()).toContain("firma=3"))
    expect(screen.queryByText("No se ha podido cargar la foto.")).toBeNull()
    await cargada()
    await error()
    await waitFor(() => expect(enlaceActual()).toContain("firma=4"))

    // Sin una carga correcta entre medias, la renovación no se repite.
    await error()
    expect(await screen.findByText("No se ha podido cargar la foto.")).toBeTruthy()
    expect(pedidasPara(api, frenteEnero)).toBe(4)
  })

  it("con el reloj del móvil adelantado, los enlaces que parecen caducados se muestran igual", async () => {
    // El servidor da 5 minutos; si el móvil va 6 por delante, todo enlace
    // recién firmado parece caducado hace 1 minuto.
    const haceUnMinuto = (): string => new Date(Date.now() - 60_000).toISOString()
    const api = apiFalsa()
    let firma = 0
    api.acceso.mockImplementation(async (medioId: string) => {
      firma += 1
      return lectura(medioId, firma, haceUnMinuto())
    })
    await render(
      <ComparadorFotos fotos={[frenteEnero, frenteSeptiembre]} api={api} puedeBorrar={nadie} />,
    )

    const antigua = await screen.findByLabelText("Frente, 10 ene 2026")
    const reciente = await screen.findByLabelText("Frente, 24 sep 2026")
    // Se renueva una sola vez por foto y se intenta cargar la renovada.
    expect(pedidasPara(api, frenteEnero)).toBe(2)
    expect(pedidasPara(api, frenteSeptiembre)).toBe(2)
    expect(fuente(antigua).uri).toContain(frenteEnero.id)
    expect(fuente(reciente).uri).toContain(frenteSeptiembre.id)
    expect(screen.queryByText("No se ha podido cargar la foto.")).toBeNull()
  })

  it("si la API no da acceso muestra el error sin insistir", async () => {
    const api = apiFalsa()
    api.acceso.mockRejectedValueOnce(new Error("sin red"))
    await render(<ComparadorFotos fotos={[frenteEnero]} api={api} puedeBorrar={nadie} />)
    expect(await screen.findByText("No se ha podido cargar la foto.")).toBeTruthy()
    expect(pedidasPara(api, frenteEnero)).toBe(1)
  })
})

describe("sin caché corporal persistente en Android", () => {
  // Fresco escribe en disco toda imagen de red aunque se pida `reload`, y la
  // clave es la URL firmada: cada vista dejaría otra copia del cuerpo. Allí la
  // foto se descarga a memoria y se pinta como `data:`, que no pasa por disco.
  const JPEG = Uint8Array.from([0xff, 0xd8, 0xff, 0xd9])
  const DATOS_JPEG = "data:image/jpeg;base64,/9j/2Q=="

  /** Como el FileReader de React Native: convierte el blob sin escribir nada. */
  class LectorFalso {
    result: string | null = null
    error: Error | null = null
    onload: (() => void) | null = null
    onerror: (() => void) | null = null
    readAsDataURL(blob: Blob): void {
      void blob.arrayBuffer().then((bytes) => {
        this.result = `data:${blob.type};base64,${Buffer.from(bytes).toString("base64")}`
        this.onload?.()
      })
    }
  }
  const lectorAnterior = Object.getOwnPropertyDescriptor(globalThis, "FileReader")

  beforeEach(() => {
    jest.replaceProperty(Platform, "OS", "android")
    Object.defineProperty(globalThis, "FileReader", {
      value: LectorFalso,
      configurable: true,
      writable: true,
    })
  })
  afterEach(() => {
    jest.restoreAllMocks()
    if (lectorAnterior) Object.defineProperty(globalThis, "FileReader", lectorAnterior)
    else Reflect.deleteProperty(globalThis, "FileReader")
  })

  /** Una descarga correcta; `liberar` hace de `close()` del blob nativo. */
  const conFoto = (liberar: () => void): Response =>
    ({
      ok: true,
      status: 200,
      blob: async () => Object.assign(new Blob([JPEG], { type: "image/jpeg" }), { close: liberar }),
    }) as unknown as Response
  const enlace = (medio: MedioFoto, firma: number): string =>
    `https://almacen.test/lectura/${medio.id}?firma=${firma}`

  it("descarga la foto a memoria y la pinta como data:, sin dar la URL firmada al cargador", async () => {
    const liberar = jest.fn()
    const descargar = jest
      .spyOn(globalThis, "fetch")
      .mockImplementation(async () => conFoto(liberar))
    const api = apiFalsa()
    await render(<ComparadorFotos fotos={[frenteEnero]} api={api} puedeBorrar={nadie} />)

    const imagen = await screen.findByLabelText("Frente, 10 ene 2026")
    // Ni URL, ni cabeceras, ni política de caché: nada que Fresco guarde en disco.
    expect(imagen.props.source).toEqual({ uri: DATOS_JPEG })
    expect(descargar).toHaveBeenCalledTimes(1)
    // `no-store` en la petición: la caché HTTP de la app tampoco la guarda,
    // aunque un almacén olvidase su propia cabecera.
    expect(descargar).toHaveBeenCalledWith(
      enlace(frenteEnero, 1),
      expect.objectContaining({
        headers: { "x-firma-prueba": "1", "Cache-Control": "no-store" },
      }),
    )
    // El blob nativo se libera en cuanto se ha leído.
    expect(liberar).toHaveBeenCalledTimes(1)
  })

  it("si la descarga falla pide un enlace nuevo una sola vez y después ofrece reintentar", async () => {
    const descargar = jest
      .spyOn(globalThis, "fetch")
      .mockRejectedValueOnce(new TypeError("Network request failed"))
      .mockResolvedValueOnce(new Response(null, { status: 403 }))
    const api = apiFalsa()
    await render(<ComparadorFotos fotos={[frenteEnero]} api={api} puedeBorrar={nadie} />)

    expect(await screen.findByText("No se ha podido cargar la foto.")).toBeTruthy()
    expect(pedidasPara(api, frenteEnero)).toBe(2)
    expect(descargar.mock.calls.map(([url]) => url)).toEqual([
      enlace(frenteEnero, 1),
      enlace(frenteEnero, 2),
    ])
    expect(screen.queryByLabelText("Frente, 10 ene 2026")).toBeNull()

    descargar.mockImplementation(async () => conFoto(jest.fn()))
    await fireEvent.press(
      screen.getByRole("button", { name: "Reintentar la foto de Frente, 10 ene 2026" }),
    )
    const imagen = await screen.findByLabelText("Frente, 10 ene 2026")
    expect(imagen.props.source).toEqual({ uri: DATOS_JPEG })
    expect(pedidasPara(api, frenteEnero)).toBe(3)
  })

  it("si la foto descargada no se puede pintar, se renueva una vez y después error", async () => {
    const descargar = jest
      .spyOn(globalThis, "fetch")
      .mockImplementation(async () => conFoto(jest.fn()))
    const api = apiFalsa()
    await render(<ComparadorFotos fotos={[frenteEnero]} api={api} puedeBorrar={nadie} />)

    await fireEvent(await screen.findByLabelText("Frente, 10 ene 2026"), "error", {
      nativeEvent: { error: "decodificación" },
    })
    await waitFor(() => expect(descargar).toHaveBeenCalledTimes(2))
    expect(descargar).toHaveBeenLastCalledWith(enlace(frenteEnero, 2), expect.anything())

    await fireEvent(await screen.findByLabelText("Frente, 10 ene 2026"), "error", {
      nativeEvent: { error: "decodificación" },
    })
    expect(await screen.findByText("No se ha podido cargar la foto.")).toBeTruthy()
    expect(pedidasPara(api, frenteEnero)).toBe(2)
    expect(descargar).toHaveBeenCalledTimes(2)
  })

  it("al desmontarse cancela la descarga en curso y libera lo que llegue tarde", async () => {
    let senal: AbortSignal | undefined
    let responder: (respuesta: Response) => void = () => undefined
    jest.spyOn(globalThis, "fetch").mockImplementation(
      (_url, init) =>
        new Promise<Response>((resolver) => {
          senal = init?.signal ?? undefined
          responder = resolver
        }),
    )
    const api = apiFalsa()
    const vista = await render(
      <ComparadorFotos fotos={[frenteEnero]} api={api} puedeBorrar={nadie} />,
    )
    await waitFor(() => expect(senal).toBeDefined())
    expect(senal?.aborted).toBe(false)

    await vista.unmount()
    expect(senal?.aborted).toBe(true)
    // Si la red responde igualmente, el blob se libera sin leerse.
    const liberar = jest.fn()
    responder(conFoto(liberar))
    await waitFor(() => expect(liberar).toHaveBeenCalledTimes(1))
  })
})

describe("eliminar", () => {
  it("pide confirmación y refleja el estado que confirma el servidor", async () => {
    const api = apiFalsa()
    let responder: (medio: MedioFoto) => void = () => undefined
    api.borrar.mockImplementationOnce(
      () =>
        new Promise<MedioFoto>((resolver) => {
          responder = resolver
        }),
    )
    await render(
      <ComparadorFotos
        fotos={[frenteEnero, frenteSeptiembre]}
        api={api}
        puedeBorrar={() => true}
      />,
    )
    await screen.findByLabelText("Frente, 24 sep 2026")

    const eliminar = screen.getByRole("button", { name: "Eliminar la foto de Frente, 24 sep 2026" })
    await fireEvent.press(eliminar)
    expect(screen.getByText("¿Eliminar esta foto?")).toBeTruthy()
    await fireEvent.press(screen.getByRole("button", { name: "Cancelar" }))
    expect(screen.queryByText("¿Eliminar esta foto?")).toBeNull()
    expect(api.borrar).not.toHaveBeenCalled()

    await fireEvent.press(eliminar)
    await fireEvent.press(screen.getByRole("button", { name: "Eliminar" }))
    expect(api.borrar).toHaveBeenCalledWith(frenteSeptiembre.id)

    // Hasta que responde el servidor la foto no se da por retirada.
    expect(screen.getByLabelText("Frente, 24 sep 2026")).toBeTruthy()
    expect(screen.queryByText("Foto retirada")).toBeNull()
    expect(
      screen.getByRole("button", { name: "Retirando la foto de Frente, 24 sep 2026" }),
    ).toBeTruthy()

    responder({ ...frenteSeptiembre, estado: "eliminado" })
    expect(await screen.findByText("Foto retirada")).toBeTruthy()
    expect(screen.queryByLabelText("Frente, 24 sep 2026")).toBeNull()
    expect(screen.getByLabelText("Frente, 24 sep 2026: foto retirada")).toBeTruthy()
    // El hueco no se rellena con la otra foto ni con otra fecha.
    expect(screen.getByLabelText("Frente, 10 ene 2026")).toBeTruthy()
    expect(screen.queryByRole("button", { name: /Eliminar la foto de Frente, 24 sep/ })).toBeNull()
  })

  it("si falla, la foto queda en un hueco pendiente de retirar, sin pedir enlace, y se puede reintentar", async () => {
    const api = apiFalsa()
    let responder: (medio: MedioFoto) => void = () => undefined
    api.borrar.mockRejectedValueOnce(new Error("almacén caído")).mockImplementationOnce(
      () =>
        new Promise<MedioFoto>((resolver) => {
          responder = resolver
        }),
    )
    await render(
      <ComparadorFotos
        fotos={[frenteEnero, frenteSeptiembre]}
        api={api}
        puedeBorrar={() => true}
      />,
    )
    await screen.findByLabelText("Frente, 10 ene 2026")

    await fireEvent.press(
      screen.getByRole("button", { name: "Eliminar la foto de Frente, 10 ene 2026" }),
    )
    await fireEvent.press(screen.getByRole("button", { name: "Eliminar" }))

    expect(
      await screen.findByText("No se ha podido retirar la foto: sigue pendiente de retirar."),
    ).toBeTruthy()
    // La imagen se sustituye por el hueco; no se vuelve a pedir su enlace.
    expect(screen.getByLabelText("Frente, 10 ene 2026: pendiente de retirar")).toBeTruthy()
    expect(screen.getByText("Pendiente de retirar")).toBeTruthy()
    expect(screen.queryByLabelText("Frente, 10 ene 2026")).toBeNull()
    expect(screen.queryByText("Foto retirada")).toBeNull()
    expect(pedidasPara(api, frenteEnero)).toBe(1)
    expect(screen.queryByRole("button", { name: /^Eliminar la foto de Frente, 10 ene/ })).toBeNull()

    await fireEvent.press(
      screen.getByRole("button", { name: "Reintentar la retirada de Frente, 10 ene 2026" }),
    )
    expect(api.borrar).toHaveBeenCalledTimes(2)
    // Mientras se reintenta sigue el hueco: la foto no vuelve a mostrarse.
    expect(screen.getByLabelText("Frente, 10 ene 2026: pendiente de retirar")).toBeTruthy()
    expect(
      screen.getByRole("button", { name: "Reintentar la retirada de Frente, 10 ene 2026" }).props
        .accessibilityState,
    ).toMatchObject({ busy: true })
    expect(pedidasPara(api, frenteEnero)).toBe(1)

    // El servidor retiró el acceso y aún está borrando del almacén: se dice tal cual.
    responder({ ...frenteEnero, estado: "eliminando" })
    expect(await screen.findByText("Foto retirada")).toBeTruthy()
    expect(screen.getByText("El borrado del almacén aún no ha terminado.")).toBeTruthy()
    expect(
      screen.getByLabelText(
        "Frente, 10 ene 2026: foto retirada. El borrado del almacén aún no ha terminado.",
      ),
    ).toBeTruthy()
    expect(
      screen.queryByText("No se ha podido retirar la foto: sigue pendiente de retirar."),
    ).toBeNull()
    expect(pedidasPara(api, frenteEnero)).toBe(1)
  })

  it("si la lista llega con la foto ya eliminada, desaparecen el aviso de fallo y el reintento", async () => {
    const api = apiFalsa()
    api.borrar.mockRejectedValueOnce(new Error("sin respuesta"))
    const vista = await render(
      <ComparadorFotos
        fotos={[frenteEnero, frenteSeptiembre]}
        api={api}
        puedeBorrar={() => true}
      />,
    )
    await screen.findByLabelText("Frente, 10 ene 2026")
    await fireEvent.press(
      screen.getByRole("button", { name: "Eliminar la foto de Frente, 10 ene 2026" }),
    )
    await fireEvent.press(screen.getByRole("button", { name: "Eliminar" }))
    await screen.findByText("No se ha podido retirar la foto: sigue pendiente de retirar.")

    // El borrado sí llegó al servidor: la lista actualizada lo dice.
    await vista.rerender(
      <ComparadorFotos
        fotos={[{ ...frenteEnero, estado: "eliminado" }, frenteSeptiembre]}
        api={api}
        puedeBorrar={() => true}
      />,
    )
    expect(screen.getByLabelText("Frente, 10 ene 2026: foto retirada")).toBeTruthy()
    expect(
      screen.queryByText("No se ha podido retirar la foto: sigue pendiente de retirar."),
    ).toBeNull()
    expect(screen.queryByRole("button", { name: /Reintentar la retirada/ })).toBeNull()
    expect(screen.queryByText("Pendiente de retirar")).toBeNull()
  })

  it("sin permiso para borrar una foto no se ofrece la acción", async () => {
    const api = apiFalsa()
    const deLaClienta = foto(12, { autor: CLIENTA, origen: "cliente" })
    await render(
      <ComparadorFotos
        fotos={[frenteEnero, deLaClienta]}
        api={api}
        puedeBorrar={(f) => f.origen === "cliente"}
      />,
    )
    await screen.findByLabelText("Frente, 10 ene 2026")
    expect(screen.getByText("Subida por Clienta Demo")).toBeTruthy()
    expect(
      screen.getByRole("button", { name: "Eliminar la foto de Frente, 24 sep 2026" }),
    ).toBeTruthy()
    expect(
      screen.queryByRole("button", { name: "Eliminar la foto de Frente, 10 ene 2026" }),
    ).toBeNull()
  })
})

describe("uso en pantallas estrechas", () => {
  it("pone las fotos lado a lado si caben y las apila si no", async () => {
    const api = apiFalsa()
    await render(
      <ComparadorFotos fotos={[frenteEnero, frenteSeptiembre]} api={api} puedeBorrar={nadie} />,
    )
    await screen.findByLabelText("Frente, 24 sep 2026")
    const direccion = (): unknown =>
      StyleSheet.flatten(screen.getByTestId("fotos-comparadas").props.style).flexDirection
    const medir = async (width: number): Promise<void> => {
      await fireEvent(screen.getByTestId("fotos-comparadas"), "layout", {
        nativeEvent: { layout: { x: 0, y: 0, width, height: 600 } },
      })
    }

    await medir(250)
    expect(direccion()).toBe("column")
    await medir(318)
    expect(direccion()).toBe("row")
  })

  it("los controles miden al menos 44 px de alto", async () => {
    const api = apiFalsa()
    api.acceso.mockRejectedValueOnce(new Error("sin red"))
    await render(
      <ComparadorFotos
        fotos={[frenteEnero, frenteSeptiembre, espaldaSeptiembre]}
        api={api}
        puedeBorrar={() => true}
      />,
    )
    await screen.findByText("No se ha podido cargar la foto.")
    await screen.findByLabelText("Frente, 24 sep 2026")
    const controles = [
      screen.getByRole("radio", { name: "Espalda" }),
      within(screen.getByLabelText("Fecha de la primera foto")).getByRole("radio", {
        name: "10 ene 2026",
      }),
      screen.getByRole("button", { name: "Eliminar la foto de Frente, 24 sep 2026" }),
      screen.getByRole("button", { name: "Reintentar la foto de Frente, 10 ene 2026" }),
    ]
    for (const control of controles) {
      const { minHeight } = StyleSheet.flatten(control.props.style) as { minHeight?: number }
      expect(minHeight ?? 0).toBeGreaterThanOrEqual(44)
    }
  })
})
