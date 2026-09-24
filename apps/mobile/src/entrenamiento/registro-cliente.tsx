import { useCallback, useEffect, useState } from "react"
import { useFocusEffect } from "expo-router"
import { randomUUID } from "expo-crypto"
import { AppState, Image, Pressable, StyleSheet, Text, View } from "react-native"
import { ZodError } from "zod"
import type { Checkin, Ejercicio, EjercicioPrescrito, ValoresEjecutados } from "@alpha-omega/shared"
import type { ApiEntrenamiento } from "./api"
import { almacenDispositivo } from "./almacen-dispositivo"
import { RegistroControl } from "./registro-control"
import { registroParaEnviar, type EdicionRegistro } from "./registro-modelo"
import { TablaSeries } from "./tabla-series"
import { PrescripcionVisible } from "./resultado"
import { VerTecnica } from "./ver-tecnica"
import { CheckIn } from "./sesion/check-in"
import { CierreDeSesion } from "./sesion/cierre"
import { Dialogo, Enlace } from "./sesion/controles"
import {
  duracionLegible,
  ejercicioEnCurso,
  ejercicioParaRirFinal,
  ejerciciosOrdenados,
  estadoDeEjercicio,
  reloj,
  segundosDeDescanso,
  seriesDeTrabajo,
} from "./sesion/modelo"
import { RegistrarMolestiaPantalla, type LugarDeMolestia } from "./sesion/molestia"
import { CabeceraSesion, Descanso, ListaMarcable } from "./sesion/partes"
import { duracionDeSesion, iniciarTramo } from "./sesion/tiempo"
import { RespuestasDelEntrenador } from "./sesion/respuestas"
import { FiguraDeEjercicio, useAccesoAFiguras } from "../catalogo-ejercicios/figura-ejercicio"
import { useCatalogo } from "../catalogo-ejercicios/use-catalogo"
import { AvisoDeError, BotonPrincipal, BotonSecundario, Campo } from "../componentes/formulario"
import { tema } from "../tema"
import fotoDeEntrenamiento from "../../assets/entrenamiento.webp"

type Serie = EdicionRegistro["series"][number]
type Fase = "sesion" | "molestia" | "cierre"

const TITULOS_DE_SECCION = {
  calentamiento: "Calentamiento",
  principal: "Parte principal",
  circuito: "Circuito",
  final: "Vuelta a la calma",
} as const

/**
 * El entrenamiento del cliente con el recorrido de Design.html: check-in,
 * sesión en curso (cronómetro, descanso, RIR, técnica y molestias), cierre y
 * envío. Todo lo que se escribe se guarda en el dispositivo al momento.
 */
