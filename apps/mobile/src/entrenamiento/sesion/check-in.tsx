import { useState } from "react"
import { ScrollView, StyleSheet, Text, View } from "react-native"
import type { Checkin } from "@alpha-omega/shared"

import { BotonPrincipal } from "../../componentes/botones"
import { tema } from "../../tema"
import { BotonAtras, Chips, Opciones, Pregunta } from "./controles"

const SENSACIONES = [1, 2, 3, 4, 5].map((valor) => ({ valor, texto: String(valor) }))
const MOLESTIAS = [
  { valor: "nada", texto: "Nada" },
  { valor: "agujetas", texto: "Agujetas" },
  { valor: "dolor", texto: "Dolor" },
] as const

/** «¿Cómo llegas?»: antes de la primera serie, como en el diseño. */
export function CheckIn({
  nombre,
  empezar,
  volver,
}: {
  nombre: string
  empezar: (checkin: Checkin) => void
  volver: () => void
}): React.JSX.Element {
  const [sensacion, setSensacion] = useState<number | null>(null)
  const [molestia, setMolestia] = useState<Checkin["molestia"] | null>(null)
  const listo = sensacion !== null && molestia !== null
  return (
    <ScrollView contentContainerStyle={s.contenido}>
      <BotonAtras etiqueta="Volver" onPress={volver} />
      <View style={s.titulos}>
        <Text style={s.titulo} accessibilityRole="header">
          ¿Cómo llegas?
        </Text>
        <Text style={s.subtitulo}>{nombre}</Text>
      </View>
      <View style={s.grupo}>
        <Pregunta>¿Cómo te sientes?</Pregunta>
        <Opciones
          etiqueta="Cómo te sientes, de 1, agotado, a 5, a tope"
          opciones={SENSACIONES}
          valor={sensacion}
          cambiar={setSensacion}
          extremos={["Agotado", "A tope"]}
        />
      </View>
      <View style={s.grupo}>
        <Pregunta>¿Algo te molesta?</Pregunta>
        <Chips
          etiqueta="Algo te molesta"
          opciones={MOLESTIAS}
          elegidas={molestia === null ? [] : [molestia]}
          cambiar={(elegidas) => setMolestia(elegidas[0] ?? null)}
        />
        {molestia === "dolor" && (
          <Text style={s.aviso}>
            Si el dolor es agudo, no entrenes esa zona y avisa a tu entrenador.
          </Text>
        )}
      </View>
      {!listo && (
        <Text style={s.ayuda}>
          {sensacion === null && molestia === null
            ? "Responde las dos preguntas para empezar."
            : sensacion === null
              ? "Responde cómo te sientes para empezar."
              : "Responde si algo te molesta para empezar."}
        </Text>
      )}
      <BotonPrincipal
        texto="Empezar"
        deshabilitado={!listo}
        onPress={() => {
          if (sensacion !== null && molestia !== null) empezar({ sensacion, molestia })
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
  aviso: { color: tema.aviso, fontFamily: tema.fuenteSemi, fontSize: 13, lineHeight: 19 },
  ayuda: { color: tema.textoTenue, fontFamily: tema.fuenteTexto, fontSize: 13 },
})
