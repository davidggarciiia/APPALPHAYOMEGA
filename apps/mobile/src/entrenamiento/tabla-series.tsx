import { Pressable, StyleSheet, Text, TextInput, View } from "react-native"
import type { EjercicioPrescrito } from "@alpha-omega/shared"
import type { EdicionRegistro } from "./registro-modelo"
import { valoresLegibles } from "./resultado"
import { tema } from "../tema"

type SerieReal = EdicionRegistro["series"][number]

export function TablaSeries({
  ejercicio,
  series,
  bloqueado,
  cambiar,
}: {
  ejercicio: EjercicioPrescrito
  series: SerieReal[]
  bloqueado: boolean
  cambiar: (id: string, cambio: Partial<SerieReal>) => void
}): React.JSX.Element {
  const unidades = new Set(ejercicio.series.map((s) => s.tipoMedicion))
  const columna = unidades.size > 1 ? "REP / S" : unidades.has("tiempo") ? "SEG" : "REP"
  return (
    <View style={s.tarjeta}>
      <Text accessibilityRole="header" style={s.nombre}>
        {ejercicio.nombre}
      </Text>
      {ejercicio.indicaciones && <Text style={s.indicaciones}>{ejercicio.indicaciones}</Text>}
      <View style={s.fila} accessible={false}>
        <Text style={[s.etiqueta, s.numero]}>SERIE</Text>
        <Text style={[s.etiqueta, s.objetivo]}>OBJETIVO</Text>
        <Text style={[s.etiqueta, s.valor]}>KG</Text>
        <Text style={[s.etiqueta, s.valor]}>{columna}</Text>
        <Text style={[s.etiqueta, s.marca]}>HECHA</Text>
      </View>
      {ejercicio.series.map((objetivo, n) => {
        const real = series.find((serie) => serie.serieId === objetivo.id)!
        const tiempo = objetivo.tipoMedicion === "tiempo"
        const unidad = tiempo ? "Segundos" : "Repeticiones"
        return (
          <View key={objetivo.id} style={[s.fila, real.hecha && s.hecha]}>
            <Text style={[s.numero, s.numeroTexto]}>{n + 1}</Text>
            <Text
              style={[s.objetivo, s.objetivoTexto]}
              accessibilityLabel={`Objetivo, serie ${n + 1}: ${valoresLegibles(objetivo)}`}
            >
              {objetivo.pesoKg !== null ? `${objetivo.pesoKg} kg × ` : ""}
              {tiempo ? `${objetivo.segundos} s` : `${objetivo.repeticiones} rep`}
            </Text>
            <TextInput
              accessibilityLabel={`Peso — ${ejercicio.nombre}, serie ${n + 1}`}
              editable={!bloqueado}
              value={real.peso}
              onChangeText={(peso) => cambiar(objetivo.id, { peso })}
              placeholder={objetivo.pesoKg === null ? "—" : String(objetivo.pesoKg)}
              placeholderTextColor={tema.textoTenue}
              keyboardType="decimal-pad"
              maxLength={30}
              style={[s.valor, s.campo]}
            />
            <TextInput
              accessibilityLabel={`${unidad} — ${ejercicio.nombre}, serie ${n + 1}`}
              editable={!bloqueado}
              value={real.valor}
              onChangeText={(valor) => cambiar(objetivo.id, { valor })}
              placeholder={String(tiempo ? objetivo.segundos : objetivo.repeticiones)}
              placeholderTextColor={tema.textoTenue}
              keyboardType="number-pad"
              maxLength={30}
              style={[s.valor, s.campo]}
            />
            <Pressable
              accessibilityRole="checkbox"
              accessibilityLabel={`Hecha — ${ejercicio.nombre}, serie ${n + 1}`}
              accessibilityState={{ checked: real.hecha, disabled: bloqueado }}
              disabled={bloqueado}
              onPress={() => cambiar(objetivo.id, { hecha: !real.hecha })}
              style={[s.casilla, real.hecha && s.marcada]}
            >
              <Text style={[s.check, real.hecha && s.checkMarcado]}>✓</Text>
            </Pressable>
          </View>
        )
      })}
    </View>
  )
}

const s = StyleSheet.create({
  tarjeta: {
    borderRadius: 18,
    backgroundColor: tema.superficie,
    borderWidth: 1,
    borderColor: tema.borde,
    padding: 12,
    gap: 10,
  },
  nombre: { fontFamily: tema.fuenteBoton, fontSize: 17, color: tema.texto, paddingHorizontal: 4 },
  indicaciones: {
    fontFamily: tema.fuenteTexto,
    fontSize: 13,
    lineHeight: 18,
    color: tema.textoTenue,
    paddingHorizontal: 4,
    marginBottom: 4,
  },
  fila: { flexDirection: "row", gap: 6, alignItems: "center", borderRadius: 10 },
  etiqueta: {
    fontFamily: tema.fuenteBoton,
    fontSize: 10,
    letterSpacing: 0.8,
    color: tema.textoTenue,
    textAlign: "center",
    paddingVertical: 4,
  },
  numero: { width: 30 },
  numeroTexto: {
    fontFamily: tema.fuenteBoton,
    fontSize: 16,
    textAlign: "center",
    color: tema.textoSecundario,
  },
  objetivo: { flex: 1.25, minWidth: 0 },
  objetivoTexto: {
    fontFamily: tema.fuenteTexto,
    fontSize: 12,
    lineHeight: 16,
    color: tema.textoTenue,
    textAlign: "center",
  },
  valor: { flex: 1, minWidth: 0 },
  marca: { width: 44 },
  campo: {
    minHeight: 44,
    borderRadius: 9,
    backgroundColor: tema.suave,
    color: tema.texto,
    fontSize: 17,
    fontFamily: tema.fuenteBoton,
    textAlign: "center",
    paddingHorizontal: 2,
  },
  hecha: { backgroundColor: tema.exitoSuave },
  casilla: {
    width: 44,
    minHeight: 44,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: tema.suave,
    borderWidth: 1,
    borderColor: tema.borde,
  },
  marcada: { backgroundColor: tema.exito, borderColor: tema.exito },
  check: { color: tema.textoTenue, fontSize: 20 },
  checkMarcado: { color: tema.sobreAcento },
})
