import { useEffect, useRef, useState } from "react"
import { ActivityIndicator, Image, StyleSheet, Text, View } from "react-native"
import Animated, { FadeIn } from "react-native-reanimated"
import type { MedioFoto } from "@alpha-omega/shared"

import { AvisoDeError, Campo } from "../componentes/formulario"
import { Pulsable } from "../componentes/pulsable"
import { fechaCorta } from "../entrenamiento/plan/modelo"
import { faltaDe } from "../lib/errores"
import { degradadoOro, tema } from "../tema"
import {
  NOMBRE_CORTO,
  NOMBRE_DE_VISTA,
  VISTAS_ESTANDAR,
  fechaConAno,
  fechaDeTomaValida,
  vistaDe,
  type VistaEstandar,
} from "./fotos-modelo"
import type { ApiMedios } from "./medios-api"
import { obtenerFoto, type FotoPreparada, type OrigenFoto } from "./preparar-foto"
import { enviarFoto, soltarCopia } from "./subir-foto"

/** Lo que identifica el envío: se fija al elegir la foto y el reintento lo repite igual. */
type Envio = {
  foto: FotoPreparada
  operacionId: string
  vista: VistaEstandar
  fechaToma: string
}

type Paso =
  | { fase: "eligiendo" }
  | { fase: "preparando"; origen: OrigenFoto }
  | ({ fase: "seleccionada" | "subiendo" | "confirmando" } & Envio)
  | ({ fase: "fallo"; mensaje: string; reintentable: boolean } & Envio)
  | { fase: "lista"; medio: MedioFoto }

/** Con copia local que conservar: se suelta al confirmarse, al descartarla o al salir. */
const conCopia = (paso: Paso): paso is Extract<Paso, Envio> => "foto" in paso

const NO_SE_ENVIO =
  "No se pudo guardar la foto. La conservamos mientras sigas aquí: reintenta o descártala."

/** «hoy, 26 sep» o «4 jul 2026». */
const cuando = (fecha: string, hoy: string): string =>
  fecha === hoy ? `hoy, ${fechaCorta(fecha)}` : fechaConAno(fecha)

/**
 * «Añadir foto» de Progreso: el cliente elige la vista, la fecha (hoy por
 * defecto) y la cámara o la galería; ve la foto elegida antes de guardarla y
 * sigue su envío. Reutiliza la preparación (`obtenerFoto`) y el envío
 * (`enviarFoto`) de las solicitudes. Un reintento repite la misma operación: el
 * servidor no crea otra foto. La copia local solo vive hasta que el servidor
 * confirma, se descarta o se sale de la pantalla.
 */
