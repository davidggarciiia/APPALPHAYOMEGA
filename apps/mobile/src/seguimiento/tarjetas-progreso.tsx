import { Pressable, StyleSheet, Text, View, type DimensionValue } from "react-native"
import Svg, { Circle } from "react-native-svg"

import { espacio, radio, tema, tipo } from "../tema"

type Sentido = "favorable" | "desfavorable" | "neutral"
type Posicion = "primera" | "intermedia" | "ultima" | "unica"

export type Comparativa = {
  id: string
  nombre: string
  inicial: number | null
  actual: number
  unidad: string
  repeticionesInicial?: number | null
  repeticionesActual?: number
  sentido?: Sentido
  alPulsar?: () => void
  /** Contexto de fecha, método o alcance que completa la lectura accesible. */
  descripcion?: string
  /** Anillos solo para porcentajes reales dentro de 0–100. */
  representacion?: "barras" | "anillos" | "tramo"
}

function Anillos({
  id,
  inicial,
  actual,
}: Pick<Comparativa, "id" | "inicial" | "actual">): React.JSX.Element {
  const dibujar = (valor: number, lado: "inicial" | "actual"): React.JSX.Element => {
    const circunferencia = 2 * Math.PI * 25
    return (
      <View testID={`anillo-${id}-${lado}`} style={s.anillo}>
        <Svg width={60} height={60} viewBox="0 0 60 60">
          <Circle cx={30} cy={30} r={25} fill="none" stroke={tema.superficieAlta} strokeWidth={6} />
          <Circle
            cx={30}
            cy={30}
            r={25}
            fill="none"
            stroke={lado === "actual" ? tema.acento : tema.bordeFuerte}
            strokeWidth={6}
            strokeLinecap="round"
            strokeDasharray={`${circunferencia} ${circunferencia}`}
            strokeDashoffset={circunferencia * (1 - valor / 100)}
            transform="rotate(-90 30 30)"
          />
        </Svg>
        <Text
          style={[s.textoAnillo, lado === "actual" && s.textoAnilloActual]}
        >{`${numero(valor)} %`}</Text>
      </View>
    )
  }
  return (
    <View accessible={false} importantForAccessibility="no-hide-descendants" style={s.anillos}>
      {inicial !== null && (
        <>
          {dibujar(inicial, "inicial")}
          <Text style={s.flechaPeso}> → </Text>
        </>
      )}
      {dibujar(actual, "actual")}
    </View>
  )
}

const numero = (valor: number): string => String(Number(valor.toPrecision(12))).replace(".", ",")
const diferencia = (inicial: number, actual: number): string => {
  const valor = Number((actual - inicial).toPrecision(12))
  return `${valor > 0 ? "+" : valor < 0 ? "−" : ""}${numero(Math.abs(valor))}`
}

/** Escala ambos valores con la misma referencia, sin atribuirles un objetivo. */
function anchos(inicial: number | null, actual: number): [DimensionValue, DimensionValue] {
  const maximo = Math.max(0, inicial ?? 0, actual)
  const ancho = (valor: number): DimensionValue =>
    maximo === 0 ? "0%" : `${Math.max(0, Math.min(100, (valor / maximo) * 100))}%`
  return [ancho(inicial ?? 0), ancho(actual)]
}

function Barras({
  id,
  inicial,
  actual,
}: Pick<Comparativa, "id" | "inicial" | "actual">): React.JSX.Element {
  const [antes, ahora] = anchos(inicial, actual)
  return (
    <View accessible={false} importantForAccessibility="no-hide-descendants" style={s.barras}>
      {inicial !== null && (
        <View style={s.pista}>
          <View testID={`barra-${id}-inicial`} style={[s.barraInicial, { width: antes }]} />
        </View>
      )}
      <View style={s.pista}>
        <View testID={`barra-${id}-actual`} style={[s.barraActual, { width: ahora }]} />
      </View>
    </View>
  )
}

/** La marca inicial y su aumento ocupan una única pista con una escala común. */
function Tramo({
  id,
  inicial,
  actual,
}: {
  id: string
  inicial: number
  actual: number
}): React.JSX.Element {
  const base = (inicial / actual) * 100
  return (
    <View
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      style={[s.pista, s.tramo]}
    >
      <View testID={`tramo-${id}-base`} style={[s.barraInicial, { width: `${base}%` }]} />
      <View testID={`tramo-${id}-aumento`} style={[s.barraActual, { width: `${100 - base}%` }]} />
    </View>
  )
}

