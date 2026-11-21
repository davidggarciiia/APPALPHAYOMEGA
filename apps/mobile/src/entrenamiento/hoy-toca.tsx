import { StyleSheet, Text, View } from "react-native"
import type { ResumenSesion } from "@alpha-omega/shared"

import { tema, tipo } from "../tema"
import { BotonPrincipal } from "../componentes/botones"
import { fechaLegible } from "./fechas"

/** La sesión de hoy y su acción principal. */
export function TarjetaHoy({
  sesion,
  sinSesion,
  hoy,
  abrir,
  empezada = false,
  siguiente,
}: {
  sesion: ResumenSesion | undefined
  /** Qué decir si hoy no hay nada pendiente. */
  sinSesion: string
  hoy: string
  abrir: (id: string) => void
  empezada?: boolean
  siguiente?: string
}): React.JSX.Element {
  const nombre = sesion?.nombre ?? sinSesion
  return (
    <View style={s.destacado}>
      <View style={s.cuerpo}>
        <View style={s.bloque}>
          <Text accessibilityRole="header" style={s.nombre}>
            {nombre}
          </Text>
          {!sesion && <Text style={s.detalle}>{siguiente ?? fechaLegible(hoy)}</Text>}
        </View>
        {sesion && (
          <BotonPrincipal
            etiquetaAccesible={`${sesion.enviadoEn ? "Ver resumen" : empezada ? "Continuar" : "Empezar"} ${sesion.nombre}`}
            texto={sesion.enviadoEn ? "Ver resumen" : empezada ? "Continuar entreno" : "Empezar"}
            onPress={() => abrir(sesion.agenda.id)}
            sinMargen
          />
        )}
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  destacado: {
    borderRadius: 20,
    backgroundColor: tema.superficie,
    borderWidth: 1,
    borderColor: tema.bordeDestacado,
    padding: 12,
    gap: 20,
  },
  cuerpo: { paddingHorizontal: 8, paddingBottom: 8, gap: 20 },
  bloque: { gap: 6 },
  nombre: { ...tipo.tituloPantalla, color: tema.acento },
  detalle: { color: tema.textoTenue, fontFamily: tema.fuenteTexto, fontSize: 16 },
})
