import { useEffect, useRef, useState } from "react"
import { Keyboard, Pressable, StyleSheet, Switch, Text, TextInput, View } from "react-native"

import { ChipsRir } from "../../componentes/chips-rir"
import { Icono } from "../../componentes/iconos"
import { Enlace } from "../../entrenamiento/sesion/controles"
import { alto, radio, tema } from "../../tema"
import type { TipoMedicion } from "../editor-modelo"
import {
  EditorNumero,
  numeroDeTexto,
  SelectorDescanso,
  textoDeRango,
  type CampoPrescripcion,
} from "./ajuste-prescripcion"
import { leerRango, type EjercicioDelConstructor } from "./modelo"

type Cambio = (id: string, cambio: Partial<EjercicioDelConstructor>) => void

/** Cómo se nombra el objetivo en cada unidad: campo, columna, abreviatura y marcador. */
export const UNIDADES_DE_FILA = {
  repeticiones: { nombre: "Repeticiones", columna: "Reps", corta: "reps", marcador: "8–10" },
  tiempo: { nombre: "Segundos", columna: "Seg", corta: "s", marcador: "s" },
  distancia: { nombre: "Metros", columna: "Metros", corta: "m", marcador: "m" },
} as const satisfies Record<
  TipoMedicion,
  { nombre: string; columna: string; corta: string; marcador: string }
>

/** Las unidades que se ofrecen al pautar; los metros, desde D01.g. */
const UNIDADES_OFRECIDAS: readonly TipoMedicion[] = ["repeticiones", "tiempo", "distancia"]

/** «8–10», «30 s» o «20 m»: las repeticiones van sin unidad, como en el diseño. */
export function objetivoConUnidad(e: Pick<EjercicioDelConstructor, "tipo" | "objetivo">): string {
  if (e.tipo === "repeticiones" || e.objetivo.trim() === "") return e.objetivo
  return `${e.objetivo} ${UNIDADES_DE_FILA[e.tipo].corta}`
}

/**
 * La pauta de una fila en una línea: «4 × 8–10», «2 × 20 m» o la dosis de un
 * calentamiento. Una fila que mezcla unidades no se resume con la primera.
 */
export function pautaDeFila(
  e: Pick<
    EjercicioDelConstructor,
    "seccion" | "series" | "tipo" | "objetivo" | "dosis" | "mezclaUnidades" | "seriesDistintas"
  >,
): string {
  if (e.mezclaUnidades) return "Mezcla unidades: revisar"
  if (e.seriesDistintas) return "Series distintas: revisar"
  return e.seccion === "principal"
    ? `${e.series} × ${objetivoConUnidad(e)}`
    : e.dosis || objetivoConUnidad(e)
}

/** «Reps», «Seg», «Metros» o, si la tabla mezcla unidades, «Reps / Metros». */
function columnaDeObjetivo(ejercicios: EjercicioDelConstructor[]): string {
  const unidades = new Set(ejercicios.map((e) => e.tipo))
  if (unidades.size === 0) return UNIDADES_DE_FILA.repeticiones.columna
  return (["repeticiones", "tiempo", "distancia"] as const)
    .filter((unidad) => unidades.has(unidad))
    .map((unidad) => UNIDADES_DE_FILA[unidad].columna)
    .join(" / ")
}

/** Celda de texto compacta de la tabla. */
export function Celda({
  valor,
  cambiar,
  etiqueta,
  ancho,
  teclado = "default",
  marcador,
  maximo = 40,
}: {
  valor: string
  cambiar: (texto: string) => void
  etiqueta: string
  ancho?: number
  teclado?: "default" | "number-pad" | "decimal-pad"
  marcador?: string
  maximo?: number
}): React.JSX.Element {
  return (
    <TextInput
      accessibilityLabel={etiqueta}
      value={valor}
      onChangeText={cambiar}
      keyboardType={teclado}
      placeholder={marcador}
      placeholderTextColor={tema.marcador}
      selectionColor={tema.acento}
      maxLength={maximo}
      style={[s.celda, ancho !== undefined ? { width: ancho } : s.flex]}
    />
  )
}

