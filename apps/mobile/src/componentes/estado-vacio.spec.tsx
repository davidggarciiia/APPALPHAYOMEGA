import { render, screen } from "@testing-library/react-native"

import { EstadoVacio } from "./estado-vacio"

jest.mock("./iconos", () => ({ Icono: () => null }))

it("explica por qué no hay contenido: título y texto legibles por el lector de pantalla", async () => {
  await render(
    <EstadoVacio
      icono="nutricion"
      titulo="Aún sin dieta"
      texto="Tu dieta aún no está publicada. Cuando tu profesional la publique aparecerá aquí."
    />,
  )
  expect(screen.getByRole("header", { name: "Aún sin dieta" })).toBeOnTheScreen()
  expect(screen.getByText(/Tu dieta aún no está publicada/)).toBeOnTheScreen()
})
