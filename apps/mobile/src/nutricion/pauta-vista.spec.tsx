import { render, screen } from "@testing-library/react-native"
import { DocumentoDietaSchema, type BorradorDieta } from "@alpha-omega/shared"
import { PautaNutricion } from "./pauta"

it.each([
  ["2 g al día", "Creatina monohidrato, 2 g al día"],
  [null, "Creatina monohidrato"],
])("muestra la dosis %s de creatina guardada sin inventar otra", async (dosis, etiqueta) => {
  const documento = DocumentoDietaSchema.parse({
    formato: 1,
    nombre: "Objetivo diario",
    tiposDeDia: [
      {
        id: "10000000-0000-4000-8000-000000000001",
        nombre: "Todos",
        objetivo: { kcal: 2000, hidratosG: 225, proteinaG: 125, grasaG: 67 },
        comidas: [],
      },
    ],
    semana: Array(7).fill("10000000-0000-4000-8000-000000000001"),
    indicaciones: [],
    suplementos: [{ nombre: "Creatina monohidrato", dosis }],
  })
  const base: BorradorDieta = {
    id: "10000000-0000-4000-8000-000000000002",
    clienteId: "10000000-0000-4000-8000-000000000003",
    revision: 1,
    documento,
    actualizadoEn: "2026-10-01T12:00:00.000Z",
  }
  await render(
    <PautaNutricion
      nombre="Cliente"
      base={base}
      medidas={null}
      resumen={null}
      alCambiar={() => undefined}
    />,
  )
  expect(screen.getByRole("switch", { name: etiqueta })).toBeTruthy()
})
