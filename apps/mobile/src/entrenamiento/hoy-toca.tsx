import { StyleSheet, Text, View } from "react-native"
import type { ResumenSesion } from "@alpha-omega/shared"

import { tema, tipo } from "../tema"
import { BotonPrincipal } from "../componentes/botones"
import { Pulsable } from "../componentes/pulsable"
import { fechaLegible } from "./fechas"

/** La sesión de hoy y su acción principal. */
export function TarjetaHoy({
  sesion,
  sinSesion,
  hoy,
  abrir,
  empezada = false,
  siguiente,
  pendienteDesde,
}: {
  sesion: ResumenSesion | undefined
  /** Qué decir si hoy no hay nada pendiente. */
  sinSesion: string
  hoy: string
  abrir: (id: string) => void
  empezada?: boolean
  /** Debajo del título cuando no hay sesión: la próxima, o el motivo. */
  siguiente?: string
  /** Fecha en la que tocaba, si la sesión ofrecida se quedó atrasada. */
  pendienteDesde?: string
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
          {sesion && pendienteDesde && (
            <Text style={s.detalle}>Pendiente desde el {fechaLegible(pendienteDesde)}</Text>
          )}
        </View>
        {sesion && (
          <BotonPrincipal
            etiquetaAccesible={`${sesion.enviadoEn ? "Ver resumen" : empezada ? "Continuar" : "Empezar"} ${sesion.nombre}`}
            texto={sesion.enviadoEn ? "Ver resumen" : empezada ? "Continuar" : "Empezar"}
            onPress={() => abrir(sesion.agenda.id)}
            sinMargen
          />
        )}
      </View>
    </View>
  )
}

/** Una sesión de días anteriores que sigue sin hacerse: se ofrece, no se esconde. */
export function SesionAtrasada({
  sesion,
  abrir,
}: {
  sesion: ResumenSesion
  abrir: (id: string) => void
}): React.JSX.Element {
  const desde = fechaLegible(sesion.agenda.fechaActual)
  return (
    <Pulsable
      accessibilityRole="button"
      accessibilityLabel={`Empezar ${sesion.nombre}, pendiente desde el ${desde}`}
      onPress={() => abrir(sesion.agenda.id)}
      style={s.atrasada}
    >
      <View style={s.textosAtrasada}>
        <Text numberOfLines={1} style={s.nombreAtrasada}>
          {sesion.nombre}
        </Text>
        <Text style={s.detalleAtrasada}>Pendiente desde el {desde}</Text>
      </View>
      <Text style={s.accionAtrasada}>Empezar</Text>
    </Pulsable>
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
  atrasada: {
    minHeight: 64,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: tema.avisoBorde,
    backgroundColor: tema.superficie,
    paddingHorizontal: 16,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  textosAtrasada: { flex: 1, gap: 2 },
  nombreAtrasada: { ...tipo.fila, color: tema.texto },
  detalleAtrasada: { ...tipo.secundario, color: tema.aviso },
  accionAtrasada: { ...tipo.fila, color: tema.acento },
})
