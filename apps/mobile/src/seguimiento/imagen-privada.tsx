import { useEffect, useState } from "react"
import {
  ActivityIndicator,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ImageURISource,
} from "react-native"
import type { EnlaceTemporal } from "@alpha-omega/shared"

import { tema } from "../tema"
import type { ApiMedios } from "./medios-api"

type Carga =
  | { fase: "pidiendo" }
  | { fase: "lista"; fuente: ImageURISource; renovada: boolean }
  | { fase: "fallo" }

/**
 * - `normal`: la foto entera en su marco 3:4, con «Reintentar» si falla.
 * - `miniatura`: recortada para llenar su `ancho` en 3:4; si falla solo
 *   lo dice (va dentro del botón que la abre en grande, donde se reintenta).
 * - `capa`: llena a su contenedor para superponerse a otra foto; si falla solo
 *   lo dice y avisa con `alFallar` (el reintento lo ofrece quien la superpone).
 */
export type VarianteImagen = "normal" | "miniatura" | "capa"

/** Con el reloj del móvil, que puede ir adelantado: solo sirve para renovar antes. */
const caducado = (lectura: EnlaceTemporal): boolean => Date.parse(lectura.caducaEn) <= Date.now()

/**
 * Sin caché corporal persistente. En Android, Fresco guarda en disco toda
 * imagen de red aunque se pida `reload`, con la URL firmada (distinta en cada
 * acceso) como clave: cada vista dejaría otra copia que sobrevive a cerrar
 * sesión. Allí la foto se descarga a memoria y se pinta como `data:`, que
 * Fresco no escribe en disco. En iOS `reload` salta la caché del cargador y el
 * servidor responde `no-store`; la web tampoco guarda lo que el servidor veta.
 */
const enMemoria = (): boolean => Platform.OS === "android"

/** La foto como `data:`, sin escribirla en ningún sitio; `null` si no llega. */
async function descargarEnMemoria(
  lectura: EnlaceTemporal,
  senal: AbortSignal,
): Promise<string | null> {
  let blob: Blob
  try {
    const respuesta = await fetch(lectura.url, {
      // `no-store` también en la petición: la caché HTTP de la app no la guarda
      // aunque un almacén olvide su cabecera.
      headers: { ...lectura.cabeceras, "Cache-Control": "no-store" },
      signal: senal,
    })
    if (!respuesta.ok) return null
    blob = await respuesta.blob()
  } catch {
    return null
  }
  try {
    return senal.aborted ? null : await comoDatos(blob)
  } catch {
    return null
  } finally {
    // En React Native el blob ocupa memoria nativa hasta que se cierra.
    ;(blob as Blob & { close?: () => void }).close?.()
  }
}

function comoDatos(blob: Blob): Promise<string> {
  return new Promise((resolver, rechazar) => {
    const lector = new FileReader()
    lector.onload = () => {
      if (typeof lector.result === "string") resolver(lector.result)
      else rechazar(new Error("La foto no se ha podido leer"))
    }
    lector.onerror = () => rechazar(lector.error ?? new Error("La foto no se ha podido leer"))
    lector.readAsDataURL(blob)
  })
}

/**
 * Pide el enlace al mostrarse. Si la imagen no carga o el enlace parece
 * caducado, pide uno nuevo una sola vez; si vuelve a fallar, error con
 * «Reintentar». `caducaEn` es solo una pista (el reloj del móvil puede ir
 * adelantado): la renovación se intenta cargar siempre y decide la carga.
 * Ni el enlace ni la foto se guardan en ningún almacenamiento.
 */
