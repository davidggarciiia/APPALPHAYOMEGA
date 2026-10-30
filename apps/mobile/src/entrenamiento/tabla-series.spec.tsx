import { useState, type ComponentProps } from "react"
import { AccessibilityInfo, Dimensions, StyleSheet } from "react-native"
import { act, fireEvent, render, screen, userEvent, within } from "@testing-library/react-native"
import {
  mantieneUnidadYCarga,
  SerieRegistradaDistanciaSchema,
  type EjercicioPrescrito,
} from "@alpha-omega/shared"
import {
  registroSinValidar,
  type EdicionRegistro,
  type EjercicioConDistancia,
  type PrescripcionConDistancia,
} from "./registro-modelo"
import { PrescripcionVisible, type ResultadoConDistancia } from "./resultado"
import { ajusteDeSerie, TablaSeries, type FocoSerie } from "./tabla-series"
import { BarraAjuste } from "../componentes/barra-ajuste"

const ventanaOriginal = Dimensions.get("window")
beforeEach(() => {
  Dimensions.set({ window: { ...ventanaOriginal, fontScale: 1 } })
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(false)
})
afterEach(() => {
  Dimensions.set({ window: ventanaOriginal })
  jest.useRealTimers()
  jest.restoreAllMocks()
})

function TablaConBarra(props: ComponentProps<typeof TablaSeries>): React.JSX.Element {
  const [foco, enfocar] = useState<FocoSerie | null>(null)
  const real = props.series.find((serie) => serie.serieId === foco?.serieId)
  const ajuste = real && foco && ajusteDeSerie(props.ejercicio, real, foco.celda)
  return (
    <>
      <TablaSeries
        {...props}
        enfocada={foco}
        enfocar={(serieId, celda) => enfocar({ serieId, celda })}
      />
      {ajuste && real && foco && (
        <BarraAjuste
          key={`${foco.serieId}:${foco.celda}`}
          {...ajuste}
          alListo={() => enfocar(null)}
          cambiar={(valor) =>
            props.cambiar(
              real.serieId,
              foco.celda === "peso"
                ? { peso: String(valor).replace(".", ",") }
                : foco.celda === "rir"
                  ? { rir: valor }
                  : { valor: String(valor) },
            )
          }
        />
      )}
    </>
  )
}

async function escribir(celda: RegExp, unidad: string, texto: string): Promise<void> {
  await fireEvent.press(screen.getByRole("button", { name: celda }))
  await fireEvent.press(screen.getByRole("button", { name: new RegExp(`^Escribir ${unidad}:`) }))
  await fireEvent.changeText(screen.getByLabelText(`Valor manual ${unidad}`), texto)
}

const id = "10000000-0000-4000-8000-000000000000"
const serieId = "20000000-0000-4000-8000-000000000000"
const ejercicio: EjercicioPrescrito = {
  id,
  ejercicioId: "30000000-0000-4000-8000-000000000000",
  nombre: "Plancha",
  indicaciones: null,
  tipoCarga: "sinCarga",
  modoRir: "desactivado",
  series: [{ id: serieId, tipoMedicion: "tiempo", segundos: 30, pesoKg: null }],
}

