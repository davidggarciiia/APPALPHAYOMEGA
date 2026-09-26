import { useRouter } from "expo-router"
import { useRef, useState } from "react"
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import type { EjercicioPrescrito } from "@alpha-omega/shared"

import {
  BarraDeProgreso,
  BotonAtras,
  BotonOro,
  BotonSobrio,
  BrilloDeFondo,
  EnlaceOro,
  Tarjeta,
  texto,
} from "../componentes/diseno"
import { ResultadoSesion } from "../componentes/resultado-sesion"
import { TarjetaDeFigura } from "../figuras/tarjeta-de-figura"
import { conMayuscula, fechaLarga, momento } from "../lib/fechas"
import { useSesion } from "../sesion"
import { fuentes, tema } from "../tema"

import type { EntradaSerie } from "./copia-local"
import { CabeceraDeSeries, FilaSerie } from "./fila-serie"
import type { Escritura, Instantanea, Red, SesionEnCurso } from "./sesion-en-curso"
import { useSesionEnCurso } from "./use-sesion-en-curso"
import { ENTRADA_VACIA, formatearNumero, recuento, serieRegistrada } from "./valores"

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

/** «3 × 10 · 40 kg» o «2 × 45 s», a partir de lo prescrito. */
function resumenDePrescripcion(ejercicio: EjercicioPrescrito): string {
  const primera = ejercicio.series[0]
  if (primera === undefined) {
    return ""
  }
  const iguales = ejercicio.series.every(
    (serie) =>
      serie.tipoMedicion === primera.tipoMedicion &&
      serie.pesoKg === primera.pesoKg &&
      (serie.tipoMedicion === "repeticiones" ? serie.repeticiones : serie.segundos) ===
        (primera.tipoMedicion === "repeticiones" ? primera.repeticiones : primera.segundos),
  )
  const valor =
    primera.tipoMedicion === "repeticiones"
      ? `${String(primera.repeticiones)}`
      : `${String(primera.segundos)} s`
  const carga = primera.pesoKg === null ? "sin carga" : `${formatearNumero(primera.pesoKg)} kg`
  return iguales
    ? `${String(ejercicio.series.length)} × ${valor} · ${carga}`
    : `${String(ejercicio.series.length)} series`
}

function Esqueleto({
  children,
  volver,
}: {
  children: React.ReactNode
  volver: () => void
}): React.JSX.Element {
  return (
    <View style={estilos.pantalla}>
      <BrilloDeFondo />
      <SafeAreaView style={estilos.flexible}>
        <View style={estilos.barraSuperior}>
          <BotonAtras onPress={volver} />
        </View>
        {children}
      </SafeAreaView>
    </View>
  )
}

/**
 * El entreno activo: registrar serie a serie y enviar al terminar. Sigue el
 * diseño de Sesion.dc.html.
 *
 * Cada cambio se guarda en el móvil al momento y se sincroniza en privado; el
 * entrenador no ve nada hasta que se pulsa «Enviar entrenamiento».
 */
