import { useEffect, useState } from "react"
import { ActivityIndicator, Modal, ScrollView, StyleSheet, Text, View } from "react-native"
import type { Ejercicio } from "@alpha-omega/shared"

import { FiguraDeEjercicio, type AccesoAFiguras } from "../catalogo-ejercicios/figura-ejercicio"
import { BotonPrincipal, BotonSecundario } from "../componentes/formulario"
import { tema } from "../tema"
import type { AlmacenLocal } from "./almacen-local"
import { guardarFicha, leerFicha } from "./ficha-local"

type Carga =
  { fase: "cargando" } | { fase: "lista"; ejercicio: Ejercicio; copia: boolean } | { fase: "error" }

/**
 * La técnica de un ejercicio del entrenamiento: su animación, si tiene, y sus
 * instrucciones. Se abre encima del registro, así que cerrarla deja kg, series,
 * marcas y notas como estaban; nada de lo que falle aquí toca el entreno.
 */
export function VerTecnica({
  cuenta,
  ejercicioId,
  nombre,
  leer,
  almacen,
  acceso,
  cerrar,
}: {
  cuenta: string
  ejercicioId: string
  nombre: string
  leer: (id: string) => Promise<Ejercicio>
  almacen: AlmacenLocal
  acceso: AccesoAFiguras
  cerrar: () => void
}): React.JSX.Element {
  const [carga, setCarga] = useState<Carga>({ fase: "cargando" })
  const [intento, setIntento] = useState(0)

  useEffect(() => {
    let vigente = true
    setCarga({ fase: "cargando" })
    void (async () => {
      try {
        const ejercicio = await leer(ejercicioId)
        if (!vigente) return
        setCarga({ fase: "lista", ejercicio, copia: false })
        // Guardarla es una ayuda para la próxima vez sin red; si falla, no se avisa.
        await guardarFicha(almacen, cuenta, ejercicio).catch(() => undefined)
      } catch {
        const copia = await leerFicha(almacen, cuenta, ejercicioId).catch(() => null)
        if (!vigente) return
        setCarga(
          copia === null ? { fase: "error" } : { fase: "lista", ejercicio: copia, copia: true },
        )
      }
    })()
    return () => {
      vigente = false
    }
  }, [leer, almacen, cuenta, ejercicioId, intento])

  return (
    <Modal visible transparent animationType="fade" onRequestClose={cerrar}>
      <View style={estilos.velo}>
        <View style={estilos.hoja}>
          <ScrollView contentContainerStyle={estilos.contenido}>
            <Text accessibilityRole="header" style={estilos.titulo}>
              {carga.fase === "lista" ? carga.ejercicio.nombre : nombre}
            </Text>
            {carga.fase === "cargando" && (
              <ActivityIndicator color={tema.acento} accessibilityLabel="Cargando la técnica" />
            )}
            {carga.fase === "error" && (
              <>
                <Text style={estilos.texto}>
                  No hemos podido abrir la técnica. La primera vez necesitas conexión; después queda
                  guardada en este móvil.
                </Text>
                <BotonSecundario texto="Reintentar" onPress={() => setIntento((n) => n + 1)} />
              </>
            )}
            {carga.fase === "lista" && (
              <>
                {carga.copia && (
                  <Text style={estilos.nota}>
                    Sin conexión: mostramos la ficha guardada en este móvil.
                  </Text>
                )}
                {carga.ejercicio.figura === null ? (
                  <Text style={estilos.nota}>Este ejercicio todavía no tiene animación.</Text>
                ) : (
                  <FiguraDeEjercicio
                    acceso={acceso}
                    ejercicioId={carga.ejercicio.id}
                    figura={carga.ejercicio.figura}
                    nombre={carga.ejercicio.nombre}
                  />
                )}
                <Text style={estilos.etiqueta}>CÓMO SE HACE</Text>
                <Text style={estilos.texto}>{carga.ejercicio.instrucciones}</Text>
              </>
            )}
            <BotonPrincipal texto="Volver al entrenamiento" onPress={cerrar} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  )
}

const estilos = StyleSheet.create({
  velo: {
    flex: 1,
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,.65)",
    padding: 16,
  },
  hoja: {
    backgroundColor: tema.superficie,
    borderRadius: 18,
    maxHeight: "95%",
    width: "100%",
    maxWidth: 520,
    alignSelf: "center",
  },
  contenido: { padding: 20, gap: 14 },
  titulo: { color: tema.texto, fontSize: 28, fontFamily: tema.fuenteTitulo },
  etiqueta: {
    color: tema.textoSecundario,
    fontFamily: tema.fuenteBoton,
    fontSize: 11,
    letterSpacing: 2,
  },
  texto: { color: tema.texto, fontFamily: tema.fuenteTexto, fontSize: 15, lineHeight: 22 },
  nota: { color: tema.textoTenue, fontFamily: tema.fuenteTexto, fontSize: 13, lineHeight: 19 },
})
