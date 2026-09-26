import { useRouter } from "expo-router"
import { useState, type ReactNode } from "react"
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native"
import { hoyEn, lunesDe, sumarDias, type FilaPanel } from "@alpha-omega/shared"

import {
  Aviso,
  BarraDeProgreso,
  BotonAtras,
  BotonSobrio,
  FilaDeLista,
  Lista,
  MarcaDeEstado,
  Pantalla,
  contenidoCentrado,
  texto,
} from "../componentes/diseno"
import { NavegadorDeSemana } from "../componentes/tira-de-semana"
import { conMayuscula, fechaLarga } from "../lib/fechas"
import { fuentes, tema } from "../tema"

import { leerPanel } from "./api"
import { useSondeo } from "./use-sondeo"

export function nombreCompleto(cliente: FilaPanel["cliente"]): string {
  return [cliente.nombre, cliente.apellidos].filter(Boolean).join(" ")
}

/**
 * Lo que el entrenador sabe de una sesión: si está enviada y cuánto se hizo.
 * Nada del borrador: mientras no se envía, para él está pendiente.
 */
export function estadoDeFilaPanel(fila: FilaPanel, hoy: string): string {
  if (fila.ejecucion !== null) {
    const { seriesHechas, seriesPrescritas } = fila.ejecucion
    return `Enviado · ${String(seriesHechas)} de ${String(seriesPrescritas)} series`
  }
  return fila.agenda.fechaActual < hoy ? "Sin enviar" : "Pendiente"
}

/** Las filas agrupadas por día, en orden. */
export function porDia(filas: FilaPanel[]): [string, FilaPanel[]][] {
  const dias = new Map<string, FilaPanel[]>()
  for (const fila of filas) {
    const dia = dias.get(fila.agenda.fechaActual) ?? []
    dia.push(fila)
    dias.set(fila.agenda.fechaActual, dia)
  }
  return [...dias.entries()].sort(([a], [b]) => a.localeCompare(b))
}

/**
 * Los entrenos de una semana: de todos los clientes o, con `clienteId`, de uno.
 *
 * Se relee sola cada 5 s: cuando un cliente envía, aparece aquí sin recargar.
 * `cabecera` va entre el título y la semana (la vista de un cliente pone ahí
 * sus planes).
 */
export function PanelDeEntrenos({
  clienteId,
  titulo,
  cabecera,
}: {
  clienteId?: string
  titulo: string
  cabecera?: ReactNode
}): React.JSX.Element {
  const router = useRouter()
  const hoy = hoyEn()
  const [semana, setSemana] = useState(() => lunesDe(hoy))
  const { estado, recargar } = useSondeo(
    `${semana}:${clienteId ?? "todos"}`,
    () => leerPanel(semana, clienteId),
    "No hemos podido cargar los entrenos.",
  )
  const deUnCliente = clienteId !== undefined

  const filas = estado.fase === "lista" ? estado.datos.sesiones : []
  const enviadas = filas.filter((f) => f.enviadoEn !== null).length

  return (
    <Pantalla>
      <ScrollView contentContainerStyle={[estilos.contenido, contenidoCentrado]}>
        <View style={estilos.barraSuperior}>
          <BotonAtras onPress={() => router.back()} />
        </View>
        <View style={estilos.encabezado}>
          <Text style={texto.titulo} accessibilityRole="header">
            {titulo}
          </Text>
          <Text style={texto.tenueMedio}>
            Se actualiza solo: verás cada entreno en cuanto el cliente lo envíe.
          </Text>
        </View>

        {cabecera}

        <NavegadorDeSemana
          lunes={semana}
          esEstaSemana={semana === lunesDe(hoy)}
          alCambiar={(dias) => setSemana((s) => sumarDias(s, dias))}
          alVolverAHoy={() => setSemana(lunesDe(hoy))}
        />

        {estado.fase === "cargando" && (
          <View style={estilos.centrado}>
            <ActivityIndicator color={tema.oro} accessibilityLabel="Cargando los entrenos" />
          </View>
        )}

        {estado.fase === "error" && (
          <View style={estilos.centrado}>
            <Text style={[texto.cuerpo, estilos.centradoTexto]}>{estado.falta.texto}</Text>
            {estado.falta.reintentable && <BotonSobrio texto="Reintentar" onPress={recargar} />}
          </View>
        )}

        {estado.fase === "lista" && (
          <>
            {estado.falta !== null && (
              <Aviso tono="error">
                <Text style={texto.cuerpo}>
                  {`No se ha podido actualizar: ${estado.falta.texto} Lo seguimos intentando.`}
                </Text>
              </Aviso>
            )}

            <View style={estilos.seccion}>
              <View style={estilos.resumen}>
                <Text style={texto.seccion}>Enviados</Text>
                <Text style={estilos.cuenta}>
                  {`${String(enviadas)} de ${String(filas.length)}`}
                </Text>
              </View>
              {filas.length > 0 && <BarraDeProgreso fraccion={enviadas / filas.length} />}
            </View>

            {filas.length === 0 && (
              <Text style={[texto.tenueGrande, estilos.vacio]}>
                {deUnCliente
                  ? "No tiene sesiones esta semana."
                  : "Ningún cliente tiene sesiones esta semana."}
              </Text>
            )}

            {porDia(filas).map(([dia, delDia]) => (
              <View key={dia} style={estilos.seccion}>
                <Text
                  style={[estilos.dia, dia === hoy && estilos.diaDeHoy]}
                  accessibilityRole="header"
                >
                  {dia === hoy ? `Hoy · ${fechaLarga(dia)}` : conMayuscula(fechaLarga(dia))}
                </Text>
                <Lista>
                  {delDia.map((fila, indice) => {
                    const cliente = nombreCompleto(fila.cliente)
                    const situacion = estadoDeFilaPanel(fila, hoy)
                    const movida = fila.agenda.fechaActual !== fila.agenda.fechaOriginal
                    const subtitulo = [
                      deUnCliente ? null : fila.nombre,
                      situacion,
                      movida ? `movida desde el ${fechaLarga(fila.agenda.fechaOriginal)}` : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")
                    return (
                      <FilaDeLista
                        key={fila.agenda.id}
                        titulo={deUnCliente ? fila.nombre : cliente}
                        subtitulo={subtitulo}
                        izquierda={
                          <MarcaDeEstado estado={fila.enviadoEn !== null ? "hecho" : "pendiente"} />
                        }
                        ultima={indice === delDia.length - 1}
                        accessibilityLabel={`${cliente}, ${fila.nombre}, ${situacion}`}
                        onPress={() =>
                          router.push({
                            pathname: "/entrenador/sesion/[id]",
                            params: { id: fila.agenda.id, cliente },
                          })
                        }
                      />
                    )
                  })}
                </Lista>
              </View>
            ))}
          </>
        )}
      </ScrollView>
    </Pantalla>
  )
}

const estilos = StyleSheet.create({
  contenido: { padding: 20, paddingBottom: 48, gap: 24 },
  barraSuperior: { flexDirection: "row" },
  encabezado: { gap: 8 },
  centrado: { alignItems: "center", justifyContent: "center", paddingVertical: 48, gap: 16 },
  centradoTexto: { textAlign: "center" },
  seccion: { gap: 12 },
  resumen: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
  cuenta: {
    color: tema.oro,
    fontFamily: fuentes.negrita,
    fontSize: 15,
    fontVariant: ["tabular-nums"],
  },
  vacio: { textAlign: "center", paddingVertical: 16 },
  dia: { color: tema.textoTenue, fontFamily: fuentes.semi, fontSize: 15 },
  diaDeHoy: { color: tema.oro },
})
