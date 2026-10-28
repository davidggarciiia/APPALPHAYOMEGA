import { describe, it, jest } from "@jest/globals"
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native"
import type { Ejercicio } from "@alpha-omega/shared"

import { ErrorDeRed } from "../lib/api"

import type { ApiDeCatalogo } from "./api"
import { catalogoEnMemoria, ejercicioDePrueba } from "./pruebas/catalogo-en-memoria"
import { FormularioDeEjercicio } from "./formulario-ejercicio"

const PRESS = ejercicioDePrueba("3f2b8c1e-4d5a-4f6b-8a9c-0d1e2f3a4b01", "Press de banca", "pecho", [
  "triceps",
])
const REMO = ejercicioDePrueba(
  "3f2b8c1e-4d5a-4f6b-8a9c-0d1e2f3a4b04",
  "Remo con barra",
  "espalda",
  [],
  "retirado",
)

async function pintar(api: ApiDeCatalogo, opciones: { id?: string } = {}) {
  const onGuardado = jest.fn<(ejercicio: Ejercicio) => void>()
  const onCancelar = jest.fn()
  await render(
    <FormularioDeEjercicio
      api={api}
      id={opciones.id}
      onGuardado={onGuardado}
      onCancelar={onCancelar}
    />,
  )

  return { onGuardado, onCancelar }
}

async function escribirFondos(): Promise<void> {
  await fireEvent.changeText(screen.getByLabelText("Nombre"), "Fondos en paralelas")
  await fireEvent.press(screen.getByRole("radio", { name: "Tríceps" }))
  await fireEvent.changeText(screen.getByLabelText("Instrucciones"), "Baja hasta noventa grados.")
}

describe("Alta de un ejercicio", () => {
  it("crea el ejercicio con su grupo principal, secundarios e instrucciones", async () => {
    const api = catalogoEnMemoria()
    const { onGuardado } = await pintar(api)
    await screen.findByLabelText("Nombre")

    await escribirFondos()
    await fireEvent.press(screen.getByRole("checkbox", { name: "Pecho" }))
    await fireEvent.press(screen.getByRole("button", { name: "GUARDAR" }))

    await waitFor(() => {
      expect(onGuardado).toHaveBeenCalledTimes(1)
    })
    const listado = await api.buscar({ buscar: "fondos" })
    expect(listado.ejercicios).toEqual([
      expect.objectContaining({
        nombre: "Fondos en paralelas",
        grupoPrincipal: "triceps",
        gruposSecundarios: ["pecho"],
        instrucciones: "Baja hasta noventa grados.",
        figura: null,
        video: null,
      }),
    ])
  })

  it("señala lo que falta y no crea nada", async () => {
    const api = catalogoEnMemoria()
    const { onGuardado } = await pintar(api)
    await screen.findByLabelText("Nombre")

    await fireEvent.press(screen.getByRole("button", { name: "GUARDAR" }))

    await screen.findByText("Escribe el nombre del ejercicio")
    expect(screen.getByText("Elige el grupo principal")).toBeOnTheScreen()
    expect(screen.getByText("Escribe las instrucciones")).toBeOnTheScreen()
    expect(onGuardado).not.toHaveBeenCalled()
    expect((await api.buscar({})).total).toBe(0)
  })

  it("no deja marcar como secundario el grupo principal, y lo quita si ya lo estaba", async () => {
    await pintar(catalogoEnMemoria())
    await screen.findByLabelText("Nombre")

    await fireEvent.press(screen.getByRole("checkbox", { name: "Pecho" }))
    expect(screen.getByRole("checkbox", { name: "Pecho" })).toBeChecked()

    await fireEvent.press(screen.getByRole("radio", { name: "Pecho" }))

    expect(screen.getByRole("radio", { name: "Pecho" })).toBeChecked()
    expect(screen.getByRole("checkbox", { name: "Pecho" })).not.toBeChecked()
    expect(screen.getByRole("checkbox", { name: "Pecho" })).toBeDisabled()
  })

  it("pinta el nombre repetido en su campo y conserva lo escrito", async () => {
    const api = catalogoEnMemoria([PRESS])
    const { onGuardado } = await pintar(api)
    await screen.findByLabelText("Nombre")

    await escribirFondos()
    await fireEvent.changeText(screen.getByLabelText("Nombre"), "  press   DE banca ")
    await fireEvent.press(screen.getByRole("button", { name: "GUARDAR" }))

    await screen.findByText("Ya existe un ejercicio con ese nombre")
    expect(screen.getByLabelText("Instrucciones")).toHaveDisplayValue("Baja hasta noventa grados.")
    expect(onGuardado).not.toHaveBeenCalled()
    expect((await api.buscar({})).total).toBe(1)
  })

  it("un fallo de red no pierde el formulario y se puede volver a guardar", async () => {
    const api = catalogoEnMemoria()
    const crear = api.crear
    let fallos = 1
    api.crear = (datos) =>
      fallos-- > 0 ? Promise.reject(new ErrorDeRed("sin cobertura")) : crear(datos)
    const { onGuardado } = await pintar(api)
    await screen.findByLabelText("Nombre")

    await escribirFondos()
    await fireEvent.press(screen.getByRole("button", { name: "GUARDAR" }))
    await screen.findByText(/No hemos podido conectar/)
    expect(screen.getByLabelText("Nombre")).toHaveDisplayValue("Fondos en paralelas")

    await fireEvent.press(screen.getByRole("button", { name: "GUARDAR" }))

    await waitFor(() => {
      expect(onGuardado).toHaveBeenCalledTimes(1)
    })
    expect((await api.buscar({})).total).toBe(1)
  })

  it("cancelar no guarda nada", async () => {
    const api = catalogoEnMemoria()
    const { onCancelar } = await pintar(api)
    await screen.findByLabelText("Nombre")

    await escribirFondos()
    await fireEvent.press(screen.getByRole("button", { name: "CANCELAR" }))
    expect(onCancelar).not.toHaveBeenCalled()
    expect(screen.getByDisplayValue("Fondos en paralelas")).toBeTruthy()
    await fireEvent.press(screen.getByRole("button", { name: "Salir sin guardar" }))
    expect(onCancelar).toHaveBeenCalledTimes(1)
    expect((await api.buscar({})).total).toBe(0)
  })
})

