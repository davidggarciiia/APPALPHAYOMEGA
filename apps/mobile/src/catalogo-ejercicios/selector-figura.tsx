import { useState } from "react"
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native"
import type { Ejercicio, MedioDisponible } from "@alpha-omega/shared"

import { AvisoDeError, BotonSecundario, Campo } from "../componentes/formulario"
import { faltaDe, type Falta } from "../lib/errores"
import { tema } from "../tema"

import type { ApiDeCatalogo } from "./api"
import { FiguraDeEjercicio, type AccesoAFiguras } from "./figura-ejercicio"

type Lista =
  | { fase: "cerrada" }
  | { fase: "cargando" }
  | { fase: "abierta"; medios: MedioDisponible[] }
  | { fase: "error"; fallo: Falta }

/** "Sentadilla búlgara" se encuentra escribiendo "bulgara". */
function plegar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es")
    .trim()
}

/**
 * Elegir, cambiar o quitar la animación de un ejercicio.
 *
 * Cada elección se guarda en el momento, aparte del botón GUARDAR de la ficha de
 * texto: es otra operación del servidor y se puede deshacer eligiendo otra. Solo
 * ofrece figuras que el servidor tiene importadas, nunca una dirección libre.
 */
export function SelectorDeFigura({
  api,
  acceso,
  ejercicio,
  onCambio,
}: {
  api: ApiDeCatalogo
  acceso: AccesoAFiguras
  ejercicio: Ejercicio
  onCambio: (ejercicio: Ejercicio) => void
}): React.JSX.Element {
  const [lista, setLista] = useState<Lista>({ fase: "cerrada" })
  const [filtro, setFiltro] = useState("")
  const [guardando, setGuardando] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const figura = ejercicio.figura

  async function abrir(): Promise<void> {
    setLista({ fase: "cargando" })
    try {
      setLista({ fase: "abierta", medios: (await api.medios()).medios })
    } catch (fallo) {
      setLista({ fase: "error", fallo: faltaDe(fallo, "No hemos podido cargar las figuras.") })
    }
  }

  async function asignar(medioId: string | null): Promise<void> {
    setError(null)
    setGuardando(medioId ?? "quitar")
    try {
      onCambio(await api.asignarFigura(ejercicio.id, medioId))
      setLista({ fase: "cerrada" })
      setFiltro("")
    } catch (fallo) {
      setError(
        faltaDe(
          fallo,
          medioId === null
            ? "No hemos podido quitar la figura."
            : "No hemos podido guardar la figura.",
        ).texto,
      )
    } finally {
      setGuardando(null)
    }
  }

  const buscado = plegar(filtro)
  const visibles =
    lista.fase === "abierta"
      ? lista.medios.filter((medio) => plegar(medio.nombre).includes(buscado))
      : []

  return (
    <View style={estilos.seccion}>
      <Text style={estilos.etiqueta}>ANIMACIÓN DE LA TÉCNICA</Text>

      {figura === null ? (
        <Text style={estilos.nota}>
          Sin animación. El cliente verá solo el nombre y las instrucciones.
        </Text>
      ) : (
        <>
          <FiguraDeEjercicio
            acceso={acceso}
            ejercicioId={ejercicio.id}
            figura={figura}
            nombre={ejercicio.nombre}
          />
          <Text style={estilos.nota}>
            {figura.sinConexion
              ? "El móvil del cliente la guarda al verla con conexión; el sistema puede borrarla si necesita espacio."
              : "Esta animación solo se ve con conexión."}
          </Text>
        </>
      )}

      {error !== null && <AvisoDeError mensaje={error} />}

      {lista.fase === "cerrada" && (
        <View>
          <BotonSecundario
            texto={figura === null ? "ELEGIR ANIMACIÓN" : "CAMBIAR ANIMACIÓN"}
            onPress={() => void abrir()}
          />
          {figura !== null && (
            <BotonSecundario
              texto="QUITAR ANIMACIÓN"
              ocupado={guardando === "quitar"}
              onPress={() => void asignar(null)}
            />
          )}
        </View>
      )}

      {lista.fase === "cargando" && (
        <ActivityIndicator color={tema.acento} accessibilityLabel="Cargando las figuras" />
      )}

      {lista.fase === "error" && (
        <>
          <AvisoDeError mensaje={lista.fallo.texto} />
          {lista.fallo.reintentable && (
            <BotonSecundario texto="REINTENTAR" onPress={() => void abrir()} />
          )}
          <BotonSecundario texto="CERRAR" onPress={() => setLista({ fase: "cerrada" })} />
        </>
      )}

      {lista.fase === "abierta" && (
        <View style={estilos.lista}>
          {lista.medios.length === 0 ? (
            <Text style={estilos.nota}>Este servidor todavía no tiene figuras importadas.</Text>
          ) : (
            <>
              <Campo
                etiqueta="Buscar animación"
                value={filtro}
                onChangeText={setFiltro}
                maxLength={60}
                placeholder="Sentadilla, press, remo…"
              />
              <View accessibilityRole="radiogroup">
                {visibles.map((medio) => {
                  const elegida = medio.id === figura?.medioId
                  return (
                    <Pressable
                      key={medio.id}
                      onPress={() => void asignar(medio.id)}
                      disabled={guardando !== null}
                      accessibilityRole="radio"
                      aria-checked={elegida}
                      accessibilityLabel={medio.nombre}
                      accessibilityHint={medio.sinConexion ? undefined : "Solo con conexión"}
                      accessibilityState={{ checked: elegida, busy: guardando === medio.id }}
                      style={[estilos.fila, elegida && estilos.filaElegida]}
                    >
                      <Text style={estilos.nombre}>{medio.nombre}</Text>
                      {guardando === medio.id ? (
                        <ActivityIndicator color={tema.acento} />
                      ) : (
                        !medio.sinConexion && (
                          <Text style={estilos.distintivo}>Solo con conexión</Text>
                        )
                      )}
                    </Pressable>
                  )
                })}
                {visibles.length === 0 && (
                  <Text style={estilos.nota}>Ninguna animación coincide con «{filtro}».</Text>
                )}
              </View>
            </>
          )}
          <BotonSecundario
            texto="CERRAR"
            onPress={() => {
              setLista({ fase: "cerrada" })
              setFiltro("")
            }}
          />
        </View>
      )}
    </View>
  )
}

const estilos = StyleSheet.create({
  seccion: { gap: 10, marginTop: 20 },
  etiqueta: {
    fontFamily: tema.fuenteTexto,
    color: tema.textoSecundario,
    fontSize: 11,
    letterSpacing: 2,
  },
  nota: { fontFamily: tema.fuenteTexto, color: tema.textoTenue, fontSize: 13, lineHeight: 19 },
  lista: { gap: 8 },
  fila: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: tema.borde,
  },
  filaElegida: { backgroundColor: tema.acentoSuave },
  nombre: { fontFamily: tema.fuenteTexto, color: tema.texto, fontSize: 15, flexShrink: 1 },
  distintivo: { fontFamily: tema.fuenteTexto, color: tema.textoTenue, fontSize: 12 },
})
