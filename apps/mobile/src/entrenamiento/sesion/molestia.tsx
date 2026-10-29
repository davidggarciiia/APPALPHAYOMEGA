import { useEffect, useRef, useState, type ReactNode } from "react"
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
import { BotonPrincipal } from "../../componentes/botones"
import { faltaDe } from "../../lib/errores"
import { espacio, tema, tipo } from "../../tema"
import { BotonAtras, Chips, Deslizador, Dialogo } from "./controles"

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
  uuid,
  avisar,
  volver,
  registrarSalida,
}: {
  lugar: LugarDeMolestia
  reloj: ReactNode
  uuid: () => string
  avisar: (datos: RegistrarMolestia) => Promise<unknown>
  volver: () => void
  registrarSalida?: (preparar: ((salir: () => void) => void) | null) => void
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
  const intencion = useRef<RegistrarMolestia | null>(null)
  const [intentada, setIntentada] = useState<
    (RegistrarMolestia & { lugar: LugarDeMolestia }) | null
  >(null)
  const enCurso = useRef(false)
  const contexto = intentada?.lugar ?? lugar
  const tocada = zona !== null || intensidad > 0 || sintomas.length > 0
  const salida = useRef<(() => void) | null>(null)
  const proteger = (accion: () => void): void => {
    if (!tocada || enviada) return accion()
    salida.current = accion
    setDescartando(true)
  }
  useEffect(() => {
    registrarSalida?.(proteger)
    return () => registrarSalida?.(null)
  })

  async function enviar(): Promise<void> {
    if (enCurso.current || enviada) return
    if (intencion.current === null) {
      if (zona === null) {
        setError("Elige la zona.")
        return
      }
      intencion.current = {
        operacionId: operacion.current,
        ejercicioPrescritoId: lugar.ejercicioPrescritoId,
        serie: lugar.serie,
        zona,
        intensidad,
        sintomas: [...sintomas],
        nota: null,
      }
      setIntentada({ ...intencion.current, lugar: { ...lugar } })
    }
    enCurso.current = true
    setError(null)
    setEnviando(true)
    try {
      await avisar(intencion.current)
      setEnviada(true)
    } catch (fallo) {
      setError(faltaDe(fallo, "No hemos podido avisar a tu entrenador.").texto)
    } finally {
      enCurso.current = false
      setEnviando(false)
    }
  }

  return (
    <ScrollView contentContainerStyle={s.contenido} keyboardShouldPersistTaps="handled">
      <View style={s.barra}>
        <BotonAtras etiqueta="Volver a la sesión" onPress={() => proteger(volver)} />
      </View>
      <View style={s.titulos}>
        <Text style={s.titulo} accessibilityRole="header">
          MOLESTIA
        </Text>
        {contexto.ejercicio !== null && (
          <Text style={s.subtitulo}>
            {contexto.ejercicio}
            {contexto.serie !== null ? ` · serie ${contexto.serie}` : ""}
          </Text>
        )}
      </View>
      {enviada ? (
        <View style={s.grupo}>
          <Text style={s.confirmacion} accessibilityLiveRegion="polite">
            Aviso enviado. Tu entrenador te dirá cómo seguir. Mientras, pasa al siguiente ejercicio.
          </Text>
          <BotonPrincipal texto="Volver a la sesión" onPress={volver} sinMargen />
        </View>
      ) : (
        <>
          {intentada !== null ? (
            <View style={s.grupo}>
              <Text style={s.subtitulo} accessibilityLiveRegion="polite">
                {enviando
                  ? "Enviando este aviso. Su contenido no se puede cambiar."
                  : "Este aviso está pendiente de confirmar. Reintentaremos el mismo contenido."}
              </Text>
              <Text
                style={s.subtitulo}
              >{`${ETIQUETA_DE_ZONA[intentada.zona]} · ${intentada.intensidad} de 10`}</Text>
              <Text style={s.subtitulo}>
                {intentada.sintomas.length === 0
                  ? "Sin síntomas adicionales"
                  : intentada.sintomas.map((sintoma) => ETIQUETA_DE_SINTOMA[sintoma]).join(" · ")}
              </Text>
            </View>
          ) : (
            <>
              <View style={s.grupo}>
                <Chips
                  etiqueta="Zona"
                  opciones={ZONAS}
                  elegidas={zona === null ? [] : [zona]}
                  cambiar={(elegidas) => setZona(elegidas[0] ?? null)}
                />
              </View>
              <View style={s.grupo}>
                <Text style={s.intensidad} accessible={false}>
                  {intensidad} / 10
                </Text>
                <Deslizador
                  valor={intensidad}
                  cambiar={setIntensidad}
                  maximo={10}
                  etiqueta="Intensidad de la molestia"
                />
              </View>
              <View style={s.grupo}>
                <Chips
                  etiqueta="Qué notas"
                  opciones={SINTOMAS}
                  elegidas={sintomas}
                  cambiar={setSintomas}
                  varias
                />
              </View>
            </>
          )}
          {error !== null && <AvisoDeError mensaje={error} />}
          <View style={s.grupo}>
            <BotonPrincipal
              texto={intentada === null ? "Avisar a tu entrenador" : "Reintentar el mismo aviso"}
              onPress={() => void enviar()}
              ocupado={enviando}
              sinMargen
            />
          </View>
        </>
      )}
      <Dialogo
        visible={descartando}
        titulo={intentada === null ? "¿Descartar la molestia?" : "¿Salir sin confirmar el aviso?"}
        texto={
          intentada === null
            ? "Lo que has marcado no se enviará."
            : "Puede que tu entrenador ya haya recibido este aviso. Si sales, no podrás confirmar el envío desde esta pantalla."
        }
        confirmar={intentada === null ? "Descartar" : "Salir del aviso"}
        cancelar={intentada === null ? "Seguir editando" : "Volver al aviso"}
        peligro
        ocupado={enviando}
        alConfirmar={() => {
          setDescartando(false)
          const continuar = salida.current
          salida.current = null
          continuar?.()
        }}
        alCancelar={() => setDescartando(false)}
      />
    </ScrollView>
  )
}

const s = StyleSheet.create({
  contenido: { gap: espacio[28], paddingBottom: espacio[24] },
  barra: { minHeight: 44, flexDirection: "row", alignItems: "center" },
  titulos: { gap: espacio[4] },
  titulo: {
    color: tema.texto,
    ...tipo.tituloPantalla,
  },
  subtitulo: tipo.secundario,
  grupo: { gap: espacio[12] },
  intensidad: {
    ...tipo.cifras,
    fontFamily: tema.fuenteTitulo,
    fontSize: 22,
    lineHeight: 26,
    color: tema.texto,
  },
  confirmacion: { ...tipo.cuerpo, color: tema.texto },
})
