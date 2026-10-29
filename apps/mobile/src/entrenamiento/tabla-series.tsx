import { useEffect } from "react"
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native"
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from "react-native-reanimated"
import Svg, { Path } from "react-native-svg"
import type { ValoresEjecutados } from "@alpha-omega/shared"

import type { BarraAjusteProps } from "../componentes/barra-ajuste"
import { ChipsRir } from "../componentes/chips-rir"
import { FilaSerie, type CeldaSerie } from "../componentes/fila-serie"
import { Icono } from "../componentes/iconos"
import { ListaAnimada, useAnimacionLista } from "../componentes/lista-animada"
import { useMovimientoReducido } from "../componentes/movimiento"
import { tema } from "../tema"
import type { EdicionRegistro, EjercicioConDistancia, SerieConDistancia } from "./registro-modelo"
import { resumenPrescrito } from "./sesion/modelo"
import { cargaSugeridaDeFase, decimalDeFase } from "./plan/ajustes-fase"

type SerieReal = EdicionRegistro["series"][number]
type Unidad = SerieConDistancia["tipoMedicion"]
export type FocoSerie = { serieId: string; celda: CeldaSerie }
export type DeshacerSerie = { mensaje: string; deshacer: () => void }
export type RecordPersonal = { serieId: string; mejora: string }

const UNIDADES = {
  repeticiones: { cabecera: "REPS", corta: "REPS", ajuste: "reps", maximo: 10000 },
  tiempo: { cabecera: "SEG", corta: "S", ajuste: "seg", maximo: 86400 },
  distancia: { cabecera: "M", corta: "M", ajuste: "m", maximo: 100000 },
} as const satisfies Record<
  Unidad,
  { cabecera: string; corta: string; ajuste: "reps" | "seg" | "m"; maximo: number }
>

function decimal(valor: number): string {
  return String(valor).replace(".", ",")
}

/** La dosis prescrita es también la sugerencia al marcar una celda vacía. */
export function cantidadObjetivo(serie: SerieConDistancia): number {
  switch (serie.tipoMedicion) {
    case "repeticiones":
      return serie.repeticiones
    case "tiempo":
      return serie.segundos
    case "distancia":
      return serie.metros
  }
}

/** La pantalla deriva su única barra fija de la serie enfocada. */
export function ajusteDeSerie(
  ejercicio: EjercicioConDistancia,
  real: SerieReal,
  celda: CeldaSerie,
  sugerenciaCarga: number | null = null,
): Pick<
  BarraAjusteProps,
  "unidad" | "valor" | "subidaKg" | "objetivo" | "minimo" | "maximo"
> | null {
  const prescrita = ejercicio.series.find((serie) => serie.id === real.serieId)
  if (!prescrita) return null
  const numero = (texto: string, sugerido: number | null): number | null => {
    if (texto.trim() === "") return sugerido
    const valor = Number(texto.replace(",", "."))
    return Number.isFinite(valor) ? valor : null
  }
  if (celda === "peso")
    return {
      unidad: "kg",
      valor: numero(real.peso, prescrita.pesoKg ?? sugerenciaCarga),
      subidaKg: ejercicio.subidaKg,
      minimo: 0,
      maximo: 1000,
    }
  if (celda === "rir")
    return {
      unidad: "rir",
      valor: real.rir ?? ejercicio.rir?.min ?? null,
      objetivo: ejercicio.rir?.min,
      minimo: 0,
      maximo: 5,
    }
  return {
    unidad: UNIDADES[prescrita.tipoMedicion].ajuste,
    valor: numero(real.valor, cantidadObjetivo(prescrita)),
    minimo: 1,
    maximo: UNIDADES[prescrita.tipoMedicion].maximo,
  }
}

function cabecera(series: SerieConDistancia[]): string {
  const unidades = new Set(series.map((serie) => serie.tipoMedicion))
  if (unidades.size <= 1) return UNIDADES[series[0]?.tipoMedicion ?? "repeticiones"].cabecera
  return (["repeticiones", "tiempo", "distancia"] as const)
    .filter((unidad) => unidades.has(unidad))
    .map((unidad) => UNIDADES[unidad].corta)
    .join(" / ")
}

