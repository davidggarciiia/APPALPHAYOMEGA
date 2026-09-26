import { useState } from "react"
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native"
import type { SeriePrescrita } from "@alpha-omega/shared"

import { tema } from "../tema"

import type { EntradaSerie } from "./copia-local"
import { formatearNumero, leerEntero, leerPeso, motivoParaNoMarcar } from "./valores"

/**
 * Una serie: peso, repeticiones o tiempo, y «Hecha».
 *
 * El objetivo aparece tenue dentro del campo vacío, pero NO es un valor: marcar
 * sin escribir nada no registra el objetivo, avisa de lo que falta. Las
 * etiquetas y unidades se leen siempre, también con lector de pantalla.
 */
export function FilaSerie({
  numero,
  serie,
  entrada,
  editable,
  alCambiar,
}: {
  numero: number
  serie: SeriePrescrita
  entrada: EntradaSerie
  editable: boolean
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

  return (
    <View>
      <View style={[estilos.fila, entrada.hecha && estilos.filaHecha]}>
        <Text style={estilos.numero} accessibilityLabel={`Serie ${String(numero)}`}>
          {String(numero)}
        </Text>
        <TextInput
          style={[estilos.campo, !peso.ok && estilos.campoMal]}
          value={entrada.peso}
          onChangeText={(peso) => {
            setAviso(null)
            alCambiar({ ...entrada, peso })
          }}
          placeholder={serie.pesoKg === null ? "opc." : formatearNumero(serie.pesoKg)}
          placeholderTextColor={tema.textoTenue}
          keyboardType="decimal-pad"
          editable={editable}
          accessibilityLabel={`Peso en kilos de la serie ${String(numero)}${
            serie.pesoKg === null
              ? ", opcional"
              : `, objetivo ${formatearNumero(serie.pesoKg)} kilos`
          }`}
          aria-invalid={!peso.ok}
        />
        <TextInput
          style={[estilos.campo, !valor.ok && estilos.campoMal]}
          value={entrada.valor}
          onChangeText={(texto) => {
            setAviso(null)
            alCambiar({ ...entrada, valor: texto })
          }}
          placeholder={String(objetivoValor)}
          placeholderTextColor={tema.textoTenue}
          keyboardType="number-pad"
          editable={editable}
          accessibilityLabel={`${porTiempo ? "Tiempo en segundos" : "Repeticiones"} de la serie ${String(
            numero,
          )}, objetivo ${String(objetivoValor)} ${unidad}`}
          aria-invalid={!valor.ok}
        />
        <Pressable
          onPress={marcar}
          disabled={!editable}
          style={({ pressed }) => [
            estilos.marca,
            entrada.hecha && estilos.marcaHecha,
            pressed && estilos.pulsado,
          ]}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: entrada.hecha, disabled: !editable }}
          accessibilityLabel={`Serie ${String(numero)} hecha`}
          hitSlop={6}
        >
          <Text style={[estilos.textoMarca, entrada.hecha && estilos.textoMarcaHecha]}>
            {entrada.hecha ? "✓" : ""}
          </Text>
        </Pressable>
      </View>
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
      <Text style={[estilos.numero, estilos.encabezado]}>SERIE</Text>
      <Text style={[estilos.columna, estilos.encabezado]}>PESO (KG)</Text>
      <Text style={[estilos.columna, estilos.encabezado]}>{porTiempo ? "TIEMPO (S)" : "REPS"}</Text>
      <Text style={[estilos.cabeceraMarca, estilos.encabezado]}>HECHA</Text>
    </View>
  )
}

const estilos = StyleSheet.create({
  fila: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 4 },
  filaHecha: { opacity: 1 },
  numero: { width: 44, color: tema.texto, fontSize: 15, fontWeight: "600", textAlign: "center" },
  encabezado: { color: tema.textoTenue, fontSize: 10, fontWeight: "700", letterSpacing: 1.2 },
  columna: { flex: 1 },
  cabeceraMarca: { width: 48, textAlign: "center" },
  campo: {
    flex: 1,
    // Sin esto, en web el <input> impone su ancho intrínseco y la fila desborda.
    minWidth: 0,
    width: 0,
    backgroundColor: tema.fondo,
    borderColor: tema.borde,
    borderWidth: 1,
    borderRadius: 8,
    color: tema.texto,
    fontSize: 17,
    fontWeight: "600",
    paddingHorizontal: 12,
    paddingVertical: 10,
    textAlign: "center",
  },
  campoMal: { borderColor: tema.error },
  marca: {
    width: 48,
    height: 44,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: tema.oro,
    alignItems: "center",
    justifyContent: "center",
  },
  marcaHecha: { backgroundColor: tema.oro },
  textoMarca: { color: tema.fondo, fontSize: 20, fontWeight: "800" },
  textoMarcaHecha: { color: tema.fondo },
  pulsado: { opacity: 0.6 },
  aviso: { color: tema.error, fontSize: 12, marginLeft: 54, marginTop: 2 },
})
