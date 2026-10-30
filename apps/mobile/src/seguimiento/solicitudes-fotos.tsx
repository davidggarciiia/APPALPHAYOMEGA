import { useCallback, useEffect, useRef, useState } from "react"
import { useFocusEffect } from "expo-router"
import { Pressable, StyleSheet, Text, View } from "react-native"
import type { CrearSolicitudFotos, MedioFoto, SolicitudFotos, VistaFoto } from "@alpha-omega/shared"

import { AvisoDeError, BotonPrincipal, BotonSecundario, Campo } from "../componentes/formulario"
import { useSalidaProtegida } from "../componentes/salida-protegida"
import { fechaLegible, hoyAgenda } from "../entrenamiento/fechas"
import { Fila, Tarjeta, Titulo } from "../entrenamiento/plan/piezas"
import { faltaDe } from "../lib/errores"
import { ErrorDePeticion, ErrorDePermiso } from "../lib/http"
import { tema } from "../tema"
import type { ApiMedios } from "./medios-api"
import { liberarFoto, obtenerFoto, type FotoPreparada, type OrigenFoto } from "./preparar-foto"

type VistaPedible = Exclude<VistaFoto, "otra">
const VISTAS: Array<{ valor: VistaPedible; texto: string }> = [
  { valor: "frente", texto: "Frente" },
  { valor: "espalda", texto: "Espalda" },
  { valor: "perfilIzquierdo", texto: "Perfil izquierdo" },
  { valor: "perfilDerecho", texto: "Perfil derecho" },
]
const NOMBRE_DE_VISTA: Record<VistaFoto, string> = {
  frente: "Frente",
  espalda: "Espalda",
  perfilIzquierdo: "Perfil izquierdo",
  perfilDerecho: "Perfil derecho",
  otra: "Otra",
}
const NOMBRE_DE_ESTADO: Record<SolicitudFotos["estado"], string> = {
  pendiente: "Pendiente",
  recibida: "Recibida, sin revisar",
  revisada: "Revisada",
}

type FotoPendiente = {
  solicitudId: string
  vista: VistaPedible
  fechaToma: string
  operacionId: string
  foto: FotoPreparada
  fase: "subiendo" | "confirmando" | "fallo"
}

const enviadaPara = (solicitud: SolicitudFotos, vista: VistaPedible): boolean =>
  solicitud.medios.some((medio) => medio.vista === vista && medio.estado === "disponible")

const NO_SE_ENVIO =
  "No se pudo enviar la foto. La conservamos mientras sigas en esta pantalla: reintenta el envío o descártala para elegir otra."

/**
 * Por qué una foto que no se pudo enviar ya no admite reintento según la lista
 * del servidor, o `null` si su solicitud todavía la espera.
 */
function motivoSinReintento(pendiente: FotoPendiente, lista: SolicitudFotos[]): string | null {
  const vista = NOMBRE_DE_VISTA[pendiente.vista]
  const destino = lista.find((solicitud) => solicitud.id === pendiente.solicitudId)
  if (destino && enviadaPara(destino, pendiente.vista))
    return `La foto de ${vista} ya consta como enviada; no hace falta reintentarla.`
  if (!destino)
    return `Esa solicitud ya no está pendiente; la foto de ${vista} sin enviar se ha descartado.`
  if (destino.estado === "revisada")
    return `Tu entrenador ya revisó esa solicitud; la foto de ${vista} sin enviar se ha descartado.`
  return null
}

/**
 * Suelta la copia local de una foto. Si el móvil no deja borrarla, queda
 * anotada para volver a intentarlo al salir de la pantalla.
 */
function soltarCopia(uri: string, porLiberar: Set<string>): void {
  if (liberarFoto(uri) === "fallo") porLiberar.add(uri)
  else porLiberar.delete(uri)
}

