import { useEffect, useState } from "react"
import { randomUUID } from "expo-crypto"
import { Pressable, StyleSheet, Text, View } from "react-native"
import {
  GuardarConfiguracionSeguimientoSchema,
  type ConfiguracionSeguimiento,
} from "@alpha-omega/shared"

import { AvisoDeError, BotonPrincipal, BotonSecundario, Campo } from "../componentes/formulario"
import { ErrorDePeticion } from "../lib/http"
import { faltaDe } from "../lib/errores"
import { tema } from "../tema"
import { leerDecimal } from "./modelo"

type Indicador = ConfiguracionSeguimiento["indicadores"][number]
type Registro = ConfiguracionSeguimiento["registrosSolicitados"][number]
type Frecuencia = Registro["frecuencia"] | "ninguna"
const NOMBRES: Record<Indicador, string> = {
  peso: "Peso",
  pasos: "Pasos",
  sueno: "Sueño",
  cintura: "Cintura",
  fuerza: "Fuerza",
  pruebas: "Pruebas físicas",
}
const INDICADORES: Indicador[] = ["peso", "pasos", "sueno", "cintura", "fuerza", "pruebas"]
const REGISTRABLES = ["peso", "pasos", "sueno", "cintura"] as const
const DIAS = ["L", "M", "X", "J", "V", "S", "D"]

function Opcion({
  texto,
  elegida,
  pulsar,
  etiqueta = texto,
}: {
  texto: string
  elegida?: boolean
  pulsar: () => void
  etiqueta?: string
}): React.JSX.Element {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={etiqueta}
      accessibilityState={{ selected: elegida }}
      onPress={pulsar}
      style={[s.opcion, elegida && s.opcionElegida]}
    >
      <Text style={s.texto}>{texto}</Text>
    </Pressable>
  )
}

