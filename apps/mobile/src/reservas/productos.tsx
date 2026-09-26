import { useState } from "react"
import { StyleSheet, View, type LayoutChangeEvent } from "react-native"
import type { Producto, SolicitudProducto } from "@alpha-omega/shared"

import { faltaDe, type Falta } from "../lib/errores"
import type { ApiReservas } from "./api"
import { codigoDe } from "./errores"
import { euros } from "./formato"
import { detalleProducto } from "./saldo"
import { Aviso, Boton, Seccion, Tarjeta, Texto } from "./piezas"

/**
 * «Consigue más sesiones»: planes y bonos de EP con su precio y «Lo quiero».
 *
 * No se paga en la app. Pedir crea una solicitud y el entrenador la activa
 * cuando cobra; hasta entonces se puede anular. Solo se ofrecen los productos
 * que dan sesiones de EP: el boxeo todavía no se reserva desde aquí.
 */
export function ConsigueSesiones({
  productos,
  solicitudes,
  api,
  abierto,
  alternar,
  alCambiar,
  onLayout,
}: {
  productos: Producto[]
  solicitudes: SolicitudProducto[]
  api: ApiReservas
  abierto: boolean
  alternar: () => void
  /** Tras pedir o anular: vuelve a leer las solicitudes. */
  alCambiar: () => Promise<void>
  onLayout?: (evento: LayoutChangeEvent) => void
}): React.JSX.Element {
  const [ocupado, setOcupado] = useState<string | null>(null)
  const [fallo, setFallo] = useState<Falta | null>(null)
  const [hecho, setHecho] = useState<string | null>(null)

  const deEp = productos.filter((p) => p.clase === "ep" && p.activo && p.visibleParaCliente)
  const pendientes = solicitudes.filter((s) => s.estado === "pendiente")

  async function hacer(
    clave: string,
    accion: () => Promise<unknown>,
    exito: string,
  ): Promise<void> {
    setOcupado(clave)
    setFallo(null)
    setHecho(null)
    try {
      await accion()
      await alCambiar()
      setHecho(exito)
    } catch (error) {
      setFallo(
        codigoDe(error) === "estado_incompatible"
          ? {
              texto: "Esa solicitud ya no está pendiente. Hemos actualizado la lista.",
              reintentable: false,
              sesionCaducada: false,
            }
          : faltaDe(error, "No hemos podido enviar tu petición. Inténtalo de nuevo."),
      )
      await alCambiar().catch(() => undefined)
    } finally {
      setOcupado(null)
    }
  }

  return (
    <Seccion
      titulo="Consigue más sesiones"
      onLayout={onLayout}
      derecha={
        <Boton
          tipo="enlace"
          texto={abierto ? "Ocultar" : "Ver planes y bonos"}
          etiqueta={abierto ? "Ocultar planes y bonos" : "Ver planes y bonos"}
          expandido={abierto}
          onPress={alternar}
        />
      }
    >
      {pendientes.map((solicitud) => (
        <Tarjeta key={solicitud.id} destacada>
          <Texto fuerte>{`Pedido: ${solicitud.producto.nombre}`}</Texto>
          <Texto tenue>{`${euros(solicitud.precioCentimos)} · pendiente de activar`}</Texto>
          <Boton
            texto="Anular"
            tipo="secundario"
            etiqueta={`Anular la petición de ${solicitud.producto.nombre}`}
            ocupado={ocupado === solicitud.id}
            deshabilitado={ocupado !== null && ocupado !== solicitud.id}
            onPress={() =>
              void hacer(
                solicitud.id,
                () => api.anularSolicitud(solicitud.id),
                `Has anulado la petición de ${solicitud.producto.nombre}.`,
              )
            }
          />
        </Tarjeta>
      ))}
      {hecho !== null && <Aviso tipo="exito" texto={hecho} />}
      {fallo !== null && <Aviso texto={fallo.texto} />}
      {abierto && (
        <View style={estilos.lista}>
          <Texto tenue>
            Pulsa «Lo quiero» en lo que te interese. Tu entrenador lo activará cuando le pagues.
          </Texto>
          {deEp.length === 0 && <Texto tenue>Ahora mismo no hay planes ni bonos a la venta.</Texto>}
          {deEp.map((producto) => {
            const pedido = pendientes.some((s) => s.producto.id === producto.id)
            return (
              <Tarjeta key={producto.id}>
                <View style={estilos.cabecera}>
                  <Texto fuerte>{producto.nombre}</Texto>
                  <Texto fuerte>{euros(producto.precioCentimos)}</Texto>
                </View>
                {producto.descripcion !== null && <Texto tenue>{producto.descripcion}</Texto>}
                {detalleProducto(producto).map((linea) => (
                  <Texto key={linea} tenue>
                    {linea}
                  </Texto>
                ))}
                <Boton
                  texto={pedido ? "Pedido" : "Lo quiero"}
                  tipo={pedido ? "secundario" : "principal"}
                  etiqueta={
                    pedido
                      ? `${producto.nombre}, ya pedido`
                      : `Lo quiero: ${producto.nombre}, ${euros(producto.precioCentimos)}`
                  }
                  ocupado={ocupado === producto.id}
                  deshabilitado={pedido || (ocupado !== null && ocupado !== producto.id)}
                  onPress={() =>
                    void hacer(
                      producto.id,
                      () => api.pedirProducto(producto.id),
                      `Pedido: ${producto.nombre}. Tu entrenador lo activará cuando le pagues.`,
                    )
                  }
                />
              </Tarjeta>
            )
          })}
        </View>
      )}
    </Seccion>
  )
}

const estilos = StyleSheet.create({
  lista: { gap: 12 },
  cabecera: { flexDirection: "row", justifyContent: "space-between", gap: 12, flexWrap: "wrap" },
})
