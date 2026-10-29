import { useState } from "react"
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native"
import type { ValoresEjecutados } from "@alpha-omega/shared"
import type { EdicionRegistro, EjercicioConDistancia, SerieConDistancia } from "./registro-modelo"
import { valoresLegibles } from "./resultado"
import { Icono } from "../componentes/iconos"
import { degradadoExito, tema } from "../tema"
import { Opciones } from "./sesion/controles"
import { kg, resumenPrescrito } from "./sesion/modelo"

type SerieReal = EdicionRegistro["series"][number]
type Unidad = SerieConDistancia["tipoMedicion"]

/** Cómo se nombra cada unidad: cabecera sola, cabecera mezclada y campo accesible. */
const UNIDADES = {
  repeticiones: { cabecera: "Reps", corta: "Reps", nombre: "Repeticiones" },
  tiempo: { cabecera: "Seg", corta: "s", nombre: "Segundos" },
  distancia: { cabecera: "Metros", corta: "m", nombre: "Metros" },
} as const satisfies Record<Unidad, { cabecera: string; corta: string; nombre: string }>

const RIRS = [0, 1, 2, 3, 4, 5].map((valor) => ({
  valor,
  texto: valor === 5 ? "5+" : String(valor),
  accesible: valor === 5 ? "5 o más" : String(valor),
}))

/** «67,5»: el peso como se escribe en español. */
function decimal(valor: number): string {
  return String(valor).replace(".", ",")
}

/** Lo que pauta la serie en su unidad; «Hecha» lo toma si no se escribió otra cosa. */
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

/** «Reps», «Seg», «Metros» o, si el ejercicio mezcla unidades, «Reps / s». */
function cabecera(series: SerieConDistancia[]): string {
  const unidades = new Set(series.map((s) => s.tipoMedicion))
  if (unidades.size <= 1) return UNIDADES[series[0]?.tipoMedicion ?? "repeticiones"].cabecera
  return (["repeticiones", "tiempo", "distancia"] as const)
    .filter((unidad) => unidades.has(unidad))
    .map((unidad) => UNIDADES[unidad].corta)
    .join(" / ")
}

type Anterior = ValoresEjecutados

function cantidadAnterior(valores: Anterior): string {
  switch (valores.tipoMedicion) {
    case "repeticiones":
      return String(valores.repeticiones)
    case "tiempo":
      return `${valores.segundos} s`
    case "distancia":
      return `${valores.metros} m`
  }
}

/** «Anterior 65 kg × 6», «6 reps», «30 s» o «30 kg × 20 m». */
function anteriorLegible(valores: Anterior): string {
  const cantidad = cantidadAnterior(valores)
  if (valores.pesoKg !== null) return `${kg(valores.pesoKg)} × ${cantidad}`
  return valores.tipoMedicion === "repeticiones" ? `${cantidad} reps` : cantidad
}

