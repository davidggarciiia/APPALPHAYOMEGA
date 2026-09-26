import { useCallback, useEffect, useState } from "react"
import { StyleSheet, Text, View, useWindowDimensions } from "react-native"
import {
  ZONA_AGENDA,
  hoyEnZona,
  lunesDeFecha,
  sumarDiasFecha,
  type Hueco,
  type Reserva,
  type ResumenUsuario,
  type Servicio,
} from "@alpha-omega/shared"

import { Pulsable } from "../componentes/pulsable"
import { faltaDe, type Falta } from "../lib/errores"
import { tema } from "../tema"
import type { ApiReservas } from "./api"
import { TiraDeDias } from "./calendario"
import { SelectorHueco } from "./elegir-hueco"
import { codigoDe } from "./errores"
import {
  diaCorto,
  euros,
  fechaCorta,
  fechaLarga,
  fechaTitulo,
  horaDe,
  local,
  momento,
  nombreDe,
  numeroDia,
  personas as textoPersonas,
  tramo,
} from "./formato"
import {
  Aviso,
  Boton,
  CampoTexto,
  Contador,
  Eleccion,
  Estado,
  Grupo,
  Hoja,
  Tarjeta,
  Texto,
} from "./piezas"

/** Desde este ancho la semana se ve en columnas. */
const ANCHO_ESCRITORIO = 1024

type Mensaje = { texto: string; tipo: "error" | "aviso" | "exito" }
type Accion = { tipo: "cancelar" | "devolver" | "mover" | "ver"; reserva: Reserva }

/** Se puede devolver a mano una cancelada sin devolución o una ya pasada, una sola vez. */
export function sePuedeDevolver(reserva: Reserva, ahora: Date): boolean {
  if (reserva.fuenteSaldo === null || reserva.devueltaAMano) return false
  if (reserva.estado === "cancelada") return reserva.cancelacion?.sesionDevuelta === false
  return Date.parse(reserva.inicio) <= ahora.getTime()
}

/** Estado de la reserva para la agenda, en palabras. */
export function estadoParaEntrenador(reserva: Reserva, ahora: Date): string {
  if (reserva.estado === "cancelada") {
    const quien = reserva.cancelacion?.porEntrenador ? "por ti" : "por el cliente"
    if (reserva.fuenteSaldo === null) return `Cancelada ${quien}`
    const devuelta = reserva.cancelacion?.sesionDevuelta || reserva.devueltaAMano
    return `Cancelada ${quien} · sesión ${devuelta ? "devuelta" : "no devuelta"}`
  }
  if (Date.parse(reserva.inicio) <= ahora.getTime()) {
    return reserva.devueltaAMano ? "Pasada · sesión devuelta a mano" : "Pasada"
  }
  return "Confirmada"
}

/** «EP individual · 1 persona · Plan de octubre» o «… · Cobro 50 €». */
function detalle(reserva: Reserva): string {
  const partes = [reserva.servicio.nombre, textoPersonas(reserva.personas)]
  if (reserva.fuenteSaldo !== null) partes.push(reserva.fuenteSaldo)
  if (reserva.cobroCentimos !== null) partes.push(`Cobro ${euros(reserva.cobroCentimos)}`)
  return partes.join(" · ")
}

/**
 * La agenda del entrenador: una semana con selector de día y las reservas de
 * cada día en orden, con cancelar, devolver la sesión, mover y reservar para un
 * cliente. En escritorio la semana entera en columnas.
 */
