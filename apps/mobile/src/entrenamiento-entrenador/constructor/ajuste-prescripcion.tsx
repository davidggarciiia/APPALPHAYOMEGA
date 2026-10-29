import { useEffect, useRef, useState, type ReactNode } from "react"
import {
  Keyboard,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
  type KeyboardEvent,
} from "react-native"

import { BarraAjuste, type UnidadAjuste } from "../../componentes/barra-ajuste"
import { tema, radio } from "../../tema"
import { leerRango, type EjercicioDelConstructor } from "./modelo"

export type CampoPrescripcion = "series" | "objetivo" | "rir" | "descanso" | "carga"
type Cambio = (id: string, cambio: Partial<EjercicioDelConstructor>) => void
const DESCANSOS = ["60 s", "90 s", "2 min", "2–3 min"] as const
const decimal = (numero: number): string => String(numero).replace(".", ",")
export const numeroDeTexto = (texto: string): number | null => {
  if (!/^(?:\d+(?:[.,]\d*)?|[.,]\d+)$/.test(texto)) return null
  const numero = Number(texto.replace(",", "."))
  return Number.isFinite(numero) ? numero : null
}
export const textoDeRango = (min: number, max: number): string =>
  min === max ? String(min) : `${min}–${max}`

/** Stepper de la hoja: solo abre el teclado cuando se toca su cifra. */
export function EditorNumero({
  etiqueta,
  titulo,
  valor,
  cambiar,
  alVaciar,
  paso = 1,
  minimo = 0,
  maximo = Number.MAX_SAFE_INTEGER,
  decimal: admiteDecimal = false,
  alCambiarValidez,
}: {
  etiqueta: string
  titulo: string
  valor: number | null
  cambiar: (n: number) => void
  alVaciar?: () => void
  paso?: number
  minimo?: number
  maximo?: number
  decimal?: boolean
  alCambiarValidez?: (valida: boolean) => void
}): React.JSX.Element {
  const [manual, setManual] = useState(false)
  const [texto, setTexto] = useState("")
  const anterior = useRef(valor)
  const avisar = useRef(alCambiarValidez)
  avisar.current = alCambiarValidez
  useEffect(() => {
    if (manual && valor !== anterior.current) setTexto(valor === null ? "" : decimal(valor))
    anterior.current = valor
  }, [valor, manual])
  const leer = (entrada: string): number | null => {
    const numero = admiteDecimal || /^\d+$/.test(entrada) ? numeroDeTexto(entrada) : null
    return numero !== null && numero >= minimo && numero <= maximo ? numero : null
  }
  const invalido = manual && !(texto === "" && alVaciar) && leer(texto) === null
  useEffect(() => {
    avisar.current?.(!invalido)
  }, [invalido])
  useEffect(() => () => avisar.current?.(true), [])
  const ajustar = (direccion: number): void => {
    const siguiente = Math.min(
      maximo,
      Math.max(minimo, Number(((valor ?? minimo) + direccion * paso).toPrecision(15))),
    )
    setTexto(decimal(siguiente))
    anterior.current = siguiente
    cambiar(siguiente)
  }
  const botonPaso = (direccion: -1 | 1): React.JSX.Element => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${direccion < 0 ? "Disminuir" : "Aumentar"} ${etiqueta}`}
      accessibilityState={{
        disabled: valor !== null && (direccion < 0 ? valor <= minimo : valor >= maximo),
      }}
      disabled={valor !== null && (direccion < 0 ? valor <= minimo : valor >= maximo)}
      onPress={() => ajustar(direccion)}
      style={s.paso}
    >
      <Text style={s.signo}>{direccion < 0 ? "−" : "+"}</Text>
    </Pressable>
  )
  return (
    <View style={s.editor}>
      <Text style={s.titulo}>{titulo}</Text>
      <View style={s.fila}>
        {botonPaso(-1)}
        {manual ? (
          <TextInput
            accessibilityLabel={etiqueta}
            value={texto}
            onChangeText={(nuevo) => {
              setTexto(nuevo)
              if (nuevo === "" && alVaciar) {
                anterior.current = null
                alVaciar()
                return
              }
              const numero = leer(nuevo)
              if (numero !== null) {
                anterior.current = numero
                cambiar(numero)
              }
            }}
            autoFocus
            selectTextOnFocus
            keyboardType={admiteDecimal ? "decimal-pad" : "number-pad"}
            maxLength={30}
            selectionColor={tema.acento}
            style={s.numero}
          />
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Escribir ${etiqueta}: ${valor === null ? "—" : decimal(valor)}`}
            accessibilityHint="Abre el teclado numérico"
            onPress={() => {
              setTexto(valor === null ? "" : decimal(valor))
              setManual(true)
            }}
            style={s.cifra}
          >
            <Text style={s.numeroTexto}>{valor === null ? "—" : decimal(valor)}</Text>
          </Pressable>
        )}
        {botonPaso(1)}
      </View>
      {invalido && (
        <Text accessibilityRole="alert" style={s.error}>
          Introduce un número válido.
        </Text>
      )}
    </View>
  )
}

