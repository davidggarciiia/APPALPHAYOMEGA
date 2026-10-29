import type { Href } from "expo-router"
import { StyleSheet, Text, View } from "react-native"
import { ETIQUETA_DE_ZONA, type ResumenSemanal } from "@alpha-omega/shared"

import { BotonEnlace } from "../componentes/botones"
import { Icono } from "../componentes/iconos"
import { Pulsable } from "../componentes/pulsable"
import { fechaLegible, sumarDias } from "../entrenamiento/fechas"
import { espacio, radio, tema, tipo } from "../tema"
import type { TrabajoCliente } from "./cargar-trabajo"

type Cliente = ResumenSemanal["clientes"][number]
type Ejercicio = Cliente["ejercicios"][number]

export const nombreCliente = (cliente: { nombre: string; apellidos: string | null }): string =>
  [cliente.nombre, cliente.apellidos].filter(Boolean).join(" ")

export function necesitaAtencion(cliente: Cliente, semana: string, hoy: string): boolean {
  return (
    cliente.molestiasAbiertas.length > 0 ||
    cliente.ejercicios.some((ejercicio) => ejercicio.estado === "Baja") ||
    (cliente.sesionesPrevistas > 0 && cliente.sesionesEnviadas === 0 && hoy >= sumarDias(semana, 2))
  )
}

const decimal = (valor: number): string => String(valor).replace(".", ",")
const diferencia = (valor: number): string => `${valor < 0 ? "−" : "+"}${decimal(Math.abs(valor))}`

function serieLegible(ejercicio: Ejercicio): string {
  const serie = ejercicio.mejorSerie
  return serie
    ? `${decimal(serie.pesoKg)} kg × ${serie.repeticiones} @ RIR ${serie.rir ?? "—"}`
    : "Sin marca esta semana"
}

function comparacionLegible(ejercicio: Ejercicio): string | null {
  if (!ejercicio.mejorSerie) return null
  const comparacion = ejercicio.comparacion
  if (!comparacion) return "Sin comparación anterior"
  if (comparacion.direccion === "igual") return "Igual"
  const { diferenciaKg, diferenciaRepeticiones } = comparacion
  return [
    comparacion.direccion === "sube" ? "Sube" : "Baja",
    diferenciaKg !== 0 ? `${diferencia(diferenciaKg)} kg` : null,
    diferenciaRepeticiones !== 0
      ? `${diferencia(diferenciaRepeticiones)} ${Math.abs(diferenciaRepeticiones) === 1 ? "rep" : "reps"}`
      : null,
  ]
    .filter(Boolean)
    .join(" · ")
}

export function TarjetaCliente({
  cliente,
  sinEnvios,
  trabajo,
  abrir,
}: {
  cliente: Cliente
  sinEnvios: boolean
  trabajo?: TrabajoCliente
  abrir: (ruta: Href) => void
}): React.JSX.Element {
  const nombre = nombreCliente(cliente)
  const sesiones = `${cliente.sesionesEnviadas} de ${cliente.sesionesPrevistas} sesiones enviadas`
  const hayMarcas = cliente.ejercicios.some((ejercicio) => ejercicio.mejorSerie !== null)
  const ejercicios = hayMarcas
    ? [...cliente.ejercicios]
        .sort(
          (a, b) =>
            Number(b.mejorSerie !== null) - Number(a.mejorSerie !== null) ||
            (b.sesionesConMarca ?? 0) - (a.sesionesConMarca ?? 0) ||
            a.nombre.localeCompare(b.nombre, "es"),
        )
        .slice(0, 4)
    : []
  const sinMarcas = [
    cliente.sesionesEnviadas === 0 ? "Sin envíos esta semana" : "Sin marcas esta semana",
    cliente.ultimaFechaEnviada
      ? `último: ${fechaLegible(cliente.ultimaFechaEnviada).replace(",", "")}`
      : null,
  ]
    .filter(Boolean)
    .join(" · ")
  const molestias = cliente.molestiasAbiertas.map(
    (molestia) => `${ETIQUETA_DE_ZONA[molestia.zona]} · ${molestia.intensidad} de 10 · abierta`,
  )
  const atencion =
    molestias.length > 0 || sinEnvios || cliente.ejercicios.some((e) => e.estado === "Baja")
  const detalle = [
    sesiones,
    ...ejercicios.map((ejercicio) =>
      [
        ejercicio.nombre,
        serieLegible(ejercicio),
        comparacionLegible(ejercicio),
        ejercicio.estado,
        ejercicio.record ? "Récord" : null,
      ]
        .filter(Boolean)
        .join(". "),
    ),
    !hayMarcas ? sinMarcas : null,
    ...molestias,
  ]
    .filter(Boolean)
    .join(". ")

  return (
    <View style={[s.tarjeta, atencion && s.atencion]}>
      <Pulsable
        style={s.contenido}
        accessibilityLabel={`Ver ficha de ${nombre}. ${detalle}`}
        accessibilityHint="Abre la ficha del cliente"
        onPress={() =>
          abrir({ pathname: "/entrenador/cliente/[id]", params: { id: cliente.clienteId } })
        }
      >
        <View style={s.cabecera}>
          <View style={s.textos}>
            <Text style={s.nombre}>{nombre}</Text>
            <Text style={s.tenue}>{hayMarcas ? sesiones : sinMarcas}</Text>
          </View>
          <Icono nombre="adelante" color={tema.textoTenue} />
        </View>
        {ejercicios.map((ejercicio) => (
          <View key={ejercicio.ejercicioId} style={s.ejercicio}>
            <Text style={s.ejercicioNombre}>{ejercicio.nombre}</Text>
            <Text style={s.serie}>{serieLegible(ejercicio)}</Text>
            {comparacionLegible(ejercicio) && (
              <Text style={s.tenue}>{comparacionLegible(ejercicio)}</Text>
            )}
            {(ejercicio.estado || ejercicio.record) && (
              <View style={s.estados}>
                {ejercicio.estado && (
                  <Text style={[s.estado, ejercicio.estado === "Baja" && s.aviso]}>
                    {ejercicio.estado}
                  </Text>
                )}
                {ejercicio.record && <Text style={s.estado}>Récord</Text>}
              </View>
            )}
          </View>
        ))}
        {molestias.map((molestia, indice) => (
          <Text key={cliente.molestiasAbiertas[indice]!.id} style={s.avisoTexto}>
            {molestia}
          </Text>
        ))}
      </Pulsable>
      {hayMarcas && (
        <View style={s.acciones}>
          <BotonEnlace
            texto="Ver todos"
            etiquetaAccesible={`Ver todos los ejercicios de ${nombre}`}
            onPress={() =>
              abrir({
                pathname: "/entrenador/cliente/[id]",
                params: { id: cliente.clienteId, pestana: "progreso" },
              })
            }
          />
        </View>
      )}
      <AccionesTrabajo trabajo={trabajo} abrir={abrir} />
    </View>
  )
}

