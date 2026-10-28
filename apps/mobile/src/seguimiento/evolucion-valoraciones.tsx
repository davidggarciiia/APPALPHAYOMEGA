import { useCallback, useEffect, useMemo, useState } from "react"
import { useFocusEffect } from "expo-router"
import { ScrollView, StyleSheet, Text, View } from "react-native"
import type {
  BloqueValoracion,
  MedioFoto,
  PuntoEvolucion,
  SerieEvolucion,
} from "@alpha-omega/shared"

import { AvisoDeError, BotonSecundario } from "../componentes/formulario"
import { fechaCorta } from "../entrenamiento/plan/modelo"
import { Fila, Titulo } from "../entrenamiento/plan/piezas"
import { Chips, Enlace } from "../entrenamiento/sesion/controles"
import { faltaDe, type Falta } from "../lib/errores"
import { tema } from "../tema"
import { ComparadorFotos } from "./comparador-fotos"
import { Grafica } from "./grafica"
import type { ApiMedios } from "./medios-api"
import { decimal } from "./valoracion-modelo"
import type { ApiEvolucionAvisos } from "./valoraciones-api"

type Modo = "cliente" | "entrenador"

/** Fotos del cliente para comparar desde la evolución; `api` estable (como el de `useMedios`). */
export type FotosDeEvolucion = {
  api: Pick<ApiMedios, "fotosDeCliente" | "acceso" | "borrar">
  puedeBorrar: (foto: MedioFoto) => boolean
}

const BLOQUES: BloqueValoracion[] = ["medidas", "pliegues", "bioimpedancia", "pruebas", "fotos"]
const TITULO: Record<BloqueValoracion, string> = {
  medidas: "Medidas",
  pliegues: "Pliegues",
  bioimpedancia: "Bioimpedancia",
  pruebas: "Pruebas físicas",
  fotos: "Fotos",
}

/** «10 ene 2026»: entre valoraciones pasan meses, así que el año cuenta. */
const fecha = (dia: string): string => `${fechaCorta(dia)} ${dia.slice(0, 4)}`
/** Un índice del fabricante no es kg ni %: se rotula como lo que es. */
const unidadLegible = (unidad: string): string =>
  unidad === "indice" ? "índice del fabricante" : unidad
const conUnidad = (valor: number, unidad: string): string =>
  unidad === "indice" ? `${decimal(valor)} (índice del fabricante)` : `${decimal(valor)} ${unidad}`
/** Los valores llevan como mucho dos decimales: la resta no arrastra más. */
const redondear = (valor: number): number => Math.round(valor * 100) / 100

/** «−1,5 cm» a la vista y «menos 1,5 cm» para el lector; sin juicio sobre el cambio. */
function diferencia(valor: number, unidad: string): { texto: string; oral: string } {
  const cambio = redondear(valor)
  const cifra = conUnidad(Math.abs(cambio), unidad)
  if (cambio > 0) return { texto: `+${cifra}`, oral: `más ${cifra}` }
  if (cambio < 0) return { texto: `−${cifra}`, oral: `menos ${cifra}` }
  return { texto: cifra, oral: cifra }
}

function origenLegible(serie: SerieEvolucion, modo: Modo): string {
  if (serie.origen === "valoracion") return "visita"
  if (serie.origen === "autorregistro")
    return modo === "cliente" ? "registrado por ti" : "registrado por el cliente"
  return serie.clasificada ? "histórico" : "histórico sin clasificar"
}

/** «10 ene 2026»; si la serie repite día, «10 ene 2026 (2)». */
function rotulosDeFecha(puntos: PuntoEvolucion[]): string[] {
  const usados = new Map<string, number>()
  return puntos.map((p) => {
    const texto = fecha(p.fecha)
    const veces = (usados.get(texto) ?? 0) + 1
    usados.set(texto, veces)
    return veces > 1 ? `${texto} (${veces})` : texto
  })
}

type Visita = { id: string; fecha: string }

/**
 * La visita más reciente según sus medidas corporales, cuya fecha es siempre la
 * de la toma (una prueba puede llevar otra). `null` si no hay o si dos empatan:
 * entonces no se afirma nada sobre lo que faltó.
 */
function visitaMasReciente(series: SerieEvolucion[]): Visita | null {
  let reciente: Visita | null = null
  let empate = false
  for (const serie of series) {
    if (!serie.clave.startsWith("c:")) continue
    for (const p of serie.puntos) {
      if (p.valoracionId === null) continue
      if (!reciente || p.fecha > reciente.fecha) {
        reciente = { id: p.valoracionId, fecha: p.fecha }
        empate = false
      } else if (p.fecha === reciente.fecha && p.valoracionId !== reciente.id) empate = true
    }
  }
  return empate ? null : reciente
}