describe("D2 · tabla completa y barra compartida", () => {
  it.each([
    [390, 1, true],
    [360, 1, true],
    [359, 1, false],
    [360, 1.3, true],
    [360, 1.31, false],
    [320, 1, false],
    [390, 1.4, false],
  ])(
    "D14: cabecera y series caben sin partir el número a %i px y escala %s",
    async (width, fontScale, conAnterior) => {
      Dimensions.set({ window: { ...ventanaOriginal, width, fontScale } })
      const prescritas = Array.from({ length: 30 }, (_, n) => ({
        id: `${serieId}-${n}`,
        tipoMedicion: "repeticiones" as const,
        repeticiones: 8,
        pesoKg: 60,
      }))
      await render(
        <TablaSeries
          ejercicio={{
            ...ejercicio,
            tipoCarga: "conCargaExterna",
            modoRir: "cadaSerie",
            rir: { min: 2, max: 3 },
            series: prescritas,
          }}
          series={prescritas.map(({ id }) => ({
            serieId: id,
            peso: "",
            valor: "",
            hecha: false,
          }))}
          bloqueado={false}
          cambiar={jest.fn()}
          anterior={{
            valores: { tipoMedicion: "repeticiones", pesoKg: 60, repeticiones: 8 },
            series: [
              {
                numero: 30,
                valores: { tipoMedicion: "repeticiones", pesoKg: 57.5, repeticiones: 7, rir: 2 },
              },
            ],
          }}
        />,
      )
      const cabecera = screen.getByLabelText("Serie")
      expect(cabecera).toHaveTextContent("#")
      expect(cabecera).toHaveProp("numberOfLines", 1)
      expect(cabecera).toHaveStyle({ width: 22, minWidth: 22 })
      expect(Boolean(screen.queryByText("ANT."))).toBe(conAnterior)
      expect(screen.queryAllByLabelText("Anterior: —")).toHaveLength(conAnterior ? 29 : 0)
      expect(Boolean(screen.queryByLabelText("Anterior: 57,5×7, RIR 2"))).toBe(conAnterior)

      const fila = screen.getAllByTestId("fila-serie")[29]!
      const numero = within(fila).getByText("30")
      expect(numero).toHaveProp("numberOfLines", 1)
      expect(numero).toHaveStyle({ width: 22, minWidth: 22 })
      const controles = [...within(fila).getAllByRole("button"), within(fila).getByRole("checkbox")]
      for (const control of controles) {
        const estilo = StyleSheet.flatten(control.props.style)
        expect(estilo.minWidth ?? estilo.width).toBeGreaterThanOrEqual(44)
        expect(estilo.minHeight).toBeGreaterThanOrEqual(44)
      }

      const columnas = StyleSheet.flatten(cabecera.parent!.props.style)
      const estiloFila = StyleSheet.flatten(fila.props.style)
      expect(columnas.gap).toBe(estiloFila.gap)
      expect(columnas.paddingHorizontal).toBe(estiloFila.paddingHorizontal)
      const anchoMinimo = (contenedor: typeof fila): number => {
        const hijos = contenedor.children
          .filter((hijo): hijo is typeof fila => typeof hijo !== "string")
          .filter((hijo) => StyleSheet.flatten(hijo.props.style).position !== "absolute")
        return (
          hijos.reduce((ancho, hijo) => {
            const estilo = StyleSheet.flatten(hijo.props.style)
            return ancho + (estilo.minWidth ?? estilo.width)
          }, 0) +
          (hijos.length - 1) * estiloFila.gap +
          2 * estiloFila.paddingHorizontal
        )
      }
      // Jest no calcula layout: fijamos el presupuesto de la fila con los gutters de sesión.
      expect(anchoMinimo(cabecera.parent!)).toBeLessThanOrEqual(width - 40)
      expect(anchoMinimo(fila)).toBeLessThanOrEqual(width - 40)
    },
  )

  it("D10: propone carga de descarga desde anterior y conserva lo escrito", async () => {
    const calibrar: EjercicioPrescrito = {
      ...ejercicio,
      tipoCarga: "conCargaExterna",
      calibrar: true,
      subidaKg: 2.5,
    }
    const cambiar = jest.fn()
    await render(
      <TablaSeries
        ejercicio={calibrar}
        series={[{ serieId, peso: "", valor: "", hecha: false }]}
        bloqueado={false}
        cambiar={cambiar}
        factorCarga={0.875}
        anterior={{ valores: { tipoMedicion: "tiempo", segundos: 30, pesoKg: 60 } }}
      />,
    )
    expect(screen.getByText("Sugerencia · 52,5 kg (87,5 % de la anterior)")).toBeTruthy()
    expect(screen.getByRole("button", { name: "Peso — Plancha, serie 1: 52,5" })).toBeTruthy()
    await fireEvent.press(screen.getByRole("checkbox", { name: /Hecha — Plancha, serie 1/ }))
    expect(cambiar).toHaveBeenLastCalledWith(serieId, expect.objectContaining({ peso: "52,5" }))
    await screen.rerender(
      <TablaSeries
        ejercicio={calibrar}
        series={[{ serieId, peso: "45", valor: "30", hecha: false }]}
        bloqueado={false}
        cambiar={cambiar}
        factorCarga={0.875}
        anterior={{ valores: { tipoMedicion: "tiempo", segundos: 30, pesoKg: 60 } }}
      />,
    )
    await fireEvent.press(screen.getByRole("checkbox", { name: /Hecha — Plancha, serie 1/ }))
    expect(cambiar.mock.calls.at(-1)![1]).not.toHaveProperty("peso")
    expect(calibrar.series[0]!.pesoKg).toBeNull()
  })

  it("D10: sin historial explica el porcentaje; sin carga no sugiere kilos", async () => {
    const props = {
      ejercicio: { ...ejercicio, tipoCarga: "conCargaExterna" as const, calibrar: true },
      series: [{ serieId, peso: "", valor: "", hecha: false }],
      bloqueado: false,
      cambiar: jest.fn(),
      factorCarga: 0.875,
    }
    await render(<TablaSeries {...props} />)
    expect(screen.getByText("Sugerencia · 87,5 % de tu carga habitual")).toBeTruthy()
    await screen.rerender(<TablaSeries {...props} ejercicio={ejercicio} />)
    expect(screen.queryByText(/Sugerencia/)).toBeNull()
  })

  it.each([false, true])(
    "las filas aparecen en su sitio con cualquier ajuste de movimiento reducido (%s)",
    async (reducido) => {
      const movimiento = jest
        .spyOn(AccessibilityInfo, "isReduceMotionEnabled")
        .mockResolvedValue(reducido)
      try {
        await render(
          <TablaSeries
            ejercicio={ejercicio}
            series={[{ serieId, peso: "", valor: "30", hecha: false }]}
            bloqueado={false}
            cambiar={jest.fn()}
          />,
        )
        const fila = screen.getByTestId(`serie-lista-${serieId}`)
        for (const propiedad of ["entering", "exiting", "layout"])
          expect(fila.props[propiedad]).toBeUndefined()
        await screen.rerender(
          <TablaSeries
            ejercicio={ejercicio}
            series={[{ serieId, peso: "", valor: "30", hecha: false, omitida: true }]}
            bloqueado={false}
            cambiar={jest.fn()}
          />,
        )
        expect(screen.getAllByTestId("fila-serie")).toHaveLength(1)
        expect(screen.getByTestId("fila-serie")).toHaveStyle({ opacity: 0.5 })
      } finally {
        movimiento.mockRestore()
      }
    },
  )

  it("mantiene las filas en su sitio al mostrar y retirar el récord", async () => {
    const props = {
      ejercicio,
      series: [{ serieId, peso: "", valor: "30", hecha: true }],
      bloqueado: false,
      cambiar: jest.fn(),
    }
    await render(<TablaSeries {...props} />)
    expect(screen.getByTestId(`serie-lista-${serieId}`).props.layout).toBeUndefined()
    await screen.rerender(
      <TablaSeries {...props} recordPersonal={{ serieId, mejora: "+2 reps" }} />,
    )
    expect(screen.getByLabelText("Récord personal: +2 reps")).toBeOnTheScreen()
    const durante = screen.getByTestId(`serie-lista-${serieId}`)
    expect(durante.props.layout).toBeUndefined()
    expect(durante.props.entering).toBeUndefined()
    expect(durante.props.exiting).toBeUndefined()
    await screen.rerender(<TablaSeries {...props} />)
    expect(screen.queryByLabelText(/^Récord personal:/)).toBeNull()
    expect(screen.getByTestId(`serie-lista-${serieId}`).props.layout).toBeUndefined()
  })
  it.each([
    ["repeticiones", "cantidad", "reps", 8, 1, 10000],
    ["tiempo", "cantidad", "seg", 30, 1, 86400],
    ["distancia", "cantidad", "m", 20, 1, 100000],
    ["repeticiones", "peso", "kg", 20, 0, 1000],
    ["repeticiones", "rir", "rir", 2, 0, 5],
  ] as const)(
    "prepara %s/%s con sugerencia, unidad y límites del contrato",
    (tipoMedicion, celda, unidad, valor, minimo, maximo) => {
      const prescrita =
        tipoMedicion === "repeticiones"
          ? { id: serieId, tipoMedicion, repeticiones: 8, pesoKg: 20 }
          : tipoMedicion === "tiempo"
            ? { id: serieId, tipoMedicion, segundos: 30, pesoKg: 20 }
            : { id: serieId, tipoMedicion, metros: 20, pesoKg: 20 }
      expect(typeof ajusteDeSerie).toBe("function")
      expect(
        ajusteDeSerie(
          { ...ejercicio, series: [prescrita], rir: { min: 2, max: 2 }, subidaKg: 1 },
          { serieId, peso: "", valor: "", hecha: false },
          celda,
        ),
      ).toMatchObject({ unidad, valor, minimo, maximo })
    },
  )

  it("conserva el cero y la coma decimal escritos en lugar de la sugerencia", () => {
    expect(typeof ajusteDeSerie).toBe("function")
    expect(
      ajusteDeSerie(ejercicio, { serieId, peso: "0", valor: "", hecha: false }, "peso")?.valor,
    ).toBe(0)
    expect(
      ajusteDeSerie(ejercicio, { serieId, peso: "12,75", valor: "", hecha: false }, "peso")?.valor,
    ).toBe(12.75)
    expect(
      ajusteDeSerie(ejercicio, { serieId, peso: "", valor: "NaN", hecha: false }, "cantidad")
        ?.valor,
    ).toBeNull()
    expect(
      ajusteDeSerie(ejercicio, { serieId: "ajena", peso: "", valor: "", hecha: false }, "cantidad"),
    ).toBeNull()
  })

  it("muestra cada anterior por su número aunque llegue desordenado", async () => {
    const segunda = "20000000-0000-4000-8000-000000000001"
    await render(
      <TablaSeries
        ejercicio={{
          ...ejercicio,
          series: [ejercicio.series[0]!, { ...ejercicio.series[0]!, id: segunda }],
        }}
        series={[
          { serieId, peso: "", valor: "", hecha: false },
          { serieId: segunda, peso: "", valor: "", hecha: false },
        ]}
        bloqueado={false}
        cambiar={jest.fn()}
        anterior={{
          valores: { tipoMedicion: "tiempo", pesoKg: null, segundos: 30 },
          series: [
            { numero: 2, valores: { tipoMedicion: "tiempo", pesoKg: null, segundos: 20 } },
            { numero: 1, valores: { tipoMedicion: "tiempo", pesoKg: null, segundos: 25 } },
          ],
        }}
      />,
    )
    expect(screen.getAllByTestId("fila-serie")).toHaveLength(2)
    const filas = screen.getAllByTestId("fila-serie")
    expect(within(filas[0]!).getByLabelText("Anterior: 25 s")).toBeOnTheScreen()
    expect(within(filas[1]!).getByLabelText("Anterior: 20 s")).toBeOnTheScreen()
    expect(screen.queryByText(/^Anterior /)).toBeNull()
    expect(screen.queryByText("+ Serie")).toBeNull()
  })

  it("deja — en series omitidas o sin antecedente sin desplazar las siguientes", async () => {
    const prescritas = Array.from({ length: 4 }, (_, n) => ({
      ...ejercicio.series[0]!,
      id: `${serieId}-${n}`,
    }))
    await render(
      <TablaSeries
        ejercicio={{ ...ejercicio, series: prescritas }}
        series={prescritas.map(({ id }) => ({ serieId: id, peso: "", valor: "", hecha: false }))}
        bloqueado={false}
        cambiar={jest.fn()}
        anterior={{
          valores: { tipoMedicion: "tiempo", pesoKg: null, segundos: 30 },
          series: [
            { numero: 1, valores: { tipoMedicion: "tiempo", pesoKg: null, segundos: 25 } },
            { numero: 3, valores: { tipoMedicion: "tiempo", pesoKg: null, segundos: 20 } },
          ],
        }}
      />,
    )
    const filas = screen.getAllByTestId("fila-serie")
    expect(within(filas[0]!).getByLabelText("Anterior: 25 s")).toBeOnTheScreen()
    expect(within(filas[1]!).getByLabelText("Anterior: —")).toBeOnTheScreen()
    expect(within(filas[2]!).getByLabelText("Anterior: 20 s")).toBeOnTheScreen()
    expect(within(filas[3]!).getByLabelText("Anterior: —")).toBeOnTheScreen()
  })

  it.each([undefined, []])(
    "sin detalle de series (%s) no repite la mejor marca",
    async (series) => {
      await render(
        <TablaSeries
          ejercicio={ejercicio}
          series={[{ serieId, peso: "", valor: "", hecha: false }]}
          bloqueado={false}
          cambiar={jest.fn()}
          anterior={{
            valores: { tipoMedicion: "tiempo", pesoKg: null, segundos: 30 },
            ...(series && { series }),
          }}
        />,
      )
      expect(screen.getByLabelText("Anterior: —")).toBeOnTheScreen()
      expect(screen.queryByLabelText("Anterior: 30 s")).toBeNull()
    },
  )

  it("muestra kilos, repeticiones y RIR de cada serie sin usar la mejor marca", async () => {
    const prescritas: EjercicioPrescrito["series"] = [1, 2].map((numero) => ({
      id: `${serieId}-${numero}`,
      tipoMedicion: "repeticiones",
      repeticiones: 8,
      pesoKg: 60,
    }))
    await render(
      <TablaSeries
        ejercicio={{ ...ejercicio, tipoCarga: "conCargaExterna", series: prescritas }}
        series={prescritas.map(({ id }) => ({ serieId: id, peso: "", valor: "", hecha: false }))}
        bloqueado={false}
        cambiar={jest.fn()}
        anterior={{
          valores: { tipoMedicion: "repeticiones", pesoKg: 70, repeticiones: 10, rir: 3 },
          series: [
            {
              numero: 1,
              valores: { tipoMedicion: "repeticiones", pesoKg: 67.5, repeticiones: 8, rir: 0 },
            },
            {
              numero: 2,
              valores: { tipoMedicion: "repeticiones", pesoKg: 65, repeticiones: 7, rir: 5 },
            },
          ],
        }}
      />,
    )
    const filas = screen.getAllByTestId("fila-serie")
    expect(within(filas[0]!).getByLabelText("Anterior: 67,5×8, RIR 0")).toHaveTextContent(
      "67,5×8 RIR 0",
    )
    expect(within(filas[1]!).getByLabelText("Anterior: 65×7, RIR 5+")).toBeOnTheScreen()
    expect(screen.queryByLabelText(/Anterior: 70/)).toBeNull()
  })

  it("delegar foco abre una sola barra común sin teclado ni TextInput en la tabla", async () => {
    const enfocar = jest.fn()
    await render(
      <TablaSeries
        ejercicio={ejercicio}
        series={[{ serieId, peso: "", valor: "", hecha: false }]}
        bloqueado={false}
        cambiar={jest.fn()}
        enfocar={enfocar}
        enfocada={{ serieId, celda: "cantidad" }}
      />,
    )
    const celda = screen.getByRole("button", { name: "Segundos — Plancha, serie 1: 30" })
    expect(celda).toHaveProp("accessibilityState", { disabled: false, selected: true })
    await fireEvent.press(celda)
    expect(enfocar).toHaveBeenCalledWith(serieId, "cantidad")
    expect(screen.queryByTestId("barra-ajuste")).toBeNull()
    expect(screen.queryByLabelText(/Valor manual/)).toBeNull()
  })

  it("técnica y molestia son iconos con objetivos de 44 px", async () => {
    const verTecnica = jest.fn()
    const verMolestia = jest.fn()
    await render(
      <TablaSeries
        ejercicio={ejercicio}
        series={[]}
        bloqueado={false}
        cambiar={jest.fn()}
        verTecnica={verTecnica}
        verMolestia={verMolestia}
      />,
    )
    const tecnica = screen.getByRole("button", { name: "Ver técnica — Plancha" })
    const molestia = screen.getByRole("button", { name: "Tengo una molestia — Plancha" })
    expect(tecnica).toHaveStyle({ width: 44, minHeight: 44 })
    expect(molestia).toHaveStyle({ width: 44, minHeight: 44 })
    expect(screen.queryByText("Ver técnica")).toBeNull()
    await fireEvent.press(tecnica)
    await fireEvent.press(molestia)
    expect(verTecnica).toHaveBeenCalledTimes(1)
    expect(verMolestia).toHaveBeenCalledTimes(1)
  })

  it("omitir con 500 ms publica un deshacer que restaura el estado", async () => {
    jest.useFakeTimers()
    const cambiar = jest.fn()
    const avisarDeshacer = jest.fn()
    const real = { serieId, peso: "", valor: "28", hecha: false, rir: 2 }
    await render(
      <TablaSeries
        ejercicio={ejercicio}
        series={[real]}
        bloqueado={false}
        cambiar={cambiar}
        avisarDeshacer={avisarDeshacer}
      />,
    )
    const check = screen.getByRole("checkbox", { name: "Hecha — Plancha, serie 1" })
    await userEvent.setup().longPress(check, { duration: 500 })
    expect(cambiar).toHaveBeenLastCalledWith(serieId, { hecha: false, omitida: true })
    const aviso = avisarDeshacer.mock.calls[0]![0]
    expect(aviso.mensaje).toBe("Serie omitida")
    aviso.deshacer()
    expect(cambiar).toHaveBeenLastCalledWith(serieId, { hecha: false, omitida: undefined })
  })

  it("recupera la serie omitida tocando una celda o mediante la acción accesible", async () => {
    const cambiar = jest.fn()
    await render(
      <TablaSeries
        ejercicio={ejercicio}
        series={[{ serieId, peso: "", valor: "28", hecha: false, omitida: true }]}
        bloqueado={false}
        cambiar={cambiar}
      />,
    )
    await fireEvent.press(screen.getByRole("button", { name: "Segundos — Plancha, serie 1: 28" }))
    expect(cambiar).toHaveBeenLastCalledWith(serieId, { hecha: false, omitida: undefined })
    await fireEvent(screen.getByRole("checkbox", { name: /Hecha —/ }), "accessibilityAction", {
      nativeEvent: { actionName: "recuperar" },
    })
    expect(cambiar).toHaveBeenCalledTimes(2)
  })

  it("muestra la validación bajo la tabla sin cambiar las series", async () => {
    const cambiar = jest.fn()
    await render(
      <TablaSeries
        ejercicio={ejercicio}
        series={[{ serieId, peso: "", valor: "", hecha: false }]}
        bloqueado={false}
        cambiar={cambiar}
        error="Falta el peso"
        intentoError={1}
      />,
    )
    expect(screen.getByRole("alert", { name: "Falta el peso" })).toBeOnTheScreen()
    expect(cambiar).not.toHaveBeenCalled()
  })

  it("no ofrece deshacer una serie que la validación del padre rechaza", async () => {
    const avisarDeshacer = jest.fn()
    await render(
      <TablaSeries
        ejercicio={ejercicio}
        series={[{ serieId, peso: "", valor: "", hecha: false }]}
        bloqueado={false}
        cambiar={() => false}
        avisarDeshacer={avisarDeshacer}
      />,
    )
    await fireEvent.press(screen.getByRole("checkbox", { name: /Hecha —/ }))
    expect(avisarDeshacer).not.toHaveBeenCalled()
  })

  it("Deshacer retira el RIR final directamente y mantiene la serie visible", async () => {
    const avisarDeshacer = jest.fn()
    function Controlada(): React.JSX.Element {
      const [series, actualizar] = useState([{ serieId, peso: "", valor: "30", hecha: false }])
      return (
        <TablaSeries
          ejercicio={{ ...ejercicio, modoRir: "alFinalizarEjercicio", rir: { min: 2, max: 2 } }}
          series={series}
          bloqueado={false}
          cambiar={(id, cambio) =>
            actualizar((actuales) =>
              actuales.map((serie) => (serie.serieId === id ? { ...serie, ...cambio } : serie)),
            )
          }
          avisarDeshacer={avisarDeshacer}
        />
      )
    }
    await render(<Controlada />)
    await fireEvent.press(screen.getByRole("checkbox", { name: /Hecha —/ }))
    expect(screen.getByText("RIR del ejercicio")).toBeOnTheScreen()
    const final = screen.getByTestId("rir-final-lista")
    expect(final.props.entering).toBeUndefined()
    expect(final.props.exiting).toBeUndefined()
    expect(final.props.layout).toBeUndefined()
    await act(() => avisarDeshacer.mock.calls[0]![0].deshacer())
    expect(screen.queryByText("RIR del ejercicio")).toBeNull()
    expect(screen.getAllByTestId("fila-serie")).toHaveLength(1)
    expect(screen.getByRole("checkbox", { name: /Hecha —/ })).not.toBeChecked()
  })

  it.each(["marcar", "omitir"] as const)(
    "deshacer %s conserva las cifras corregidas después",
    async (operacion) => {
      let reales: EdicionRegistro["series"] = [
        { serieId, peso: "", valor: "30", hecha: false, rir: 2 },
      ]
      const avisarDeshacer = jest.fn()
      function Controlada(): React.JSX.Element {
        const [actuales, actualizar] = useState(reales)
        return (
          <TablaConBarra
            ejercicio={ejercicio}
            series={actuales}
            bloqueado={false}
            avisarDeshacer={avisarDeshacer}
            cambiar={(id, cambio) => {
              reales = reales.map((serie) =>
                serie.serieId === id ? { ...serie, ...cambio } : serie,
              )
              actualizar(reales)
            }}
          />
        )
      }
      await render(<Controlada />)
      const check = screen.getByRole("checkbox", { name: /Hecha —/ })
      if (operacion === "marcar") await fireEvent.press(check)
      else {
        await fireEvent(check, "longPress")
        await fireEvent.press(screen.getByRole("button", { name: /^Segundos —/ }))
      }
      const aviso = avisarDeshacer.mock.calls[0]![0]
      await escribir(/^Segundos —/, "SEG", "45")
      expect(reales[0]?.valor).toBe("45")
      await act(() => aviso.deshacer())
      expect(reales[0]).toEqual(
        expect.objectContaining({ valor: "45", hecha: false, omitida: undefined, rir: 2 }),
      )
    },
  )
})