/** Un ejercicio de la sesión en curso, con el diseño de «Sesión en curso». */
export function TablaSeries({
  ejercicio,
  series,
  bloqueado,
  cambiar,
  verTecnica,
  enCurso = null,
  anterior,
}: {
  ejercicio: EjercicioConDistancia
  series: SerieReal[]
  bloqueado: boolean
  cambiar: (id: string, cambio: Partial<SerieReal>) => void
  /** Ver la técnica no edita nada: sigue disponible con el registro bloqueado. */
  verTecnica?: () => void
  /** La serie que toca ahora: se resalta y pregunta cuántas quedaban. */
  enCurso?: string | null
  /** La mejor serie de la última vez. */
  anterior?: Anterior
}): React.JSX.Element {
  const columna = cabecera(ejercicio.series)
  const sugerida = ejercicio.series[0]?.pesoKg ?? null
  const diferencia =
    anterior?.pesoKg !== undefined && anterior.pesoKg !== null && sugerida !== null
      ? sugerida - anterior.pesoKg
      : null
  const rirObjetivo = ejercicio.rir?.min
  const modoRir = ejercicio.modoRir ?? (ejercicio.rir ? "cadaSerie" : "desactivado")
  const mostrarRirPorSerie = modoRir === "cadaSerie"
  const mostrarPeso =
    ejercicio.tipoCarga === "conCargaExterna" ||
    ejercicio.calibrar === true ||
    (ejercicio.tipoCarga === undefined && ejercicio.series.some((serie) => serie.pesoKg !== null))
  const ejercicioResuelto = ejercicio.series.every((s) => {
    const real = series.find((r) => r.serieId === s.id)
    return real?.hecha || real?.omitida
  })
  const ultimaHecha = [...ejercicio.series]
    .reverse()
    .find((s) => series.find((r) => r.serieId === s.id)?.hecha)
  // La serie hecha cuyo RIR se está corrigiendo: la pregunta solo acompaña a la serie en curso.
  const [corrigiendo, setCorrigiendo] = useState<string | null>(null)
  return (
    <View style={s.bloque}>
      <View style={s.cabecera}>
        <View style={s.titulos}>
          <Text accessibilityRole="header" style={s.nombre}>
            {ejercicio.nombre}
          </Text>
          <Text style={s.resumen}>{resumenPrescrito(ejercicio)}</Text>
          {ejercicio.indicaciones && <Text style={s.resumen}>{ejercicio.indicaciones}</Text>}
        </View>
        {verTecnica && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Ver técnica — ${ejercicio.nombre}`}
            onPress={verTecnica}
            style={s.tecnica}
            hitSlop={4}
          >
            <Text style={s.textoTecnica}>Ver técnica</Text>
          </Pressable>
        )}
      </View>
      {anterior && (
        <View style={s.anterior}>
          <Text style={s.resumen}>Anterior {anteriorLegible(anterior)}</Text>
          {diferencia !== null && diferencia !== 0 && (
            <Text style={s.diferencia}>
              {diferencia > 0 ? "+" : "−"}
              {kg(Math.abs(diferencia))}
            </Text>
          )}
        </View>
      )}
      <View style={s.fila} accessible={false}>
        <Text style={[s.etiqueta, s.numero]}>Serie</Text>
        {mostrarPeso && <Text style={[s.etiqueta, s.valor]}>Kg</Text>}
        <Text style={[s.etiqueta, s.valor]}>{columna}</Text>
        {mostrarRirPorSerie && <Text style={[s.etiqueta, s.rir]}>RIR</Text>}
        <Text style={[s.etiqueta, s.marca]} />
      </View>
      {ejercicio.series.map((prescrita, n) => {
        const real = series.find((serie) => serie.serieId === prescrita.id)
        if (!real)
          return (
            <Text key={prescrita.id} style={[s.resumen, s.aviso]} accessibilityRole="alert">
              Serie {n + 1}: registro no disponible en esta copia.
            </Text>
          )
        const unidad = UNIDADES[prescrita.tipoMedicion].nombre
        const objetivo = cantidadObjetivo(prescrita)
        const actual = enCurso === prescrita.id
        const rir = real.rir ?? null
        const fueraDeObjetivo = rir !== null && rirObjetivo !== undefined && rir < rirObjetivo
        const corregible = mostrarRirPorSerie && real.hecha && !actual && !bloqueado
        const preguntar =
          mostrarRirPorSerie &&
          !bloqueado &&
          (actual || (corregible && corrigiendo === prescrita.id))
        const anotar = (valor: number | null): void => {
          cambiar(prescrita.id, { rir: valor })
          if (!actual) setCorrigiendo(null)
        }
        const sugerencia = `Sugerencia de tu entrenador: ${[
          prescrita.pesoKg === null ? null : kg(prescrita.pesoKg),
          `${objetivo} ${unidad.toLowerCase()}`,
          rirObjetivo === undefined ? null : `RIR ${rirObjetivo}`,
        ]
          .filter(Boolean)
          .join(", ")}.`
        return (
          <View key={prescrita.id} style={[s.serie, actual && s.serieActual]}>
            <View style={s.fila}>
              <Text
                style={[s.numero, s.numeroTexto, actual && s.numeroActual]}
                accessibilityLabel={`Serie ${n + 1}${actual ? ", serie en curso" : ""}: ${valoresLegibles(prescrita)}`}
              >
                {n + 1}
              </Text>
              {mostrarPeso && (
                <TextInput
                  accessibilityLabel={`Peso — ${ejercicio.nombre}, serie ${n + 1}`}
                  accessibilityHint={sugerencia}
                  editable={!bloqueado}
                  value={real.peso}
                  onChangeText={(peso) => cambiar(prescrita.id, { peso })}
                  placeholder={prescrita.pesoKg === null ? "—" : decimal(prescrita.pesoKg)}
                  placeholderTextColor={tema.marcador}
                  selectionColor={tema.acento}
                  keyboardType="decimal-pad"
                  maxLength={30}
                  style={[s.valor, s.campo, actual && s.campoActual, real.hecha && s.campoHecho]}
                />
              )}
              <TextInput
                accessibilityLabel={`${unidad} — ${ejercicio.nombre}, serie ${n + 1}`}
                accessibilityHint={sugerencia}
                editable={!bloqueado}
                value={real.valor}
                onChangeText={(valor) => cambiar(prescrita.id, { valor })}
                placeholder={String(objetivo)}
                placeholderTextColor={tema.marcador}
                selectionColor={tema.acento}
                keyboardType="number-pad"
                maxLength={30}
                style={[s.valor, s.campo, real.hecha && s.campoHecho]}
              />
              {mostrarRirPorSerie && (
                <Pressable
                  accessibilityRole={corregible ? "button" : undefined}
                  accessibilityLabel={`RIR, serie ${n + 1}: ${rir === null ? "sin anotar" : rir === 5 ? "5 o más" : rir}${fueraDeObjetivo ? ", menos del objetivo" : ""}`}
                  accessibilityHint={
                    corregible ? "Corrige o quita las repeticiones que te quedaban" : undefined
                  }
                  disabled={!corregible}
                  onPress={() => setCorrigiendo(corrigiendo === prescrita.id ? null : prescrita.id)}
                  style={[s.rir, s.campo, s.celdaRir, fueraDeObjetivo && s.rirFuera]}
                >
                  <Text
                    style={[
                      s.textoRir,
                      rir === null && s.textoRirObjetivo,
                      fueraDeObjetivo && s.textoRirFuera,
                    ]}
                  >
                    {rir === null ? (rirObjetivo ?? "—") : rir === 5 ? "5+" : rir}
                  </Text>
                </Pressable>
              )}
              <Pressable
                accessibilityRole="checkbox"
                aria-checked={real.hecha}
                accessibilityLabel={`Hecha — ${ejercicio.nombre}, serie ${n + 1}`}
                accessibilityState={{ checked: real.hecha, disabled: bloqueado }}
                disabled={bloqueado}
                onPress={() =>
                  cambiar(
                    prescrita.id,
                    real.hecha
                      ? { hecha: false }
                      : {
                          hecha: true,
                          omitida: undefined,
                          // La sugerencia del entrenador vale si no se escribió otra cosa.
                          ...(real.valor.trim() === "" && { valor: String(objetivo) }),
                          ...(real.peso.trim() === "" &&
                            mostrarPeso &&
                            prescrita.pesoKg !== null && { peso: decimal(prescrita.pesoKg) }),
                        },
                  )
                }
                style={[s.casilla, real.hecha && [s.marcada, degradadoExito]]}
              >
                {real.hecha && <Icono nombre="hecho" color={tema.sobreExito} tamano={18} />}
              </Pressable>
            </View>
            {!real.hecha && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${real.omitida ? "Recuperar" : "Omitir"} serie ${n + 1} — ${ejercicio.nombre}`}
                disabled={bloqueado}
                onPress={() =>
                  cambiar(prescrita.id, { hecha: false, omitida: real.omitida ? undefined : true })
                }
                style={s.omitir}
              >
                <Text style={s.textoOmitir}>
                  {real.omitida ? "Recuperar serie" : "Omitir serie"}
                </Text>
              </Pressable>
            )}
            {real.omitida && <Text style={s.resumen}>Serie omitida</Text>}
            {fueraDeObjetivo && rir !== null && rirObjetivo !== undefined && (
              <Text style={s.notaRir}>
                {rirObjetivo - rir === 1 ? "Una menos" : `${rirObjetivo - rir} menos`} del objetivo
              </Text>
            )}
            {preguntar && (
              <View style={s.pregunta}>
                <Text style={s.textoPregunta}>¿Cuántas te quedaban?</Text>
                <Opciones
                  etiqueta={`Repeticiones que te quedaban, serie ${n + 1}`}
                  opciones={RIRS}
                  valor={rir}
                  cambiar={anotar}
                />
                {rir !== null && (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Sin anotar el RIR de la serie ${n + 1}`}
                    onPress={() => anotar(null)}
                    style={s.omitir}
                  >
                    <Text style={s.textoOmitir}>Sin anotar</Text>
                  </Pressable>
                )}
              </View>
            )}
          </View>
        )
      })}
      {modoRir === "alFinalizarEjercicio" && ejercicioResuelto && ultimaHecha && !bloqueado && (
        <View style={s.pregunta}>
          <Text style={s.textoPregunta}>
            Al terminar este ejercicio, ¿cuántas te quedaban? (opcional)
          </Text>
          <Opciones
            etiqueta={`Repeticiones que te quedaban al terminar ${ejercicio.nombre}`}
            opciones={RIRS}
            valor={series.find((r) => r.serieId === ultimaHecha.id)?.rir ?? null}
            cambiar={(valor) => cambiar(ultimaHecha.id, { rir: valor })}
          />
        </View>
      )}
    </View>
  )
}

const s = StyleSheet.create({
  bloque: { gap: 12 },
  cabecera: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  titulos: { flex: 1, gap: 4 },
  nombre: { fontFamily: tema.fuenteBoton, fontSize: 20, lineHeight: 25, color: tema.texto },
  resumen: { fontFamily: tema.fuenteTexto, fontSize: 13, lineHeight: 18, color: tema.textoTenue },
  aviso: { color: tema.aviso },
  tecnica: { minHeight: 44, justifyContent: "center" },
  textoTecnica: { fontFamily: tema.fuenteBoton, fontSize: 15, color: tema.acento },
  anterior: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
  diferencia: { fontFamily: tema.fuenteSemi, fontSize: 13, color: tema.acento },
  fila: { flexDirection: "row", gap: 8, alignItems: "center" },
  serie: { gap: 8 },
  serieActual: {
    backgroundColor: tema.superficie,
    borderRadius: 14,
    padding: 10,
    marginHorizontal: -10,
  },
  etiqueta: {
    fontFamily: tema.fuenteTexto,
    fontSize: 12,
    color: tema.textoTenue,
    textAlign: "center",
  },
  numero: { width: 28 },
  numeroTexto: {
    fontFamily: tema.fuenteSemi,
    fontSize: 15,
    textAlign: "center",
    color: tema.textoTenue,
  },
  numeroActual: { color: tema.acento, fontFamily: tema.fuenteBoton },
  valor: { flex: 1, minWidth: 0 },
  rir: { width: 56 },
  marca: { width: 44 },
  campo: {
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: tema.bordeFuerte,
    backgroundColor: tema.superficie,
    color: tema.texto,
    fontSize: 17,
    fontFamily: tema.fuenteBoton,
    textAlign: "center",
    paddingHorizontal: 2,
  },
  campoActual: { borderColor: tema.acento },
  campoHecho: { color: tema.texto },
  celdaRir: { alignItems: "center", justifyContent: "center" },
  textoRir: { color: tema.texto, fontFamily: tema.fuenteBoton, fontSize: 17 },
  rirFuera: {
    borderStyle: "dashed",
    borderWidth: 1.5,
    borderColor: tema.aviso,
    backgroundColor: tema.acentoSuave,
  },
  textoRirObjetivo: { color: tema.marcador },
  textoRirFuera: { color: tema.aviso },
  notaRir: {
    fontFamily: tema.fuenteTexto,
    fontSize: 12,
    color: tema.aviso,
    textAlign: "right",
  },
  casilla: {
    width: 44,
    height: 44,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: tema.bordeFuerte,
  },
  marcada: { borderColor: "transparent" },
  pregunta: { gap: 8 },
  omitir: { minHeight: 36, alignSelf: "flex-end", justifyContent: "center" },
  textoOmitir: { color: tema.textoTenue, fontFamily: tema.fuenteTexto, fontSize: 13 },
  textoPregunta: { fontFamily: tema.fuenteTexto, fontSize: 13, color: tema.textoTenue },
})
