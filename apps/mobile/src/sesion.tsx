import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  Fragment,
  type ReactNode,
} from "react"
import { Modal, Platform, Text, View } from "react-native"
import type { Credenciales, Sesion, UsuarioPublico } from "@alpha-omega/shared"
import { borrarTokenRefresco, guardarTokenRefresco, leerTokenRefresco } from "./lib/almacen-seguro"
import {
  ErrorDeRed,
  ErrorDeSesion,
  cerrarSesionEnServidor,
  iniciarSesion as pedirSesion,
  refrescarSesion,
} from "./lib/api"
import {
  borrarIdentidadLocal,
  guardarIdentidadLocal,
  leerIdentidadLocal,
  leerCuentaLocal,
  marcarLimpieza,
  leerLimpieza,
  terminarLimpieza,
  type IdentidadLocal,
} from "./lib/sesion-local"
import { crearPeticionAutenticada, type PeticionAutenticada } from "./lib/peticion-autenticada"
import {
  borrarCuentaWeb,
  CLAVE_CUENTA_WEB,
  conCredencialesExclusivas,
  guardarCuentaWeb,
  leerCuentaWeb,
} from "./lib/coordinador-sesion-web"
import { almacenDispositivo } from "./entrenamiento/almacen-dispositivo"
import { hayCambiosLocales } from "./entrenamiento/documento-local"
import { BotonPrincipal, BotonSecundario } from "./componentes/formulario"
import { tema } from "./tema"

export type EstadoSesion =
  | { fase: "comprobando" }
  | { fase: "fuera" }
  | { fase: "local"; usuario: IdentidadLocal }
  | { fase: "dentro"; usuario: UsuarioPublico; tokenAcceso: string }
type Contexto = {
  estado: EstadoSesion
  sesionCaducada: boolean
  sinConexion: boolean
  entrar: (credenciales: Credenciales) => Promise<void>
  salir: () => Promise<void>
  reintentar: () => void
  pedir: PeticionAutenticada
}
const ContextoSesion = createContext<Contexto | null>(null)