function ColorCambio({
  sentido,
  children,
}: {
  sentido: Sentido
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <Text
      style={[
        s.cambio,
        sentido === "favorable" && s.favorable,
        sentido === "desfavorable" && s.desfavorable,
      ]}
    >
      {children}
    </Text>
  )
}

function etiquetaAccesible(fila: Omit<Comparativa, "id">): string {
  const repeticiones = (valor: number | null | undefined): string =>
    valor == null ? "" : ` por ${valor} ${valor === 1 ? "repetición" : "repeticiones"}`
  const actual = `${numero(fila.actual)} ${fila.unidad}${repeticiones(fila.repeticionesActual)}`
  const inicial =
    fila.inicial === null
      ? ""
      : `${numero(fila.inicial)}${fila.repeticionesInicial == null ? "" : ` ${fila.unidad}`}${repeticiones(fila.repeticionesInicial)}`
  const comparacion =
    fila.inicial === null
      ? `${fila.nombre}, ${actual}`
      : `${fila.nombre}, ${inicial} a ${actual}, ${diferencia(fila.inicial, fila.actual)} ${fila.unidad}`
  return fila.descripcion ? `${comparacion}, ${fila.descripcion}` : comparacion
}

/** Cifra principal y comparación del mismo origen, cuando existe una medición inicial. */
export function TarjetaPeso({
  etiqueta,
  inicial,
  actual,
  unidad,
  sentido = "neutral",
  alPulsar,
  descripcion,
}: {
  etiqueta: string
  inicial: number | null
  actual: number
  unidad: string
  sentido?: Sentido
  alPulsar?: () => void
  descripcion?: string
}): React.JSX.Element {
  const contenido = (
    <>
      <Text style={s.etiquetaPeso}>{etiqueta}</Text>
      <View style={s.numerosPeso}>
        {inicial !== null && (
          <>
            <Text style={s.pesoInicial}>{numero(inicial)}</Text>
            <Text style={s.flechaPeso}> → </Text>
          </>
        )}
        <Text style={s.pesoActual}>{numero(actual)}</Text>
        <Text style={s.unidadPeso}> {unidad}</Text>
      </View>
      <Barras id="peso" inicial={inicial} actual={actual} />
      {inicial !== null && (
        <View style={s.lineaCambio}>
          <ColorCambio sentido={sentido}>{`${diferencia(inicial, actual)} ${unidad}`}</ColorCambio>
        </View>
      )}
    </>
  )
  const etiquetaCompleta = etiquetaAccesible({
    nombre: etiqueta,
    inicial,
    actual,
    unidad,
    descripcion,
  })
  return alPulsar ? (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={etiquetaCompleta}
      onPress={alPulsar}
      style={s.peso}
    >
      {contenido}
    </Pressable>
  ) : (
    <View accessible accessibilityLabel={etiquetaCompleta} style={s.peso}>
      {contenido}
    </View>
  )
}

/** Una fila independiente para que SectionList pueda virtualizar grupos largos. */
export function FilaComparativa({
  fila,
  posicion = "unica",
}: {
  fila: Comparativa
  posicion?: Posicion
}): React.JSX.Element {
  const contenido = (
    <>
      <View style={s.encabezadoFila}>
        <Text style={s.nombre}>{fila.nombre}</Text>
        <View style={s.valores}>
          <View style={s.cifrasFila}>
            {fila.inicial !== null && (
              <Text
                style={s.inicial}
              >{`${numero(fila.inicial)}${fila.repeticionesInicial == null ? "" : `×${fila.repeticionesInicial}`} → `}</Text>
            )}
            <Text
              style={s.actual}
            >{`${numero(fila.actual)} ${fila.unidad}${fila.repeticionesActual == null ? "" : `×${fila.repeticionesActual}`}`}</Text>
          </View>
          {fila.inicial !== null && fila.representacion !== "tramo" && (
            <ColorCambio
              sentido={fila.sentido ?? "neutral"}
            >{`${diferencia(fila.inicial, fila.actual)} ${fila.unidad}`}</ColorCambio>
          )}
        </View>
      </View>
      {fila.representacion === "anillos" &&
      fila.unidad === "%" &&
      fila.actual >= 0 &&
      fila.actual <= 100 &&
      (fila.inicial === null || (fila.inicial >= 0 && fila.inicial <= 100)) ? (
        <Anillos id={fila.id} inicial={fila.inicial} actual={fila.actual} />
      ) : fila.representacion === "tramo" &&
        fila.inicial !== null &&
        fila.inicial >= 0 &&
        fila.actual >= fila.inicial &&
        fila.actual > 0 ? (
        <Tramo id={fila.id} inicial={fila.inicial} actual={fila.actual} />
      ) : (
        <Barras id={fila.id} inicial={fila.inicial} actual={fila.actual} />
      )}
    </>
  )
  const bordes = [
    (posicion === "primera" || posicion === "unica") && s.bordeSuperior,
    (posicion === "ultima" || posicion === "unica") && s.bordeInferior,
  ]
  return fila.alPulsar ? (
    <Pressable
      testID={`comparativa-${fila.id}`}
      accessibilityRole="button"
      accessibilityLabel={etiquetaAccesible(fila)}
      onPress={fila.alPulsar}
      style={[s.fila, ...bordes]}
    >
      {contenido}
    </Pressable>
  ) : (
    <View
      testID={`comparativa-${fila.id}`}
      accessible
      accessibilityLabel={etiquetaAccesible(fila)}
      style={[s.fila, ...bordes]}
    >
      {contenido}
    </View>
  )
}

