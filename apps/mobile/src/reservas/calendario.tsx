import { ScrollView, StyleSheet, Text, View } from "react-native"
import Animated, { css, cubicBezier } from "react-native-reanimated"
import type { Disponibilidad, Hueco } from "@alpha-omega/shared"

import { Pulsable } from "../componentes/pulsable"
import { tema } from "../tema"
import { Eleccion, Grupo, Texto } from "./piezas"
import { diaCorto, fechaLarga, horaDe, local, numeroDia, sesiones } from "./formato"

type Dia = Disponibilidad["dias"][number]

/** Desde esta hora local un hueco es de tarde. */
const INICIO_TARDE_MIN = 14 * 60

const SALIDA = cubicBezier(0.23, 1, 0.32, 1)

/** El primer día con huecos, o el primero de todos si no hay ninguno. */
export function primerDiaConHuecos(dias: Dia[]): string | null {
  return (dias.find((dia) => dia.huecos.length > 0) ?? dias[0])?.fecha ?? null
}

/** «sin huecos libres», «1 hueco libre», «3 huecos libres». */
export function describirHuecos(cuenta: number): string {
  if (cuenta === 0) return "sin huecos libres"
  return `${String(cuenta)} ${cuenta === 1 ? "hueco libre" : "huecos libres"}`
}

/** Los días de la disponibilidad con cuántos huecos tiene cada uno. */
export function diasConHuecos(dias: Dia[]): Array<{ fecha: string; cuenta: number }> {
  return dias.map((dia) => ({ fecha: dia.fecha, cuenta: dia.huecos.length }))
}

/**
 * Tira de días, como en Booksy: día de la semana y número. Los días sin nada
 * (huecos para el cliente, reservas para el entrenador) se ven apagados pero se
 * pueden elegir, para que el «no hay nada» se lea en palabras y no solo en un
 * color.
 */
export function TiraDeDias({
  dias,
  elegida,
  elegir,
  describir = describirHuecos,
}: {
  dias: ReadonlyArray<{ fecha: string; cuenta: number }>
  elegida: string | null
  elegir: (fecha: string) => void
  describir?: (cuenta: number) => string
}): React.JSX.Element {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={estilos.tira}
      accessibilityRole="radiogroup"
      accessibilityLabel="Día"
    >
      {dias.map((dia) => {
        const activa = dia.fecha === elegida
        const libres = dia.cuenta
        return (
          <Pulsable
            key={dia.fecha}
            onPress={() => elegir(dia.fecha)}
            accessibilityRole="radio"
            accessibilityLabel={`${fechaLarga(dia.fecha)}, ${describir(libres)}`}
            accessibilityState={{ checked: activa, selected: activa }}
          >
            <Animated.View
              style={[
                transiciones.color,
                estilos.dia,
                activa && estilos.diaElegido,
                libres === 0 && !activa && estilos.diaSinHuecos,
              ]}
            >
              <Text style={[estilos.diaSemana, activa && estilos.textoElegido]}>
                {diaCorto(dia.fecha)}
              </Text>
              <Text
                style={[
                  estilos.numero,
                  activa && estilos.textoElegido,
                  libres === 0 && !activa && estilos.numeroSinHuecos,
                ]}
              >
                {numeroDia(dia.fecha)}
              </Text>
              <View
                style={[
                  estilos.marca,
                  libres > 0 && estilos.marcaLibre,
                  activa && libres > 0 && estilos.marcaElegida,
                ]}
              />
            </Animated.View>
          </Pulsable>
        )
      })}
    </ScrollView>
  )
}

/** Huecos del día en «Mañana» y «Tarde», por hora local del centro. */
export function HuecosDelDia({
  huecos,
  elegido,
  elegir,
  vacio = "No quedan huecos libres este día. Prueba con otro.",
}: {
  huecos: Hueco[]
  elegido: string | null
  elegir: (hueco: Hueco) => void
  vacio?: string
}): React.JSX.Element {
  if (huecos.length === 0) return <Texto tenue>{vacio}</Texto>
  const manana = huecos.filter((h) => local(h.inicio).minutos < INICIO_TARDE_MIN)
  const tarde = huecos.filter((h) => local(h.inicio).minutos >= INICIO_TARDE_MIN)
  const bloque = (titulo: string, lista: Hueco[]): React.JSX.Element | null =>
    lista.length === 0 ? null : (
      <View style={estilos.bloque}>
        <Text style={estilos.franja} accessibilityRole="header">
          {titulo}
        </Text>
        <Grupo etiqueta={`Huecos de ${titulo.toLowerCase()}`}>
          {lista.map((hueco) => (
            <Eleccion
              key={hueco.inicio}
              texto={horaDe(hueco.inicio)}
              etiqueta={`A las ${horaDe(hueco.inicio)}`}
              elegida={hueco.inicio === elegido}
              onPress={() => elegir(hueco)}
            />
          ))}
        </Grupo>
      </View>
    )
  return (
    <View style={estilos.huecos}>
      {bloque("Mañana", manana)}
      {bloque("Tarde", tarde)}
    </View>
  )
}

/** «Te quedan 3 sesiones» con el número grande. */
export function NumeroGrande({
  valor,
  texto,
}: {
  valor: number
  texto: string
}): React.JSX.Element {
  return (
    <View style={estilos.grande} accessible accessibilityLabel={`${texto} ${sesiones(valor)}`}>
      <Text style={estilos.textoGrande}>{texto}</Text>
      <Text style={estilos.cifra}>{String(valor)}</Text>
      <Text style={estilos.textoGrande}>{valor === 1 ? "sesión" : "sesiones"}</Text>
    </View>
  )
}

const transiciones = css.create({
  color: {
    transitionProperty: ["backgroundColor", "borderColor"],
    transitionDuration: 150,
    transitionTimingFunction: SALIDA,
  },
})

const estilos = StyleSheet.create({
  tira: { gap: 8, paddingVertical: 2 },
  dia: {
    width: 52,
    minHeight: 72,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: tema.bordeFuerte,
    backgroundColor: tema.superficie,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
    paddingVertical: 8,
  },
  diaElegido: { backgroundColor: tema.acento, borderColor: tema.acento },
  diaSinHuecos: { borderColor: tema.borde, backgroundColor: "transparent" },
  diaSemana: {
    color: tema.textoTenue,
    fontFamily: tema.fuenteSemi,
    fontSize: 11,
    letterSpacing: 1,
  },
  numero: { color: tema.texto, fontFamily: tema.fuenteBoton, fontSize: 18 },
  numeroSinHuecos: { color: tema.textoTenue },
  textoElegido: { color: tema.sobreAcento },
  marca: { width: 6, height: 6, borderRadius: 3, backgroundColor: "transparent" },
  marcaLibre: { backgroundColor: tema.acento },
  marcaElegida: { backgroundColor: tema.sobreAcento },
  huecos: { gap: 16 },
  bloque: { gap: 8 },
  franja: { color: tema.textoTenue, fontFamily: tema.fuenteSemi, fontSize: 13, letterSpacing: 1 },
  grande: { flexDirection: "row", alignItems: "baseline", gap: 8, flexWrap: "wrap" },
  textoGrande: { color: tema.texto, fontFamily: tema.fuenteSemi, fontSize: 17 },
  cifra: { color: tema.acento, fontFamily: tema.fuenteTitulo, fontSize: 44, lineHeight: 50 },
})