export function AgendaSemana({
  api,
  ahora,
}: {
  api: ApiReservas
  ahora: () => Date
}): React.JSX.Element {
  const hoy = hoyEnZona(ZONA_AGENDA, ahora())
  const { width } = useWindowDimensions()
  const escritorio = width >= ANCHO_ESCRITORIO
  const [lunes, setLunes] = useState(lunesDeFecha(hoy))
  const [dia, setDia] = useState(hoy)
  const [reservas, setReservas] = useState<Reserva[] | null>(null)
  const [fallo, setFallo] = useState<Falta | null>(null)
  const [recarga, setRecarga] = useState(0)
  const [mensaje, setMensaje] = useState<Mensaje | null>(null)
  const [accion, setAccion] = useState<Accion | null>(null)
  const [nueva, setNueva] = useState(false)

  const domingo = sumarDiasFecha(lunes, 6)
  useEffect(() => {
    let vigente = true
    setFallo(null)
    api
      .reservas(lunes, domingo)
      .then((listado) => {
        if (vigente) setReservas(listado.reservas)
      })
      .catch((error: unknown) => {
        if (vigente) setFallo(faltaDe(error, "No hemos podido cargar tu agenda."))
      })
    return () => {
      vigente = false
    }
  }, [api, lunes, domingo, recarga])

  const recargar = useCallback(() => setRecarga((n) => n + 1), [])
  const cambiarSemana = (semanas: number): void => {
    const nuevo = sumarDiasFecha(lunes, semanas * 7)
    setLunes(nuevo)
    setDia(nuevo === lunesDeFecha(hoy) ? hoy : nuevo)
    setReservas(null)
  }
  const terminar = (texto: string): void => {
    setAccion(null)
    setMensaje({ tipo: "exito", texto })
    recargar()
  }

  const semana = Array.from({ length: 7 }, (_, i) => sumarDiasFecha(lunes, i))
  const delDia = (fecha: string): Reserva[] =>
    (reservas ?? [])
      .filter((r) => local(r.inicio).fecha === fecha)
      .sort((a, b) => a.inicio.localeCompare(b.inicio))
  const confirmadas = (fecha: string): number =>
    delDia(fecha).filter((r) => r.estado === "confirmada").length

  return (
    <View style={estilos.caja}>
      <View style={estilos.cabecera}>
        <Pulsable
          onPress={() => cambiarSemana(-1)}
          accessibilityRole="button"
          accessibilityLabel="Semana anterior"
          style={estilos.flecha}
        >
          <Text style={estilos.textoFlecha}>‹</Text>
        </Pulsable>
        <Text style={estilos.semana} accessibilityRole="header">
          {`Semana del ${fechaCorta(lunes)} al ${fechaCorta(domingo)}`}
        </Text>
        <Pulsable
          onPress={() => cambiarSemana(1)}
          accessibilityRole="button"
          accessibilityLabel="Semana siguiente"
          style={estilos.flecha}
        >
          <Text style={estilos.textoFlecha}>›</Text>
        </Pulsable>
      </View>
      <View style={estilos.acciones}>
        {lunes !== lunesDeFecha(hoy) && (
          <Boton
            texto="Hoy"
            tipo="secundario"
            etiqueta="Volver a hoy"
            onPress={() => {
              setLunes(lunesDeFecha(hoy))
              setDia(hoy)
              setReservas(null)
            }}
          />
        )}
        <Boton texto="Nueva reserva" onPress={() => setNueva(true)} />
      </View>

      {mensaje !== null && <Aviso tipo={mensaje.tipo} texto={mensaje.texto} />}
      <Estado
        cargando={reservas === null && fallo === null}
        error={fallo}
        reintentar={recargar}
        etiqueta="Cargando tu agenda"
      />

      {reservas !== null &&
        (escritorio ? (
          <View style={estilos.columnas}>
            {semana.map((fecha) => (
              <View key={fecha} style={estilos.columna}>
                <Text
                  style={[estilos.cabeceraColumna, fecha === hoy && estilos.hoy]}
                  accessibilityRole="header"
                >
                  {`${diaCorto(fecha)} ${numeroDia(fecha)}`}
                </Text>
                {delDia(fecha).length === 0 ? (
                  <Text style={estilos.vacioColumna}>Libre</Text>
                ) : (
                  delDia(fecha).map((reserva) => (
                    <Pulsable
                      key={reserva.id}
                      onPress={() => setAccion({ tipo: "ver", reserva })}
                      accessibilityRole="button"
                      accessibilityLabel={`${horaDe(reserva.inicio)}, ${nombreDe(reserva.cliente)}, ${reserva.servicio.nombre}, ${estadoParaEntrenador(reserva, ahora())}`}
                      style={[
                        estilos.bloque,
                        reserva.estado === "cancelada" && estilos.bloqueCancelado,
                      ]}
                    >
                      <Text style={estilos.horaBloque}>{horaDe(reserva.inicio)}</Text>
                      <Text style={estilos.textoBloque} numberOfLines={2}>
                        {nombreDe(reserva.cliente)}
                      </Text>
                      <Text style={estilos.detalleBloque} numberOfLines={1}>
                        {reserva.servicio.nombre}
                      </Text>
                    </Pulsable>
                  ))
                )}
              </View>
            ))}
          </View>
        ) : (
          <>
            <TiraDeDias
              dias={semana.map((fecha) => ({ fecha, cuenta: confirmadas(fecha) }))}
              elegida={dia}
              elegir={setDia}
              describir={(n) =>
                n === 0 ? "sin reservas" : `${String(n)} ${n === 1 ? "reserva" : "reservas"}`
              }
            />
            <Texto fuerte>{fechaTitulo(dia)}</Texto>
            {delDia(dia).length === 0 ? (
              <Texto tenue>No hay reservas este día.</Texto>
            ) : (
              delDia(dia).map((reserva) => (
                <TarjetaReserva
                  key={reserva.id}
                  reserva={reserva}
                  ahora={ahora()}
                  elegir={(tipo) => setAccion({ tipo, reserva })}
                />
              ))
            )}
          </>
        ))}

      <Hoja visible={accion?.tipo === "ver"} titulo="Reserva" alCerrar={() => setAccion(null)}>
        {accion?.tipo === "ver" && (
          <>
            <TarjetaReserva
              reserva={accion.reserva}
              ahora={ahora()}
              elegir={(tipo) => setAccion({ tipo, reserva: accion.reserva })}
            />
            <Boton texto="Cerrar" tipo="secundario" onPress={() => setAccion(null)} />
          </>
        )}
      </Hoja>
      {accion?.tipo === "cancelar" && (
        <HojaCancelar
          api={api}
          reserva={accion.reserva}
          cerrar={() => setAccion(null)}
          hecho={terminar}
        />
      )}
      {accion?.tipo === "devolver" && (
        <HojaDevolver
          api={api}
          reserva={accion.reserva}
          cerrar={() => setAccion(null)}
          hecho={terminar}
        />
      )}
      {accion?.tipo === "mover" && (
        <HojaMover
          api={api}
          reserva={accion.reserva}
          desde={hoy}
          cerrar={() => setAccion(null)}
          hecho={terminar}
          obsoleta={() => {
            setAccion(null)
            setMensaje({
              tipo: "aviso",
              texto:
                "Esa reserva cambió mientras tanto. Hemos recargado la agenda: vuelve a intentarlo.",
            })
            recargar()
          }}
        />
      )}
      {nueva && (
        <HojaNuevaReserva
          api={api}
          desde={dia >= hoy ? dia : hoy}
          cerrar={() => setNueva(false)}
          hecho={(texto) => {
            setNueva(false)
            setMensaje({ tipo: "exito", texto })
            recargar()
          }}
        />
      )}
    </View>
  )
}

