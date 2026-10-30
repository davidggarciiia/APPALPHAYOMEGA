import { StyleSheet, Text, View } from "react-native"
import type { ResumenSesion } from "@alpha-omega/shared"

import { tema } from "../tema"
import { BotonPrincipal } from "../componentes/botones"
import { fechaLegible } from "./fechas"

/**
 * El tamaño del nombre depende de su largo: «Empuje» cabe a 52 px como en el
 * diseño; «Empuje y pierna» baja para no partirse en tres renglones.
 */
export function tamanoDelNombre(nombre: string): number {
  if (nombre.length <= 10) return 52
  if (nombre.length <= 16) return 40
  if (nombre.length <= 24) return 32
  return 26
}

/** «Hoy toca»: nombre, estado y acción de la sesión. */
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
          {sesion && (
            <Text accessibilityRole="header" style={s.hoyToca}>
              {empezada ? "En curso:" : sesion?.enviadoEn ? "Completado:" : "Hoy toca:"}
            </Text>
          )}
          <Text
            style={[
              s.nombre,
              { fontSize: tamanoDelNombre(nombre), lineHeight: tamanoDelNombre(nombre) * 1.1 },
            ]}
          >
            {nombre}
          </Text>
          <Text style={s.detalle}>
            {sesion ? fechaLegible(hoy) : (siguiente ?? fechaLegible(hoy))}
          </Text>
          {sesion && sesion.agenda.fechaActual !== sesion.agenda.fechaOriginal && (
            <Text style={s.detalle}>
              Movido desde {fechaLegible(sesion.agenda.fechaOriginal)}. Tu entrenador ve el cambio.
            </Text>
          )}
        </View>
        {sesion && (
          <BotonPrincipal
            etiquetaAccesible={`${sesion.enviadoEn ? "Ver resumen" : empezada ? "Continuar" : "Empezar"} ${sesion.nombre}`}
            texto={
              sesion.enviadoEn ? "Ver resumen" : empezada ? "Continuar entreno" : "Empezar entreno"
            }
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
  hoyToca: {
    color: tema.textoTenue,
    fontFamily: tema.fuenteSemi,
    fontSize: 11,
    lineHeight: 18,
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  nombre: { color: tema.acento, fontFamily: tema.fuenteTitulo, textTransform: "uppercase" },
  detalle: { color: tema.textoTenue, fontFamily: tema.fuenteTexto, fontSize: 16 },
})
