import { useCallback, useEffect, useState } from "react"
import { useFocusEffect } from "expo-router"
import { randomUUID } from "expo-crypto"
import { AppState, Image, StyleSheet, Text, View } from "react-native"
import { ZodError } from "zod"
import type { Checkin, Ejercicio, EjercicioPrescrito, ValoresEjecutados } from "@alpha-omega/shared"
import type { ApiEntrenamiento } from "./api"
import { almacenDispositivo } from "./almacen-dispositivo"
import { RegistroControl } from "./registro-control"
import { registroParaEnviar, type EdicionRegistro } from "./registro-modelo"
import { FechaSesion } from "./fecha-sesion"
import { TablaSeries } from "./tabla-series"
import { PrescripcionVisible } from "./resultado"
import { VerTecnica } from "./ver-tecnica"
import { CheckIn } from "./sesion/check-in"
import { CierreDeSesion } from "./sesion/cierre"
import { Dialogo, Enlace } from "./sesion/controles"
import {
  duracionLegible,
  porSecciones,
  proximaVez,
  reloj,
  segundosDeDescanso,
  serieEnCurso,
  seriesDeTrabajo,
} from "./sesion/modelo"
import { RegistrarMolestiaPantalla, type LugarDeMolestia } from "./sesion/molestia"
import { CabeceraSesion, Descanso, ListaMarcable } from "./sesion/partes"
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
  const [descanso, setDescanso] = useState<{ hasta: number; total: number } | null>(null)
  const [ahora, setAhora] = useState(() => Date.now())
  const [anteriores, setAnteriores] = useState<Map<string, ValoresEjecutados>>(new Map())
  const [conMolestia, setConMolestia] = useState<Set<string>>(new Set())
  const [fichas, setFichas] = useState<Map<string, Ejercicio>>(new Map())
  const [nota, setNota] = useState(false)
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
          await c.sincronizar()
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
        c.cerrar()
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

  // «Anterior» y molestias de esta sesión. Sin red, la sesión sigue sin ellos.
  useEffect(() => {
    let vigente = true
    api
      .anteriores(id)
      .then((listado) => {
        if (vigente)
          setAnteriores(new Map(listado.anteriores.map((a) => [a.ejercicioId, a.valores])))
      })
      .catch(() => undefined)
    api
      .molestias(cuenta)
      .then((listado) => {
        if (!vigente) return
        setConMolestia(
          new Set(
            listado.molestias
              .filter((m) => m.sesionId === id && m.ejercicioPrescritoId !== null)
              .map((m) => m.ejercicioPrescritoId!),
          ),
        )
      })
      .catch(() => undefined)
    return () => {
      vigente = false
    }
  }, [api, id, cuenta])

  const documento = control?.documento
  const enCurso = documento ? serieEnCurso(documento.sesion.prescripcion, documento.edicion) : null
  const ejercicioActual = documento?.sesion.prescripcion.ejercicios.find((e) =>
    e.series.some((s) => s.id === enCurso),
  )

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
        <PrescripcionVisible
          prescripcion={documento.resultado.prescripcion}
          resultado={documento.resultado}
        />
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
  const bloqueado = ocupado || control.conflicto || documento.envioPendiente !== null
  const cambiar = (nueva: EdicionRegistro): void => {
    setError("")
    // La sesión empieza con la primera anotación si no pasó por el check-in.
    const conInicio = nueva.inicio ? nueva : { ...nueva, inicio: new Date().toISOString() }
    void control
      .editar(conInicio)
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
        setDescanso({ hasta: Date.now() + segundos * 1000, total: segundos })
    }
    cambiar(nueva)
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
  const segundos = edicion.inicio ? (ahora - Date.parse(edicion.inicio)) / 1000 : null
  const restante = descanso === null ? 0 : Math.max(0, Math.round((descanso.hasta - ahora) / 1000))

  if (!empezada && !documento.envioPendiente)
    return (
      <CheckIn
        nombre={prescripcion.nombre}
        volver={() => salir?.()}
        empezar={(checkin: Checkin) =>
          cambiar({ ...edicion, checkin, inicio: new Date().toISOString() })
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
          const molestia = await api.avisarMolestia(id, datos)
          if (molestia.ejercicioPrescritoId !== null)
            setConMolestia((actual) => new Set(actual).add(molestia.ejercicioPrescritoId!))
        }}
        volver={() => setFase("sesion")}
      />
    )
  }

  if (fase === "cierre")
    return (
      <CierreDeSesion
        subtitulo={[
          prescripcion.nombre,
          edicion.inicio ? duracionLegible(edicion.inicio, new Date(ahora)) : null,
        ]
          .filter(Boolean)
          .join(" · ")}
        proxima={proximaVez(prescripcion, edicion, conMolestia)}
        notas={edicion.notas}
        enviando={ocupado}
        error={error}
        volver={() => setFase("sesion")}
        enviar={(cierre, notas) =>
          void accion(async () => {
            await control.editar({ ...edicion, cierre, notas })
            await control.enviar()
          })
        }
      />
    )

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
      {/* El diseño no enseña el guardado: solo se avisa cuando algo no va bien. */}
      {control.errorLocal && (
        <Text accessibilityLiveRegion="polite" style={e.tenue}>
          No guardado en el dispositivo
        </Text>
      )}
      {control.sinRed && (
        <Text style={e.nota}>
          Conservas una copia local. El entrenador verá los resultados cuando confirmes el envío con
          conexión.
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
            la misma unidad.
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
      {descanso !== null && restante > 0 && (
        <Descanso restante={restante} total={descanso.total} saltar={() => setDescanso(null)} />
      )}
      {porSecciones(prescripcion).map((grupo) =>
        grupo.seccion === "calentamiento" || grupo.seccion === "final" ? (
          <ListaMarcable
            key={grupo.seccion}
            titulo={TITULOS_DE_SECCION[grupo.seccion]}
            ejercicios={grupo.ejercicios}
            series={edicion.series}
            bloqueado={bloqueado}
            marcar={marcarLista}
          />
        ) : (
          <View key={grupo.seccion} style={e.seccion}>
            {grupo.seccion === "circuito" && (
              <Text style={e.tituloSeccion} accessibilityRole="header">
                {prescripcion.circuito?.nombre ?? TITULOS_DE_SECCION.circuito}
                {prescripcion.circuito ? ` · ${prescripcion.circuito.vueltas} vueltas` : ""}
              </Text>
            )}
            {grupo.ejercicios.map((ejercicio) => (
              <TablaSeries
                key={ejercicio.id}
                ejercicio={ejercicio}
                series={edicion.series}
                bloqueado={bloqueado}
                cambiar={serie}
                verTecnica={() => setTecnica(ejercicio)}
                enCurso={enCurso}
                anterior={anteriores.get(ejercicio.ejercicioId)}
              />
            ))}
          </View>
        ),
      )}
      <View style={e.acciones}>
        <Enlace texto="Añadir nota" onPress={() => setNota(!nota)} />
        <Enlace texto="Añadir molestia" onPress={() => setFase("molestia")} />
      </View>
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
      <FechaSesion
        agenda={documento.sesion.agenda}
        api={api}
        actualizado={() => control.actualizar()}
      />
      {error !== "" && <AvisoDeError mensaje={error} />}
      {documento.envioPendiente && (
        <BotonPrincipal
          texto="Confirmar envío pendiente"
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
          salir?.()
        }}
        alCancelar={() => setDialogo(null)}
      />
    </View>
  )
}

const e = StyleSheet.create({
  contenedor: { gap: 24 },
  seccion: { gap: 32 },
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
