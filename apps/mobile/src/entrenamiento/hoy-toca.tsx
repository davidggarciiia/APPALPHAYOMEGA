import { useEffect, useState } from "react"
import { StyleSheet, Text, View } from "react-native"
import type { ResumenSesion, SesionCliente } from "@alpha-omega/shared"

import { tema } from "../tema"
import { BotonPrincipal } from "../componentes/botones"
import { fechaLegible } from "./fechas"

/** Lo que hace falta para completar la duración de la sesión de hoy. */
export type DetalleDeHoy = {
  leerSesion: (id: string) => Promise<SesionCliente>
}

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

/** «Hoy toca»: nombre, estado, duración y acción de la sesión. */
export function TarjetaHoy({
  sesion,
  sinSesion,
  hoy,
  abrir,
  detalle,
  empezada = false,
  siguiente,
}: {
  sesion: ResumenSesion | undefined
  /** Qué decir si hoy no hay nada pendiente. */
  sinSesion: string
  hoy: string
  abrir: (id: string) => void
  detalle?: DetalleDeHoy
  empezada?: boolean
  siguiente?: string
}): React.JSX.Element {
  const [duracion, setDuracion] = useState<string | undefined>(undefined)
  const id = sesion?.agenda.id

  useEffect(() => {
    setDuracion(undefined)
    if (id === undefined || detalle === undefined) return
    let vigente = true
    void (async () => {
      try {
        const leida = await detalle.leerSesion(id)
        if (vigente) setDuracion(leida.prescripcion.duracion)
      } catch {
        // Sin red la tarjeta conserva el resumen de la semana.
      }
    })()
    return () => {
      vigente = false
    }
  }, [id, detalle])

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
            {sesion
              ? [duracion, fechaLegible(hoy)].filter(Boolean).join(" · ")
              : (siguiente ?? fechaLegible(hoy))}
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
    color: tema.acento,
    fontFamily: tema.fuenteTitulo,
    fontSize: 44,
    lineHeight: 48,
    textTransform: "uppercase",
  },
  // David (24-09): el nombre de la sesión, con la misma letra y el mismo dorado que «Hoy toca».
  nombre: { color: tema.acento, fontFamily: tema.fuenteTitulo, textTransform: "uppercase" },
  detalle: { color: tema.textoTenue, fontFamily: tema.fuenteTexto, fontSize: 16 },
})
