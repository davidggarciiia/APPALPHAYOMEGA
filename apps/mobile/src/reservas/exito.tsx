import { StyleSheet, Text, View } from "react-native"
import Animated, { css, cubicBezier } from "react-native-reanimated"

import { Icono } from "../componentes/iconos"
import { useMovimientoReducido } from "../lib/movimiento"
import { degradadoExito, tema } from "../tema"

const SALIDA = cubicBezier(0.23, 1, 0.32, 1)

/**
 * Reserva hecha: el único momento con algo de celebración. Pasa pocas veces por
 * semana y es la recompensa de todo el recorrido, así que la marca aparece con
 * un ligero rebote (de 0,9 a 1,06 y a 1) y un anillo que se expande y se apaga.
 * Sin escala desde cero y en menos de medio segundo. Con movimiento reducido,
 * solo un fundido.
 */
export function ExitoReserva({
  titulo,
  detalle,
}: {
  titulo: string
  detalle: string
}): React.JSX.Element {
  const reducido = useMovimientoReducido()
  return (
    <View
      style={estilos.caja}
      accessible
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      accessibilityLabel={`${titulo}. ${detalle}`}
    >
      <View style={estilos.marco}>
        {!reducido && <Animated.View style={[estilos.anillo, animaciones.anillo]} />}
        <Animated.View
          style={[estilos.marca, reducido ? animaciones.fundido : animaciones.aparecer]}
        >
          <Icono nombre="hecho" color={tema.sobreExito} tamano={34} />
        </Animated.View>
      </View>
      <Animated.View style={[estilos.textos, animaciones.fundido]}>
        <Text style={estilos.titulo}>{titulo}</Text>
        <Text style={estilos.detalle}>{detalle}</Text>
      </Animated.View>
    </View>
  )
}

const aparecer = css.keyframes({
  from: { opacity: 0, transform: [{ scale: 0.9 }] },
  "60%": { opacity: 1, transform: [{ scale: 1.06 }] },
  to: { opacity: 1, transform: [{ scale: 1 }] },
})
const anillo = css.keyframes({
  from: { opacity: 0.6, transform: [{ scale: 0.9 }] },
  to: { opacity: 0, transform: [{ scale: 1.6 }] },
})
const fundido = css.keyframes({ from: { opacity: 0 }, to: { opacity: 1 } })

const animaciones = css.create({
  aparecer: {
    animationName: aparecer,
    animationDuration: 420,
    animationTimingFunction: SALIDA,
    animationFillMode: "both",
  },
  anillo: {
    animationName: anillo,
    animationDuration: 700,
    animationDelay: 120,
    animationTimingFunction: SALIDA,
    animationFillMode: "both",
  },
  fundido: {
    animationName: fundido,
    animationDuration: 200,
    animationTimingFunction: SALIDA,
    animationFillMode: "both",
  },
})

const estilos = StyleSheet.create({
  caja: { alignItems: "center", gap: 16, paddingVertical: 16 },
  marco: { width: 88, height: 88, alignItems: "center", justifyContent: "center" },
  anillo: {
    position: "absolute",
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 2,
    borderColor: tema.exito,
  },
  marca: {
    ...degradadoExito,
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  textos: { alignItems: "center", gap: 6 },
  titulo: {
    color: tema.texto,
    fontFamily: tema.fuenteTitulo,
    fontSize: 28,
    lineHeight: 32,
    textTransform: "uppercase",
  },
  detalle: {
    color: tema.textoSecundario,
    fontFamily: tema.fuenteTexto,
    fontSize: 15,
    lineHeight: 21,
    textAlign: "center",
  },
})
