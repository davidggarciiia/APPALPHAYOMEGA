import { useCallback, useState } from "react"
import { useFocusEffect } from "expo-router"
import { randomUUID } from "expo-crypto"
import { AppState, Modal, Pressable, Text, TextInput, View } from "react-native"
import { ZodError } from "zod"
import type { ApiEntrenamiento } from "./api"
import { almacenDispositivo } from "./almacen-dispositivo"
import { RegistroControl } from "./registro-control"
import { registroParaEnviar, type EdicionRegistro } from "./registro-modelo"
import { FechaSesion } from "./fecha-sesion"
import { PrescripcionVisible, valoresLegibles } from "./resultado"
import { AvisoDeError, BotonPrincipal, BotonSecundario, Campo } from "../componentes/formulario"
import { tema } from "../tema"

export function RegistroCliente({
  cuenta,
  id,
  api,
}: {
  cuenta: string
  id: string
  api: ApiEntrenamiento
}): React.JSX.Element {
  const [control, setControl] = useState<RegistroControl | null>(null)
  const [, repintar] = useState(0)
  const [error, setError] = useState("")
  const [intento, setIntento] = useState(0)
  const [resumen, setResumen] = useState(false)
  const [ocupado, setOcupado] = useState(false)
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
          <Text style={{ color: tema.texto }}>Abriendo entrenamiento…</Text>
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
              <Text key={s.serieId} style={{ color: tema.texto }}>
                Copia · serie {i + 1}: {s.peso || "—"} kg · {s.valor || "—"}
              </Text>
            ))}
            <Text style={{ color: tema.texto }}>{documento.respaldo.edicion.notas}</Text>
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
    <View style={{ gap: 18 }}>
      <Text style={{ color: tema.texto, fontSize: 28, fontWeight: "800" }}>
        {documento.sesion.prescripcion.nombre}
      </Text>
      <FechaSesion
        agenda={documento.sesion.agenda}
        api={api}
        actualizado={() => control.actualizar()}
      />
      <Text accessibilityLiveRegion="polite" style={{ color: tema.textoTenue }}>
        {control.errorLocal
          ? "No guardado en el dispositivo"
          : control.guardando
            ? "Guardando en el dispositivo…"
            : documento.secuencia > documento.sincronizada
              ? "Guardado en este dispositivo · pendiente de sincronizar"
              : "Borrador privado actualizado"}
      </Text>
      {control.sinRed && (
        <Text style={{ color: tema.textoTenue }}>
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
          <Text style={{ color: tema.textoTenue }}>
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
              <Text key={s.serieId} style={{ color: tema.textoTenue }}>
                Copia · serie {i + 1}: {s.peso || "—"} kg · {s.valor || "—"}
              </Text>
            ))}
        </View>
      )}
      <Text style={{ color: tema.texto }}>
        {hechas} de {documento.edicion.series.length} series completadas
      </Text>
      <View style={{ height: 6, backgroundColor: tema.borde, borderRadius: 3 }}>
        <View
          style={{
            height: 6,
            borderRadius: 3,
            backgroundColor: tema.texto,
            width: `${(hechas / documento.edicion.series.length) * 100}%`,
          }}
        />
      </View>
      {documento.sesion.prescripcion.ejercicios.map((e) => (
        <View
          key={e.id}
          style={{
            borderWidth: 1,
            borderColor: tema.borde,
            borderRadius: 18,
            padding: 12,
            gap: 12,
          }}
        >
          <Text style={{ color: tema.texto, fontSize: 19, fontWeight: "700" }}>{e.nombre}</Text>
          {e.indicaciones && <Text style={{ color: tema.textoTenue }}>{e.indicaciones}</Text>}
          {e.series.map((s, n) => {
            const real = documento.edicion.series.find((r) => r.serieId === s.id)!
            const unidad = s.tipoMedicion === "tiempo" ? "Segundos" : "Repeticiones"
            return (
              <View key={s.id} style={{ gap: 6 }}>
                <Text style={{ color: tema.textoTenue, opacity: 0.75 }}>
                  Serie {n + 1} · Objetivo {valoresLegibles(s)}
                </Text>
                <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
                  <TextInput
                    accessibilityLabel={`Peso — ${e.nombre}, serie ${n + 1}`}
                    editable={!bloqueado}
                    value={real.peso}
                    onChangeText={(peso) => serie(s.id, { peso })}
                    placeholder={s.pesoKg === null ? "kg (opc.)" : `${s.pesoKg} kg`}
                    placeholderTextColor={tema.textoTenue}
                    keyboardType="decimal-pad"
                    maxLength={30}
                    style={{
                      flex: 1,
                      minHeight: 44,
                      borderWidth: 1,
                      borderColor: tema.borde,
                      color: tema.texto,
                      borderRadius: 10,
                      padding: 10,
                    }}
                  />
                  <TextInput
                    accessibilityLabel={`${unidad} — ${e.nombre}, serie ${n + 1}`}
                    editable={!bloqueado}
                    value={real.valor}
                    onChangeText={(valor) => serie(s.id, { valor })}
                    placeholder={`${s.tipoMedicion === "tiempo" ? s.segundos : s.repeticiones} ${s.tipoMedicion === "tiempo" ? "s" : "rep"}`}
                    placeholderTextColor={tema.textoTenue}
                    keyboardType="number-pad"
                    maxLength={30}
                    style={{
                      flex: 1,
                      minHeight: 44,
                      borderWidth: 1,
                      borderColor: tema.borde,
                      color: tema.texto,
                      borderRadius: 10,
                      padding: 10,
                    }}
                  />
                  <Pressable
                    accessibilityRole="checkbox"
                    accessibilityLabel={`Hecha — ${e.nombre}, serie ${n + 1}`}
                    accessibilityState={{ checked: real.hecha, disabled: bloqueado }}
                    disabled={bloqueado}
                    onPress={() => serie(s.id, { hecha: !real.hecha })}
                    style={{
                      minWidth: 44,
                      minHeight: 44,
                      alignItems: "center",
                      justifyContent: "center",
                      borderWidth: 1,
                      borderColor: tema.texto,
                      borderRadius: 10,
                      backgroundColor: real.hecha ? tema.texto : tema.superficie,
                    }}
                  >
                    <Text
                      style={{ fontSize: 22, color: real.hecha ? tema.superficie : tema.texto }}
                    >
                      {real.hecha ? "✓" : "○"}
                    </Text>
                  </Pressable>
                </View>
              </View>
            )
          })}
        </View>
      ))}
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
            backgroundColor: "rgba(0,0,0,.65)",
            padding: 24,
          }}
        >
          <View
            style={{ backgroundColor: tema.superficie, padding: 24, borderRadius: 18, gap: 14 }}
          >
            <Text style={{ color: tema.texto, fontSize: 24, fontWeight: "700" }}>
              Enviar al entrenador
            </Text>
            <Text style={{ color: tema.texto }}>
              {hechas} series hechas · {documento.edicion.series.length - hechas} omitidas.
            </Text>
            <Text style={{ color: tema.textoTenue }}>
              Solo se enviarán los valores de las series marcadas. Después, el entrenamiento quedará
              cerrado.
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
          </View>
        </View>
      </Modal>
    </View>
  )
}