/** «Parte principal»: cinco celdas que abren el ajuste sin desplegar teclado. */
export function TablaPrincipal({
  ejercicios,
  elegido,
  elegir,
  ajustar,
  quitar,
  mover,
}: {
  ejercicios: EjercicioDelConstructor[]
  elegido: string | null
  elegir: (id: string) => void
  cambiar: Cambio
  ajustar: (id: string, campo: CampoPrescripcion) => void
  quitar: (id: string) => void
  mover: (id: string, desplazamiento: number) => void
  ancha: boolean
}): React.JSX.Element {
  return (
    <View style={s.tabla}>
      {ejercicios.map((e, n) => {
        const activo = e.id === elegido
        const celdas: [CampoPrescripcion, string, string][] = [
          ["series", `Series de ${e.nombre}`, e.series],
          ["objetivo", `${UNIDADES_DE_FILA[e.tipo].nombre} de ${e.nombre}`, e.objetivo],
          ["rir", `RIR de ${e.nombre}`, e.rir],
          ["descanso", `Descanso de ${e.nombre}`, e.descanso],
          [
            "carga",
            e.calibrar && e.tipoCarga !== "sinCarga"
              ? `Carga inicial de ${e.nombre}: calibrar. Tocar para fijar una carga`
              : `Carga inicial de ${e.nombre} en kg`,
            e.tipoCarga === "sinCarga" ? "Sin carga" : e.calibrar ? "Calibrar" : e.carga,
          ],
        ]
        return (
          <View key={e.id} style={[s.renglon, activo && s.renglonActivo]}>
            <View style={s.lineaNombre}>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: activo }}
                accessibilityLabel={`${e.nombre}: editar detalles`}
                onPress={() => elegir(e.id)}
                style={s.nombrePulsable}
              >
                <Text style={s.nombre}>{e.nombre}</Text>
                {e.mezclaUnidades && <Text style={s.aviso}>Mezcla unidades: revisar</Text>}
                {e.seriesDistintas && <Text style={s.aviso}>Series distintas: revisar</Text>}
                {/* Las repeticiones son lo habitual; otra unidad se dice en la fila. */}
                {!e.mezclaUnidades && e.tipo !== "repeticiones" && (
                  <Text style={s.tenue}>En {UNIDADES_DE_FILA[e.tipo].nombre.toLowerCase()}</Text>
                )}
                {e.compuesto && <Text style={s.tenue}>Compuesto</Text>}
              </Pressable>
              <View style={s.acciones}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Subir ${e.nombre}`}
                  disabled={n === 0}
                  onPress={() => mover(e.id, -1)}
                  style={s.accion}
                >
                  <View style={s.girarArriba}>
                    <Icono
                      nombre="adelante"
                      color={n === 0 ? tema.borde : tema.textoTenue}
                      tamano={16}
                    />
                  </View>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Bajar ${e.nombre}`}
                  disabled={n === ejercicios.length - 1}
                  onPress={() => mover(e.id, 1)}
                  style={s.accion}
                >
                  <View style={s.girarAbajo}>
                    <Icono
                      nombre="adelante"
                      color={n === ejercicios.length - 1 ? tema.borde : tema.textoTenue}
                      tamano={16}
                    />
                  </View>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Quitar ${e.nombre}`}
                  onPress={() => quitar(e.id)}
                  style={s.quitar}
                >
                  <Text style={s.tenue}>Quitar</Text>
                </Pressable>
              </View>
            </View>
            {n === 0 && (
              <View style={[s.fila, s.cabecera]} accessible={false}>
                {["Series", columnaDeObjetivo(ejercicios), "RIR", "Desc.", "Kg"].map((texto) => (
                  <Text key={texto} style={[s.etiqueta, s.columna]}>
                    {texto}
                  </Text>
                ))}
              </View>
            )}
            <View style={s.celdasEstrechas}>
              {celdas.map(([campo, etiqueta, valor]) => (
                <Pressable
                  key={campo}
                  accessibilityRole="button"
                  accessibilityLabel={etiqueta}
                  accessibilityValue={{ text: valor || "Sin fijar" }}
                  accessibilityState={{ disabled: campo === "carga" && e.tipoCarga === "sinCarga" }}
                  disabled={campo === "carga" && e.tipoCarga === "sinCarga"}
                  onPress={() => ajustar(e.id, campo)}
                  style={[
                    s.celdaPulsable,
                    campo === "carga" && e.calibrar && e.tipoCarga !== "sinCarga" && s.calibrar,
                  ]}
                >
                  <Text
                    numberOfLines={2}
                    adjustsFontSizeToFit
                    minimumFontScale={0.65}
                    style={[
                      s.valorCelda,
                      campo === "carga" &&
                        e.calibrar &&
                        e.tipoCarga !== "sinCarga" &&
                        s.textoCalibrar,
                    ]}
                  >
                    {valor || "—"}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        )
      })}
    </View>
  )
}

/** El panel del ejercicio elegido: compuesto, nota, alternativas y técnica. */
export function PanelEjercicio({
  ejercicio,
  nombreCliente,
  cambiar,
  verTecnica,
  alListo,
  alCambiarValidez,
}: {
  ejercicio: EjercicioDelConstructor
  nombreCliente: string
  cambiar: Cambio
  verTecnica: () => void
  alListo?: () => void
  alCambiarValidez?: (valida: boolean) => void
}): React.JSX.Element {
  const primerNombre = nombreCliente.split(" ")[0] ?? nombreCliente
  const [mas, setMas] = useState(false)
  const [invalidos, setInvalidos] = useState<Record<string, boolean>>({})
  const avisar = useRef(alCambiarValidez)
  avisar.current = alCambiarValidez
  const valido = !Object.values(invalidos).some(Boolean)
  useEffect(() => {
    avisar.current?.(valido)
  }, [valido])
  useEffect(() => () => avisar.current?.(true), [])
  const validez = (campo: string, valida: boolean): void =>
    setInvalidos((actual) => (actual[campo] === !valida ? actual : { ...actual, [campo]: !valida }))
  const objetivo = leerRango(ejercicio.objetivo)
  const rir = leerRango(ejercicio.rir)
  const unidad = UNIDADES_DE_FILA[ejercicio.tipo].columna
  const cambiarObjetivo = (min: number, max: number): void =>
    cambiar(ejercicio.id, { objetivo: textoDeRango(min, max) })
  return (
    <View style={s.panel}>
      <Text style={s.tituloPanel}>{ejercicio.nombre}</Text>
      {ejercicio.seriesDistintas && (
        <View>
          <Text style={s.aviso}>
            La sesión guardada tiene cargas u objetivos distintos entre sus series. Revísala en el
            editor de sesión o decide pautar todas las series por igual.
          </Text>
          <Enlace
            texto="Pautar todas las series por igual"
            onPress={() =>
              cambiar(ejercicio.id, { seriesDistintas: undefined, objetivo: "", carga: "" })
            }
          />
        </View>
      )}
      {ejercicio.seccion !== "principal" && (
        <>
          <Text style={s.etiquetaPanel}>Dosis</Text>
          <TextInput
            accessibilityLabel={`Cómo se hace ${ejercicio.nombre}`}
            value={ejercicio.dosis}
            onChangeText={(dosis) => cambiar(ejercicio.id, { dosis })}
            maxLength={60}
            placeholder="1 × 8 por lado"
            placeholderTextColor={tema.marcador}
            style={s.campo}
          />
        </>
      )}
      <EditorNumero
        titulo="Series"
        etiqueta={`Series de ${ejercicio.nombre}`}
        valor={numeroDeTexto(ejercicio.series)}
        minimo={1}
        maximo={30}
        cambiar={(n) => cambiar(ejercicio.id, { series: String(n) })}
        alCambiarValidez={(v) => validez("series", v)}
      />
      <EditorNumero
        titulo={ejercicio.tipo === "repeticiones" ? `${unidad} mín.` : unidad}
        etiqueta={`${ejercicio.tipo === "repeticiones" ? `${unidad} mín.` : unidad} de ${ejercicio.nombre}`}
        valor={objetivo?.min ?? null}
        minimo={1}
        maximo={
          ejercicio.tipo === "repeticiones"
            ? (objetivo?.max ?? 10000)
            : ejercicio.tipo === "tiempo"
              ? 86400
              : 100000
        }
        cambiar={(n) =>
          cambiarObjetivo(n, ejercicio.tipo === "repeticiones" ? (objetivo?.max ?? n) : n)
        }
        alCambiarValidez={(v) => validez("min", v)}
      />
      {ejercicio.tipo === "repeticiones" && (
        <EditorNumero
          titulo={`${unidad} máx.`}
          etiqueta={`${unidad} máx. de ${ejercicio.nombre}`}
          valor={objetivo?.max ?? null}
          minimo={objetivo?.min ?? 1}
          maximo={10000}
          cambiar={(n) => cambiarObjetivo(objetivo?.min ?? n, n)}
          alCambiarValidez={(v) => validez("max", v)}
        />
      )}
      {ejercicio.tipoCarga === "sinCarga" ? (
        <Text style={s.tenue}>Sin carga</Text>
      ) : (
        <>
          <EditorNumero
            titulo={ejercicio.calibrar ? "Carga inicial · Calibrar" : "Carga inicial"}
            etiqueta={`Carga inicial de ${ejercicio.nombre} en kg`}
            valor={numeroDeTexto(ejercicio.carga)}
            decimal
            paso={numeroDeTexto(ejercicio.subida) || 2.5}
            maximo={1000}
            cambiar={(n) =>
              cambiar(ejercicio.id, { carga: String(n).replace(".", ","), calibrar: false })
            }
            alVaciar={() => cambiar(ejercicio.id, { carga: "", calibrar: false })}
            alCambiarValidez={(v) => validez("carga", v)}
          />
          <Text style={s.etiquetaPanel}>Subida (kg)</Text>
          <View style={s.opcionesPanel}>
            {["1", "2,5", "5"].map((subida) => (
              <Pressable
                key={subida}
                accessibilityRole="button"
                accessibilityLabel={`Subida ${subida} kg`}
                accessibilityState={{
                  selected: numeroDeTexto(ejercicio.subida) === numeroDeTexto(subida),
                }}
                onPress={() => cambiar(ejercicio.id, { subida })}
                style={[
                  s.chip,
                  numeroDeTexto(ejercicio.subida) === numeroDeTexto(subida) && s.chipElegido,
                ]}
              >
                <Text style={s.textoChip}>{subida}</Text>
              </Pressable>
            ))}
          </View>
        </>
      )}
      <Text style={s.etiquetaPanel}>RIR objetivo</Text>
      <ChipsRir
        valor={rir && rir.min === rir.max ? rir.min : null}
        etiqueta={`RIR objetivo de ${ejercicio.nombre}`}
        cambiar={(n) => cambiar(ejercicio.id, { rir: String(n) })}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Sin objetivo"
        onPress={() => cambiar(ejercicio.id, { rir: "" })}
        style={s.mas}
      >
        <Text style={s.textoChip}>Sin objetivo</Text>
      </Pressable>
      <Text style={s.etiquetaPanel}>Descanso</Text>
      <SelectorDescanso
        valor={ejercicio.descanso}
        nombre={ejercicio.nombre}
        cambiar={(descanso) => cambiar(ejercicio.id, { descanso })}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Más"
        accessibilityState={{ expanded: mas }}
        onPress={() => setMas(!mas)}
        style={s.mas}
      >
        <Text style={s.textoChip}>Más {mas ? "−" : "+"}</Text>
      </Pressable>
      {mas && (
        <View style={s.detalles}>
          <Text style={s.etiquetaPanel}>Preguntar RIR (respuesta opcional)</Text>
          <View style={s.opcionesPanel}>
            {(
              [
                ["desactivado", "Desactivado"],
                ["alFinalizarEjercicio", "Al finalizar ejercicio"],
                ["cadaSerie", "Cada serie"],
              ] as const
            ).map(([modo, etiqueta]) => (
              <Enlace
                key={modo}
                texto={`${ejercicio.modoRir === modo ? "✓ " : ""}${etiqueta}`}
                etiqueta={`RIR ${etiqueta.toLowerCase()} de ${ejercicio.nombre}`}
                onPress={() => cambiar(ejercicio.id, { modoRir: modo })}
              />
            ))}
          </View>
          <Text style={s.etiquetaPanel}>Tipo de carga</Text>
          <View style={s.opcionesPanel}>
            <Enlace
              texto={`${ejercicio.tipoCarga !== "sinCarga" ? "✓ " : ""}Con carga externa`}
              etiqueta={`Con carga externa de ${ejercicio.nombre}`}
              onPress={() => cambiar(ejercicio.id, { tipoCarga: "conCargaExterna" })}
            />
            <Enlace
              texto={`${ejercicio.tipoCarga === "sinCarga" ? "✓ " : ""}Sin carga externa`}
              etiqueta={`Sin carga externa de ${ejercicio.nombre}`}
              onPress={() =>
                cambiar(ejercicio.id, {
                  tipoCarga: "sinCarga",
                  calibrar: false,
                  carga: "",
                  subida: "",
                })
              }
            />
          </View>
          {ejercicio.tipoCarga !== "sinCarga" && (
            <EditorNumero
              titulo="Subida (kg)"
              etiqueta={`Subida de ${ejercicio.nombre} en kg`}
              valor={numeroDeTexto(ejercicio.subida)}
              decimal
              minimo={0.01}
              maximo={50}
              paso={0.25}
              cambiar={(n) => cambiar(ejercicio.id, { subida: String(n).replace(".", ",") })}
              alVaciar={() => cambiar(ejercicio.id, { subida: "" })}
              alCambiarValidez={(v) => validez("subida", v)}
            />
          )}
          <View style={s.conmutador}>
            <Text style={[s.tenue, s.flex]}>
              {ejercicio.compuesto
                ? "Compuesto · nunca se recorta"
                : "Accesorio · se recorta primero"}
            </Text>
            <Switch
              accessibilityLabel="Ejercicio compuesto: nunca se recorta"
              hitSlop={8}
              value={ejercicio.compuesto}
              onValueChange={(v) => cambiar(ejercicio.id, { compuesto: v })}
              trackColor={{ true: tema.acento, false: tema.superficieAlta }}
              thumbColor={tema.texto}
            />
          </View>
          <View style={s.conmutador}>
            <Text style={[s.tenue, s.flex]}>Calibrar la carga las primeras sesiones</Text>
            <Switch
              accessibilityLabel="Calibrar la carga"
              hitSlop={8}
              value={ejercicio.tipoCarga !== "sinCarga" && ejercicio.calibrar}
              disabled={ejercicio.tipoCarga === "sinCarga"}
              onValueChange={(v) => cambiar(ejercicio.id, { calibrar: v })}
              trackColor={{ true: tema.acento, false: tema.superficieAlta }}
              thumbColor={tema.texto}
            />
          </View>
          <Text style={s.etiquetaPanel}>Se mide en</Text>
          {ejercicio.mezclaUnidades && (
            <Text style={s.aviso}>
              La sesión guardada pauta este ejercicio en varias unidades. Elige una para todas sus
              series o revísalo en el editor de sesión.
            </Text>
          )}
          <View style={s.opcionesPanel}>
            {UNIDADES_OFRECIDAS.map((unidad) => (
              <Enlace
                key={unidad}
                texto={`${ejercicio.tipo === unidad ? "✓ " : ""}${UNIDADES_DE_FILA[unidad].nombre}`}
                etiqueta={`Medir ${ejercicio.nombre} en ${UNIDADES_DE_FILA[unidad].nombre.toLowerCase()}`}
                // El objetivo de otra unidad no se reutiliza: 20 m nunca pasan a 20 repeticiones.
                // Con unidades mezcladas, elegir cualquiera (también la mostrada) es la
                // decisión explícita de pautar todas las series en ella.
                onPress={() => {
                  if (ejercicio.mezclaUnidades)
                    cambiar(ejercicio.id, { tipo: unidad, objetivo: "", mezclaUnidades: undefined })
                  else if (unidad !== ejercicio.tipo)
                    cambiar(ejercicio.id, { tipo: unidad, objetivo: "" })
                }}
              />
            ))}
          </View>
          <Text style={s.etiquetaPanel}>Nota para {primerNombre}</Text>
          <TextInput
            accessibilityLabel={`Nota para ${primerNombre}`}
            value={ejercicio.nota}
            onChangeText={(v) => cambiar(ejercicio.id, { nota: v })}
            placeholder="Orientativo: 60 kg para 4 × 6 si completas con RIR 3."
            placeholderTextColor={tema.marcador}
            multiline
            maxLength={300}
            style={s.area}
          />
          <Text style={s.etiquetaPanel}>Alternativas si molesta (una por línea)</Text>
          <TextInput
            accessibilityLabel="Alternativas si molesta"
            value={ejercicio.alternativas}
            onChangeText={(v) => cambiar(ejercicio.id, { alternativas: v })}
            placeholder={"Press en multipower\nPress con mancuernas"}
            placeholderTextColor={tema.marcador}
            multiline
            maxLength={400}
            style={s.area}
          />
          <Text style={s.etiquetaPanel}>Indicaciones</Text>
          <TextInput
            accessibilityLabel={`Indicaciones de ${ejercicio.nombre}`}
            value={ejercicio.indicaciones}
            onChangeText={(indicaciones) => cambiar(ejercicio.id, { indicaciones })}
            multiline
            maxLength={2000}
            style={s.area}
          />
          <Enlace texto="Ver técnica en la biblioteca" onPress={verTecnica} />
        </View>
      )}
      {alListo && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Listo"
          accessibilityState={{ disabled: !valido }}
          disabled={!valido}
          onPress={() => {
            Keyboard.dismiss()
            alListo()
          }}
          style={s.listo}
        >
          <Text style={s.textoChip}>Listo</Text>
        </Pressable>
      )}
    </View>
  )
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  tabla: { gap: 2 },
  fila: { flexDirection: "row", alignItems: "center", gap: 8 },
  cabecera: { width: "100%", gap: 6 },
  lineaNombre: { flexDirection: "row", alignItems: "center", width: "100%", gap: 8 },
  etiqueta: {
    color: tema.textoTenue,
    fontFamily: tema.fuenteSemi,
    fontSize: 11,
    textAlign: "center",
  },
  columna: { flex: 1, minWidth: 0 },
  renglon: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 8,
    padding: 12,
    borderRadius: 14,
  },
  renglonActivo: { backgroundColor: tema.superficieAlta },
  nombre: { color: tema.texto, fontFamily: tema.fuenteBoton, fontSize: 17 },
  nombrePulsable: { minHeight: alto.tactil, flex: 1, minWidth: 0, justifyContent: "center" },
  tenue: { color: tema.textoTenue, fontFamily: tema.fuenteTexto, fontSize: 13 },
  celdas: { flexDirection: "row", gap: 8 },
  celdasEstrechas: { flexDirection: "row", gap: 6, width: "100%" },
  celdaPulsable: {
    flex: 1,
    minWidth: 0,
    minHeight: alto.celda,
    paddingHorizontal: 2,
    borderRadius: radio.celda,
    borderWidth: 1,
    borderColor: tema.borde,
    backgroundColor: tema.superficie,
    justifyContent: "center",
    alignItems: "center",
  },
  valorCelda: {
    color: tema.texto,
    fontFamily: tema.fuenteBoton,
    fontSize: 15,
    textAlign: "center",
    fontVariant: ["tabular-nums"],
  },
  celda: {
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: tema.bordeFuerte,
    backgroundColor: tema.hundido,
    color: tema.texto,
    fontFamily: tema.fuenteBoton,
    fontSize: 14,
    textAlign: "center",
    paddingHorizontal: 4,
  },
  calibrar: {
    justifyContent: "center",
    alignItems: "center",
    borderStyle: "dashed",
    borderColor: tema.aviso,
  },
  textoCalibrar: { color: tema.aviso, fontFamily: tema.fuenteBoton, fontSize: 13 },
  aviso: { color: tema.aviso, fontFamily: tema.fuenteSemi, fontSize: 13, lineHeight: 18 },
  acciones: { flexDirection: "row", alignItems: "center", gap: 4 },
  accion: {
    width: alto.tactil,
    height: alto.tactil,
    alignItems: "center",
    justifyContent: "center",
  },
  quitar: {
    minHeight: alto.tactil,
    minWidth: alto.tactil,
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  girarArriba: { transform: [{ rotate: "-90deg" }] },
  girarAbajo: { transform: [{ rotate: "90deg" }] },
  panel: {
    gap: 16,
  },
  tituloPanel: { color: tema.texto, fontFamily: tema.fuenteBoton, fontSize: 17 },
  conmutador: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 44 },
  opcionesPanel: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  detalles: { gap: 10 },
  chip: {
    minHeight: alto.tactil,
    minWidth: alto.tactil,
    paddingHorizontal: 12,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: radio.celda,
    borderWidth: 1,
    borderColor: tema.bordeFuerte,
  },
  chipElegido: { borderColor: tema.acento, backgroundColor: tema.acentoSuave },
  textoChip: { color: tema.acento, fontFamily: tema.fuenteSemi, fontSize: 14 },
  mas: { minHeight: alto.tactil, justifyContent: "center" },
  listo: { minHeight: alto.tactil, justifyContent: "center", alignItems: "flex-end" },
  campo: {
    minHeight: alto.campo,
    padding: 12,
    borderRadius: radio.campo,
    borderWidth: 1,
    borderColor: tema.bordeFuerte,
    color: tema.texto,
    fontFamily: tema.fuenteTexto,
  },
  etiquetaPanel: { color: tema.texto, fontFamily: tema.fuenteSemi, fontSize: 14, marginTop: 4 },
  area: {
    minHeight: 72,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: tema.bordeFuerte,
    backgroundColor: tema.hundido,
    color: tema.texto,
    fontFamily: tema.fuenteTexto,
    fontSize: 14,
    padding: 10,
    textAlignVertical: "top",
  },
})
