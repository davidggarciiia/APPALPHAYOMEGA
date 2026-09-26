import { fireEvent, render, screen } from "@testing-library/react-native"
import type { SeriePrescrita } from "@alpha-omega/shared"

import type { EntradaSerie } from "./copia-local"
import { FilaSerie } from "./fila-serie"
import { ENTRADA_VACIA } from "./valores"

const conCarga: SeriePrescrita = {
  id: "11111111-1111-4111-8111-111111111111",
  tipoMedicion: "repeticiones",
  pesoKg: 40,
  repeticiones: 10,
}
const porTiempo: SeriePrescrita = {
  id: "22222222-2222-4222-8222-222222222222",
  tipoMedicion: "tiempo",
  pesoKg: null,
  segundos: 45,
}

async function pintar(serie: SeriePrescrita, entrada: EntradaSerie) {
  const alCambiar = jest.fn()
  await render(
    <FilaSerie numero={1} serie={serie} entrada={entrada} editable alCambiar={alCambiar} />,
  )
  return alCambiar
}

describe("Fila de una serie", () => {
  it("enseña el objetivo como guía tenue, no como valor, con etiquetas y unidades", async () => {
    await pintar(conCarga, ENTRADA_VACIA)
    const peso = screen.getByLabelText("Peso en kilos de la serie 1, objetivo 40 kilos")
    const reps = screen.getByLabelText("Repeticiones de la serie 1, objetivo 10 repeticiones")
    expect(peso.props.value).toBe("")
    expect(peso.props.placeholder).toBe("40")
    expect(reps.props.value).toBe("")
    expect(reps.props.placeholder).toBe("10")
  })

  it("marcar sin escribir nada avisa y no registra el objetivo", async () => {
    const alCambiar = await pintar(conCarga, ENTRADA_VACIA)
    await fireEvent.press(screen.getByRole("checkbox"))
    expect(alCambiar).not.toHaveBeenCalled()
    expect(screen.getByRole("alert")).toHaveTextContent("Escribe las repeticiones que has hecho")
  })

  it("con carga prescrita exige el peso", async () => {
    const alCambiar = await pintar(conCarga, { peso: "", valor: "8", hecha: false })
    await fireEvent.press(screen.getByRole("checkbox"))
    expect(alCambiar).not.toHaveBeenCalled()
    expect(screen.getByRole("alert")).toHaveTextContent(/peso/)
  })

  it("un peso de cero es un valor válido", async () => {
    const alCambiar = await pintar(conCarga, { peso: "0", valor: "8", hecha: false })
    await fireEvent.press(screen.getByRole("checkbox"))
    expect(alCambiar).toHaveBeenCalledWith({ peso: "0", valor: "8", hecha: true })
  })

  it("una serie por tiempo sin carga se completa sin inventar un peso", async () => {
    const alCambiar = await pintar(porTiempo, { peso: "", valor: "50", hecha: false })
    expect(screen.getByLabelText("Peso en kilos de la serie 1, opcional")).toBeTruthy()
    expect(
      screen.getByLabelText("Tiempo en segundos de la serie 1, objetivo 45 segundos"),
    ).toBeTruthy()
    await fireEvent.press(screen.getByRole("checkbox"))
    expect(alCambiar).toHaveBeenCalledWith({ peso: "", valor: "50", hecha: true })
  })

  it("desmarcar conserva los valores escritos", async () => {
    const alCambiar = await pintar(conCarga, { peso: "42,5", valor: "8", hecha: true })
    await fireEvent.press(screen.getByRole("checkbox"))
    expect(alCambiar).toHaveBeenCalledWith({ peso: "42,5", valor: "8", hecha: false })
  })

  it("un peso mal escrito se señala en el campo", async () => {
    await pintar(conCarga, { peso: "4,2,1", valor: "8", hecha: false })
    expect(screen.getByRole("alert")).toHaveTextContent(/peso en kg/)
  })
})
