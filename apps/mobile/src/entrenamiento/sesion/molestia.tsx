import { useRef, useState } from "react"
import { ScrollView, StyleSheet, Text, View } from "react-native"
import {
  ETIQUETA_DE_SINTOMA,
  ETIQUETA_DE_ZONA,
  SINTOMAS_DE_MOLESTIA,
  ZONAS_DE_MOLESTIA,
  type RegistrarMolestia,
  type SintomaDeMolestia,
  type ZonaDeMolestia,
} from "@alpha-omega/shared"

import { AvisoDeError } from "../../componentes/formulario"
import { faltaDe } from "../../lib/errores"
import { tema } from "../../tema"
import { BotonAtras, BotonDorado, Chips, Deslizador, Dialogo, Pregunta } from "./controles"

const ZONAS = ZONAS_DE_MOLESTIA.map((valor) => ({ valor, texto: ETIQUETA_DE_ZONA[valor] }))
const SINTOMAS = SINTOMAS_DE_MOLESTIA.map((valor) => ({ valor, texto: ETIQUETA_DE_SINTOMA[valor] }))

/** Dónde apareció: ejercicio y serie de la sesión, si fue en uno. */
export type LugarDeMolestia = {
  ejercicioPrescritoId: string | null
  ejercicio: string | null
  serie: number | null
}

/** «Molestia», como en el diseño: zona, intensidad, qué notas y avisar al entrenador. */
export function RegistrarMolestiaPantalla({
  lugar,
  reloj,
  uuid,
  avisar,
  volver,
}: {
  lugar: LugarDeMolestia
  reloj: string | null
  uuid: () => string
  avisar: (datos: RegistrarMolestia) => Promise<unknown>
  volver: () => void
}): React.JSX.Element {
  const [zona, setZona] = useState<ZonaDeMolestia | null>(null)
  const [intensidad, setIntensidad] = useState(0)
  const [sintomas, setSintomas] = useState<SintomaDeMolestia[]>([])
  const [enviando, setEnviando] = useState(false)
  const [enviada, setEnviada] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [descartando, setDescartando] = useState(false)
  // Un reintento reutiliza la operación: el servidor no crea dos avisos.
  const operacion = useRef(uuid())
  const tocada = zona !== null || intensidad > 0 || sintomas.length > 0

  async function enviar(): Promise<void> {
    if (zona === null) {
      setError("Elige la zona.")
      return
    }
    setError(null)
    setEnviando(true)
    try {
      await avisar({
        operacionId: operacion.current,
        ejercicioPrescritoId: lugar.ejercicioPrescritoId,
        serie: lugar.serie,
        zona,
        intensidad,
        sintomas,
        nota: null,
      })
      setEnviada(true)
    } catch (fallo) {
      setError(faltaDe(fallo, "No hemos podido avisar a tu entrenador.").texto)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <ScrollView contentContainerStyle={s.contenido}>
      <View style={s.barra}>
        <BotonAtras
          etiqueta="Volver a la sesión"
          onPress={() => (tocada && !enviada ? setDescartando(true) : volver())}
        />
        {reloj !== null && <Text style={s.reloj}>{reloj}</Text>}
      </View>
      <View style={s.titulos}>
        <Text style={s.titulo} accessibilityRole="header">
          Molestia
        </Text>
        {lugar.ejercicio !== null && (
          <Text style={s.subtitulo}>
            {lugar.ejercicio}
            {lugar.serie !== null ? ` · serie ${lugar.serie}` : ""}
          </Text>
        )}
      </View>
      {enviada ? (
        <View style={s.grupo}>
          <Text style={s.confirmacion} accessibilityLiveRegion="polite">
            Aviso enviado. Tu entrenador te dirá cómo seguir. Mientras, pasa al siguiente ejercicio.
          </Text>
          <BotonDorado texto="Volver a la sesión" onPress={volver} />
        </View>
      ) : (
        <>
          <View style={s.grupo}>
            <Pregunta>Zona</Pregunta>
            <Chips
              etiqueta="Zona"
              opciones={ZONAS}
              elegidas={zona === null ? [] : [zona]}
              cambiar={(elegidas) => setZona(elegidas[0] ?? null)}
            />
          </View>
          <View style={s.grupo}>
            <Pregunta valor={`${intensidad} de 10`}>Intensidad</Pregunta>
            <Deslizador
              valor={intensidad}
              cambiar={setIntensidad}
              maximo={10}
              etiqueta="Intensidad de la molestia"
            />
          </View>
          <View style={s.grupo}>
            <Pregunta>Qué notas (puedes marcar varias)</Pregunta>
            <Chips
              etiqueta="Qué notas"
              opciones={SINTOMAS}
              elegidas={sintomas}
              cambiar={setSintomas}
              varias
            />
          </View>
          {error !== null && <AvisoDeError mensaje={error} />}
          <View style={s.grupo}>
            <BotonDorado
              texto="Avisar a tu entrenador"
              onPress={() => void enviar()}
              ocupado={enviando}
            />
            <Text style={s.ayuda}>Mientras, pasa al siguiente ejercicio.</Text>
          </View>
        </>
      )}
      <Dialogo
        visible={descartando}
        titulo="¿Descartar la molestia?"
        texto="Lo que has marcado no se enviará."
        confirmar="Descartar"
        cancelar="Seguir editando"
        peligro
        alConfirmar={() => {
          setDescartando(false)
          volver()
        }}
        alCancelar={() => setDescartando(false)}
      />
    </ScrollView>
  )
}

const s = StyleSheet.create({
  contenido: { gap: 28, paddingBottom: 24 },
  barra: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  reloj: { color: tema.acento, fontFamily: tema.fuenteTitulo, fontSize: 30, lineHeight: 34 },
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
  confirmacion: { color: tema.texto, fontFamily: tema.fuenteTexto, fontSize: 16, lineHeight: 23 },
  ayuda: {
    color: tema.textoTenue,
    fontFamily: tema.fuenteTexto,
    fontSize: 13,
    textAlign: "center",
  },
})
