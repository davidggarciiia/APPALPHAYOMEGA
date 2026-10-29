import { useEffect, useState } from "react"
import { StyleSheet, Text, View } from "react-native"
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated"
import { BotonEnlace, BotonPrincipal } from "../componentes/botones"
import { ANGULO, CURVA, RAYO, useEstadoMovimiento } from "../componentes/movimiento"
import { NumeroGiro } from "../componentes/numero-giro"
import { TrazoLogo } from "../componentes/trazo-logo"
import { espacio, tema, tipo } from "../tema"

export type PropsConfirmacionSesion = {
  estado: "enviado" | "guardado"
  hechas: number
  total: number
  /** Segundos reales de actividad; null en registros antiguos sin reloj. */
  duracion: number | null
  salir?: () => void
  reintentar?: () => void
  ocupado?: boolean
}

export function ConfirmacionSesion({
  estado,
  hechas,
  total,
  duracion,
  salir,
  reintentar,
  ocupado = false,
}: PropsConfirmacionSesion): React.JSX.Element {
  const { reducido, listo } = useEstadoMovimiento()
  const animar = listo && !reducido && estado === "enviado"
  const [cuenta, fijarCuenta] = useState(0)
  const [ancho, fijarAncho] = useState(0)
  const corte = useSharedValue(1)
  const entrada = useSharedValue(1)
  const minutos = duracion === null ? null : Math.max(0, Math.round(duracion / 60))
  const tiempo =
    minutos === null
      ? null
      : minutos >= 60
        ? `${Math.floor(minutos / 60)} h ${minutos % 60} min`
        : `${minutos} min`
  const resumen = `${hechas} de ${total} series${tiempo === null ? "" : ` · ${tiempo}`}`

  useEffect(() => {
    if (!animar) {
      corte.value = 1
      entrada.value = 1
      return
    }
    fijarCuenta(0)
    corte.value = 0
    entrada.value = 0
    // El clip real y el destello de Listo (600–1020) ocupan dos huecos; el resto entra de uno en uno.
    corte.value = withDelay(1020, withTiming(1, { duration: 320, easing: CURVA.entrada }))
    const marcador = setTimeout(() => fijarCuenta(hechas), 1340)
    entrada.value = withDelay(1480, withTiming(1, { duration: 260, easing: CURVA.entrada }))
    return () => {
      clearTimeout(marcador)
      cancelAnimation(corte)
      cancelAnimation(entrada)
    }
  }, [animar, hechas, corte, entrada])

  const cortina = useAnimatedStyle(() => ({
    transform: [{ translateX: corte.value * (ancho * 1.5 + 64) }, { skewX: `-${ANGULO}deg` }],
  }))
  const listoAnimado = useAnimatedStyle(() => ({
    transform: [
      { translateX: RAYO.x * (1 - entrada.value) },
      { translateY: RAYO.y * (1 - entrada.value) },
    ],
  }))

  return (
    <View style={estilos.raiz}>
      {estado === "enviado" && <TrazoLogo tamano={80} />}
      <View
        style={estilos.tituloContenedor}
        onLayout={(evento) => fijarAncho(evento.nativeEvent.layout.width)}
      >
        <Text accessibilityRole="header" style={estilos.titulo}>
          {estado === "enviado" ? "ENVIADO" : "GUARDADO"}
        </Text>
        {animar && (
          <Animated.View
            testID="confirmacion-cortina"
            accessible={false}
            importantForAccessibility="no-hide-descendants"
            pointerEvents="none"
            style={[estilos.cortina, cortina]}
          />
        )}
      </View>
      <View accessible accessibilityRole="text" accessibilityLabel={resumen}>
        <View style={estilos.resumen} importantForAccessibility="no-hide-descendants">
          {animar ? (
            <NumeroGiro valor={cuenta} estilo={estilos.resumenTexto} />
          ) : (
            <Text style={estilos.resumenTexto}>{hechas}</Text>
          )}
          <Text style={estilos.resumenTexto}>
            {" "}
            de {total} series{tiempo === null ? "" : ` · ${tiempo}`}
          </Text>
        </View>
      </View>
      {estado === "guardado" && (
        <Text style={estilos.pendiente}>Se enviará cuando tengas conexión.</Text>
      )}
      {salir && (
        <Animated.View style={listoAnimado}>
          <BotonPrincipal texto="Listo" onPress={salir} sinMargen />
        </Animated.View>
      )}
      {estado === "guardado" && reintentar && (
        <BotonEnlace texto="Reintentar ahora" onPress={reintentar} ocupado={ocupado} />
      )}
    </View>
  )
}

const estilos = StyleSheet.create({
  raiz: { gap: espacio[12], paddingVertical: espacio[16] },
  tituloContenedor: { alignSelf: "stretch", overflow: "hidden" },
  titulo: { ...tipo.heroGrande, fontSize: 64, lineHeight: 68 },
  cortina: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: "-20%",
    width: "150%",
    backgroundColor: tema.fondo,
  },
  resumen: { flexDirection: "row", flexWrap: "wrap", alignItems: "center" },
  resumenTexto: { ...tipo.cuerpo, ...tipo.cifras, color: tema.textoSecundario },
  pendiente: { ...tipo.cuerpo, color: tema.textoTenue },
})
