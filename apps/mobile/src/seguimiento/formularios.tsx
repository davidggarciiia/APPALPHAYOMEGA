import { useRef, useState } from "react"
import { randomUUID } from "expo-crypto"
import { Pressable, StyleSheet, Text, View } from "react-native"
import type {
  ConfiguracionSeguimiento,
  RegistrarMedida,
  RegistrarPrueba,
} from "@alpha-omega/shared"

import { AvisoDeError, Campo } from "../componentes/formulario"
import { hoyAgenda } from "../entrenamiento/fechas"
import { Dialogo } from "../entrenamiento/sesion/controles"
import { faltaDe } from "../lib/errores"
import { tema } from "../tema"
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

/** El cliente elige una prueba pautada; el servidor conserva su nombre y unidad. */
export function AnadirPrueba({
  visible,
  cerrar,
  registrar,
  pruebas,
}: {
  visible: boolean
  cerrar: () => void
  registrar: (datos: RegistrarPrueba) => Promise<unknown>
  pruebas: ConfiguracionSeguimiento["pruebasPrescritas"]
}): React.JSX.Element {
  const [pruebaId, setPruebaId] = useState<string | null>(null)
  const [resultado, setResultado] = useState("")
  const [error, setError] = useState("")
  const [enviando, setEnviando] = useState(false)
  const operacion = useRef(randomUUID())

  const enviar = async (): Promise<void> => {
    const numero = leerDecimal(resultado)
    if (!pruebaId || !pruebas.some((prueba) => prueba.id === pruebaId))
      return setError("Elige una prueba pautada.")
    if (numero === null || Number.isNaN(numero) || numero < 0 || numero > 100_000)
      return setError("Escribe un resultado entre 0 y 100.000.")
    setError("")
    setEnviando(true)
    try {
      await registrar({
        operacionId: operacion.current,
        fecha: hoyAgenda(),
        pruebaId,
        valor: numero,
      })
      operacion.current = randomUUID()
      setPruebaId(null)
      setResultado("")
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
      texto="Elige la prueba indicada por tu entrenador y apunta el resultado de hoy."
      confirmar={enviando ? "Guardando…" : "Guardar"}
      cancelar="Cancelar"
      alConfirmar={() => void (enviando ? undefined : enviar())}
      alCancelar={cerrar}
    >
      <View style={s.campos}>
        {pruebas.map((prueba) => (
          <Pressable
            key={prueba.id}
            accessibilityRole="button"
            accessibilityLabel={`${prueba.nombre} · ${prueba.unidad}`}
            accessibilityState={{ selected: pruebaId === prueba.id }}
            onPress={() => setPruebaId(prueba.id)}
            style={[s.opcion, pruebaId === prueba.id && s.elegida]}
          >
            <Text style={s.textoOpcion}>
              {prueba.nombre} · {prueba.unidad}
            </Text>
          </Pressable>
        ))}
        <Campo
          etiqueta="Resultado"
          value={resultado}
          onChangeText={setResultado}
          keyboardType="decimal-pad"
          maxLength={8}
        />
      </View>
      {error !== "" && <AvisoDeError mensaje={error} />}
    </Dialogo>
  )
}

const s = StyleSheet.create({
  campos: { gap: 4 },
  opcion: { padding: 12, borderRadius: 10, borderWidth: 1, borderColor: tema.bordeFuerte },
  elegida: { borderColor: tema.acento },
  textoOpcion: { color: tema.texto, fontSize: 15 },
})