it("avisa si falta una serie en la copia y mantiene las otras disponibles", async () => {
  const segunda = "20000000-0000-4000-8000-000000000001"
  const cambiar = jest.fn()
  await render(
    <TablaConBarra
      ejercicio={{
        ...ejercicio,
        series: [
          ejercicio.series[0]!,
          { id: segunda, tipoMedicion: "tiempo", segundos: 45, pesoKg: null },
        ],
      }}
      series={[{ serieId: segunda, peso: "", valor: "", hecha: false }]}
      bloqueado={false}
      cambiar={cambiar}
      enCurso={serieId}
    />,
  )
  expect(screen.getByText("Serie 1: registro no disponible en esta copia.")).toBeOnTheScreen()
  expect(screen.queryByLabelText("Segundos — Plancha, serie 1")).toBeNull()
  expect(screen.queryByRole("checkbox", { name: "Hecha — Plancha, serie 1" })).toBeNull()
  expect(screen.queryByRole("button", { name: "Omitir serie 1 — Plancha" })).toBeNull()
  await escribir(/^Segundos — Plancha, serie 2:/, "SEG", "40")
  expect(cambiar).toHaveBeenLastCalledWith(segunda, { valor: "40" })
  await fireEvent.press(screen.getByRole("checkbox", { name: "Hecha — Plancha, serie 2" }))
  expect(cambiar).toHaveBeenLastCalledWith(
    segunda,
    expect.objectContaining({ hecha: true, valor: "45" }),
  )
})

