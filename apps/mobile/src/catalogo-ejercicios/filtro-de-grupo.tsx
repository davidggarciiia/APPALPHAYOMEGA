import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native"
import { GRUPOS_MUSCULARES, type GrupoMuscular } from "@alpha-omega/shared"

import { degradadoOro, tema } from "../tema"

import { ETIQUETA_DE_GRUPO } from "./grupos"

/**
 * Los once grupos musculares y «Todos» en una fila que se desliza. Lo comparten la
 * pantalla Ejercicios y el selector del constructor: con 1.387 ejercicios, buscar
 * por nombre no basta.
 */
export function FiltroDeGrupo({
  grupo,
  cambiar,
  margenHorizontal = 0,
}: {
  grupo: GrupoMuscular | null
  cambiar: (grupo: GrupoMuscular | null) => void
  /** Aire a los lados de la fila, para pantallas que no lo ponen ya en su contenedor. */
  margenHorizontal?: number
}): React.JSX.Element {
  return (
    <View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[estilos.filtros, { paddingHorizontal: margenHorizontal }]}
        keyboardShouldPersistTaps="handled"
      >
        <Ficha
          texto="Todos"
          nombre="Quitar el filtro de grupo"
          puesto={grupo === null}
          onPress={() => {
            cambiar(null)
          }}
        />
        {GRUPOS_MUSCULARES.map((opcion) => (
          <Ficha
            key={opcion}
            texto={ETIQUETA_DE_GRUPO[opcion]}
            nombre={`Filtrar por ${ETIQUETA_DE_GRUPO[opcion]}`}
            puesto={opcion === grupo}
            onPress={() => {
              cambiar(opcion)
            }}
          />
        ))}
      </ScrollView>
    </View>
  )
}

function Ficha({
  texto,
  nombre,
  puesto,
  onPress,
}: {
  texto: string
  nombre: string
  puesto: boolean
  onPress: () => void
}): React.JSX.Element {
  return (
    <Pressable
      style={[estilos.filtro, puesto && estilos.filtroPuesto]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={nombre}
      accessibilityState={{ selected: puesto }}
      hitSlop={6}
    >
      <Text style={[estilos.textoFiltro, puesto && estilos.textoFiltroPuesto]}>{texto}</Text>
    </Pressable>
  )
}

const estilos = StyleSheet.create({
  filtros: { gap: 8, paddingTop: 12, paddingBottom: 4 },
  filtro: {
    borderColor: tema.borde,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 44,
    justifyContent: "center",
  },
  filtroPuesto: { ...degradadoOro, borderColor: "transparent" },
  textoFiltro: {
    fontFamily: tema.fuenteSemi,
    color: tema.textoTenue,
    fontSize: 13,
  },
  textoFiltroPuesto: { color: tema.fondo },
})
