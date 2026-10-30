import { useEffect, useRef, useState } from "react"
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native"
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from "react-native-reanimated"

import { vibrar } from "../../componentes/botones"
import { Icono } from "../../componentes/iconos"
import { useMovimientoReducido } from "../../componentes/movimiento"
import { RecorridoSesion } from "../../componentes/recorrido-sesion"
import { alto, espacio, radio, tema, tipo } from "../../tema"
import type { EdicionRegistro, EjercicioConDistancia } from "../registro-modelo"
import { cantidadObjetivo } from "../tabla-series"
import { BotonAtras, Enlace } from "./controles"
import { reloj, resumenPrescrito } from "./modelo"

/** Cabecera de «Sesión en curso»: salir, cronómetro, terminar y progreso de series. */
export function CabeceraSesion({
  hechas,
  total,
  segundos,
  salir,
  terminar,
  ocupado = false,
  deshabilitado = false,
  demoraProgreso = 0,
}: {
  nombre?: string
  hechas: number
  total: number
  /** Segundos desde el inicio; `null` si aún no ha empezado. */
  segundos: number | null
  salir?: () => void
  terminar?: () => void
  ocupado?: boolean
  deshabilitado?: boolean
  demoraProgreso?: number
}): React.JSX.Element {
  const minutos = segundos === null ? 0 : Math.floor(segundos / 60)
  return (
    <View style={s.cabecera}>
      <View style={s.barra}>
        <View style={s.lado}>
          {salir && <BotonAtras etiqueta="Salir de la sesión" onPress={salir} />}
        </View>
        <Text
          style={s.reloj}
          accessibilityRole="timer"
          accessibilityLabel={`Tiempo de sesión: ${minutos} minutos ${(segundos ?? 0) % 60} segundos`}
        >
          {reloj(segundos ?? 0)}
        </Text>
        <View style={[s.lado, s.derecha]}>
          {terminar && (
            <Pressable
              style={({ pressed }) => [s.terminar, pressed && s.pulsado]}
              accessibilityRole="button"
              accessibilityLabel="Terminar"
              accessibilityState={{ busy: ocupado, disabled: ocupado || deshabilitado }}
              disabled={ocupado || deshabilitado}
              onPress={terminar}
            >
              <Text style={s.textoTerminar}>Terminar</Text>
            </Pressable>
          )}
        </View>
      </View>
      <RecorridoSesion hechas={hechas} total={total} demora={demoraProgreso} />
    </View>
  )
}

/** Franja en el flujo de la lista; el caller persiste los ajustes del descanso. */
export function Descanso({
  restante,
  total,
  saltar,
  ajustar,
  animar = true,
}: {
  restante: number
  total: number
  saltar: () => void
  ajustar: (segundos: -15 | 15) => void
  animar?: boolean
}): React.JSX.Element | null {
  const reducido = useMovimientoReducido()
  const estatico = reducido || !animar
  const proporcion = total > 0 ? Math.min(1, Math.max(0, restante / total)) : 0
  const avance = useSharedValue(proporcion)
  const pulso = useSharedValue(1)
  const previo = useRef(restante)
  useEffect(() => {
    cancelAnimation(avance)
    avance.value = proporcion
    if (!estatico && restante > 0)
      avance.value = withTiming(0, { duration: restante * 1000, easing: Easing.linear })
    return () => cancelAnimation(avance)
  }, [proporcion, restante, estatico, avance])
  useEffect(() => {
    const cambio = previo.current !== restante
    const termino = previo.current > 0 && restante <= 0
    previo.current = restante
    if (termino) vibrar("aviso")
    if (cambio && restante > 0 && restante <= 3) vibrar("suave")
    cancelAnimation(pulso)
    pulso.value = 1
    if (cambio && restante > 0 && restante <= 3 && !estatico)
      pulso.value = withSequence(
        withTiming(1.12, { duration: 60 }),
        withTiming(1, { duration: 60 }),
      )
    return () => cancelAnimation(pulso)
  }, [restante, estatico, pulso])
  const relleno = useAnimatedStyle(() => ({ transform: [{ scaleX: avance.value }] }))
  const cuenta = useAnimatedStyle(() => ({ transform: [{ scale: pulso.value }] }))
  if (restante <= 0) return null
  return (
    <View style={s.descanso}>
      <View style={s.medidaDescanso}>
        <Animated.Text
          style={[s.cuenta, cuenta]}
          accessibilityRole="timer"
          accessibilityLabel={`Quedan ${restante} segundos de descanso`}
        >
          {reloj(restante)}
        </Animated.Text>
        <View style={s.pistaDescanso}>
          <Animated.View style={[s.rellenoDescanso, relleno]} />
        </View>
      </View>
      <Enlace texto="−15" etiqueta="Restar 15 segundos de descanso" onPress={() => ajustar(-15)} />
      <Enlace texto="+15" etiqueta="Añadir 15 segundos de descanso" onPress={() => ajustar(15)} />
      <Enlace texto="Saltar" etiqueta="Saltar descanso" onPress={saltar} />
    </View>
  )
}

