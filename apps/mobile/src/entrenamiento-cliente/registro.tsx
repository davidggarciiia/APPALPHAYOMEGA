import { useRouter } from "expo-router"
import { useState } from "react"
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"

import { Aviso, Cabecera } from "../componentes/cabecera"
import { BotonPrincipal, BotonSecundario } from "../componentes/formulario"
import { ResultadoSesion } from "../componentes/resultado-sesion"
import { conMayuscula, fechaLarga, momento } from "../lib/fechas"
import { useSesion } from "../sesion"
import { tema } from "../tema"

import type { EntradaSerie } from "./copia-local"
import { CabeceraDeSeries, FilaSerie } from "./fila-serie"
import type { Escritura, Instantanea, Red, SesionEnCurso } from "./sesion-en-curso"
import { useSesionEnCurso } from "./use-sesion-en-curso"
import { ENTRADA_VACIA, recuento } from "./valores"

function textoDeGuardado(escritura: Escritura, red: Red): { texto: string; error: boolean } {
  if (escritura === "error") {
    return { texto: "No se ha podido guardar en el móvil", error: true }
  }
  if (escritura === "guardando") {
    return { texto: "Guardando…", error: false }
  }
  if (red === "sin-conexion") {
    return { texto: "Guardado en el móvil · sin conexión", error: false }
  }
  if (red === "pendiente" || red === "sincronizando") {
    return { texto: "Guardado en el móvil", error: false }
  }
  return { texto: "Guardado", error: false }
}

/**
 * El entreno activo: registrar serie a serie y enviar al terminar.
 *
 * Cada cambio se guarda en el móvil al momento y se sincroniza en privado; el
 * entrenador no ve nada hasta que se pulsa «Enviar entrenamiento».
 */
export function RegistroDeSesion({ sesionId }: { sesionId: string }): React.JSX.Element {
  const { estado: sesion } = useSesion()
  const router = useRouter()
  const cuenta = sesion.fase === "dentro" || sesion.fase === "local" ? sesion.usuario.id : null
  const { estado, instantanea, reintentar } = useSesionEnCurso(cuenta, sesionId)

  if (estado.fase === "cargando" || (estado.fase === "lista" && instantanea === null)) {
    return (
      <SafeAreaView style={estilos.pantalla}>
        <Cabecera titulo="ENTRENO" onVolver={() => router.back()} />
        <View style={estilos.centrado}>
          <ActivityIndicator color={tema.oro} accessibilityLabel="Abriendo la sesión" />
        </View>
      </SafeAreaView>
    )
  }

  if (estado.fase === "error") {
    return (
      <SafeAreaView style={estilos.pantalla}>
        <Cabecera titulo="ENTRENO" onVolver={() => router.back()} />
        <View style={estilos.centrado}>
          <Text style={estilos.mensaje}>{estado.falta.texto}</Text>
          {estado.falta.reintentable && <BotonSecundario texto="REINTENTAR" onPress={reintentar} />}
        </View>
      </SafeAreaView>
    )
  }

  return (
    <Contenido
      sesion={estado.sesion}
      instantanea={instantanea as Instantanea}
      volver={() => router.back()}
    />
  )
}

