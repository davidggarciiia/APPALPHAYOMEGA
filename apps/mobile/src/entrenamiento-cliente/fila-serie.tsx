import { useState } from "react"
import { StyleSheet, Text, TextInput, View } from "react-native"
import type { SeriePrescrita } from "@alpha-omega/shared"

import { RellenoVerde, Visto } from "../componentes/diseno"
import { Pulsable } from "../componentes/pulsable"
import { fuentes, tema } from "../tema"

import type { EntradaSerie } from "./copia-local"
import { formatearNumero, leerEntero, leerPeso, motivoParaNoMarcar } from "./valores"

/**
 * Una serie: kilos, repeticiones o segundos, y «hecha». Diseño de Sesion.dc.html.
 *
 * El objetivo aparece tenue dentro del campo vacío, pero NO es un valor: marcar
 * sin escribir nada no registra el objetivo, avisa de lo que falta. Las
 * etiquetas y unidades se leen siempre, también con lector de pantalla.
 *
 * `actual` es la siguiente serie por hacer: va resaltada, como en el diseño.
 */
export function FilaSerie({
  numero,
  serie,
  entrada,
  editable,
  actual = false,
  alCambiar,
}: {
  numero: number
  serie: SeriePrescrita
  entrada: EntradaSerie
  editable: boolean
  actual?: boolean
  alCambiar: (entrada: EntradaSerie) => void
}): React.JSX.Element {
  const [aviso, setAviso] = useState<string | null>(null)
  const porTiempo = serie.tipoMedicion === "tiempo"
  const objetivoValor = porTiempo ? serie.segundos : serie.repeticiones
  const unidad = porTiempo ? "segundos" : "repeticiones"

  const peso = leerPeso(entrada.peso)
  const valor = leerEntero(entrada.valor, serie.tipoMedicion)
  const errorCampo = !peso.ok ? peso.error : !valor.ok ? valor.error : null

  const marcar = (): void => {
    if (entrada.hecha) {
      // Desmarcar conserva lo escrito para poder corregirlo.
      setAviso(null)
      alCambiar({ ...entrada, hecha: false })
      return
    }
    const motivo = motivoParaNoMarcar(serie, entrada)
    setAviso(motivo)
    if (motivo === null) {
      alCambiar({ ...entrada, hecha: true })
    }
  }

  const texto = aviso ?? errorCampo
  const campo = [estilos.campo, actual && estilos.campoActual]

  const fila = (
    <View style={estilos.fila}>
      <Text
        style={[estilos.numero, actual && estilos.numeroActual]}
        accessibilityLabel={`Serie ${String(numero)}`}
      >
        {String(numero)}
      </Text>
      <TextInput
        style={[campo, actual && estilos.campoFoco, !peso.ok && estilos.campoMal]}
        value={entrada.peso}
        onChangeText={(peso) => {
          setAviso(null)
          alCambiar({ ...entrada, peso })
        }}
        placeholder={serie.pesoKg === null ? "—" : formatearNumero(serie.pesoKg)}
        placeholderTextColor={tema.marcador}
        keyboardType="decimal-pad"
        editable={editable}
        accessibilityLabel={`Peso en kilos de la serie ${String(numero)}${
          serie.pesoKg === null ? ", opcional" : `, objetivo ${formatearNumero(serie.pesoKg)} kilos`
        }`}
        aria-invalid={!peso.ok}
      />
      <TextInput
        style={[campo, !valor.ok && estilos.campoMal]}
        value={entrada.valor}
        onChangeText={(texto) => {
          setAviso(null)
          alCambiar({ ...entrada, valor: texto })
        }}
        placeholder={String(objetivoValor)}
        placeholderTextColor={tema.marcador}
        keyboardType="number-pad"
        editable={editable}
        accessibilityLabel={`${porTiempo ? "Tiempo en segundos" : "Repeticiones"} de la serie ${String(
          numero,
        )}, objetivo ${String(objetivoValor)} ${unidad}`}
        aria-invalid={!valor.ok}
      />
      <Pulsable
        onPress={marcar}
        disabled={!editable}
        style={[
          estilos.marca,
          !entrada.hecha && (actual ? estilos.marcaActual : estilos.marcaVacia),
        ]}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: entrada.hecha, disabled: !editable }}
        accessibilityLabel={`Serie ${String(numero)} hecha`}
      >
        {entrada.hecha && <RellenoVerde radio={10} />}
        {(entrada.hecha || actual) && (
          <Visto color={entrada.hecha ? tema.sobreVerde : tema.verdeClaro} />
        )}
      </Pulsable>
    </View>
  )

  return (
    <View style={actual && estilos.bloqueActual}>
      {fila}
      {texto !== null && (
        <Text style={estilos.aviso} accessibilityRole="alert">
          {texto}
        </Text>
      )}
    </View>
  )
}

/** Cabecera de la tabla, con las unidades escritas. */
export function CabeceraDeSeries({ porTiempo }: { porTiempo: boolean }): React.JSX.Element {
  return (
    <View
      style={estilos.fila}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Text style={[estilos.numeroCabecera, estilos.encabezado]}>Serie</Text>
      <Text style={[estilos.columna, estilos.encabezado]}>Kg</Text>
      <Text style={[estilos.columna, estilos.encabezado]}>{porTiempo ? "Segundos" : "Reps"}</Text>
      <View style={estilos.cabeceraMarca} />
    </View>
  )
}

const estilos = StyleSheet.create({
  fila: { flexDirection: "row", alignItems: "center", gap: 8 },
  bloqueActual: {
    marginHorizontal: -10,
    padding: 10,
    borderRadius: 14,
    backgroundColor: tema.superficie,
  },
  numero: {
    width: 36,
    color: tema.textoTenue,
    fontSize: 15,
    fontFamily: fuentes.semi,
    textAlign: "center",
  },
  numeroActual: { color: tema.oro, fontFamily: fuentes.negrita },
  numeroCabecera: { width: 36 },
  encabezado: {
    color: tema.textoTenue,
    fontSize: 12,
    fontFamily: fuentes.normal,
    textAlign: "center",
  },
  columna: { flex: 1 },
  cabeceraMarca: { width: 44 },
  campo: {
    flex: 1,
    // Sin esto, en web el <input> impone su ancho intrínseco y la fila desborda.
    minWidth: 0,
    width: 0,
    height: 44,
    borderRadius: 10,
    backgroundColor: tema.superficie,
    color: tema.texto,
    fontSize: 17,
    fontFamily: fuentes.negrita,
    textAlign: "center",
    padding: 0,
  },
  campoActual: { backgroundColor: tema.superficieAlta },
  campoFoco: { borderWidth: 1.5, borderColor: tema.oro },
  campoMal: { borderWidth: 1.5, borderColor: tema.error },
  marca: {
    width: 44,
    height: 44,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  marcaVacia: { borderWidth: 1.5, borderColor: tema.aro },
  marcaActual: {
    borderWidth: 1.5,
    borderColor: tema.verde,
    backgroundColor: "rgba(61, 187, 108, 0.12)",
  },
  aviso: {
    color: tema.error,
    fontSize: 13,
    fontFamily: fuentes.normal,
    marginLeft: 44,
    marginTop: 6,
  },
})
