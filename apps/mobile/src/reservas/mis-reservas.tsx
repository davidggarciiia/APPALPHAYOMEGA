import { useState } from "react"
import { StyleSheet, View } from "react-native"
import type { MisReservas, Reserva } from "@alpha-omega/shared"

import { faltaDe, type Falta } from "../lib/errores"
import type { ApiReservas } from "./api"
import { euros, fechaTitulo, local, momento, personas, tramo } from "./formato"
import { Aviso, Boton, Hoja, Seccion, Tarjeta, Texto } from "./piezas"

/** Servicio, personas y de dónde sale la sesión o cuánto se paga allí. */
export function detalleReserva(reserva: Reserva): string {
  const partes = [reserva.servicio.nombre]
  if (reserva.personas > 1) partes.push(personas(reserva.personas))
  if (reserva.fuenteSaldo !== null) partes.push(reserva.fuenteSaldo)
  if (reserva.cobroCentimos !== null) partes.push(`${euros(reserva.cobroCentimos)} en el centro`)
  return partes.join(" · ")
}

/** Cómo terminó una reserva cancelada, en una línea. */
export function estadoCancelada(reserva: Reserva): string {
  const quien = reserva.cancelacion?.porEntrenador ? "por tu entrenador" : "por ti"
  if (reserva.fuenteSaldo === null) return `Cancelada ${quien}`
  const devuelta = reserva.cancelacion?.sesionDevuelta || reserva.devueltaAMano
  return `Cancelada ${quien} · sesión ${devuelta ? "devuelta" : "no devuelta"}`
}

/**
 * «Tus próximas reservas» con su botón de cancelar, y las pasadas y canceladas
 * plegadas debajo.
 *
 * Antes de confirmar una cancelación fuera de plazo se dice con todas las
 * letras que la sesión no se devuelve: es la única cosa de esta pantalla que
 * cuesta dinero al cliente.
 */
export function ReservasDelCliente({
  reservas,
  api,
  ahora,
  alCancelar,
}: {
  reservas: MisReservas
  api: ApiReservas
  ahora: () => Date
  /** Tras cancelar: el texto que confirma qué ha pasado con la sesión. */
  alCancelar: (texto: string) => void
}): React.JSX.Element {
  const [aCancelar, setACancelar] = useState<Reserva | null>(null)
  const [cancelando, setCancelando] = useState(false)
  const [fallo, setFallo] = useState<Falta | null>(null)
  const [verPasadas, setVerPasadas] = useState(false)

  const proximas = reservas.proximas.filter((r) => r.estado === "confirmada")
  const pasadas = [
    ...reservas.proximas.filter((r) => r.estado === "cancelada"),
    ...reservas.pasadas,
  ].sort((a, b) => b.inicio.localeCompare(a.inicio))

  const dentroDePlazo = (reserva: Reserva): boolean =>
    ahora().getTime() < Date.parse(reserva.cancelarSinPerderHasta)

  async function cancelar(): Promise<void> {
    if (aCancelar === null) return
    setCancelando(true)
    setFallo(null)
    try {
      const cancelada = await api.cancelarMia(aCancelar.id)
      setACancelar(null)
      alCancelar(
        cancelada.fuenteSaldo === null
          ? "Reserva cancelada."
          : cancelada.cancelacion?.sesionDevuelta
            ? "Reserva cancelada. Recuperas la sesión."
            : "Reserva cancelada. La sesión no se devuelve porque ya había pasado el plazo.",
      )
    } catch (error) {
      setFallo(faltaDe(error, "No hemos podido cancelar la reserva. Inténtalo de nuevo."))
    } finally {
      setCancelando(false)
    }
  }

  return (
    <Seccion titulo="Tus próximas reservas">
      {proximas.length === 0 ? (
        <Texto tenue>No tienes ninguna reserva. Elige un hueco arriba.</Texto>
      ) : (
        proximas.map((reserva) => {
          const fecha = local(reserva.inicio).fecha
          const empezada = Date.parse(reserva.inicio) <= ahora().getTime()
          return (
            <Tarjeta key={reserva.id}>
              <View style={estilos.fila}>
                <Texto fuerte>{fechaTitulo(fecha)}</Texto>
                <Texto fuerte>{tramo(reserva)}</Texto>
              </View>
              <Texto tenue>{detalleReserva(reserva)}</Texto>
              {reserva.fuenteSaldo !== null && !empezada && (
                <Texto tenue>
                  {dentroDePlazo(reserva)
                    ? `Puedes cancelar sin perder la sesión hasta el ${momento(reserva.cancelarSinPerderHasta)}.`
                    : "Ha pasado el plazo: si cancelas, la sesión no se devuelve."}
                </Texto>
              )}
              {!empezada && (
                <Boton
                  texto="Cancelar"
                  tipo="secundario"
                  etiqueta={`Cancelar la reserva del ${momento(reserva.inicio)}`}
                  onPress={() => {
                    setFallo(null)
                    setACancelar(reserva)
                  }}
                />
              )}
            </Tarjeta>
          )
        })
      )}

      {pasadas.length > 0 && (
        <Boton
          tipo="enlace"
          texto={
            verPasadas
              ? "Ocultar pasadas y canceladas"
              : `Ver pasadas y canceladas (${String(pasadas.length)})`
          }
          expandido={verPasadas}
          onPress={() => setVerPasadas((v) => !v)}
        />
      )}
      {verPasadas &&
        pasadas.map((reserva) => (
          <Tarjeta key={reserva.id} apagada>
            <View style={estilos.fila}>
              <Texto>{fechaTitulo(local(reserva.inicio).fecha)}</Texto>
              <Texto>{tramo(reserva)}</Texto>
            </View>
            <Texto tenue>{detalleReserva(reserva)}</Texto>
            <Texto tenue>
              {reserva.estado === "cancelada" ? estadoCancelada(reserva) : "Hecha"}
            </Texto>
          </Tarjeta>
        ))}

      <Hoja
        visible={aCancelar !== null}
        titulo="¿Cancelar esta reserva?"
        alCerrar={() => setACancelar(null)}
        ocupado={cancelando}
      >
        {aCancelar !== null && (
          <>
            <Texto>
              {`${fechaTitulo(local(aCancelar.inicio).fecha)}, de ${tramo(aCancelar).replace(" – ", " a ")}. ${aCancelar.servicio.nombre}.`}
            </Texto>
            {aCancelar.fuenteSaldo !== null &&
              (dentroDePlazo(aCancelar) ? (
                <Texto>Estás a tiempo: recuperas la sesión.</Texto>
              ) : (
                <Aviso
                  tipo="aviso"
                  texto={`Ya pasó el plazo para cancelar sin perder la sesión (terminó el ${momento(aCancelar.cancelarSinPerderHasta)}). Si cancelas, el hueco se libera pero la sesión no se devuelve.`}
                />
              ))}
            {aCancelar.cobroCentimos !== null && (
              <Texto>{`Se anula el pago de ${euros(aCancelar.cobroCentimos)} en el centro.`}</Texto>
            )}
            {fallo !== null && <Aviso texto={fallo.texto} />}
            <Boton
              texto="Cancelar reserva"
              tipo="peligro"
              ocupado={cancelando}
              onPress={() => void cancelar()}
            />
            <Boton
              texto="Mantenerla"
              tipo="secundario"
              deshabilitado={cancelando}
              onPress={() => setACancelar(null)}
            />
          </>
        )}
      </Hoja>
    </Seccion>
  )
}

const estilos = StyleSheet.create({
  fila: { flexDirection: "row", justifyContent: "space-between", gap: 12, flexWrap: "wrap" },
})
