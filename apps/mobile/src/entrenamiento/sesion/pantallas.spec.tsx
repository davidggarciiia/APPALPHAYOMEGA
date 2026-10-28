import { describe, expect, it, jest } from "@jest/globals"
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native"
import type { Cierre, Checkin, RegistrarMolestia } from "@alpha-omega/shared"

import { CheckIn } from "./check-in"
import { CierreDeSesion } from "./cierre"
import { Dialogo } from "./controles"
import { RegistrarMolestiaPantalla } from "./molestia"

describe("CheckIn", () => {
  it("no empieza hasta responder las dos preguntas", async () => {
    const empezar = jest.fn<(c: Checkin) => void>()
    await render(<CheckIn nombre="Empuje" empezar={empezar} volver={() => undefined} />)

    await fireEvent.press(screen.getByRole("button", { name: "Empezar" }))
    expect(empezar).not.toHaveBeenCalled()
    expect(screen.getByText("Responde las dos preguntas para empezar.")).toBeTruthy()

    await fireEvent.press(screen.getByRole("radio", { name: "4" }))
    await fireEvent.press(screen.getByRole("radio", { name: "Agujetas" }))
    await fireEvent.press(screen.getByRole("button", { name: "Empezar" }))
    expect(empezar).toHaveBeenCalledWith({ sensacion: 4, molestia: "agujetas" })
  })

  it("con dolor recuerda no entrenar la zona", async () => {
    await render(<CheckIn nombre="Empuje" empezar={() => undefined} volver={() => undefined} />)
    await fireEvent.press(screen.getByRole("radio", { name: "Dolor" }))
    expect(screen.getByText(/no entrenes esa zona/)).toBeTruthy()
  })
})

describe("RegistrarMolestiaPantalla", () => {
  const lugar = { ejercicioPrescritoId: "e-1", ejercicio: "Press banca", serie: 2 }

  it("avisa con la zona, la intensidad y lo que nota, y confirma", async () => {
    const avisar = jest.fn<(d: RegistrarMolestia) => Promise<unknown>>(async () => ({}))
    await render(
      <RegistrarMolestiaPantalla
        lugar={lugar}
        reloj="12:04"
        uuid={() => "30000000-0000-4000-8000-000000000001"}
        avisar={avisar}
        volver={() => undefined}
      />,
    )
    expect(screen.getByText("Press banca · serie 2")).toBeTruthy()

    await fireEvent.press(screen.getByRole("radio", { name: "Hombro" }))
    await fireEvent(
      screen.getByRole("adjustable", { name: "Intensidad de la molestia" }),
      "accessibilityAction",
      {
        nativeEvent: { actionName: "increment" },
      },
    )
    await fireEvent.press(screen.getByRole("checkbox", { name: "Pinchazo o irradia" }))
    await fireEvent.press(screen.getByRole("button", { name: "Avisar a tu entrenador" }))

    await waitFor(() => expect(screen.getByText(/Aviso enviado/)).toBeTruthy())
    expect(avisar).toHaveBeenCalledWith({
      operacionId: "30000000-0000-4000-8000-000000000001",
      ejercicioPrescritoId: "e-1",
      serie: 2,
      zona: "hombro",
      intensidad: 1,
      sintomas: ["pinchazo"],
      nota: null,
    })
  })

  it("sin zona no envía", async () => {
    const avisar = jest.fn<(d: RegistrarMolestia) => Promise<unknown>>(async () => ({}))
    await render(
      <RegistrarMolestiaPantalla
        lugar={lugar}
        reloj={null}
        uuid={() => "30000000-0000-4000-8000-000000000001"}
        avisar={avisar}
        volver={() => undefined}
      />,
    )
    await fireEvent.press(screen.getByRole("button", { name: "Avisar a tu entrenador" }))
    expect(screen.getByText("Elige la zona.")).toBeTruthy()
    expect(avisar).not.toHaveBeenCalled()
  })

  it("pregunta antes de descartar lo marcado", async () => {
    const volver = jest.fn()
    await render(
      <RegistrarMolestiaPantalla
        lugar={lugar}
        reloj={null}
        uuid={() => "30000000-0000-4000-8000-000000000001"}
        avisar={async () => ({})}
        volver={volver}
      />,
    )
    await fireEvent.press(screen.getByRole("radio", { name: "Codo" }))
    await fireEvent.press(screen.getByRole("button", { name: "Volver a la sesión" }))
    expect(volver).not.toHaveBeenCalled()
    await fireEvent.press(screen.getByRole("button", { name: "Descartar" }))
    expect(volver).toHaveBeenCalled()
  })
})

