import { StyleSheet, Text, View } from "react-native"
import Svg, { Path } from "react-native-svg"

import { diasDeLaSemana, fechaLarga, rangoDeSemana } from "../lib/fechas"
import { fuentes, tema } from "../tema"

import type { EstadoDeMarca } from "./diseno"
import { Pulsable } from "./pulsable"

const LETRAS = ["L", "M", "X", "J", "V", "S", "D"] as const

function describir(marcas: EstadoDeMarca[]): string {
  if (marcas.length === 0) {
    return "sin entreno"
  }
  const hechos = marcas.filter((m) => m === "hecho").length
  const faltan = marcas.length - hechos
  const partes = []
  if (hechos > 0)
    partes.push(hechos === 1 ? "1 entreno hecho" : `${String(hechos)} entrenos hechos`)
  if (faltan > 0) partes.push(faltan === 1 ? "1 por hacer" : `${String(faltan)} por hacer`)
  return partes.join(", ")
}

/**
 * «Esta semana» de Main.dc.html: los siete días con un punto por entreno,
 * dorado lo que falta y verde lo hecho. Hoy va sobre fondo de tarjeta.
 *
 * Cada día se lee entero con lector de pantalla («lunes 21 de septiembre: 1
 * entreno hecho»), así que el color nunca es la única pista.
 */
export function TiraDeSemana({
  lunes,
  hoy,
  marcas,
}: {
  lunes: string
  hoy: string
  marcas: ReadonlyMap<string, EstadoDeMarca[]>
}): React.JSX.Element {
  return (
    <View style={estilos.contenedor}>
      <View style={estilos.tira}>
        {diasDeLaSemana(lunes).map((fecha, indice) => {
          const delDia = marcas.get(fecha) ?? []
          const esHoy = fecha === hoy
          return (
            <View
              key={fecha}
              style={[estilos.dia, esHoy && estilos.hoy]}
              accessible
              accessibilityLabel={`${esHoy ? "Hoy, " : ""}${fechaLarga(fecha)}: ${describir(delDia)}`}
            >
              <Text style={estilos.letra}>{LETRAS[indice]}</Text>
              <Text style={[estilos.numero, esHoy && estilos.numeroHoy]}>
                {String(Number(fecha.slice(8, 10)))}
              </Text>
              <View style={estilos.puntos}>
                {delDia.slice(0, 3).map((marca, i) => (
                  <View
                    key={i}
                    style={[estilos.punto, marca === "hecho" ? estilos.hecho : estilos.porHacer]}
                  />
                ))}
              </View>
            </View>
          )
        })}
      </View>
      <View
        style={estilos.leyenda}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <View style={[estilos.punto, estilos.porHacer]} />
        <Text style={estilos.textoLeyenda}>Por hacer</Text>
        <View style={[estilos.punto, estilos.hecho, estilos.separacion]} />
        <Text style={estilos.textoLeyenda}>Hecho</Text>
      </View>
    </View>
  )
}

function Flecha({ haciaLaDerecha }: { haciaLaDerecha: boolean }): React.JSX.Element {
  return (
    <View>
      <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
        <Path
          d={haciaLaDerecha ? "M9 5l7 7-7 7" : "M15 5l-7 7 7 7"}
          stroke={tema.texto}
          strokeWidth={2.2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    </View>
  )
}

/** ‹ 21 – 27 sep 2026 › y, si no es la actual, «Volver a esta semana». */
export function NavegadorDeSemana({
  lunes,
  esEstaSemana,
  alCambiar,
  alVolverAHoy,
}: {
  lunes: string
  esEstaSemana: boolean
  alCambiar: (dias: number) => void
  alVolverAHoy: () => void
}): React.JSX.Element {
  return (
    <View style={estilos.navegador}>
      <Pulsable
        onPress={() => alCambiar(-7)}
        style={estilos.flecha}
        accessibilityRole="button"
        accessibilityLabel="Semana anterior"
      >
        <Flecha haciaLaDerecha={false} />
      </Pulsable>
      <View style={estilos.centro}>
        <Text style={estilos.rango} accessibilityRole="header">
          {rangoDeSemana(lunes)}
        </Text>
        {esEstaSemana ? (
          <Text style={estilos.estaSemana}>Esta semana</Text>
        ) : (
          <Pulsable
            onPress={alVolverAHoy}
            accessibilityRole="button"
            hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
          >
            <Text style={estilos.volver}>Volver a esta semana</Text>
          </Pulsable>
        )}
      </View>
      <Pulsable
        onPress={() => alCambiar(7)}
        style={estilos.flecha}
        accessibilityRole="button"
        accessibilityLabel="Semana siguiente"
      >
        <Flecha haciaLaDerecha />
      </Pulsable>
    </View>
  )
}

const estilos = StyleSheet.create({
  contenedor: { gap: 14 },
  tira: { flexDirection: "row", gap: 4 },
  dia: { flex: 1, alignItems: "center", gap: 6, paddingVertical: 10, borderRadius: 14 },
  hoy: { backgroundColor: tema.superficie },
  letra: { color: tema.textoTenue, fontFamily: fuentes.normal, fontSize: 13 },
  numero: {
    color: tema.texto,
    fontFamily: fuentes.negrita,
    fontSize: 17,
    fontVariant: ["tabular-nums"],
  },
  numeroHoy: { color: tema.oro },
  puntos: { flexDirection: "row", gap: 3, height: 10, alignItems: "center" },
  punto: { width: 9, height: 9, borderRadius: 4.5 },
  porHacer: { backgroundColor: tema.oro },
  hecho: { backgroundColor: tema.verde },
  leyenda: { flexDirection: "row", alignItems: "center", gap: 6 },
  separacion: { marginLeft: 14 },
  textoLeyenda: { color: tema.textoTenue, fontFamily: fuentes.normal, fontSize: 13 },
  navegador: { flexDirection: "row", alignItems: "center", gap: 12 },
  flecha: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#1F1D19",
    alignItems: "center",
    justifyContent: "center",
  },
  centro: { flex: 1, alignItems: "center", gap: 2 },
  rango: {
    color: tema.texto,
    fontFamily: fuentes.semi,
    fontSize: 16,
    fontVariant: ["tabular-nums"],
  },
  estaSemana: { color: tema.textoTenue, fontFamily: fuentes.normal, fontSize: 13 },
  volver: { color: tema.oro, fontFamily: fuentes.semi, fontSize: 13 },
})
