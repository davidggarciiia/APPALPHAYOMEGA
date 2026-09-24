import { useEffect, useMemo, useState } from "react"
import {
  ActivityIndicator,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ImageURISource,
} from "react-native"
import type { EnlaceTemporal, EstadoMedio, MedioFoto, VistaFoto } from "@alpha-omega/shared"

import { fechaCorta } from "../entrenamiento/plan/modelo"
import { Chips, Dialogo } from "../entrenamiento/sesion/controles"
import { degradadoOro, tema } from "../tema"
import type { ApiMedios } from "./medios-api"

type Api = Pick<ApiMedios, "acceso" | "borrar">
type Hueco = "primera" | "segunda"

const VISTAS: Record<Exclude<VistaFoto, "otra">, string> = {
  frente: "Frente",
  espalda: "Espalda",
  perfilIzquierdo: "Perfil izquierdo",
  perfilDerecho: "Perfil derecho",
}
const ORDEN_VISTAS: VistaFoto[] = ["frente", "espalda", "perfilIzquierdo", "perfilDerecho", "otra"]
/** Dos columnas de al menos 140 px y la separación; si no caben, una debajo de otra. */
const ANCHO_LADO_A_LADO = 2 * 140 + 12
/** Un borrado no se deshace: entre la lista recibida y lo confirmado gana lo más avanzado. */
const AVANCE: Record<EstadoMedio, number> = {
  pendiente: 0,
  disponible: 1,
  eliminando: 2,
  eliminado: 3,
}

/** «24 sep 2026»: entre fotos pasan meses, así que el año cuenta. */
const fecha = (dia: string): string => `${fechaCorta(dia)} ${dia.slice(0, 4)}`
const retirada = (foto: MedioFoto): boolean =>
  foto.estado === "eliminado" || foto.estado === "eliminando"
/** Con el reloj del móvil, que puede ir adelantado: solo sirve para renovar antes. */
const caducado = (lectura: EnlaceTemporal): boolean => Date.parse(lectura.caducaEn) <= Date.now()

/** Fotos comparables entre sí: misma vista y, en «otra», misma etiqueta. */
type Grupo = {
  clave: string
  nombre: string
  enFrase: string
  /** De la más antigua a la más reciente. */
  fotos: MedioFoto[]
  opciones: Map<string, { texto: string; accesible: string }>
}

function agrupar(fotos: MedioFoto[]): Grupo[] {
  const grupos = new Map<string, Grupo>()
  for (const foto of fotos) {
    // Una foto pendiente aún no existe para nadie: ni se compara ni se anuncia.
    if (foto.estado === "pendiente") continue
    const otra = foto.vista === "otra"
    const clave = otra ? `otra:${foto.etiqueta ?? ""}` : foto.vista
    const nombre = otra ? (foto.etiqueta ?? "Otra") : VISTAS[foto.vista as keyof typeof VISTAS]
    const grupo: Grupo = grupos.get(clave) ?? {
      clave,
      nombre,
      enFrase: otra ? `«${nombre}»` : nombre.toLowerCase(),
      fotos: [],
      opciones: new Map(),
    }
    grupo.fotos.push(foto)
    grupos.set(clave, grupo)
  }
  const lista = [...grupos.values()]
  for (const grupo of lista) {
    grupo.fotos.sort(
      (a, b) => a.fechaToma.localeCompare(b.fechaToma) || a.creadoEn.localeCompare(b.creadoEn),
    )
    grupo.opciones = rotulosDeFecha(grupo.fotos)
  }
  const posicion = (g: Grupo): number => ORDEN_VISTAS.indexOf(g.fotos[0]!.vista)
  return lista.sort((a, b) => posicion(a) - posicion(b) || a.nombre.localeCompare(b.nombre, "es"))
}

/** «24 sep 2026»; si el mismo día hay dos fotos de la vista, se añade quién la subió. */
function rotulosDeFecha(fotos: MedioFoto[]): Grupo["opciones"] {
  const veces = new Map<string, number>()
  for (const f of fotos) veces.set(f.fechaToma, (veces.get(f.fechaToma) ?? 0) + 1)
  const usados = new Map<string, number>()
  const opciones: Grupo["opciones"] = new Map()
  for (const f of fotos) {
    let texto = fecha(f.fechaToma)
    if ((veces.get(f.fechaToma) ?? 0) > 1) texto += ` · ${f.autor.nombre}`
    const repetido = (usados.get(texto) ?? 0) + 1
    usados.set(texto, repetido)
    if (repetido > 1) texto += ` (${repetido})`
    opciones.set(f.id, {
      texto,
      accesible: retirada(f) ? `${texto}, foto retirada` : texto,
    })
  }
  return opciones
}

