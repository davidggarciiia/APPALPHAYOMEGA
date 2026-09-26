import { useState } from "react"
import { Pressable, StyleSheet, Text, View } from "react-native"
import { lunesDe, type SesionProgramada } from "@alpha-omega/shared"

import { ErrorDelServidor } from "../lib/transporte"
import { faltaDe } from "../lib/errores"
import { diasDeLaSemana, fechaCorta, fechaLarga } from "../lib/fechas"
import { tema } from "../tema"

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
      <Pressable
        onPress={() => setAbierto(true)}
        style={({ pressed }) => [estilos.enlace, pressed && estilos.pulsado]}
        accessibilityRole="button"
        hitSlop={8}
      >
        <Text style={estilos.textoEnlace}>CAMBIAR DÍA</Text>
      </Pressable>
    )
  }

  return (
    <View style={estilos.panel}>
      <Text style={estilos.pregunta}>¿A qué día de esta semana la mueves?</Text>
      <View style={estilos.dias}>
        {diasDeLaSemana(lunesDe(agenda.fechaOriginal)).map((fecha) => {
          const actual = fecha === agenda.fechaActual
          return (
            <Pressable
              key={fecha}
              onPress={() => void mover(fecha)}
              disabled={actual || ocupado !== null}
              style={({ pressed }) => [
                estilos.dia,
                actual && estilos.diaActual,
                pressed && estilos.pulsado,
              ]}
              accessibilityRole="button"
              accessibilityLabel={`Mover al ${fechaLarga(fecha)}`}
              accessibilityState={{ selected: actual, busy: ocupado === fecha }}
            >
              <Text style={[estilos.textoDia, actual && estilos.textoDiaActual]}>
                {ocupado === fecha ? "…" : fechaCorta(fecha).toUpperCase()}
              </Text>
            </Pressable>
          )
        })}
      </View>
      {error !== null && (
        <Text style={estilos.error} accessibilityRole="alert">
          {error}
        </Text>
      )}
      <Pressable onPress={() => setAbierto(false)} accessibilityRole="button" hitSlop={8}>
        <Text style={estilos.cancelar}>CANCELAR</Text>
      </Pressable>
    </View>
  )
}

const estilos = StyleSheet.create({
  enlace: { alignSelf: "flex-start", paddingVertical: 4 },
  textoEnlace: { color: tema.oro, fontSize: 11, fontWeight: "700", letterSpacing: 2 },
  pulsado: { opacity: 0.6 },
  panel: { gap: 10, marginTop: 4 },
  pregunta: { color: tema.texto, fontSize: 13 },
  dias: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  dia: {
    borderWidth: 1,
    borderColor: tema.borde,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    minWidth: 58,
    alignItems: "center",
  },
  diaActual: { backgroundColor: tema.oro, borderColor: tema.oro },
  textoDia: { color: tema.texto, fontSize: 11, fontWeight: "700", letterSpacing: 1 },
  textoDiaActual: { color: tema.fondo },
  error: { color: tema.error, fontSize: 13 },
  cancelar: { color: tema.textoTenue, fontSize: 11, letterSpacing: 2 },
})
