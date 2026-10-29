import { useCallback, useContext, useEffect, useRef, useState } from "react"
import { useFocusEffect } from "expo-router"
import { NavigationContext, usePreventRemove } from "expo-router/react-navigation"
import { randomUUID } from "expo-crypto"
import { AppState, Keyboard, ScrollView, StyleSheet, Text, View } from "react-native"
import { ZodError } from "zod"
import type { EjercicioPrescrito, SesionCliente, ValoresEjecutados } from "@alpha-omega/shared"
import type { ApiEntrenamiento } from "./api"
import { almacenDispositivo } from "./almacen-dispositivo"
import { ErrorDeCopiaLocal } from "./almacen-local"
import { RegistroControl } from "./registro-control"
import {
  mejoraPersonal,
  registroParaEnviar,
  type EdicionRegistro,
  type EjercicioConDistancia,
  type PrescripcionConDistancia,
} from "./registro-modelo"
import {
  ajusteDeSerie,
  TablaSeries,
  type DeshacerSerie,
  type FocoSerie,
  type RecordPersonal,
} from "./tabla-series"
import { ConfirmacionSesion, PrescripcionVisible } from "./resultado"
import { VerTecnica } from "./ver-tecnica"
import { Dialogo, Enlace } from "./sesion/controles"
import {
  ejercicioParaRirFinal,
  ejerciciosOrdenados,
  segundosDeDescanso,
  seriesDeTrabajo,
} from "./sesion/modelo"
import { RegistrarMolestiaPantalla, type LugarDeMolestia } from "./sesion/molestia"
import { CabeceraSesion, Descanso, ListaMarcable, seriesMarcadas } from "./sesion/partes"
import { duracionDeSesion, iniciarTramo } from "./sesion/tiempo"
import { RespuestasDelEntrenador } from "./sesion/respuestas"
import { useAccesoAFiguras } from "../catalogo-ejercicios/figura-ejercicio"
import { useCatalogo } from "../catalogo-ejercicios/use-catalogo"
import { AvisoDeError, BotonPrincipal, BotonSecundario, Campo } from "../componentes/formulario"
import { tema } from "../tema"
import { SafeAreaView } from "react-native-safe-area-context"
import { Aviso } from "../componentes/aviso"
import { AvisoDeshacer } from "../componentes/aviso-deshacer"
import { BarraAjuste } from "../componentes/barra-ajuste"
import { Esqueleto, GrupoEsqueletos } from "../componentes/esqueleto"
import { useMovimientoReducido } from "../componentes/movimiento"
import { cargaSugeridaDeFase, textoDeAjustes } from "./plan/ajustes-fase"

type Serie = EdicionRegistro["series"][number]
type Fase = "sesion" | "molestia"

const TITULOS_DE_SECCION = {
  calentamiento: "Calentamiento",
  principal: "Parte principal",
  circuito: "Circuito",
  final: "Vuelta a la calma",
} as const

const MENSAJES_DE_COPIA_LOCAL = {
  leer: "No se pudo leer la copia guardada en este dispositivo. La copia se conserva; reintenta para recuperarla.",
  guardar: "No se pudo guardar la sesión en este dispositivo. Reintenta antes de salir.",
} as const

function GuardarAntesDeNavegar({
  guardar,
  fallar,
  solicitar,
}: {
  guardar: () => Promise<void>
  fallar: (error: unknown) => void
  solicitar: (seguir: () => void) => void
}): null {
  const navigation = useContext(NavigationContext)!
  const ocupada = useRef(false)
  const [salida, setSalida] = useState<(() => void) | null>(null)
  usePreventRemove(salida === null, ({ data }) => {
    if (ocupada.current) return
    solicitar(() => {
      ocupada.current = true
      void guardar()
        .then(() => setSalida(() => () => navigation.dispatch(data.action)))
        .catch(fallar)
        .finally(() => {
          ocupada.current = false
        })
    })
  })
  useEffect(() => {
    if (!salida) return
    salida()
    setSalida(null)
  }, [salida])
  return null
}

function PausaDeNavegacion(props: {
  guardar: () => Promise<void>
  fallar: (error: unknown) => void
  solicitar: (seguir: () => void) => void
}): React.JSX.Element | null {
  return useContext(NavigationContext) ? <GuardarAntesDeNavegar {...props} /> : null
}

/** Lo que se cuenta en enteros; los metros solo se nombran si la sesión los pauta. */
function magnitudes(prescripcion: PrescripcionConDistancia | undefined): string {
  const metros = prescripcion?.ejercicios.some((e) =>
    e.series.some((s) => s.tipoMedicion === "distancia"),
  )
  return metros ? "repeticiones, segundos y metros" : "repeticiones y segundos"
}

