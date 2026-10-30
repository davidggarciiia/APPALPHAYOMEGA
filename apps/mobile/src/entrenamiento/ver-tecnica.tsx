import { useEffect, useState } from "react"
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import type { Ejercicio } from "@alpha-omega/shared"

import { ETIQUETA_DE_GRUPO } from "../catalogo-ejercicios/catalogo"
import { FiguraDeEjercicio, type AccesoAFiguras } from "../catalogo-ejercicios/figura-ejercicio"
import { BotonSecundario } from "../componentes/formulario"
import { Icono } from "../componentes/iconos"
import { fondoDeMarca, tema } from "../tema"
import type { AlmacenLocal } from "./almacen-local"
import { guardarFicha, leerFicha } from "./ficha-local"

type Carga =
  { fase: "cargando" } | { fase: "lista"; ejercicio: Ejercicio; copia: boolean } | { fase: "error" }

/**
 * La técnica de un ejercicio del entrenamiento, con el diseño de «Técnica del
 * ejercicio»: su animación, si tiene, los grupos musculares y cómo se hace. Se
 * abre encima del registro, así que cerrarla deja kg, series, marcas y notas
 * como estaban; nada de lo que falle aquí toca el entreno.
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

  const grupos =
    carga.fase === "lista"
      ? [carga.ejercicio.grupoPrincipal, ...carga.ejercicio.gruposSecundarios]
          .map((grupo) => ETIQUETA_DE_GRUPO[grupo])
          .join(" · ")
      : null

  return (
    <Modal visible animationType="none" onRequestClose={cerrar}>
      <SafeAreaView style={estilos.pantalla}>
        <ScrollView contentContainerStyle={estilos.contenido}>
          <Pressable
            style={estilos.atras}
            accessibilityRole="button"
            accessibilityLabel="Volver al entrenamiento"
            onPress={cerrar}
          >
            <Icono nombre="atras" color={tema.texto} />
          </Pressable>
          {carga.fase === "cargando" && (
            <ActivityIndicator color={tema.acento} accessibilityLabel="Cargando la técnica" />
          )}
          {carga.fase === "lista" &&
            (carga.ejercicio.figura === null ? (
              <View style={estilos.sinFigura}>
                <Text style={estilos.nota}>Este ejercicio todavía no tiene animación.</Text>
              </View>
            ) : (
              <FiguraDeEjercicio
                acceso={acceso}
                ejercicioId={carga.ejercicio.id}
                figura={carga.ejercicio.figura}
                nombre={carga.ejercicio.nombre}
              />
            ))}
          <View style={estilos.bloque}>
            <Text accessibilityRole="header" style={estilos.titulo}>
              {carga.fase === "lista" ? carga.ejercicio.nombre : nombre}
            </Text>
            {grupos !== null && <Text style={estilos.grupos}>{grupos}</Text>}
          </View>
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
                <Text style={estilos.aviso}>
                  Sin conexión: mostramos la ficha guardada en este móvil.
                </Text>
              )}
              <View style={estilos.bloque}>
                <Text style={estilos.subtitulo} accessibilityRole="header">
                  Cómo hacerlo
                </Text>
                {carga.ejercicio.pasos.length === 0 ? (
                  <Text style={estilos.texto}>{carga.ejercicio.instrucciones}</Text>
                ) : (
                  carga.ejercicio.pasos.map((paso, n) => (
                    <View key={`${n}-${paso}`} style={estilos.paso}>
                      <Text style={estilos.numero}>{n + 1}</Text>
                      <Text style={[estilos.texto, estilos.flexible]}>{paso}</Text>
                    </View>
                  ))
                )}
              </View>
              {carga.ejercicio.evita !== null && (
                <View style={estilos.bloque}>
                  <Text style={estilos.subtitulo} accessibilityRole="header">
                    Evita
                  </Text>
                  <Text style={estilos.texto}>{carga.ejercicio.evita}</Text>
                </View>
              )}
              {carga.ejercicio.consejos.length > 0 && (
                <View style={estilos.consejos}>
                  {carga.ejercicio.consejos.map((consejo, n) => (
                    <View
                      key={`${n}-${consejo.titulo}`}
                      style={[
                        estilos.consejo,
                        n < carga.ejercicio.consejos.length - 1 && estilos.separado,
                      ]}
                    >
                      <Text style={estilos.tituloConsejo}>{consejo.titulo}</Text>
                      <Text style={estilos.nota}>{consejo.texto}</Text>
                    </View>
                  ))}
                </View>
              )}
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  )
}

const estilos = StyleSheet.create({
  pantalla: { flex: 1, ...fondoDeMarca },
  contenido: {
    padding: 20,
    gap: 24,
    width: "100%",
    maxWidth: 560,
    alignSelf: "center",
  },
  atras: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: tema.superficie,
    alignItems: "center",
    justifyContent: "center",
  },
  sinFigura: {
    minHeight: 160,
    borderRadius: 20,
    backgroundColor: tema.superficie,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  bloque: { gap: 8 },
  titulo: {
    color: tema.texto,
    fontSize: 34,
    lineHeight: 38,
    fontFamily: tema.fuenteTitulo,
    textTransform: "uppercase",
  },
  grupos: { color: tema.textoTenue, fontFamily: tema.fuenteTexto, fontSize: 15 },
  subtitulo: { color: tema.texto, fontFamily: tema.fuenteBoton, fontSize: 20 },
  texto: { color: tema.texto, fontFamily: tema.fuenteTexto, fontSize: 15, lineHeight: 22 },
  nota: { color: tema.textoTenue, fontFamily: tema.fuenteTexto, fontSize: 15, lineHeight: 21 },
  aviso: { color: tema.aviso, fontFamily: tema.fuenteSemi, fontSize: 13, lineHeight: 19 },
  paso: { flexDirection: "row", gap: 16, alignItems: "flex-start" },
  numero: {
    color: tema.acento,
    fontFamily: tema.fuenteBoton,
    fontSize: 15,
    lineHeight: 22,
    width: 12,
  },
  flexible: { flex: 1 },
  consejos: { backgroundColor: tema.superficie, borderRadius: 20, paddingHorizontal: 16 },
  consejo: { paddingVertical: 14, gap: 2 },
  separado: { borderBottomWidth: 1, borderBottomColor: tema.borde },
  tituloConsejo: { color: tema.texto, fontFamily: tema.fuenteBoton, fontSize: 15 },
})
