import { Pressable, StyleSheet, Text, TextInput, View } from "react-native"
import type { EjercicioPrescrito } from "@alpha-omega/shared"
import type { EdicionRegistro } from "./registro-modelo"
import { valoresLegibles } from "./resultado"
import { Icono } from "../componentes/iconos"
import { degradadoExito, tema } from "../tema"

type SerieReal = EdicionRegistro["series"][number]

/** Un ejercicio de la sesión en curso, con el diseño de «Sesión en curso». */
export function TablaSeries({
  ejercicio,
  series,
  bloqueado,
  cambiar,
  verTecnica,
}: {
  ejercicio: EjercicioPrescrito
  series: SerieReal[]
  bloqueado: boolean
  cambiar: (id: string, cambio: Partial<SerieReal>) => void
  /** Ver la técnica no edita nada: sigue disponible con el registro bloqueado. */
  verTecnica?: () => void
}): React.JSX.Element {
  const unidades = new Set(ejercicio.series.map((s) => s.tipoMedicion))
  const columna = unidades.size > 1 ? "Reps / s" : unidades.has("tiempo") ? "Seg" : "Reps"
  return (
    <View style={s.bloque}>
      <View style={s.cabecera}>
        <View style={s.titulos}>
          <Text accessibilityRole="header" style={s.nombre}>
            {ejercicio.nombre}
          </Text>
          {ejercicio.indicaciones && <Text style={s.indicaciones}>{ejercicio.indicaciones}</Text>}
        </View>
        {verTecnica && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Ver técnica — ${ejercicio.nombre}`}
            onPress={verTecnica}
            style={s.tecnica}
            hitSlop={4}
          >
            <Text style={s.textoTecnica}>Ver técnica</Text>
          </Pressable>
        )}
      </View>
      <View style={s.fila} accessible={false}>
        <Text style={[s.etiqueta, s.numero]}>Serie</Text>
        <Text style={[s.etiqueta, s.objetivo]}>Objetivo</Text>
        <Text style={[s.etiqueta, s.valor]}>Kg</Text>
        <Text style={[s.etiqueta, s.valor]}>{columna}</Text>
        <Text style={[s.etiqueta, s.marca]}>Hecha</Text>
      </View>
      {ejercicio.series.map((objetivo, n) => {
        const real = series.find((serie) => serie.serieId === objetivo.id)!
        const tiempo = objetivo.tipoMedicion === "tiempo"
        const unidad = tiempo ? "Segundos" : "Repeticiones"
        return (
          <View key={objetivo.id} style={s.fila}>
            <Text style={[s.numero, s.numeroTexto, real.hecha && s.numeroHecho]}>{n + 1}</Text>
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
              placeholderTextColor={tema.marcador}
              selectionColor={tema.acento}
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
              placeholderTextColor={tema.marcador}
              selectionColor={tema.acento}
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
              style={[s.casilla, real.hecha && [s.marcada, degradadoExito]]}
            >
              {real.hecha && <Icono nombre="hecho" color={tema.sobreExito} tamano={18} />}
            </Pressable>
          </View>
        )
      })}
    </View>
  )
}

const s = StyleSheet.create({
  bloque: { gap: 8 },
  cabecera: { flexDirection: "row", alignItems: "flex-start", gap: 12, marginBottom: 8 },
  titulos: { flex: 1, gap: 4 },
  nombre: { fontFamily: tema.fuenteBoton, fontSize: 20, lineHeight: 25, color: tema.texto },
  indicaciones: {
    fontFamily: tema.fuenteTexto,
    fontSize: 13,
    lineHeight: 18,
    color: tema.textoTenue,
  },
  tecnica: { minHeight: 44, justifyContent: "center" },
  textoTecnica: { fontFamily: tema.fuenteBoton, fontSize: 15, color: tema.acento },
  fila: { flexDirection: "row", gap: 8, alignItems: "center" },
  etiqueta: {
    fontFamily: tema.fuenteTexto,
    fontSize: 12,
    color: tema.textoTenue,
    textAlign: "center",
  },
  numero: { width: 28 },
  numeroTexto: {
    fontFamily: tema.fuenteSemi,
    fontSize: 15,
    textAlign: "center",
    color: tema.textoTenue,
  },
  numeroHecho: { color: tema.texto },
  objetivo: { flex: 1.2, minWidth: 0 },
  objetivoTexto: {
    fontFamily: tema.fuenteTexto,
    fontSize: 13,
    lineHeight: 17,
    color: tema.textoTenue,
    textAlign: "center",
  },
  valor: { flex: 1, minWidth: 0 },
  marca: { width: 44 },
  campo: {
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: tema.bordeFuerte,
    backgroundColor: tema.superficie,
    color: tema.texto,
    fontSize: 17,
    fontFamily: tema.fuenteBoton,
    textAlign: "center",
    paddingHorizontal: 2,
  },
  casilla: {
    width: 44,
    height: 44,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: tema.bordeFuerte,
  },
  marcada: { borderColor: "transparent" },
})