/** El tic solo repinta el reloj o el descanso, sin interrumpir los campos de las series. */
function useAhora(): number {
  const [ahora, setAhora] = useState(() => Date.now())
  useEffect(() => {
    const tic = setInterval(() => setAhora(Date.now()), 1000)
    return () => clearInterval(tic)
  }, [])
  return ahora
}

function RelojDeSesion({
  edicion,
  children,
}: {
  edicion: EdicionRegistro
  children: (duracion: ReturnType<typeof duracionDeSesion>) => React.JSX.Element
}): React.JSX.Element {
  const ahora = useAhora()
  return children(duracionDeSesion(edicion, ahora))
}

function DescansoVivo({
  hasta,
  total,
  saltar,
  ajustar,
  animar,
}: {
  hasta: string
  total: number | null | undefined
  saltar: () => void
  ajustar: (segundos: -15 | 15) => void
  animar: boolean
}): React.JSX.Element | null {
  const ahora = useAhora()
  const restante = Math.max(0, Math.round((Date.parse(hasta) - ahora) / 1000))
  return (
    <Descanso
      restante={restante}
      total={total ?? restante}
      saltar={saltar}
      ajustar={ajustar}
      animar={animar}
    />
  )
}

export function RegistroCliente({
  cuenta,
  id,
  api,
  salir,
  listo,
}: {
  cuenta: string
  id: string
  api: ApiEntrenamiento
  /** Volver a la semana. El borrador ya está guardado en el dispositivo. */
  salir?: () => void
  listo?: () => void
}): React.JSX.Element {
  const [control, setControl] = useState<RegistroControl | null>(null)
  const [, repintar] = useState(0)
  const [error, setError] = useState("")
  // Al marcar «Hecha» sin lo necesario el motivo sale junto a las series: el aviso
  // general queda al pie de la pantalla, normalmente fuera de la vista.
  const [errorSerie, setErrorSerie] = useState<{
    ejercicioId: string
    mensaje: string
    intento: number
  } | null>(null)
  const [intento, setIntento] = useState(0)
  const [ocupado, setOcupado] = useState(false)
  const [fase, setFase] = useState<Fase>("sesion")
  const [dialogo, setDialogo] = useState<"terminar" | null>(null)
  const [salidaPendiente, setSalidaPendiente] = useState<(() => void) | null>(null)
  const [tecnica, setTecnica] = useState<EjercicioPrescrito | null>(null)
  const [anteriores, setAnteriores] = useState<Map<string, ValoresEjecutados>>(new Map())
  const [recordPersonal, setRecordPersonal] = useState<RecordPersonal | null>(null)
  const recordsCelebrados = useRef(new Set<string>())
  useEffect(() => {
    recordsCelebrados.current.clear()
    setRecordPersonal(null)
  }, [cuenta, id])
  useEffect(() => {
    if (!recordPersonal) return
    const plazo = setTimeout(() => setRecordPersonal(null), 1600)
    return () => clearTimeout(plazo)
  }, [recordPersonal])
  const [nota, setNota] = useState(false)
  const [ajusteValido, setAjusteValido] = useState(true)
  const [lugarMolestia, setLugarMolestia] = useState<LugarDeMolestia>({
    ejercicioPrescritoId: null,
    ejercicio: null,
    serie: null,
  })
  const [foco, setFoco] = useState<(FocoSerie & { ejercicioId: string }) | null>(null)
  const [deshacer, setDeshacer] = useState<
    (DeshacerSerie & { id: number; iniciadoEn: number }) | null
  >(null)
  const avisoId = useRef(0)
  const intentoSerie = useRef(0)
  const reducido = useMovimientoReducido()
  const [pausaMovimiento, setPausaMovimiento] = useState(false)
  const [mostrarDeshacer, setMostrarDeshacer] = useState(true)
  const turnosMovimiento = useRef<ReturnType<typeof setTimeout>[]>([])
  useEffect(() => () => turnosMovimiento.current.forEach(clearTimeout), [])
  useEffect(() => {
    if (!reducido) return
    turnosMovimiento.current.forEach(clearTimeout)
    setPausaMovimiento(false)
    setMostrarDeshacer(true)
  }, [reducido])
  const antesDeSalir = useRef<((salir: () => void) => void) | null>(null)
  const salidaEnCurso = useRef(false)
  const registrarSalida = useCallback((preparar: ((salir: () => void) => void) | null) => {
    antesDeSalir.current = preparar
  }, [])
  const catalogo = useCatalogo()
  const acceso = useAccesoAFiguras()

  useFocusEffect(
    useCallback(() => {
      let vigente = true,
        comprobando = false,
        recuperando = true
      let sesionDeRecords: SesionCliente | undefined
      const c = new RegistroControl(cuenta, id, api, almacenDispositivo, randomUUID, () => {
        if (!vigente) return
        if (recuperando && c.documento && sesionDeRecords !== c.documento.sesion) {
          // Recuperar cambia la sesión; editar conserva su identidad, incluso con disco lento.
          for (const serie of c.documento.edicion.series)
            if (serie.hecha) recordsCelebrados.current.add(serie.serieId)
          sesionDeRecords = c.documento.sesion
        }
        repintar((n) => n + 1)
      })
      setControl(c)
      setError("")
      void c
        .abrir()
        .then(async () => {
          recuperando = false
          if (!vigente) return
          const local = c.documento
          for (const serie of local?.edicion.series ?? [])
            if (serie.hecha) recordsCelebrados.current.add(serie.serieId)
          if (
            vigente &&
            local &&
            !local.edicion.inicio &&
            !local.resultado &&
            !local.intencionEnvio &&
            !local.envioPendiente &&
            !c.conflicto
          )
            await c.editar(iniciarTramo(local.edicion, new Date().toISOString()))
        })
        .catch((fallo: unknown) => {
          recuperando = false
          if (vigente)
            setError(
              fallo instanceof ErrorDeCopiaLocal
                ? MENSAJES_DE_COPIA_LOCAL[fallo.operacion]
                : "No se pudo abrir la sesión. Necesitas conexión para descargarla por primera vez; si ya la tenías, reintenta para recuperar su copia local.",
            )
        })
      const comprobar = async (): Promise<void> => {
        if (
          comprobando ||
          !c.documento ||
          (AppState.currentState !== null && AppState.currentState !== "active")
        )
          return
        comprobando = true
        try {
          if (c.documento.intencionEnvio || c.documento.envioPendiente) await c.enviar()
          else await c.sincronizar()
          if (vigente) await c.actualizar()
        } catch {
          /* La copia local se conserva; el estado permite un reintento explícito. */
        } finally {
          comprobando = false
        }
      }
      const temporizador = setInterval(() => void comprobar(), 5000)
      const actividad = AppState.addEventListener("change", (s) => {
        if (s === "active") void comprobar()
      })
      return () => {
        vigente = false
        // Blur de navegación pausa el entrenamiento; bloquear el teléfono no produce blur.
        void c
          .pausar(new Date().toISOString())
          .catch(() => undefined)
          .finally(() => c.cerrar())
        clearInterval(temporizador)
        actividad.remove()
      }
    }, [cuenta, id, api, intento]),
  )

  // «Anterior» sirve como referencia. Sin red, la sesión sigue sin él.
  useEffect(() => {
    let vigente = true
    api
      .anteriores(id)
      .then((listado) => {
        if (vigente)
          setAnteriores(new Map(listado.anteriores.map((a) => [a.ejercicioId, a.valores])))
      })
      .catch(() => undefined)
    return () => {
      vigente = false
    }
  }, [api, id, cuenta])

  const documento = control?.documento
  const accion = async (operacion: () => Promise<void>): Promise<void> => {
    setOcupado(true)
    setError("")
    try {
      await operacion()
    } catch (e) {
      setError(
        e instanceof ZodError
          ? `Revisa los valores: ${magnitudes(documento?.sesion.prescripcion)} deben ser enteros positivos; completa el peso requerido antes de marcar la serie.`
          : e instanceof ErrorDeCopiaLocal
            ? MENSAJES_DE_COPIA_LOCAL[e.operacion]
            : "No se pudo confirmar la operación. Tu copia local se conserva. Reintenta cuando tengas conexión.",
      )
    } finally {
      setOcupado(false)
    }
  }

  if (!documento || !control)
    return (
      <SafeAreaView edges={["bottom"]} style={e.pantalla}>
        <View style={e.contenido}>
          {error ? (
            <>
              <AvisoDeError mensaje={error} />
              <BotonSecundario texto="Reintentar" onPress={() => setIntento((n) => n + 1)} />
            </>
          ) : (
            <GrupoEsqueletos>
              {[0, 1].map((n) => (
                <View key={n} style={e.esqueleto}>
                  <Esqueleto ancho="65%" alto={24} />
                  {[0, 1, 2, 3].map((fila) => (
                    <Esqueleto key={fila} alto={52} />
                  ))}
                </View>
              ))}
            </GrupoEsqueletos>
          )}
        </View>
      </SafeAreaView>
    )
  if (documento.resultado)
    return (
      <SafeAreaView edges={["bottom"]} style={e.pantalla}>
        <ScrollView contentContainerStyle={e.contenido} keyboardShouldPersistTaps="handled">
          <ConfirmacionSesion
            estado="enviado"
            hechas={
              documento.resultado.series.filter(
                (s) =>
                  s.hecha && seriesDeTrabajo(documento.resultado!.prescripcion).includes(s.serieId),
              ).length
            }
            total={seriesDeTrabajo(documento.resultado.prescripcion).length}
            duracion={documento.resultado.tiempoActivoSegundos ?? null}
            revisada={Boolean(documento.sesion.revisadaEn)}
            salir={listo ?? salir}
          />
          <PrescripcionVisible
            prescripcion={documento.resultado.prescripcion}
            resultado={documento.resultado}
          />
          <RespuestasDelEntrenador cuenta={cuenta} sesionId={id} api={api} />
          {documento.respaldo && (
            <View>
              <AvisoDeError mensaje="La sesión ya está enviada. Conservamos aquí otra copia no enviada; el resultado del entrenador ya está cerrado." />
              {(documento.respaldosLocales ?? []).map((copia, indice) => (
                <BotonSecundario
                  key={indice}
                  texto={`Ver otra copia ${indice + 1}${copia.edicion.notas ? `: ${copia.edicion.notas.slice(0, 40)}` : ""}`}
                  onPress={() => void accion(() => control.elegirCopiaLocal(indice))}
                />
              ))}
              {documento.respaldo.prescripcion.ejercicios.flatMap((ejercicio) =>
                ejercicio.series.map((prescrita, i) => {
                  const serie = documento.respaldo?.edicion.series.find(
                    (s) => s.serieId === prescrita.id,
                  )
                  const unidad = { repeticiones: "rep", tiempo: "s", distancia: "m" }[
                    prescrita.tipoMedicion
                  ]
                  return (
                    <Text key={prescrita.id} style={e.texto}>
                      {`Copia · ${ejercicio.nombre} · serie ${i + 1}: ${serie?.valor || "—"} ${unidad}${serie?.peso ? ` · ${serie.peso} kg` : ""}`}
                    </Text>
                  )
                }),
              )}
              <Text style={e.texto}>{documento.respaldo.edicion.notas}</Text>
              <BotonSecundario
                texto="Descartar esta copia no enviada"
                onPress={() => void accion(() => control.descartarCopia())}
              />
            </View>
          )}
          {error !== "" && <AvisoDeError mensaje={error} />}
        </ScrollView>
      </SafeAreaView>
    )

  const { prescripcion } = documento.sesion
  const pausaDeNavegacion = (
    <PausaDeNavegacion
      solicitar={(seguir) => {
        if (antesDeSalir.current) antesDeSalir.current(seguir)
        else if (documento.intencionEnvio || documento.envioPendiente)
          setSalidaPendiente(() => seguir)
        else seguir()
      }}
      guardar={async () => {
        await control.pausar(new Date().toISOString())
        await control.reintentarGuardado()
      }}
      fallar={(fallo) =>
        setError(
          fallo instanceof ErrorDeCopiaLocal
            ? MENSAJES_DE_COPIA_LOCAL[fallo.operacion]
            : "No se pudo guardar la sesión antes de salir. Reintenta.",
        )
      }
    />
  )
  const edicion = documento.edicion
  const pausado = edicion.tiempoActivoSegundos !== undefined && !edicion.tramoActivoDesde
  const bloqueadoPorEnvio =
    ocupado ||
    control.conflicto ||
    documento.intencionEnvio != null ||
    documento.envioPendiente !== null
  const bloqueado = bloqueadoPorEnvio || pausado
  const seriesBloqueadas = bloqueado || !ajusteValido
  const cambiar = (
    nueva: EdicionRegistro,
    vista: {
      descansoHasta?: string | null
      descansoTotal?: number | null
      ejercicioElegidoId?: string | null
    } = {},
  ): void => {
    setError("")
    // Una copia antigua sin inicio también arranca al anotar.
    const conInicio = nueva.inicio ? nueva : iniciarTramo(nueva, new Date().toISOString())
    void control
      .editar(conInicio, vista)
      .catch(() =>
        setError(
          "No se pudo guardar en este dispositivo. Mantén esta pantalla abierta y reintenta el guardado.",
        ),
      )
  }
  const serie = (serieId: string, cambio: Partial<Serie>): boolean => {
    setErrorSerie(null)
    const actual = control.documento!.edicion
    const anterior = actual.series.find((s) => s.serieId === serieId)
    const ejercicio = prescripcion.ejercicios.find((e) => e.series.some((s) => s.id === serieId))
    const nueva = {
      ...actual,
      series: actual.series.map((s) => (s.serieId === serieId ? { ...s, ...cambio } : s)),
    }
    let nuevoDescanso: { descansoHasta: string; descansoTotal: number } | undefined
    let mejora: string | null = null
    if (cambio.hecha) {
      try {
        const registro = registroParaEnviar(prescripcion, nueva)
        const registrada = registro.series.find((s) => s.serieId === serieId)
        if (!anterior?.hecha && !recordsCelebrados.current.has(serieId) && ejercicio && registrada)
          mejora = mejoraPersonal(registrada, anteriores.get(ejercicio.ejercicioId))
      } catch {
        const prescrita = ejercicio?.series.find((s) => s.id === serieId)
        const sinPeso =
          (ejercicio?.seccion ?? "principal") === "principal" &&
          ejercicio?.tipoCarga !== "sinCarga" &&
          (ejercicio?.tipoCarga === "conCargaExterna" || prescrita?.pesoKg != null) &&
          !nueva.series.find((s) => s.serieId === serieId)?.peso.trim()
        if (ejercicio)
          setErrorSerie({
            ejercicioId: ejercicio.id,
            mensaje: sinPeso ? "Falta el peso" : "Revisa los valores de la serie",
            intento: ++intentoSerie.current,
          })
        return false
      }
      // Tras una serie hecha empieza el descanso que prescribió el entrenador.
      const segundos = segundosDeDescanso(ejercicio?.descanso)
      if (!anterior?.hecha && segundos !== null)
        nuevoDescanso = {
          descansoHasta: new Date(Date.now() + segundos * 1000).toISOString(),
          descansoTotal: segundos,
        }
    }
    if (cambio.hecha !== undefined || cambio.omitida) {
      if (mejora) recordsCelebrados.current.add(serieId)
      setRecordPersonal(mejora ? { serieId, mejora } : null)
    }
    const retener = ejercicioParaRirFinal(prescripcion, nueva, serieId)
    if ((cambio.hecha && !anterior?.hecha) || cambio.omitida) {
      turnosMovimiento.current.forEach(clearTimeout)
      if (!reducido) {
        // Fila, recorrido y aviso se relevan; el descanso cuenta sin interpolar entre tanto.
        const espera = cambio.hecha ? 1100 : 0
        setPausaMovimiento(true)
        setMostrarDeshacer(false)
        turnosMovimiento.current = [
          setTimeout(() => setMostrarDeshacer(true), espera),
          setTimeout(() => setPausaMovimiento(false), espera + 220),
        ]
      }
    }
    cambiar(nueva, {
      ...nuevoDescanso,
      ...(retener && { ejercicioElegidoId: retener }),
    })
    if (cambio.hecha || cambio.omitida) {
      Keyboard.dismiss()
      setFoco(null)
    }
    return true
  }
  const marcarLista = (ejercicio: EjercicioConDistancia, hecho: boolean): void =>
    cambiar({ ...edicion, series: seriesMarcadas(ejercicio, edicion.series, hecho) })

  const trabajo = seriesDeTrabajo(prescripcion)
  const hechasTrabajo = edicion.series.filter((s) => s.hecha && trabajo.includes(s.serieId)).length
  if (fase === "molestia") {
    return (
      <SafeAreaView edges={["bottom"]} style={e.pantalla}>
        <ScrollView contentContainerStyle={e.contenido} keyboardShouldPersistTaps="handled">
          {pausaDeNavegacion}
          <RegistrarMolestiaPantalla
            registrarSalida={registrarSalida}
            lugar={lugarMolestia}
            reloj={null}
            uuid={randomUUID}
            avisar={async (datos) => {
              await api.avisarMolestia(id, datos)
            }}
            volver={() => setFase("sesion")}
          />
        </ScrollView>
      </SafeAreaView>
    )
  }

  const enviar = (): void => {
    Keyboard.dismiss()
    setFoco(null)
    setDialogo(null)
    void accion(async () => {
      await control.pausar(new Date().toISOString())
      await control.enviar()
    })
  }
  const pendientes = edicion.series.filter((s) => !s.hecha && !s.omitida).length
  const terminar = (): void => {
    if (!ajusteValido) return
    if (!edicion.series.some((s) => s.hecha)) {
      setError("Marca al menos una serie")
      return
    }
    try {
      registroParaEnviar(prescripcion, edicion)
      setError("")
      if (pendientes > 0) setDialogo("terminar")
      else enviar()
    } catch {
      setError("Revisa los valores escritos antes de terminar.")
    }
  }
  const guardarYSalir = (destino: (() => void) | undefined): void => {
    if (salidaEnCurso.current) return
    salidaEnCurso.current = true
    void accion(async () => {
      await control.pausar(new Date().toISOString())
      await control.reintentarGuardado()
      destino?.()
    }).finally(() => {
      salidaEnCurso.current = false
    })
  }
  const salirGuardando = (): void => guardarYSalir(salir)
  const avisos = (
    <>
      {control.errorLocal && (
        <>
          <AvisoDeError mensaje="No se pudo guardar. Tus datos siguen en el móvil." />
          <BotonSecundario
            texto="Reintentar guardado local"
            onPress={() => void accion(() => control.reintentarGuardado())}
          />
        </>
      )}
      {control.sinRed && (
        <Aviso
          mensaje="Sin conexión. Conservas tu copia local."
          alReintentar={() => void accion(() => control.actualizar())}
        />
      )}
      {control.sinConsentimiento && (
        <AvisoDeError mensaje="Acepta el consentimiento de salud en tu perfil para enviar; conservas tu copia local." />
      )}
      {control.conflicto && (
        <View>
          <AvisoDeError
            mensaje={
              documento.conflictoLocal
                ? "Otra pestaña editó esta sesión. Ambas ediciones siguen guardadas: puedes continuar con la actual o recuperar la copia."
                : "Hay otra versión de esta sesión. Puedes cargarla conservando una copia de lo que has escrito."
            }
          />
          <BotonSecundario
            texto={
              documento.conflictoLocal
                ? "Continuar con esta edición"
                : "Recuperar versión del servidor"
            }
            onPress={() =>
              void accion(() =>
                documento.conflictoLocal
                  ? control.continuarEdicionLocal()
                  : control.recuperarServidor(),
              )
            }
            ocupado={ocupado}
          />
        </View>
      )}
      {documento.respaldo && (
        <View>
          {(documento.respaldosLocales ?? []).map((copia, indice) => (
            <BotonSecundario
              key={indice}
              texto={`Ver otra copia ${indice + 1}${copia.edicion.notas ? `: ${copia.edicion.notas.slice(0, 40)}` : ""}`}
              onPress={() => void accion(() => control.elegirCopiaLocal(indice))}
            />
          ))}
          <Text style={e.nota}>
            Tu copia anterior sigue guardada. Al recuperarla se aplican las series que aún conservan
            la misma unidad y admiten la carga registrada. Las demás quedan pendientes.
          </Text>
          <BotonSecundario
            texto="Recuperar mi copia anterior"
            onPress={() => void accion(() => control.recuperarCopia())}
            ocupado={ocupado}
          />
        </View>
      )}
    </>
  )
  const comprometido = documento.envioPendiente?.registro ?? documento.intencionEnvio?.registro
  if (comprometido)
    return (
      <SafeAreaView edges={["bottom"]} style={e.pantalla}>
        <ScrollView contentContainerStyle={e.contenido} keyboardShouldPersistTaps="handled">
          {pausaDeNavegacion}
          {control.errorLocal || control.guardando > 0 ? (
            <View>
              <Text accessibilityRole="header" style={e.titulo}>
                ENVÍO PENDIENTE
              </Text>
              <BotonSecundario
                texto="Reintentar ahora"
                ocupado={ocupado}
                onPress={() => void accion(() => control.enviar())}
              />
            </View>
          ) : (
            <ConfirmacionSesion
              estado="guardado"
              hechas={
                comprometido.series.filter((s) => s.hecha && trabajo.includes(s.serieId)).length
              }
              total={trabajo.length}
              duracion={comprometido.tiempoActivoSegundos ?? null}
              salir={() => guardarYSalir(listo ?? salir)}
              reintentar={() => void accion(() => control.enviar())}
              ocupado={ocupado}
            />
          )}
          {avisos}
          <PrescripcionVisible prescripcion={prescripcion} registro={comprometido} />
          {error !== "" && !control.sinRed && <AvisoDeError mensaje={error} />}
        </ScrollView>
        <Dialogo
          visible={salidaPendiente !== null}
          titulo="¿Salir de la sesión?"
          texto="El envío sigue pendiente; conservas tu copia local."
          confirmar="Salir"
          cancelar="Seguir aquí"
          alConfirmar={() => {
            const seguir = salidaPendiente
            setSalidaPendiente(null)
            seguir?.()
          }}
          alCancelar={() => setSalidaPendiente(null)}
        />
      </SafeAreaView>
    )
  const ejercicioEnFoco = foco && prescripcion.ejercicios.find((e) => e.id === foco.ejercicioId)
  const realEnFoco = foco && edicion.series.find((s) => s.serieId === foco.serieId)
  const resumenDeFase = textoDeAjustes(prescripcion.fase?.ajustes)
  const ajuste =
    ejercicioEnFoco && realEnFoco && foco
      ? ajusteDeSerie(
          ejercicioEnFoco,
          realEnFoco,
          foco.celda,
          cargaSugeridaDeFase(
            ejercicioEnFoco,
            prescripcion.fase?.ajustes.factorCarga,
            anteriores.get(ejercicioEnFoco.ejercicioId),
          ),
        )
      : null
  const avisoDeshacer = deshacer && mostrarDeshacer && (
    <AvisoDeshacer
      key={deshacer.id}
      id={deshacer.id}
      mensaje={deshacer.mensaje}
      alDeshacer={() => {
        setDeshacer(null)
        deshacer.deshacer()
      }}
      alExpirar={() => setDeshacer(null)}
      iniciadoEn={deshacer.iniciadoEn}
      animar={!ajuste}
      animarPlazo={false}
    />
  )
  const abrirMolestia = (ejercicio: EjercicioPrescrito): void => {
    const indice = ejercicio.series.findIndex((s) => {
      const real = edicion.series.find((r) => r.serieId === s.id)
      return !real?.hecha && !real?.omitida
    })
    Keyboard.dismiss()
    setFoco(null)
    setLugarMolestia({
      ejercicioPrescritoId: ejercicio.id,
      ejercicio: ejercicio.nombre,
      serie: indice < 0 ? null : indice + 1,
    })
    setFase("molestia")
  }
  return (
    <SafeAreaView edges={["bottom"]} style={e.pantalla}>
      {pausaDeNavegacion}
      <View style={e.cabecera}>
        <RelojDeSesion edicion={edicion}>
          {({ segundos }) => (
            <CabeceraSesion
              hechas={hechasTrabajo}
              total={trabajo.length}
              segundos={segundos}
              salir={salir && salirGuardando}
              terminar={terminar}
              ocupado={ocupado}
              deshabilitado={seriesBloqueadas}
              demoraProgreso={420}
            />
          )}
        </RelojDeSesion>
        {prescripcion.fase && (
          <Text style={e.nota}>
            {prescripcion.fase.nombre}
            {resumenDeFase ? ` · ${resumenDeFase}` : ""}
          </Text>
        )}
        {error !== "" && <AvisoDeError mensaje={error} />}
        {documento.descansoHasta && (
          <DescansoVivo
            hasta={documento.descansoHasta}
            total={documento.descansoTotal}
            animar={!pausaMovimiento}
            saltar={() =>
              void accion(() => control.guardarVista({ descansoHasta: null, descansoTotal: null }))
            }
            ajustar={(delta) => {
              const restante = Math.max(
                0,
                Math.round((Date.parse(control.documento!.descansoHasta!) - Date.now()) / 1000),
              )
              const total = Math.max(0, (control.documento!.descansoTotal ?? restante) + delta)
              void accion(() =>
                control.guardarVista({
                  descansoHasta: new Date(
                    Date.now() + Math.max(0, restante + delta) * 1000,
                  ).toISOString(),
                  descansoTotal: total,
                }),
              )
            }}
          />
        )}
      </View>
      <ScrollView
        testID="lista-sesion"
        contentContainerStyle={[e.contenido, e.lista]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        {pausado && !bloqueadoPorEnvio && (
          <BotonPrincipal
            texto="Continuar entrenamiento"
            onPress={() =>
              void accion(() => control.editar(iniciarTramo(edicion, new Date().toISOString())))
            }
          />
        )}
        <Text
          testID="estado-guardado"
          accessibilityLiveRegion={control.errorLocal ? "polite" : "none"}
          style={e.estadoOculto}
        >
          {control.errorLocal
            ? "Error de guardado"
            : control.guardando > 0
              ? "Guardando…"
              : "Guardado"}
        </Text>
        {avisos}
        {ejerciciosOrdenados(prescripcion).map((ejercicio, indice, ordenados) => {
          const enCurso =
            ejercicio.series.find((s) => {
              const real = edicion.series.find((r) => r.serieId === s.id)
              return !real?.hecha && !real?.omitida
            })?.id ?? null
          const deLista = ejercicio.seccion === "calentamiento" || ejercicio.seccion === "final"
          if (deLista && ordenados[indice - 1]?.seccion === ejercicio.seccion) return null
          return (
            <View key={ejercicio.id} testID="series-del-ejercicio">
              {deLista ? (
                <ListaMarcable
                  titulo={TITULOS_DE_SECCION[ejercicio.seccion as "calentamiento" | "final"]}
                  ejercicios={ordenados.filter((e) => e.seccion === ejercicio.seccion)}
                  series={edicion.series}
                  bloqueado={seriesBloqueadas}
                  marcar={marcarLista}
                  cambiarPeso={(serieId, peso) => serie(serieId, { peso })}
                />
              ) : (
                <TablaSeries
                  ejercicio={ejercicio}
                  series={edicion.series}
                  bloqueado={seriesBloqueadas}
                  cambiar={serie}
                  enCurso={enCurso}
                  anterior={anteriores.get(ejercicio.ejercicioId)}
                  factorCarga={prescripcion.fase?.ajustes.factorCarga}
                  recordPersonal={recordPersonal}
                  recordsCelebrados={recordsCelebrados.current}
                  verTecnica={() => setTecnica(ejercicio)}
                  verMolestia={() => abrirMolestia(ejercicio)}
                  enfocada={foco?.ejercicioId === ejercicio.id ? foco : null}
                  enfocar={(serieId, celda) =>
                    setFoco({ ejercicioId: ejercicio.id, serieId, celda })
                  }
                  avisarDeshacer={(aviso) =>
                    setDeshacer({ ...aviso, id: ++avisoId.current, iniciadoEn: Date.now() })
                  }
                  error={errorSerie?.ejercicioId === ejercicio.id ? errorSerie.mensaje : undefined}
                  intentoError={errorSerie?.intento}
                />
              )}
            </View>
          )
        })}
        <Enlace texto="Añadir nota" onPress={() => setNota(!nota)} />
        {(nota || edicion.notas !== "") && (
          <Campo
            etiqueta="Nota para tu entrenador"
            value={edicion.notas}
            editable={!bloqueado}
            onChangeText={(notas) => cambiar({ ...control.documento!.edicion, notas })}
            multiline
            maxLength={2000}
          />
        )}
      </ScrollView>
      {avisoDeshacer && !ajuste && <View style={e.deshacer}>{avisoDeshacer}</View>}
      {ajuste && foco && (
        <BarraAjuste
          key={`${foco.serieId}-${foco.celda}`}
          {...ajuste}
          encima={avisoDeshacer}
          deshabilitado={bloqueado}
          alCambiarValidez={setAjusteValido}
          alListo={() => setFoco(null)}
          cambiar={(valor) =>
            serie(
              foco.serieId,
              foco.celda === "peso"
                ? { peso: String(valor).replace(".", ",") }
                : foco.celda === "cantidad"
                  ? { valor: String(valor) }
                  : { rir: valor },
            )
          }
        />
      )}
      {tecnica && (
        <VerTecnica
          cuenta={cuenta}
          ejercicioId={tecnica.ejercicioId}
          nombre={tecnica.nombre}
          leer={catalogo.leer}
          almacen={almacenDispositivo}
          acceso={acceso}
          cerrar={() => setTecnica(null)}
        />
      )}
      <Dialogo
        visible={dialogo === "terminar"}
        titulo="¿Terminar ya?"
        texto={`Quedan ${pendientes} series sin hacer.`}
        confirmar="Terminar y enviar"
        cancelar="Seguir entrenando"
        ocupado={ocupado}
        alConfirmar={enviar}
        alCancelar={() => setDialogo(null)}
      />
    </SafeAreaView>
  )
}

const e = StyleSheet.create({
  pantalla: { flex: 1 },
  cabecera: { paddingHorizontal: 20 },
  contenido: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 24, gap: 24 },
  lista: { paddingBottom: 230, gap: 26 },
  esqueleto: { gap: 8, marginBottom: 26 },
  estadoOculto: { height: 0, opacity: 0, position: "absolute" },
  deshacer: { marginHorizontal: 20, marginBottom: 20 },
  texto: { color: tema.texto, fontFamily: tema.fuenteTexto, fontSize: 15, lineHeight: 21 },
  titulo: { color: tema.acento, fontFamily: tema.fuenteTitulo, fontSize: 34, lineHeight: 38 },
  nota: { color: tema.textoTenue, fontFamily: tema.fuenteTexto, fontSize: 14, lineHeight: 20 },
})