it("el ejercicio sin carga y por tiempo muestra segundos, omitir y una marca de un toque", async () => {
  const cambiar = jest.fn()
  await render(
    <TablaConBarra
      ejercicio={ejercicio}
      series={[{ serieId, peso: "", valor: "", hecha: false }]}
      bloqueado={false}
      cambiar={cambiar}
      enCurso={serieId}
    />,
  )
  expect(screen.queryByLabelText(/Peso —/)).toBeNull()
  expect(screen.getByLabelText(/Segundos —/)).toBeTruthy()
  expect(screen.queryByText("¿Cuántas te quedaban?")).toBeNull()
  await fireEvent.press(screen.getByRole("checkbox", { name: /Hecha —/ }))
  expect(cambiar).toHaveBeenCalledWith(
    serieId,
    expect.objectContaining({ hecha: true, valor: "30" }),
  )
  await fireEvent(screen.getByRole("checkbox", { name: /Hecha —/ }), "longPress")
  expect(cambiar).toHaveBeenCalledWith(serieId, { hecha: false, omitida: true })
})

it("RIR se pide en cada serie solo cuando el entrenador lo configuró", async () => {
  const conRir = {
    ...ejercicio,
    modoRir: "cadaSerie" as const,
    tipoCarga: "conCargaExterna" as const,
    series: [{ id: serieId, tipoMedicion: "repeticiones" as const, repeticiones: 8, pesoKg: 20 }],
  }
  await render(
    <TablaConBarra
      ejercicio={conRir}
      series={[{ serieId, peso: "", valor: "", hecha: false }]}
      bloqueado={false}
      cambiar={jest.fn()}
      enCurso={serieId}
    />,
  )
  expect(screen.getByLabelText(/Peso —/)).toBeTruthy()
  await fireEvent.press(screen.getByRole("button", { name: /RIR — Plancha, serie 1:/ }))
  expect(screen.getByLabelText("Repeticiones en reserva")).toBeOnTheScreen()
})

