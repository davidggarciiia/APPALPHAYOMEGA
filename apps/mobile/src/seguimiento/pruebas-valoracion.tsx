import { StyleSheet, Text, View } from "react-native"
import type { DefinicionPrueba, MetricaDePrueba } from "@alpha-omega/shared"

import { Campo } from "../componentes/formulario"
import { fechaCorta } from "../entrenamiento/plan/modelo"
import { Fila, Tarjeta, Titulo } from "../entrenamiento/plan/piezas"
import { Opciones } from "../entrenamiento/sesion/controles"
import { tema } from "../tema"
import { CAMPO_PRUEBA_VACIO, decimal, type CampoPrueba } from "./valoracion-modelo"

/** Un resultado de una visita anterior para la misma definición. Solo se muestra. */
export type ReferenciaPrueba = {
  definicionId: string
  fecha: string
  valores: Record<string, number>
}

const ESTADOS = [
  { valor: "pendiente", texto: "Pendiente" },
  { valor: "registrado", texto: "Registrar resultado" },
  { valor: "noRealizado", texto: "No realizada" },
] as const

/** «Dominadas · Agarre prono»: dos variantes con el mismo nombre no se confunden. */
const tituloDe = (d: DefinicionPrueba): string => [d.nombre, d.variante].filter(Boolean).join(" · ")

/** La principal primero; el resto en el orden de la definición. */
const ordenadas = (metricas: MetricaDePrueba[]): MetricaDePrueba[] => [
  ...metricas.filter((m) => m.principal),
  ...metricas.filter((m) => !m.principal),
]

/** «Anterior · 12 mar 2026: 31 reps», de la visita más reciente que tenga la principal. */
function referenciaDe(d: DefinicionPrueba, referencias: ReferenciaPrueba[]): string | null {
  const principal = d.metricas.find((m) => m.principal)
  if (!principal) return null
  let ultima: ReferenciaPrueba | null = null
  for (const r of referencias) {
    if (r.definicionId !== d.id || typeof r.valores[principal.clave] !== "number") continue
    if (ultima === null || r.fecha > ultima.fecha) ultima = r
  }
  if (ultima === null) return null
  const fecha = `${fechaCorta(ultima.fecha)} ${ultima.fecha.slice(0, 4)}`
  return `Anterior · ${fecha}: ${decimal(ultima.valores[principal.clave]!)} ${principal.unidad}`
}

type Edicion = {
  titulo: string
  campo: CampoPrueba
  poner: (cambio: Partial<CampoPrueba>) => void
  bloqueado: boolean
}

/** Un campo por métrica, protocolo completo, fecha si fue otro día y notas. */
function Resultado({
  definicion,
  titulo,
  campo,
  poner,
  bloqueado,
}: Edicion & { definicion: DefinicionPrueba }): React.JSX.Element {
  return (
    <>
      {ordenadas(definicion.metricas).map((m) => {
        const etiqueta = `${m.nombre} (${m.unidad})`
        return (
          <Campo
            key={m.clave}
            etiqueta={m.opcional ? `${etiqueta} · opcional` : etiqueta}
            accessibilityLabel={`${titulo}: ${etiqueta}${m.opcional ? ", opcional" : ""}`}
            value={campo.valores[m.clave] ?? ""}
            placeholder="Sin dato"
            editable={!bloqueado}
            keyboardType="decimal-pad"
            maxLength={8}
            onChangeText={(texto) => poner({ valores: { ...campo.valores, [m.clave]: texto } })}
          />
        )
      })}
      <Text style={s.etiqueta}>Protocolo completo</Text>
      <Opciones
        etiqueta={`Protocolo completo de ${titulo}`}
        opciones={[
          { valor: "si", texto: "Sí", accesible: `Protocolo completo: sí — ${titulo}` },
          { valor: "no", texto: "No", accesible: `Protocolo completo: no — ${titulo}` },
        ]}
        valor={campo.protocoloCompleto === null ? null : campo.protocoloCompleto ? "si" : "no"}
        cambiar={(valor) => poner({ protocoloCompleto: valor === "si" })}
        deshabilitado={bloqueado}
      />
      <Campo
        etiqueta="Fecha si se hizo otro día (AAAA-MM-DD)"
        accessibilityLabel={`${titulo}: fecha si se hizo otro día (AAAA-MM-DD)`}
        value={campo.fecha}
        placeholder="Día de la visita"
        editable={!bloqueado}
        maxLength={10}
        onChangeText={(fecha) => poner({ fecha })}
      />
      <Campo
        etiqueta="Notas"
        accessibilityLabel={`${titulo}: notas`}
        accessibilityHint="El cliente verá estas notas al publicar."
        value={campo.notas}
        editable={!bloqueado}
        multiline
        maxLength={500}
        onChangeText={(notas) => poner({ notas })}
      />
      <Text style={s.tenue}>El cliente verá estas notas al publicar.</Text>
    </>
  )
}