/** Una reserva con su estado y las acciones que tiene. */
function TarjetaReserva({
  reserva,
  ahora,
  elegir,
}: {
  reserva: Reserva
  ahora: Date
  elegir: (tipo: "cancelar" | "devolver" | "mover") => void
}): React.JSX.Element {
  const cliente = nombreDe(reserva.cliente)
  const futura = reserva.estado === "confirmada" && Date.parse(reserva.inicio) > ahora.getTime()
  const a = `de ${cliente} del ${momento(reserva.inicio)}`
  return (
    <Tarjeta apagada={reserva.estado === "cancelada"}>
      <View style={estilos.fila}>
        <Texto fuerte>{tramo(reserva)}</Texto>
        <Texto tenue>{estadoParaEntrenador(reserva, ahora)}</Texto>
      </View>
      <Texto fuerte>{cliente}</Texto>
      <Texto tenue>{detalle(reserva)}</Texto>
      {reserva.cancelacion?.motivo ? (
        <Texto tenue>{`Motivo: ${reserva.cancelacion.motivo}`}</Texto>
      ) : null}
      <View style={estilos.acciones}>
        {futura && (
          <>
            <Boton
              texto="Mover"
              tipo="secundario"
              etiqueta={`Mover la reserva ${a}`}
              onPress={() => elegir("mover")}
            />
            <Boton
              texto="Cancelar"
              tipo="peligro"
              etiqueta={`Cancelar la reserva ${a}`}
              onPress={() => elegir("cancelar")}
            />
          </>
        )}
        {sePuedeDevolver(reserva, ahora) && (
          <Boton
            texto="Devolver sesión"
            tipo="secundario"
            etiqueta={`Devolver la sesión de la reserva ${a}`}
            onPress={() => elegir("devolver")}
          />
        )}
      </View>
    </Tarjeta>
  )
}

type PropsHoja = {
  api: ApiReservas
  reserva: Reserva
  cerrar: () => void
  hecho: (texto: string) => void
}