it("una serie hecha permite corregir el RIR o dejarlo sin anotar sin tocar lo demás", async () => {
  const segunda = "20000000-0000-4000-8000-000000000001"
  const conRir = {
    ...ejercicio,
    modoRir: "cadaSerie" as const,
    tipoCarga: "conCargaExterna" as const,
    rir: { min: 2, max: 2 },
    series: [
      { id: serieId, tipoMedicion: "repeticiones" as const, repeticiones: 8, pesoKg: 20 },
      { id: segunda, tipoMedicion: "repeticiones" as const, repeticiones: 8, pesoKg: 20 },
    ],
  }
  const cambiar = jest.fn()
  await render(
    <TablaConBarra
      ejercicio={conRir}
      series={[
        { serieId, peso: "20", valor: "8", hecha: true, rir: 1 },
        { serieId: segunda, peso: "", valor: "", hecha: false },
      ]}
      bloqueado={false}
      cambiar={cambiar}
      enCurso={segunda}
    />,
  )
  expect(screen.queryByLabelText("Repeticiones que te quedaban, serie 1")).toBeNull()

  await fireEvent.press(screen.getByRole("button", { name: /RIR — Plancha, serie 1: 1/ }))
  const pregunta = screen.getByLabelText("Repeticiones en reserva")
  await fireEvent.press(within(pregunta).getByRole("radio", { name: "RIR 3" }))
  expect(cambiar).toHaveBeenLastCalledWith(serieId, { rir: 3 })
  await fireEvent.press(screen.getByRole("button", { name: "Listo" }))
  expect(screen.queryByLabelText("Repeticiones en reserva")).toBeNull()

  await fireEvent.press(screen.getByRole("button", { name: /RIR — Plancha, serie 1: 1/ }))
  await fireEvent.press(screen.getByRole("button", { name: "Sin anotar el RIR de la serie 1" }))
  expect(cambiar).toHaveBeenLastCalledWith(serieId, { rir: null })
})

