import { useEffect, useRef, useState } from "react"
import { StyleSheet, Text, TextInput, View } from "react-native"
import {
  ETIQUETA_DE_SINTOMA,
  ETIQUETA_DE_ZONA,
  type Molestia,
  type ResultadoEntrenamiento,
} from "@alpha-omega/shared"

import { AvisoDeError } from "../../componentes/formulario"
import { BotonPrincipal, BotonSecundario } from "../../componentes/botones"
import { Hoja } from "../../componentes/hoja"
import { Pulsable } from "../../componentes/pulsable"
import { Titulo } from "../../entrenamiento/plan/piezas"
import { Enlace } from "../../entrenamiento/sesion/controles"
import { faltaDe } from "../../lib/errores"
import { espacio, radio, tema } from "../../tema"
import { senalesDeVolumen } from "../ficha-modelo"

const NIVEL = { verde: "verde", ambar: "ámbar", rojo: "roja" } as const
const COLOR = { verde: tema.exito, ambar: tema.aviso, rojo: tema.error } as const

/** «Molestia ámbar en el hombro» y su detalle, como en el diseño. */
export function textoDeMolestia(m: Molestia): { titulo: string; detalle: string } {
  const sintomas = m.sintomas.map((s) => ETIQUETA_DE_SINTOMA[s].toLowerCase())
  return {
    titulo: `Molestia ${NIVEL[m.nivel]} en ${m.zona === "otra" ? "otra zona" : `el ${ETIQUETA_DE_ZONA[m.zona].toLowerCase()}`}`,
    detalle: [
      `${m.intensidad} de 10${sintomas.length > 0 ? ` y ${sintomas.join(", ")}` : ""}`,
      m.ejercicio ? `${m.ejercicio.toLowerCase()}${m.serie ? `, serie ${m.serie}` : ""}` : null,
      m.nota,
    ]
      .filter(Boolean)
      .join(" · "),
  }
}

/** Responder a una molestia: cierra el aviso con lo que diga el entrenador. */
export function DialogoResponder({
  molestia,
  cerrar,
  responder,
}: {
  molestia: Molestia | null
  cerrar: () => void
  responder: (molestia: Molestia, texto: string) => Promise<void>
}): React.JSX.Element {
  const [texto, setTexto] = useState("")
  const [error, setError] = useState("")
  const [enviando, setEnviando] = useState(false)
  const enCurso = useRef(false)
  useEffect(() => {
    setTexto("")
    setError("")
  }, [molestia?.id])
  // Lo escrito es una indicación de salud para ESTA molestia: no debe quedar
  // puesto cuando se abra la respuesta de otra.
  const cancelar = (): void => {
    setTexto("")
    setError("")
    cerrar()
  }
  return (
    <Hoja
      visible={molestia !== null}
      titulo="Responder a la molestia"
      alCerrar={() => !enCurso.current && cancelar()}
    >
      <View style={s.grupo}>
        <Text style={s.tenue}>{molestia ? textoDeMolestia(molestia).detalle : ""}</Text>
        <TextInput
          accessibilityLabel="Respuesta para el cliente"
          value={texto}
          onChangeText={setTexto}
          editable={!enviando}
          placeholder="Por ejemplo: cambia a press con agarre neutro y baja a 22 kg."
          placeholderTextColor={tema.marcador}
          multiline
          maxLength={1000}
          style={s.campo}
        />
        {error !== "" && <AvisoDeError mensaje={error} />}
        <BotonPrincipal
          texto="Enviar respuesta"
          ocupado={enviando}
          sinMargen
          onPress={() => {
            if (!molestia || enCurso.current) return
            if (texto.trim() === "") return setError("Escribe qué debe hacer.")
            enCurso.current = true
            setEnviando(true)
            setError("")
            responder(molestia, texto.trim())
              .then(() => {
                setTexto("")
                cerrar()
              })
              .catch((e: unknown) => setError(faltaDe(e, "No se pudo enviar la respuesta.").texto))
              .finally(() => {
                enCurso.current = false
                setEnviando(false)
              })
          }}
        />
        <BotonSecundario texto="Cancelar" sinMargen deshabilitado={enviando} onPress={cancelar} />
      </View>
    </Hoja>
  )
}