/** Lo que conviene saber antes de leer la serie; ninguna nota juzga el valor. */
function notasDe(serie: SerieEvolucion, reciente: Visita | null): string[] {
  const notas: string[] = []
  if (serie.clave.endsWith(":incompleto"))
    notas.push("Protocolo incompleto: no se compara con el protocolo completo.")
  if (!serie.clasificada)
    notas.push("Sin método ni protocolo: se muestra, pero no se compara con las visitas.")
  if (
    serie.origen === "valoracion" &&
    reciente &&
    serie.puntos.length > 0 &&
    serie.puntos.every((p) => p.valoracionId !== reciente.id && p.fecha < reciente.fecha)
  )
    notas.push("No consta en la valoración más reciente.")
  return notas
}

/**
 * «Ver mi evolución»: cada serie compara por defecto su primer dato con el
 * último y deja elegir otras dos fechas de la misma serie. Nunca compara series
 * distintas, no convierte una ausencia en cero y no califica los cambios.
 */
export function EvolucionValoraciones({
  clienteId,
  api,
  fotos,
  modo,
}: {
  clienteId: string
  api: Pick<ApiEvolucionAvisos, "evolucion">
  fotos?: FotosDeEvolucion
  modo: Modo
}): React.JSX.Element {
  const [series, setSeries] = useState<SerieEvolucion[] | null>(null)
  const [falta, setFalta] = useState<Falta | null>(null)
  const [intento, setIntento] = useState(0)

  useFocusEffect(
    useCallback(() => {
      let vigente = true
      setFalta(null)
      api.evolucion(clienteId).then(
        (evolucion) => {
          if (vigente) setSeries(evolucion.series)
        },
        (fallo: unknown) => {
          if (vigente)
            setFalta(faltaDe(fallo, "No se pudo cargar la evolución. Revisa la conexión."))
        },
      )
      return () => {
        vigente = false
      }
    }, [api, clienteId, intento]),
  )

  const grupos = useMemo(() => {
    const lista = series ?? []
    return [...BLOQUES, null]
      .map((bloque) => ({ bloque, series: lista.filter((s_) => s_.bloque === bloque) }))
      .filter((g) => g.series.length > 0)
  }, [series])
  const repetidos = useMemo(() => {
    const veces = new Map<string, number>()
    for (const s_ of series ?? []) {
      const nombre = s_.nombre.trim().toLocaleLowerCase("es")
      veces.set(nombre, (veces.get(nombre) ?? 0) + 1)
    }
    return new Set([...veces].filter(([, n]) => n > 1).map(([nombre]) => nombre))
  }, [series])
  const reciente = useMemo(() => visitaMasReciente(series ?? []), [series])

  return (
    <View style={s.contenido}>
      <View style={s.grupo}>
        <Titulo>{modo === "cliente" ? "Tu evolución" : "Evolución"}</Titulo>
        <Text style={s.tenue}>
          Cada dato se compara solo con otras fechas de su misma serie: mismo dato, método y unidad.
        </Text>
        {fotos && <FotosEvolucion clienteId={clienteId} fotos={fotos} />}
      </View>

      {falta && (
        <View style={s.grupo}>
          <AvisoDeError mensaje={falta.texto} />
          {falta.reintentable && (
            <BotonSecundario texto="Reintentar" onPress={() => setIntento((n) => n + 1)} />
          )}
        </View>
      )}
      {series === null
        ? !falta && <Text style={s.tenue}>Cargando la evolución…</Text>
        : series.length === 0 && (
            <Text style={s.vacio}>
              {`Aún no hay valoraciones publicadas ni registros. ${
                modo === "cliente"
                  ? "Cuando tu entrenador publique una valoración o apuntes tus datos, aparecerán aquí."
                  : "Cuando publiques una valoración o el cliente apunte sus datos, aparecerán aquí."
              }`}
            </Text>
          )}

      {grupos.map(({ bloque, series: delBloque }) => (
        <View key={bloque ?? "otros"} style={s.grupo}>
          <Titulo>{bloque ? TITULO[bloque] : "Otros registros"}</Titulo>
          {bloque === null && (
            <Text style={s.tenue}>Registros hechos fuera de las valoraciones.</Text>
          )}
          {delBloque.map((serie) => (
            <TarjetaSerie
              key={serie.clave}
              serie={serie}
              modo={modo}
              conMetodo={
                serie.metodo !== null || repetidos.has(serie.nombre.trim().toLocaleLowerCase("es"))
              }
              notas={notasDe(serie, reciente)}
            />
          ))}
        </View>
      ))}
    </View>
  )
}

