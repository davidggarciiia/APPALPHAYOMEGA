import type { ReactNode } from "react"
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native"

import { tema } from "../../tema"

/** «Rutina · Bloque · Guía», con la pestaña activa subrayada en dorado. */
export function Pestanas<T extends string>({
  opciones,
  activa,
  cambiar,
  bloquearCambio = false,
}: {
  opciones: ReadonlyArray<{ valor: T; texto: string }>
  activa: T
  cambiar: (valor: T) => void
  bloquearCambio?: boolean
}): React.JSX.Element {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={s.pestanas}
      contentContainerStyle={s.filaPestanas}
      accessibilityRole="tablist"
    >
      {opciones.map((opcion) => {
        const elegida = opcion.valor === activa
        return (
          <Pressable
            key={opcion.valor}
            accessibilityRole="tab"
            accessibilityState={{ selected: elegida, disabled: bloquearCambio && !elegida }}
            disabled={bloquearCambio && !elegida}
            onPress={() => cambiar(opcion.valor)}
            style={[s.pestana, elegida && s.pestanaActiva]}
          >
            <Text style={[s.textoPestana, elegida && s.textoActivo]}>{opcion.texto}</Text>
          </Pressable>
        )
      })}
    </ScrollView>
  )
}

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
export function Tarjeta({ children }: { children: ReactNode }): React.JSX.Element {
  return <View style={s.tarjeta}>{children}</View>
}

export function Fila({
  children,
  primera = false,
}: {
  children: ReactNode
  primera?: boolean
}): React.JSX.Element {
  return <View style={[s.fila, !primera && s.separada]}>{children}</View>
}

const s = StyleSheet.create({
  pestanas: { flexGrow: 0, borderBottomWidth: 1, borderBottomColor: tema.borde },
  filaPestanas: { flexDirection: "row", gap: 24 },
  pestana: {
    minHeight: 44,
    justifyContent: "center",
    borderBottomWidth: 2,
    borderColor: "transparent",
  },
  pestanaActiva: { borderBottomColor: tema.acento },
  textoPestana: { color: tema.textoTenue, fontFamily: tema.fuenteSemi, fontSize: 16 },
  textoActivo: { color: tema.texto },
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
  tarjeta: { backgroundColor: tema.superficie, borderRadius: 20, paddingHorizontal: 16 },
  fila: { paddingVertical: 14, flexDirection: "row", gap: 12, alignItems: "flex-start" },
  separada: { borderTopWidth: 1, borderTopColor: tema.borde },
})