export function AnadirFoto({
  clienteId,
  api,
  nuevoId,
  hoy,
  alGuardar,
  cerrar,
}: {
  clienteId: string
  api: Pick<ApiMedios, "solicitarSubida" | "confirmar">
  nuevoId: () => string
  hoy: string
  alGuardar: (medio: MedioFoto) => void
  cerrar: () => void
}): React.JSX.Element {
  const [vista, setVista] = useState<VistaEstandar>("frente")
  const [otraFecha, setOtraFecha] = useState<string | null>(null)
  const [error, setError] = useState("")
  const [paso, setPasoVisible] = useState<Paso>({ fase: "eligiendo" })
  const pasoActual = useRef<Paso>({ fase: "eligiendo" })
  const montado = useRef(true)
  // Síncrono: dos toques antes de repintar no abren dos selectores ni dos envíos.
  const ocupado = useRef(false)
  const porLiberar = useRef(new Set<string>())

  const setPaso = (nuevo: Paso): void => {
    pasoActual.current = nuevo
    if (montado.current) setPasoVisible(nuevo)
  }

  useEffect(() => {
    montado.current = true
    const copias = porLiberar.current
    return () => {
      montado.current = false
      for (const uri of [...copias]) soltarCopia(uri, copias)
      // Un envío en curso suelta su copia al terminar; aquí, la que esperaba.
      const ultimo = pasoActual.current
      if (ultimo.fase === "seleccionada" || ultimo.fase === "fallo") {
        pasoActual.current = { fase: "eligiendo" }
        soltarCopia(ultimo.foto.uri, copias)
      }
    }
  }, [])

  const fechaToma = otraFecha ?? hoy
  const fechaValida = otraFecha === null || fechaDeTomaValida(otraFecha, hoy)

  const elegir = async (origen: OrigenFoto): Promise<void> => {
    if (ocupado.current) return
    if (!fechaValida) {
      setError("Escribe la fecha como AAAA-MM-DD, de hoy o anterior.")
      return
    }
    ocupado.current = true
    setError("")
    setPaso({ fase: "preparando", origen })
    try {
      const obtenida = await obtenerFoto(origen)
      if (obtenida.tipo !== "lista") {
        setPaso({ fase: "eligiendo" })
        if (obtenida.tipo !== "cancelada" && montado.current) setError(obtenida.mensaje)
        return
      }
      if (!montado.current) {
        // Preparada después de salir: ni se envía ni se queda en el móvil.
        soltarCopia(obtenida.foto.uri, porLiberar.current)
        return
      }
      setPaso({
        fase: "seleccionada",
        foto: obtenida.foto,
        operacionId: nuevoId(),
        vista,
        fechaToma,
      })
    } catch {
      setPaso({ fase: "eligiendo" })
      if (montado.current) setError("No se pudo preparar la foto. Elige otra o usa la cámara.")
    } finally {
      ocupado.current = false
    }
  }

  /** Solo la confirmación del servidor da la foto por guardada. */
  const guardar = async (): Promise<void> => {
    const actual = pasoActual.current
    if (ocupado.current || (actual.fase !== "seleccionada" && actual.fase !== "fallo")) return
    ocupado.current = true
    const envio: Envio = {
      foto: actual.foto,
      operacionId: actual.operacionId,
      vista: actual.vista,
      fechaToma: actual.fechaToma,
    }
    setPaso({ fase: "subiendo", ...envio })
    try {
      const medio = await enviarFoto(
        api,
        {
          operacionId: envio.operacionId,
          clienteId,
          destino: { tipo: "progreso" },
          vista: envio.vista,
          etiqueta: null,
          fechaToma: envio.fechaToma,
        },
        envio.foto,
        () => setPaso({ fase: "confirmando", ...envio }),
      )
      // El servidor ya la tiene: la copia local sobra.
      soltarCopia(envio.foto.uri, porLiberar.current)
      setPaso({ fase: "lista", medio })
      if (montado.current) alGuardar(medio)
    } catch (fallo) {
      if (montado.current) {
        const falta = faltaDe(fallo, NO_SE_ENVIO)
        setPaso({ fase: "fallo", mensaje: falta.texto, reintentable: falta.reintentable, ...envio })
      } else {
        // Sin la pantalla nadie puede reintentar: la copia ya no sirve.
        pasoActual.current = { fase: "eligiendo" }
        soltarCopia(envio.foto.uri, porLiberar.current)
      }
    } finally {
      ocupado.current = false
    }
  }

  const descartar = (): void => {
    const actual = pasoActual.current
    if (ocupado.current || (actual.fase !== "seleccionada" && actual.fase !== "fallo")) return
    soltarCopia(actual.foto.uri, porLiberar.current)
    setPaso({ fase: "eligiendo" })
  }

  const salir = (): void => {
    descartar()
    cerrar()
  }

  const enviando = paso.fase === "subiendo" || paso.fase === "confirmando"

  return (
    <Animated.View entering={FadeIn.duration(180)} style={s.panel}>
      <Text style={s.titulo} accessibilityRole="header">
        Nueva foto
      </Text>

      {(paso.fase === "eligiendo" || paso.fase === "preparando") && (
        <>
          <View
            style={s.vistas}
            accessibilityRole="radiogroup"
            accessibilityLabel="Vista de la foto"
          >
            {VISTAS_ESTANDAR.map((v) => {
              const elegida = v === vista
              return (
                <Pulsable
                  key={v}
                  accessibilityRole="radio"
                  accessibilityLabel={NOMBRE_DE_VISTA[v]}
                  accessibilityState={{ checked: elegida }}
                  onPress={() => setVista(v)}
                  style={[s.vista, elegida && [s.vistaElegida, degradadoOro]]}
                >
                  <Text style={[s.textoVista, elegida && s.textoElegido]}>{NOMBRE_CORTO[v]}</Text>
                </Pulsable>
              )
            })}
          </View>

          <View style={s.linea}>
            <Text style={s.texto}>Fecha: {fechaValida ? cuando(fechaToma, hoy) : "—"}</Text>
            {otraFecha === null && (
              <Pulsable
                accessibilityRole="button"
                accessibilityLabel="Cambiar la fecha de la foto"
                onPress={() => setOtraFecha(hoy)}
                style={s.enlace}
                hitSlop={8}
              >
                <Text style={s.textoEnlace}>Cambiar</Text>
              </Pulsable>
            )}
          </View>
          {otraFecha !== null && (
            <Campo
              etiqueta="Fecha de la foto (AAAA-MM-DD)"
              value={otraFecha}
              maxLength={10}
              onChangeText={(texto) => {
                setOtraFecha(texto)
                setError("")
              }}
              error={fechaValida ? undefined : "Escribe una fecha real, de hoy o anterior."}
            />
          )}

          <Text style={s.consejo}>
            Misma luz, distancia y postura que la última vez: así la comparación es fiable.
          </Text>
          {error !== "" && <AvisoDeError mensaje={error} />}

          <View style={s.botones}>
            <Boton
              texto={
                paso.fase === "preparando" && paso.origen === "camara" ? "Abriendo…" : "Hacer foto"
              }
              etiqueta={`Hacer foto de ${NOMBRE_DE_VISTA[vista]} con la cámara`}
              ocupado={paso.fase === "preparando"}
              principal
              onPress={() => void elegir("camara")}
            />
            <Boton
              texto={
                paso.fase === "preparando" && paso.origen === "galeria" ? "Abriendo…" : "Galería"
              }
              etiqueta={`Elegir foto de ${NOMBRE_DE_VISTA[vista]} desde la galería`}
              ocupado={paso.fase === "preparando"}
              onPress={() => void elegir("galeria")}
            />
          </View>
          <Boton
            texto="Cancelar"
            etiqueta="Cancelar la nueva foto"
            ocupado={paso.fase === "preparando"}
            onPress={salir}
          />
        </>
      )}

      {conCopia(paso) && (
        <>
          <Image
            source={{ uri: paso.foto.uri }}
            style={[s.previa, enviando && s.previaEnviando]}
            resizeMode="contain"
            accessible
            accessibilityRole="image"
            accessibilityLabel={`Foto elegida: ${NOMBRE_DE_VISTA[paso.vista]}, ${fechaConAno(paso.fechaToma)}`}
          />
          <Text style={s.texto}>
            {NOMBRE_DE_VISTA[paso.vista]} · {cuando(paso.fechaToma, hoy)}
          </Text>
        </>
      )}

      {paso.fase === "seleccionada" && (
        <View style={s.botones}>
          <Boton
            texto="Guardar foto"
            etiqueta="Guardar la foto"
            principal
            onPress={() => void guardar()}
          />
          <Boton texto="Descartar" etiqueta="Descartar la foto sin guardarla" onPress={descartar} />
        </View>
      )}

      {enviando && (
        <View style={s.linea} accessibilityLiveRegion="polite" accessibilityState={{ busy: true }}>
          <ActivityIndicator color={tema.acento} />
          <Text style={s.estado}>
            {paso.fase === "confirmando" ? "Confirmando foto…" : "Subiendo foto…"}
          </Text>
        </View>
      )}

      {paso.fase === "fallo" && (
        <>
          <AvisoDeError mensaje={paso.mensaje} />
          <View style={s.botones}>
            {paso.reintentable && (
              <Boton
                texto="Reintentar"
                etiqueta="Reintentar el envío de la foto"
                principal
                onPress={() => void guardar()}
              />
            )}
            <Boton
              texto="Descartar"
              etiqueta="Descartar la foto sin guardarla"
              onPress={descartar}
            />
          </View>
        </>
      )}

      {paso.fase === "lista" && (
        <Animated.View entering={FadeIn.duration(180)} style={s.grupo}>
          <Text style={s.hecho} accessibilityRole="alert" accessibilityLiveRegion="polite">
            {`Foto guardada: ${vistaDe(paso.medio)}, ${cuando(paso.medio.fechaToma, hoy)}.`}
          </Text>
          <View style={s.botones}>
            <Boton
              texto="Añadir otra"
              etiqueta="Añadir otra foto"
              principal
              onPress={() => setPaso({ fase: "eligiendo" })}
            />
            <Boton texto="Cerrar" etiqueta="Cerrar la nueva foto" onPress={cerrar} />
          </View>
        </Animated.View>
      )}
    </Animated.View>
  )
}

