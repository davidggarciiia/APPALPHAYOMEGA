import { useEffect, useState } from "react"
import { StyleSheet, Text, View } from "react-native"
import { BotonEnlace, BotonPrincipal } from "../componentes/botones"
import { useEstadoMovimiento } from "../componentes/movimiento"
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
  const minutos = duracion === null ? null : Math.max(0, Math.round(duracion / 60))
  const tiempo =
    minutos === null
      ? null
      : minutos >= 60
        ? `${Math.floor(minutos / 60)} h ${minutos % 60} min`
        : `${minutos} min`
  const resumen = `${hechas} de ${total} series${tiempo === null ? "" : ` · ${tiempo}`}`

  useEffect(() => {
    if (!animar) return
    fijarCuenta(0)
    const marcador = setTimeout(() => fijarCuenta(hechas), 1340)
    return () => clearTimeout(marcador)
  }, [animar, hechas])

  return (
    <View style={estilos.raiz}>
      {estado === "enviado" && <TrazoLogo tamano={80} />}
      <Text accessibilityRole="header" style={estilos.titulo}>
        {estado === "enviado" ? "ENVIADO" : "GUARDADO"}
      </Text>
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
      {salir && <BotonPrincipal texto="Listo" onPress={salir} sinMargen />}
      {estado === "guardado" && reintentar && (
        <BotonEnlace texto="Reintentar ahora" onPress={reintentar} ocupado={ocupado} />
      )}
    </View>
  )
}

const estilos = StyleSheet.create({
  raiz: { gap: espacio[12], paddingVertical: espacio[16] },
  titulo: { ...tipo.heroGrande, fontSize: 64, lineHeight: 68 },
  resumen: { flexDirection: "row", flexWrap: "wrap", alignItems: "center" },
  resumenTexto: { ...tipo.cuerpo, ...tipo.cifras, color: tema.textoSecundario },
  pendiente: { ...tipo.cuerpo, color: tema.textoTenue },
})
