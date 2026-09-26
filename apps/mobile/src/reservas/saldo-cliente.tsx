import { useEffect, useState } from "react"
import { StyleSheet, View } from "react-native"
import {
  ZONA_AGENDA,
  hoyEnZona,
  sumarDiasFecha,
  type ActivarSolicitud,
  type DetalleSaldo,
  type Producto,
  type Reserva,
} from "@alpha-omega/shared"

import { faltaDe, type Falta } from "../lib/errores"
import { FormularioActivacion } from "./activar-producto"
import { useReservas, type ApiReservas } from "./api"
import { euros, fechaCorta, fechaTitulo, local, sesiones, tramo } from "./formato"
import { detalleReserva } from "./mis-reservas"
import { Aviso, Boton, Eleccion, Estado, Grupo, Hoja, Seccion, Tarjeta, Texto } from "./piezas"
import { ResumenDeSaldo } from "./saldo"

const TIPO: Record<Producto["tipo"], string> = {
  plan: "Plan",
  bono: "Bono",
  matricula: "Matrícula",
}
const MOTIVO: Record<string, string> = {
  consumo: "Gastada",
  devolucion: "Devuelta",
  ajuste: "Ajuste",
}

/** Saldo, próximas reservas y «Activar producto» en la ficha del cliente. */
export function SaldoCliente({ clienteId }: { clienteId: string }): React.JSX.Element {
  const api = useReservas()
  return <SaldoDelCliente clienteId={clienteId} api={api} />
}

/**
 * Lo que el entrenador necesita del saldo de un cliente sin salir de su ficha:
 * cuántas sesiones le quedan y de dónde, sus próximas reservas, los últimos
 * movimientos y activarle un producto al cobrar.
 */