/**
 * Comparación de fotos de evolución: dos fechas de la misma vista. Nunca rellena
 * un hueco con otra vista ni con otra fecha; lo que falta se dice con texto.
 * Los enlaces de lectura solo viven en memoria mientras se muestra la foto.
 * `api` debe ser estable entre renderizados (como el de `useMedios`).
 */
export function ComparadorFotos({
  fotos,
  api,
  puedeBorrar,
}: {
  fotos: MedioFoto[]
  api: Api
  puedeBorrar: (foto: MedioFoto) => boolean
}): React.JSX.Element {
  const [confirmadas, setConfirmadas] = useState<Record<string, MedioFoto>>({})
  const [retiradas, setRetiradas] = useState<Record<string, "enCurso" | "fallo">>({})
  const [aBorrar, setABorrar] = useState<{ foto: MedioFoto; etiqueta: string } | null>(null)
  const [vista, setVista] = useState<string | null>(null)
  const [elegidas, setElegidas] = useState<Record<string, Partial<Record<Hueco, string>>>>({})
  const [ancho, setAncho] = useState(0)

  const grupos = useMemo(
    () =>
      agrupar(
        fotos.map((f) => {
          const confirmada = confirmadas[f.id]
          return confirmada && AVANCE[confirmada.estado] > AVANCE[f.estado] ? confirmada : f
        }),
      ),
    [fotos, confirmadas],
  )

  if (grupos.length === 0) {
    return <Text style={s.explicacion}>Aún no hay fotos para comparar.</Text>
  }

  const claveVista = vista ?? grupos[0]!.clave
  const grupo = grupos.find((g) => g.clave === claveVista)
  const eleccion = (grupo && elegidas[grupo.clave]) ?? {}
  const buscar = (medioId: string | undefined): MedioFoto | undefined =>
    grupo?.fotos.find((f) => f.id === medioId)
  const primera = grupo && (buscar(eleccion.primera) ?? grupo.fotos[0])
  const segunda =
    grupo && grupo.fotos.length > 1
      ? (buscar(eleccion.segunda) ?? grupo.fotos[grupo.fotos.length - 1])
      : undefined

  const elegir = (hueco: Hueco, medioId: string): void => {
    if (!grupo) return
    setElegidas((antes) => ({
      ...antes,
      [grupo.clave]: { ...antes[grupo.clave], [hueco]: medioId },
    }))
  }

  const retirar = (foto: MedioFoto): void => {
    if (retiradas[foto.id] === "enCurso") return
    setRetiradas((antes) => ({ ...antes, [foto.id]: "enCurso" }))
    api.borrar(foto.id).then(
      (medio) => {
        // Solo cambia lo que el servidor confirma, no lo que se pidió.
        setConfirmadas((antes) => ({ ...antes, [medio.id]: medio }))
        setRetiradas((antes) => {
          const resto = { ...antes }
          delete resto[foto.id]
          return resto
        })
      },
      () => setRetiradas((antes) => ({ ...antes, [foto.id]: "fallo" })),
    )
  }

  const lado = ancho >= ANCHO_LADO_A_LADO
  const panel = (hueco: Hueco, g: Grupo, foto: MedioFoto, otra?: MedioFoto): React.JSX.Element => (
    <PanelFoto
      key={hueco}
      hueco={hueco}
      grupo={g}
      foto={foto}
      otra={otra}
      lado={lado}
      elegir={(medioId) => elegir(hueco, medioId)}
      api={api}
      borrable={puedeBorrar(foto)}
      retiro={retiradas[foto.id] ?? null}
      pedirBorrado={(etiqueta) => setABorrar({ foto, etiqueta })}
      reintentarBorrado={() => retirar(foto)}
    />
  )

  return (
    <View style={s.comparador}>
      <Chips
        etiqueta="Vista"
        opciones={grupos.map((g) => ({ valor: g.clave, texto: g.nombre }))}
        elegidas={grupo ? [grupo.clave] : []}
        cambiar={([clave]) => {
          if (clave) setVista(clave)
        }}
      />

      {!grupo && (
        <Text style={s.explicacion} accessibilityLiveRegion="polite">
          Ya no hay fotos de esa vista. Elige otra de la lista.
        </Text>
      )}

      {grupo && primera && !segunda && (
        <Text style={s.explicacion} accessibilityLiveRegion="polite">
          {`Solo hay una foto de ${grupo.enFrase} (${fecha(primera.fechaToma)}). Para comparar hace falta otra de la misma vista con otra fecha.`}
        </Text>
      )}

      {grupo && primera && (
        <View
          testID="fotos-comparadas"
          onLayout={(e) => setAncho(e.nativeEvent.layout.width)}
          style={[s.par, lado ? s.ladoALado : s.apiladas]}
        >
          {panel("primera", grupo, primera, segunda)}
          {segunda && panel("segunda", grupo, segunda, primera)}
        </View>
      )}

      <Dialogo
        visible={aBorrar !== null}
        titulo="¿Eliminar esta foto?"
        texto={`${aBorrar?.etiqueta ?? ""}. Se borrará la imagen y en el historial constará como foto retirada. No se puede deshacer.`}
        confirmar="Eliminar"
        cancelar="Cancelar"
        peligro
        alCancelar={() => setABorrar(null)}
        alConfirmar={() => {
          if (!aBorrar) return
          setABorrar(null)
          retirar(aBorrar.foto)
        }}
      />
    </View>
  )
}