it("con el registro bloqueado el RIR de una serie hecha no se puede corregir", async () => {
  const conRir = {
    ...ejercicio,
    modoRir: "cadaSerie" as const,
    series: [{ id: serieId, tipoMedicion: "repeticiones" as const, repeticiones: 8, pesoKg: null }],
  }
  await render(
    <TablaConBarra
      ejercicio={conRir}
      series={[{ serieId, peso: "", valor: "8", hecha: true, rir: 2 }]}
      bloqueado
      cambiar={jest.fn()}
    />,
  )
  const rir = screen.getByLabelText(/RIR — Plancha, serie 1: 2/)
  expect(rir).toBeDisabled()
  await fireEvent.press(rir)
  expect(screen.queryByLabelText("Repeticiones en reserva")).toBeNull()
})

it("pregunta el RIR opcional al resolver el ejercicio completo", async () => {
  const cambiar = jest.fn()
  await render(
    <TablaConBarra
      ejercicio={{ ...ejercicio, modoRir: "alFinalizarEjercicio", rir: { min: 2, max: 2 } }}
      series={[{ serieId, peso: "", valor: "30", hecha: true }]}
      bloqueado={false}
      cambiar={cambiar}
    />,
  )
  expect(screen.getByText("RIR del ejercicio")).toBeOnTheScreen()
  await fireEvent.press(screen.getByRole("radio", { name: "RIR 2, objetivo" }))
  expect(cambiar).toHaveBeenCalledWith(serieId, { rir: 2 })
})

