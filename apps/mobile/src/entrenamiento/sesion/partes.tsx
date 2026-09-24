import { useState } from "react"
import { Pressable, StyleSheet, Text, View } from "react-native"
import type { EjercicioPrescrito } from "@alpha-omega/shared"

import { Icono } from "../../componentes/iconos"
import { degradadoExito, degradadoOro, tema } from "../../tema"
import type { EdicionRegistro } from "../registro-modelo"
import { BotonAtras, Enlace } from "./controles"
import { reloj, resumenPrescrito } from "./modelo"

/** Cabecera de «Sesión en curso»: salir, cronómetro, terminar y progreso de series. */
export function CabeceraSesion({
  nombre,
  hechas,
  total,
  segundos,
  salir,
  terminar,
}: {
  nombre: string
  hechas: number
  total: number
  /** Segundos desde el inicio; `null` si aún no ha empezado. */
  segundos: number | null
  salir?: () => void
  terminar?: () => void
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
              onPress={terminar}
            >
              <Text style={s.textoTerminar}>Terminar</Text>
            </Pressable>
          )}
        </View>
      </View>
      <View style={s.progresoTexto}>
        <Text style={s.nombre} accessibilityRole="header">
          {nombre}
        </Text>
        <Text style={s.tenue}>
          {hechas} de {total} series
        </Text>
      </View>
      <View
        style={s.pista}
        accessibilityRole="progressbar"
        accessibilityLabel="Series hechas"
        accessibilityValue={{ min: 0, max: total, now: hechas }}
      >
        <View style={[s.relleno, { width: `${total === 0 ? 0 : (hechas / total) * 100}%` }]} />
      </View>
    </View>
  )
}

/** «Descanso 1:24 · Saltar descanso», con la barra que se vacía. */
export function Descanso({
  restante,
  total,
  saltar,
}: {
  restante: number
  total: number
  saltar: () => void
}): React.JSX.Element {
  return (
    <View style={s.tarjeta} accessibilityLiveRegion="polite">
      <View style={s.filaDescanso}>
        <Text style={s.tituloTarjeta}>Descanso</Text>
        <Text style={s.cuenta} accessibilityLabel={`Quedan ${restante} segundos de descanso`}>
          {reloj(restante)}
        </Text>
        <Enlace texto="Saltar descanso" onPress={saltar} />
      </View>
      <View style={s.pistaDescanso}>
        <View style={[s.relleno, { width: `${total === 0 ? 0 : (restante / total) * 100}%` }]} />
      </View>
    </View>
  )
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
}: {
  titulo: string
  ejercicios: EjercicioPrescrito[]
  series: EdicionRegistro["series"]
  bloqueado: boolean
  marcar: (ejercicio: EjercicioPrescrito, hecho: boolean) => void
}): React.JSX.Element {
  const hecho = (e: EjercicioPrescrito): boolean =>
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
        <View style={[s.circulo, completo && [s.circuloHecho, degradadoExito]]}>
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
          return (
            <Pressable
              key={ejercicio.id}
              style={[s.elemento, n === 0 && s.primero]}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: listo, disabled: bloqueado }}
              accessibilityLabel={`${ejercicio.nombre}, ${ejercicio.dosis ?? resumenPrescrito(ejercicio)}`}
              disabled={bloqueado}
              onPress={() => marcar(ejercicio, !listo)}
            >
              <View style={[s.circulo, listo && [s.circuloHecho, degradadoExito]]}>
                {listo && <Icono nombre="hecho" color={tema.sobreExito} tamano={14} />}
              </View>
              <View style={s.textos}>
                <Text style={s.nombreElemento}>{ejercicio.nombre}</Text>
                <Text style={s.tenue}>{ejercicio.dosis ?? resumenPrescrito(ejercicio)}</Text>
              </View>
            </Pressable>
          )
        })}
    </View>
  )
}

const s = StyleSheet.create({
  cabecera: { gap: 12 },
  barra: { flexDirection: "row", alignItems: "center" },
  lado: { width: 100 },
  derecha: { alignItems: "flex-end" },
  reloj: {
    flex: 1,
    textAlign: "center",
    color: tema.acento,
    fontFamily: tema.fuenteTitulo,
    fontSize: 30,
    lineHeight: 34,
  },
  terminar: {
    ...degradadoOro,
    height: 44,
    paddingHorizontal: 14,
    borderRadius: 12,
    justifyContent: "center",
  },
  pulsado: { opacity: 0.8 },
  textoTerminar: { color: tema.sobreAcento, fontFamily: tema.fuenteBoton, fontSize: 15 },
  progresoTexto: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
  nombre: { color: tema.textoTenue, fontFamily: tema.fuenteSemi, fontSize: 13 },
  tenue: { color: tema.textoTenue, fontFamily: tema.fuenteTexto, fontSize: 13 },
  pista: { height: 3, backgroundColor: tema.borde, overflow: "hidden" },
  relleno: { height: 3, ...degradadoOro },
  tarjeta: { backgroundColor: tema.superficie, borderRadius: 20, padding: 16, gap: 12 },
  filaDescanso: { flexDirection: "row", alignItems: "center", gap: 12 },
  tituloTarjeta: { flex: 1, color: tema.texto, fontFamily: tema.fuenteBoton, fontSize: 16 },
  cuenta: { color: tema.acento, fontFamily: tema.fuenteTitulo, fontSize: 30, lineHeight: 34 },
  pistaDescanso: {
    height: 4,
    borderRadius: 2,
    backgroundColor: tema.superficieAlta,
    overflow: "hidden",
  },
  filaLista: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 44 },
  circulo: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: tema.bordeFuerte,
    alignItems: "center",
    justifyContent: "center",
  },
  circuloHecho: { borderColor: "transparent" },
  elemento: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 48,
    borderTopWidth: 1,
    borderTopColor: tema.borde,
    paddingTop: 10,
  },
  primero: { marginTop: 2 },
  textos: { flex: 1, gap: 2 },
  nombreElemento: { color: tema.texto, fontFamily: tema.fuenteSemi, fontSize: 15 },
})