export function RegistroDeSesion({ sesionId }: { sesionId: string }): React.JSX.Element {
  const { estado: sesion } = useSesion()
  const router = useRouter()
  const cuenta = sesion.fase === "dentro" || sesion.fase === "local" ? sesion.usuario.id : null
  const { estado, instantanea, reintentar } = useSesionEnCurso(cuenta, sesionId)
  const volver = (): void => router.back()

  if (estado.fase === "cargando" || (estado.fase === "lista" && instantanea === null)) {
    return (
      <Esqueleto volver={volver}>
        <View style={estilos.centrado}>
          <ActivityIndicator color={tema.oro} accessibilityLabel="Abriendo la sesión" />
        </View>
      </Esqueleto>
    )
  }

  if (estado.fase === "error") {
    return (
      <Esqueleto volver={volver}>
        <View style={estilos.centrado}>
          <Text style={[texto.cuerpo, estilos.centradoTexto]}>{estado.falta.texto}</Text>
          {estado.falta.reintentable && <BotonSobrio texto="Reintentar" onPress={reintentar} />}
        </View>
      </Esqueleto>
    )
  }

  if (instantanea === null) {
    return <Esqueleto volver={volver}>{null}</Esqueleto>
  }

  return <Contenido sesion={estado.sesion} instantanea={instantanea} volver={volver} />
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
  const [conNotas, setConNotas] = useState(false)
  const desplazamiento = useRef<ScrollView>(null)
  const { copia } = instantanea
  const { prescripcion, agenda } = copia.sesion
  const fichas = new Map((copia.ejercicios ?? []).map((e) => [e.id, e]))

  if (copia.resultado !== null) {
    return (
      <Esqueleto volver={volver}>
        <ScrollView contentContainerStyle={estilos.contenido}>
          <View style={estilos.encabezado}>
            <Text style={texto.titulo}>Enviado</Text>
            <Text style={texto.tenueGrande}>
              {`${prescripcion.nombre} · ${fechaLarga(agenda.fechaActual)} · enviado el ${momento(
                copia.resultado.enviadoEn,
              )}`}
            </Text>
            <Text style={[texto.tenue, estilos.oroSuave]}>Tu entrenador ya lo puede ver.</Text>
          </View>
          <ResultadoSesion resultado={copia.resultado} />
        </ScrollView>
      </Esqueleto>
    )
  }

  const { hechas, total } = recuento(prescripcion, copia.entradas)
  const editable =
    copia.envio === null && !instantanea.enviando && !copia.anulada && copia.conflicto === null
  const guardado = textoDeGuardado(instantanea.escritura, instantanea.red)
  const series = prescripcion.ejercicios.flatMap((e) => e.series)
  const siguiente = series.find((serie) => {
    const entrada = copia.entradas[serie.id]
    return entrada === undefined || !serieRegistrada(serie, entrada).hecha
  })

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
      // El motivo queda en `errorDeEnvio` y se enseña en el resumen.
    }
  }

  const terminar = (): void => {
    setConfirmando(true)
    setTimeout(() => desplazamiento.current?.scrollToEnd({ animated: true }), 50)
  }

  return (
    <View style={estilos.pantalla}>
      <BrilloDeFondo />
      <SafeAreaView style={estilos.flexible}>
        <KeyboardAvoidingView
          style={estilos.flexible}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <View style={estilos.barraSuperior}>
            <BotonAtras onPress={volver} />
            <Text
              style={estilos.contador}
              accessibilityLabel={`${String(hechas)} de ${String(total)} series hechas`}
            >
              {`${String(hechas)}/${String(total)}`}
            </Text>
            {editable ? (
              <BotonOro texto="Terminar" onPress={terminar} compacto />
            ) : (
              <View style={estilos.hueco} />
            )}
          </View>
          <View style={estilos.lineaDeEstado}>
            <Text style={texto.tenue}>{prescripcion.nombre}</Text>
            <Text style={texto.tenue}>{`${String(hechas)} de ${String(total)} series`}</Text>
          </View>
          <BarraDeProgreso fraccion={total === 0 ? 0 : hechas / total} alto={4} />
          <View style={estilos.lineaDeEstado}>
            <Text style={texto.tenue}>{conMayuscula(fechaLarga(agenda.fechaActual))}</Text>
            <Text
              style={[texto.tenue, guardado.error && estilos.error]}
              accessibilityLiveRegion="polite"
            >
              {guardado.texto}
            </Text>
          </View>

          <ScrollView
            ref={desplazamiento}
            contentContainerStyle={estilos.contenido}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
          >
            {copia.anulada && (
              <Tarjeta style={estilos.tarjetaError}>
                <Text style={texto.cuerpo}>
                  Tu entrenador ha anulado esta sesión. Lo que registraste sigue en este móvil, pero
                  ya no se puede enviar.
                </Text>
                <BotonSobrio
                  texto="Descartar esta sesión"
                  onPress={() => void sesion.descartar().then(volver)}
                />
              </Tarjeta>
            )}

            {copia.conflicto !== null && (
              <Tarjeta style={estilos.tarjetaError}>
                <Text style={texto.fuerte}>{copia.conflicto.mensaje}</Text>
                <Text style={texto.tenue}>
                  Tu versión no se pierde: si eliges la del servidor, la de este móvil queda
                  guardada como respaldo.
                </Text>
                <BotonOro
                  texto="Usar la versión del servidor"
                  onPress={() => void sesion.resolverConflicto("servidor")}
                />
                {copia.conflicto.codigo !== "prescripcion_cambiada" && (
                  <BotonSobrio
                    texto="Mantener la de este móvil"
                    onPress={() => void sesion.resolverConflicto("mia")}
                  />
                )}
              </Tarjeta>
            )}

            {prescripcion.ejercicios.map((ejercicio) => {
              const ficha = fichas.get(ejercicio.ejercicioId)
              const verTecnica =
                ficha === undefined
                  ? undefined
                  : () => setInstrucciones((v) => (v === ejercicio.id ? null : ejercicio.id))
              const porTiempo = ejercicio.series.every((s) => s.tipoMedicion === "tiempo")
              return (
                <View key={ejercicio.id} style={estilos.ejercicio}>
                  <TarjetaDeFigura nombre={ejercicio.nombre} onTecnica={verTecnica} />
                  <View style={estilos.cabeceraEjercicio}>
                    <View style={estilos.flexible}>
                      <Text style={texto.seccion} accessibilityRole="header">
                        {ejercicio.nombre}
                      </Text>
                      <Text style={texto.tenue}>{resumenDePrescripcion(ejercicio)}</Text>
                    </View>
                  </View>
                  {ejercicio.indicaciones !== null && (
                    <Text style={[texto.tenue, estilos.oroSuave]}>{ejercicio.indicaciones}</Text>
                  )}
                  {instrucciones === ejercicio.id && ficha !== undefined && (
                    <Tarjeta>
                      <Text style={texto.cuerpo}>{ficha.instrucciones}</Text>
                    </Tarjeta>
                  )}
                  {verTecnica !== undefined && instrucciones !== ejercicio.id && (
                    <View style={estilos.sinMargen}>
                      <EnlaceOro texto="Cómo se hace" onPress={verTecnica} />
                    </View>
                  )}
                  <View style={estilos.series}>
                    <CabeceraDeSeries porTiempo={porTiempo} />
                    {ejercicio.series.map((serie, indice) => (
                      <FilaSerie
                        key={serie.id}
                        numero={indice + 1}
                        serie={serie}
                        entrada={copia.entradas[serie.id] ?? ENTRADA_VACIA}
                        editable={editable}
                        actual={editable && siguiente?.id === serie.id}
                        alCambiar={(entrada) => cambiarSerie(serie.id, entrada)}
                      />
                    ))}
                  </View>
                </View>
              )
            })}

            {conNotas || copia.notas !== "" ? (
              <View style={estilos.notasBloque}>
                <Text style={texto.fuerte}>Notas para tu entrenador</Text>
                <TextInput
                  style={estilos.notas}
                  value={copia.notas}
                  onChangeText={(notas) => void sesion.editar((entradas) => ({ entradas, notas }))}
                  placeholder="Opcional. ¿Algo que quieras contarle?"
                  placeholderTextColor={tema.marcador}
                  multiline
                  maxLength={2000}
                  editable={editable}
                  accessibilityLabel="Notas para tu entrenador, opcional"
                />
              </View>
            ) : (
              editable && (
                <View style={estilos.centradoEnlace}>
                  <EnlaceOro texto="Agregar nota" onPress={() => setConNotas(true)} />
                </View>
              )
            )}

            {(confirmando || copia.envio !== null) && (
              <Tarjeta destacada>
                <Text
                  style={texto.seccion}
                >{`Has hecho ${String(hechas)} de ${String(total)} series`}</Text>
                {hechas === 0 ? (
                  <Text style={texto.cuerpo}>
                    Marca al menos una serie como hecha para poder enviar.
                  </Text>
                ) : hechas < total ? (
                  <Text style={texto.cuerpo}>
                    {`Te ${total - hechas === 1 ? "falta 1 serie" : `faltan ${String(total - hechas)} series`}. Puedes volver y completarlas o enviar lo que has hecho: las demás constarán como no realizadas.`}
                  </Text>
                ) : (
                  <Text style={texto.cuerpo}>Todo hecho. Tu entrenador lo verá al momento.</Text>
                )}
                {instantanea.errorDeEnvio !== null && (
                  <Text style={[texto.cuerpo, estilos.error]} accessibilityRole="alert">
                    {instantanea.errorDeEnvio}
                  </Text>
                )}
                {hechas > 0 && (
                  <BotonOro
                    texto={
                      copia.envio !== null
                        ? "Reintentar el envío"
                        : hechas < total
                          ? "Enviar lo que he hecho"
                          : "Enviar entrenamiento"
                    }
                    onPress={() => void enviar()}
                    ocupado={instantanea.enviando}
                  />
                )}
                <BotonSobrio
                  texto="Seguir entrenando"
                  onPress={() => {
                    setConfirmando(false)
                    void sesion.seguirEditando()
                  }}
                />
              </Tarjeta>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  )
}

const estilos = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: tema.fondo },
  flexible: { flex: 1 },
  centrado: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 16 },
  centradoTexto: { textAlign: "center" },
  barraSuperior: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
  },
  contador: {
    color: tema.oro,
    fontFamily: fuentes.titulo,
    fontSize: 30,
    lineHeight: 34,
    fontVariant: ["tabular-nums"],
  },
  hueco: { width: 44 },
  lineaDeEstado: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 8,
    gap: 12,
  },
  contenido: { padding: 20, paddingBottom: 48, gap: 32 },
  encabezado: { gap: 8 },
  ejercicio: { gap: 16 },
  cabeceraEjercicio: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  series: { gap: 8 },
  sinMargen: { marginTop: -12 },
  oroSuave: { color: tema.oroSuave },
  error: { color: tema.error },
  tarjetaError: { borderWidth: 1, borderColor: tema.error },
  notasBloque: { gap: 10 },
  notas: {
    backgroundColor: tema.superficie,
    borderRadius: 16,
    color: tema.texto,
    fontFamily: fuentes.normal,
    fontSize: 15,
    minHeight: 96,
    padding: 14,
    textAlignVertical: "top",
  },
  centradoEnlace: { alignItems: "center" },
})
