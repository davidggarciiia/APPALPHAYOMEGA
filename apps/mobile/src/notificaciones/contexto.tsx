import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react"
import { usePathname, useRouter } from "expo-router"
import { AppState, StyleSheet, Text } from "react-native"
import type { ListadoAvisosSeguimiento } from "@alpha-omega/shared"
import { Icono } from "../componentes/iconos"
import { Pulsable } from "../componentes/pulsable"
import { useEntrenamiento } from "../entrenamiento/use-entrenamiento"
import { useValoraciones } from "../seguimiento/use-valoraciones"
import { useSesion } from "../sesion"
import { radio, tema } from "../tema"
import { cargarNotificaciones, contadoresEntrenamiento, type BuzonCliente } from "./cargar"

/** Una carga reciente sirve: volver a la bandeja o a primer plano no repite la cartera entera. */
const VIGENCIA_MS = 20_000
/** Los avisos se marcan en lotes: es lo que admite cada endpoint. */
const LOTE_AVISOS = 50
const LOTE_NOVEDADES = 100

type Buzon = {
  clientes: BuzonCliente[] | null
  cargando: boolean
  error: string
  recargar: () => void
  /** Marca como leído todo lo pendiente que la bandeja tiene cargado. */
  marcarTodoLeido: () => Promise<void>
  marcando: boolean
  errorMarcar: string
  confirmarEntrenamiento: (clienteId: string, novedadId: string) => void
  confirmarSeguimiento: (clienteId: string, listado: ListadoAvisosSeguimiento) => void
}
const Contexto = createContext<Buzon | null>(null)

/** Lo que queda sin leer entre todos los clientes cargados, sin contar las revisiones antiguas. */
export function totalSinLeer(clientes: BuzonCliente[] | null): number {
  return (
    clientes?.reduce(
      (total, cliente) =>
        total +
        contadoresEntrenamiento(cliente.entrenamiento).sinLeer +
        cliente.seguimiento.sinLeer,
      0,
    ) ?? 0
  )
}
export const useNotificaciones = (): Buzon | null => useContext(Contexto)