describe("Edición de un ejercicio", () => {
  it("abre el ejercicio con sus datos y guarda los cambios sobre el mismo id", async () => {
    const api = catalogoEnMemoria([PRESS])
    const { onGuardado } = await pintar(api, { id: PRESS.id })

    await waitFor(() => {
      expect(screen.getByLabelText("Nombre")).toHaveDisplayValue("Press de banca")
    })
    expect(screen.getByRole("radio", { name: "Pecho" })).toBeChecked()
    expect(screen.getByRole("checkbox", { name: "Tríceps" })).toBeChecked()

    await fireEvent.changeText(screen.getByLabelText("Nombre"), "Press de banca con barra")
    await fireEvent.press(screen.getByRole("button", { name: "GUARDAR" }))

    await waitFor(() => {
      expect(onGuardado).toHaveBeenCalledTimes(1)
    })
    const guardado = await api.leer(PRESS.id)
    expect(guardado.nombre).toBe("Press de banca con barra")
    expect(guardado.gruposSecundarios).toEqual(["triceps"])
    expect((await api.buscar({})).total).toBe(1)
  })

  it("guardar sin cambiar el nombre no choca con el propio ejercicio", async () => {
    const api = catalogoEnMemoria([PRESS])
    const { onGuardado } = await pintar(api, { id: PRESS.id })
    await waitFor(() => {
      expect(screen.getByLabelText("Nombre")).toHaveDisplayValue("Press de banca")
    })

    await fireEvent.changeText(screen.getByLabelText("Instrucciones"), "Retrae las escápulas.")
    await fireEvent.press(screen.getByRole("button", { name: "GUARDAR" }))

    await waitFor(() => {
      expect(onGuardado).toHaveBeenCalledTimes(1)
    })
    expect((await api.leer(PRESS.id)).instrucciones).toBe("Retrae las escápulas.")
  })

  it("si el ejercicio no se puede cargar lo dice y deja reintentar", async () => {
    const api = catalogoEnMemoria([PRESS])
    const leer = api.leer
    let fallos = 1
    api.leer = (id) => (fallos-- > 0 ? Promise.reject(new ErrorDeRed("sin cobertura")) : leer(id))
    await pintar(api, { id: PRESS.id })

    await screen.findByText(/No hemos podido conectar/)
    expect(screen.queryByLabelText("Nombre")).toBeNull()

    await fireEvent.press(screen.getByRole("button", { name: "REINTENTAR" }))

    await waitFor(() => {
      expect(screen.getByLabelText("Nombre")).toHaveDisplayValue("Press de banca")
    })
  })
})