/** Formulario del entrenador para pedir fotos concretas. */
function PedirFotos({
  pedir,
  ocupado,
  pendiente,
}: {
  pedir: (vistas: VistaPedible[], fechaLimite: string | null, mensaje: string | null) => void
  ocupado: boolean
  pendiente: boolean
}): React.JSX.Element {
  const [vistas, setVistas] = useState<VistaPedible[]>(["frente"])
  const [fecha, setFecha] = useState("")
  const [mensaje, setMensaje] = useState("")
  const [error, setError] = useState("")
  const enviar = (): void => {
    if (vistas.length === 0) return setError("Elige al menos una vista.")
    const limite = fecha.trim()
    if (limite !== "" && (!/^\d{4}-\d{2}-\d{2}$/.test(limite) || Number.isNaN(Date.parse(limite))))
      return setError("Escribe la fecha límite como AAAA-MM-DD o déjala vacía.")
    setError("")
    pedir(vistas, limite === "" ? null : limite, mensaje.trim() === "" ? null : mensaje.trim())
  }
  return (
    <View style={s.grupo}>
      <View style={s.chips}>
        {VISTAS.map((v) => {
          const elegida = vistas.includes(v.valor)
          return (
            <Pressable
              key={v.valor}
              accessibilityRole="checkbox"
              aria-checked={elegida}
              accessibilityLabel={v.texto}
              accessibilityState={{ checked: elegida, disabled: ocupado || pendiente }}
              disabled={ocupado || pendiente}
              onPress={() =>
                setVistas(elegida ? vistas.filter((x) => x !== v.valor) : [...vistas, v.valor])
              }
              style={[s.chip, elegida && s.chipElegido]}
            >
              <Text style={s.textoChip}>{v.texto}</Text>
            </Pressable>
          )
        })}
      </View>
      <Campo
        etiqueta="Fecha límite (AAAA-MM-DD, opcional)"
        value={fecha}
        editable={!ocupado && !pendiente}
        maxLength={10}
        onChangeText={setFecha}
      />
      <Campo
        etiqueta="Indicación para el cliente (opcional)"
        value={mensaje}
        editable={!ocupado && !pendiente}
        maxLength={200}
        onChangeText={setMensaje}
      />
      {error !== "" && <AvisoDeError mensaje={error} />}
      {pendiente && (
        <Text style={s.tenue}>
          Reintenta para confirmar esta solicitud antes de pedir otras fotos.
        </Text>
      )}
      <BotonPrincipal
        texto={ocupado ? "Enviando…" : "Pedir fotos"}
        ocupado={ocupado}
        onPress={enviar}
      />
    </View>
  )
}

/**
 * Solicitudes de fotos. El entrenador pide vistas, ve lo recibido, lo incorpora a
 * la visita en curso sin volver a subirlo y marca la solicitud revisada. El
 * cliente consulta lo que se le pide; recibir no equivale a revisar.
 */