export function ProveedorDeSesion({ children }: { children: ReactNode }): React.JSX.Element {
  const [estado, setEstado] = useState<EstadoSesion>({ fase: "comprobando" })
  const actual = useRef<EstadoSesion>(estado)
  const epoca = useRef(0)
  const refresco = useRef<string | null>(null)
  const renovacion = useRef<{ epoca: number; promesa: Promise<string> } | null>(null)
  const colaCredenciales = useRef<Promise<unknown>>(Promise.resolve())
  const [sesionCaducada, setSesionCaducada] = useState(false)
  const [sinConexion, setSinConexion] = useState(false)
  const [intento, setIntento] = useState(0)
  const [confirmandoSalida, setConfirmandoSalida] = useState(false)
  const [avisoSalida, setAvisoSalida] = useState("")
  const cambiando = useRef(false)
  const cuentaPorLimpiar = useRef<string | null>(null)
  const actualizar = useCallback((nuevo: EstadoSesion): void => {
    actual.current = nuevo
    setEstado(nuevo)
  }, [])
  const enCola = useCallback((accion: () => Promise<void>): Promise<void> => {
    const siguiente = colaCredenciales.current.then(accion)
    colaCredenciales.current = siguiente.catch(() => undefined)
    return siguiente
  }, [])

  const limpiarAcceso = useCallback(async (): Promise<void> => {
    cambiando.current = true
    const cuenta = cuentaPorLimpiar.current
    try {
      await marcarLimpieza(cuenta)
    } catch {
      setAvisoSalida("No se pudo guardar el cierre de sesión. Reintenta la limpieza.")
      return
    }
    const resultados = await Promise.allSettled([
      enCola(async () => {
        await Promise.all([borrarIdentidadLocal(), borrarTokenRefresco()])
        borrarCuentaWeb()
      }),
      cuenta ? almacenDispositivo.limpiar(cuenta) : Promise.resolve(),
    ])
    let fallo = resultados.some((r) => r.status === "rejected")
    if (!fallo) {
      try {
        await terminarLimpieza()
      } catch {
        fallo = true
      }
    }
    cambiando.current = fallo
    setAvisoSalida(
      fallo ? "No se pudo completar la limpieza local. Reintenta antes de usar otra cuenta." : "",
    )
    if (!fallo) cuentaPorLimpiar.current = null
  }, [enCola])

  const revocar = useCallback(async (): Promise<void> => {
    const version = epoca.current
    const anterior = actual.current
    const cuenta =
      "usuario" in anterior ? anterior.usuario.id : await leerCuentaLocal().catch(() => null)
    if (version !== epoca.current) return
    epoca.current++
    refresco.current = null
    cuentaPorLimpiar.current = cuenta
    actualizar({ fase: "fuera" })
    setSesionCaducada(true)
    setSinConexion(false)
    await limpiarAcceso()
  }, [actualizar, limpiarAcceso])

  const asentar = useCallback(
    async (sesion: Sesion, version: number): Promise<string> => {
      await enCola(async () => {
        if (version !== epoca.current) throw new ErrorDeSesion("La sesión ha cambiado")
        // Persistir la credencial rotada antes de utilizar el acceso nuevo.
        await guardarTokenRefresco(sesion.tokenRefresco)
        await guardarIdentidadLocal(sesion.usuario, sesion.tokenRefresco)
        guardarCuentaWeb(sesion.usuario.id)
      })
      if (version !== epoca.current) throw new ErrorDeSesion("La sesión ha cambiado")
      const anterior = actual.current
      if (!("usuario" in anterior) || anterior.usuario.id !== sesion.usuario.id)
        almacenDispositivo.habilitar(sesion.usuario.id)
      refresco.current = sesion.tokenRefresco
      setSesionCaducada(false)
      setSinConexion(false)
      actualizar({ fase: "dentro", usuario: sesion.usuario, tokenAcceso: sesion.tokenAcceso })
      return sesion.tokenAcceso
    },
    [actualizar, enCola],
  )

  const renovar = useCallback((): Promise<string> => {
    const version = epoca.current
    if (renovacion.current?.epoca === version) return renovacion.current.promesa
    const promesa = conCredencialesExclusivas(async () => {
      let teniaCredencial = false
      try {
        const token =
          Platform.OS === "web"
            ? await leerTokenRefresco()
            : (refresco.current ?? (await leerTokenRefresco()))
        if (version !== epoca.current) throw new ErrorDeSesion("La sesión ha cambiado")
        if (!token) throw new ErrorDeSesion("Sin sesión guardada")
        refresco.current = token
        teniaCredencial = true
        return await asentar(await refrescarSesion(token), version)
      } catch (error) {
        if (version === epoca.current) {
          if (error instanceof ErrorDeSesion && teniaCredencial) await revocar()
          else if (error instanceof ErrorDeSesion) {
            actualizar({ fase: "fuera" })
            setSesionCaducada(false)
          } else setSinConexion(true)
        }
        throw error
      }
    }).finally(() => {
      if (renovacion.current?.promesa === promesa) renovacion.current = null
    })
    renovacion.current = { epoca: version, promesa }
    return promesa
  }, [asentar, revocar, actualizar])

  useEffect(() => {
    if (Platform.OS !== "web" || typeof globalThis.addEventListener !== "function") return
    const recibir = (evento: StorageEvent): void => {
      if (evento.key !== CLAVE_CUENTA_WEB) return
      const vigente = actual.current
      if (!("usuario" in vigente) || evento.newValue === vigente.usuario.id) return
      epoca.current++
      refresco.current = null
      renovacion.current = null
      actualizar({ fase: "fuera" })
      setSesionCaducada(false)
      setSinConexion(false)
    }
    globalThis.addEventListener("storage", recibir)
    const quitar = globalThis.removeEventListener?.bind(globalThis)
    return () => quitar?.("storage", recibir)
  }, [actualizar])

  useEffect(() => {
    let vigente = true
    const version = epoca.current
    void (async () => {
      const pendiente = await leerLimpieza()
      if (!vigente || version !== epoca.current) return
      if (pendiente) {
        cuentaPorLimpiar.current = pendiente.cuenta
        actualizar({ fase: "fuera" })
        await limpiarAcceso()
        return
      }
      await renovar()
    })().catch(async (error: unknown) => {
      if (!vigente || version !== epoca.current) return
      if (error instanceof ErrorDeRed) {
        const token = await leerTokenRefresco()
        const identidad = token ? await leerIdentidadLocal(token).catch(() => null) : null
        if (!vigente || version !== epoca.current) return
        if (identidad) {
          almacenDispositivo.habilitar(identidad.id)
          actualizar({ fase: "local", usuario: identidad })
          return
        }
      }
      actualizar({ fase: "fuera" })
    })
    return () => {
      vigente = false
    }
  }, [intento, renovar, actualizar, limpiarAcceso])

  const entrar = useCallback(
    async (credenciales: Credenciales): Promise<void> => {
      if (cambiando.current) throw new Error("Espera a que termine la limpieza local.")
      const version = ++epoca.current
      await conCredencialesExclusivas(async () => {
        if (version !== epoca.current) throw new ErrorDeSesion("La sesión ha cambiado")
        const sesion = await pedirSesion(credenciales)
        await asentar(sesion, version)
      })
    },
    [asentar],
  )

  const salirDefinitivamente = useCallback(async (): Promise<void> => {
    if (cambiando.current) return
    cambiando.current = true
    try {
      await conCredencialesExclusivas(async () => {
        const anterior = actual.current
        const cuenta = "usuario" in anterior ? anterior.usuario.id : null
        const compartida = leerCuentaWeb()
        if (compartida !== null && compartida !== cuenta) {
          epoca.current++
          refresco.current = null
          setConfirmandoSalida(false)
          setSesionCaducada(false)
          setSinConexion(false)
          actualizar({ fase: "fuera" })
          cambiando.current = false
          return
        }
        const token = Platform.OS === "web" ? await leerTokenRefresco() : refresco.current
        cuentaPorLimpiar.current = cuenta
        await marcarLimpieza(cuenta)
        epoca.current++
        refresco.current = null
        setConfirmandoSalida(false)
        setSesionCaducada(false)
        setSinConexion(false)
        actualizar({ fase: "fuera" })
        await Promise.all([
          limpiarAcceso(),
          token ? cerrarSesionEnServidor(token).catch(() => undefined) : Promise.resolve(),
        ])
      })
    } catch {
      cambiando.current = false
      setAvisoSalida("No se pudo iniciar el cierre. Vuelve a pulsar Cerrar sesión.")
    }
  }, [actualizar, limpiarAcceso])

  const salir = useCallback(async (): Promise<void> => {
    const version = epoca.current
    const anterior = actual.current
    if ("usuario" in anterior) {
      const pendiente = await hayCambiosLocales(almacenDispositivo, anterior.usuario.id).catch(
        () => true,
      )
      if (version !== epoca.current) return
      if (pendiente) {
        setConfirmandoSalida(true)
        return
      }
    }
    await salirDefinitivamente()
  }, [salirDefinitivamente])
  const reintentar = useCallback((): void => {
    if (actual.current.fase === "fuera") actualizar({ fase: "comprobando" })
    setIntento((n) => n + 1)
  }, [actualizar])
  const generacion = epoca.current
  const pedir = useMemo(() => {
    const comprobar = (): void => {
      if (generacion !== epoca.current) throw new ErrorDeSesion("La cuenta ha cambiado")
    }
    return crearPeticionAutenticada(
      () => {
        comprobar()
        return actual.current.fase === "dentro" ? actual.current.tokenAcceso : null
      },
      {
        renovar: async () => {
          comprobar()
          return renovar()
        },
        epoca: () => epoca.current,
        revocada: revocar,
      },
    )
  }, [renovar, revocar, generacion])
  const valor = useMemo<Contexto>(
    () => ({ estado, sesionCaducada, sinConexion, entrar, salir, reintentar, pedir }),
    [estado, sesionCaducada, sinConexion, entrar, salir, reintentar, pedir],
  )
  const cuenta = "usuario" in estado ? estado.usuario.id : "sin-cuenta"
  return (
    <ContextoSesion.Provider value={valor}>
      <Fragment key={cuenta}>{children}</Fragment>
      {avisoSalida !== "" && (
        <View style={{ backgroundColor: tema.superficie, padding: 16 }}>
          <Text accessibilityRole="alert" style={{ color: tema.texto }}>
            {avisoSalida}
          </Text>
          <BotonSecundario
            texto="Reintentar limpieza"
            onPress={() =>
              void (actual.current.fase === "fuera" ? limpiarAcceso() : salirDefinitivamente())
            }
          />
        </View>
      )}
      <Modal
        visible={confirmandoSalida}
        transparent
        onRequestClose={() => setConfirmandoSalida(false)}
      >
        <View
          style={{
            flex: 1,
            justifyContent: "center",
            padding: 24,
            backgroundColor: "rgba(0,0,0,0.75)",
          }}
        >
          <View style={{ backgroundColor: tema.superficie, borderRadius: 18, padding: 22 }}>
            <Text style={{ color: tema.texto, fontSize: 20, fontWeight: "700" }}>
              Hay cambios sin confirmar
            </Text>
            <Text style={{ color: tema.textoTenue, marginTop: 12 }}>
              Al cerrar se descartarán las copias locales que aún no han llegado al servidor. Puedes
              volver al entrenamiento y sincronizarlas.
            </Text>
            <BotonPrincipal texto="Seguir entrenando" onPress={() => setConfirmandoSalida(false)} />
            <BotonSecundario
              texto="Descartar y cerrar sesión"
              onPress={() => void salirDefinitivamente()}
            />
          </View>
        </View>
      </Modal>
    </ContextoSesion.Provider>
  )
}

export function useSesion(): Contexto {
  const contexto = useContext(ContextoSesion)
  if (contexto === null) throw new Error("useSesion se ha usado fuera de ProveedorDeSesion")
  return contexto
}