function TarjetaSerie({
  serie,
  modo,
  conMetodo,
  notas,
}: {
  serie: SerieEvolucion
  modo: Modo
  /** Siempre que otra serie se llame igual, aunque el método no conste. */
  conMetodo: boolean
  notas: string[]
}): React.JSX.Element {
  const [eleccion, setEleccion] = useState<[number, number] | null>(null)
  const [eligiendo, setEligiendo] = useState(false)
  const { nombre, unidad, puntos } = serie
  const total = puntos.length
  const rotulos = useMemo(() => rotulosDeFecha(puntos), [puntos])
  // Si al recargar la serie cambia de tamaño, se vuelve al primero y el último.
  const [uno, otro] =
    eleccion && eleccion[0] < total && eleccion[1] < total ? eleccion : [0, total - 1]
  // Siempre de la fecha anterior a la posterior, se elija en el orden que se elija.
  const desde = Math.min(uno, otro)
  const hasta = Math.max(uno, otro)

  const fila = (indice: number, primera: boolean): React.JSX.Element => {
    const punto = puntos[indice]!
    const etiqueta =
      indice === 0 && total > 1
        ? "Primer dato"
        : indice === total - 1 && total > 1
          ? "Último dato"
          : null
    const valor = conUnidad(punto.valor, unidad)
    return (
      <View
        key={indice}
        accessible
        accessibilityLabel={`${nombre}, ${etiqueta ? `${etiqueta.toLowerCase()}, ` : ""}${rotulos[indice]}: ${valor}${punto.corregido ? ", corregido" : ""}`}
      >
        <Fila primera={primera}>
          <View style={s.textos}>
            <Text style={s.texto}>{rotulos[indice]}</Text>
            {etiqueta && <Text style={s.tenue}>{etiqueta}</Text>}
          </View>
          <View style={s.derecha}>
            <Text style={s.valor}>{valor}</Text>
            {punto.corregido && <Text style={s.marca}>Corregido</Text>}
          </View>
        </Fila>
      </View>
    )
  }

  const opciones = rotulos.map((texto, indice) => ({
    valor: String(indice),
    texto: puntos[indice]!.corregido ? `${texto} · corregido` : texto,
  }))
  const elegir = (hueco: 0 | 1, valor: string | undefined): void => {
    if (valor === undefined) return
    const indice = Number(valor)
    setEleccion(hueco === 0 ? [indice, otro] : [uno, indice])
  }
  const cambio = total > 1 ? diferencia(puntos[hasta]!.valor - puntos[desde]!.valor, unidad) : null
  const primero = puntos[0]
  const ultimo = puntos[total - 1]

  return (
    <View testID={`serie ${nombre}`} style={s.serie}>
      <View style={s.textos}>
        <Text style={s.nombre}>{nombre}</Text>
        <Text style={s.tenue}>
          {`Unidad: ${unidadLegible(unidad)} · Origen: ${origenLegible(serie, modo)}`}
        </Text>
        {conMetodo && <Text style={s.tenue}>{`Método: ${serie.metodo ?? "sin indicar"}`}</Text>}
        {notas.map((nota) => (
          <Text key={nota} style={nota.startsWith("Protocolo incompleto") ? s.alerta : s.tenue}>
            {nota}
          </Text>
        ))}
      </View>

      {primero && ultimo && total > 2 && (
        <Grafica
          puntos={puntos}
          tendencia={puntos}
          descripcion={`${nombre}: ${total} datos del ${fecha(primero.fecha)} al ${fecha(ultimo.fecha)}. Primero: ${conUnidad(primero.valor, unidad)}. Último: ${conUnidad(ultimo.valor, unidad)}.`}
          izquierda={fecha(primero.fecha)}
          derecha={`${fecha(ultimo.fecha)}, ${conUnidad(ultimo.valor, unidad)}`}
        />
      )}

      {total === 0 ? (
        <Text style={s.tenue}>No hay datos en este periodo.</Text>
      ) : total === 1 ? (
        <>
          {fila(0, true)}
          <Text style={s.tenue}>
            {`Solo hay un dato, del ${rotulos[0]}. Para ver una diferencia hace falta otra fecha de esta misma serie.`}
          </Text>
        </>
      ) : desde === hasta ? (
        <>
          {fila(desde, true)}
          <Text style={s.tenue} accessibilityLiveRegion="polite">
            Elige dos fechas distintas para ver la diferencia.
          </Text>
        </>
      ) : cambio !== null ? (
        <View>
          {fila(desde, true)}
          {fila(hasta, false)}
          <View
            accessible
            accessibilityLabel={`Diferencia de ${nombre} entre el ${rotulos[desde]} y el ${rotulos[hasta]}: ${cambio.oral}`}
            accessibilityLiveRegion="polite"
          >
            <Fila>
              <Text style={[s.texto, s.textos]}>Diferencia</Text>
              <Text style={s.fuerte}>{cambio.texto}</Text>
            </Fila>
          </View>
        </View>
      ) : null}

      {total > 2 && (
        <Enlace
          texto={eligiendo ? "Ocultar fechas" : "Elegir otras fechas"}
          etiqueta={
            eligiendo ? `Ocultar las fechas de ${nombre}` : `Elegir otras fechas de ${nombre}`
          }
          onPress={() => setEligiendo((abierto) => !abierto)}
        />
      )}
      {eligiendo && total > 2 && (
        <View style={s.grupo}>
          {(["Primera fecha", "Segunda fecha"] as const).map((titulo, hueco) => (
            <View key={titulo} style={s.selector}>
              <Text style={s.etiqueta}>{titulo}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <Chips
                  etiqueta={`${titulo} de ${nombre}`}
                  opciones={opciones}
                  elegidas={[String(hueco === 0 ? uno : otro)]}
                  cambiar={([valor]) => elegir(hueco as 0 | 1, valor)}
                />
              </ScrollView>
            </View>
          ))}
        </View>
      )}
    </View>
  )
}