/** Agrupa filas cuando el conjunto es pequeño y no necesita virtualización. */
export function TarjetaComparativas({
  filas,
}: {
  filas: readonly Comparativa[]
}): React.JSX.Element {
  return (
    <View>
      {filas.map((fila, indice) => (
        <FilaComparativa
          key={fila.id}
          fila={fila}
          posicion={
            filas.length === 1
              ? "unica"
              : indice === 0
                ? "primera"
                : indice === filas.length - 1
                  ? "ultima"
                  : "intermedia"
          }
        />
      ))}
    </View>
  )
}

const s = StyleSheet.create({
  peso: {
    backgroundColor: tema.superficie,
    borderRadius: radio.tarjeta,
    padding: espacio[20],
    gap: espacio[12],
  },
  etiquetaPeso: { ...tipo.micro, color: tema.textoTenue },
  numerosPeso: { flexDirection: "row", flexWrap: "wrap", alignItems: "baseline" },
  pesoInicial: { ...tipo.heroCompacto, color: tema.textoTenue },
  pesoActual: { ...tipo.heroCompacto, color: tema.acento },
  flechaPeso: { ...tipo.cuerpo, color: tema.textoTenue },
  unidadPeso: { ...tipo.titulo, color: tema.acento },
  barras: { gap: espacio[4] },
  tramo: { flexDirection: "row" },
  pista: {
    height: 10,
    backgroundColor: tema.superficieAlta,
    borderRadius: radio.pastilla,
    overflow: "hidden",
  },
  barraInicial: { height: "100%", backgroundColor: tema.bordeFuerte, borderRadius: radio.pastilla },
  barraActual: { height: "100%", backgroundColor: tema.acento, borderRadius: radio.pastilla },
  lineaCambio: { flexDirection: "row" },
  cambio: {
    ...tipo.secundario,
    color: tema.textoSecundario,
    backgroundColor: tema.superficieAlta,
    overflow: "hidden",
    borderRadius: radio.pastilla,
    paddingHorizontal: espacio[8],
    paddingVertical: espacio[2],
  },
  favorable: { color: tema.exito, backgroundColor: tema.exitoSuave },
  desfavorable: { color: tema.aviso },
  fila: {
    backgroundColor: tema.superficie,
    paddingHorizontal: espacio[20],
    paddingVertical: espacio[12],
    gap: espacio[8],
    minHeight: 76,
  },
  bordeSuperior: {
    borderTopLeftRadius: radio.tarjeta,
    borderTopRightRadius: radio.tarjeta,
    paddingTop: espacio[20],
  },
  bordeInferior: {
    borderBottomLeftRadius: radio.tarjeta,
    borderBottomRightRadius: radio.tarjeta,
    paddingBottom: espacio[20],
  },
  encabezadoFila: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: espacio[8],
  },
  nombre: { ...tipo.fila, color: tema.texto, flex: 1 },
  valores: { alignItems: "flex-end", gap: espacio[4], flexShrink: 1 },
  cifrasFila: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "flex-end",
    alignItems: "baseline",
  },
  inicial: { ...tipo.secundario },
  actual: { ...tipo.fila, color: tema.texto },
  anillos: { flexDirection: "row", alignItems: "center", gap: espacio[8] },
  anillo: { width: 60, height: 60, alignItems: "center", justifyContent: "center" },
  textoAnillo: { ...tipo.secundario, position: "absolute", color: tema.textoSecundario },
  textoAnilloActual: { color: tema.acento },
})
