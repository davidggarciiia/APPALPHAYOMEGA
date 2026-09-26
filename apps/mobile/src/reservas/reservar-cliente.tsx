import { useCallback, useEffect, useRef, useState } from "react"
import { ScrollView, StyleSheet, View } from "react-native"
import {
  ZONA_AGENDA,
  hoyEnZona,
  type Disponibilidad,
  type Hueco,
  type MisReservas,
  type Producto,
  type ResumenSaldo,
  type Servicio,
  type SolicitudProducto,
} from "@alpha-omega/shared"

import { faltaDe, type Falta } from "../lib/errores"
import { useMovimientoReducido } from "../lib/movimiento"
import type { ApiReservas } from "./api"
import { HuecosDelDia, TiraDeDias, diasConHuecos, primerDiaConHuecos } from "./calendario"
import { codigoDe } from "./errores"
import { ExitoReserva } from "./exito"
import { euros, fechaTitulo, local, personas as textoPersonas, tramo } from "./formato"
import { ReservasDelCliente } from "./mis-reservas"
import {
  Aviso,
  Boton,
  Contador,
  Eleccion,
  Estado,
  Grupo,
  Hoja,
  Seccion,
  Tarjeta,
  Texto,
} from "./piezas"
import { ConsigueSesiones } from "./productos"
import { ResumenDeSaldo, fuenteProbable, precioPorPersona, textoPago } from "./saldo"

/** Días que se enseñan de una vez, desde hoy. Es el máximo que da la API. */
const DIAS_VISTA = 14
/** Lo que dura en pantalla el «¡Reservado!» antes de cerrarse solo. */
const EXITO_MS = 2400

type Datos = {
  saldo: ResumenSaldo
  servicios: Servicio[]
  reservas: MisReservas
  productos: Producto[]
  solicitudes: SolicitudProducto[]
}
type Mensaje = { texto: string; tipo: "error" | "aviso" | "exito" }

/** EP individual si la hay: es lo que reserva casi todo el mundo. */
function servicioPorDefecto(servicios: Servicio[]): Servicio | undefined {
  return servicios.find((s) => s.claseDeSaldo === "ep" && s.maxPersonas <= 1) ?? servicios[0]
}

/** «60 min · gasta 1 sesión» o «60 min · de 2 a 6 personas · desde 10 € por persona». */
function resumenServicio(servicio: Servicio): string {
  const partes = [`${String(servicio.duracionMin)} min`]
  if (servicio.maxPersonas > 1) {
    partes.push(`de ${String(servicio.minPersonas)} a ${String(servicio.maxPersonas)} personas`)
    const precios = servicio.tarifas.map((t) => t.precioPorPersonaCentimos)
    const minimo = precios.length > 0 ? Math.min(...precios) : servicio.precioCentimos
    if (minimo !== null) partes.push(`desde ${euros(minimo)} por persona`)
  } else if (servicio.claseDeSaldo !== null) {
    partes.push("gasta 1 sesión")
  } else if (servicio.precioCentimos !== null) {
    partes.push(euros(servicio.precioCentimos))
  }
  return partes.join(" · ")
}

/**
 * Pestaña «Reservar» del cliente, al estilo Booksy: saldo arriba, servicio,
 * tira de catorce días, huecos del día en Mañana y Tarde, y una hoja para
 * confirmar. Debajo, sus próximas reservas y cómo conseguir más sesiones.
 *
 * El servidor calcula los huecos y decide; la app los enseña y nunca los
 * inventa. Si otro cliente se adelanta, se recargan y se explica.
 */
