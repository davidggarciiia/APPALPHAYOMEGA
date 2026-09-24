import { useCallback, useRef, useState } from "react"
import { useFocusEffect } from "expo-router"
import { Pressable, StyleSheet, Text, View } from "react-native"
import type { SolicitudFotos, VistaFoto } from "@alpha-omega/shared"

import { AvisoDeError, BotonPrincipal, BotonSecundario, Campo } from "../componentes/formulario"
import { fechaLegible } from "../entrenamiento/fechas"
import { Fila, Tarjeta, Titulo } from "../entrenamiento/plan/piezas"
import { faltaDe } from "../lib/errores"
import { tema } from "../tema"
import type { ApiMedios } from "./medios-api"

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

/** Formulario del entrenador para pedir fotos concretas. */
function PedirFotos({
  pedir,
  ocupado,
}: {
  pedir: (vistas: VistaPedible[], fechaLimite: string | null, mensaje: string | null) => void
  ocupado: boolean
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
              accessibilityLabel={v.texto}
              accessibilityState={{ checked: elegida, disabled: ocupado }}
              disabled={ocupado}
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
        editable={!ocupado}
        maxLength={10}
        onChangeText={setFecha}
      />
      <Campo
        etiqueta="Indicación para el cliente (opcional)"
        value={mensaje}
        editable={!ocupado}
        maxLength={200}
        onChangeText={setMensaje}
      />
      {error !== "" && <AvisoDeError mensaje={error} />}
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
}: {
  clienteId: string
  api: Pick<ApiMedios, "solicitudes" | "pedirFotos" | "revisarSolicitud" | "vincularFoto">
  modo: "cliente" | "entrenador"
  nuevoId: () => string
  /** Visita con borrador abierto a la que se pueden incorporar fotos recibidas. */
  valoracionAbiertaId?: string | null
}): React.JSX.Element {
  const [solicitudes, setSolicitudes] = useState<SolicitudFotos[] | null>(null)
  const [pidiendo, setPidiendo] = useState(false)
  const [error, setError] = useState("")
  const [ocupado, setOcupado] = useState(false)
  const [intento, setIntento] = useState(0)
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
          if (vigente) {
            setSolicitudes(lista)
            setError("")
          }
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

  const visibles =
    modo === "cliente"
      ? (solicitudes ?? []).filter((x) => x.estado === "pendiente")
      : (solicitudes ?? [])

  return (
    <View style={s.grupo}>
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
              <Text style={s.estado}>{NOMBRE_DE_ESTADO[solicitud.estado]}</Text>
            </Fila>
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
            pedir={(vistas, fechaLimite, mensaje) =>
              void accion(
                "pedir",
                async () => {
                  await api.pedirFotos(clienteId, {
                    operacionId: operacion("pedir"),
                    vistas,
                    fechaLimite,
                    mensaje,
                  })
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

const s = StyleSheet.create({
  grupo: { gap: 12 },
  textos: { flex: 1, gap: 4 },
  texto: { color: tema.texto, fontFamily: tema.fuenteTexto, fontSize: 15 },
  fuerte: { color: tema.texto, fontFamily: tema.fuenteBoton, fontSize: 15 },
  tenue: { color: tema.textoTenue, fontFamily: tema.fuenteTexto, fontSize: 13, lineHeight: 18 },
  estado: { color: tema.textoSecundario, fontFamily: tema.fuenteSemi, fontSize: 13 },
  enlace: { color: tema.acento, fontFamily: tema.fuenteBoton, fontSize: 14 },
  accion: { minHeight: 44, justifyContent: "center" },
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
