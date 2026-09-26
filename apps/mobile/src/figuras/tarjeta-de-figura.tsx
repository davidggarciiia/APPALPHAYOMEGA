import { StyleSheet, Text, View } from "react-native"

import { Pulsable } from "../componentes/pulsable"
import { fuentes, tema } from "../tema"

import { figuraPara } from "./figura-para"
import { FiguraPressBanca } from "./figura-press-banca"

/**
 * La tarjeta con la figura encima de un ejercicio, como en Sesion.dc.html:
 * fondo de tarjeta, la figura centrada y «Técnica» abajo a la derecha.
 *
 * Si el ejercicio todavía no tiene figura no pinta nada.
 */
export function TarjetaDeFigura({
  nombre,
  onTecnica,
}: {
  nombre: string
  onTecnica?: () => void
}): React.JSX.Element | null {
  if (figuraPara(nombre) === null) {
    return null
  }
  const contenido = (
    <>
      <View style={estilos.centro}>
        <FiguraPressBanca />
      </View>
      {onTecnica !== undefined && <Text style={estilos.tecnica}>Técnica</Text>}
    </>
  )
  if (onTecnica === undefined) {
    return <View style={estilos.tarjeta}>{contenido}</View>
  }
  return (
    <Pulsable
      style={estilos.tarjeta}
      onPress={onTecnica}
      accessibilityRole="button"
      accessibilityLabel={`${nombre}: ver técnica`}
    >
      {contenido}
    </Pulsable>
  )
}

const estilos = StyleSheet.create({
  tarjeta: {
    height: 190,
    borderRadius: 20,
    backgroundColor: tema.superficie,
    overflow: "hidden",
    justifyContent: "center",
  },
  centro: { alignItems: "center", marginTop: -18 },
  tecnica: {
    position: "absolute",
    right: 16,
    bottom: 12,
    color: tema.oro,
    fontSize: 13,
    fontFamily: fuentes.semi,
  },
})
