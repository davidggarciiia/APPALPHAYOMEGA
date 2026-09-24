import { Pressable, StyleSheet, Switch, Text, TextInput, View } from "react-native"

import { Icono } from "../../componentes/iconos"
import { Enlace } from "../../entrenamiento/sesion/controles"
import { tema } from "../../tema"
import type { TipoMedicion } from "../editor-modelo"
import type { EjercicioDelConstructor } from "./modelo"

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

/** Las unidades que se ofrecen al pautar. D01.g añade «distancia» al activar los metros. */
const UNIDADES_OFRECIDAS: readonly TipoMedicion[] = ["repeticiones", "tiempo"]

/** Las ofrecidas y, si la fila ya usa otra, también esa: se muestra marcada y no se pierde. */
function unidadesDe(actual: TipoMedicion): readonly TipoMedicion[] {
  return UNIDADES_OFRECIDAS.includes(actual) ? UNIDADES_OFRECIDAS : [...UNIDADES_OFRECIDAS, actual]
}

/** «8–10», «30 s» o «20 m»: las repeticiones van sin unidad, como en el diseño. */
export function objetivoConUnidad(e: Pick<EjercicioDelConstructor, "tipo" | "objetivo">): string {
  if (e.tipo === "repeticiones" || e.objetivo.trim() === "") return e.objetivo
  return `${e.objetivo} ${UNIDADES_DE_FILA[e.tipo].corta}`
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
}: {
  valor: string
  cambiar: (texto: string) => void
  etiqueta: string
  ancho?: number
  teclado?: "default" | "number-pad" | "decimal-pad"
  marcador?: string
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
      maxLength={40}
      style={[s.celda, ancho !== undefined ? { width: ancho } : s.flex]}
    />
  )
}

/** `null` es la columna del objetivo, que se nombra según la unidad de las filas. */
const COLUMNAS = [
  ["Series", 56],
  [null, 70],
  ["RIR", 56],
  ["Descanso", 84],
  ["Carga inicial", 96],
  ["Subida", 64],
] as const

