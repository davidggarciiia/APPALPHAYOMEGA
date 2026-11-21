import { Pressable, StyleSheet, Text, View } from "react-native"

import { Icono } from "../../componentes/iconos"
import { tema } from "../../tema"
import { sumarDias } from "../fechas"
import { fechaCorta } from "./modelo"

/** «21 sep — 27 sep» con las flechas de semana anterior y siguiente. */
export function SelectorDeSemana({
  semana,
  cambiarSemana,
}: {
  semana: string
  cambiarSemana: (dias: number) => void
}): React.JSX.Element {
  return (
    <View style={s.fila}>
      <Text style={s.intervalo}>
        {fechaCorta(semana)} — {fechaCorta(sumarDias(semana, 6))}
      </Text>
      <Pressable
        style={s.flecha}
        accessibilityRole="button"
        accessibilityLabel="Semana anterior"
        onPress={() => cambiarSemana(-7)}
      >
        <Icono nombre="atras" color={tema.texto} tamano={20} />
      </Pressable>
      <Pressable
        style={s.flecha}
        accessibilityRole="button"
        accessibilityLabel="Semana siguiente"
        onPress={() => cambiarSemana(7)}
      >
        <Icono nombre="adelante" color={tema.texto} tamano={20} />
      </Pressable>
    </View>
  )
}

const s = StyleSheet.create({
  fila: { flexDirection: "row", alignItems: "center", gap: 8 },
  intervalo: { flex: 1, color: tema.texto, fontFamily: tema.fuenteSemi, fontSize: 16 },
  flecha: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
  },
})