function Boton({
  texto,
  etiqueta,
  onPress,
  principal = false,
  ocupado = false,
}: {
  texto: string
  etiqueta: string
  onPress: () => void
  principal?: boolean
  ocupado?: boolean
}): React.JSX.Element {
  return (
    <Pulsable
      onPress={onPress}
      disabled={ocupado}
      accessibilityRole="button"
      accessibilityLabel={etiqueta}
      accessibilityState={{ disabled: ocupado, busy: ocupado }}
      style={[
        s.boton,
        principal ? [s.principal, degradadoOro] : s.secundario,
        ocupado && s.apagado,
      ]}
    >
      <Text style={principal ? s.textoPrincipal : s.textoSecundario}>{texto}</Text>
    </Pulsable>
  )
}

const s = StyleSheet.create({
  panel: {
    backgroundColor: tema.superficie,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: tema.bordeDestacado,
    padding: 16,
    gap: 14,
  },
  grupo: { gap: 12 },
  titulo: { color: tema.texto, fontFamily: tema.fuenteBoton, fontSize: 17 },
  vistas: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  vista: {
    minHeight: 44,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: tema.bordeFuerte,
    justifyContent: "center",
  },
  vistaElegida: { borderColor: "transparent" },
  textoVista: { color: tema.texto, fontFamily: tema.fuenteSemi, fontSize: 14 },
  textoElegido: { color: tema.sobreAcento, fontFamily: tema.fuenteBoton },
  linea: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 44 },
  texto: { flex: 1, color: tema.texto, fontFamily: tema.fuenteTexto, fontSize: 15 },
  enlace: { minHeight: 44, justifyContent: "center" },
  textoEnlace: { color: tema.acento, fontFamily: tema.fuenteBoton, fontSize: 15 },
  consejo: { color: tema.textoTenue, fontFamily: tema.fuenteTexto, fontSize: 13, lineHeight: 18 },
  botones: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  boton: {
    flexGrow: 1,
    minHeight: 48,
    minWidth: 120,
    paddingHorizontal: 16,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  principal: { borderWidth: 0 },
  secundario: { borderWidth: 1, borderColor: tema.bordeFuerte },
  apagado: { opacity: 0.6 },
  textoPrincipal: { color: tema.sobreAcento, fontFamily: tema.fuenteBoton, fontSize: 15 },
  textoSecundario: { color: tema.texto, fontFamily: tema.fuenteSemi, fontSize: 15 },
  previa: {
    width: "100%",
    maxWidth: 360,
    alignSelf: "center",
    aspectRatio: 3 / 4,
    borderRadius: 12,
    backgroundColor: tema.hundido,
  },
  previaEnviando: { opacity: 0.6 },
  estado: { flex: 1, color: tema.textoSecundario, fontFamily: tema.fuenteSemi, fontSize: 15 },
  hecho: { color: tema.exito, fontFamily: tema.fuenteSemi, fontSize: 15, lineHeight: 21 },
})