/** El texto libre se conserva al abrir; los chips solo escriben al pulsarlos. */
export function SelectorDescanso({
  valor,
  cambiar,
  nombre,
}: {
  valor: string
  cambiar: (texto: string) => void
  nombre: string
}): React.JSX.Element {
  const [otro, setOtro] = useState(valor !== "" && !DESCANSOS.some((d) => d === valor))
  return (
    <View style={s.editor}>
      <View style={s.chips}>
        {[...DESCANSOS, "Otro"].map((descanso) => (
          <Pressable
            key={descanso}
            accessibilityRole="button"
            accessibilityLabel={`Descanso ${descanso}`}
            accessibilityState={{
              selected: descanso === "Otro" ? otro : !otro && valor === descanso,
            }}
            onPress={() => {
              setOtro(descanso === "Otro")
              if (descanso !== "Otro") cambiar(descanso)
            }}
            style={[
              s.chip,
              (descanso === "Otro" ? otro : !otro && valor === descanso) && s.chipElegido,
            ]}
          >
            <Text style={s.chipTexto}>{descanso}</Text>
          </Pressable>
        ))}
      </View>
      {otro && (
        <TextInput
          accessibilityLabel={`Descanso de ${nombre}`}
          value={valor}
          onChangeText={cambiar}
          placeholder="Descanso"
          placeholderTextColor={tema.marcador}
          maxLength={30}
          style={s.campoTexto}
        />
      )}
    </View>
  )
}

function AjusteDescanso({
  ejercicio,
  cambiar,
  cerrar,
  margenInferior = 20,
  aviso,
}: {
  ejercicio: EjercicioDelConstructor
  cambiar: Cambio
  cerrar: () => void
  margenInferior?: number
  aviso?: ReactNode
}): React.JSX.Element {
  const { height } = useWindowDimensions()
  const [tecladoY, setTecladoY] = useState<number | null>(null)
  useEffect(() => {
    const mostrar = (e: KeyboardEvent): void => setTecladoY(e.endCoordinates.screenY)
    const ocultar = (): void => setTecladoY(null)
    const subs = [
      Keyboard.addListener("keyboardWillShow", mostrar),
      Keyboard.addListener("keyboardDidShow", mostrar),
      Keyboard.addListener("keyboardWillHide", ocultar),
      Keyboard.addListener("keyboardDidHide", ocultar),
    ]
    return () => subs.forEach((s) => s.remove())
  }, [])
  return (
    <View
      testID="barra-ajuste"
      style={[
        s.contenedor,
        { bottom: margenInferior + (tecladoY === null ? 0 : Math.max(0, height - tecladoY)) },
      ]}
    >
      {aviso && <View style={s.encima}>{aviso}</View>}
      <View testID="tarjeta-ajuste" style={s.barra}>
        <Text style={s.titulo}>{ejercicio.nombre} · Descanso</Text>
        <SelectorDescanso
          nombre={ejercicio.nombre}
          valor={ejercicio.descanso}
          cambiar={(descanso) => cambiar(ejercicio.id, { descanso })}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Listo"
          onPress={() => {
            Keyboard.dismiss()
            cerrar()
          }}
          style={s.listo}
        >
          <Text style={s.chipTexto}>Listo</Text>
        </Pressable>
      </View>
    </View>
  )
}

