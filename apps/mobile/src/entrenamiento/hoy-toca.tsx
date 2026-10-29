import { useEffect, useState } from "react"
import { Image, StyleSheet, Text, View } from "react-native"
import type { Ejercicio, ResumenSesion, SesionCliente } from "@alpha-omega/shared"

import { FiguraDeEjercicio, type AccesoAFiguras } from "../catalogo-ejercicios/figura-ejercicio"
import { tema } from "../tema"
import { BotonPrincipal } from "../componentes/botones"
import { fechaLegible } from "./fechas"
import entrenamiento from "../../assets/entrenamiento.webp"

/** Lo que hace falta para enseñar el primer ejercicio de hoy con su animación. */
export type DetalleDeHoy = {
  leerSesion: (id: string) => Promise<SesionCliente>
  leerEjercicio: (id: string) => Promise<Ejercicio>
  acceso: AccesoAFiguras
}

type Primero = { sesion: SesionCliente; ejercicio: Ejercicio | null }

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

/** «Hoy toca»: la sesión de hoy con la animación de su primer ejercicio. */
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
  const [primero, setPrimero] = useState<Primero | null>(null)
  const id = sesion?.agenda.id

  useEffect(() => {
    setPrimero(null)
    if (id === undefined || detalle === undefined) return
    let vigente = true
    void (async () => {
      try {
        const leida = await detalle.leerSesion(id)
        const prescrito =
          leida.prescripcion.ejercicios.find((e) => (e.seccion ?? "principal") === "principal") ??
          leida.prescripcion.ejercicios[0]
        const ejercicio = prescrito
          ? await detalle.leerEjercicio(prescrito.ejercicioId).catch(() => null)
          : null
        if (vigente) setPrimero({ sesion: leida, ejercicio })
      } catch {
        // Sin red la tarjeta sigue con la foto y el nombre de la semana.
      }
    })()
    return () => {
      vigente = false
    }
  }, [id, detalle])

  const nombre = sesion?.nombre ?? sinSesion
  const duracion = primero?.sesion.prescripcion.duracion
  const figura = primero?.ejercicio?.figura ?? null
  return (
    <View style={s.destacado}>
      {sesion && (
        <View style={s.medio}>
          {figura !== null && primero?.ejercicio && detalle ? (
            <FiguraDeEjercicio
              acceso={detalle.acceso}
              ejercicioId={primero.ejercicio.id}
              figura={figura}
              nombre={primero.ejercicio.nombre}
              alto={176}
            />
          ) : (
            <Image source={entrenamiento} style={s.imagen} resizeMode="cover" accessible={false} />
          )}
          {primero?.ejercicio && (
            <Text style={s.etiqueta} numberOfLines={1}>
              {primero.ejercicio.nombre}
            </Text>
          )}
        </View>
      )}
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
  medio: { height: 176, borderRadius: 14, backgroundColor: tema.hundido, overflow: "hidden" },
  imagen: { width: "100%", height: "100%" },
  etiqueta: {
    position: "absolute",
    left: 14,
    right: 64,
    bottom: 12,
    color: tema.textoSecundario,
    fontFamily: tema.fuenteTexto,
    fontSize: 13,
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