describe("Retirar y reponer un ejercicio", () => {
  it("el alta no ofrece retirar lo que todavía no existe", async () => {
    await pintar(catalogoEnMemoria())
    await screen.findByLabelText("Nombre")

    expect(screen.queryByRole("button", { name: "RETIRAR" })).toBeNull()
  })

  it("retirar pide confirmación y deja el ejercicio retirado, con la salida a la vista", async () => {
    const api = catalogoEnMemoria([PRESS])
    await pintar(api, { id: PRESS.id })
    await screen.findByRole("button", { name: "RETIRAR" })

    await fireEvent.press(screen.getByRole("button", { name: "RETIRAR" }))
    expect((await api.leer(PRESS.id)).estado).toBe("publicado")
    await fireEvent.press(screen.getByRole("button", { name: "CONFIRMAR RETIRADA" }))

    await screen.findByRole("button", { name: "REPONER" })
    expect(screen.getByText(/Este ejercicio está retirado/)).toBeOnTheScreen()
    expect((await api.leer(PRESS.id)).estado).toBe("retirado")
  })

  it("cancelar la confirmación no retira nada", async () => {
    const api = catalogoEnMemoria([PRESS])
    await pintar(api, { id: PRESS.id })
    await screen.findByRole("button", { name: "RETIRAR" })

    await fireEvent.press(screen.getByRole("button", { name: "RETIRAR" }))
    await fireEvent.press(screen.getByRole("button", { name: "NO RETIRAR" }))

    expect(screen.getByRole("button", { name: "RETIRAR" })).toBeOnTheScreen()
    expect((await api.leer(PRESS.id)).estado).toBe("publicado")
  })

  it("un ejercicio retirado lo dice al abrirlo y se puede reponer", async () => {
    const api = catalogoEnMemoria([REMO])
    await pintar(api, { id: REMO.id })

    await screen.findByText(/Este ejercicio está retirado/)
    await fireEvent.press(screen.getByRole("button", { name: "REPONER" }))

    await screen.findByRole("button", { name: "RETIRAR" })
    expect(screen.queryByText(/Este ejercicio está retirado/)).toBeNull()
    expect((await api.leer(REMO.id)).estado).toBe("publicado")
  })

  it("si retirar falla lo dice y el ejercicio sigue publicado", async () => {
    const api = catalogoEnMemoria([PRESS])
    api.retirar = () => Promise.reject(new ErrorDeRed("sin cobertura"))
    await pintar(api, { id: PRESS.id })
    await screen.findByRole("button", { name: "RETIRAR" })

    await fireEvent.press(screen.getByRole("button", { name: "RETIRAR" }))
    await fireEvent.press(screen.getByRole("button", { name: "CONFIRMAR RETIRADA" }))

    await screen.findByText(/No hemos podido conectar/)
    expect(screen.getByRole("button", { name: "RETIRAR" })).toBeOnTheScreen()
    expect((await api.leer(PRESS.id)).estado).toBe("publicado")
  })

  it("editar el texto de un retirado no lo repone", async () => {
    const api = catalogoEnMemoria([REMO])
    const { onGuardado } = await pintar(api, { id: REMO.id })
    await screen.findByText(/Este ejercicio está retirado/)

    await fireEvent.changeText(screen.getByLabelText("Instrucciones"), "Espalda recta.")
    await fireEvent.press(screen.getByRole("button", { name: "GUARDAR" }))

    await waitFor(() => {
      expect(onGuardado).toHaveBeenCalledTimes(1)
    })
    expect((await api.leer(REMO.id)).estado).toBe("retirado")
  })
})
