import type { ReactNode } from "react"
import { StyleSheet, Text, View } from "react-native"

import { Tarjeta as TarjetaBase, type VarianteTarjeta } from "../../componentes/piezas"
import { tema } from "../../tema"
export { Chip, Fila, Pestanas } from "../../componentes/piezas"

/** Título de bloque: «Qué buscamos», con un texto opcional a la derecha. */
export function Titulo({
  children,
  derecha,
  grande = false,
}: {
  children: string
  derecha?: string | null
  /** En Anton y mayúsculas, como «CALENTAMIENTO». */
  grande?: boolean
}): React.JSX.Element {
  return (
    <View style={s.titulo}>
      <Text style={grande ? s.tituloGrande : s.tituloNormal} accessibilityRole="header">
        {children}
      </Text>
      {derecha ? <Text style={grande ? s.derechaDorada : s.derechaTenue}>{derecha}</Text> : null}
    </View>
  )
}

/** Tarjeta de filas separadas por una línea fina. */
export function Tarjeta({
  children,
  variante = "lista",
}: {
  children: ReactNode
  variante?: VarianteTarjeta
}): React.JSX.Element {
  return <TarjetaBase variante={variante}>{children}</TarjetaBase>
}

const s = StyleSheet.create({
  titulo: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: 12,
  },
  tituloNormal: { color: tema.texto, fontFamily: tema.fuenteBoton, fontSize: 20, flexShrink: 1 },
  tituloGrande: {
    color: tema.texto,
    fontFamily: tema.fuenteTitulo,
    fontSize: 24,
    lineHeight: 28,
    textTransform: "uppercase",
    flexShrink: 1,
  },
  derechaDorada: { color: tema.acento, fontFamily: tema.fuenteBoton, fontSize: 15 },
  derechaTenue: { color: tema.textoTenue, fontFamily: tema.fuenteTexto, fontSize: 13 },
})