/**
 * Marcar un ejercicio de la lista: sus series quedan hechas con lo escrito o, si
 * no hay nada, con lo prescrito en su unidad. Desmarcar conserva lo escrito.
 */
export function seriesMarcadas(
  ejercicio: EjercicioConDistancia,
  series: EdicionRegistro["series"],
  hecho: boolean,
): EdicionRegistro["series"] {
  const ids = new Map(ejercicio.series.map((p) => [p.id, p]))
  return series.map((s) => {
    const prescrita = ids.get(s.serieId)
    if (!prescrita) return s
    if (!hecho) return { ...s, hecha: false }
    return {
      ...s,
      hecha: true,
      omitida: undefined,
      valor: s.valor || String(cantidadObjetivo(prescrita)),
      peso: s.peso || (prescrita.pesoKg === null ? "" : String(prescrita.pesoKg).replace(".", ",")),
    }
  })
}

/**
 * Calentamiento o final: una lista que se marca de un toque. Marcar un ejercicio
 * da por hechas sus series con lo prescrito.
 */
export function ListaMarcable({
  titulo,
  ejercicios,
  series,
  bloqueado,
  marcar,
  cambiarPeso,
}: {
  titulo: string
  ejercicios: EjercicioConDistancia[]
  series: EdicionRegistro["series"]
  bloqueado: boolean
  marcar: (ejercicio: EjercicioConDistancia, hecho: boolean) => void
  cambiarPeso: (serieId: string, peso: string) => void
}): React.JSX.Element {
  const hecho = (e: EjercicioConDistancia): boolean =>
    e.series.every((p) => series.find((r) => r.serieId === p.id)?.hecha === true)
  const hechos = ejercicios.filter(hecho).length
  const completo = hechos === ejercicios.length
  const [abierta, setAbierta] = useState(!completo)
  return (
    <View style={s.tarjeta}>
      <Pressable
        style={s.filaLista}
        accessibilityRole="button"
        accessibilityState={{ expanded: abierta }}
        accessibilityLabel={`${titulo}, ${hechos} de ${ejercicios.length} hechos`}
        onPress={() => setAbierta(!abierta)}
      >
        <View style={[s.casilla, completo && s.casillaHecha]}>
          {completo && <Icono nombre="hecho" color={tema.sobreExito} tamano={14} />}
        </View>
        <Text style={s.tituloTarjeta}>{titulo}</Text>
        <Text style={s.tenue}>
          {hechos}/{ejercicios.length}
        </Text>
      </Pressable>
      {abierta &&
        ejercicios.map((ejercicio, n) => {
          const listo = hecho(ejercicio)
          const mostrarPeso =
            ejercicio.tipoCarga === "conCargaExterna" ||
            (ejercicio.tipoCarga === undefined &&
              ejercicio.series.some((serie) => serie.pesoKg !== null))
          return (
            <View key={ejercicio.id} style={[s.bloqueLista, n === 0 && s.primero]}>
              <Pressable
                style={s.elemento}
                accessibilityRole="checkbox"
                aria-checked={listo}
                accessibilityState={{
                  checked: listo,
                  disabled: bloqueado,
                }}
                accessibilityLabel={`${ejercicio.nombre}, ${ejercicio.dosis ?? resumenPrescrito(ejercicio)}`}
                disabled={bloqueado}
                onPress={() => marcar(ejercicio, !listo)}
              >
                <View style={[s.casilla, listo && s.casillaHecha]}>
                  {listo && <Icono nombre="hecho" color={tema.sobreExito} tamano={14} />}
                </View>
                <View style={s.textos}>
                  <Text style={s.nombreElemento}>{ejercicio.nombre}</Text>
                  <Text style={s.tenue}>{ejercicio.dosis ?? resumenPrescrito(ejercicio)}</Text>
                </View>
              </Pressable>
              {mostrarPeso &&
                ejercicio.series.map((prescrita, indice) => (
                  <View key={prescrita.id} style={s.filaPeso}>
                    <Text style={s.tenue}>Serie {indice + 1} · kg opcionales</Text>
                    <TextInput
                      accessibilityLabel={`Peso — ${ejercicio.nombre}, serie ${indice + 1}`}
                      editable={!bloqueado}
                      keyboardType="decimal-pad"
                      maxLength={30}
                      value={series.find((real) => real.serieId === prescrita.id)?.peso ?? ""}
                      onChangeText={(peso) => cambiarPeso(prescrita.id, peso)}
                      placeholder={
                        prescrita.pesoKg === null
                          ? "Opcional"
                          : String(prescrita.pesoKg).replace(".", ",")
                      }
                      placeholderTextColor={tema.marcador}
                      style={s.campoPeso}
                    />
                  </View>
                ))}
            </View>
          )
        })}
    </View>
  )
}

