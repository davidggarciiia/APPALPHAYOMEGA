import { Fragment, useEffect, useState } from "react"
import { StyleSheet, Text, TextInput, View } from "react-native"
import type { AjustesDeFase } from "@alpha-omega/shared"

import { Chip } from "../../componentes/piezas"
import { Enlace } from "../../entrenamiento/sesion/controles"
import { alto, radio, tema, tipo } from "../../tema"

const PREDEFINIDOS: Array<{ nombre: string; ajustes: AjustesDeFase }> = [
  {
    nombre: "Mayor estímulo",
    ajustes: { rirCompuestos: { min: 1, max: 2 }, rirAccesorios: { min: 1, max: 1 } },
  },
  {
    nombre: "Descarga",
    ajustes: {
      rirCompuestos: { min: 3, max: 4 },
      rirAccesorios: { min: 3, max: 4 },
      factorSeries: 0.5,
      factorCarga: 0.875,
    },
  },
  {
    nombre: "Vuelta",
    ajustes: { rirCompuestos: { min: 3, max: 3 }, rirAccesorios: { min: 2, max: 3 } },
  },
]

function Cifra({
  etiqueta,
  valor,
  porcentaje = false,
  cambiar,
}: {
  etiqueta: string
  valor: number | undefined
  porcentaje?: boolean
  cambiar: (valor: number | undefined) => void
}): React.JSX.Element {
  const mostrar = (n: number | undefined): string =>
    n === undefined || n < 0
      ? ""
      : String(Math.round(n * (porcentaje ? 100 : 1) * 100) / 100).replace(".", ",")
  const [texto, setTexto] = useState(() => mostrar(valor))
  useEffect(() => {
    setTexto((previo) =>
      Number(previo.replace(",", ".")) / (porcentaje ? 100 : 1) === valor ? previo : mostrar(valor),
    )
  }, [valor, porcentaje])
  return (
    <TextInput
      accessibilityLabel={etiqueta}
      value={texto}
      placeholder={porcentaje ? "100" : "—"}
      placeholderTextColor={tema.marcador}
      selectionColor={tema.acento}
      keyboardType={porcentaje ? "decimal-pad" : "number-pad"}
      selectTextOnFocus
      onChangeText={(v) => {
        if (!(porcentaje ? /^\d*(?:[.,]\d*)?$/ : /^\d*$/).test(v)) return
        if (v !== "" && !Number.isFinite(Number(v.replace(",", ".")))) return
        setTexto(v)
        cambiar(v === "" ? undefined : Number(v.replace(",", ".")) / (porcentaje ? 100 : 1))
      }}
      style={s.cifra}
    />
  )
}

export function AjustesDeFaseEditor({
  ajustes,
  numero,
  cambiar,
}: {
  ajustes: AjustesDeFase | undefined
  numero: number
  cambiar: (ajustes: AjustesDeFase | undefined) => void
}): React.JSX.Element {
  const rango = (grupo: "Compuestos" | "Accesorios"): React.JSX.Element => {
    const clave = grupo === "Compuestos" ? "rirCompuestos" : "rirAccesorios"
    return (
      <View style={s.fila}>
        <Text style={s.etiqueta}>RIR · {grupo.toLowerCase()}</Text>
        {(["min", "max"] as const).map((limite) => (
          <Fragment key={limite}>
            {limite === "max" && <Text style={s.tenue}>–</Text>}
            <Cifra
              etiqueta={`RIR ${limite === "min" ? "mínimo" : "máximo"} de ${grupo.toLowerCase()} de la fase ${numero}`}
              valor={ajustes?.[clave]?.[limite]}
              cambiar={(valor) =>
                cambiar({
                  ...ajustes,
                  [clave]: {
                    ...(ajustes?.[clave] ?? { min: valor ?? -1, max: valor ?? -1 }),
                    [limite]: valor ?? -1,
                  },
                })
              }
            />
          </Fragment>
        ))}
      </View>
    )
  }
  const error =
    ajustes &&
    ([ajustes.rirCompuestos, ajustes.rirAccesorios].some(
      (r) =>
        r &&
        (!Number.isInteger(r.min) ||
          !Number.isInteger(r.max) ||
          r.min < 0 ||
          r.max > 5 ||
          r.min > r.max),
    )
      ? "RIR de 0 a 5, con mínimo menor o igual al máximo."
      : ajustes.factorSeries !== undefined &&
          (ajustes.factorSeries < 0.3 || ajustes.factorSeries > 1)
        ? "Series entre 30 y 100 %."
        : ajustes.factorCarga !== undefined &&
            (ajustes.factorCarga < 0.5 || ajustes.factorCarga > 1.1)
          ? "Carga entre 50 y 110 %."
          : null)
  return (
    <View style={s.panel}>
      <View style={s.predefinidos}>
        {PREDEFINIDOS.map((p) => (
          <Chip
            key={p.nombre}
            texto={p.nombre}
            etiqueta={`${p.nombre} para la fase ${numero}`}
            activo={JSON.stringify(p.ajustes) === JSON.stringify(ajustes)}
            onPress={() => cambiar(p.ajustes)}
          />
        ))}
      </View>
      {ajustes && (
        <>
          {rango("Compuestos")}
          {rango("Accesorios")}
          {(["Series", "Carga"] as const).map((nombre) => {
            const clave = nombre === "Series" ? "factorSeries" : "factorCarga"
            return (
              <View key={clave} style={s.fila}>
                <Text style={s.etiqueta}>{nombre} · %</Text>
                <Cifra
                  etiqueta={`${nombre} en porcentaje de la fase ${numero}`}
                  valor={ajustes[clave]}
                  porcentaje
                  cambiar={(v) => cambiar({ ...ajustes, [clave]: v })}
                />
              </View>
            )
          })}
          {ajustes.factorSeries !== undefined && ajustes.factorSeries < 1 && (
            <Text style={s.tenue}>Los compuestos conservan sus series.</Text>
          )}
          {error && (
            <Text accessibilityRole="alert" style={s.error}>
              {error}
            </Text>
          )}
          <Enlace
            texto="Quitar ajustes"
            etiqueta={`Quitar ajustes de la fase ${numero}`}
            onPress={() => cambiar(undefined)}
          />
        </>
      )}
    </View>
  )
}

const s = StyleSheet.create({
  panel: { gap: 8 },
  predefinidos: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  fila: { flexDirection: "row", alignItems: "center", gap: 8 },
  etiqueta: { ...tipo.secundario, flex: 1, color: tema.textoSecundario },
  tenue: { ...tipo.secundario },
  error: { ...tipo.secundario, color: tema.error },
  cifra: {
    width: 64,
    minHeight: alto.celda,
    borderRadius: radio.celda,
    borderWidth: 1,
    borderColor: tema.bordeFuerte,
    backgroundColor: tema.hundido,
    color: tema.texto,
    fontFamily: tema.fuenteBoton,
    fontSize: 15,
    textAlign: "center",
    padding: 4,
    fontVariant: ["tabular-nums"],
  },
})
