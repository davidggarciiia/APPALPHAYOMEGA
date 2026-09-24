import { StyleSheet, Text, View } from "react-native"
import type { ListadoResultados, Molestia } from "@alpha-omega/shared"

import { fechaLegible } from "../../entrenamiento/fechas"
import { Fila, Tarjeta, Titulo } from "../../entrenamiento/plan/piezas"
import { Enlace } from "../../entrenamiento/sesion/controles"
import { tema } from "../../tema"
import { textoDeMolestia } from "./atencion"

const MOLESTIA_AL_LLEGAR = { nada: "Nada", agujetas: "Agujetas", dolor: "Dolor" } as const

/** «Check-ins y molestias»: cómo llegó y cómo terminó cada sesión, y cada aviso. */
export function CheckinsYMolestias({
  resultados,
  molestias,
  responder,
}: {
  resultados: ListadoResultados["resultados"]
  molestias: Molestia[]
  responder: (molestia: Molestia) => void
}): React.JSX.Element {
  const conDatos = resultados.filter((r) => r.resultado.checkin || r.resultado.cierre)
  return (
    <View style={s.contenido}>
      <View style={s.grupo}>
        <Titulo>Check-ins</Titulo>
        {conDatos.length === 0 ? (
          <Text style={s.tenue}>Aún no hay sesiones con check-in.</Text>
        ) : (
          <Tarjeta>
            {conDatos.map(({ agenda, resultado }, n) => {
              const { checkin, cierre } = resultado
              return (
                <Fila key={agenda.id} primera={n === 0}>
                  <View style={s.textos}>
                    <Text style={s.fuerte}>
                      {resultado.prescripcion.nombre} · {fechaLegible(agenda.fechaActual)}
                    </Text>
                    {checkin && (
                      <Text style={s.tenue}>
                        Llega: {checkin.sensacion} de 5 · {MOLESTIA_AL_LLEGAR[checkin.molestia]}
                      </Text>
                    )}
                    {cierre && (
                      <Text style={cierre.incomodo || cierre.esfuerzo >= 9 ? s.aviso : s.tenue}>
                        Termina: esfuerzo {cierre.esfuerzo} de 10 · energía {cierre.energia} de 5
                        {cierre.incomodo ? " · algo incómodo" : ""}
                      </Text>
                    )}
                  </View>
                </Fila>
              )
            })}
          </Tarjeta>
        )}
      </View>
      <View style={s.grupo}>
        <Titulo>Molestias</Titulo>
        {molestias.length === 0 ? (
          <Text style={s.tenue}>Ninguna molestia registrada.</Text>
        ) : (
          <Tarjeta>
            {molestias.map((m, n) => {
              const { titulo, detalle } = textoDeMolestia(m)
              return (
                <Fila key={m.id} primera={n === 0}>
                  <View style={s.textos}>
                    <Text style={s.fuerte}>{titulo}</Text>
                    <Text style={s.tenue}>
                      {fechaLegible(m.creadaEn.slice(0, 10))} · {detalle}
                    </Text>
                    {m.respuesta && <Text style={s.respuesta}>Tu respuesta: {m.respuesta}</Text>}
                  </View>
                  {m.estado === "abierta" ? (
                    <Enlace texto="Responder" onPress={() => responder(m)} />
                  ) : (
                    <Text style={s.tenue}>Atendida</Text>
                  )}
                </Fila>
              )
            })}
          </Tarjeta>
        )}
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  contenido: { gap: 28 },
  grupo: { gap: 12 },
  textos: { flex: 1, gap: 3 },
  fuerte: { color: tema.texto, fontFamily: tema.fuenteBoton, fontSize: 15 },
  tenue: { color: tema.textoTenue, fontFamily: tema.fuenteTexto, fontSize: 13 },
  aviso: { color: tema.aviso, fontFamily: tema.fuenteTexto, fontSize: 13 },
  respuesta: { color: tema.textoSecundario, fontFamily: tema.fuenteTexto, fontSize: 13 },
})