function PanelFoto({
  hueco,
  grupo,
  foto,
  otra,
  lado,
  elegir,
  api,
  borrable,
  retiro,
  pedirBorrado,
  reintentarBorrado,
}: {
  hueco: Hueco
  grupo: Grupo
  foto: MedioFoto
  otra: MedioFoto | undefined
  lado: boolean
  elegir: (medioId: string) => void
  api: Api
  borrable: boolean
  retiro: "enCurso" | "fallo" | null
  pedirBorrado: (etiqueta: string) => void
  reintentarBorrado: () => void
}): React.JSX.Element {
  const etiqueta = `${grupo.nombre}, ${fecha(foto.fechaToma)}`
  return (
    <View style={[s.panel, lado ? s.panelLado : s.panelApilado]}>
      {otra && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          accessibilityRole="radiogroup"
          accessibilityLabel={`Fecha de la ${hueco} foto`}
          contentContainerStyle={s.fechas}
        >
          {grupo.fotos.map((f) => {
            const opcion = grupo.opciones.get(f.id)!
            const marcada = f.id === foto.id
            // La fecha que ya ocupa la otra foto no se compara consigo misma.
            const ocupada = f.id === otra.id
            return (
              <Pressable
                key={f.id}
                accessibilityRole="radio"
                accessibilityLabel={opcion.accesible}
                accessibilityState={{ checked: marcada, disabled: ocupada }}
                disabled={ocupada}
                onPress={() => elegir(f.id)}
                style={[
                  s.fecha,
                  marcada && [s.fechaElegida, degradadoOro],
                  ocupada && s.fechaOcupada,
                ]}
              >
                <Text style={[s.textoFecha, marcada && s.textoFechaElegida]}>{opcion.texto}</Text>
              </Pressable>
            )
          })}
        </ScrollView>
      )}

      {/* El lector lee la vista y la fecha en la propia imagen o en su hueco. */}
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Text style={s.rotulo}>{etiqueta}</Text>
      </View>
      <Text style={s.autor}>Subida por {foto.autor.nombre}</Text>

      {retirada(foto) ? (
        <View
          style={[s.marco, s.hueco]}
          accessible
          accessibilityLabel={`${etiqueta}: foto retirada`}
        >
          <Text style={s.textoRetirada}>Foto retirada</Text>
          {foto.estado === "eliminando" && (
            <Text style={s.nota}>El borrado del almacén aún no ha terminado.</Text>
          )}
        </View>
      ) : (
        <ImagenPrivada key={foto.id} medioId={foto.id} etiqueta={etiqueta} acceso={api.acceso} />
      )}

      {retiro === "fallo" && (
        <Text style={s.error} accessibilityRole="alert" accessibilityLiveRegion="assertive">
          No se ha podido retirar la foto: sigue pendiente de retirar.
        </Text>
      )}
      {borrable && foto.estado === "disponible" && retiro !== "fallo" && (
        <Accion
          texto={retiro === "enCurso" ? "Retirando…" : "Eliminar foto"}
          etiqueta={
            retiro === "enCurso"
              ? `Retirando la foto de ${etiqueta}`
              : `Eliminar la foto de ${etiqueta}`
          }
          ocupado={retiro === "enCurso"}
          peligro
          onPress={() => pedirBorrado(etiqueta)}
        />
      )}
      {borrable && (retiro === "fallo" || foto.estado === "eliminando") && (
        <Accion
          texto="Reintentar retirada"
          etiqueta={`Reintentar la retirada de ${etiqueta}`}
          ocupado={retiro === "enCurso"}
          peligro
          onPress={reintentarBorrado}
        />
      )}
    </View>
  )
}