const s = StyleSheet.create({
  cabecera: { gap: espacio[8] },
  barra: { minHeight: alto.barraSuperior, flexDirection: "row", alignItems: "center" },
  lado: { flex: 1, minWidth: 88 },
  derecha: { alignItems: "flex-end" },
  reloj: {
    ...tipo.reloj,
    textAlign: "center",
    color: tema.acento,
  },
  terminar: {
    backgroundColor: tema.acentoSuave,
    borderColor: tema.acento,
    borderWidth: 1,
    minHeight: alto.tactil,
    paddingHorizontal: espacio[12],
    borderRadius: radio.pastilla,
    justifyContent: "center",
  },
  pulsado: { opacity: 0.8 },
  textoTerminar: {
    color: tema.acento,
    fontFamily: tema.fuenteSemi,
    fontSize: 12,
    textTransform: "uppercase",
  },
  tenue: tipo.secundario,
  tarjeta: {
    backgroundColor: tema.superficie,
    borderRadius: radio.tarjeta,
    padding: espacio[16],
    gap: espacio[12],
  },
  descanso: {
    backgroundColor: tema.barraAjuste,
    minHeight: alto.filaSerie,
    borderRadius: radio.campo,
    flexDirection: "row",
    alignItems: "center",
    gap: espacio[12],
    paddingHorizontal: espacio[12],
    marginVertical: espacio[8],
  },
  medidaDescanso: { flex: 1, minWidth: 64, gap: espacio[4] },
  tituloTarjeta: { ...tipo.titulo, flex: 1, color: tema.texto },
  cuenta: {
    ...tipo.cifras,
    color: tema.acento,
    fontFamily: tema.fuenteTitulo,
    fontSize: 26,
    lineHeight: 30,
  },
  pistaDescanso: {
    height: 4,
    borderRadius: 2,
    backgroundColor: tema.superficieAlta,
    overflow: "hidden",
  },
  rellenoDescanso: {
    height: 4,
    backgroundColor: tema.acento,
    transformOrigin: "0% 50%",
  },
  filaLista: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 44 },
  casilla: {
    width: 28,
    height: 28,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: tema.bordeFuerte,
    alignItems: "center",
    justifyContent: "center",
  },
  casillaHecha: { borderColor: tema.exito, backgroundColor: tema.exito },
  bloqueLista: { gap: 8, borderTopWidth: 1, borderTopColor: tema.borde, paddingTop: 10 },
  elemento: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 48,
  },
  primero: { marginTop: 2 },
  textos: { flex: 1, gap: 2 },
  nombreElemento: { color: tema.texto, fontFamily: tema.fuenteSemi, fontSize: 15 },
  filaPeso: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  campoPeso: {
    width: 112,
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: tema.bordeFuerte,
    backgroundColor: tema.superficie,
    color: tema.texto,
    fontFamily: tema.fuenteBoton,
    fontSize: 16,
    textAlign: "center",
  },
})