describe("Distancia en metros (D01, aún sin publicar)", () => {
  const u = (n: number): string => `60000000-0000-4000-8000-${String(n).padStart(12, "0")}`
  const transporte: EjercicioConDistancia = {
    id: u(1),
    ejercicioId: u(101),
    nombre: "Paseo del granjero",
    indicaciones: null,
    tipoCarga: "conCargaExterna",
    modoRir: "desactivado",
    series: [
      { id: u(11), tipoMedicion: "distancia", pesoKg: 32, metros: 20 },
      { id: u(12), tipoMedicion: "distancia", pesoKg: 32, metros: 20 },
    ],
  }
  const zancadas: EjercicioConDistancia = {
    id: u(2),
    ejercicioId: u(102),
    nombre: "Zancadas caminando",
    indicaciones: null,
    tipoCarga: "sinCarga",
    modoRir: "desactivado",
    series: [{ id: u(21), tipoMedicion: "distancia", pesoKg: null, metros: 30 }],
  }
  const vacias = (e: EjercicioConDistancia): EdicionRegistro["series"] =>
    e.series.map((s) => ({ serieId: s.id, peso: "", valor: "", hecha: false }))

  it("con carga pide kg y metros, sugiere lo pautado y marca en metros", async () => {
    const cambiar = jest.fn()
    await render(
      <TablaConBarra
        ejercicio={transporte}
        series={vacias(transporte)}
        bloqueado={false}
        cambiar={cambiar}
        enCurso={u(11)}
        anterior={{
          valores: { tipoMedicion: "distancia", pesoKg: 30, metros: 18 },
          series: [
            { numero: 1, valores: { tipoMedicion: "distancia", pesoKg: 30, metros: 18, rir: 2 } },
            { numero: 2, valores: { tipoMedicion: "distancia", pesoKg: 28, metros: 16 } },
          ],
        }}
      />,
    )
    expect(screen.getByText("2 × 20 m")).toBeOnTheScreen()
    expect(screen.getByText("KG")).toBeOnTheScreen()
    expect(screen.getByText("M")).toBeOnTheScreen()
    expect(screen.getByLabelText("Anterior: 30×18 m, RIR 2")).toBeOnTheScreen()
    expect(screen.getByLabelText("Anterior: 28×16 m")).toBeOnTheScreen()
    const metros = screen.getByLabelText("Metros — Paseo del granjero, serie 1: 20")
    expect(metros).toHaveProp("accessibilityHint", "Abre la barra de ajuste; sugerencia 20")
    expect(screen.getByLabelText("Peso — Paseo del granjero, serie 1: 32")).toBeOnTheScreen()
    expect(screen.queryByLabelText(/Repeticiones —|Segundos —/)).toBeNull()

    await escribir(/^Metros — Paseo del granjero, serie 1:/, "M", "25")
    expect(cambiar).toHaveBeenLastCalledWith(u(11), { valor: "25" })
    // Con el campo aún vacío (las series no cambian aquí), «Hecha» toma lo pautado.
    await fireEvent.press(
      screen.getByRole("checkbox", { name: "Hecha — Paseo del granjero, serie 1" }),
    )
    expect(cambiar).toHaveBeenLastCalledWith(u(11), {
      hecha: true,
      omitida: undefined,
      valor: "20",
      peso: "32",
    })
  })

  it("sin carga no pide kg; marcar y omitir conservan los metros", async () => {
    const cambiar = jest.fn()
    await render(
      <TablaConBarra
        ejercicio={zancadas}
        series={vacias(zancadas)}
        bloqueado={false}
        cambiar={cambiar}
        enCurso={u(21)}
        anterior={{
          valores: { tipoMedicion: "distancia", pesoKg: null, metros: 30 },
          series: [{ numero: 1, valores: { tipoMedicion: "distancia", pesoKg: null, metros: 30 } }],
        }}
      />,
    )
    expect(screen.queryByLabelText(/Peso —/)).toBeNull()
    expect(screen.queryByText("KG")).toBeNull()
    expect(screen.getByLabelText("Anterior: 30 m")).toBeOnTheScreen()
    expect(screen.getByLabelText("Metros — Zancadas caminando, serie 1: 30")).toHaveProp(
      "accessibilityHint",
      "Abre la barra de ajuste; sugerencia 30",
    )
    await fireEvent.press(screen.getByRole("checkbox", { name: /Hecha —/ }))
    expect(cambiar).toHaveBeenLastCalledWith(u(21), {
      hecha: true,
      omitida: undefined,
      valor: "30",
    })
    await fireEvent(screen.getByRole("checkbox", { name: /Hecha —/ }), "longPress")
    expect(cambiar).toHaveBeenLastCalledWith(u(21), { hecha: false, omitida: true })
  })

  it("un valor no válido no pasa; corregido, queda en metros sin repeticiones", async () => {
    const prescripcion: PrescripcionConDistancia = {
      nombre: "Transportes",
      ejercicios: [transporte],
    }
    // Una copia local antigua también debe superar la validación actual.
    let series = vacias(transporte).map((serie, n) =>
      n === 0 ? { ...serie, valor: "20,5" } : serie,
    )
    function Tabla(): React.JSX.Element {
      const [actuales, setActuales] = useState(series)
      return (
        <TablaConBarra
          ejercicio={transporte}
          series={actuales}
          bloqueado={false}
          enCurso={u(11)}
          cambiar={(id, cambio) => {
            series = series.map((s) => (s.serieId === id ? { ...s, ...cambio } : s))
            setActuales(series)
          }}
        />
      )
    }
    const primera = (): { serie: unknown; valida: boolean } => {
      const serie = registroSinValidar(prescripcion, { notas: "", series }).series[0]!
      return {
        serie,
        valida:
          SerieRegistradaDistanciaSchema.safeParse(serie).success &&
          mantieneUnidadYCarga(serie, transporte.series[0]!, transporte.tipoCarga),
      }
    }
    await render(<Tabla />)
    const hecha = (): ReturnType<typeof screen.getByRole> =>
      screen.getByRole("checkbox", { name: "Hecha — Paseo del granjero, serie 1" })

    // Los metros son enteros, igual que repeticiones y segundos.
    await fireEvent.press(hecha())
    expect(primera().valida).toBe(false)
    await escribir(/^Metros — Paseo del granjero, serie 1:/, "M", "20,5")
    expect(screen.getByRole("button", { name: "Listo" })).toBeDisabled()
    expect(series[0]?.valor).toBe("20,5")
    await fireEvent.changeText(screen.getByLabelText("Valor manual M"), "18")
    expect(primera()).toEqual({
      serie: { serieId: u(11), tipoMedicion: "distancia", pesoKg: 32, metros: 18, hecha: true },
      valida: true,
    })

    // Desmarcar no borra lo escrito ni lo pasa a otra unidad.
    await fireEvent.press(hecha())
    expect(series[0]).toEqual({ serieId: u(11), peso: "32", valor: "18", hecha: false })
    expect(registroSinValidar(prescripcion, { notas: "", series }).series[0]).toEqual({
      serieId: u(11),
      tipoMedicion: "distancia",
      pesoKg: 32,
      metros: 18,
      hecha: false,
    })
  })

  it("las series existentes conservan su presentación y la cabecera nombra cada unidad", async () => {
    const remo: EjercicioPrescrito = {
      ...ejercicio,
      nombre: "Remo",
      tipoCarga: "conCargaExterna",
      series: [
        {
          id: u(31),
          tipoMedicion: "repeticiones",
          repeticiones: 8,
          repeticionesMax: 10,
          pesoKg: 60,
        },
        { id: u(32), tipoMedicion: "tiempo", segundos: 30, pesoKg: 60 },
      ],
    }
    const vista = await render(
      <TablaConBarra
        ejercicio={remo}
        series={[
          { serieId: u(31), peso: "", valor: "", hecha: false },
          { serieId: u(32), peso: "", valor: "", hecha: false },
        ]}
        bloqueado={false}
        cambiar={jest.fn()}
        enCurso={u(31)}
        anterior={{
          valores: { tipoMedicion: "repeticiones", pesoKg: 55, repeticiones: 6 },
          series: [
            { numero: 1, valores: { tipoMedicion: "repeticiones", pesoKg: 55, repeticiones: 6 } },
            { numero: 2, valores: { tipoMedicion: "tiempo", pesoKg: 50, segundos: 25 } },
          ],
        }}
      />,
    )
    expect(screen.getByText("REPS / S")).toBeOnTheScreen()
    expect(screen.getByLabelText("Anterior: 55×6")).toBeOnTheScreen()
    expect(screen.getByLabelText("Anterior: 50×25 s")).toBeOnTheScreen()
    expect(screen.getByLabelText("Peso — Remo, serie 1: 60")).toBeOnTheScreen()
    expect(screen.getByLabelText("Peso — Remo, serie 2: 60")).toBeOnTheScreen()
    expect(screen.getByLabelText("Repeticiones — Remo, serie 1: 8")).toHaveProp(
      "accessibilityHint",
      "Abre la barra de ajuste; sugerencia 8",
    )
    expect(screen.getByLabelText("Segundos — Remo, serie 2: 30")).toHaveProp(
      "accessibilityHint",
      "Abre la barra de ajuste; sugerencia 30",
    )

    await vista.rerender(
      <TablaConBarra
        ejercicio={{ ...remo, series: [remo.series[0]!] }}
        series={[{ serieId: u(31), peso: "", valor: "", hecha: false }]}
        bloqueado={false}
        cambiar={jest.fn()}
        anterior={{
          valores: { tipoMedicion: "repeticiones", pesoKg: null, repeticiones: 6 },
          series: [
            { numero: 1, valores: { tipoMedicion: "repeticiones", pesoKg: null, repeticiones: 6 } },
          ],
        }}
      />,
    )
    expect(screen.getByText("REPS")).toBeOnTheScreen()
    expect(screen.getByLabelText("Anterior: 6")).toBeOnTheScreen()

    await vista.rerender(
      <TablaConBarra
        ejercicio={{ ...transporte, series: [remo.series[0]!, transporte.series[0]!] }}
        series={[
          { serieId: u(31), peso: "", valor: "", hecha: false },
          { serieId: u(11), peso: "", valor: "", hecha: false },
        ]}
        bloqueado={false}
        cambiar={jest.fn()}
      />,
    )
    expect(screen.getByText("REPS / M")).toBeOnTheScreen()
    expect(screen.getByLabelText("Repeticiones — Paseo del granjero, serie 1: 8")).toBeOnTheScreen()
    expect(screen.getByLabelText("Metros — Paseo del granjero, serie 2: 20")).toBeOnTheScreen()
  })

  // resultado.tsx no tiene prueba propia: su resumen se comprueba aquí, junto a la tabla.
  it("el resumen enviado muestra objetivo y hecho en metros; el resto, igual", async () => {
    const prescripcion: PrescripcionConDistancia = {
      nombre: "Transportes",
      ejercicios: [transporte, zancadas, ejercicio],
    }
    const resultado: ResultadoConDistancia = {
      sesionId: u(90),
      prescripcion,
      revisionPrescripcion: 1,
      enviadoEn: "2026-09-24T10:00:00.000Z",
      notas: null,
      series: [
        {
          serieId: u(11),
          hecha: true,
          valores: { tipoMedicion: "distancia", pesoKg: 32, metros: 18 },
        },
        { serieId: u(12), hecha: false, omitida: true },
        {
          serieId: u(21),
          hecha: true,
          valores: { tipoMedicion: "distancia", pesoKg: null, metros: 30 },
        },
        { serieId, hecha: true, valores: { tipoMedicion: "tiempo", pesoKg: null, segundos: 30 } },
      ],
    }
    await render(<PrescripcionVisible prescripcion={prescripcion} resultado={resultado} />)
    const filas = screen.getAllByRole("text", { name: /^Serie \d+\. Hecho:/ })
    expect(filas).toHaveLength(4)
    expect(
      screen.getAllByRole("text", { name: /^Serie \d+\. Hecho: (?!Omitida|Sin hacer)/ }),
    ).toHaveLength(3)
    expect(
      screen.getByLabelText(
        "Serie 1. Hecho: 32 kg × 18 m. Objetivo: 32 kg × 20 m. RIR sin registrar",
      ),
    ).toBeOnTheScreen()
    expect(
      screen.getByLabelText("Serie 2. Hecho: Omitida. Objetivo: 32 kg × 20 m. RIR sin registrar"),
    ).toBeOnTheScreen()
    expect(
      screen.getByLabelText("Serie 1. Hecho: 30 m. Objetivo: 30 m. RIR sin registrar"),
    ).toBeOnTheScreen()
    expect(
      screen.getByLabelText("Serie 1. Hecho: 30 s. Objetivo: 30 s. RIR sin registrar"),
    ).toBeOnTheScreen()
  })
})