type Carga =
  | { fase: "pidiendo" }
  | { fase: "lista"; fuente: ImageURISource; renovada: boolean }
  | { fase: "fallo" }

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
function ImagenPrivada({
  medioId,
  etiqueta,
  acceso,
}: {
  medioId: string
  etiqueta: string
  acceso: Api["acceso"]
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

  const volverAPedir = (renovacion: boolean): void => {
    setCarga({ fase: "pidiendo" })
    setPeticion({ renovacion })
  }

  if (carga.fase === "lista") {
    return (
      <Image
        source={carga.fuente}
        style={s.marco}
        resizeMode="contain"
        accessible
        accessibilityRole="image"
        accessibilityLabel={etiqueta}
        onError={() => {
          if (!carga.renovada) volverAPedir(true)
          else setCarga({ fase: "fallo" })
        }}
      />
    )
  }
  if (carga.fase === "fallo") {
    return (
      <View style={[s.marco, s.hueco]}>
        <Text
          style={s.error}
          accessibilityRole="alert"
          accessibilityLabel={`No se ha podido cargar la foto de ${etiqueta}.`}
        >
          No se ha podido cargar la foto.
        </Text>
        <Accion
          texto="Reintentar"
          etiqueta={`Reintentar la foto de ${etiqueta}`}
          onPress={() => volverAPedir(false)}
        />
      </View>
    )
  }
  return (
    <View
      style={[s.marco, s.hueco]}
      accessible
      accessibilityLabel={`${etiqueta}: cargando foto`}
      accessibilityState={{ busy: true }}
    >
      <ActivityIndicator color={tema.acento} />
    </View>
  )
}

function Accion({
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
  comparador: { gap: 14 },
  explicacion: {
    color: tema.textoTenue,
    fontFamily: tema.fuenteTexto,
    fontSize: 15,
    lineHeight: 21,
  },
  par: { gap: 12 },
  ladoALado: { flexDirection: "row", alignItems: "flex-start" },
  apiladas: { flexDirection: "column" },
  panel: { gap: 8, maxWidth: 480 },
  panelLado: { flex: 1, minWidth: 0 },
  panelApilado: { width: "100%", alignSelf: "center" },
  fechas: { flexDirection: "row", gap: 8 },
  fecha: {
    minHeight: 44,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: tema.bordeFuerte,
    justifyContent: "center",
  },
  fechaElegida: { borderColor: "transparent" },
  fechaOcupada: { opacity: 0.45 },
  textoFecha: { color: tema.texto, fontFamily: tema.fuenteSemi, fontSize: 14 },
  textoFechaElegida: { color: tema.sobreAcento, fontFamily: tema.fuenteBoton },
  rotulo: { color: tema.texto, fontFamily: tema.fuenteBoton, fontSize: 16 },
  autor: { color: tema.textoTenue, fontFamily: tema.fuenteTexto, fontSize: 13 },
  marco: {
    width: "100%",
    aspectRatio: 3 / 4,
    borderRadius: 12,
    backgroundColor: tema.hundido,
    overflow: "hidden",
  },
  hueco: { alignItems: "center", justifyContent: "center", gap: 10, padding: 12 },
  textoRetirada: {
    color: tema.texto,
    fontFamily: tema.fuenteSemi,
    fontSize: 15,
    textAlign: "center",
  },
  nota: { color: tema.textoTenue, fontFamily: tema.fuenteTexto, fontSize: 13, textAlign: "center" },
  error: { color: tema.error, fontFamily: tema.fuenteSemi, fontSize: 14, textAlign: "center" },
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