/** Editor del entrenador con la misma revisión que devolvió GET. */
export function EditorConfiguracionSeguimiento({
  valor,
  guardar,
  recargar,
}: {
  valor: ConfiguracionSeguimiento
  guardar: (datos: ConfiguracionSeguimiento) => Promise<ConfiguracionSeguimiento>
  recargar: () => void
}): React.JSX.Element {
  const [borrador, setBorrador] = useState(valor)
  const [minimo, setMinimo] = useState(valor.objetivoPeso?.rangoKg?.minimo.toString() ?? "")
  const [maximo, setMaximo] = useState(valor.objetivoPeso?.rangoKg?.maximo.toString() ?? "")
  const [estado, setEstado] = useState<"cambios" | "guardando" | "guardado" | "conflicto">(
    "guardado",
  )
  const [error, setError] = useState("")

  useEffect(() => {
    setBorrador(valor)
    setMinimo(valor.objetivoPeso?.rangoKg?.minimo.toString() ?? "")
    setMaximo(valor.objetivoPeso?.rangoKg?.maximo.toString() ?? "")
    setEstado("guardado")
  }, [valor])

  const cambiar = (nuevo: ConfiguracionSeguimiento): void => {
    setBorrador(nuevo)
    setEstado("cambios")
    setError("")
  }
  const mover = (indicador: Indicador, delta: number): void => {
    const lista = [...borrador.indicadores]
    const origen = lista.indexOf(indicador)
    const destino = origen + delta
    if (origen < 0 || destino < 0 || destino >= lista.length) return
    ;[lista[origen], lista[destino]] = [lista[destino]!, lista[origen]!]
    cambiar({ ...borrador, indicadores: lista })
  }
  const frecuencia = (indicador: Registro["indicador"], nueva: Frecuencia): void => {
    const registrosSolicitados = borrador.registrosSolicitados.filter(
      (r) => r.indicador !== indicador,
    )
    if (nueva !== "ninguna") {
      const previo = borrador.registrosSolicitados.find((r) => r.indicador === indicador)
      registrosSolicitados.push({
        indicador,
        frecuencia: nueva,
        diaSemana: nueva === "semanal" ? (previo?.diaSemana ?? 1) : null,
      })
    }
    cambiar({ ...borrador, registrosSolicitados })
  }
  const guardarAhora = async (): Promise<void> => {
    let objetivoPeso = borrador.objetivoPeso
    if (objetivoPeso) {
      if ((minimo.trim() === "") !== (maximo.trim() === "")) {
        setError("Completa los dos extremos del rango de peso o deja ambos vacíos.")
        return
      }
      const min = leerDecimal(minimo)
      const max = leerDecimal(maximo)
      objetivoPeso = {
        ...objetivoPeso,
        rangoKg: min === null && max === null ? null : { minimo: min!, maximo: max! },
      }
    }
    const datos = GuardarConfiguracionSeguimientoSchema.safeParse({ ...borrador, objetivoPeso })
    if (!datos.success) {
      setError(datos.error.issues[0]?.message ?? "Revisa la configuración.")
      return
    }
    setEstado("guardando")
    setError("")
    try {
      const guardada = await guardar(datos.data)
      setBorrador(guardada)
      setEstado("guardado")
    } catch (fallo) {
      if (fallo instanceof ErrorDePeticion && fallo.detalle.codigo === "revision_obsoleta") {
        setEstado("conflicto")
        setError("La configuración cambió. Tu edición sigue aquí; recarga antes de guardar.")
      } else {
        setEstado("cambios")
        setError(faltaDe(fallo, "No se pudo guardar el seguimiento.").texto)
      }
    }
  }

  return (
    <View style={s.contenido}>
      <Text style={s.titulo} accessibilityRole="header">
        Configurar seguimiento
      </Text>
      <Text style={s.tenue}>El cliente verá los indicadores en este orden.</Text>
      {INDICADORES.map((indicador) => {
        const visible = borrador.indicadores.includes(indicador)
        return (
          <View key={indicador} style={s.fila}>
            <Opcion
              texto={NOMBRES[indicador]}
              etiqueta={`${visible ? "Ocultar" : "Mostrar"} ${NOMBRES[indicador]}`}
              elegida={visible}
              pulsar={() =>
                cambiar({
                  ...borrador,
                  indicadores: visible
                    ? borrador.indicadores.filter((i) => i !== indicador)
                    : [...borrador.indicadores, indicador],
                })
              }
            />
            {visible && (
              <>
                <Opcion
                  texto="↑"
                  etiqueta={`Subir ${NOMBRES[indicador]}`}
                  pulsar={() => mover(indicador, -1)}
                />
                <Opcion
                  texto="↓"
                  etiqueta={`Bajar ${NOMBRES[indicador]}`}
                  pulsar={() => mover(indicador, 1)}
                />
              </>
            )}
          </View>
        )
      })}
      <View style={s.previa}>
        <Text style={s.subtitulo}>Vista previa del cliente</Text>
        <Text style={s.texto}>
          {borrador.indicadores.map((i) => NOMBRES[i]).join(" · ") || "Sin indicadores visibles"}
        </Text>
      </View>

      <Text style={s.subtitulo}>Registros solicitados</Text>
      {REGISTRABLES.map((indicador) => {
        const actual = borrador.registrosSolicitados.find((r) => r.indicador === indicador)
        return (
          <View key={indicador} style={s.bloque}>
            <Text style={s.texto}>{NOMBRES[indicador]}</Text>
            <View style={s.fila}>
              {(["ninguna", "diaria", "semanal"] as const).map((opcion) => (
                <Opcion
                  key={opcion}
                  texto={
                    opcion === "ninguna" ? "No pedir" : opcion === "diaria" ? "Diario" : "Semanal"
                  }
                  etiqueta={`${NOMBRES[indicador]}: ${opcion}`}
                  elegida={(actual?.frecuencia ?? "ninguna") === opcion}
                  pulsar={() => frecuencia(indicador, opcion)}
                />
              ))}
            </View>
            {actual?.frecuencia === "semanal" && (
              <View style={s.fila}>
                {DIAS.map((dia, n) => (
                  <Opcion
                    key={n}
                    texto={dia}
                    etiqueta={`${NOMBRES[indicador]}: día ${n + 1}`}
                    elegida={actual.diaSemana === n + 1}
                    pulsar={() =>
                      cambiar({
                        ...borrador,
                        registrosSolicitados: borrador.registrosSolicitados.map((r) =>
                          r.indicador === indicador ? { ...r, diaSemana: n + 1 } : r,
                        ),
                      })
                    }
                  />
                ))}
              </View>
            )}
          </View>
        )
      })}

      <Text style={s.subtitulo}>Objetivo de peso</Text>
      <View style={s.fila}>
        {([null, "bajar", "mantener", "subir"] as const).map((direccion) => (
          <Opcion
            key={direccion ?? "ninguno"}
            texto={direccion ?? "Sin objetivo"}
            elegida={
              borrador.objetivoPeso?.direccion === direccion ||
              (direccion === null && borrador.objetivoPeso === null)
            }
            pulsar={() =>
              cambiar({
                ...borrador,
                objetivoPeso:
                  direccion === null
                    ? null
                    : { direccion, rangoKg: borrador.objetivoPeso?.rangoKg ?? null },
              })
            }
          />
        ))}
      </View>
      {borrador.objetivoPeso && (
        <View style={s.fila}>
          <View style={s.mitad}>
            <Campo
              etiqueta="Rango mínimo (kg)"
              value={minimo}
              onChangeText={(t) => {
                setMinimo(t)
                setEstado("cambios")
              }}
              keyboardType="decimal-pad"
            />
          </View>
          <View style={s.mitad}>
            <Campo
              etiqueta="Rango máximo (kg)"
              value={maximo}
              onChangeText={(t) => {
                setMaximo(t)
                setEstado("cambios")
              }}
              keyboardType="decimal-pad"
            />
          </View>
        </View>
      )}

      <Text style={s.subtitulo}>Pruebas prescritas</Text>
      {borrador.pruebasPrescritas.map((prueba, indice) => (
        <View key={prueba.id} style={s.bloque}>
          <Campo
            etiqueta={`Nombre de prueba ${indice + 1}`}
            value={prueba.nombre}
            maxLength={60}
            onChangeText={(nombre) =>
              cambiar({
                ...borrador,
                pruebasPrescritas: borrador.pruebasPrescritas.map((p) =>
                  p.id === prueba.id ? { ...p, nombre } : p,
                ),
              })
            }
          />
          <Campo
            etiqueta={`Unidad de prueba ${indice + 1}`}
            value={prueba.unidad}
            maxLength={12}
            onChangeText={(unidad) =>
              cambiar({
                ...borrador,
                pruebasPrescritas: borrador.pruebasPrescritas.map((p) =>
                  p.id === prueba.id ? { ...p, unidad } : p,
                ),
              })
            }
          />
          <BotonSecundario
            texto={`Quitar ${prueba.nombre || "prueba"}`}
            onPress={() =>
              cambiar({
                ...borrador,
                pruebasPrescritas: borrador.pruebasPrescritas.filter((p) => p.id !== prueba.id),
              })
            }
          />
        </View>
      ))}
      {borrador.pruebasPrescritas.length < 20 && (
        <BotonSecundario
          texto="Añadir prueba pautada"
          onPress={() =>
            cambiar({
              ...borrador,
              pruebasPrescritas: [
                ...borrador.pruebasPrescritas,
                { id: randomUUID(), nombre: "", unidad: "" },
              ],
            })
          }
        />
      )}
      <Text style={s.tenue} accessibilityLiveRegion="polite">
        {estado === "guardando"
          ? "Guardando…"
          : estado === "cambios"
            ? "Cambios sin guardar"
            : estado === "conflicto"
              ? "Revisión obsoleta"
              : `Guardado · revisión ${borrador.revision}`}
      </Text>
      {error !== "" && <AvisoDeError mensaje={error} />}
      {estado === "conflicto" && (
        <BotonSecundario texto="Cargar versión guardada" onPress={recargar} />
      )}
      <BotonPrincipal
        texto="Guardar seguimiento"
        ocupado={estado === "guardando" || estado === "conflicto"}
        onPress={() => void guardarAhora()}
      />
    </View>
  )
}

const s = StyleSheet.create({
  contenido: { gap: 12, padding: 16, backgroundColor: tema.superficie, borderRadius: 20 },
  titulo: { color: tema.texto, fontFamily: tema.fuenteTitulo, fontSize: 24 },
  subtitulo: { color: tema.texto, fontFamily: tema.fuenteBoton, fontSize: 18 },
  texto: { color: tema.texto, fontFamily: tema.fuenteTexto, fontSize: 14 },
  tenue: { color: tema.textoTenue, fontFamily: tema.fuenteTexto, fontSize: 13 },
  fila: { flexDirection: "row", flexWrap: "wrap", gap: 6, alignItems: "center" },
  bloque: { gap: 6, paddingVertical: 6, borderTopWidth: 1, borderTopColor: tema.borde },
  opcion: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: tema.bordeFuerte,
    minHeight: 40,
    justifyContent: "center",
  },
  opcionElegida: { borderColor: tema.acento, backgroundColor: tema.acentoSuave },
  previa: { gap: 6, padding: 12, backgroundColor: tema.superficieAlta, borderRadius: 12 },
  mitad: { flex: 1, minWidth: 120 },
})
