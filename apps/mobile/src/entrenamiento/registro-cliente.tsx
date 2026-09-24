import { useCallback, useState } from "react"
import { useFocusEffect } from "expo-router"
import { randomUUID } from "expo-crypto"
import { AppState, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native"
import { ZodError } from "zod"
import type { EjercicioPrescrito } from "@alpha-omega/shared"
import type { ApiEntrenamiento } from "./api"
import { almacenDispositivo } from "./almacen-dispositivo"
import { RegistroControl } from "./registro-control"
import { registroParaEnviar, type EdicionRegistro } from "./registro-modelo"
import { FechaSesion } from "./fecha-sesion"
import { TablaSeries } from "./tabla-series"
import { PrescripcionVisible } from "./resultado"
import { VerTecnica } from "./ver-tecnica"
import { useAccesoAFiguras } from "../catalogo-ejercicios/figura-ejercicio"
import { useCatalogo } from "../catalogo-ejercicios/use-catalogo"
import { AvisoDeError, BotonPrincipal, BotonSecundario, Campo } from "../componentes/formulario"
import { Icono } from "../componentes/iconos"
import { degradadoOro, tema } from "../tema"

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
  const [resumen, setResumen] = useState(false)
  const [ocupado, setOcupado] = useState(false)
  const [tecnica, setTecnica] = useState<EjercicioPrescrito | null>(null)
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
      const reloj = setInterval(() => void comprobar(), 5000)
      const actividad = AppState.addEventListener("change", (s) => {
        if (s === "active") void comprobar()
      })
      return () => {
        vigente = false
        c.cerrar()
        clearInterval(reloj)
        actividad.remove()
      }
    }, [cuenta, id, api, intento]),
  )
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
  const documento = control?.documento
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
      <View style={{ gap: 16 }}>
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
  const bloqueado = resumen || ocupado || control.conflicto || documento.envioPendiente !== null
  const cambiar = (edicion: EdicionRegistro): void => {
    setError("")
    void control
      .editar(edicion)
      .catch(() =>
        setError(
          "No se pudo guardar en este dispositivo. Mantén esta pantalla abierta y reintenta el guardado.",
        ),
      )
  }
  const serie = (serieId: string, cambio: Partial<EdicionRegistro["series"][number]>): void => {
    const edicion = {
      ...documento.edicion,
      series: documento.edicion.series.map((s) =>
        s.serieId === serieId ? { ...s, ...cambio } : s,
      ),
    }
    if (cambio.hecha) {
      try {
        registroParaEnviar(documento.sesion.prescripcion, edicion)
      } catch {
        setError("Escribe los valores realizados y el peso indicado antes de marcar la serie.")
        return
      }
    }
    cambiar(edicion)
  }
  const revisar = (): void => {
    try {
      const registro = registroParaEnviar(documento.sesion.prescripcion, documento.edicion)
      if (!registro.series.some((s) => s.hecha)) {
        setError("Completa al menos una serie para enviar.")
        return
      }
      setError("")
      setResumen(true)
    } catch {
      setError("Revisa los valores escritos antes de terminar.")
    }
  }
  const hechas = documento.edicion.series.filter((s) => s.hecha).length
  return (
    <View style={e.contenedor}>
      <View style={e.cabecera}>
        <View style={e.barra}>
          {salir && (
            <Pressable
              style={e.atras}
              accessibilityRole="button"
              accessibilityLabel="Salir de la sesión"
              onPress={salir}
            >
              <Icono nombre="atras" color={tema.texto} />
            </Pressable>
          )}
          <View style={e.hueco} />
          {!documento.envioPendiente && (
            <Pressable
              style={({ pressed }) => [e.terminar, pressed && e.pulsado]}
              accessibilityRole="button"
              accessibilityLabel="Terminar"
              disabled={ocupado}
              onPress={revisar}
            >
              <Text style={e.textoTerminar}>Terminar</Text>
            </Pressable>
          )}
        </View>
        <Text accessibilityRole="header" style={e.titulo}>
          {documento.sesion.prescripcion.nombre}
        </Text>
        <View style={e.progresoTexto}>
          <Text style={e.tenue}>
            {hechas} de {documento.edicion.series.length} series
          </Text>
        </View>
        <View
          style={e.pista}
          accessibilityRole="progressbar"
          accessibilityLabel="Series hechas"
          accessibilityValue={{ min: 0, max: documento.edicion.series.length, now: hechas }}
        >
          <View
            style={[e.relleno, { width: `${(hechas / documento.edicion.series.length) * 100}%` }]}
          />
        </View>
      </View>
      <Text accessibilityLiveRegion="polite" style={e.tenue}>
        {control.errorLocal
          ? "No guardado en el dispositivo"
          : control.guardando
            ? "Guardando en el dispositivo…"
            : documento.secuencia > documento.sincronizada
              ? "Guardado en este dispositivo · pendiente de sincronizar"
              : "Borrador privado actualizado"}
      </Text>
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
          {documento.respaldo.edicion.series
            .filter((s) => s.valor || s.peso)
            .map((s, i) => (
              <Text key={s.serieId} style={e.nota}>
                Copia · serie {i + 1}: {s.peso || "—"} kg · {s.valor || "—"}
              </Text>
            ))}
        </View>
      )}
      {documento.sesion.prescripcion.ejercicios.map((ejercicio) => (
        <TablaSeries
          key={ejercicio.id}
          ejercicio={ejercicio}
          series={documento.edicion.series}
          bloqueado={bloqueado}
          cambiar={serie}
          verTecnica={() => setTecnica(ejercicio)}
        />
      ))}
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
      <FechaSesion
        agenda={documento.sesion.agenda}
        api={api}
        actualizado={() => control.actualizar()}
      />
      <Campo
        etiqueta="Notas del entrenamiento"
        value={documento.edicion.notas}
        editable={!bloqueado}
        onChangeText={(notas) => cambiar({ ...documento.edicion, notas })}
        multiline
        maxLength={2000}
      />
      {error !== "" && <AvisoDeError mensaje={error} />}
      {documento.envioPendiente ? (
        <BotonPrincipal
          texto="Confirmar envío pendiente"
          ocupado={ocupado}
          onPress={() => void accion(() => control.enviar())}
        />
      ) : (
        <>
          <BotonSecundario
            texto="Sincronizar borrador privado"
            ocupado={ocupado}
            onPress={() => void accion(() => control.sincronizar())}
          />
          <BotonPrincipal texto="Terminar entrenamiento" ocupado={ocupado} onPress={revisar} />
        </>
      )}
      <Modal
        visible={resumen && !documento.resultado}
        transparent
        onRequestClose={() => {
          if (!ocupado) setResumen(false)
        }}
      >
        <View
          style={{
            flex: 1,
            justifyContent: "center",
            backgroundColor: "rgba(6,5,4,.7)",
            padding: 24,
          }}
        >
          <View
            style={{
              backgroundColor: tema.superficie,
              borderRadius: 20,
              maxHeight: "95%",
              width: "100%",
              maxWidth: 520,
              alignSelf: "center",
            }}
          >
            <ScrollView contentContainerStyle={{ padding: 24, gap: 14 }}>
              <Text
                style={{
                  color: tema.texto,
                  fontSize: 34,
                  lineHeight: 38,
                  fontFamily: tema.fuenteTitulo,
                  textTransform: "uppercase",
                }}
              >
                Enviar al entrenador
              </Text>
              <Text style={e.texto}>
                {hechas} series hechas · {documento.edicion.series.length - hechas} omitidas.
              </Text>
              <Text style={e.nota}>
                Solo se enviarán los valores de las series marcadas. Después, el entrenamiento
                quedará cerrado.
              </Text>
              {error !== "" && <AvisoDeError mensaje={error} />}
              <BotonPrincipal
                texto="Confirmar y enviar"
                ocupado={ocupado}
                onPress={() => void accion(() => control.enviar())}
              />
              <BotonSecundario
                texto="Seguir entrenando"
                ocupado={ocupado}
                onPress={() => setResumen(false)}
              />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  )
}