describe("CierreDeSesion", () => {
  it("pregunta antes de descartar respuestas parciales y guarda la nota sin inventar energía", async () => {
    const guardar = jest.fn(async () => undefined)
    const volver = jest.fn()
    await render(
      <CierreDeSesion
        subtitulo="Fuerza"
        resumen={{ hechas: 1, omitidas: 0, pendientes: 0 }}
        cierreInicial={null}
        notas=""
        enviando={false}
        error=""
        enviar={jest.fn()}
        reintentar={jest.fn()}
        guardar={guardar}
        volver={volver}
      />,
    )
    await fireEvent.press(screen.getByRole("radio", { name: "Algo incómodo" }))
    await fireEvent.press(screen.getByRole("button", { name: "Añadir nota" }))
    await fireEvent.changeText(screen.getByLabelText("Nota para tu entrenador"), "Nota parcial")
    await fireEvent.press(screen.getByRole("button", { name: "Volver a la sesión" }))
    expect(volver).not.toHaveBeenCalled()
    await fireEvent.press(screen.getByRole("button", { name: "Seguir editando" }))
    expect(screen.getByRole("radio", { name: "Algo incómodo", checked: true })).toBeTruthy()
    await fireEvent.press(screen.getByRole("button", { name: "Volver a la sesión" }))
    await fireEvent.press(screen.getByRole("button", { name: "Descartar respuestas" }))
    await waitFor(() => expect(volver).toHaveBeenCalledTimes(1))
    expect(guardar).toHaveBeenCalledWith(null, "Nota parcial")
  })

  it("envía el esfuerzo, la energía, si hubo algo incómodo y la nota", async () => {
    const enviar = jest.fn<(c: Cierre, notas: string) => void>()
    await render(
      <CierreDeSesion
        subtitulo="Empuje · 1 h 38 min"
        resumen={{ hechas: 5, omitidas: 1, pendientes: 2 }}
        cierreInicial={null}
        notas=""
        enviando={false}
        error=""
        enviar={enviar}
        reintentar={() => undefined}
        volver={() => undefined}
      />,
    )
    expect(screen.getByText("Empuje · 1 h 38 min")).toBeTruthy()
    expect(screen.getByText(/5 hechas/)).toBeTruthy()
    expect(screen.getByText(/1 omitida/)).toBeTruthy()
    expect(screen.getByText(/2 pendientes/)).toBeTruthy()
    expect(screen.queryByText("La próxima vez")).toBeNull()

    await fireEvent.press(screen.getByRole("button", { name: "Enviar a tu entrenador" }))
    expect(enviar).not.toHaveBeenCalled()

    await fireEvent.press(screen.getByRole("radio", { name: "3" }))
    await fireEvent.press(screen.getByRole("radio", { name: "Algo incómodo" }))
    await fireEvent.press(screen.getByRole("button", { name: "Añadir nota" }))
    await fireEvent.changeText(screen.getByLabelText("Nota para tu entrenador"), "Hombro cargado")
    await fireEvent.press(screen.getByRole("button", { name: "Enviar a tu entrenador" }))
    expect(enviar).toHaveBeenCalledWith(
      { esfuerzo: 5, energia: 3, incomodo: true },
      "Hombro cargado",
    )
  })

  const comun = {
    subtitulo: "Empuje · 1 h 38 min",
    resumen: { hechas: 5, omitidas: 1, pendientes: 2 },
    error: "",
    volver: () => undefined,
  }
  const sinControles = (): void => {
    expect(screen.queryAllByRole("radio")).toHaveLength(0)
    expect(screen.queryByRole("adjustable")).toBeNull()
    expect(screen.queryByRole("button", { name: "Añadir nota" })).toBeNull()
    expect(screen.queryByDisplayValue(/./)).toBeNull()
  }

  it("con el envío pendiente muestra lo comprometido sin controles y reintenta sin preguntar", async () => {
    const enviar = jest.fn<(c: Cierre, notas: string) => void>()
    const reintentar = jest.fn<() => void>()
    await render(
      <CierreDeSesion
        {...comun}
        cierreInicial={{ esfuerzo: 8, energia: 2, incomodo: true }}
        notas="Me cansé"
        enviando={false}
        pendiente
        enviar={enviar}
        reintentar={reintentar}
      />,
    )
    expect(screen.getByText("8 de 10")).toBeTruthy()
    expect(screen.getByText("2 de 5")).toBeTruthy()
    expect(screen.getByText("Algo incómodo")).toBeTruthy()
    expect(screen.getByText("Me cansé")).toBeTruthy()
    sinControles()

    await fireEvent.press(screen.getByRole("button", { name: "Reintentar envío pendiente" }))
    expect(reintentar).toHaveBeenCalledTimes(1)
    expect(enviar).not.toHaveBeenCalled()
    expect(screen.queryByText("Dinos cómo terminas y si hay algo que contar.")).toBeNull()
  })

  it("mientras se envía muestra lo elegido y no deja cambiarlo", async () => {
    const enviar = jest.fn<(c: Cierre, notas: string) => void>()
    const props = {
      ...comun,
      cierreInicial: null,
      notas: "",
      pendiente: false,
      enviar,
      reintentar: () => undefined,
    }
    await render(<CierreDeSesion {...props} enviando={false} />)
    const deslizador = screen.getByRole("adjustable", { name: "Cuánto te ha costado, de 0 a 10" })
    for (let i = 0; i < 3; i++)
      await fireEvent(deslizador, "accessibilityAction", {
        nativeEvent: { actionName: "increment" },
      })
    await fireEvent.press(screen.getByRole("radio", { name: "2" }))
    await fireEvent.press(screen.getByRole("radio", { name: "Algo incómodo" }))
    await fireEvent.press(screen.getByRole("button", { name: "Añadir nota" }))
    await fireEvent.changeText(screen.getByLabelText("Nota para tu entrenador"), "Me cansé")
    await fireEvent.press(screen.getByRole("button", { name: "Enviar a tu entrenador" }))
    expect(enviar).toHaveBeenCalledWith({ esfuerzo: 8, energia: 2, incomodo: true }, "Me cansé")

    await screen.rerender(<CierreDeSesion {...props} enviando />)
    expect(screen.getByText("8 de 10")).toBeTruthy()
    expect(screen.getByText("2 de 5")).toBeTruthy()
    expect(screen.getByText("Algo incómodo")).toBeTruthy()
    expect(screen.getByText("Me cansé")).toBeTruthy()
    sinControles()

    // Si falla antes de guardar la intención, vuelven los controles con lo elegido.
    await screen.rerender(
      <CierreDeSesion {...props} enviando={false} error="No se pudo confirmar la operación." />,
    )
    expect(screen.getByText("8 de 10")).toBeTruthy()
    expect(screen.getByRole("radio", { name: "2", checked: true })).toBeTruthy()
    expect(screen.getByRole("radio", { name: "Algo incómodo", checked: true })).toBeTruthy()
    expect(screen.getByDisplayValue("Me cansé")).toBeTruthy()
  })

  it("una operación ajena en curso no presenta como enviado lo que no se ha enviado", async () => {
    await render(
      <CierreDeSesion
        {...comun}
        cierreInicial={null}
        notas=""
        enviando
        enviar={() => undefined}
        reintentar={() => undefined}
      />,
    )
    expect(screen.queryByText(/Se está enviando/)).toBeNull()
    expect(screen.queryByText("Sin feedback registrado")).toBeNull()
    expect(screen.getByRole("radio", { name: "2" })).toBeTruthy()
    expect(
      screen.getByRole("button", { name: "Enviar a tu entrenador", busy: true, disabled: true }),
    ).toBeTruthy()
  })

  it("un envío pendiente sin cierre registrado no inventa respuestas y se puede reintentar", async () => {
    const reintentar = jest.fn<() => void>()
    await render(
      <CierreDeSesion
        {...comun}
        cierreInicial={null}
        notas=""
        enviando={false}
        pendiente
        enviar={() => undefined}
        reintentar={reintentar}
      />,
    )
    expect(screen.getByText("Sin feedback registrado")).toBeTruthy()
    expect(screen.queryByText(/de 10/)).toBeNull()
    expect(screen.queryByText(/de 5/)).toBeNull()
    sinControles()

    await fireEvent.press(screen.getByRole("button", { name: "Reintentar envío pendiente" }))
    expect(reintentar).toHaveBeenCalledTimes(1)
  })

  it("al reabrir antes de enviar parte del cierre ya guardado", async () => {
    const enviar = jest.fn<(c: Cierre, notas: string) => void>()
    await render(
      <CierreDeSesion
        {...comun}
        cierreInicial={{ esfuerzo: 8, energia: 2, incomodo: false }}
        notas="Me cansé"
        enviando={false}
        enviar={enviar}
        reintentar={() => undefined}
      />,
    )
    expect(screen.getByText("8 de 10")).toBeTruthy()
    expect(screen.getByRole("radio", { name: "2", checked: true })).toBeTruthy()
    expect(screen.getByRole("radio", { name: "Todo bien", checked: true })).toBeTruthy()
    expect(screen.getByDisplayValue("Me cansé")).toBeTruthy()

    await fireEvent.press(screen.getByRole("button", { name: "Enviar a tu entrenador" }))
    expect(enviar).toHaveBeenCalledWith({ esfuerzo: 8, energia: 2, incomodo: false }, "Me cansé")
  })
})