function NoRealizada({ titulo, campo, poner, bloqueado }: Edicion): React.JSX.Element {
  return (
    <>
      <Campo
        etiqueta="Motivo (opcional)"
        accessibilityLabel={`${titulo}: motivo (opcional)`}
        accessibilityHint="El cliente verá el motivo al publicar."
        value={campo.motivo}
        editable={!bloqueado}
        maxLength={200}
        onChangeText={(motivo) => poner({ motivo })}
      />
      <Text style={s.tenue}>El cliente verá el motivo al publicar.</Text>
    </>
  )
}

function Prueba({
  definicion: d,
  campo,
  referencia,
  cambiar,
  bloqueado,
}: {
  definicion: DefinicionPrueba
  campo: CampoPrueba
  referencia: string | null
  cambiar: (campo: CampoPrueba) => void
  bloqueado: boolean
}): React.JSX.Element {
  const titulo = tituloDe(d)
  const detalles = [
    d.duracionPrescritaS === null ? null : `${d.duracionPrescritaS} s`,
    d.instrumento,
  ]
    .filter(Boolean)
    .join(" · ")
  // Cambiar de estado conserva lo escrito: lo que no corresponde no se guarda.
  const poner = (cambio: Partial<CampoPrueba>): void => cambiar({ ...campo, ...cambio })
  const edicion: Edicion = { titulo, campo, poner, bloqueado }
  return (
    <View style={s.prueba}>
      <Text style={s.nombre} accessibilityRole="header">
        {titulo}
      </Text>
      {detalles !== "" && <Text style={s.tenue}>{detalles}</Text>}
      {d.protocolo ? <Text style={s.tenue}>{`Protocolo: ${d.protocolo}`}</Text> : null}
      {referencia ? <Text style={s.referencia}>{referencia}</Text> : null}
      <View style={s.estado}>
        <Opciones
          etiqueta={`Estado de ${titulo}`}
          opciones={ESTADOS.map((e) => ({ ...e, accesible: `${e.texto} — ${titulo}` }))}
          valor={campo.estado}
          cambiar={(estado) => poner({ estado })}
          deshabilitado={bloqueado}
        />
      </View>
      {campo.estado === "registrado" && <Resultado definicion={d} {...edicion} />}
      {campo.estado === "noRealizado" && <NoRealizada {...edicion} />}
    </View>
  )
}

/**
 * Pruebas físicas de la visita. Controlado: cada cambio devuelve el campo
 * completo. «Pendiente» no escribe nada; la referencia anterior solo se lee.
 */
export function BloquePruebas({
  definiciones,
  campos,
  referencias,
  cambiar,
  bloqueado,
}: {
  definiciones: DefinicionPrueba[]
  campos: Record<string, CampoPrueba>
  referencias: ReferenciaPrueba[]
  cambiar: (id: string, campo: CampoPrueba) => void
  bloqueado: boolean
}): React.JSX.Element {
  return (
    <View style={s.grupo}>
      <Titulo>Pruebas</Titulo>
      {definiciones.length === 0 ? (
        <Text style={s.tenue}>Esta visita no tiene pruebas en su plantilla.</Text>
      ) : (
        <Tarjeta>
          {definiciones.map((d, n) => (
            <Fila key={d.id} primera={n === 0}>
              <Prueba
                definicion={d}
                campo={campos[d.id] ?? CAMPO_PRUEBA_VACIO}
                referencia={referenciaDe(d, referencias)}
                cambiar={(campo) => cambiar(d.id, campo)}
                bloqueado={bloqueado}
              />
            </Fila>
          ))}
        </Tarjeta>
      )}
    </View>
  )
}

const s = StyleSheet.create({
  grupo: { gap: 12 },
  prueba: { flex: 1, minWidth: 0, gap: 4 },
  nombre: { color: tema.texto, fontFamily: tema.fuenteBoton, fontSize: 16 },
  tenue: { color: tema.textoTenue, fontFamily: tema.fuenteTexto, fontSize: 13, lineHeight: 18 },
  referencia: { color: tema.textoSecundario, fontFamily: tema.fuenteSemi, fontSize: 14 },
  estado: { marginTop: 8 },
  etiqueta: {
    color: tema.texto,
    fontFamily: tema.fuenteSemi,
    fontSize: 15,
    marginTop: 16,
    marginBottom: 8,
  },
})