const e = StyleSheet.create({
  contenedor: { gap: 24 },
  cabecera: { gap: 12 },
  barra: { flexDirection: "row", alignItems: "center", gap: 12 },
  hueco: { flex: 1 },
  atras: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: tema.superficie,
    alignItems: "center",
    justifyContent: "center",
  },
  terminar: {
    ...degradadoOro,
    height: 44,
    paddingHorizontal: 14,
    borderRadius: 12,
    justifyContent: "center",
  },
  pulsado: { opacity: 0.8 },
  textoTerminar: { color: tema.sobreAcento, fontFamily: tema.fuenteBoton, fontSize: 15 },
  titulo: {
    color: tema.texto,
    fontFamily: tema.fuenteTitulo,
    fontSize: 34,
    lineHeight: 38,
    textTransform: "uppercase",
  },
  progresoTexto: { flexDirection: "row", justifyContent: "flex-end" },
  tenue: { color: tema.textoTenue, fontFamily: tema.fuenteTexto, fontSize: 13 },
  texto: { color: tema.texto, fontFamily: tema.fuenteTexto, fontSize: 15, lineHeight: 21 },
  nota: { color: tema.textoTenue, fontFamily: tema.fuenteTexto, fontSize: 14, lineHeight: 20 },
  pista: { height: 3, backgroundColor: tema.borde, borderRadius: 2, overflow: "hidden" },
  relleno: { height: 3, ...degradadoOro },
})
