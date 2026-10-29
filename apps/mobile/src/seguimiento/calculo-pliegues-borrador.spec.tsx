import { fireEvent, render, screen, waitFor } from "@testing-library/react-native"
import type { DefinicionCorporal, ValoracionProfesional } from "@alpha-omega/shared"

import { BorradorValoracion } from "./borrador-valoracion"

jest.mock("../componentes/iconos", () => ({ Icono: () => null }))

const definiciones: DefinicionCorporal[] = ["Pectoral", "Abdominal", "Muslo anterior"].map(
  (nombre, n) => ({
    id: `40000000-0000-4000-8000-00000000000${n + 1}`,
    version: 1,
    bloque: "pliegues",
    magnitud: "pliegue",
    nombre,
    unidad: "mm",
    zona: null,
    lateralidad: null,
    instrumento: null,
    protocolo: null,
    activa: true,
  }),
)
const valoracion: ValoracionProfesional = {
  id: "20000000-0000-4000-8000-000000000000",
  clienteId: "10000000-0000-4000-8000-000000000000",
  tipo: "inicial",
  anteriorId: null,
  estado: "borrador",
  creadaEn: "2026-09-24T08:00:00.000Z",
  publicacion: null,
  documentoVigente: null,
  borrador: {
    id: "50000000-0000-4000-8000-000000000000",
    revision: 1,
    fechaToma: "2026-09-24",
    corrigePublicacionId: null,
    creadoEn: "2026-09-24T08:00:00.000Z",
    actualizadoEn: "2026-09-24T08:00:00.000Z",
    documento: {
      definiciones: { corporales: definiciones, pruebas: [] },
      bloques: ["pliegues"],
      corporales: definiciones.map((d) => ({
        definicionId: d.id,
        estado: "registrado",
        valor: 36,
      })),
      pruebas: [],
      grasaPorPliegues: null,
      destacados: [],
      conclusion: null,
      notasInternas: null,
    },
  },
}

it("guarda el cálculo adoptado y su corrección con fecha y método en el contrato existente", async () => {
  const cambiar = jest.fn(async () => valoracion)
  await render(
    <BorradorValoracion
      valoracion={valoracion}
      fechaNacimiento="2004-10-10"
      referencias={[]}
      cambiar={cambiar}
      recargar={async () => valoracion}
      publicar={jest.fn()}
      nuevoId={() => "30000000-0000-4000-8000-000000000000"}
      publicada={jest.fn()}
      volver={jest.fn()}
    />,
  )
  await fireEvent.press(screen.getByRole("radio", { name: "Jackson-Pollock 3 pliegues" }))
  expect(screen.getByLabelText("Edad en la toma (años)")).toHaveProp("value", "21")
  await fireEvent.press(screen.getByRole("radio", { name: "Hombre" }))
  await fireEvent.press(screen.getByRole("button", { name: "Usar 29,02 %" }))
  await fireEvent.changeText(screen.getByLabelText("Porcentaje de grasa (%)"), "29,1")
  await fireEvent.press(screen.getByRole("button", { name: "Guardar" }))
  await waitFor(() =>
    expect(cambiar).toHaveBeenCalledWith(
      expect.objectContaining({
        fechaToma: "2026-09-24",
        contenido: expect.objectContaining({
          grasaPorPliegues: {
            valorPct: 29.1,
            metodo: "Jackson-Pollock 3 · Siri",
            fecha: "2026-09-24",
          },
        }),
      }),
    ),
  )
})