function HojaCancelar({ api, reserva, cerrar, hecho }: PropsHoja): React.JSX.Element {
  const [motivo, setMotivo] = useState("")
  const [ocupado, setOcupado] = useState(false)
  const [fallo, setFallo] = useState<string | null>(null)
  const cliente = nombreDe(reserva.cliente)
  return (
    <Hoja
      visible
      titulo={`¿Cancelar la reserva de ${cliente}?`}
      alCerrar={cerrar}
      ocupado={ocupado}
    >
      <Texto>{`${fechaTitulo(local(reserva.inicio).fecha)}, ${tramo(reserva)}. ${reserva.servicio.nombre}.`}</Texto>
      <Texto tenue>
        {reserva.cobroCentimos !== null
          ? "Se anula su cobro pendiente."
          : "Cuando cancelas tú, la sesión se le devuelve siempre."}
      </Texto>
      <CampoTexto
        etiqueta="Motivo (opcional)"
        value={motivo}
        onChangeText={setMotivo}
        maxLength={200}
        editable={!ocupado}
      />
      {fallo !== null && <Aviso texto={fallo} />}
      <Boton
        texto="Cancelar reserva"
        tipo="peligro"
        ocupado={ocupado}
        onPress={() => {
          setOcupado(true)
          setFallo(null)
          const texto = motivo.trim()
          api
            .cancelar(reserva.id, texto === "" ? {} : { motivo: texto })
            .then(() => hecho(`Reserva de ${cliente} cancelada.`))
            .catch((error: unknown) => {
              setFallo(faltaDe(error, "No hemos podido cancelar la reserva.").texto)
              setOcupado(false)
            })
        }}
      />
      <Boton texto="Mantenerla" tipo="secundario" deshabilitado={ocupado} onPress={cerrar} />
    </Hoja>
  )
}

function HojaDevolver({ api, reserva, cerrar, hecho }: PropsHoja): React.JSX.Element {
  const [ocupado, setOcupado] = useState(false)
  const [fallo, setFallo] = useState<string | null>(null)
  const cliente = nombreDe(reserva.cliente)
  return (
    <Hoja visible titulo={`¿Devolver la sesión a ${cliente}?`} alCerrar={cerrar} ocupado={ocupado}>
      <Texto>{`${fechaTitulo(local(reserva.inicio).fecha)}, ${tramo(reserva)}. ${reserva.fuenteSaldo ?? ""}`}</Texto>
      <Texto tenue>Vuelve a su saldo. Solo se puede devolver una vez por reserva.</Texto>
      {fallo !== null && <Aviso texto={fallo} />}
      <Boton
        texto="Devolver sesión"
        ocupado={ocupado}
        onPress={() => {
          setOcupado(true)
          setFallo(null)
          api
            .devolver(reserva.id)
            .then(() => hecho(`Sesión devuelta a ${cliente}.`))
            .catch((error: unknown) => {
              setFallo(
                codigoDe(error) === "estado_incompatible"
                  ? "Esta sesión ya se había devuelto."
                  : faltaDe(error, "No hemos podido devolver la sesión.").texto,
              )
              setOcupado(false)
            })
        }}
      />
      <Boton texto="Cancelar" tipo="secundario" deshabilitado={ocupado} onPress={cerrar} />
    </Hoja>
  )
}

function HojaMover({
  api,
  reserva,
  desde,
  cerrar,
  hecho,
  obsoleta,
}: PropsHoja & { desde: string; obsoleta: () => void }): React.JSX.Element {
  const [hueco, setHueco] = useState<Hueco | null>(null)
  const [recarga, setRecarga] = useState(0)
  const [ocupado, setOcupado] = useState(false)
  const [fallo, setFallo] = useState<string | null>(null)
  const cliente = nombreDe(reserva.cliente)
  const elegir = useCallback((nuevo: Hueco | null) => setHueco(nuevo), [])
  return (
    <Hoja visible titulo={`Mover la reserva de ${cliente}`} alCerrar={cerrar} ocupado={ocupado}>
      <Texto tenue>{`Ahora: ${fechaLarga(local(reserva.inicio).fecha)}, ${tramo(reserva)}.`}</Texto>
      <SelectorHueco
        api={api}
        servicioId={reserva.servicio.id}
        desde={desde}
        elegido={hueco}
        elegir={elegir}
        recarga={recarga}
      />
      {fallo !== null && <Aviso texto={fallo} />}
      <Boton
        texto={hueco === null ? "Elige un hueco" : `Mover al ${momento(hueco.inicio)}`}
        deshabilitado={hueco === null}
        ocupado={ocupado}
        onPress={() => {
          if (hueco === null) return
          setOcupado(true)
          setFallo(null)
          api
            .mover(reserva.id, { inicio: hueco.inicio, revision: reserva.revision })
            .then((movida) => hecho(`Reserva de ${cliente} movida al ${momento(movida.inicio)}.`))
            .catch((error: unknown) => {
              setOcupado(false)
              const codigo = codigoDe(error)
              if (codigo === "revision_obsoleta") return obsoleta()
              if (codigo === "hueco_no_disponible") {
                setFallo("Ese hueco se acaba de ocupar. Elige otro.")
                setRecarga((n) => n + 1)
              } else if (codigo === "sin_saldo") {
                setFallo(`${cliente} no tiene sesiones en ese mes. No se ha movido.`)
              } else {
                setFallo(faltaDe(error, "No hemos podido mover la reserva.").texto)
              }
            })
        }}
      />
      <Boton texto="Cancelar" tipo="secundario" deshabilitado={ocupado} onPress={cerrar} />
    </Hoja>
  )
}

