import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native"
import type { RegistrarMolestia } from "@alpha-omega/shared"
import { ErrorDeRed } from "../../lib/http"
import { RegistrarMolestiaPantalla } from "./molestia"

jest.mock("../../componentes/iconos", () => ({ Icono: () => null }))

const operacionId = "10000000-0000-4000-8000-000000000001"
const lugar = {
  ejercicioPrescritoId: "20000000-0000-4000-8000-000000000001",
  ejercicio: "Press",
  serie: 1,
}

async function preparar(avisar: (datos: RegistrarMolestia) => Promise<unknown>) {
  const volver = jest.fn()
  const vista = await render(
    <RegistrarMolestiaPantalla
      lugar={lugar}
      reloj={null}
      uuid={() => operacionId}
      avisar={avisar}
      volver={volver}
    />,
  )
  await fireEvent.press(screen.getByRole("radio", { name: "Hombro" }))
  await fireEvent(
    screen.getByRole("adjustable", { name: "Intensidad de la molestia" }),
    "accessibilityAction",
    { nativeEvent: { actionName: "increment" } },
  )
  return { volver, vista }
}

it("con una respuesta lenta congela lo que se envió y evita un segundo POST", async () => {
  let resolver!: () => void
  const espera = new Promise<void>((resolve) => {
    resolver = resolve
  })
  const avisar = jest.fn(async (_datos: RegistrarMolestia) => espera)
  await preparar(avisar)
  await fireEvent.press(screen.getByRole("button", { name: "Avisar a tu entrenador" }))
  expect(screen.queryAllByRole("radio")).toHaveLength(0)
  expect(screen.queryAllByRole("checkbox")).toHaveLength(0)
  expect(screen.queryByRole("adjustable")).toBeNull()
  expect(screen.getByText("Hombro · 1 de 10")).toBeTruthy()
  await fireEvent.press(screen.getByRole("button", { name: "Reintentar el mismo aviso" }))
  expect(avisar).toHaveBeenCalledTimes(1)
  await act(async () => {
    resolver()
    await espera
  })
  expect(await screen.findByText(/Aviso enviado/)).toBeTruthy()
})

it("tras perder la respuesta del POST reintenta el contenido original con el mismo UUID", async () => {
  const recibidos: RegistrarMolestia[] = []
  const avisar = jest.fn(async (datos: RegistrarMolestia) => {
    recibidos.push(JSON.parse(JSON.stringify(datos)) as RegistrarMolestia)
    if (recibidos.length === 1) throw new ErrorDeRed("Respuesta perdida después del commit")
    return {}
  })
  const { volver, vista } = await preparar(avisar)
  await fireEvent.press(screen.getByRole("button", { name: "Avisar a tu entrenador" }))
  const reintentar = await screen.findByRole("button", { name: "Reintentar el mismo aviso" })
  await vista.rerender(
    <RegistrarMolestiaPantalla
      lugar={{
        ejercicioPrescritoId: "30000000-0000-4000-8000-000000000001",
        ejercicio: "Remo",
        serie: 2,
      }}
      reloj={null}
      uuid={() => operacionId}
      avisar={avisar}
      volver={volver}
    />,
  )
  expect(screen.getByText("Press · serie 1")).toBeTruthy()
  expect(screen.queryByText("Remo · serie 2")).toBeNull()
  expect(screen.queryAllByRole("radio")).toHaveLength(0)
  expect(screen.queryByRole("adjustable")).toBeNull()
  expect(screen.getByText("Hombro · 1 de 10")).toBeTruthy()
  await fireEvent.press(screen.getByRole("button", { name: "Volver a la sesión" }))
  expect(await screen.findByText(/Puede que tu entrenador ya haya recibido/)).toBeTruthy()
  await fireEvent.press(screen.getByRole("button", { name: "Volver al aviso" }))
  expect(volver).not.toHaveBeenCalled()
  await fireEvent.press(reintentar)
  await waitFor(() => expect(recibidos).toHaveLength(2))
  expect(recibidos[1]).toEqual(recibidos[0])
  expect(recibidos[0]).toMatchObject({ operacionId, zona: "hombro", intensidad: 1 })
  expect(await screen.findByText(/Aviso enviado/)).toBeTruthy()
})