describe("Dialogo", () => {
  const dialogo = (ocupado?: boolean) => {
    const alConfirmar = jest.fn<() => void>()
    const alCancelar = jest.fn<() => void>()
    const elemento = (
      <Dialogo
        visible
        titulo="Añadir medida"
        texto="Las de hoy."
        confirmar="Guardar"
        cancelar="Cancelar"
        alConfirmar={alConfirmar}
        alCancelar={alCancelar}
        ocupado={ocupado}
      />
    )
    return { alConfirmar, alCancelar, elemento }
  }

  it("sin ocupado confirma, cancela y se cierra con atrás como siempre", async () => {
    const { alConfirmar, alCancelar, elemento } = dialogo()
    await render(elemento)
    expect(screen.getByRole("button", { name: "Guardar", disabled: false })).toBeTruthy()
    expect(screen.getByRole("button", { name: "Cancelar", disabled: false })).toBeTruthy()

    await fireEvent.press(screen.getByRole("button", { name: "Guardar" }))
    await fireEvent.press(screen.getByRole("button", { name: "Cancelar" }))
    // Android: el botón atrás llega al Modal como onRequestClose.
    await fireEvent(screen.root!, "requestClose")
    expect(alConfirmar).toHaveBeenCalledTimes(1)
    expect(alCancelar).toHaveBeenCalledTimes(2)
  })

  it("ocupado bloquea confirmar, cancelar y atrás, y lo anuncia", async () => {
    const { alConfirmar, alCancelar, elemento } = dialogo(true)
    await render(elemento)
    // El lector de pantalla oye ambos botones deshabilitados y confirmar ocupado.
    const confirmar = screen.getByRole("button", { name: "Guardar", disabled: true, busy: true })
    const cancelar = screen.getByRole("button", { name: "Cancelar", disabled: true })

    await fireEvent.press(confirmar)
    await fireEvent.press(cancelar)
    await fireEvent(screen.root!, "requestClose")
    expect(alConfirmar).not.toHaveBeenCalled()
    expect(alCancelar).not.toHaveBeenCalled()
  })
})