/** Reservar para un cliente de la cartera: cliente, servicio, personas y hueco. */
function HojaNuevaReserva({
  api,
  desde,
  cerrar,
  hecho,
}: {
  api: ApiReservas
  desde: string
  cerrar: () => void
  hecho: (texto: string) => void
}): React.JSX.Element {
  const [buscar, setBuscar] = useState("")
  const [clientes, setClientes] = useState<ResumenUsuario[] | null>(null)
  const [cliente, setCliente] = useState<ResumenUsuario | null>(null)
  const [servicios, setServicios] = useState<Servicio[] | null>(null)
  const [servicio, setServicio] = useState<Servicio | null>(null)
  const [personas, setPersonas] = useState(1)
  const [hueco, setHueco] = useState<Hueco | null>(null)
  const [recarga, setRecarga] = useState(0)
  const [ocupado, setOcupado] = useState(false)
  const [fallo, setFallo] = useState<string | null>(null)
  const elegir = useCallback((nuevo: Hueco | null) => setHueco(nuevo), [])

  useEffect(() => {
    let vigente = true
    const reloj = setTimeout(() => {
      api
        .clientes(buscar)
        .then((lista) => {
          if (vigente) setClientes(lista)
        })
        .catch((error: unknown) => {
          if (vigente) setFallo(faltaDe(error, "No hemos podido cargar tus clientes.").texto)
        })
    }, 250)
    return () => {
      vigente = false
      clearTimeout(reloj)
    }
  }, [api, buscar])

  useEffect(() => {
    let vigente = true
    api
      .servicios()
      .then(({ servicios: lista }) => {
        if (!vigente) return
        const activos = lista.filter((s) => s.activo && s.claseDeSaldo !== "boxeo")
        setServicios(activos)
        const porDefecto = activos.find((s) => s.maxPersonas <= 1) ?? activos[0] ?? null
        setServicio(porDefecto)
        setPersonas(porDefecto?.minPersonas ?? 1)
      })
      .catch((error: unknown) => {
        if (vigente) setFallo(faltaDe(error, "No hemos podido cargar los servicios.").texto)
      })
    return () => {
      vigente = false
    }
  }, [api])

  const nombre = cliente === null ? "" : nombreDe(cliente)
  return (
    <Hoja visible titulo="Nueva reserva" alCerrar={cerrar} ocupado={ocupado}>
      {cliente === null ? (
        <>
          <CampoTexto
            etiqueta="Buscar cliente"
            value={buscar}
            onChangeText={setBuscar}
            placeholder="Nombre, apellidos o correo"
            autoCorrect={false}
            autoCapitalize="none"
          />
          {clientes === null ? (
            <Estado cargando error={null} reintentar={() => undefined} etiqueta="Buscando" />
          ) : clientes.length === 0 ? (
            <Texto tenue>Nadie de tu cartera coincide.</Texto>
          ) : (
            <Grupo etiqueta="Cliente" fila={false}>
              {clientes.slice(0, 20).map((c) => (
                <Eleccion
                  key={c.id}
                  ancha
                  texto={nombreDe(c)}
                  detalle={c.email}
                  elegida={false}
                  onPress={() => setCliente(c)}
                />
              ))}
            </Grupo>
          )}
        </>
      ) : (
        <>
          <View style={estilos.fila}>
            <Texto fuerte>{nombre}</Texto>
            <Boton
              texto="Cambiar"
              tipo="enlace"
              etiqueta="Cambiar de cliente"
              deshabilitado={ocupado}
              onPress={() => {
                setCliente(null)
                setHueco(null)
              }}
            />
          </View>
          {servicios !== null && servicios.length > 1 && (
            <Grupo etiqueta="Servicio">
              {servicios.map((s) => (
                <Eleccion
                  key={s.id}
                  texto={s.nombre}
                  elegida={s.id === servicio?.id}
                  onPress={() => {
                    setServicio(s)
                    setPersonas(s.minPersonas)
                    setHueco(null)
                  }}
                />
              ))}
            </Grupo>
          )}
          {servicio !== null && servicio.maxPersonas > 1 && (
            <Contador
              etiqueta="Personas"
              texto={String(personas)}
              menos={() => setPersonas((n) => n - 1)}
              mas={() => setPersonas((n) => n + 1)}
              puedeMenos={personas > servicio.minPersonas}
              puedeMas={personas < servicio.maxPersonas}
            />
          )}
          {servicio !== null && (
            <SelectorHueco
              api={api}
              servicioId={servicio.id}
              desde={desde}
              elegido={hueco}
              elegir={elegir}
              recarga={recarga}
            />
          )}
        </>
      )}
      {fallo !== null && <Aviso texto={fallo} />}
      {cliente !== null && servicio !== null && (
        <Boton
          texto={hueco === null ? "Elige un hueco" : `Reservar para ${nombre}`}
          deshabilitado={hueco === null}
          ocupado={ocupado}
          onPress={() => {
            if (hueco === null) return
            setOcupado(true)
            setFallo(null)
            api
              .reservarPara(cliente.id, { servicioId: servicio.id, inicio: hueco.inicio, personas })
              .then((hecha) => hecho(`Reserva para ${nombre} el ${momento(hecha.inicio)}.`))
              .catch((error: unknown) => {
                setOcupado(false)
                const codigo = codigoDe(error)
                if (codigo === "sin_saldo") {
                  setFallo(
                    `${nombre} no tiene sesiones para esa fecha. Actívale un plan o un bono desde su ficha.`,
                  )
                } else if (codigo === "hueco_no_disponible") {
                  setFallo("Ese hueco se acaba de ocupar. Elige otro.")
                  setRecarga((n) => n + 1)
                } else {
                  setFallo(faltaDe(error, "No hemos podido hacer la reserva.").texto)
                }
              })
          }}
        />
      )}
      <Boton texto="Cancelar" tipo="secundario" deshabilitado={ocupado} onPress={cerrar} />
    </Hoja>
  )
}

