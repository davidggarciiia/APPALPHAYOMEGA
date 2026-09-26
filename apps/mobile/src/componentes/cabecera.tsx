import type { ReactNode } from "react"
import { Pressable, StyleSheet, Text, View } from "react-native"

import { tema } from "../tema"

/** Título en oro y «VOLVER», como en la cartera. */
export function Cabecera({
  titulo,
  onVolver,
  derecha,
}: {
  titulo: string
  onVolver?: () => void
  derecha?: ReactNode
}): React.JSX.Element {
  return (
    <View style={estilos.cabecera}>
      <View style={estilos.izquierda}>
        {onVolver !== undefined && (
          <Pressable onPress={onVolver} hitSlop={12} accessibilityRole="button">
            <Text style={estilos.volver}>‹ VOLVER</Text>
          </Pressable>
        )}
        <Text style={estilos.titulo} accessibilityRole="header" numberOfLines={1}>
          {titulo}
        </Text>
      </View>
      {derecha}
    </View>
  )
}

/** Aviso destacado: sin conexión, conflicto, sesión anulada. */
export function Aviso({
  tono = "info",
  children,
}: {
  tono?: "info" | "error" | "exito"
  children: ReactNode
}): React.JSX.Element {
  return (
    <View
      style={[
        estilos.aviso,
        tono === "error" && estilos.avisoError,
        tono === "exito" && estilos.avisoExito,
      ]}
      accessibilityLiveRegion="polite"
    >
      {children}
    </View>
  )
}

/** Pastilla de estado con texto, nunca solo color. */
export function Pastilla({
  texto,
  tono = "neutro",
}: {
  texto: string
  tono?: "neutro" | "oro" | "exito"
}): React.JSX.Element {
  return (
    <View
      style={[
        estilos.pastilla,
        tono === "oro" && estilos.pastillaOro,
        tono === "exito" && estilos.pastillaExito,
      ]}
    >
      <Text
        style={[
          estilos.textoPastilla,
          tono === "oro" && estilos.textoPastillaOro,
          tono === "exito" && estilos.textoPastillaExito,
        ]}
      >
        {texto}
      </Text>
    </View>
  )
}

const estilos = StyleSheet.create({
  cabecera: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 10,
  },
  izquierda: { flexShrink: 1 },
  volver: { color: tema.textoTenue, fontSize: 12, letterSpacing: 2, marginBottom: 8 },
  titulo: { color: tema.oro, fontSize: 16, fontWeight: "700", letterSpacing: 3 },
  aviso: {
    borderWidth: 1,
    borderColor: tema.borde,
    backgroundColor: tema.superficie,
    borderRadius: 10,
    padding: 14,
    gap: 10,
  },
  avisoError: { borderColor: tema.error },
  avisoExito: { borderColor: tema.oro },
  pastilla: {
    borderWidth: 1,
    borderColor: tema.borde,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
    alignSelf: "flex-start",
  },
  pastillaOro: { borderColor: tema.oro },
  pastillaExito: { backgroundColor: tema.oro, borderColor: tema.oro },
  textoPastilla: { color: tema.textoTenue, fontSize: 10, fontWeight: "700", letterSpacing: 1.5 },
  textoPastillaOro: { color: tema.oro },
  textoPastillaExito: { color: tema.fondo },
})