function anteriorLegible(valores: ValoresEjecutados): string {
  const cantidad =
    valores.tipoMedicion === "repeticiones"
      ? String(valores.repeticiones)
      : valores.tipoMedicion === "tiempo"
        ? `${valores.segundos} s`
        : `${valores.metros} m`
  return valores.pesoKg === null ? cantidad : `${decimal(valores.pesoKg)}×${cantidad}`
}

/** Todas las series visibles; el contenedor conserva foco, barra y deshacer comunes. */
export function TablaSeries({
  ejercicio,
  series,
  bloqueado,
  cambiar,
  verTecnica,
  verMolestia,
  enCurso = null,
  anterior,
  incrementoSugerido,
  factorCarga,
  recordPersonal,
  recordsCelebrados,
  enfocada = null,
  enfocar,
  avisarDeshacer,
  error,
  intentoError = 0,
}: {
  ejercicio: EjercicioConDistancia
  series: SerieReal[]
  bloqueado: boolean
  cambiar: (id: string, cambio: Partial<SerieReal>) => boolean | void
  /** La técnica sigue disponible con el registro bloqueado. */
  verTecnica?: () => void
  verMolestia?: () => void
  enCurso?: string | null
  /** La API entrega la mejor serie anterior: se repite en cada fila. */
  anterior?: ValoresEjecutados
  incrementoSugerido?: number
  factorCarga?: number
  recordPersonal?: RecordPersonal | null
  recordsCelebrados?: ReadonlySet<string>
  enfocada?: FocoSerie | null
  enfocar?: (serieId: string, celda: CeldaSerie) => void
  avisarDeshacer?: (aviso: DeshacerSerie) => void
  error?: string
  intentoError?: number
}): React.JSX.Element {
  const { width, fontScale } = useWindowDimensions()
  const reducido = useMovimientoReducido()
  const animacion = useAnimacionLista()
  const sacudida = useSharedValue(0)
  const validacion = useAnimatedStyle(() => ({ transform: [{ translateX: sacudida.value }] }))
  useEffect(() => {
    cancelAnimation(sacudida)
    sacudida.value =
      !error || reducido
        ? 0
        : withSequence(
            withTiming(-4, { duration: 80 }),
            withTiming(4, { duration: 80 }),
            withTiming(0, { duration: 80 }),
          )
    return () => cancelAnimation(sacudida)
  }, [error, intentoError, reducido, sacudida])
  const modoRir = ejercicio.modoRir ?? (ejercicio.rir ? "cadaSerie" : "desactivado")
  const mostrarPeso =
    ejercicio.tipoCarga !== "sinCarga" &&
    (ejercicio.tipoCarga === "conCargaExterna" ||
      ejercicio.calibrar === true ||
      ejercicio.series.some((serie) => serie.pesoKg !== null))
  const sugerenciaCarga = cargaSugeridaDeFase(ejercicio, factorCarga, anterior)
  const porcentaje =
    factorCarga !== undefined && factorCarga !== 1
      ? decimalDeFase(Number((factorCarga * 100).toFixed(1)))
      : null
  const mostrarSugerencia =
    mostrarPeso && porcentaje !== null && ejercicio.series.some((serie) => serie.pesoKg === null)
  const pendientes = ejercicio.series.filter((prescrita) => {
    const real = series.find((serie) => serie.serieId === prescrita.id)
    return !real?.hecha && !real?.omitida
  })
  const ultimaHecha = [...ejercicio.series]
    .reverse()
    .find((prescrita) => series.find((serie) => serie.serieId === prescrita.id)?.hecha)
  const rirEnfocado =
    enfocada?.celda === "rir" && series.find((serie) => serie.serieId === enfocada.serieId)
  const conDeshacer = (real: SerieReal, cambio: Partial<SerieReal>, mensaje: string): void => {
    if (bloqueado) return
    if (cambiar(real.serieId, cambio) === false) return
    const previa = {
      hecha: real.hecha,
      ...(cambio.omitida === true && { omitida: real.omitida }),
    }
    avisarDeshacer?.({
      mensaje,
      deshacer: () => cambiar(real.serieId, previa),
    })
  }
  return (
    <View style={s.bloque}>
      <View style={s.cabecera}>
        <View style={s.titulos}>
          <Text accessibilityRole="header" style={s.nombre}>
            {ejercicio.nombre.toUpperCase()}
          </Text>
          <Text style={s.resumen}>{resumenPrescrito(ejercicio)}</Text>
          {ejercicio.indicaciones && <Text style={s.resumen}>{ejercicio.indicaciones}</Text>}
          {mostrarPeso && incrementoSugerido !== undefined && (
            <Text style={[s.resumen, s.progresion]}>
              {`Sube carga la próxima vez · +${decimal(incrementoSugerido)} kg`}
            </Text>
          )}
          {mostrarSugerencia && (
            <Text style={[s.resumen, s.aviso]}>
              {sugerenciaCarga === null
                ? `Sugerencia · ${porcentaje} % de tu carga habitual`
                : `Sugerencia · ${decimalDeFase(sugerenciaCarga)} kg (${porcentaje} % de la anterior)`}
            </Text>
          )}
        </View>
        {verTecnica && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Ver técnica — ${ejercicio.nombre}`}
            onPress={verTecnica}
            style={s.icono}
          >
            <Icono nombre="reproducir" color={tema.acento} tamano={22} />
          </Pressable>
        )}
        {verMolestia && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Tengo una molestia — ${ejercicio.nombre}`}
            accessibilityState={{ disabled: bloqueado }}
            disabled={bloqueado}
            onPress={verMolestia}
            style={s.icono}
          >
            <View aria-hidden>
              <Svg width={24} height={24} viewBox="0 0 24 24">
                <Path
                  d="M12 3L2 21h20L12 3zM12 9v5M12 17v1"
                  fill="none"
                  stroke={tema.aviso}
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </Svg>
            </View>
          </Pressable>
        )}
      </View>
      <View style={s.columnas} accessible={false}>
        <Text accessibilityLabel="Serie" numberOfLines={1} style={[s.etiqueta, s.numero]}>
          #
        </Text>
        {width >= 360 && fontScale <= 1.3 && <Text style={[s.etiqueta, s.anterior]}>ANT.</Text>}
        {mostrarPeso && <Text style={[s.etiqueta, s.valor]}>KG</Text>}
        <Text style={[s.etiqueta, s.valor]}>{cabecera(ejercicio.series)}</Text>
        {modoRir === "cadaSerie" && <Text style={[s.etiqueta, s.marca]}>RIR</Text>}
        <View style={s.marca} />
      </View>
      <Animated.View style={validacion}>
        {ejercicio.series.map((prescrita, n) => {
          const real = series.find((serie) => serie.serieId === prescrita.id)
          const pesoSugerido = prescrita.pesoKg ?? sugerenciaCarga
          if (!real)
            return (
              <Text key={prescrita.id} style={[s.resumen, s.aviso]} accessibilityRole="alert">
                Serie {n + 1}: registro no disponible en esta copia.
              </Text>
            )
          return (
            <ListaAnimada
              key={prescrita.id}
              testID={`serie-lista-${prescrita.id}`}
              animacion={recordPersonal ? { ...animacion, layout: undefined } : animacion}
            >
              <FilaSerie
                numero={n + 1}
                etiqueta={ejercicio.nombre}
                tipoMedicion={prescrita.tipoMedicion}
                tipoCarga={mostrarPeso ? "conCargaExterna" : "sinCarga"}
                modoRir={modoRir}
                anterior={anterior && anteriorLegible(anterior)}
                recordPersonal={
                  recordPersonal?.serieId === prescrita.id ? recordPersonal.mejora : undefined
                }
                destelloAlCompletar={
                  !recordsCelebrados?.has(prescrita.id) || recordPersonal?.serieId === prescrita.id
                }
                peso={real.peso}
                pesoSugerido={pesoSugerido}
                cantidad={real.valor}
                cantidadSugerida={cantidadObjetivo(prescrita)}
                rir={real.rir}
                rirObjetivo={ejercicio.rir?.min}
                hecha={real.hecha}
                omitida={real.omitida}
                primeraPendiente={prescrita.id === (enCurso ?? pendientes[0]?.id)}
                enfocada={enfocada?.serieId === prescrita.id ? enfocada.celda : null}
                deshabilitado={bloqueado}
                alEnfocar={(celda) => {
                  if (!bloqueado) enfocar?.(prescrita.id, celda)
                }}
                alCambiarHecha={(hecha) => {
                  if (bloqueado) return
                  if (!hecha) {
                    cambiar(prescrita.id, { hecha: false })
                    return
                  }
                  conDeshacer(
                    real,
                    {
                      hecha: true,
                      omitida: undefined,
                      ...(real.valor.trim() === "" && {
                        valor: String(cantidadObjetivo(prescrita)),
                      }),
                      ...(real.peso.trim() === "" &&
                        mostrarPeso &&
                        pesoSugerido !== null && { peso: decimal(pesoSugerido) }),
                    },
                    "Serie hecha",
                  )
                }}
                alOmitir={() => conDeshacer(real, { hecha: false, omitida: true }, "Serie omitida")}
                alRecuperar={() => {
                  if (!bloqueado) cambiar(prescrita.id, { hecha: false, omitida: undefined })
                }}
              />
            </ListaAnimada>
          )
        })}
      </Animated.View>
      {error && (
        <Text accessibilityRole="alert" style={[s.resumen, s.aviso]}>
          {error}
        </Text>
      )}
      {modoRir === "cadaSerie" &&
        rirEnfocado &&
        typeof rirEnfocado.rir === "number" &&
        !bloqueado && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Sin anotar el RIR de la serie ${ejercicio.series.findIndex((serie) => serie.id === rirEnfocado.serieId) + 1}`}
            onPress={() => cambiar(rirEnfocado.serieId, { rir: null })}
            style={s.enlace}
          >
            <Text style={s.resumen}>Sin anotar</Text>
          </Pressable>
        )}
      {modoRir === "alFinalizarEjercicio" &&
        pendientes.length === 0 &&
        ultimaHecha &&
        !bloqueado && (
          <ListaAnimada
            animacion={{ exiting: animacion.exiting, layout: animacion.layout }}
            testID="rir-final-lista"
            style={s.rirFinal}
          >
            <Text style={s.resumen}>RIR del ejercicio</Text>
            <ChipsRir
              etiqueta={`Repeticiones que te quedaban al terminar ${ejercicio.nombre}`}
              objetivo={ejercicio.rir?.min}
              valor={series.find((serie) => serie.serieId === ultimaHecha.id)?.rir ?? null}
              cambiar={(rir) => cambiar(ultimaHecha.id, { rir })}
            />
          </ListaAnimada>
        )}
    </View>
  )
}

const s = StyleSheet.create({
  bloque: { gap: 8 },
  cabecera: { flexDirection: "row", alignItems: "flex-start", gap: 4 },
  titulos: { flex: 1, gap: 4 },
  nombre: { fontFamily: tema.fuenteTitulo, fontSize: 20, lineHeight: 24, color: tema.texto },
  resumen: { fontFamily: tema.fuenteTexto, fontSize: 13, lineHeight: 18, color: tema.textoTenue },
  aviso: { color: tema.aviso },
  progresion: { color: tema.acento },
  icono: { width: 44, minHeight: 44, alignItems: "center", justifyContent: "center" },
  columnas: { flexDirection: "row", gap: 6, alignItems: "center", paddingHorizontal: 8 },
  etiqueta: {
    fontFamily: tema.fuenteSemi,
    fontSize: 11,
    letterSpacing: 1.2,
    color: tema.textoTenue,
    textAlign: "center",
  },
  numero: { width: 22, minWidth: 22 },
  anterior: { width: 52 },
  valor: { flex: 1, minWidth: 52 },
  marca: { width: 44 },
  enlace: { minHeight: 44, alignSelf: "flex-end", justifyContent: "center" },
  rirFinal: { gap: 8 },
})
