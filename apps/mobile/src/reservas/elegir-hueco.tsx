import { useEffect, useState } from "react"
import { View, StyleSheet } from "react-native"
import type { Disponibilidad, Hueco } from "@alpha-omega/shared"

import { faltaDe, type Falta } from "../lib/errores"
import type { ApiReservas } from "./api"
import { HuecosDelDia, TiraDeDias, diasConHuecos, primerDiaConHuecos } from "./calendario"
import { fechaTitulo } from "./formato"
import { Estado, Texto } from "./piezas"

/**
 * Días y huecos libres de un servicio en la agenda del entrenador, para mover
 * una reserva o reservar para un cliente. El entrenador no tiene antelación ni
 * horizonte, pero nunca ve un hueco que se solape con otra reserva: los calcula
 * el servidor.
 *
 * `recarga` cambia cuando hay que volver a pedirlos (tras un 409).
 */
export function SelectorHueco({
  api,
  servicioId,
  desde,
  elegido,
  elegir,
  recarga = 0,
}: {
  api: ApiReservas
  servicioId: string
  desde: string
  elegido: Hueco | null
  elegir: (hueco: Hueco | null) => void
  recarga?: number
}): React.JSX.Element {
  const [dias, setDias] = useState<Disponibilidad["dias"] | null>(null)
  const [dia, setDia] = useState<string | null>(null)
  const [fallo, setFallo] = useState<Falta | null>(null)
  const [intento, setIntento] = useState(0)

  useEffect(() => {
    let vigente = true
    setFallo(null)
    api
      .disponibilidad(servicioId, desde, 14)
      .then((disponibilidad) => {
        if (!vigente) return
        setDias(disponibilidad.dias)
        setDia((actual) =>
          actual !== null && disponibilidad.dias.some((d) => d.fecha === actual)
            ? actual
            : primerDiaConHuecos(disponibilidad.dias),
        )
      })
      .catch((error: unknown) => {
        if (vigente) setFallo(faltaDe(error, "No hemos podido cargar los huecos libres."))
      })
    return () => {
      vigente = false
    }
  }, [api, servicioId, desde, recarga, intento])

  // Si el hueco elegido ya no está libre tras recargar, deja de estar elegido.
  useEffect(() => {
    if (dias === null || elegido === null) return
    if (!dias.some((d) => d.huecos.some((h) => h.inicio === elegido.inicio))) elegir(null)
  }, [dias, elegido, elegir])

  const actual = dias?.find((d) => d.fecha === dia) ?? null
  return (
    <View style={estilos.caja}>
      <Estado
        cargando={dias === null && fallo === null}
        error={fallo}
        reintentar={() => setIntento((n) => n + 1)}
        etiqueta="Cargando huecos libres"
      />
      {dias !== null && (
        <TiraDeDias
          dias={diasConHuecos(dias)}
          elegida={dia}
          elegir={(fecha) => {
            setDia(fecha)
            elegir(null)
          }}
        />
      )}
      {actual !== null && (
        <>
          <Texto fuerte>{fechaTitulo(actual.fecha)}</Texto>
          <HuecosDelDia huecos={actual.huecos} elegido={elegido?.inicio ?? null} elegir={elegir} />
        </>
      )}
    </View>
  )
}

const estilos = StyleSheet.create({
  caja: { gap: 12 },
})
