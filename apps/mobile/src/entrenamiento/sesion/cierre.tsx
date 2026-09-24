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

/**
 * «¿Cómo ha ido?»: el cierre del diseño, antes de enviar al entrenador. Con un
 * envío en curso o pendiente se enseña lo enviado, sin controles: una edición
 * posterior no viajaría.
 */
export function CierreDeSesion({
  subtitulo,
  resumen,
  cierreInicial,
  notas,
  enviando,
  pendiente = false,
  error,
  enviar,
  reintentar,
  volver,
}: {
  /** «Empuje · 1 h 38 min». */
  subtitulo: string
  resumen: { hechas: number; omitidas: number; pendientes: number }
  /** El cierre guardado: el del envío pendiente o, si no lo hay, el de la edición. */
  cierreInicial: Cierre | null
  notas: string
  enviando: boolean
  /** Hay un envío guardado: se muestra tal cual y solo se puede reintentar. */
  pendiente?: boolean
  error: string
  enviar: (cierre: Cierre, notas: string) => void
  /** Reintenta el envío pendiente con su contenido original. */
  reintentar: () => void
  volver: () => void
}): React.JSX.Element {
  const [esfuerzo, setEsfuerzo] = useState(cierreInicial?.esfuerzo ?? 5)
  const [energia, setEnergia] = useState<number | null>(cierreInicial?.energia ?? null)
  const [contar, setContar] = useState<"bien" | "incomodo" | null>(
    cierreInicial === null ? null : cierreInicial.incomodo ? "incomodo" : "bien",
  )
  const [nota, setNota] = useState(notas)
  const [escribiendo, setEscribiendo] = useState(notas !== "")
  const [aviso, setAviso] = useState("")
  // Lo que se pulsó al enviar. Sin pulsar, una operación ajena no congela nada.
  const [enviado, setEnviado] = useState<{ cierre: Cierre; nota: string } | null>(null)
  const elegido: Cierre | null =
    energia === null || contar === null
      ? null
      : { esfuerzo, energia, incomodo: contar === "incomodo" }
  // Pendiente: manda lo guardado. Primer envío: lo que se acaba de enviar.
  const congelado: { cierre: Cierre | null; nota: string } | null = pendiente
    ? { cierre: cierreInicial, nota: notas }
    : enviando
      ? enviado
      : null

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
      {congelado !== null ? (
        <CierreEnviado
          cierre={congelado.cierre}
          nota={congelado.nota.trim()}
          pendiente={pendiente}
        />
      ) : (
        <>
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
        </>
      )}
      {(aviso !== "" || error !== "") && <AvisoDeError mensaje={aviso || error} />}
      <BotonDorado
        texto={pendiente ? "Reintentar envío pendiente" : "Enviar a tu entrenador"}
        ocupado={enviando}
        onPress={() => {
          setAviso("")
          // El reintento repite la intención guardada: no vuelve a preguntar.
          if (pendiente) {
            reintentar()
            return
          }
          if (elegido === null) {
            setAviso("Dinos cómo terminas y si hay algo que contar.")
            return
          }
          setEnviado({ cierre: elegido, nota })
          enviar(elegido, nota)
        }}
      />
    </ScrollView>
  )
}

/** Resumen de solo consulta de lo que se envía al entrenador. */
function CierreEnviado({
  cierre,
  nota,
  pendiente,
}: {
  cierre: Cierre | null
  nota: string
  pendiente: boolean
}): React.JSX.Element {
  return (
    <View style={s.grupo}>
      <Text style={s.seccion} accessibilityRole="header">
        Tu feedback
      </Text>
      <Text style={s.resumen} accessibilityLiveRegion="polite">
        {pendiente
          ? "Tu envío está guardado en este dispositivo y se enviará tal cual. Ya no se puede cambiar."
          : "Se está enviando tal cual. Ya no se puede cambiar."}
      </Text>
      {cierre === null ? (
        <Text style={s.resumen}>Sin feedback registrado</Text>
      ) : (
        <>
          <Pregunta valor={`${cierre.esfuerzo} de 10`}>¿Cuánto te ha costado?</Pregunta>
          <Pregunta valor={`${cierre.energia} de 5`}>¿Cómo terminas?</Pregunta>
          <Pregunta valor={cierre.incomodo ? "Algo incómodo" : "Todo bien"}>
            ¿Algo que contar?
          </Pregunta>
        </>
      )}
      {nota !== "" && (
        <View style={s.notaEnviada}>
          <Text style={s.etiqueta}>Nota para tu entrenador</Text>
          <Text style={s.textoNota}>{nota}</Text>
        </View>
      )}
    </View>
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
  notaEnviada: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: tema.borde,
    backgroundColor: tema.superficie,
    padding: 12,
    gap: 4,
  },
  etiqueta: { color: tema.textoTenue, fontFamily: tema.fuenteTexto, fontSize: 13 },
  textoNota: { color: tema.texto, fontFamily: tema.fuenteTexto, fontSize: 15, lineHeight: 21 },
})
