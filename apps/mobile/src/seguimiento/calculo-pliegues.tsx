import { useState } from "react"
import { Pressable, StyleSheet, Text, View } from "react-native"
import Animated from "react-native-reanimated"
import {
  calcularGrasaPorPliegues,
  PROTOCOLOS_GRASA_POR_PLIEGUES,
  type DefinicionCorporal,
  type ProtocoloGrasaPorPliegues,
  type ResultadoCorporal,
} from "@alpha-omega/shared"

import { BotonSecundario, Campo } from "../componentes/formulario"
import { caida, useMovimientoReducido } from "../componentes/movimiento"
import { alto, radio, tema, tipo } from "../tema"
import { edadEn, leerDecimal } from "./modelo"
import { decimal, type CampoCorporal, type CampoGrasa } from "./valoracion-modelo"

function Opcion({
  nombre,
  elegida,
  bloqueado,
  elegir,
}: {
  nombre: string
  elegida: boolean
  bloqueado: boolean
  elegir: () => void
}): React.JSX.Element {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={nombre}
      accessibilityState={{ checked: elegida, disabled: bloqueado }}
      disabled={bloqueado}
      onPress={elegir}
      style={[s.opcion, elegida && s.elegida, bloqueado && s.apagada]}
    >
      <Text style={[s.textoOpcion, elegida && s.textoElegido]}>{nombre}</Text>
    </Pressable>
  )
}

/** Propone un resultado; solo «Usar» cambia el porcentaje guardado por el profesional. */
export function CalculoPliegues({
  definiciones,
  campos,
  fechaNacimiento,
  fechaToma,
  cambiar,
  bloqueado,
}: {
  definiciones: DefinicionCorporal[]
  campos: Record<string, CampoCorporal>
  fechaNacimiento?: string | null
  fechaToma: string
  cambiar: (grasa: CampoGrasa) => void
  bloqueado: boolean
}): React.JSX.Element {
  const reducido = useMovimientoReducido()
  const [protocolo, setProtocolo] = useState<ProtocoloGrasaPorPliegues | null>(null)
  const [sexo, setSexo] = useState<"hombre" | "mujer" | null>(null)
  const [edadEscrita, setEdad] = useState<string | null>(null)
  const edadCliente = fechaNacimiento ? edadEn(fechaNacimiento, fechaToma) : null
  const edad = edadEscrita ?? (Number.isInteger(edadCliente) ? String(edadCliente) : "")
  const elegido = PROTOCOLOS_GRASA_POR_PLIEGUES.find((p) => p.id === protocolo)
  const corporales: ResultadoCorporal[] = definiciones.map((d) => {
    const campo = campos[d.id]
    if (campo?.noRealizado) return { definicionId: d.id, estado: "noRealizado", motivo: null }
    const valor = leerDecimal(campo?.texto ?? "")
    return valor === null
      ? { definicionId: d.id, estado: "pendiente" }
      : { definicionId: d.id, estado: "registrado", valor }
  })
  const resultado = protocolo
    ? calcularGrasaPorPliegues({
        protocolo,
        sexo,
        edad: leerDecimal(edad),
        definiciones,
        corporales,
      })
    : null

  return (
    <View style={s.grupo}>
      <View
        accessibilityRole="radiogroup"
        accessibilityLabel="Protocolo de grasa por pliegues"
        accessibilityState={{ disabled: bloqueado }}
        style={s.opciones}
      >
        <Opcion
          nombre="Manual"
          elegida={protocolo === null}
          bloqueado={bloqueado}
          elegir={() => setProtocolo(null)}
        />
        {PROTOCOLOS_GRASA_POR_PLIEGUES.map((p) => (
          <Opcion
            key={p.id}
            nombre={p.nombre}
            elegida={p.id === protocolo}
            bloqueado={bloqueado}
            elegir={() => setProtocolo(p.id)}
          />
        ))}
      </View>
      {elegido && (
        <Animated.View key={protocolo} entering={caida(0, reducido)} style={s.grupo}>
          {elegido.requiereSexo && (
            <View
              accessibilityRole="radiogroup"
              accessibilityLabel="Sexo para la fórmula"
              accessibilityState={{ disabled: bloqueado }}
              style={s.opciones}
            >
              <Opcion
                nombre="Hombre"
                elegida={sexo === "hombre"}
                bloqueado={bloqueado}
                elegir={() => setSexo("hombre")}
              />
              <Opcion
                nombre="Mujer"
                elegida={sexo === "mujer"}
                bloqueado={bloqueado}
                elegir={() => setSexo("mujer")}
              />
            </View>
          )}
          {elegido.requiereEdad && (
            <Campo
              etiqueta="Edad en la toma (años)"
              value={edad}
              editable={!bloqueado}
              keyboardType="number-pad"
              maxLength={3}
              onChangeText={setEdad}
            />
          )}
          {resultado?.ok ? (
            <View style={s.resultado}>
              <Text style={s.cifra}>{decimal(resultado.valorPct)} %</Text>
              <Text style={s.tenue}>
                {resultado.metodo} · {decimal(resultado.sumaMm)} mm
              </Text>
              <BotonSecundario
                texto={`Usar ${decimal(resultado.valorPct)} %`}
                deshabilitado={bloqueado}
                onPress={() =>
                  cambiar({
                    texto: decimal(resultado.valorPct),
                    metodo: resultado.metodo,
                    fecha: fechaToma,
                  })
                }
              />
            </View>
          ) : (
            resultado && (
              <Text accessibilityRole="alert" style={s.aviso}>
                {resultado.problemas.join(" ")}
              </Text>
            )
          )}
        </Animated.View>
      )}
    </View>
  )
}

const s = StyleSheet.create({
  grupo: { gap: 12 },
  opciones: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  opcion: {
    minHeight: alto.tactil,
    paddingHorizontal: 12,
    borderRadius: radio.campo,
    borderWidth: 1,
    borderColor: tema.bordeFuerte,
    justifyContent: "center",
  },
  elegida: { borderColor: tema.acento, backgroundColor: tema.acentoSuave },
  apagada: { opacity: 0.5 },
  textoOpcion: { ...tipo.secundario, color: tema.textoSecundario },
  textoElegido: { color: tema.acento },
  resultado: { gap: 8 },
  cifra: { ...tipo.tituloPantalla, ...tipo.cifras, color: tema.acento },
  tenue: tipo.secundario,
  aviso: { ...tipo.secundario, color: tema.aviso },
})