export function SaldoDelCliente({
  clienteId,
  api,
  ahora = () => new Date(),
}: {
  clienteId: string
  api: ApiReservas
  ahora?: () => Date
}): React.JSX.Element {
  const [detalle, setDetalle] = useState<DetalleSaldo | null>(null)
  const [reservas, setReservas] = useState<Reserva[]>([])
  const [productos, setProductos] = useState<Producto[]>([])
  const [fallo, setFallo] = useState<Falta | null>(null)
  const [intento, setIntento] = useState(0)
  const [activando, setActivando] = useState(false)
  const [producto, setProducto] = useState<Producto | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [falloHoja, setFalloHoja] = useState<string | null>(null)
  const [mensaje, setMensaje] = useState<string | null>(null)

  useEffect(() => {
    let vigente = true
    const hoy = hoyEnZona(ZONA_AGENDA, ahora())
    setFallo(null)
    Promise.all([
      api.saldoCliente(clienteId),
      api.reservas(hoy, sumarDiasFecha(hoy, 62)),
      api.productos(),
    ])
      .then(([leido, listado, catalogo]) => {
        if (!vigente) return
        const instante = ahora().getTime()
        setDetalle(leido)
        setReservas(
          listado.reservas
            .filter(
              (r) =>
                r.cliente.id === clienteId &&
                r.estado === "confirmada" &&
                Date.parse(r.fin) > instante,
            )
            .sort((a, b) => a.inicio.localeCompare(b.inicio)),
        )
        setProductos(catalogo.productos.filter((p) => p.activo))
      })
      .catch((error: unknown) => {
        if (vigente) setFallo(faltaDe(error, "No hemos podido cargar su saldo."))
      })
    return () => {
      vigente = false
    }
    // `ahora` es un reloj: cambia de identidad en cada pintado y no es un dato.
  }, [api, clienteId, intento])

  async function activar(elegido: Producto, datos: ActivarSolicitud): Promise<void> {
    setOcupado(true)
    setFalloHoja(null)
    try {
      const activacion = await api.activarProducto(clienteId, { productoId: elegido.id, ...datos })
      setDetalle((actual) => (actual === null ? actual : { ...actual, resumen: activacion.saldo }))
      setActivando(false)
      setProducto(null)
      setMensaje(
        `Activado: ${elegido.nombre}. Cobro de ${euros(activacion.cobro.importeCentimos)} ${activacion.cobro.estado === "cobrado" ? "registrado" : "pendiente"}.`,
      )
      setIntento((n) => n + 1)
    } catch (error) {
      setFalloHoja(faltaDe(error, "No hemos podido activarlo.").texto)
    } finally {
      setOcupado(false)
    }
  }

  return (
    <View style={estilos.caja}>
      <Seccion titulo="Saldo y reservas">
        {detalle === null ? (
          <Estado
            cargando={fallo === null}
            error={fallo}
            reintentar={() => setIntento((n) => n + 1)}
            etiqueta="Cargando su saldo"
          />
        ) : (
          <>
            <ResumenDeSaldo saldo={detalle.resumen} propio={false} />
            {mensaje !== null && <Aviso tipo="exito" texto={mensaje} />}
            <Boton
              texto="Activar producto"
              onPress={() => {
                setMensaje(null)
                setFalloHoja(null)
                setProducto(null)
                setActivando(true)
              }}
            />
            <Texto fuerte>Próximas reservas</Texto>
            {reservas.length === 0 ? (
              <Texto tenue>No tiene reservas en los próximos dos meses.</Texto>
            ) : (
              reservas.map((reserva) => (
                <Tarjeta key={reserva.id}>
                  <Texto
                    fuerte
                  >{`${fechaTitulo(local(reserva.inicio).fecha)}, ${tramo(reserva)}`}</Texto>
                  <Texto tenue>{detalleReserva(reserva)}</Texto>
                </Tarjeta>
              ))
            )}
            {detalle.movimientos.length > 0 && (
              <>
                <Texto fuerte>Últimos movimientos</Texto>
                {[...detalle.movimientos]
                  .sort((a, b) => b.creadoEn.localeCompare(a.creadoEn))
                  .slice(0, 5)
                  .map((movimiento) => (
                    <Texto key={movimiento.id} tenue>
                      {`${fechaCorta(local(movimiento.creadoEn).fecha)} · ${MOTIVO[movimiento.motivo] ?? movimiento.motivo} · ${sesiones(Math.abs(movimiento.cantidad))} · ${movimiento.fuente}`}
                    </Texto>
                  ))}
              </>
            )}
          </>
        )}
      </Seccion>

      <Hoja
        visible={activando}
        titulo={producto === null ? "Activar producto" : `Activar ${producto.nombre}`}
        alCerrar={() => setActivando(false)}
        ocupado={ocupado}
      >
        {producto === null ? (
          <>
            <Texto tenue>
              Elige lo que ha comprado. Los packs online solo se activan desde aquí.
            </Texto>
            <Grupo etiqueta="Producto" fila={false}>
              {productos.map((p) => (
                <Eleccion
                  key={p.id}
                  ancha
                  texto={p.nombre}
                  detalle={`${TIPO[p.tipo]} · ${euros(p.precioCentimos)}`}
                  elegida={false}
                  onPress={() => setProducto(p)}
                />
              ))}
            </Grupo>
            <Boton texto="Cancelar" tipo="secundario" onPress={() => setActivando(false)} />
          </>
        ) : (
          <>
            <Boton
              texto="Elegir otro"
              tipo="enlace"
              etiqueta="Elegir otro producto"
              deshabilitado={ocupado}
              onPress={() => setProducto(null)}
            />
            <FormularioActivacion
              key={producto.id}
              tipo={producto.tipo}
              precioCentimos={producto.precioCentimos}
              ocupado={ocupado}
              fallo={falloHoja}
              confirmar={(datos) => void activar(producto, datos)}
              cancelar={() => setActivando(false)}
            />
          </>
        )}
      </Hoja>
    </View>
  )
}

const estilos = StyleSheet.create({
  caja: { marginTop: 28 },
})