export function ProveedorNotificaciones({ children }: { children: ReactNode }): React.JSX.Element {
  const { estado, pedir } = useSesion()
  const api = useEntrenamiento()
  const seguimiento = useValoraciones()
  const ruta = usePathname()
  const usuario = estado.fase === "dentro" ? estado.usuario : null
  const [clientes, setClientes] = useState<BuzonCliente[] | null>(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState("")
  const [intento, setIntento] = useState(0)
  const [marcando, setMarcando] = useState(false)
  const [errorMarcar, setErrorMarcar] = useState("")
  const marcandoAhora = useRef(false)
  const ultimaCarga = useRef(0)
  const enCurso = useRef(false)
  const consulta = useRef(0)
  const cargaActual = useRef<AbortController | null>(null)
  const anterior = useRef(ruta)
  const recargar = useCallback(() => setIntento((n) => n + 1), [])
  /** Para los avisos automáticos (volver a la bandeja, a primer plano): no repite una carga reciente ni una en curso. */
  const recargarSiHaceFalta = useCallback(() => {
    if (enCurso.current || Date.now() - ultimaCarga.current < VIGENCIA_MS) return
    recargar()
  }, [recargar])
  useEffect(() => {
    if (!usuario) return
    const propia = ++consulta.current
    const controlador = new AbortController()
    cargaActual.current = controlador
    setCargando(true)
    enCurso.current = true
    void cargarNotificaciones(usuario, pedir, api, seguimiento, controlador.signal)
      .then((buzones) => {
        if (propia !== consulta.current) return
        ultimaCarga.current = Date.now()
        setClientes(buzones)
        setError("")
      })
      .catch(() => {
        if (propia !== consulta.current) return
        ultimaCarga.current = 0
        setClientes(null)
        setError("No se pudieron cargar las notificaciones.")
      })
      .finally(() => {
        if (propia === consulta.current) {
          enCurso.current = false
          setCargando(false)
        }
      })
    return () => {
      consulta.current += 1
      enCurso.current = false
      controlador.abort()
    }
  }, [usuario, pedir, api, seguimiento, intento])
  useEffect(() => {
    if (ruta === "/notificaciones" && anterior.current !== ruta) recargarSiHaceFalta()
    anterior.current = ruta
  }, [ruta, recargarSiHaceFalta])
  useEffect(() => {
    let previa = AppState.currentState
    const escucha = AppState.addEventListener("change", (actual) => {
      if (actual === "active" && previa !== "active") recargarSiHaceFalta()
      previa = actual
    })
    return () => escucha.remove()
  }, [recargarSiHaceFalta])
  const confirmarEntrenamiento = (clienteId: string, novedadId: string): void => {
    consulta.current += 1
    cargaActual.current?.abort()
    enCurso.current = false
    setCargando(false)
    setClientes(
      (actual) =>
        actual?.map((cliente) => {
          if (
            cliente.id !== clienteId ||
            cliente.entrenamiento.novedades.some((n) => n.id === novedadId && n.leidaEn)
          )
            return cliente
          return {
            ...cliente,
            entrenamiento: {
              ...cliente.entrenamiento,
              sinLeer: Math.max(0, cliente.entrenamiento.sinLeer - 1),
              novedades: cliente.entrenamiento.novedades.map((n) =>
                n.id === novedadId ? { ...n, leidaEn: new Date().toISOString() } : n,
              ),
            },
          }
        }) ?? null,
    )
  }
  const confirmarSeguimiento = (clienteId: string, listado: ListadoAvisosSeguimiento): void => {
    consulta.current += 1
    cargaActual.current?.abort()
    enCurso.current = false
    setCargando(false)
    setClientes(
      (actual) =>
        actual?.map((cliente) =>
          cliente.id === clienteId ? { ...cliente, seguimiento: listado } : cliente,
        ) ?? null,
    )
  }
  const marcarTodoLeido = async (): Promise<void> => {
    if (marcandoAhora.current || !clientes) return
    marcandoAhora.current = true
    setMarcando(true)
    setErrorMarcar("")
    try {
      for (const cliente of clientes) {
        const avisoIds = cliente.seguimiento.avisos
          .filter((aviso) => aviso.vigente && aviso.leidoEn === null)
          .map((aviso) => aviso.id)
        for (let i = 0; i < avisoIds.length; i += LOTE_AVISOS)
          await seguimiento.leerAvisos(cliente.id, avisoIds.slice(i, i + LOTE_AVISOS))
        // Las revisiones antiguas no se enseñan ni se cuentan: tampoco se tocan.
        const porSesion = new Map<string, string[]>()
        for (const novedad of cliente.entrenamiento.novedades) {
          if (novedad.tipo === "sesion_revisada" || novedad.leidaEn) continue
          porSesion.set(novedad.sesionId, [...(porSesion.get(novedad.sesionId) ?? []), novedad.id])
        }
        for (const [sesionId, ids] of porSesion)
          for (let i = 0; i < ids.length; i += LOTE_NOVEDADES)
            await api.leerNovedades(sesionId, { novedadIds: ids.slice(i, i + LOTE_NOVEDADES) })
      }
    } catch {
      setErrorMarcar("No se han podido marcar todas como leídas. Inténtalo de nuevo.")
    } finally {
      marcandoAhora.current = false
      setMarcando(false)
      // Con lo que haya salido bien o mal, se vuelve a pedir el estado real al servidor.
      recargar()
    }
  }
  return (
    <Contexto.Provider
      value={{
        clientes,
        cargando,
        error,
        recargar,
        marcarTodoLeido,
        marcando,
        errorMarcar,
        confirmarEntrenamiento,
        confirmarSeguimiento,
      }}
    >
      {children}
    </Contexto.Provider>
  )
}

export function BotonNotificaciones(): React.JSX.Element | null {
  const buzon = useNotificaciones()
  const router = useRouter()
  if (!buzon) return null
  const sinLeer = totalSinLeer(buzon.clientes)
  return (
    <Pulsable
      style={s.boton}
      accessibilityLabel={`Notificaciones${sinLeer > 0 ? `, ${sinLeer} sin leer` : ""}`}
      accessibilityHint={buzon.error || "Abrir notificaciones"}
      onPress={() => router.push("/notificaciones")}
    >
      <Icono nombre="notificaciones" color={tema.texto} />
      {sinLeer > 0 && (
        <Text testID="contador-notificaciones" style={s.numero} aria-hidden>
          {sinLeer > 99 ? "99+" : sinLeer}
        </Text>
      )}
    </Pulsable>
  )
}

const s = StyleSheet.create({
  boton: {
    minWidth: 44,
    minHeight: 44,
    borderRadius: radio.campo,
    alignItems: "center",
    justifyContent: "center",
  },
  numero: {
    position: "absolute",
    right: 0,
    top: 0,
    color: tema.sobreAcento,
    backgroundColor: tema.acento,
    borderRadius: radio.pastilla,
    paddingHorizontal: 4,
    fontFamily: tema.fuenteSemi,
    fontSize: 11,
    lineHeight: 18,
    minWidth: 18,
    textAlign: "center",
    fontVariant: ["tabular-nums"],
  },
})
