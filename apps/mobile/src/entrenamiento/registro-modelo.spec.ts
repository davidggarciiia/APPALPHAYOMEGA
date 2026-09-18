import { desdePrescripcion, registroParaEnviar } from "./registro-modelo"
import type { Prescripcion } from "@alpha-omega/shared"

const prescripcion: Prescripcion = {
  nombre: "Fuerza",
  ejercicios: [
    {
      id: "10000000-0000-4000-8000-000000000000",
      ejercicioId: "20000000-0000-4000-8000-000000000000",
      nombre: "Remo",
      indicaciones: null,
      series: [
        {
          id: "30000000-0000-4000-8000-000000000000",
          tipoMedicion: "repeticiones",
          pesoKg: 20,
          repeticiones: 10,
        },
        {
          id: "40000000-0000-4000-8000-000000000000",
          tipoMedicion: "tiempo",
          pesoKg: null,
          segundos: 30,
        },
      ],
    },
  ],
}
it("no convierte objetivos tenues ni campos vacíos en ejecución", () => {
  const edicion = desdePrescripcion(prescripcion)
  expect(edicion.series[0]).toMatchObject({ peso: "", valor: "", hecha: false })
  const registro = registroParaEnviar(prescripcion, edicion)
  expect(registro.series[0]).toMatchObject({ pesoKg: null, repeticiones: null, hecha: false })
  edicion.series[0]!.hecha = true
  expect(() => registroParaEnviar(prescripcion, edicion)).toThrow()
})
it("acepta coma decimal y tiempo sin peso, conservando lo escrito al desmarcar", () => {
  const edicion = desdePrescripcion(prescripcion)
  Object.assign(edicion.series[0]!, { peso: "22,5", valor: "8", hecha: true })
  Object.assign(edicion.series[1]!, { valor: "40", hecha: true })
  expect(registroParaEnviar(prescripcion, edicion).series).toEqual([
    {
      serieId: edicion.series[0]!.serieId,
      tipoMedicion: "repeticiones",
      pesoKg: 22.5,
      repeticiones: 8,
      hecha: true,
    },
    {
      serieId: edicion.series[1]!.serieId,
      tipoMedicion: "tiempo",
      pesoKg: null,
      segundos: 40,
      hecha: true,
    },
  ])
  edicion.series[0]!.hecha = false
  expect(registroParaEnviar(prescripcion, edicion).series[0]).toMatchObject({
    pesoKg: 22.5,
    repeticiones: 8,
    hecha: false,
  })
})
