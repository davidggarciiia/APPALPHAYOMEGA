import { useEffect, useState } from "react"
import { ActivityIndicator, StyleSheet, Text, View } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import type { EstadoSalud } from "@alpha-omega/shared"

import { consultarSalud } from "../src/lib/api"
import { tema } from "../src/tema"

type Consulta =
  { fase: "cargando" } | { fase: "ok"; salud: EstadoSalud } | { fase: "error"; motivo: string }

/**
 * Pantalla de diagnostico de la tarea 4. Su unico trabajo es demostrar que la
 * app instalada en un telefono alcanza la API que corre en el ordenador, que es
 * el paso donde mas gente se atasca al montar un entorno movil.
 *
 * La sustituye la pantalla de login en la tarea 8.
 */
export default function Diagnostico(): React.JSX.Element {
  const [consulta, setConsulta] = useState<Consulta>({ fase: "cargando" })

  useEffect(() => {
    let vigente = true

    consultarSalud()
      .then((salud) => {
        if (vigente) {
          setConsulta({ fase: "ok", salud })
        }
      })
      .catch((error: unknown) => {
        if (vigente) {
          setConsulta({
            fase: "error",
            motivo: error instanceof Error ? error.message : "Error desconocido",
          })
        }
      })

    // Evita actualizar el estado si la pantalla ya no esta montada.
    return () => {
      vigente = false
    }
  }, [])

  return (
    <SafeAreaView style={estilos.pantalla}>
      <View style={estilos.contenido}>
        <Text style={estilos.marca}>ALPHA &amp; OMEGA</Text>
        <Text style={estilos.lema}>TRAINING</Text>

        <View style={estilos.tarjeta}>
          <Text style={estilos.titulo}>CONEXIÓN CON LA API</Text>

          {consulta.fase === "cargando" && <ActivityIndicator color={tema.oro} />}

          {consulta.fase === "ok" && (
            <>
              <Text style={estilos.valor}>Servidor: {consulta.salud.estado}</Text>
              <Text style={estilos.valor}>Base de datos: {consulta.salud.baseDeDatos}</Text>
            </>
          )}

          {consulta.fase === "error" && <Text style={estilos.error}>{consulta.motivo}</Text>}
        </View>
      </View>
    </SafeAreaView>
  )
}

const estilos = StyleSheet.create({
  pantalla: {
    flex: 1,
    backgroundColor: tema.fondo,
  },
  contenido: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  marca: {
    color: tema.oro,
    fontSize: 24,
    letterSpacing: 4,
    fontWeight: "700",
  },
  lema: {
    color: tema.textoTenue,
    fontSize: 12,
    letterSpacing: 8,
    marginTop: 4,
    marginBottom: 40,
  },
  tarjeta: {
    alignSelf: "stretch",
    backgroundColor: tema.superficie,
    borderColor: tema.borde,
    borderWidth: 1,
    borderRadius: 12,
    padding: 20,
    gap: 8,
  },
  titulo: {
    color: tema.oroSuave,
    fontSize: 11,
    letterSpacing: 2,
    marginBottom: 8,
  },
  valor: {
    color: tema.texto,
    fontSize: 15,
  },
  error: {
    color: tema.error,
    fontSize: 13,
    lineHeight: 20,
  },
})
