import { useCallback, useState } from "react"
import { useFocusEffect } from "expo-router"
import { Pressable, StyleSheet, Text, View } from "react-native"
import type { CambiarDia, DiaDeSeguimiento, Suplemento } from "@alpha-omega/shared"

import { AvisoDeError, Campo } from "../componentes/formulario"
import { Icono } from "../componentes/iconos"
import { hoyAgenda } from "../entrenamiento/fechas"
import { Dialogo } from "../entrenamiento/sesion/controles"
import { faltaDe } from "../lib/errores"
import { degradadoExito, tema } from "../tema"
import type { ApiSeguimiento } from "../seguimiento/api"
import { leerDecimal, leerSueno, miles, pesoLegible, suenoLegible } from "../seguimiento/modelo"
import type { ApiNutricion } from "./api"
import { cambioDeSuplemento, suplementoTomado } from "./hoy-modelo"

type Dato = "pesoKg" | "pasos" | "suenoMin"

const EDICION: Record<
  Dato,
  { titulo: string; texto: string; etiqueta: string; teclado: "decimal-pad" | "number-pad" }
> = {
  pesoKg: {
    titulo: "Peso en ayunas",
    texto: "En kilos, al levantarte y antes de desayunar. Por ejemplo, 111,6.",
    etiqueta: "Peso (kg)",
    teclado: "decimal-pad",
  },
  pasos: {
    titulo: "Pasos de hoy",
    texto: "Los que marque tu móvil o tu reloj.",
    etiqueta: "Pasos",
    teclado: "number-pad",
  },
  suenoMin: {
    titulo: "Sueño",
    texto: "Lo que dormiste anoche. Por ejemplo, 7:40.",
    etiqueta: "Horas dormidas",
    teclado: "decimal-pad",
  },
}

function textoInicial(dato: Dato, dia: DiaDeSeguimiento | null): string {
  const valor = dia?.[dato] ?? null
  if (valor === null) return ""
  if (dato === "pesoKg") return String(valor).replace(".", ",")
  if (dato === "suenoMin") return `${Math.floor(valor / 60)}:${String(valor % 60).padStart(2, "0")}`
  return String(valor)
}

function leer(dato: Dato, texto: string): CambiarDia | string {
  if (dato === "pasos") {
    const limpio = texto.trim().replace(/\./g, "")
    if (limpio === "") return { pasos: null }
    return /^\d{1,6}$/.test(limpio) && Number(limpio) <= 100_000
      ? { pasos: Number(limpio) }
      : "Escribe los pasos con cifras, hasta 100.000."
  }
  if (dato === "pesoKg") {
    const peso = leerDecimal(texto)
    if (peso === null) return { pesoKg: null }
    return !Number.isNaN(peso) && peso >= 30 && peso <= 400
      ? { pesoKg: Math.round(peso * 10) / 10 }
      : "Escribe un peso entre 30 y 400 kg."
  }
  const minutos = leerSueno(texto)
  if (minutos === null) return { suenoMin: null }
  return !Number.isNaN(minutos) && minutos <= 1440
    ? { suenoMin: minutos }
    : "Escribe las horas como 7:40 o 7,5."
}