/** Ajuste de una celda de prescripción, manteniendo el texto del modelo hasta una edición explícita. */
export function AjustePrescripcion({
  ejercicio,
  campo,
  cambiar,
  cerrar,
  alCambiarValidez,
  margenInferior,
  aviso,
}: {
  ejercicio: EjercicioDelConstructor
  campo: CampoPrescripcion
  cambiar: Cambio
  cerrar: () => void
  alCambiarValidez?: (valida: boolean) => void
  margenInferior?: number
  aviso?: ReactNode
}): React.JSX.Element {
  const [limite, setLimite] = useState<"min" | "max">("min")
  const [manualValido, setManualValido] = useState(true)
  const avisar = useRef(alCambiarValidez)
  avisar.current = alCambiarValidez
  const validez = useRef((valida: boolean): void => {
    setManualValido(valida)
    avisar.current?.(valida)
  }).current
  if (campo === "descanso")
    return <AjusteDescanso {...{ ejercicio, cambiar, cerrar, margenInferior, aviso }} />
  const rango = leerRango(ejercicio.objetivo)
  const rir = leerRango(ejercicio.rir)
  const unidad: UnidadAjuste =
    campo === "carga"
      ? "kg"
      : campo === "objetivo"
        ? ejercicio.tipo === "tiempo"
          ? "seg"
          : ejercicio.tipo === "distancia"
            ? "m"
            : "reps"
        : campo
  const titulo =
    campo === "series"
      ? "Series"
      : campo === "carga"
        ? "Carga inicial"
        : campo === "rir"
          ? "RIR objetivo"
          : "Objetivo"
  const objetivo =
    ejercicio.tipo === "tiempo" ? "Seg" : ejercicio.tipo === "distancia" ? "Metros" : "Reps"
  const encabezado = (
    <View style={s.editor}>
      <Text style={s.titulo}>
        {ejercicio.nombre} · {titulo}
      </Text>
      {campo === "rir" && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Sin objetivo"
          onPress={() => cambiar(ejercicio.id, { rir: "" })}
          style={s.listo}
        >
          <Text style={s.chipTexto}>Sin objetivo</Text>
        </Pressable>
      )}
      {campo === "objetivo" && ejercicio.tipo === "repeticiones" && (
        <View style={s.chips}>
          {(["min", "max"] as const).map((tipo) => (
            <Pressable
              key={tipo}
              accessibilityRole="button"
              accessibilityLabel={`${objetivo} ${tipo === "min" ? "mín." : "máx."}`}
              accessibilityState={{ selected: limite === tipo, disabled: !manualValido }}
              disabled={!manualValido}
              onPress={() => setLimite(tipo)}
              style={[s.chip, limite === tipo && s.chipElegido]}
            >
              <Text style={s.chipTexto}>
                {objetivo} {tipo === "min" ? "mín." : "máx."} · {rango?.[tipo] ?? "—"}
              </Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  )
  const valor =
    campo === "objetivo"
      ? (rango?.[limite] ?? null)
      : campo === "rir"
        ? rir && rir.min === rir.max
          ? rir.min
          : null
        : numeroDeTexto(ejercicio[campo])
  return (
    <BarraAjuste
      key={`${ejercicio.id}-${campo}-${limite}`}
      unidad={unidad}
      valor={valor}
      encabezado={encabezado}
      encima={aviso}
      alListo={cerrar}
      alCambiarValidez={validez}
      alVaciar={
        campo === "carga" ? () => cambiar(ejercicio.id, { carga: "", calibrar: false }) : undefined
      }
      margenInferior={margenInferior}
      subidaKg={numeroDeTexto(ejercicio.subida)}
      paso={campo === "objetivo" ? 1 : undefined}
      minimo={
        campo === "series" || campo === "objetivo"
          ? campo === "objetivo" && limite === "max"
            ? (rango?.min ?? 1)
            : 1
          : 0
      }
      maximo={
        campo === "series"
          ? 30
          : campo === "rir"
            ? 5
            : campo === "carga"
              ? 1000
              : campo === "objetivo"
                ? ejercicio.tipo === "repeticiones"
                  ? limite === "min"
                    ? (rango?.max ?? 10000)
                    : 10000
                  : ejercicio.tipo === "tiempo"
                    ? 86400
                    : 100000
                : undefined
      }
      deshabilitado={campo === "carga" && ejercicio.tipoCarga === "sinCarga"}
      cambiar={(numero) => {
        if (campo === "objetivo") {
          const min = limite === "min" ? numero : (rango?.min ?? numero)
          const max = limite === "max" ? numero : (rango?.max ?? numero)
          cambiar(ejercicio.id, {
            objetivo: ejercicio.tipo === "repeticiones" ? textoDeRango(min, max) : String(numero),
          })
        } else if (campo === "carga")
          cambiar(ejercicio.id, { carga: decimal(numero), calibrar: false })
        else cambiar(ejercicio.id, { [campo]: String(numero) })
      }}
    />
  )
}

const s = StyleSheet.create({
  editor: { gap: 8 },
  titulo: { color: tema.texto, fontFamily: tema.fuenteSemi, fontSize: 14 },
  fila: { flexDirection: "row", alignItems: "center", gap: 8 },
  paso: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radio.celda,
    backgroundColor: tema.superficieAlta,
  },
  signo: { color: tema.acento, fontFamily: tema.fuenteTexto, fontSize: 26 },
  cifra: { flex: 1, minHeight: 44, justifyContent: "center", alignItems: "center" },
  numero: {
    flex: 1,
    minHeight: 44,
    textAlign: "center",
    color: tema.texto,
    fontFamily: tema.fuenteBoton,
    fontSize: 20,
    padding: 4,
    fontVariant: ["tabular-nums"],
  },
  numeroTexto: {
    color: tema.texto,
    fontFamily: tema.fuenteBoton,
    fontSize: 20,
    fontVariant: ["tabular-nums"],
  },
  error: { color: tema.aviso, fontFamily: tema.fuenteTexto, fontSize: 13 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: {
    minHeight: 44,
    minWidth: 44,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 12,
    borderRadius: radio.celda,
    borderWidth: 1,
    borderColor: tema.bordeFuerte,
    backgroundColor: tema.superficie,
  },
  chipElegido: { borderColor: tema.acento, backgroundColor: tema.acentoSuave },
  chipTexto: { color: tema.acento, fontFamily: tema.fuenteSemi, fontSize: 13 },
  campoTexto: {
    minHeight: 44,
    padding: 10,
    borderWidth: 1,
    borderColor: tema.bordeFuerte,
    borderRadius: radio.campo,
    color: tema.texto,
    fontFamily: tema.fuenteTexto,
  },
  contenedor: {
    position: "absolute",
    left: 20,
    right: 20,
  },
  encima: { marginBottom: 12 },
  barra: {
    padding: 12,
    gap: 12,
    borderRadius: radio.tarjeta,
    borderWidth: 1,
    borderColor: tema.bordeDestacado,
    backgroundColor: tema.barraAjuste,
  },
  listo: { minHeight: 44, justifyContent: "center", alignItems: "flex-end", paddingHorizontal: 8 },
})