export function ReservarCliente({
  api,
  ahora = () => new Date(),
}: {
  api: ApiReservas
  /** Reloj inyectable para las pruebas. */
  ahora?: () => Date
}): React.JSX.Element {
  const reducido = useMovimientoReducido()
  const reloj = useRef(ahora)
  reloj.current = ahora
  const desplazable = useRef<ScrollView>(null)
  const posicionProductos = useRef(0)

  const [datos, setDatos] = useState<Datos | null>(null)
  const [cargando, setCargando] = useState(true)
  const [fallo, setFallo] = useState<Falta | null>(null)
  const [intento, setIntento] = useState(0)

  const [servicioId, setServicioId] = useState<string | null>(null)
  const [personasElegidas, setPersonasElegidas] = useState<number | null>(null)
  const [dias, setDias] = useState<Disponibilidad["dias"] | null>(null)
  const [cargandoHuecos, setCargandoHuecos] = useState(false)
  const [falloHuecos, setFalloHuecos] = useState<Falta | null>(null)
  const [recargaHuecos, setRecargaHuecos] = useState(0)
  const [dia, setDia] = useState<string | null>(null)
  const [hueco, setHueco] = useState<Hueco | null>(null)

  const [confirmando, setConfirmando] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [falloEnvio, setFalloEnvio] = useState<Falta | null>(null)
  const [hecha, setHecha] = useState<{ fecha: string; tramo: string } | null>(null)
  const [mensaje, setMensaje] = useState<Mensaje | null>(null)
  const [productosAbiertos, setProductosAbiertos] = useState<boolean | null>(null)

  const cargarDatos = useCallback(async (): Promise<Datos> => {
    const [saldo, servicios, reservas, productos, solicitudes] = await Promise.all([
      api.miSaldo(),
      api.servicios(),
      api.misReservas(),
      api.productos(),
      api.misSolicitudes(),
    ])
    return {
      saldo,
      servicios: servicios.servicios.filter((s) => s.activo && s.reservable),
      reservas,
      productos: productos.productos,
      solicitudes: solicitudes.solicitudes,
    }
  }, [api])

  useEffect(() => {
    let vigente = true
    setCargando(true)
    cargarDatos()
      .then((nuevos) => {
        if (!vigente) return
        setDatos(nuevos)
        setFallo(null)
        setCargando(false)
      })
      .catch((error: unknown) => {
        if (!vigente) return
        setFallo(faltaDe(error, "No hemos podido cargar tus reservas."))
        setCargando(false)
      })
    return () => {
      vigente = false
    }
  }, [cargarDatos, intento])

  /** Vuelve a leer saldo, reservas y solicitudes sin tapar la pantalla. */
  const refrescar = useCallback(async (): Promise<void> => {
    setDatos(await cargarDatos())
  }, [cargarDatos])

  const servicio =
    datos === null
      ? undefined
      : (datos.servicios.find((s) => s.id === servicioId) ?? servicioPorDefecto(datos.servicios))
  const idServicio = servicio?.id ?? null
  const personas =
    servicio === undefined
      ? 1
      : Math.min(
          servicio.maxPersonas,
          Math.max(servicio.minPersonas, personasElegidas ?? servicio.minPersonas),
        )

  useEffect(() => {
    if (idServicio === null) return
    let vigente = true
    setCargandoHuecos(true)
    setFalloHuecos(null)
    api
      .disponibilidad(idServicio, hoyEnZona(ZONA_AGENDA, reloj.current()), DIAS_VISTA)
      .then((disponibilidad) => {
        if (!vigente) return
        const nuevos = disponibilidad.dias
        setDias(nuevos)
        // Se conserva lo elegido mientras siga existiendo.
        setDia((actual) =>
          actual !== null && nuevos.some((d) => d.fecha === actual)
            ? actual
            : primerDiaConHuecos(nuevos),
        )
        setHueco((actual) =>
          actual !== null && nuevos.some((d) => d.huecos.some((h) => h.inicio === actual.inicio))
            ? actual
            : null,
        )
        setCargandoHuecos(false)
      })
      .catch((error: unknown) => {
        if (!vigente) return
        setFalloHuecos(faltaDe(error, "No hemos podido cargar los huecos libres."))
        setCargandoHuecos(false)
      })
    return () => {
      vigente = false
    }
  }, [api, idServicio, recargaHuecos])

  // El «¡Reservado!» se va solo; la reserva ya se ve en «Tus próximas reservas».
  useEffect(() => {
    if (hecha === null) return
    const temporizador = setTimeout(() => {
      setConfirmando(false)
      setHecha(null)
    }, EXITO_MS)
    return () => clearTimeout(temporizador)
  }, [hecha])

  const abiertos = productosAbiertos ?? (datos !== null && datos.saldo.ep.disponibles === 0)

  function irAProductos(): void {
    setProductosAbiertos(true)
    // Tras pintarse la lista abierta, para que la posición ya sea la buena.
    setTimeout(() => {
      desplazable.current?.scrollTo?.({ y: posicionProductos.current, animated: !reducido })
    }, 0)
  }

  function elegirHueco(nuevo: Hueco): void {
    setHueco(nuevo)
    setFalloEnvio(null)
    setHecha(null)
    setMensaje(null)
    setConfirmando(true)
  }

  async function reservar(): Promise<void> {
    if (servicio === undefined || hueco === null) return
    setEnviando(true)
    setFalloEnvio(null)
    try {
      const reserva = await api.reservar({
        servicioId: servicio.id,
        inicio: hueco.inicio,
        personas,
      })
      setHecha({ fecha: local(reserva.inicio).fecha, tramo: tramo(reserva) })
      setHueco(null)
      setRecargaHuecos((n) => n + 1)
      void refrescar().catch(() => undefined)
    } catch (error) {
      const codigo = codigoDe(error)
      if (codigo === "hueco_no_disponible") {
        setConfirmando(false)
        setHueco(null)
        setMensaje({
          tipo: "aviso",
          texto:
            "Ese hueco acaba de ocuparse o ya no se puede reservar. Te enseñamos los que quedan libres.",
        })
        setRecargaHuecos((n) => n + 1)
      } else if (codigo === "sin_saldo") {
        setConfirmando(false)
        setMensaje({
          tipo: "aviso",
          texto: "No te quedan sesiones para esa fecha. Pide un plan o un bono aquí abajo.",
        })
        void refrescar().catch(() => undefined)
        irAProductos()
      } else {
        // Sin conexión o fallo del servidor: la hoja sigue abierta con la misma
        // elección, y reintentar repite la misma operación con el mismo id.
        setFalloEnvio(faltaDe(error, "No hemos podido reservar. Inténtalo de nuevo."))
      }
    } finally {
      setEnviando(false)
    }
  }

  if (datos === null) {
    return (
      <View style={estilos.pantalla}>
        <View style={estilos.contenido}>
          <Estado
            cargando={cargando}
            error={fallo}
            reintentar={() => setIntento((n) => n + 1)}
            etiqueta="Cargando tus reservas"
          />
        </View>
      </View>
    )
  }

  const diaActual = dias?.find((d) => d.fecha === dia) ?? null
  const fuente =
    hueco !== null && servicio?.claseDeSaldo === "ep"
      ? fuenteProbable(datos.saldo, local(hueco.inicio).fecha)
      : null
  const sinSaldoPrevisto = servicio?.claseDeSaldo === "ep" && hueco !== null && fuente === null
  const pago =
    servicio !== undefined && servicio.claseDeSaldo === null ? textoPago(servicio, personas) : null

  return (
    <View style={estilos.pantalla}>
      <ScrollView
        ref={desplazable}
        contentContainerStyle={estilos.contenido}
        keyboardShouldPersistTaps="handled"
      >
        <ResumenDeSaldo saldo={datos.saldo} />

        {mensaje !== null && <Aviso tipo={mensaje.tipo} texto={mensaje.texto} />}

        <Seccion titulo="Reserva tu sesión">
          {datos.servicios.length === 0 ? (
            <Texto tenue>
              Ahora mismo no hay servicios que reservar. Pregunta a tu entrenador.
            </Texto>
          ) : (
            <Grupo etiqueta="Servicio">
              {datos.servicios.map((s) => (
                <Eleccion
                  key={s.id}
                  ancha
                  texto={s.nombre}
                  detalle={resumenServicio(s)}
                  elegida={s.id === servicio?.id}
                  onPress={() => {
                    if (s.id === servicio?.id) return
                    setServicioId(s.id)
                    setPersonasElegidas(null)
                    setHueco(null)
                    setDias(null)
                  }}
                />
              ))}
            </Grupo>
          )}

          {servicio !== undefined && servicio.maxPersonas > 1 && (
            <Tarjeta>
              <Contador
                etiqueta="Personas"
                texto={String(personas)}
                menos={() => setPersonasElegidas(personas - 1)}
                mas={() => setPersonasElegidas(personas + 1)}
                puedeMenos={personas > servicio.minPersonas}
                puedeMas={personas < servicio.maxPersonas}
              />
              {precioPorPersona(servicio, personas) !== null && (
                <Texto tenue>{textoPago(servicio, personas)}</Texto>
              )}
              <Texto tenue>
                No gasta sesiones de tu saldo. Los que vienen contigo no necesitan cuenta.
              </Texto>
            </Tarjeta>
          )}

          {servicio !== undefined && (
            <>
              {dias !== null && (
                <TiraDeDias dias={diasConHuecos(dias)} elegida={dia} elegir={setDia} />
              )}
              <Estado
                cargando={cargandoHuecos && dias === null}
                error={falloHuecos}
                reintentar={() => setRecargaHuecos((n) => n + 1)}
                etiqueta="Cargando huecos libres"
              />
              {diaActual !== null && (
                <>
                  <Texto fuerte>{fechaTitulo(diaActual.fecha)}</Texto>
                  <HuecosDelDia
                    huecos={diaActual.huecos}
                    elegido={hueco?.inicio ?? null}
                    elegir={elegirHueco}
                  />
                </>
              )}
              {dias !== null && dias.every((d) => d.huecos.length === 0) && (
                <Texto tenue>No quedan huecos libres en los próximos catorce días.</Texto>
              )}
            </>
          )}
        </Seccion>

        <ReservasDelCliente
          reservas={datos.reservas}
          api={api}
          ahora={() => reloj.current()}
          alCancelar={(texto) => {
            setMensaje({ tipo: "exito", texto })
            setRecargaHuecos((n) => n + 1)
            void refrescar().catch(() => undefined)
          }}
        />

        <ConsigueSesiones
          productos={datos.productos}
          solicitudes={datos.solicitudes}
          api={api}
          abierto={abiertos}
          alternar={() => setProductosAbiertos(!abiertos)}
          alCambiar={refrescar}
          onLayout={(evento) => {
            posicionProductos.current = evento.nativeEvent.layout.y
          }}
        />
      </ScrollView>

      <Hoja
        visible={confirmando}
        titulo={hecha !== null ? "Reserva hecha" : "Confirma tu reserva"}
        alCerrar={() => {
          setConfirmando(false)
          setHecha(null)
        }}
        ocupado={enviando}
      >
        {hecha !== null ? (
          <>
            <ExitoReserva
              titulo="¡Reservado!"
              detalle={`${fechaTitulo(hecha.fecha)}, ${hecha.tramo}. Te esperamos.`}
            />
            <Boton
              texto="Hecho"
              onPress={() => {
                setConfirmando(false)
                setHecha(null)
              }}
            />
          </>
        ) : servicio !== undefined && hueco !== null ? (
          <>
            <View style={estilos.resumen}>
              <Texto fuerte>{servicio.nombre}</Texto>
              {servicio.maxPersonas > 1 && <Texto>{textoPersonas(personas)}</Texto>}
              <Texto>{fechaTitulo(local(hueco.inicio).fecha)}</Texto>
              <Texto>{`De ${tramo(hueco).replace(" – ", " a ")}`}</Texto>
            </View>
            {servicio.claseDeSaldo === "ep" &&
              (fuente !== null ? (
                <Texto>{`Se descuenta 1 sesión de ${fuente}.`}</Texto>
              ) : (
                <Aviso
                  tipo="aviso"
                  texto="No te quedan sesiones para esa fecha. Pide un plan o un bono y tu entrenador lo activará cuando le pagues."
                />
              ))}
            {pago !== null && <Texto>{pago}</Texto>}
            {falloEnvio !== null && <Aviso texto={falloEnvio.texto} />}
            {sinSaldoPrevisto ? (
              <Boton
                texto="Consigue más sesiones"
                onPress={() => {
                  setConfirmando(false)
                  irAProductos()
                }}
              />
            ) : (
              <Boton
                texto={falloEnvio?.reintentable ? "Reintentar" : "Reservar"}
                etiqueta={falloEnvio?.reintentable ? "Reintentar la reserva" : "Reservar"}
                ocupado={enviando}
                onPress={() => void reservar()}
              />
            )}
            <Boton
              texto="Elegir otra hora"
              tipo="secundario"
              deshabilitado={enviando}
              onPress={() => setConfirmando(false)}
            />
          </>
        ) : null}
      </Hoja>
    </View>
  )
}

const estilos = StyleSheet.create({
  pantalla: { flex: 1 },
  contenido: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 32,
    gap: 28,
    width: "100%",
    maxWidth: 820,
    alignSelf: "center",
  },
  resumen: { gap: 4 },
})