/** «Hoy» de Inicio: datos diarios y suplementos de la dieta publicada. */
export function HoyInicio({
  clienteId,
  seguimiento,
  nutricion,
  objetivoPasos,
}: {
  clienteId: string
  seguimiento: Pick<ApiSeguimiento, "dias" | "cambiarDia">
  nutricion: Pick<ApiNutricion, "vigente">
  objetivoPasos: number | null
}): React.JSX.Element {
  const [dia, setDia] = useState<DiaDeSeguimiento | null>(null)
  const [suplementos, setSuplementos] = useState<Suplemento[]>([])
  const [editando, setEditando] = useState<Dato | null>(null)
  const [texto, setTexto] = useState("")
  const [error, setError] = useState("")
  const hoy = hoyAgenda()

  useFocusEffect(
    useCallback(() => {
      let vigente = true
      seguimiento
        .dias(clienteId, hoy, hoy)
        .then(({ dias }) => {
          if (vigente) setDia(dias[0] ?? null)
        })
        .catch(() => undefined)
      nutricion
        .vigente(clienteId)
        .then(({ dieta }) => {
          if (vigente) setSuplementos(dieta?.documento.suplementos ?? [])
        })
        .catch(() => {
          if (vigente) setSuplementos([])
        })
      return () => {
        vigente = false
      }
    }, [seguimiento, nutricion, clienteId, hoy]),
  )

  const guardar = async (cambio: CambiarDia): Promise<boolean> => {
    setError("")
    try {
      setDia(await seguimiento.cambiarDia(clienteId, hoy, cambio))
      return true
    } catch (fallo) {
      setError(faltaDe(fallo, "No se pudo guardar. Revisa la conexión.").texto)
      return false
    }
  }
  const abrir = (dato: Dato): void => {
    setTexto(textoInicial(dato, dia))
    setError("")
    setEditando(dato)
  }

  const fila = (dato: Dato, nombre: string, valor: string | null): React.JSX.Element => (
    <Pressable
      key={dato}
      style={[s.fila, dato !== "pesoKg" && s.separada]}
      accessibilityRole="button"
      accessibilityLabel={`${nombre}: ${valor ?? "sin apuntar"}. Cambiar`}
      onPress={() => abrir(dato)}
    >
      <Text style={s.nombre}>{nombre}</Text>
      <Text style={valor === null ? s.apuntar : s.valor}>{valor ?? "Apuntar"}</Text>
    </Pressable>
  )
  const edicion = editando ? EDICION[editando] : null

  return (
    <View style={s.contenido}>
      <Text style={s.titulo} accessibilityRole="header">
        Hoy
      </Text>
      <View style={s.tarjeta}>
        {fila("pesoKg", "Peso", dia?.pesoKg != null ? pesoLegible(dia.pesoKg) : null)}
        {fila(
          "pasos",
          "Pasos",
          dia?.pasos != null
            ? `${miles(dia.pasos)}${objetivoPasos ? ` / ${miles(objetivoPasos)}` : ""}`
            : null,
        )}
        {fila("suenoMin", "Sueño", dia?.suenoMin != null ? suenoLegible(dia.suenoMin) : null)}
        {suplementos.map((suplemento) => {
          const tomado = suplementoTomado(suplemento, dia)
          return (
            <Pressable
              key={suplemento.nombre}
              style={[s.fila, s.separada]}
              accessibilityRole="checkbox"
              accessibilityLabel={`${suplemento.nombre} tomada`}
              accessibilityState={{ checked: tomado }}
              onPress={() => void guardar(cambioDeSuplemento(suplemento, !tomado, dia))}
            >
              <View style={s.suplemento}>
                <Text style={s.nombre}>{suplemento.nombre} tomada</Text>
                {suplemento.dosis && <Text style={s.dosis}>{suplemento.dosis}</Text>}
              </View>
              <View style={[s.circulo, tomado && [s.circuloHecho, degradadoExito]]}>
                {tomado && <Icono nombre="hecho" color={tema.sobreExito} tamano={16} />}
              </View>
            </Pressable>
          )
        })}
      </View>
      {error !== "" && editando === null && <AvisoDeError mensaje={error} />}
      <Dialogo
        visible={edicion !== null}
        titulo={edicion?.titulo ?? ""}
        texto={edicion?.texto ?? ""}
        confirmar="Guardar"
        cancelar="Cancelar"
        alCancelar={() => setEditando(null)}
        alConfirmar={() => {
          if (!editando) return
          const cambio = leer(editando, texto)
          if (typeof cambio === "string") {
            setError(cambio)
            return
          }
          void guardar(cambio).then((bien) => {
            if (bien) setEditando(null)
          })
        }}
      >
        {edicion && (
          <Campo
            etiqueta={edicion.etiqueta}
            value={texto}
            onChangeText={setTexto}
            keyboardType={edicion.teclado}
            autoFocus
            maxLength={10}
          />
        )}
        {error !== "" && editando !== null && <AvisoDeError mensaje={error} />}
      </Dialogo>
    </View>
  )
}

const s = StyleSheet.create({
  contenido: { gap: 14 },
  titulo: { color: tema.texto, fontFamily: tema.fuenteBoton, fontSize: 20 },
  tarjeta: { backgroundColor: tema.superficie, borderRadius: 20, paddingHorizontal: 16 },
  fila: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  separada: { borderTopWidth: 1, borderTopColor: tema.borde },
  nombre: { color: tema.texto, fontFamily: tema.fuenteTexto, fontSize: 15 },
  suplemento: { flex: 1, gap: 2 },
  dosis: { color: tema.textoTenue, fontFamily: tema.fuenteTexto, fontSize: 13 },
  valor: { color: tema.textoSecundario, fontFamily: tema.fuenteTexto, fontSize: 15 },
  apuntar: { color: tema.acento, fontFamily: tema.fuenteBoton, fontSize: 15 },
  circulo: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: tema.bordeFuerte,
    alignItems: "center",
    justifyContent: "center",
  },
  circuloHecho: { borderColor: "transparent" },
})
