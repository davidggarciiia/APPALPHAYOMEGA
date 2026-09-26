import { useCallback, useState } from "react"
import { useFocusEffect, useRouter, type Href } from "expo-router"
import { StyleSheet, Text, View } from "react-native"
import Animated, { FadeIn } from "react-native-reanimated"
import type { Reserva, ResumenSaldo } from "@alpha-omega/shared"

import { Icono } from "../componentes/iconos"
import { Pulsable } from "../componentes/pulsable"
import { useMovimientoReducido } from "../lib/movimiento"
import { degradadoOro, tema } from "../tema"
import type { ApiReservas } from "./api"
import { fechaTitulo, local, sesiones, tramo } from "./formato"

type Estado =
  | { fase: "cargando" }
  | { fase: "listo"; proxima: Reserva | null; saldo: ResumenSaldo | null }
  | { fase: "error" }

/**
 * «Tu próxima cita» en el inicio del cliente: la reserva más cercana con su día
 * y su hora, o, si no tiene ninguna, cuántas sesiones le quedan y un acceso a
 * reservar. Recarga al volver a la pantalla. Si falla, no ocupa sitio: la pestaña
 * Reservar tiene el detalle y sus errores.
 */
export function ProximaCita({
  api,
}: {
  api: Pick<ApiReservas, "misReservas" | "miSaldo">
}): React.JSX.Element | null {
  const router = useRouter()
  const reducido = useMovimientoReducido()
  const [estado, setEstado] = useState<Estado>({ fase: "cargando" })

  useFocusEffect(
    useCallback(() => {
      let vigente = true
      Promise.all([api.misReservas(), api.miSaldo().catch(() => null)])
        .then(([mias, saldo]) => {
          if (vigente) setEstado({ fase: "listo", proxima: mias.proximas[0] ?? null, saldo })
        })
        .catch(() => {
          if (vigente) setEstado({ fase: "error" })
        })
      return () => {
        vigente = false
      }
    }, [api]),
  )

  if (estado.fase !== "listo") return null
  const { proxima, saldo } = estado
  const irAReservar = (): void => router.push("/reservar" as Href)
  const quedan = saldo?.ep.disponibles ?? null

  if (proxima === null)
    return (
      <Animated.View entering={reducido ? undefined : FadeIn.duration(220)}>
        <Pulsable
          style={s.tarjeta}
          accessibilityRole="button"
          accessibilityLabel={`Reserva tu próxima sesión${quedan === null ? "" : `. Te quedan ${sesiones(quedan)}`}`}
          onPress={irAReservar}
        >
          <View style={s.fila}>
            <View style={s.textos}>
              <Text style={s.marca}>Tu próxima cita</Text>
              <Text style={s.titulo}>Reserva tu próxima sesión</Text>
              <Text style={s.detalle}>
                {quedan === null || quedan === 0
                  ? "Elige un hueco con tu entrenador."
                  : `Te quedan ${sesiones(quedan)}.`}
              </Text>
            </View>
            <View style={[s.boton, degradadoOro]}>
              <Text style={s.textoBoton}>Reservar</Text>
            </View>
          </View>
        </Pulsable>
      </Animated.View>
    )

  const { fecha } = local(proxima.inicio)
  return (
    <Animated.View entering={reducido ? undefined : FadeIn.duration(220)}>
      <Pulsable
        style={[s.tarjeta, s.destacada]}
        accessibilityRole="button"
        accessibilityLabel={`Tu próxima cita: ${fechaTitulo(fecha)}, ${tramo(proxima)}, ${proxima.servicio.nombre}. Abre tus reservas`}
        onPress={irAReservar}
      >
        <View style={s.fila}>
          <View style={s.calendario} aria-hidden>
            <Icono nombre="agenda" color={tema.acento} tamano={22} />
          </View>
          <View style={s.textos}>
            <Text style={s.marca}>Tu próxima cita</Text>
            <Text style={s.titulo}>{fechaTitulo(fecha)}</Text>
            <Text style={s.detalle}>
              {tramo(proxima)} · {proxima.servicio.nombre}
              {proxima.personas > 1 ? ` · ${proxima.personas} personas` : ""}
            </Text>
          </View>
          <Icono nombre="adelante" color={tema.textoTenue} />
        </View>
      </Pulsable>
    </Animated.View>
  )
}

const s = StyleSheet.create({
  tarjeta: { backgroundColor: tema.superficie, borderRadius: 20, padding: 18 },
  destacada: { borderWidth: 1, borderColor: tema.bordeDestacado },
  fila: { flexDirection: "row", alignItems: "center", gap: 14 },
  calendario: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: tema.acentoSuave,
    alignItems: "center",
    justifyContent: "center",
  },
  textos: { flex: 1, minWidth: 0, gap: 3 },
  marca: {
    color: tema.acento,
    fontFamily: tema.fuenteSemi,
    fontSize: 12,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  titulo: { color: tema.texto, fontFamily: tema.fuenteBoton, fontSize: 18 },
  detalle: { color: tema.textoTenue, fontFamily: tema.fuenteTexto, fontSize: 14, lineHeight: 20 },
  boton: { minHeight: 44, paddingHorizontal: 16, borderRadius: 12, justifyContent: "center" },
  textoBoton: { color: tema.sobreAcento, fontFamily: tema.fuenteBoton, fontSize: 15 },
})