export function SolicitudesFotos({
  clienteId,
  api,
  modo,
  nuevoId,
  valoracionAbiertaId = null,
  ocultarSinPendientes = false,
}: {
  clienteId: string
  api: Pick<
    ApiMedios,
    | "solicitudes"
    | "pedirFotos"
    | "revisarSolicitud"
    | "vincularFoto"
    | "solicitarSubida"
    | "confirmar"
  >
  modo: "cliente" | "entrenador"
  nuevoId: () => string
  /** Visita con borrador abierto a la que se pueden incorporar fotos recibidas. */
  valoracionAbiertaId?: string | null
  /** Cliente: sin solicitudes por atender (ni cargando, ni error, ni foto en curso), no pinta nada. */
  ocultarSinPendientes?: boolean
}): React.JSX.Element | null {
  const [solicitudes, setSolicitudes] = useState<SolicitudFotos[] | null>(null)
  const [pidiendo, setPidiendo] = useState(false)
  const [solicitudPendiente, setSolicitudPendiente] = useState<CrearSolicitudFotos | null>(null)
  const solicitudPendienteRef = useRef<CrearSolicitudFotos | null>(null)
  const [error, setError] = useState("")
  const [ocupado, setOcupado] = useState(false)
  const [intento, setIntento] = useState(0)
  const [fotoEnPreparacion, setFotoEnPreparacion] = useState<string | null>(null)
  // Foto elegida que el servidor aún no ha confirmado. Su copia solo está en
  // el dispositivo: se conserva para reintentar con la misma operación y se
  // suelta al confirmarse, al descartarla o al salir (RI07b).
  const [fotoPendiente, setFotoPendiente] = useState<FotoPendiente | null>(null)
  const fotoPendienteRef = useRef<FotoPendiente | null>(null)
  // Cambiar de pestaña o volver atrás desmonta Progreso y aborta la subida: se pregunta
  // antes, porque la foto solo existe en el móvil hasta que el servidor la confirma.
  const { proteccion } = useSalidaProtegida(fotoPendiente !== null, TEXTOS_FOTO)
  const montado = useRef(true)
  // Síncrono: dos toques antes de repintar no arrancan dos envíos de la misma copia.
  const enviandoFoto = useRef(false)
  const subidaActiva = useRef<AbortController | null>(null)
  const porLiberar = useRef(new Set<string>())
  // Última lista leída del servidor: dice si una foto que falló aún se puede reintentar.
  const listaServidor = useRef<SolicitudFotos[] | null>(null)
  const guardarFotoPendiente = (pendiente: FotoPendiente | null): void => {
    fotoPendienteRef.current = pendiente
    if (montado.current) setFotoPendiente(pendiente)
  }
  /**
   * Una foto en fallo cuya solicitud ya no la admite (revisada, desaparecida o
   * con esa vista ya recibida) no tiene botones para reintentarla ni
   * descartarla: se suelta su copia para no bloquear las demás vistas y se
   * devuelve el motivo para explicarlo. Solo usa refs y el setter del estado.
   */
  const soltarSiNoSeReintenta = (lista: SolicitudFotos[]): string | null => {
    const pendiente = fotoPendienteRef.current
    if (pendiente?.fase !== "fallo") return null
    const motivo = motivoSinReintento(pendiente, lista)
    if (motivo) {
      guardarFotoPendiente(null)
      soltarCopia(pendiente.foto.uri, porLiberar.current)
    }
    return motivo
  }
  useEffect(() => {
    montado.current = true
    const copias = porLiberar.current
    return () => {
      montado.current = false
      subidaActiva.current?.abort()
      for (const uri of [...copias]) soltarCopia(uri, copias)
      // Un envío en curso usa su copia y la suelta al terminar; aquí solo se
      // suelta la que esperaba un reintento que ya nadie puede pedir.
      const pendiente = fotoPendienteRef.current
      if (pendiente?.fase === "fallo") {
        fotoPendienteRef.current = null
        soltarCopia(pendiente.foto.uri, copias)
      }
    }
  }, [])
  // Una operación por acción: un reintento tras una respuesta perdida no duplica.
  const operaciones = useRef(new Map<string, string>())
  const operacion = (clave: string): string => {
    const actual = operaciones.current.get(clave) ?? nuevoId()
    operaciones.current.set(clave, actual)
    return actual
  }

  useFocusEffect(
    useCallback(() => {
      let vigente = true
      api
        .solicitudes(clienteId)
        .then(({ solicitudes: lista }) => {
          if (!vigente) return
          listaServidor.current = lista
          setSolicitudes(lista)
          const motivo = soltarSiNoSeReintenta(lista)
          // Una foto que sigue esperando reintento conserva su explicación.
          setError(motivo ?? (fotoPendienteRef.current?.fase === "fallo" ? NO_SE_ENVIO : ""))
        })
        .catch((fallo: unknown) => {
          if (vigente)
            setError(faltaDe(fallo, "No se pudieron cargar las solicitudes de fotos.").texto)
        })
      return () => {
        vigente = false
      }
    }, [api, clienteId, intento]),
  )

  const accion = async (
    clave: string,
    hacer: () => Promise<void>,
    respaldo: string,
  ): Promise<void> => {
    if (ocupado) return
    setOcupado(true)
    setError("")
    try {
      await hacer()
      operaciones.current.delete(clave)
      setIntento((n) => n + 1)
    } catch (fallo) {
      setError(faltaDe(fallo, respaldo).texto)
    } finally {
      setOcupado(false)
    }
  }

  /** Solo la confirmación del servidor da la foto por recibida. */
  const transmitirFoto = async (pendiente: FotoPendiente): Promise<void> => {
    guardarFotoPendiente({ ...pendiente, fase: "subiendo" })
    if (montado.current) setError("")
    let confirmada: MedioFoto
    const cancelacion = new AbortController()
    subidaActiva.current = cancelacion
    const limite = setTimeout(() => cancelacion.abort(), 30_000)
    try {
      const intencion = await api.solicitarSubida({
        operacionId: pendiente.operacionId,
        clienteId,
        destino: { tipo: "solicitud", solicitudId: pendiente.solicitudId },
        vista: pendiente.vista,
        etiqueta: null,
        fechaToma: pendiente.fechaToma,
        tipoMime: pendiente.foto.tipoMime,
        bytes: pendiente.foto.bytes,
      })
      if (cancelacion.signal.aborted) throw new Error("Subida cancelada")
      if (intencion.subida) {
        const archivo = await (
          await fetch(pendiente.foto.uri, { signal: cancelacion.signal })
        ).blob()
        try {
          const subida = await fetch(intencion.subida.url, {
            method: intencion.subida.metodo,
            headers: intencion.subida.cabeceras,
            body: archivo,
            signal: cancelacion.signal,
          })
          if (!subida.ok) throw new Error("No se pudo subir el archivo")
        } finally {
          ;(archivo as Blob & { close?: () => void }).close?.()
        }
      }
      if (cancelacion.signal.aborted) throw new Error("Subida cancelada")
      guardarFotoPendiente({ ...pendiente, fase: "confirmando" })
      confirmada = await api.confirmar(intencion.medio.id)
    } catch {
      if (montado.current) {
        guardarFotoPendiente({ ...pendiente, fase: "fallo" })
        // Si una relectura durante el envío ya cerró su solicitud, no espera reintento.
        const lista = listaServidor.current
        const motivo = lista ? soltarSiNoSeReintenta(lista) : null
        setError(motivo ?? NO_SE_ENVIO)
      } else {
        // Sin la pantalla nadie puede reintentar: la copia ya no sirve.
        guardarFotoPendiente(null)
        soltarCopia(pendiente.foto.uri, porLiberar.current)
      }
      return
    } finally {
      clearTimeout(limite)
      if (subidaActiva.current === cancelacion) subidaActiva.current = null
    }
    // El servidor ya tiene la foto: la copia local sobra.
    guardarFotoPendiente(null)
    soltarCopia(pendiente.foto.uri, porLiberar.current)
    if (!montado.current) return
    setSolicitudes((actuales) =>
      actuales === null
        ? null
        : actuales.map((solicitud) =>
            solicitud.id !== pendiente.solicitudId
              ? solicitud
              : {
                  ...solicitud,
                  estado: "recibida",
                  recibidaEn: solicitud.recibidaEn ?? new Date().toISOString(),
                  medios: [
                    ...solicitud.medios.filter((medio) => medio.id !== confirmada.id),
                    confirmada,
                  ],
                },
          ),
    )
  }

  const aportar = async (
    solicitud: SolicitudFotos,
    vista: VistaPedible,
    origen: OrigenFoto,
  ): Promise<void> => {
    if (ocupado || enviandoFoto.current || fotoPendienteRef.current) return
    enviandoFoto.current = true
    const clave = `${solicitud.id}:${vista}`
    setOcupado(true)
    setFotoEnPreparacion(clave)
    setError("")
    try {
      const obtenida = await obtenerFoto(origen)
      if (obtenida.tipo !== "lista") {
        if (obtenida.tipo !== "cancelada" && montado.current) setError(obtenida.mensaje)
        return
      }
      if (!montado.current) {
        // Preparada después de salir: no se envía ni se queda en el dispositivo.
        soltarCopia(obtenida.foto.uri, porLiberar.current)
        return
      }
      const pendiente: FotoPendiente = {
        solicitudId: solicitud.id,
        vista,
        fechaToma: hoyAgenda(),
        operacionId: nuevoId(),
        foto: obtenida.foto,
        fase: "subiendo",
      }
      guardarFotoPendiente(pendiente)
      await transmitirFoto(pendiente)
    } catch {
      if (montado.current)
        setError("No se pudo preparar la foto. Elige otra o inténtalo con la cámara.")
    } finally {
      enviandoFoto.current = false
      if (montado.current) {
        setOcupado(false)
        setFotoEnPreparacion(null)
      }
    }
  }

  /** Mismo contenido, misma operación: el reintento no crea otra foto. */
  const reintentarFoto = async (): Promise<void> => {
    const pendiente = fotoPendienteRef.current
    if (pendiente?.fase !== "fallo" || enviandoFoto.current) return
    enviandoFoto.current = true
    setOcupado(true)
    try {
      await transmitirFoto(pendiente)
    } finally {
      enviandoFoto.current = false
      if (montado.current) setOcupado(false)
    }
  }

  /**
   * Descarta la foto que no se pudo enviar y relee las solicitudes por si el
   * envío llegó a confirmarse y solo se perdió la respuesta.
   */
  const descartarFoto = (): void => {
    const pendiente = fotoPendienteRef.current
    if (pendiente?.fase !== "fallo" || enviandoFoto.current) return
    guardarFotoPendiente(null)
    soltarCopia(pendiente.foto.uri, porLiberar.current)
    setError("")
    setIntento((n) => n + 1)
  }

  const visibles =
    modo === "cliente"
      ? (solicitudes ?? []).filter((x) => x.estado !== "revisada")
      : (solicitudes ?? [])

  if (
    ocultarSinPendientes &&
    modo === "cliente" &&
    error === "" &&
    !ocupado &&
    fotoPendiente === null &&
    visibles.length === 0
  )
    return null

  return (
    <View style={s.grupo}>
      {proteccion}
      <Titulo>
        {modo === "cliente" ? "Fotos que te pide tu entrenador" : "Fotos del cliente"}
      </Titulo>
      {error !== "" && <AvisoDeError mensaje={error} />}
      {solicitudes === null ? (
        error === "" && <Text style={s.tenue}>Cargando solicitudes…</Text>
      ) : visibles.length === 0 ? (
        <Text style={s.tenue}>
          {modo === "cliente"
            ? "No tienes fotos pendientes de enviar."
            : "Aún no has pedido fotos."}
        </Text>
      ) : (
        visibles.map((solicitud) => (
          <Tarjeta key={solicitud.id}>
            <Fila primera>
              <View style={s.textos}>
                <Text style={s.fuerte}>
                  {solicitud.vistas.map((v) => NOMBRE_DE_VISTA[v]).join(" · ")}
                </Text>
                <Text style={s.tenue}>
                  Pedidas el {fechaLegible(solicitud.creadaEn.slice(0, 10))}
                  {solicitud.fechaLimite
                    ? ` · antes del ${fechaLegible(solicitud.fechaLimite)}`
                    : ""}
                </Text>
                {solicitud.mensaje && <Text style={s.texto}>{solicitud.mensaje}</Text>}
              </View>
              <Text style={s.estado}>
                {modo === "cliente" && solicitud.estado === "recibida"
                  ? (() => {
                      const faltan = solicitud.vistas.filter(
                        (v) => !enviadaPara(solicitud, v),
                      ).length
                      return faltan > 0
                        ? `Recibida · faltan ${faltan} ${faltan === 1 ? "vista" : "vistas"}`
                        : NOMBRE_DE_ESTADO.recibida
                    })()
                  : NOMBRE_DE_ESTADO[solicitud.estado]}
              </Text>
            </Fila>
            {modo === "cliente" && (
              <View style={s.grupo}>
                {solicitud.vistas.map((vista) => {
                  const medio = solicitud.medios.find(
                    (foto) => foto.vista === vista && foto.estado === "disponible",
                  )
                  const clave = `${solicitud.id}:${vista}`
                  const pendiente =
                    fotoPendiente?.solicitudId === solicitud.id && fotoPendiente.vista === vista
                      ? fotoPendiente
                      : null
                  return (
                    <View key={vista} style={s.vistaSolicitada}>
                      <Text style={s.texto}>
                        {NOMBRE_DE_VISTA[vista]} ·{" "}
                        {medio ? `enviada el ${fechaLegible(medio.fechaToma)}` : "pendiente"}
                      </Text>
                      {pendiente?.fase === "fallo" ? (
                        <View style={s.accionesFoto}>
                          <BotonSecundario
                            texto="Reintentar envío"
                            etiquetaAccesible={`Reintentar envío de la foto de ${NOMBRE_DE_VISTA[vista]}`}
                            ocupado={ocupado}
                            onPress={() => void reintentarFoto()}
                          />
                          <BotonSecundario
                            texto="Descartar foto"
                            etiquetaAccesible={`Descartar la foto de ${NOMBRE_DE_VISTA[vista]} sin enviarla`}
                            deshabilitado={ocupado}
                            onPress={descartarFoto}
                          />
                        </View>
                      ) : pendiente ? (
                        <Text style={s.estado}>
                          {pendiente.fase === "confirmando"
                            ? "Confirmando foto…"
                            : "Subiendo foto…"}
                        </Text>
                      ) : !medio && solicitud.estado !== "revisada" ? (
                        <View style={s.accionesFoto}>
                          <BotonSecundario
                            texto={fotoEnPreparacion === clave ? "Abriendo cámara…" : "Hacer foto"}
                            etiquetaAccesible={`Hacer foto de ${NOMBRE_DE_VISTA[vista]} con la cámara`}
                            ocupado={ocupado}
                            deshabilitado={fotoPendiente !== null}
                            onPress={() => void aportar(solicitud, vista, "camara")}
                          />
                          <BotonSecundario
                            texto={
                              fotoEnPreparacion === clave
                                ? "Abriendo galería…"
                                : "Elegir de galería"
                            }
                            etiquetaAccesible={`Elegir foto de ${NOMBRE_DE_VISTA[vista]} desde la galería`}
                            ocupado={ocupado}
                            deshabilitado={fotoPendiente !== null}
                            onPress={() => void aportar(solicitud, vista, "galeria")}
                          />
                        </View>
                      ) : null}
                    </View>
                  )
                })}
              </View>
            )}
            {modo === "entrenador" &&
              solicitud.medios.map((medio) => (
                <Fila key={medio.id}>
                  <Text style={[s.texto, s.textos]}>
                    {NOMBRE_DE_VISTA[medio.vista]} · {fechaLegible(medio.fechaToma)}
                    {medio.estado !== "disponible" ? " · retirada" : ""}
                    {medio.valoracionId ? " · en una visita" : ""}
                  </Text>
                  {valoracionAbiertaId && medio.estado === "disponible" && !medio.valoracionId && (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Incorporar ${NOMBRE_DE_VISTA[medio.vista]} a la visita en curso`}
                      disabled={ocupado}
                      onPress={() =>
                        void accion(
                          `vincular:${medio.id}`,
                          async () => {
                            await api.vincularFoto(clienteId, valoracionAbiertaId, medio.id)
                          },
                          "No se pudo incorporar la foto.",
                        )
                      }
                      style={s.accion}
                    >
                      <Text style={s.enlace}>Incorporar</Text>
                    </Pressable>
                  )}
                </Fila>
              ))}
            {modo === "entrenador" && solicitud.estado === "recibida" && (
              <BotonSecundario
                texto="Marcar como revisada"
                onPress={() =>
                  void accion(
                    `revisar:${solicitud.id}`,
                    async () => {
                      await api.revisarSolicitud(
                        clienteId,
                        solicitud.id,
                        operacion(`revisar:${solicitud.id}`),
                      )
                    },
                    "No se pudo marcar como revisada.",
                  )
                }
              />
            )}
          </Tarjeta>
        ))
      )}
      {modo === "entrenador" &&
        (pidiendo ? (
          <PedirFotos
            ocupado={ocupado}
            pendiente={solicitudPendiente !== null}
            pedir={(vistas, fechaLimite, mensaje) =>
              void accion(
                "pedir",
                async () => {
                  const datos = solicitudPendienteRef.current ?? {
                    operacionId: operacion("pedir"),
                    vistas: [...vistas],
                    fechaLimite,
                    mensaje,
                  }
                  solicitudPendienteRef.current = datos
                  setSolicitudPendiente(datos)
                  try {
                    await api.pedirFotos(clienteId, datos)
                  } catch (fallo) {
                    if (
                      (fallo instanceof ErrorDePeticion && fallo.detalle.statusCode === 400) ||
                      fallo instanceof ErrorDePermiso
                    ) {
                      solicitudPendienteRef.current = null
                      setSolicitudPendiente(null)
                      operaciones.current.delete("pedir")
                    }
                    throw fallo
                  }
                  solicitudPendienteRef.current = null
                  setSolicitudPendiente(null)
                  setPidiendo(false)
                },
                "No se pudo enviar la solicitud. Vuelve a intentarlo: no se duplicará.",
              )
            }
          />
        ) : (
          <BotonSecundario texto="Pedir fotos al cliente" onPress={() => setPidiendo(true)} />
        ))}
    </View>
  )
}

const TEXTOS_FOTO = {
  titulo: "¿Salir sin enviar la foto?",
  texto:
    "Tu foto todavía no se ha enviado. Si sales ahora se perderá y tendrás que hacerla otra vez.",
  confirmar: "Salir y perder la foto",
  cancelar: "Quedarme",
}

const s = StyleSheet.create({
  grupo: { gap: 12 },
  textos: { flex: 1, gap: 4 },
  texto: { color: tema.texto, fontFamily: tema.fuenteTexto, fontSize: 15 },
  fuerte: { color: tema.texto, fontFamily: tema.fuenteBoton, fontSize: 15 },
  tenue: { color: tema.textoTenue, fontFamily: tema.fuenteTexto, fontSize: 13, lineHeight: 18 },
  estado: { color: tema.textoSecundario, fontFamily: tema.fuenteSemi, fontSize: 13 },
  enlace: { color: tema.acento, fontFamily: tema.fuenteBoton, fontSize: 14 },
  accion: { minHeight: 44, justifyContent: "center" },
  vistaSolicitada: { gap: 8 },
  accionesFoto: { gap: 8 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    minHeight: 44,
    paddingHorizontal: 14,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: tema.bordeFuerte,
    justifyContent: "center",
  },
  chipElegido: { borderColor: tema.acento, backgroundColor: tema.acentoSuave },
  textoChip: { color: tema.texto, fontFamily: tema.fuenteTexto, fontSize: 14 },
})
