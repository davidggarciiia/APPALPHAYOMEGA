import { useState } from "react"
import { ScrollView, StyleSheet, Text, TextInput, View } from "react-native"
import type { Cierre } from "@alpha-omega/shared"

import { AvisoDeError } from "../../componentes/formulario"
import { tema } from "../../tema"
import { BotonAtras, BotonDorado, Chips, Deslizador, Enlace, Opciones, Pregunta } from "./controles"

const ENERGIA = [1, 2, 3, 4, 5].map((valor) => ({ valor, texto: String(valor) }))
const CONTAR = [
  { valor: "bien", texto: "Todo bien" },
  { valor: "incomodo", texto: "Algo incómodo" },
] as const

/** «¿Cómo ha ido?»: el cierre del diseño, antes de enviar al entrenador. */
export function CierreDeSesion({
  subtitulo,
  resumen,
  notas,
  enviando,
  pendiente = false,
  error,
  enviar,
  volver,
}: {
  /** «Empuje · 1 h 38 min». */
  subtitulo: string
  resumen: { hechas: number; omitidas: number; pendientes: number }
  notas: string
  enviando: boolean
  pendiente?: boolean
  error: string
  enviar: (cierre: Cierre, notas: string) => void
  volver: () => void
}): React.JSX.Element {
  const [esfuerzo, setEsfuerzo] = useState(5)
  const [energia, setEnergia] = useState<number | null>(null)
  const [contar, setContar] = useState<"bien" | "incomodo" | null>(null)
  const [nota, setNota] = useState(notas)
  const [escribiendo, setEscribiendo] = useState(notas !== "")
  const [aviso, setAviso] = useState("")

  return (
    <ScrollView contentContainerStyle={s.contenido} keyboardShouldPersistTaps="handled">
      <BotonAtras etiqueta="Volver a la sesión" onPress={volver} />
      <View style={s.titulos}>
        <Text style={s.titulo} accessibilityRole="header">
          ¿Cómo ha ido?
        </Text>
        <Text style={s.subtitulo}>{subtitulo}</Text>
      </View>
      <View style={s.grupo}>
        <Text style={s.seccion} accessibilityRole="header">
          Series registradas
        </Text>
        <Text style={s.resumen}>
          {resumen.hechas} hechas · {resumen.omitidas} omitidas · {resumen.pendientes} pendientes
        </Text>
      </View>
      <View style={s.grupo}>
        <Pregunta valor={`${esfuerzo} de 10`}>¿Cuánto te ha costado?</Pregunta>
        <Deslizador
          valor={esfuerzo}
          cambiar={setEsfuerzo}
          maximo={10}
          etiqueta="Cuánto te ha costado, de 0 a 10"
        />
      </View>
      <View style={s.grupo}>
        <Pregunta>¿Cómo terminas?</Pregunta>
        <Opciones
          etiqueta="Cómo terminas, de 1, vacío, a 5, con energía"
          opciones={ENERGIA}
          valor={energia}
          cambiar={setEnergia}
          extremos={["Vacío", "Con energía"]}
        />
      </View>
      <View style={s.grupo}>
        <Pregunta>¿Algo que contar?</Pregunta>
        <Chips
          etiqueta="Algo que contar"
          opciones={CONTAR}
          elegidas={contar === null ? [] : [contar]}
          cambiar={(elegidas) => setContar(elegidas[0] ?? null)}
        />
        {escribiendo ? (
          <TextInput
            value={nota}
            onChangeText={setNota}
            accessibilityLabel="Nota para tu entrenador"
            placeholder="Cuéntale a tu entrenador lo que quieras"
            placeholderTextColor={tema.marcador}
            multiline
            maxLength={2000}
            style={s.nota}
          />
        ) : (
          <Enlace texto="Añadir nota" onPress={() => setEscribiendo(true)} />
        )}
      </View>
      {(aviso !== "" || error !== "") && <AvisoDeError mensaje={aviso || error} />}
      <BotonDorado
        texto={pendiente ? "Reintentar envío pendiente" : "Enviar a tu entrenador"}
        ocupado={enviando}
        onPress={() => {
          if (energia === null || contar === null) {
            setAviso("Dinos cómo terminas y si hay algo que contar.")
            return
          }
          setAviso("")
          enviar({ esfuerzo, energia, incomodo: contar === "incomodo" }, nota)
        }}
      />
    </ScrollView>
  )
}

const s = StyleSheet.create({
  contenido: { gap: 28, paddingBottom: 24 },
  titulos: { gap: 6 },
  titulo: {
    color: tema.texto,
    fontFamily: tema.fuenteTitulo,
    fontSize: 34,
    lineHeight: 38,
    textTransform: "uppercase",
  },
  subtitulo: { color: tema.textoTenue, fontFamily: tema.fuenteTexto, fontSize: 15 },
  grupo: { gap: 12 },
  seccion: { color: tema.texto, fontFamily: tema.fuenteBoton, fontSize: 20 },
  resumen: { color: tema.textoTenue, fontFamily: tema.fuenteTexto, fontSize: 15 },
  nota: {
    minHeight: 88,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: tema.bordeFuerte,
    backgroundColor: tema.superficie,
    color: tema.texto,
    fontFamily: tema.fuenteTexto,
    fontSize: 15,
    padding: 12,
    textAlignVertical: "top",
  },
})