/** «Parte principal» del constructor: una fila editable por ejercicio. */
export function TablaPrincipal({
  ejercicios,
  elegido,
  elegir,
  cambiar,
  quitar,
  mover,
  ancha,
}: {
  ejercicios: EjercicioDelConstructor[]
  elegido: string | null
  elegir: (id: string) => void
  cambiar: Cambio
  quitar: (id: string) => void
  mover: (id: string, desplazamiento: number) => void
  ancha: boolean
}): React.JSX.Element {
  return (
    <View style={s.tabla}>
      {ancha && (
        <View style={[s.fila, s.cabecera]} accessible={false}>
          <Text style={[s.flex, s.etiqueta]}>Ejercicio</Text>
          {COLUMNAS.map(([texto, ancho]) => (
            <Text key={texto ?? "objetivo"} style={[s.etiqueta, { width: ancho }]}>
              {texto ?? columnaDeObjetivo(ejercicios)}
            </Text>
          ))}
        </View>
      )}
      {ejercicios.map((e, n) => {
        const activo = e.id === elegido
        const celdas = (
          <>
            <Celda
              etiqueta={`Series de ${e.nombre}`}
              valor={e.series}
              cambiar={(v) => cambiar(e.id, { series: v })}
              ancho={56}
              teclado="number-pad"
            />
            <Celda
              etiqueta={`${UNIDADES_DE_FILA[e.tipo].nombre} de ${e.nombre}`}
              valor={e.objetivo}
              cambiar={(v) => cambiar(e.id, { objetivo: v })}
              ancho={70}
              marcador={UNIDADES_DE_FILA[e.tipo].marcador}
            />
            <Celda
              etiqueta={`RIR de ${e.nombre}`}
              valor={e.rir}
              cambiar={(v) => cambiar(e.id, { rir: v })}
              ancho={56}
              marcador="2–3"
            />
            <Celda
              etiqueta={`Descanso de ${e.nombre}`}
              valor={e.descanso}
              cambiar={(v) => cambiar(e.id, { descanso: v })}
              ancho={84}
              marcador="2 min"
            />
            {e.tipoCarga === "sinCarga" ? (
              <View style={[s.celda, s.calibrar, { width: 96 }]}>
                <Text style={s.textoCalibrar}>Sin carga</Text>
              </View>
            ) : e.calibrar ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Carga inicial de ${e.nombre}: calibrar. Tocar para fijar una carga`}
                onPress={() => cambiar(e.id, { calibrar: false })}
                style={[s.celda, s.calibrar, { width: 96 }]}
              >
                <Text style={s.textoCalibrar}>Calibrar</Text>
              </Pressable>
            ) : (
              <Celda
                etiqueta={`Carga inicial de ${e.nombre} en kg`}
                valor={e.carga}
                cambiar={(v) => cambiar(e.id, { carga: v })}
                ancho={96}
                teclado="decimal-pad"
                marcador="kg"
              />
            )}
            {e.tipoCarga === "sinCarga" ? (
              <View style={[s.celda, s.calibrar, { width: 64 }]}>
                <Text style={s.textoCalibrar}>—</Text>
              </View>
            ) : (
              <Celda
                etiqueta={`Subida de ${e.nombre} en kg`}
                valor={e.subida}
                cambiar={(v) => cambiar(e.id, { subida: v })}
                ancho={64}
                teclado="decimal-pad"
                marcador="kg"
              />
            )}
          </>
        )
        return (
          <View key={e.id} style={[s.renglon, activo && s.renglonActivo]}>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: activo }}
              accessibilityLabel={`${e.nombre}: editar detalles`}
              onPress={() => elegir(e.id)}
              style={ancha ? s.flex : undefined}
            >
              <Text style={s.nombre}>{e.nombre}</Text>
              {/* Las repeticiones son lo habitual; otra unidad se dice en la fila. */}
              {e.tipo !== "repeticiones" && (
                <Text style={s.tenue}>En {UNIDADES_DE_FILA[e.tipo].nombre.toLowerCase()}</Text>
              )}
              {e.compuesto && <Text style={s.tenue}>Compuesto</Text>}
            </Pressable>
            {ancha ? (
              <View style={s.celdas}>{celdas}</View>
            ) : (
              <View style={s.celdasEstrechas}>{celdas}</View>
            )}
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
              <Enlace texto="Quitar" etiqueta={`Quitar ${e.nombre}`} onPress={() => quitar(e.id)} />
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
}: {
  ejercicio: EjercicioDelConstructor
  nombreCliente: string
  cambiar: Cambio
  verTecnica: () => void
}): React.JSX.Element {
  const primerNombre = nombreCliente.split(" ")[0] ?? nombreCliente
  return (
    <View style={s.panel}>
      <Text style={s.tituloPanel}>{ejercicio.nombre}</Text>
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
            cambiar(ejercicio.id, { tipoCarga: "sinCarga", calibrar: false, carga: "", subida: "" })
          }
        />
      </View>
      <View style={s.conmutador}>
        <Text style={[s.tenue, s.flex]}>
          {ejercicio.compuesto ? "Compuesto · nunca se recorta" : "Accesorio · se recorta primero"}
        </Text>
        <Switch
          accessibilityLabel="Ejercicio compuesto: nunca se recorta"
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
          value={ejercicio.tipoCarga !== "sinCarga" && ejercicio.calibrar}
          disabled={ejercicio.tipoCarga === "sinCarga"}
          onValueChange={(v) => cambiar(ejercicio.id, { calibrar: v })}
          trackColor={{ true: tema.acento, false: tema.superficieAlta }}
          thumbColor={tema.texto}
        />
      </View>
      <Text style={s.etiquetaPanel}>Se mide en</Text>
      <View style={s.opcionesPanel}>
        {unidadesDe(ejercicio.tipo).map((unidad) => (
          <Enlace
            key={unidad}
            texto={`${ejercicio.tipo === unidad ? "✓ " : ""}${UNIDADES_DE_FILA[unidad].nombre}`}
            etiqueta={`Medir ${ejercicio.nombre} en ${UNIDADES_DE_FILA[unidad].nombre.toLowerCase()}`}
            // El objetivo de otra unidad no se reutiliza: 20 m nunca pasan a 20 repeticiones.
            onPress={() => {
              if (unidad !== ejercicio.tipo) cambiar(ejercicio.id, { tipo: unidad, objetivo: "" })
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
      <Enlace texto="Ver técnica en la biblioteca" onPress={verTecnica} />
    </View>
  )
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  tabla: { gap: 2 },
  fila: { flexDirection: "row", alignItems: "center", gap: 8 },
  cabecera: { paddingHorizontal: 12, paddingBottom: 4 },
  etiqueta: { color: tema.textoTenue, fontFamily: tema.fuenteTexto, fontSize: 12 },
  renglon: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 8,
    padding: 12,
    borderRadius: 14,
  },
  renglonActivo: { backgroundColor: tema.superficieAlta },
  nombre: { color: tema.texto, fontFamily: tema.fuenteBoton, fontSize: 15 },
  tenue: { color: tema.textoTenue, fontFamily: tema.fuenteTexto, fontSize: 13 },
  celdas: { flexDirection: "row", gap: 8 },
  celdasEstrechas: { flexDirection: "row", flexWrap: "wrap", gap: 6, width: "100%" },
  celda: {
    height: 40,
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
  acciones: { flexDirection: "row", alignItems: "center", gap: 4 },
  accion: { width: 32, height: 40, alignItems: "center", justifyContent: "center" },
  girarArriba: { transform: [{ rotate: "-90deg" }] },
  girarAbajo: { transform: [{ rotate: "90deg" }] },
  panel: {
    backgroundColor: tema.superficie,
    borderRadius: 20,
    padding: 16,
    gap: 10,
    borderWidth: 1,
    borderColor: tema.bordeDestacado,
  },
  tituloPanel: { color: tema.texto, fontFamily: tema.fuenteBoton, fontSize: 17 },
  conmutador: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 40 },
  opcionesPanel: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
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