export function ImagenPrivada({
  medioId,
  etiqueta,
  acceso,
  variante = "normal",
  ancho,
  alFallar,
}: {
  medioId: string
  etiqueta: string
  acceso: ApiMedios["acceso"]
  variante?: VarianteImagen
  /** Ancho de una miniatura; el alto sale de la proporción 3:4. */
  ancho?: number
  alFallar?: () => void
}): React.JSX.Element {
  // Cada objeto nuevo es una petición; `renovacion` indica si ya es la renovación.
  const [peticion, setPeticion] = useState({ renovacion: false })
  const [carga, setCarga] = useState<Carga>({ fase: "pidiendo" })

  useEffect(() => {
    const controlador = new AbortController()
    const senal = controlador.signal
    const cargar = async (renovacion: boolean): Promise<void> => {
      let lectura: EnlaceTemporal
      try {
        lectura = (await acceso(medioId)).lectura
      } catch {
        if (!senal.aborted) setCarga({ fase: "fallo" })
        return
      }
      if (senal.aborted) return
      if (!renovacion && caducado(lectura)) return cargar(true)
      if (!enMemoria()) {
        const fuente = { uri: lectura.url, headers: lectura.cabeceras, cache: "reload" } as const
        setCarga({ fase: "lista", fuente, renovada: renovacion })
        return
      }
      const datos = await descargarEnMemoria(lectura, senal)
      if (senal.aborted) return
      if (datos !== null) setCarga({ fase: "lista", fuente: { uri: datos }, renovada: renovacion })
      else if (!renovacion) return cargar(true)
      else setCarga({ fase: "fallo" })
    }
    void cargar(peticion.renovacion)
    return () => controlador.abort()
  }, [acceso, medioId, peticion])

  // Se avisa al entrar en fallo, no en cada pintado: `alFallar` no tiene por qué ser estable.
  const fallida = carga.fase === "fallo"
  useEffect(() => {
    if (fallida) alFallar?.()
  }, [fallida])

  const volverAPedir = (renovacion: boolean): void => {
    setCarga({ fase: "pidiendo" })
    setPeticion({ renovacion })
  }
  const marco =
    variante === "miniatura"
      ? [s.miniatura, { width: ancho }]
      : variante === "capa"
        ? s.capa
        : s.marco

  if (carga.fase === "lista") {
    return (
      <Image
        source={carga.fuente}
        style={marco}
        resizeMode={variante === "miniatura" ? "cover" : "contain"}
        accessible
        accessibilityRole="image"
        accessibilityLabel={etiqueta}
        onLoad={() =>
          // Si carga, el enlace servía: si más tarde caduca y la imagen vuelve a
          // pedirse (al girar o cambiar de tamaño), se puede renovar otra vez.
          setCarga((antes) =>
            antes.fase === "lista" && antes.renovada ? { ...antes, renovada: false } : antes,
          )
        }
        onError={() => {
          if (!carga.renovada) volverAPedir(true)
          else setCarga({ fase: "fallo" })
        }}
      />
    )
  }
  if (carga.fase === "fallo") {
    // Una miniatura va dentro del botón que la abre: allí se vuelve a pedir.
    if (variante === "miniatura")
      return (
        <View
          style={[marco, s.hueco]}
          accessible
          accessibilityLabel={`No se ha podido cargar la foto de ${etiqueta}.`}
        >
          <Text style={s.errorCorto}>Sin cargar</Text>
        </View>
      )
    return (
      <View style={[marco, s.hueco]}>
        <Text
          style={s.error}
          accessibilityRole="alert"
          accessibilityLabel={`No se ha podido cargar la foto de ${etiqueta}.`}
        >
          No se ha podido cargar la foto.
        </Text>
        {variante === "normal" && (
          <Accion
            texto="Reintentar"
            etiqueta={`Reintentar la foto de ${etiqueta}`}
            onPress={() => volverAPedir(false)}
          />
        )}
      </View>
    )
  }
  return (
    <View
      style={[marco, s.hueco]}
      accessible
      accessibilityLabel={`${etiqueta}: cargando foto`}
      accessibilityState={{ busy: true }}
    >
      <ActivityIndicator color={tema.acento} />
    </View>
  )
}

export function Accion({
  texto,
  etiqueta,
  onPress,
  ocupado = false,
  peligro = false,
}: {
  texto: string
  etiqueta: string
  onPress: () => void
  ocupado?: boolean
  peligro?: boolean
}): React.JSX.Element {
  return (
    <Pressable
      onPress={onPress}
      disabled={ocupado}
      accessibilityRole="button"
      accessibilityLabel={etiqueta}
      accessibilityState={{ disabled: ocupado, busy: ocupado }}
      style={({ pressed }) => [
        s.accion,
        peligro && s.accionPeligro,
        (pressed || ocupado) && s.pulsada,
      ]}
    >
      <Text style={[s.textoAccion, peligro && s.textoPeligro]}>{texto}</Text>
    </Pressable>
  )
}

const s = StyleSheet.create({
  marco: {
    width: "100%",
    aspectRatio: 3 / 4,
    borderRadius: 12,
    backgroundColor: tema.hundido,
    overflow: "hidden",
  },
  miniatura: {
    aspectRatio: 3 / 4,
    borderRadius: 10,
    backgroundColor: tema.hundido,
    overflow: "hidden",
  },
  capa: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: tema.hundido,
  },
  hueco: { alignItems: "center", justifyContent: "center", gap: 10, padding: 12 },
  error: { color: tema.error, fontFamily: tema.fuenteSemi, fontSize: 14, textAlign: "center" },
  errorCorto: { color: tema.error, fontFamily: tema.fuenteSemi, fontSize: 13, textAlign: "center" },
  accion: {
    minHeight: 44,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: tema.bordeFuerte,
    alignItems: "center",
    justifyContent: "center",
  },
  accionPeligro: { borderColor: tema.error },
  pulsada: { opacity: 0.7 },
  textoAccion: { color: tema.texto, fontFamily: tema.fuenteSemi, fontSize: 15 },
  textoPeligro: { color: tema.error },
})