/**
 * Abre el comparador con las fotos del cliente. La lista se pide al abrir y se
 * suelta al cerrar; los enlaces de lectura los gestiona el comparador en memoria.
 */
function FotosEvolucion({
  clienteId,
  fotos,
}: {
  clienteId: string
  fotos: FotosDeEvolucion
}): React.JSX.Element {
  const [abiertas, setAbiertas] = useState(false)
  const [lista, setLista] = useState<MedioFoto[] | null>(null)
  const [falta, setFalta] = useState<Falta | null>(null)
  const [intento, setIntento] = useState(0)
  const { api, puedeBorrar } = fotos

  useEffect(() => {
    if (!abiertas) return
    let vigente = true
    api.fotosDeCliente(clienteId).then(
      (listado) => {
        if (vigente) setLista(listado.fotos)
      },
      (fallo: unknown) => {
        if (vigente) setFalta(faltaDe(fallo, "No se pudieron cargar las fotos."))
      },
    )
    return () => {
      vigente = false
    }
  }, [abiertas, api, clienteId, intento])

  const alternar = (): void => {
    setLista(null)
    setFalta(null)
    setAbiertas((antes) => !antes)
  }

  return (
    <View style={s.grupo}>
      <BotonSecundario texto={abiertas ? "Ocultar fotos" : "Comparar fotos"} onPress={alternar} />
      {abiertas &&
        (falta ? (
          <View style={s.grupo}>
            <AvisoDeError mensaje={falta.texto} />
            {falta.reintentable && (
              <BotonSecundario
                texto="Reintentar"
                etiquetaAccesible="Reintentar cargar las fotos"
                onPress={() => {
                  setFalta(null)
                  setIntento((n) => n + 1)
                }}
              />
            )}
          </View>
        ) : lista === null ? (
          <Text style={s.tenue}>Cargando fotos…</Text>
        ) : (
          <ComparadorFotos fotos={lista} api={api} puedeBorrar={puedeBorrar} />
        ))}
    </View>
  )
}

const s = StyleSheet.create({
  contenido: { gap: 28 },
  grupo: { gap: 14 },
  serie: { backgroundColor: tema.superficie, borderRadius: 20, padding: 18, gap: 8 },
  textos: { flex: 1, gap: 4 },
  derecha: { alignItems: "flex-end", gap: 4, flexShrink: 1 },
  selector: { gap: 8 },
  nombre: { color: tema.texto, fontFamily: tema.fuenteBoton, fontSize: 17 },
  etiqueta: { color: tema.texto, fontFamily: tema.fuenteSemi, fontSize: 15 },
  texto: { color: tema.texto, fontFamily: tema.fuenteTexto, fontSize: 15 },
  fuerte: { color: tema.texto, fontFamily: tema.fuenteBoton, fontSize: 15 },
  valor: { color: tema.textoSecundario, fontFamily: tema.fuenteTexto, fontSize: 15 },
  tenue: { color: tema.textoTenue, fontFamily: tema.fuenteTexto, fontSize: 14, lineHeight: 20 },
  vacio: { color: tema.textoTenue, fontFamily: tema.fuenteTexto, fontSize: 15, lineHeight: 22 },
  alerta: { color: tema.aviso, fontFamily: tema.fuenteSemi, fontSize: 14, lineHeight: 20 },
  marca: {
    color: tema.acento,
    fontFamily: tema.fuenteSemi,
    fontSize: 12,
    borderWidth: 1,
    borderColor: tema.bordeDestacado,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
})
