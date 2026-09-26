import { useEffect, useState } from "react"
import { StyleSheet, View } from "react-native"
import type { ActivarSolicitud, SolicitudProducto } from "@alpha-omega/shared"

import { faltaDe, type Falta } from "../lib/errores"
import { FormularioActivacion } from "./activar-producto"
import type { ApiReservas } from "./api"
import { codigoDe } from "./errores"
import { euros, fechaLarga, local, nombreDe } from "./formato"
import { Aviso, Boton, Estado, Hoja, Tarjeta, Texto } from "./piezas"

type Mensaje = { texto: string; tipo: "error" | "aviso" | "exito" }

/**
 * Los «Lo quiero» pendientes. El entrenador activa cuando cobra (o lo deja
 * pendiente de cobro) y en la misma operación nacen el saldo y el cobro.
 */
export function SolicitudesEntrenador({
  api,
  alContar,
}: {
  api: ApiReservas
  /** Cuántas quedan pendientes, para el globo de la sección. */
  alContar?: (pendientes: number) => void
}): React.JSX.Element {
  const [solicitudes, setSolicitudes] = useState<SolicitudProducto[] | null>(null)
  const [fallo, setFallo] = useState<Falta | null>(null)
  const [intento, setIntento] = useState(0)
  const [mensaje, setMensaje] = useState<Mensaje | null>(null)
  const [activando, setActivando] = useState<SolicitudProducto | null>(null)
  const [rechazando, setRechazando] = useState<SolicitudProducto | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [falloHoja, setFalloHoja] = useState<string | null>(null)

  useEffect(() => {
    let vigente = true
    setFallo(null)
    api
      .solicitudesPendientes()
      .then(({ solicitudes: lista }) => {
        if (vigente) setSolicitudes(lista.filter((s) => s.estado === "pendiente"))
      })
      .catch((error: unknown) => {
        if (vigente) setFallo(faltaDe(error, "No hemos podido cargar las solicitudes."))
      })
    return () => {
      vigente = false
    }
  }, [api, intento])

  useEffect(() => {
    if (solicitudes !== null) alContar?.(solicitudes.length)
  }, [solicitudes, alContar])

  const quitar = (id: string): void =>
    setSolicitudes((actuales) => (actuales ?? []).filter((s) => s.id !== id))

  /** Si ya no estaba pendiente, se recarga la lista y se dice. */
  const fallar = (error: unknown, respaldo: string): void => {
    if (codigoDe(error) === "estado_incompatible") {
      setActivando(null)
      setRechazando(null)
      setMensaje({
        tipo: "aviso",
        texto: "Esa solicitud ya no estaba pendiente. Lista actualizada.",
      })
      setIntento((n) => n + 1)
    } else {
      setFalloHoja(faltaDe(error, respaldo).texto)
    }
  }

  async function activar(solicitud: SolicitudProducto, datos: ActivarSolicitud): Promise<void> {
    setOcupado(true)
    setFalloHoja(null)
    try {
      const activacion = await api.activarSolicitud(solicitud.id, datos)
      quitar(solicitud.id)
      setActivando(null)
      setMensaje({
        tipo: "exito",
        texto: `Activado: ${solicitud.producto.nombre} para ${nombreDe(solicitud.cliente)}. Cobro de ${euros(activacion.cobro.importeCentimos)} ${activacion.cobro.estado === "cobrado" ? "registrado" : "pendiente"}.`,
      })
    } catch (error) {
      fallar(error, "No hemos podido activarla.")
    } finally {
      setOcupado(false)
    }
  }

  async function rechazar(solicitud: SolicitudProducto): Promise<void> {
    setOcupado(true)
    setFalloHoja(null)
    try {
      await api.rechazarSolicitud(solicitud.id)
      quitar(solicitud.id)
      setRechazando(null)
      setMensaje({
        tipo: "exito",
        texto: `Rechazada la solicitud de ${solicitud.producto.nombre} de ${nombreDe(solicitud.cliente)}.`,
      })
    } catch (error) {
      fallar(error, "No hemos podido rechazarla.")
    } finally {
      setOcupado(false)
    }
  }

  if (solicitudes === null) {
    return (
      <Estado
        cargando={fallo === null}
        error={fallo}
        reintentar={() => setIntento((n) => n + 1)}
        etiqueta="Cargando solicitudes"
      />
    )
  }

  return (
    <View style={estilos.caja}>
      {mensaje !== null && <Aviso tipo={mensaje.tipo} texto={mensaje.texto} />}
      {solicitudes.length === 0 && (
        <Texto tenue>
          No hay solicitudes pendientes. Cuando un cliente pulse «Lo quiero», aparecerá aquí.
        </Texto>
      )}
      {solicitudes.map((solicitud) => {
        const cliente = nombreDe(solicitud.cliente)
        return (
          <Tarjeta key={solicitud.id}>
            <Texto fuerte>{cliente}</Texto>
            <Texto>{`${solicitud.producto.nombre} · ${euros(solicitud.precioCentimos)}`}</Texto>
            <Texto tenue>{`Lo pidió el ${fechaLarga(local(solicitud.creadaEn).fecha)}`}</Texto>
            <View style={estilos.acciones}>
              <Boton
                texto="Activar"
                etiqueta={`Activar ${solicitud.producto.nombre} para ${cliente}`}
                onPress={() => {
                  setFalloHoja(null)
                  setActivando(solicitud)
                }}
              />
              <Boton
                texto="Rechazar"
                tipo="secundario"
                etiqueta={`Rechazar ${solicitud.producto.nombre} de ${cliente}`}
                onPress={() => {
                  setFalloHoja(null)
                  setRechazando(solicitud)
                }}
              />
            </View>
          </Tarjeta>
        )
      })}

      <Hoja
        visible={activando !== null}
        titulo={activando === null ? "" : `Activar ${activando.producto.nombre}`}
        alCerrar={() => setActivando(null)}
        ocupado={ocupado}
      >
        {activando !== null && (
          <>
            <Texto>{`Para ${nombreDe(activando.cliente)}. Precio pedido: ${euros(activando.precioCentimos)}.`}</Texto>
            <FormularioActivacion
              key={activando.id}
              tipo={activando.producto.tipo}
              precioCentimos={activando.precioCentimos}
              ocupado={ocupado}
              fallo={falloHoja}
              confirmar={(datos) => void activar(activando, datos)}
              cancelar={() => setActivando(null)}
            />
          </>
        )}
      </Hoja>

      <Hoja
        visible={rechazando !== null}
        titulo="¿Rechazar esta solicitud?"
        alCerrar={() => setRechazando(null)}
        ocupado={ocupado}
      >
        {rechazando !== null && (
          <>
            <Texto>{`${rechazando.producto.nombre} de ${nombreDe(rechazando.cliente)}. No se crea nada.`}</Texto>
            {falloHoja !== null && <Aviso texto={falloHoja} />}
            <Boton
              texto="Rechazar"
              tipo="peligro"
              ocupado={ocupado}
              onPress={() => void rechazar(rechazando)}
            />
            <Boton
              texto="Cancelar"
              tipo="secundario"
              deshabilitado={ocupado}
              onPress={() => setRechazando(null)}
            />
          </>
        )}
      </Hoja>
    </View>
  )
}

const estilos = StyleSheet.create({
  caja: { gap: 12 },
  acciones: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
})