/** «Requiere tu atención»: molestias abiertas y señales para bajar volumen. */
export function RequiereAtencion({
  molestias,
  semana,
  responder,
  verSesiones,
}: {
  molestias: Molestia[]
  /** Resultados de esta semana. */
  semana: ResultadoEntrenamiento[]
  responder: (molestia: Molestia) => void
  verSesiones: (sesionId: string) => void
}): React.JSX.Element | null {
  const [criterios, setCriterios] = useState(false)
  const abiertas = molestias
    .filter((m) => m.estado === "abierta")
    .sort((a, b) =>
      a.nivel === b.nivel ? 0 : a.nivel === "rojo" ? -1 : b.nivel === "rojo" ? 1 : 0,
    )
  const senales = senalesDeVolumen(semana, molestias)
  const cumplidas = senales.filter((s) => s.cumple).length
  if (abiertas.length === 0 && cumplidas === 0) return null
  return (
    <View style={s.grupo}>
      <Titulo>Requiere tu atención</Titulo>
      <View style={s.tarjeta}>
        {abiertas.map((m, n) => {
          const { titulo, detalle } = textoDeMolestia(m)
          return (
            <View key={m.id} style={[s.fila, n > 0 && s.separada]}>
              <View style={[s.punto, { backgroundColor: COLOR[m.nivel] }]} />
              <View style={s.textos}>
                <Text style={s.fuerte}>{titulo}</Text>
                <Text style={s.tenue} numberOfLines={1}>
                  {detalle}
                </Text>
              </View>
              <View style={s.acciones}>
                <Enlace texto="Ver sesión" onPress={() => verSesiones(m.sesionId)} />
                <Pulsable
                  accessibilityRole="button"
                  accessibilityLabel={`Responder: ${titulo}`}
                  onPress={() => responder(m)}
                  style={s.boton}
                >
                  <Text style={s.textoBoton}>Responder</Text>
                </Pulsable>
              </View>
            </View>
          )
        })}
        {cumplidas > 0 && (
          <View style={[s.fila, abiertas.length > 0 && s.separada]}>
            <View
              style={[s.punto, { backgroundColor: cumplidas >= 2 ? tema.error : tema.aviso }]}
            />
            <View style={s.textos}>
              <Text style={s.fuerte}>
                {cumplidas} {cumplidas === 1 ? "señal" : "señales"} para bajar volumen esta semana
              </Text>
              <Text style={s.tenue}>
                {cumplidas >= 2
                  ? "Propón bajar un 25–30 % el volumen, empezando por los accesorios. Los compuestos no se recortan."
                  : `Con ${2 - cumplidas === 1 ? "una más" : "dos"}, la app te propondrá bajar un 25–30 % el volumen, empezando por los accesorios.`}
              </Text>
              {criterios &&
                senales.map((senal) => (
                  <Text key={senal.texto} style={senal.cumple ? s.cumple : s.tenue}>
                    {senal.cumple ? "■ " : "□ "}
                    {senal.texto}
                  </Text>
                ))}
            </View>
            <Enlace
              texto={criterios ? "Ocultar criterios" : "Ver criterios"}
              onPress={() => setCriterios(!criterios)}
            />
          </View>
        )}
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  grupo: { gap: espacio[12] },
  tarjeta: {
    backgroundColor: tema.superficie,
    borderRadius: radio.tarjeta,
    paddingHorizontal: espacio[16],
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: tema.avisoBorde,
  },
  fila: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    paddingVertical: espacio[16],
    flexWrap: "wrap",
  },
  separada: { borderTopWidth: 1, borderTopColor: tema.borde },
  punto: { width: 8, height: 8, borderRadius: 2, marginTop: 7 },
  textos: { flex: 1, minWidth: 220, gap: espacio[4] },
  fuerte: { color: tema.texto, fontFamily: tema.fuenteBoton, fontSize: 15 },
  tenue: { color: tema.textoTenue, fontFamily: tema.fuenteTexto, fontSize: 13, lineHeight: 18 },
  cumple: { color: tema.aviso, fontFamily: tema.fuenteTexto, fontSize: 13, lineHeight: 18 },
  acciones: { flexDirection: "row", alignItems: "center", gap: 12 },
  boton: {
    minHeight: 44,
    paddingHorizontal: espacio[16],
    borderRadius: radio.celda,
    justifyContent: "center",
    borderWidth: 1,
    borderColor: tema.acento,
    backgroundColor: tema.acentoSuave,
  },
  textoBoton: { color: tema.acento, fontFamily: tema.fuenteBoton, fontSize: 14 },
  campo: {
    minHeight: 88,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: tema.bordeFuerte,
    backgroundColor: tema.hundido,
    color: tema.texto,
    fontFamily: tema.fuenteTexto,
    fontSize: 15,
    padding: 12,
    textAlignVertical: "top",
  },
})