export function TarjetaTrabajo({
  trabajo,
  abrir,
}: {
  trabajo: TrabajoCliente
  abrir: (ruta: Href) => void
}): React.JSX.Element {
  const nombre = nombreCliente(trabajo.cliente)
  return (
    <View style={s.tarjeta}>
      <Pulsable
        style={s.contenido}
        accessibilityLabel={`Ver ficha de ${nombre}`}
        onPress={() =>
          abrir({ pathname: "/entrenador/cliente/[id]", params: { id: trabajo.cliente.id } })
        }
      >
        <Text style={s.nombre}>{nombre}</Text>
        <Text style={s.tenue}>Resumen semanal no disponible</Text>
      </Pulsable>
      <AccionesTrabajo trabajo={trabajo} abrir={abrir} />
    </View>
  )
}

function AccionesTrabajo({
  trabajo,
  abrir,
}: {
  trabajo?: TrabajoCliente
  abrir: (ruta: Href) => void
}): React.JSX.Element | null {
  if (!trabajo) return null
  const { cliente, sesion, sinPlan } = trabajo
  const revisar = sesion?.revisadaEn === null
  if (!revisar && !sinPlan) return null
  const nombre = nombreCliente(cliente)
  return (
    <View style={s.acciones}>
      {revisar && sesion && (
        <BotonEnlace
          texto="Revisar sesión"
          etiquetaAccesible={`Revisar ${sesion.prescripcion.nombre} de ${nombre}`}
          onPress={() =>
            abrir({
              pathname: "/entrenamiento/[id]",
              params: { id: sesion.agenda.id, nombre },
            })
          }
        />
      )}
      {sinPlan && (
        <BotonEnlace
          texto="Crear plan"
          etiquetaAccesible={`Crear plan para ${nombre}`}
          onPress={() =>
            abrir({ pathname: "/entrenador/cliente/[id]/plan", params: { id: cliente.id } })
          }
        />
      )}
    </View>
  )
}

const s = StyleSheet.create({
  tarjeta: {
    backgroundColor: tema.superficie,
    borderRadius: radio.tarjeta,
    borderWidth: 1,
    borderColor: tema.borde,
  },
  atencion: { borderColor: tema.avisoBorde },
  contenido: { borderRadius: radio.tarjeta, padding: espacio[16], gap: espacio[12] },
  cabecera: { flexDirection: "row", gap: espacio[12], alignItems: "center" },
  textos: { flex: 1, minWidth: 0, gap: espacio[4] },
  nombre: { ...tipo.fila, color: tema.texto },
  tenue: { ...tipo.secundario, color: tema.textoTenue },
  ejercicio: {
    borderTopWidth: 1,
    borderTopColor: tema.borde,
    paddingTop: espacio[12],
    gap: espacio[4],
  },
  ejercicioNombre: { ...tipo.cuerpo, fontFamily: tema.fuenteSemi, color: tema.textoSecundario },
  serie: { ...tipo.fila, ...tipo.cifras, color: tema.texto },
  estados: { flexDirection: "row", flexWrap: "wrap", gap: espacio[12] },
  estado: { ...tipo.secundario, fontFamily: tema.fuenteSemi, color: tema.acento },
  aviso: { color: tema.aviso },
  avisoTexto: { ...tipo.secundario, color: tema.aviso },
  acciones: {
    borderTopWidth: 1,
    borderTopColor: tema.borde,
    paddingHorizontal: espacio[16],
    paddingBottom: espacio[8],
    flexDirection: "row",
    flexWrap: "wrap",
    gap: espacio[12],
  },
})