export function RegistroCliente({
  cuenta,
  id,
  api,
  salir,
}: {
  cuenta: string
  id: string
  api: ApiEntrenamiento
  /** Volver a la semana. El borrador ya está guardado en el dispositivo. */
  salir?: () => void
}): React.JSX.Element {
  const [control, setControl] = useState<RegistroControl | null>(null)
  const [, repintar] = useState(0)
  const [error, setError] = useState("")
  const [intento, setIntento] = useState(0)
  const [ocupado, setOcupado] = useState(false)
  const [fase, setFase] = useState<Fase>("sesion")
  const [dialogo, setDialogo] = useState<"salir" | "terminar" | null>(null)
  const [tecnica, setTecnica] = useState<EjercicioPrescrito | null>(null)
  const [ahora, setAhora] = useState(() => Date.now())
  const [anteriores, setAnteriores] = useState<Map<string, ValoresEjecutados>>(new Map())
  const [fichas, setFichas] = useState<Map<string, Ejercicio>>(new Map())
  const [nota, setNota] = useState(false)
  const [listaAbierta, setListaAbierta] = useState(false)
  const catalogo = useCatalogo()
  const acceso = useAccesoAFiguras()

  useFocusEffect(
    useCallback(() => {
      let vigente = true,
        comprobando = false
      const c = new RegistroControl(cuenta, id, api, almacenDispositivo, randomUUID, () => {
        if (vigente) repintar((n) => n + 1)
      })
      setControl(c)
      setError("")
      void c.abrir().catch(() => {
        if (vigente)
          setError(
            "No se pudo abrir la sesión. Necesitas conexión para descargarla por primera vez; si ya la tenías, reintenta para recuperar su copia local.",
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

  // Cronómetro y descanso: un tic por segundo basta.
  useEffect(() => {
    const tic = setInterval(() => setAhora(Date.now()), 1000)
    return () => clearInterval(tic)
  }, [])

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
  const sugerido = documento
    ? ejercicioEnCurso(documento.sesion.prescripcion, documento.edicion)
    : null
  const ejercicioElegido = documento?.ejercicioElegidoId ?? null
  const ejercicioActual =
    documento?.sesion.prescripcion.ejercicios.find((e) => e.id === ejercicioElegido) ??
    sugerido ??
    documento?.sesion.prescripcion.ejercicios.at(-1)
  const enCurso =
    ejercicioActual?.series.find((s) => {
      const real = documento?.edicion.series.find((r) => r.serieId === s.id)
      return !real?.hecha && !real?.omitida
    })?.id ?? null

  // La ficha del ejercicio en curso, para su animación.
  const idActual = ejercicioActual?.ejercicioId
  useEffect(() => {
    if (idActual === undefined || fichas.has(idActual)) return
    let vigente = true
    catalogo
      .leer(idActual)
      .then((ficha) => {
        if (vigente) setFichas((actual) => new Map(actual).set(idActual, ficha))
      })
      .catch(() => undefined)
    return () => {
      vigente = false
    }
  }, [catalogo, idActual, fichas])

  const accion = async (operacion: () => Promise<void>): Promise<void> => {
    setOcupado(true)
    setError("")
    try {
      await operacion()
    } catch (e) {
      setError(
        e instanceof ZodError
          ? "Revisa los valores: repeticiones y segundos deben ser enteros positivos; completa el peso requerido antes de marcar la serie."
          : "No se pudo confirmar la operación. Tu copia local se conserva. Reintenta cuando tengas conexión.",
      )
    } finally {
      setOcupado(false)
    }
  }

  if (!documento || !control)
    return (
      <View>
        {error ? (
          <>
            <AvisoDeError mensaje={error} />
            <BotonSecundario texto="Reintentar" onPress={() => setIntento((n) => n + 1)} />
          </>
        ) : (
          <Text style={e.texto}>Abriendo entrenamiento…</Text>
        )}
      </View>
    )
  if (documento.resultado)
    return (
      <View style={e.contenedor}>
        <Text accessibilityLiveRegion="polite" style={e.nota}>
          {documento.sesion.revisadaEn ? "Revisado por el entrenador" : "Enviado al entrenador"}
        </Text>
        <PrescripcionVisible
          prescripcion={documento.resultado.prescripcion}
          resultado={documento.resultado}
        />
        <RespuestasDelEntrenador cuenta={cuenta} sesionId={id} api={api} />
        {documento.respaldo && (
          <View>
            <AvisoDeError mensaje="La sesión se envió desde otro dispositivo. Conservamos aquí tu copia no enviada; el resultado del entrenador ya está cerrado." />
            {documento.respaldo.edicion.series.map((s, i) => (
              <Text key={s.serieId} style={e.texto}>
                Copia · serie {i + 1}: {s.peso || "—"} kg · {s.valor || "—"}
              </Text>
            ))}
            <Text style={e.texto}>{documento.respaldo.edicion.notas}</Text>
            <BotonSecundario
              texto="Descartar esta copia no enviada"
              onPress={() => void accion(() => control.descartarCopia())}
            />
          </View>
        )}
        {error !== "" && <AvisoDeError mensaje={error} />}
      </View>
    )

  const { prescripcion } = documento.sesion
  const edicion = documento.edicion
  const pausado = edicion.tiempoActivoSegundos !== undefined && !edicion.tramoActivoDesde
  const bloqueadoPorEnvio =
    ocupado ||
    control.conflicto ||
    documento.intencionEnvio != null ||
    documento.envioPendiente !== null
  const bloqueado = bloqueadoPorEnvio || pausado
  const cambiar = (
    nueva: EdicionRegistro,
    vista: {
      descansoHasta?: string | null
      descansoTotal?: number | null
      ejercicioElegidoId?: string | null
    } = {},
  ): void => {
    setError("")
    // La sesión empieza con la primera anotación si no pasó por el check-in.
    const conInicio = nueva.inicio ? nueva : iniciarTramo(nueva, new Date().toISOString())
    void control
      .editar(conInicio, vista)
      .catch(() =>
        setError(
          "No se pudo guardar en este dispositivo. Mantén esta pantalla abierta y reintenta el guardado.",
        ),
      )
  }
  const serie = (serieId: string, cambio: Partial<Serie>): void => {
    const anterior = edicion.series.find((s) => s.serieId === serieId)
    const nueva = {
      ...edicion,
      series: edicion.series.map((s) => (s.serieId === serieId ? { ...s, ...cambio } : s)),
    }
    let nuevoDescanso: { descansoHasta: string; descansoTotal: number } | undefined
    if (cambio.hecha) {
      try {
        registroParaEnviar(prescripcion, nueva)
      } catch {
        setError("Escribe los valores realizados y el peso indicado antes de marcar la serie.")
        return
      }
      // Tras una serie hecha empieza el descanso que prescribió el entrenador.
      const ejercicio = prescripcion.ejercicios.find((e) => e.series.some((s) => s.id === serieId))
      const segundos = segundosDeDescanso(ejercicio?.descanso)
      if (!anterior?.hecha && segundos !== null)
        nuevoDescanso = {
          descansoHasta: new Date(Date.now() + segundos * 1000).toISOString(),
          descansoTotal: segundos,
        }
    }
    const retener = ejercicioParaRirFinal(prescripcion, nueva, serieId)
    cambiar(nueva, {
      ...nuevoDescanso,
      ...(retener && { ejercicioElegidoId: retener }),
    })
  }
  const marcarLista = (ejercicio: EjercicioPrescrito, hecho: boolean): void => {
    const ids = new Map(ejercicio.series.map((p) => [p.id, p]))
    cambiar({
      ...edicion,
      series: edicion.series.map((s) => {
        const prescrita = ids.get(s.serieId)
        if (!prescrita) return s
        if (!hecho) return { ...s, hecha: false }
        return {
          ...s,
          hecha: true,
          omitida: undefined,
          valor:
            s.valor ||
            String(
              prescrita.tipoMedicion === "tiempo" ? prescrita.segundos : prescrita.repeticiones,
            ),
          peso:
            s.peso || (prescrita.pesoKg === null ? "" : String(prescrita.pesoKg).replace(".", ",")),
        }
      }),
    })
  }

  const trabajo = seriesDeTrabajo(prescripcion)
  const hechasTrabajo = edicion.series.filter((s) => s.hecha && trabajo.includes(s.serieId)).length
  const empezada = edicion.checkin || edicion.inicio || edicion.series.some((s) => s.hecha)
  const duracion = duracionDeSesion(edicion, ahora)
  const segundos = duracion.segundos
  const restante = documento.descansoHasta
    ? Math.max(0, Math.round((Date.parse(documento.descansoHasta) - ahora) / 1000))
    : 0

  if (!empezada && !documento.envioPendiente)
    return (
      <CheckIn
        nombre={prescripcion.nombre}
        volver={() => salir?.()}
        empezar={(checkin: Checkin) =>
          cambiar(iniciarTramo({ ...edicion, checkin }, new Date().toISOString()))
        }
      />
    )

  if (fase === "molestia") {
    const numero = ejercicioActual
      ? ejercicioActual.series.findIndex((s) => s.id === enCurso) + 1
      : 0
    const lugar: LugarDeMolestia = {
      ejercicioPrescritoId: ejercicioActual?.id ?? null,
      ejercicio: ejercicioActual?.nombre ?? null,
      serie: numero > 0 ? numero : null,
    }
    return (
      <RegistrarMolestiaPantalla
        lugar={lugar}
        reloj={segundos === null ? null : reloj(segundos)}
        uuid={randomUUID}
        avisar={async (datos) => {
          await api.avisarMolestia(id, datos)
        }}
        volver={() => setFase("sesion")}
      />
    )
  }

  if (fase === "cierre") {
    // Con un envío guardado se enseña exactamente su contenido: la edición ya no viajaría.
    const comprometido = documento.envioPendiente?.registro ?? documento.intencionEnvio?.registro
    const series: ReadonlyArray<{ hecha: boolean; omitida?: true }> =
      comprometido?.series ?? edicion.series
    return (
      <CierreDeSesion
        subtitulo={[
          prescripcion.nombre,
          segundos === null
            ? null
            : duracion.legado && edicion.inicio
              ? `Tiempo transcurrido: ${duracionLegible(edicion.inicio, new Date(ahora))}`
              : `Tiempo activo: ${reloj(segundos)}`,
        ]
          .filter(Boolean)
          .join(" · ")}
        resumen={{
          hechas: series.filter((s) => s.hecha).length,
          omitidas: series.filter((s) => s.omitida).length,
          pendientes: series.filter((s) => !s.hecha && !s.omitida).length,
        }}
        cierreInicial={comprometido ? (comprometido.cierre ?? null) : (edicion.cierre ?? null)}
        notas={comprometido ? (comprometido.notas ?? "") : edicion.notas}
        enviando={ocupado}
        pendiente={comprometido !== undefined}
        error={error}
        volver={() => setFase("sesion")}
        enviar={(cierre, notas) =>
          void accion(async () => {
            if (!control.documento?.intencionEnvio && !control.documento?.envioPendiente)
              await control.editar({ ...edicion, cierre, notas })
            await control.enviar()
          })
        }
        // Mismo UUID y mismo contenido: el controlador reenvía la intención guardada.
        reintentar={() => void accion(() => control.enviar())}
      />
    )
  }

  const figura = idActual === undefined ? null : (fichas.get(idActual)?.figura ?? null)
  const terminar = (): void => {
    try {
      const registro = registroParaEnviar(prescripcion, edicion)
      if (!registro.series.some((s) => s.hecha)) {
        setError("Completa al menos una serie para terminar.")
        return
      }
      setError("")
      setDialogo("terminar")
    } catch {
      setError("Revisa los valores escritos antes de terminar.")
    }
  }

  return (
    <View style={e.contenedor}>
      <CabeceraSesion
        nombre={prescripcion.nombre}
        hechas={hechasTrabajo}
        total={trabajo.length}
        segundos={segundos}
        salir={salir && (() => setDialogo("salir"))}
        terminar={documento.envioPendiente ? undefined : terminar}
      />
      {duracion.legado && <Text style={e.tenue}>Tiempo transcurrido de un registro anterior</Text>}
      {pausado && !bloqueadoPorEnvio && (
        <BotonPrincipal
          texto="Continuar entrenamiento"
          onPress={() =>
            void accion(() => control.editar(iniciarTramo(edicion, new Date().toISOString())))
          }
        />
      )}
      <Text accessibilityLiveRegion="polite" style={e.tenue}>
        {control.errorLocal
          ? "Error de guardado"
          : control.guardando > 0
            ? "Guardando…"
            : "Guardado en el dispositivo"}
        {" · "}
        {documento.intencionEnvio || documento.envioPendiente ? "Pendiente de envío" : "En curso"}
      </Text>
      {control.sinRed && (
        <Text style={e.nota}>
          {documento.intencionEnvio || documento.envioPendiente
            ? "Tu envío está guardado en este dispositivo y se reintentará al recuperar conexión."
            : "Conservas una copia local. El entrenador verá los resultados cuando confirmes el envío con conexión."}
        </Text>
      )}
      {control.errorLocal && (
        <BotonSecundario
          texto="Reintentar guardado local"
          onPress={() => void accion(() => control.reintentarGuardado())}
        />
      )}
      {control.conflicto && (
        <View>
          <AvisoDeError mensaje="Hay otra versión de esta sesión. Puedes cargarla conservando una copia de lo que has escrito." />
          <BotonPrincipal
            texto="Recuperar versión del servidor"
            onPress={() => void accion(() => control.recuperarServidor())}
            ocupado={ocupado}
          />
        </View>
      )}
      {documento.respaldo && (
        <View>
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
      {ejercicioActual && (
        <View style={e.medio}>
          {figura !== null && idActual !== undefined ? (
            <FiguraDeEjercicio
              acceso={acceso}
              ejercicioId={idActual}
              figura={figura}
              nombre={ejercicioActual.nombre}
              alto={184}
            />
          ) : (
            <Image source={fotoDeEntrenamiento} style={e.foto} accessible={false} />
          )}
          <Text style={e.nombreActual} numberOfLines={1}>
            {ejercicioActual.nombre}
          </Text>
          <View style={e.verTecnica}>
            <Enlace
              texto="Ver técnica"
              etiqueta={`Ver técnica de ${ejercicioActual.nombre}`}
              onPress={() => setTecnica(ejercicioActual)}
            />
          </View>
        </View>
      )}
      <View style={e.acciones}>
        <Enlace texto="Tengo una molestia" onPress={() => setFase("molestia")} />
        <Enlace texto="Añadir nota" onPress={() => setNota(!nota)} />
      </View>
      {documento.descansoHasta && restante > 0 && (
        <Descanso
          restante={restante}
          total={documento.descansoTotal ?? restante}
          saltar={() => void control.guardarVista({ descansoHasta: null, descansoTotal: null })}
        />
      )}
      {ejercicioActual &&
        (ejercicioActual.seccion === "calentamiento" || ejercicioActual.seccion === "final" ? (
          <ListaMarcable
            titulo={TITULOS_DE_SECCION[ejercicioActual.seccion]}
            ejercicios={[ejercicioActual]}
            series={edicion.series}
            bloqueado={bloqueado || pausado}
            marcar={marcarLista}
            cambiarPeso={(serieId, peso) => serie(serieId, { peso })}
          />
        ) : (
          <TablaSeries
            ejercicio={ejercicioActual}
            series={edicion.series}
            bloqueado={bloqueado || pausado}
            cambiar={serie}
            verTecnica={() => setTecnica(ejercicioActual)}
            enCurso={enCurso}
            anterior={anteriores.get(ejercicioActual.ejercicioId)}
          />
        ))}
      {ejercicioElegido &&
        ejercicioParaRirFinal(prescripcion, edicion, ejercicioActual?.series.at(-1)?.id ?? "") ===
          ejercicioElegido && (
          <BotonSecundario
            texto="Ir al siguiente ejercicio"
            onPress={() => void control.guardarVista({ ejercicioElegidoId: null })}
          />
        )}
      <View style={e.listaEjercicios}>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded: listaAbierta }}
          onPress={() => setListaAbierta(!listaAbierta)}
          style={e.cabeceraLista}
        >
          <Text style={e.tituloSeccion}>Ejercicios de la sesión</Text>
          <Text style={e.tenue}>{listaAbierta ? "Ocultar" : "Ver todos"}</Text>
        </Pressable>
        {listaAbierta &&
          ejerciciosOrdenados(prescripcion).map((ejercicio, indice) => (
            <Pressable
              key={ejercicio.id}
              accessibilityRole="button"
              accessibilityLabel={`${indice + 1}. ${ejercicio.nombre}, ${estadoDeEjercicio(ejercicio, edicion)}`}
              onPress={() => {
                void control.guardarVista({ ejercicioElegidoId: ejercicio.id })
                setListaAbierta(false)
              }}
              style={e.filaEjercicio}
            >
              <Text style={e.texto}>
                {indice + 1}. {ejercicio.nombre}
              </Text>
              <Text style={e.tenue}>{estadoDeEjercicio(ejercicio, edicion)}</Text>
            </Pressable>
          ))}
      </View>
      {ejercicioElegido && (
        <Enlace
          texto="Ir al siguiente pendiente"
          onPress={() => void control.guardarVista({ ejercicioElegidoId: null })}
        />
      )}
      {(nota || edicion.notas !== "") && (
        <Campo
          etiqueta="Nota para tu entrenador"
          value={edicion.notas}
          editable={!bloqueado}
          onChangeText={(notas) => cambiar({ ...edicion, notas })}
          multiline
          maxLength={2000}
        />
      )}
      {error !== "" && <AvisoDeError mensaje={error} />}
      {(documento.intencionEnvio || documento.envioPendiente) && (
        <BotonPrincipal
          texto="Reintentar envío pendiente"
          ocupado={ocupado}
          onPress={() => void accion(() => control.enviar())}
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
        titulo="¿Terminar la sesión?"
        texto={`Llevas ${hechasTrabajo} de ${trabajo.length} series. Las que faltan quedarán sin hacer.`}
        confirmar="Terminar sesión"
        cancelar="Seguir entrenando"
        alConfirmar={() => {
          setDialogo(null)
          void control.pausar(new Date().toISOString())
          setFase("cierre")
        }}
        alCancelar={() => setDialogo(null)}
      />
      <Dialogo
        visible={dialogo === "salir"}
        titulo="¿Salir de la sesión?"
        texto="Lo que has registrado se guarda y puedes seguir después."
        confirmar="Salir"
        cancelar="Seguir entrenando"
        alConfirmar={() => {
          setDialogo(null)
          void control.pausar(new Date().toISOString()).finally(() => salir?.())
        }}
        alCancelar={() => setDialogo(null)}
      />
    </View>
  )
}

const e = StyleSheet.create({
  contenedor: { gap: 24 },
  listaEjercicios: { backgroundColor: tema.superficie, borderRadius: 16, padding: 14 },
  cabeceraLista: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  filaEjercicio: {
    minHeight: 48,
    borderTopWidth: 1,
    borderColor: tema.borde,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  tituloSeccion: { color: tema.texto, fontFamily: tema.fuenteBoton, fontSize: 20 },
  tenue: { color: tema.textoTenue, fontFamily: tema.fuenteTexto, fontSize: 13 },
  texto: { color: tema.texto, fontFamily: tema.fuenteTexto, fontSize: 15, lineHeight: 21 },
  nota: { color: tema.textoTenue, fontFamily: tema.fuenteTexto, fontSize: 14, lineHeight: 20 },
  medio: { height: 184, borderRadius: 20, overflow: "hidden", backgroundColor: tema.hundido },
  foto: { width: "100%", height: "100%", resizeMode: "cover" },
  nombreActual: {
    position: "absolute",
    left: 14,
    right: 120,
    bottom: 14,
    color: tema.textoSecundario,
    fontFamily: tema.fuenteTexto,
    fontSize: 13,
  },
  verTecnica: { position: "absolute", right: 14, bottom: 2 },
  acciones: { flexDirection: "row", gap: 24 },
})
