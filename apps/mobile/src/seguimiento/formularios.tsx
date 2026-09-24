import { useRef, useState } from "react"
import { randomUUID } from "expo-crypto"
import { StyleSheet, View } from "react-native"
import type { RegistrarMedida, RegistrarPrueba } from "@alpha-omega/shared"

import { AvisoDeError, Campo } from "../componentes/formulario"
import { hoyAgenda } from "../entrenamiento/fechas"
import { Dialogo } from "../entrenamiento/sesion/controles"
import { faltaDe } from "../lib/errores"
import { leerDecimal } from "./modelo"

type Rango = { min: number; max: number; entero?: boolean }

function valor(texto: string, rango: Rango, nombre: string): number | null | string {
  const numero = leerDecimal(texto)
  if (numero === null) return null
  if (Number.isNaN(numero) || numero < rango.min || numero > rango.max)
    return `${nombre}: entre ${rango.min} y ${rango.max}.`
  return rango.entero ? Math.round(numero) : Math.round(numero * 10) / 10
}

/** «Añadir medida»: peso, cintura, grasa y altura de hoy. Basta con una. */
export function AnadirMedida({
  visible,
  cerrar,
  registrar,
}: {
  visible: boolean
  cerrar: () => void
  registrar: (datos: RegistrarMedida) => Promise<unknown>
}): React.JSX.Element {
  const [textos, setTextos] = useState({ peso: "", cintura: "", grasa: "", altura: "" })
  const [error, setError] = useState("")
  const [enviando, setEnviando] = useState(false)
  // Un reintento reutiliza la operación: el servidor no guarda dos veces.
  const operacion = useRef(randomUUID())
  const cambiar = (clave: keyof typeof textos) => (texto: string) =>
    setTextos((actual) => ({ ...actual, [clave]: texto }))

  const enviar = async (): Promise<void> => {
    const leidos = [
      valor(textos.peso, { min: 30, max: 400 }, "Peso"),
      valor(textos.cintura, { min: 30, max: 300 }, "Cintura"),
      valor(textos.grasa, { min: 2, max: 70 }, "Grasa"),
      valor(textos.altura, { min: 100, max: 250, entero: true }, "Altura"),
    ]
    const fallo = leidos.find((v) => typeof v === "string")
    if (typeof fallo === "string") return setError(fallo)
    const [pesoKg, cinturaCm, grasaPct, alturaCm] = leidos as Array<number | null>
    if ([pesoKg, cinturaCm, grasaPct, alturaCm].every((v) => v === null))
      return setError("Escribe al menos una medida.")
    setError("")
    setEnviando(true)
    try {
      await registrar({
        operacionId: operacion.current,
        fecha: hoyAgenda(),
        pesoKg: pesoKg ?? null,
        cinturaCm: cinturaCm ?? null,
        grasaPct: grasaPct ?? null,
        alturaCm: alturaCm ?? null,
      })
      operacion.current = randomUUID()
      setTextos({ peso: "", cintura: "", grasa: "", altura: "" })
      cerrar()
    } catch (e) {
      setError(faltaDe(e, "No se pudo guardar la medida.").texto)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Dialogo
      visible={visible}
      titulo="Añadir medida"
      texto="Las de hoy. Deja en blanco lo que no hayas medido."
      confirmar={enviando ? "Guardando…" : "Guardar"}
      cancelar="Cancelar"
      alConfirmar={() => void (enviando ? undefined : enviar())}
      alCancelar={cerrar}
    >
      <View style={s.campos}>
        <Campo
          etiqueta="Peso (kg)"
          value={textos.peso}
          onChangeText={cambiar("peso")}
          keyboardType="decimal-pad"
          maxLength={6}
        />
        <Campo
          etiqueta="Cintura (cm)"
          value={textos.cintura}
          onChangeText={cambiar("cintura")}
          keyboardType="decimal-pad"
          maxLength={6}
        />
        <Campo
          etiqueta="Grasa corporal (%)"
          value={textos.grasa}
          onChangeText={cambiar("grasa")}
          keyboardType="decimal-pad"
          maxLength={5}
        />
        <Campo
          etiqueta="Altura (cm)"
          value={textos.altura}
          onChangeText={cambiar("altura")}
          keyboardType="number-pad"
          maxLength={3}
        />
      </View>
      {error !== "" && <AvisoDeError mensaje={error} />}
    </Dialogo>
  )
}

/** «Añadir prueba»: nombre, resultado y unidad. */
export function AnadirPrueba({
  visible,
  cerrar,
  registrar,
}: {
  visible: boolean
  cerrar: () => void
  registrar: (datos: RegistrarPrueba) => Promise<unknown>
}): React.JSX.Element {
  const [nombre, setNombre] = useState("")
  const [resultado, setResultado] = useState("")
  const [unidad, setUnidad] = useState("")
  const [error, setError] = useState("")
  const [enviando, setEnviando] = useState(false)
  const operacion = useRef(randomUUID())

  const enviar = async (): Promise<void> => {
    const numero = leerDecimal(resultado)
    if (nombre.trim() === "") return setError("Escribe qué prueba has hecho.")
    if (numero === null || Number.isNaN(numero)) return setError("Escribe el resultado con cifras.")
    if (unidad.trim() === "") return setError("Escribe la unidad: reps, s, cm, kg…")
    setError("")
    setEnviando(true)
    try {
      await registrar({
        operacionId: operacion.current,
        fecha: hoyAgenda(),
        nombre: nombre.trim(),
        valor: numero,
        unidad: unidad.trim(),
      })
      operacion.current = randomUUID()
      setNombre("")
      setResultado("")
      setUnidad("")
      cerrar()
    } catch (e) {
      setError(faltaDe(e, "No se pudo guardar la prueba.").texto)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Dialogo
      visible={visible}
      titulo="Añadir prueba"
      texto="La de hoy: por ejemplo, flexiones seguidas, 32 reps."
      confirmar={enviando ? "Guardando…" : "Guardar"}
      cancelar="Cancelar"
      alConfirmar={() => void (enviando ? undefined : enviar())}
      alCancelar={cerrar}
    >
      <View style={s.campos}>
        <Campo etiqueta="Prueba" value={nombre} onChangeText={setNombre} maxLength={60} />
        <View style={s.fila}>
          <View style={s.mitad}>
            <Campo
              etiqueta="Resultado"
              value={resultado}
              onChangeText={setResultado}
              keyboardType="decimal-pad"
              maxLength={8}
            />
          </View>
          <View style={s.mitad}>
            <Campo etiqueta="Unidad" value={unidad} onChangeText={setUnidad} maxLength={12} />
          </View>
        </View>
      </View>
      {error !== "" && <AvisoDeError mensaje={error} />}
    </Dialogo>
  )
}

const s = StyleSheet.create({
  campos: { gap: 4 },
  fila: { flexDirection: "row", gap: 12 },
  mitad: { flex: 1 },
})
