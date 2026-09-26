import { useState } from "react"
import { StyleSheet, Text, View } from "react-native"
import { LinearGradient } from "expo-linear-gradient"
import { lunesDe, type SesionProgramada } from "@alpha-omega/shared"

import { ErrorDelServidor } from "../lib/transporte"
import { faltaDe } from "../lib/errores"
import { diasDeLaSemana, fechaLarga } from "../lib/fechas"
import { degradados, fuentes, tema } from "../tema"

import { Pulsable } from "./pulsable"

const LETRAS = ["L", "M", "X", "J", "V", "S", "D"] as const

/**
 * Mover una sesión a otro día de SU semana (SPEC-agenda.md).
 *
 * Solo ofrece los siete días de la semana de la fecha original. Si el cambio
 * falla, se queda la fecha confirmada anterior y se puede reintentar; nunca se
 * enseña como hecho algo que el servidor no ha confirmado.
 */
export function CambiarDia({
  agenda,
  cambiar,
  alCambiar,
}: {
  agenda: SesionProgramada
  cambiar: (fecha: string, revision: number) => Promise<SesionProgramada>
  alCambiar: (agenda: SesionProgramada) => void
}): React.JSX.Element {
  const [abierto, setAbierto] = useState(false)
  const [ocupado, setOcupado] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  if (agenda.estado === "cerrada") {
    return <></>
  }

  const mover = async (fecha: string): Promise<void> => {
    setOcupado(fecha)
    setError(null)
    try {
      alCambiar(await cambiar(fecha, agenda.revision))
      setAbierto(false)
    } catch (fallo) {
      const actual =
        fallo instanceof ErrorDelServidor && fallo.detalle?.codigo === "revision_obsoleta"
          ? (fallo.detalle.actual as SesionProgramada | undefined)
          : undefined
      if (actual !== undefined && actual.fechaActual === fecha) {
        // La respuesta anterior se perdió pero el cambio sí llegó.
        alCambiar(actual)
        setAbierto(false)
      } else {
        if (actual !== undefined) {
          alCambiar(actual)
        }
        setError(faltaDe(fallo, "No hemos podido cambiar el día. Inténtalo otra vez.").texto)
      }
    } finally {
      setOcupado(null)
    }
  }

  if (!abierto) {
    return (
      <Pulsable
        onPress={() => setAbierto(true)}
        style={estilos.enlace}
        accessibilityRole="button"
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Text style={estilos.textoEnlace}>Cambiar día</Text>
      </Pulsable>
    )
  }

  return (
    <View style={estilos.panel}>
      <Text style={estilos.pregunta}>¿A qué día de esta semana la mueves?</Text>
      <View style={estilos.dias}>
        {diasDeLaSemana(lunesDe(agenda.fechaOriginal)).map((fecha, indice) => {
          const actual = fecha === agenda.fechaActual
          const original = fecha === agenda.fechaOriginal
          return (
            <Pulsable
              key={fecha}
              onPress={() => void mover(fecha)}
              disabled={actual || ocupado !== null}
              style={[estilos.dia, !actual && estilos.diaLibre]}
              accessibilityRole="button"
              accessibilityLabel={`Mover al ${fechaLarga(fecha)}${original ? ", día original" : ""}`}
              accessibilityState={{ selected: actual, busy: ocupado === fecha }}
            >
              {actual && (
                <LinearGradient
                  colors={degradados.oro}
                  locations={degradados.paradas}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={[StyleSheet.absoluteFill, { borderRadius: 12 }]}
                />
              )}
              <Text style={[estilos.letra, actual && estilos.sobreOro]}>{LETRAS[indice]}</Text>
              <Text style={[estilos.numero, actual && estilos.sobreOro]}>
                {ocupado === fecha ? "…" : String(Number(fecha.slice(8, 10)))}
              </Text>
              <View style={[estilos.original, original && !actual && estilos.originalVisible]} />
            </Pulsable>
          )
        })}
      </View>
      {agenda.fechaActual !== agenda.fechaOriginal && (
        <Text style={estilos.nota}>
          {`El punto marca el día original: ${fechaLarga(agenda.fechaOriginal)}.`}
        </Text>
      )}
      {error !== null && (
        <Text style={estilos.error} accessibilityRole="alert">
          {error}
        </Text>
      )}
      <Pulsable
        onPress={() => setAbierto(false)}
        style={estilos.enlace}
        accessibilityRole="button"
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Text style={estilos.cancelar}>Cancelar</Text>
      </Pulsable>
    </View>
  )
}

const estilos = StyleSheet.create({
  enlace: { alignSelf: "flex-start", minHeight: 36, justifyContent: "center" },
  textoEnlace: { color: tema.oro, fontFamily: fuentes.semi, fontSize: 14 },
  panel: { gap: 12, paddingBottom: 6 },
  pregunta: { color: tema.texto, fontFamily: fuentes.normal, fontSize: 14 },
  dias: { flexDirection: "row", gap: 4 },
  dia: {
    flex: 1,
    height: 64,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
    overflow: "hidden",
  },
  diaLibre: { backgroundColor: tema.superficieAlta },
  letra: { color: tema.textoTenue, fontFamily: fuentes.normal, fontSize: 12 },
  numero: { color: tema.texto, fontFamily: fuentes.negrita, fontSize: 16 },
  sobreOro: { color: tema.sobreOro },
  original: { width: 5, height: 5, borderRadius: 2.5 },
  originalVisible: { backgroundColor: tema.textoTenue },
  nota: { color: tema.textoTenue, fontFamily: fuentes.normal, fontSize: 13 },
  error: { color: tema.error, fontFamily: fuentes.normal, fontSize: 14 },
  cancelar: { color: tema.textoTenue, fontFamily: fuentes.semi, fontSize: 14 },
})
