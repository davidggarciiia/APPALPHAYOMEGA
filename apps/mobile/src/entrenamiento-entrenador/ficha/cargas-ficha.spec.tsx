import { render, screen, fireEvent } from "@testing-library/react-native"
import type { ListadoResultados } from "@alpha-omega/shared"
import { cargasDeFicha, CargasFicha } from "./cargas-ficha"
function sesion(
  fecha: string,
  pesoKg: number,
  repeticiones = 8,
  seccion: "principal" | "calentamiento" | "circuito" | "final" = "principal",
  ejercicioId = "press",
): ListadoResultados["resultados"][number] {
  return {
    revisadaEn: null,
    agenda: {
      id: fecha + ejercicioId,
      clienteId: "cliente",
      fechaActual: fecha,
      fechaOriginal: fecha,
      revision: 0,
      estado: "cerrada",
    },
    resultado: {
      sesionId: fecha,
      revisionPrescripcion: 0,
      enviadoEn: fecha + "T12:00:00Z",
      notas: null,
      prescripcion: {
        nombre: "Empuje",
        ejercicios: [
          {
            id: ejercicioId,
            ejercicioId,
            nombre: ejercicioId,
            seccion,
            compuesto: true,
            indicaciones: null,
            series: [{ id: "s", tipoMedicion: "repeticiones", pesoKg, repeticiones }],
          },
        ],
      },
      series: [
        {
          serieId: "s",
          hecha: true,
          valores: { tipoMedicion: "repeticiones", pesoKg, repeticiones, rir: null },
        },
      ],
    },
  }
}
// Sustituye «observa $estado usando la última semana anterior con datos» (una sola comparación).
it.each([
  { pesos: [62.5, 60], estado: "Progresa" },
  { pesos: [60, 60], estado: null },
  { pesos: [57.5, 60], estado: null },
  { pesos: [60, 60, 60], estado: "Estancado" },
  { pesos: [55, 57.5, 60], estado: "Baja" },
])(
  "observa $estado con las últimas sesiones aunque sean de la misma semana",
  ({ pesos, estado }) => {
    expect(
      cargasDeFicha(
        pesos.map((peso, i) => sesion(`2026-10-${28 - i}`, peso)),
        "2026-10-26",
      )[0],
    ).toMatchObject({ estado })
  },
)
it("conserva ejercicios aún sin hacer y excluye calentamiento, circuito y final", () => {
  const filas = cargasDeFicha(
    [
      sesion("2026-10-26", 50),
      sesion("2026-10-19", 80, 8, "principal", "sentadilla"),
      ...(["calentamiento", "circuito", "final"] as const).map((seccion) =>
        sesion("2026-10-27", 150, 8, seccion, seccion),
      ),
    ],
    "2026-10-26",
  )
  expect(filas.map((f) => f.ejercicio.ejercicioId)).toEqual(["press", "sentadilla"])
  expect(filas[1]).toMatchObject({ actual: null, estado: null })
})
// Sustituye «elige mayor Epley y omite series no hechas; sin anterior no inventa estado».
it("elige más carga aunque Epley sea menor y omite series no hechas", () => {
  const actual = sesion("2026-10-26", 50, 15),
    pesada = sesion("2026-10-27", 55, 1)
  const omitida = sesion("2026-10-28", 150)
  omitida.resultado.series = [{ serieId: "s", hecha: false, omitida: true }]
  const fila = cargasDeFicha([actual, pesada, omitida], "2026-10-26")[0]!
  expect(fila.actual).toMatchObject({ pesoKg: 55, repeticiones: 1, rir: null })
  expect(fila.estado).toBeNull()
})
it("una sesión sin marca interrumpe la racha y las futuras no alteran el estado de la ficha", () => {
  const omitida = sesion("2026-10-28", 60)
  omitida.resultado.series = [{ serieId: "s", hecha: false, omitida: true }]
  expect(
    cargasDeFicha(
      [sesion("2026-11-02", 90), omitida, sesion("2026-10-27", 60), sesion("2026-10-26", 60)],
      "2026-10-26",
    )[0]?.estado,
  ).toBeNull()
})
it("anuncia estado y diferencia, abre el ejercicio y muestra sin hacer sin insignia", async () => {
  const abrir = jest.fn()
  await render(
    <CargasFicha
      resultados={[
        sesion("2026-10-26", 62.5),
        sesion("2026-10-19", 60),
        sesion("2026-10-19", 80, 8, "principal", "sentadilla"),
      ]}
      lunes="2026-10-26"
      abrir={abrir}
    />,
  )
  expect(screen.getByRole("button", { name: /press.*Progresa.*2,5/ })).toBeOnTheScreen()
  expect(screen.getByText("Sin hacer · antes 80 × 8")).toBeOnTheScreen()
  await fireEvent.press(screen.getByRole("button", { name: /^press/ }))
  expect(abrir).toHaveBeenCalledWith("press")
})
it("la prescripción actual sin etiquetas usa el primer principal aunque el historial marcara compuestos", () => {
  const actual = sesion("2026-10-26", 60, 8, "principal", "nuevo")
  actual.resultado.prescripcion.ejercicios[0]!.compuesto = false
  const antigua = sesion("2026-10-19", 80, 8, "principal", "viejo")
  expect(cargasDeFicha([actual, antigua], "2026-10-26")[0]!.ejercicio.ejercicioId).toBe("nuevo")
})
it("deduplica conservando el nombre y prescripción actuales", () => {
  const actual = sesion("2026-10-26", 60),
    antigua = sesion("2026-10-19", 50)
  actual.resultado.prescripcion.ejercicios[0]!.nombre = "Press actual"
  antigua.resultado.prescripcion.ejercicios[0]!.nombre = "Nombre antiguo"
  expect(cargasDeFicha([actual, antigua], "2026-10-26")[0]!.ejercicio.nombre).toBe("Press actual")
})