const estilos = StyleSheet.create({
  caja: { gap: 16 },
  cabecera: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  flecha: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: tema.superficie,
    alignItems: "center",
    justifyContent: "center",
  },
  textoFlecha: { color: tema.texto, fontFamily: tema.fuenteBoton, fontSize: 24, lineHeight: 28 },
  semana: {
    flex: 1,
    color: tema.texto,
    fontFamily: tema.fuenteBoton,
    fontSize: 16,
    textAlign: "center",
  },
  acciones: { flexDirection: "row", flexWrap: "wrap", gap: 8, justifyContent: "flex-end" },
  fila: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
  },
  columnas: { flexDirection: "row", gap: 6 },
  columna: { flex: 1, minWidth: 0, gap: 6 },
  cabeceraColumna: {
    color: tema.textoTenue,
    fontFamily: tema.fuenteSemi,
    fontSize: 13,
    textAlign: "center",
    paddingVertical: 6,
  },
  hoy: { color: tema.acento, fontFamily: tema.fuenteBoton },
  vacioColumna: {
    color: tema.textoTenue,
    fontFamily: tema.fuenteTexto,
    fontSize: 12,
    textAlign: "center",
  },
  bloque: {
    minHeight: 44,
    borderRadius: 10,
    backgroundColor: tema.superficieAlta,
    borderLeftWidth: 3,
    borderLeftColor: tema.acento,
    padding: 8,
    gap: 2,
  },
  bloqueCancelado: { opacity: 0.55, borderLeftColor: tema.bordeFuerte },
  horaBloque: { color: tema.acento, fontFamily: tema.fuenteBoton, fontSize: 13 },
  textoBloque: { color: tema.texto, fontFamily: tema.fuenteSemi, fontSize: 13 },
  detalleBloque: { color: tema.textoTenue, fontFamily: tema.fuenteTexto, fontSize: 11 },
})
