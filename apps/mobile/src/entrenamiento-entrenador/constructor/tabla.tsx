import { Pressable, StyleSheet, Switch, Text, TextInput, View } from "react-native"

import { Icono } from "../../componentes/iconos"
import { Enlace } from "../../entrenamiento/sesion/controles"
import { tema } from "../../tema"
import type { EjercicioDelConstructor } from "./modelo"

type Cambio = (id: string, cambio: Partial<EjercicioDelConstructor>) => void

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

const COLUMNAS = [
  ["Series", 56],
  ["Reps", 70],
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
            <Text key={texto} style={[s.etiqueta, { width: ancho }]}>
              {texto}
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
              etiqueta={`Repeticiones de ${e.nombre}`}
              valor={e.objetivo}
              cambiar={(v) => cambiar(e.id, { objetivo: v })}
              ancho={70}
              marcador="8–10"
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
            {e.calibrar ? (
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
            <Celda
              etiqueta={`Subida de ${e.nombre} en kg`}
              valor={e.subida}
              cambiar={(v) => cambiar(e.id, { subida: v })}
              ancho={64}
              teclado="decimal-pad"
              marcador="kg"
            />
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
          value={ejercicio.calibrar}
          onValueChange={(v) => cambiar(ejercicio.id, { calibrar: v })}
          trackColor={{ true: tema.acento, false: tema.superficieAlta }}
          thumbColor={tema.texto}
        />
      </View>
      <View style={s.conmutador}>
        <Text style={[s.tenue, s.flex]}>Se mide en segundos</Text>
        <Switch
          accessibilityLabel="Se mide en segundos"
          value={ejercicio.tipo === "tiempo"}
          onValueChange={(v) => cambiar(ejercicio.id, { tipo: v ? "tiempo" : "repeticiones" })}
          trackColor={{ true: tema.acento, false: tema.superficieAlta }}
          thumbColor={tema.texto}
        />
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
