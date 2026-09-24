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

type Intento = { firma: string; operacionId: string }

/**
 * Guardado protegido: una sola escritura a la vez, cerrada desde el mismo toque,
 * y la misma operación mientras no cambie el contenido. Un reintento idéntico no
 * duplica; una edición no reutiliza la operación de otro contenido, que el
 * servidor rechazaría. Al fallar se desbloquea y el formulario se conserva.
 */
function useGuardadoProtegido<D extends object>(
  registrar: (datos: D & { operacionId: string }) => Promise<unknown>,
  respaldo: string,
): {
  enviando: boolean
  error: string
  /** Falso desde el toque de guardar hasta la respuesta, antes de repintar. */
  libre: () => boolean
  guardar: (preparar: () => D | string, alGuardar: () => void) => Promise<void>
} {
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState("")
  const guardando = useRef(false)
  const intento = useRef<Intento | null>(null)

  const guardar = async (preparar: () => D | string, alGuardar: () => void): Promise<void> => {
    if (guardando.current) return
    const datos = preparar()
    if (typeof datos === "string") return setError(datos)
    const firma = JSON.stringify(datos)
    const actual =
      intento.current?.firma === firma ? intento.current : { firma, operacionId: randomUUID() }
    intento.current = actual
    guardando.current = true
    setError("")
    setEnviando(true)
    try {
      await registrar({ ...datos, operacionId: actual.operacionId })
      intento.current = null
      alGuardar()
    } catch (e) {
      setError(faltaDe(e, respaldo).texto)
    } finally {
      guardando.current = false
      setEnviando(false)
    }
  }

  return { enviando, error, libre: () => !guardando.current, guardar }
}

const SIN_MEDIDAS = { peso: "", cintura: "", grasa: "", altura: "" }

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
  const [textos, setTextos] = useState(SIN_MEDIDAS)
  const { enviando, error, libre, guardar } = useGuardadoProtegido<
    Omit<RegistrarMedida, "operacionId">
  >(registrar, "No se pudo guardar la medida.")
  const cambiar = (clave: keyof typeof textos) => (texto: string) => {
    if (libre()) setTextos((actual) => ({ ...actual, [clave]: texto }))
  }
  // Mientras se guarda, lo escrito es lo que viaja: ni se edita ni se anuncia editable.
  const bloqueo = { editable: !enviando, accessibilityState: { disabled: enviando } }

  const preparar = (): Omit<RegistrarMedida, "operacionId"> | string => {
    const leidos = [
      valor(textos.peso, { min: 30, max: 400 }, "Peso"),
      valor(textos.cintura, { min: 30, max: 300 }, "Cintura"),
      valor(textos.grasa, { min: 2, max: 70 }, "Grasa"),
      valor(textos.altura, { min: 100, max: 250, entero: true }, "Altura"),
    ]
    const fallo = leidos.find((v) => typeof v === "string")
    if (typeof fallo === "string") return fallo
    const [pesoKg, cinturaCm, grasaPct, alturaCm] = leidos as Array<number | null>
    if ([pesoKg, cinturaCm, grasaPct, alturaCm].every((v) => v === null))
      return "Escribe al menos una medida."
    return {
      fecha: hoyAgenda(),
      pesoKg: pesoKg ?? null,
      cinturaCm: cinturaCm ?? null,
      grasaPct: grasaPct ?? null,
      alturaCm: alturaCm ?? null,
    }
  }

  return (
    <Dialogo
      visible={visible}
      titulo="Añadir medida"
      texto="Las de hoy. Deja en blanco lo que no hayas medido."
      confirmar={enviando ? "Guardando…" : "Guardar"}
      cancelar="Cancelar"
      ocupado={enviando}
      alConfirmar={() =>
        void guardar(preparar, () => {
          setTextos(SIN_MEDIDAS)
          cerrar()
        })
      }
      alCancelar={cerrar}
    >
      <View style={s.campos}>
        <Campo
          etiqueta="Peso (kg)"
          value={textos.peso}
          onChangeText={cambiar("peso")}
          keyboardType="decimal-pad"
          maxLength={6}
          {...bloqueo}
        />
        <Campo
          etiqueta="Cintura (cm)"
          value={textos.cintura}
          onChangeText={cambiar("cintura")}
          keyboardType="decimal-pad"
          maxLength={6}
          {...bloqueo}
        />
        <Campo
          etiqueta="Grasa corporal (%)"
          value={textos.grasa}
          onChangeText={cambiar("grasa")}
          keyboardType="decimal-pad"
          maxLength={5}
          {...bloqueo}
        />
        <Campo
          etiqueta="Altura (cm)"
          value={textos.altura}
          onChangeText={cambiar("altura")}
          keyboardType="number-pad"
          maxLength={3}
          {...bloqueo}
        />
      </View>
      {error !== "" && <AvisoDeError mensaje={error} />}
    </Dialogo>
  )
}

type PruebaPautada = { fecha: string; pruebaId: string; valor: number }

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
  const { enviando, error, libre, guardar } = useGuardadoProtegido<PruebaPautada>(
    registrar,
    "No se pudo guardar la prueba.",
  )

  const preparar = (): PruebaPautada | string => {
    const numero = leerDecimal(resultado)
    if (!pruebaId || !pruebas.some((prueba) => prueba.id === pruebaId))
      return "Elige una prueba pautada."
    if (numero === null || Number.isNaN(numero) || numero < 0 || numero > 100_000)
      return "Escribe un resultado entre 0 y 100.000."
    return { fecha: hoyAgenda(), pruebaId, valor: numero }
  }

  return (
    <Dialogo
      visible={visible}
      titulo="Añadir prueba"
      texto="Elige la prueba indicada por tu entrenador y apunta el resultado de hoy."
      confirmar={enviando ? "Guardando…" : "Guardar"}
      cancelar="Cancelar"
      ocupado={enviando}
      alConfirmar={() =>
        void guardar(preparar, () => {
          setPruebaId(null)
          setResultado("")
          cerrar()
        })
      }
      alCancelar={cerrar}
    >
      <View style={s.campos}>
        {pruebas.map((prueba) => (
          <Pressable
            key={prueba.id}
            accessibilityRole="button"
            accessibilityLabel={`${prueba.nombre} · ${prueba.unidad}`}
            accessibilityState={{ selected: pruebaId === prueba.id, disabled: enviando }}
            disabled={enviando}
            onPress={() => {
              if (libre()) setPruebaId(prueba.id)
            }}
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
          onChangeText={(texto) => {
            if (libre()) setResultado(texto)
          }}
          keyboardType="decimal-pad"
          maxLength={8}
          editable={!enviando}
          accessibilityState={{ disabled: enviando }}
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