function Contenido({
  sesion,
  instantanea,
  volver,
}: {
  sesion: SesionEnCurso
  instantanea: Instantanea
  volver: () => void
}): React.JSX.Element {
  const [confirmando, setConfirmando] = useState(false)
  const [instrucciones, setInstrucciones] = useState<string | null>(null)
  const { copia } = instantanea
  const { prescripcion, agenda } = copia.sesion
  const fichas = new Map((copia.ejercicios ?? []).map((e) => [e.id, e]))

  if (copia.resultado !== null) {
    return (
      <SafeAreaView style={estilos.pantalla}>
        <Cabecera titulo={prescripcion.nombre.toUpperCase()} onVolver={volver} />
        <ScrollView contentContainerStyle={estilos.contenido}>
          <Aviso tono="exito">
            <Text style={estilos.enviado}>ENTRENAMIENTO ENVIADO</Text>
            <Text style={estilos.textoAviso}>
              {`Programado el ${fechaLarga(agenda.fechaActual)} · enviado el ${momento(
                copia.resultado.enviadoEn,
              )}. Tu entrenador ya lo puede ver.`}
            </Text>
          </Aviso>
          <ResultadoSesion resultado={copia.resultado} />
        </ScrollView>
      </SafeAreaView>
    )
  }

  const { hechas, total } = recuento(prescripcion, copia.entradas)
  const editable =
    copia.envio === null && !instantanea.enviando && !copia.anulada && copia.conflicto === null
  const guardado = textoDeGuardado(instantanea.escritura, instantanea.red)

  const cambiarSerie = (serieId: string, entrada: EntradaSerie): void => {
    void sesion.editar((entradas, notas) => ({
      entradas: { ...entradas, [serieId]: entrada },
      notas,
    }))
  }

  const enviar = async (): Promise<void> => {
    try {
      await sesion.enviar()
      setConfirmando(false)
    } catch {
      // El motivo queda en `errorDeEnvio` y se enseña abajo.
    }
  }

  return (
    <SafeAreaView style={estilos.pantalla}>
      <KeyboardAvoidingView
        style={estilos.flexible}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <Cabecera
          titulo={prescripcion.nombre.toUpperCase()}
          onVolver={volver}
          derecha={
            <Text
              style={[estilos.guardado, guardado.error && estilos.guardadoError]}
              accessibilityLiveRegion="polite"
            >
              {guardado.texto}
            </Text>
          }
        />
        <ScrollView
          contentContainerStyle={estilos.contenido}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          <Text style={estilos.fecha}>{conMayuscula(fechaLarga(agenda.fechaActual))}</Text>

          {copia.anulada && (
            <Aviso tono="error">
              <Text style={estilos.textoAviso}>
                Tu entrenador ha anulado esta sesión. Lo que registraste sigue en este móvil, pero
                ya no se puede enviar.
              </Text>
              <BotonSecundario
                texto="DESCARTAR ESTA SESIÓN"
                onPress={() => void sesion.descartar().then(volver)}
              />
            </Aviso>
          )}

          {copia.conflicto !== null && (
            <Aviso tono="error">
              <Text style={estilos.textoAviso}>{copia.conflicto.mensaje}</Text>
              <Text style={estilos.detalleAviso}>
                Tu versión no se pierde: si eliges la del servidor, la de este móvil queda guardada
                como respaldo.
              </Text>
              <BotonPrincipal
                texto="USAR LA VERSIÓN DEL SERVIDOR"
                onPress={() => void sesion.resolverConflicto("servidor")}
              />
              {copia.conflicto.codigo !== "prescripcion_cambiada" && (
                <BotonSecundario
                  texto="MANTENER LA DE ESTE MÓVIL"
                  onPress={() => void sesion.resolverConflicto("mia")}
                />
              )}
            </Aviso>
          )}

          {copia.respaldo !== null && copia.conflicto === null && (
            <Text style={estilos.detalleAviso}>
              Hay una versión anterior de este entreno guardada como respaldo en el móvil.
            </Text>
          )}

          {prescripcion.ejercicios.map((ejercicio) => {
            const ficha = fichas.get(ejercicio.ejercicioId)
            const porTiempo = ejercicio.series.every((s) => s.tipoMedicion === "tiempo")
            return (
              <View key={ejercicio.id} style={estilos.tarjeta}>
                <View style={estilos.filaTitulo}>
                  <Text style={estilos.ejercicio}>{ejercicio.nombre}</Text>
                  {ficha !== undefined && (
                    <Pressable
                      onPress={() =>
                        setInstrucciones((v) => (v === ejercicio.id ? null : ejercicio.id))
                      }
                      accessibilityRole="button"
                      hitSlop={8}
                    >
                      <Text style={estilos.enlace}>
                        {instrucciones === ejercicio.id ? "OCULTAR" : "CÓMO SE HACE"}
                      </Text>
                    </Pressable>
                  )}
                </View>
                {instrucciones === ejercicio.id && ficha !== undefined && (
                  <Text style={estilos.instrucciones}>{ficha.instrucciones}</Text>
                )}
                {ejercicio.indicaciones !== null && (
                  <Text style={estilos.indicaciones}>{ejercicio.indicaciones}</Text>
                )}
                <CabeceraDeSeries porTiempo={porTiempo} />
                {ejercicio.series.map((serie, indice) => (
                  <FilaSerie
                    key={serie.id}
                    numero={indice + 1}
                    serie={serie}
                    entrada={copia.entradas[serie.id] ?? ENTRADA_VACIA}
                    editable={editable}
                    alCambiar={(entrada) => cambiarSerie(serie.id, entrada)}
                  />
                ))}
              </View>
            )
          })}

          <Text style={estilos.etiqueta}>NOTAS (OPCIONAL)</Text>
          <TextInput
            style={estilos.notas}
            value={copia.notas}
            onChangeText={(notas) => void sesion.editar((entradas) => ({ entradas, notas }))}
            placeholder="¿Algo que quieras contarle a tu entrenador?"
            placeholderTextColor={tema.textoTenue}
            multiline
            maxLength={2000}
            editable={editable}
            accessibilityLabel="Notas para tu entrenador, opcional"
          />

          {!copia.anulada && !confirmando && copia.envio === null && (
            <BotonPrincipal
              texto="ENVIAR ENTRENAMIENTO"
              onPress={() => setConfirmando(true)}
              ocupado={instantanea.enviando}
            />
          )}

          {(confirmando || copia.envio !== null) && (
            <Aviso tono={hechas === 0 ? "error" : "info"}>
              <Text style={estilos.resumen}>
                {`Has hecho ${String(hechas)} de ${String(total)} series.`}
              </Text>
              {hechas === 0 ? (
                <Text style={estilos.textoAviso}>
                  Marca al menos una serie como hecha para poder enviar.
                </Text>
              ) : hechas < total ? (
                <Text style={estilos.textoAviso}>
                  {`Te ${total - hechas === 1 ? "falta 1 serie" : `faltan ${String(total - hechas)} series`}. Puedes volver y completarlas o enviar lo que has hecho: las demás constarán como no realizadas.`}
                </Text>
              ) : (
                <Text style={estilos.textoAviso}>
                  Todo hecho. Tu entrenador lo verá al momento.
                </Text>
              )}
              {instantanea.errorDeEnvio !== null && (
                <Text style={estilos.error} accessibilityRole="alert">
                  {instantanea.errorDeEnvio}
                </Text>
              )}
              {hechas > 0 && (
                <BotonPrincipal
                  texto={
                    copia.envio !== null
                      ? "REINTENTAR EL ENVÍO"
                      : hechas < total
                        ? "ENVIAR LO QUE HE HECHO"
                        : "ENVIAR"
                  }
                  onPress={() => void enviar()}
                  ocupado={instantanea.enviando}
                />
              )}
              <BotonSecundario
                texto="VOLVER AL ENTRENO"
                onPress={() => {
                  setConfirmando(false)
                  void sesion.seguirEditando()
                }}
              />
            </Aviso>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const estilos = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: tema.fondo },
  flexible: { flex: 1 },
  centrado: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 16 },
  mensaje: { color: tema.texto, fontSize: 15, textAlign: "center" },
  contenido: { padding: 20, gap: 14, paddingBottom: 48 },
  fecha: { color: tema.oroSuave, fontSize: 13, letterSpacing: 1 },
  guardado: {
    color: tema.textoTenue,
    fontSize: 11,
    marginBottom: 2,
    maxWidth: 170,
    textAlign: "right",
  },
  guardadoError: { color: tema.error },
  tarjeta: {
    backgroundColor: tema.superficie,
    borderColor: tema.borde,
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    gap: 8,
  },
  filaTitulo: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  ejercicio: { color: tema.texto, fontSize: 17, fontWeight: "600", flexShrink: 1 },
  enlace: { color: tema.oro, fontSize: 10, fontWeight: "700", letterSpacing: 1.5 },
  instrucciones: { color: tema.texto, fontSize: 13, lineHeight: 19 },
  indicaciones: { color: tema.oroSuave, fontSize: 13, fontStyle: "italic" },
  etiqueta: { color: tema.oroSuave, fontSize: 11, letterSpacing: 2, marginTop: 6 },
  notas: {
    backgroundColor: tema.superficie,
    borderColor: tema.borde,
    borderWidth: 1,
    borderRadius: 10,
    color: tema.texto,
    fontSize: 15,
    minHeight: 80,
    padding: 12,
    textAlignVertical: "top",
  },
  resumen: { color: tema.texto, fontSize: 16, fontWeight: "700" },
  textoAviso: { color: tema.texto, fontSize: 13, lineHeight: 19 },
  detalleAviso: { color: tema.textoTenue, fontSize: 12, lineHeight: 17 },
  enviado: { color: tema.oro, fontSize: 14, fontWeight: "700", letterSpacing: 2 },
  error: { color: tema.error, fontSize: 13 },
})
