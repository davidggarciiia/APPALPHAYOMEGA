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
import { AppState, StyleSheet, Text, View } from "react-native"
import type { ListadoAvisosSeguimiento } from "@alpha-omega/shared"
import { Icono } from "../componentes/iconos"
import { Pulsable } from "../componentes/pulsable"
import { useEntrenamiento } from "../entrenamiento/use-entrenamiento"
import { useValoraciones } from "../seguimiento/use-valoraciones"
import { useSesion } from "../sesion"
import { radio, tema } from "../tema"
import { cargarNotificaciones, type BuzonCliente } from "./cargar"

type Buzon = {
  clientes: BuzonCliente[] | null
  cargando: boolean
  error: string
  recargar: () => void
  confirmarEntrenamiento: (clienteId: string, novedadId: string) => void
  confirmarSeguimiento: (clienteId: string, listado: ListadoAvisosSeguimiento) => void
}
const Contexto = createContext<Buzon | null>(null)
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
  const consulta = useRef(0)
  const cargaActual = useRef<AbortController | null>(null)
  const anterior = useRef(ruta)
  const recargar = useCallback(() => setIntento((n) => n + 1), [])
  useEffect(() => {
    if (!usuario) return
    const propia = ++consulta.current
    const controlador = new AbortController()
    cargaActual.current = controlador
    setCargando(true)
    void cargarNotificaciones(usuario, pedir, api, seguimiento, controlador.signal)
      .then((buzones) => {
        if (propia !== consulta.current) return
        setClientes(buzones)
        setError("")
      })
      .catch(() => {
        if (propia !== consulta.current) return
        setClientes(null)
        setError("No se pudieron cargar las notificaciones.")
      })
      .finally(() => {
        if (propia === consulta.current) setCargando(false)
      })
    return () => {
      consulta.current += 1
      controlador.abort()
    }
  }, [usuario, pedir, api, seguimiento, intento])
  useEffect(() => {
    if (ruta === "/notificaciones" && anterior.current !== ruta) recargar()
    anterior.current = ruta
  }, [ruta, recargar])
  useEffect(() => {
    let previa = AppState.currentState
    const escucha = AppState.addEventListener("change", (actual) => {
      if (actual === "active" && previa !== "active") recargar()
      previa = actual
    })
    return () => escucha.remove()
  }, [recargar])
  const confirmarEntrenamiento = (clienteId: string, novedadId: string): void => {
    consulta.current += 1
    cargaActual.current?.abort()
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
    setCargando(false)
    setClientes(
      (actual) =>
        actual?.map((cliente) =>
          cliente.id === clienteId ? { ...cliente, seguimiento: listado } : cliente,
        ) ?? null,
    )
  }
  return (
    <Contexto.Provider
      value={{ clientes, cargando, error, recargar, confirmarEntrenamiento, confirmarSeguimiento }}
    >
      {children}
    </Contexto.Provider>
  )
}

export function BotonNotificaciones(): React.JSX.Element | null {
  const buzon = useNotificaciones()
  const router = useRouter()
  if (!buzon) return null
  const sinLeer =
    buzon.clientes?.reduce(
      (total, cliente) => total + cliente.entrenamiento.sinLeer + cliente.seguimiento.sinLeer,
      0,
    ) ?? 0
  return (
    <Pulsable
      style={s.boton}
      accessibilityLabel={`Notificaciones${sinLeer > 0 ? `, ${sinLeer} sin leer` : ""}`}
      accessibilityHint={buzon.error || "Abrir notificaciones"}
      onPress={() => router.push("/notificaciones")}
    >
      <Icono nombre="notificaciones" color={tema.texto} />
      {sinLeer > 0 && <View testID="punto-notificaciones" style={s.punto} aria-hidden />}
      {sinLeer > 0 && sinLeer < 100 && (
        <Text style={s.numero} aria-hidden>
          {sinLeer}
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
  punto: {
    position: "absolute",
    top: 5,
    right: 5,
    width: 8,
    height: 8,
    borderRadius: 2,
    backgroundColor: tema.acento,
  },
  numero: {
    position: "absolute",
    right: 0,
    bottom: 0,
    color: tema.acento,
    backgroundColor: tema.fondo,
    fontFamily: tema.fuenteSemi,
    fontSize: 11,
    minWidth: 14,
    textAlign: "center",
    fontVariant: ["tabular-nums"],
  },
})
