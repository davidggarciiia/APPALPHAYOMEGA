import { useRouter } from "expo-router"
import { useState } from "react"
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native"
import { hoyEn, lunesDe, sumarDias } from "@alpha-omega/shared"

import { CambiarDia } from "../componentes/cambiar-dia"
import {
  Aviso,
  BarraDeProgreso,
  BotonAtras,
  BotonSobrio,
  FilaDeLista,
  Lista,
  MarcaDeEstado,
  Pantalla,
  texto,
  type EstadoDeMarca,
} from "../componentes/diseno"
import { NavegadorDeSemana, TiraDeSemana } from "../componentes/tira-de-semana"
import { conMayuscula, fechaLarga } from "../lib/fechas"
import { fuentes, tema } from "../tema"

import { cambiarFecha } from "./api"
import { useSemana, type FilaDeSemana } from "./use-semana"

export function estadoDeFila(fila: FilaDeSemana): EstadoDeMarca {
  return fila.enviadoEn !== null ? "hecho" : fila.enCurso ? "en-curso" : "pendiente"
}

const TEXTO_DE_ESTADO: Record<EstadoDeMarca, string> = {
  hecho: "Enviado",
  "en-curso": "En curso",
  pendiente: "Pendiente",
}

/** Los puntos de la tira: uno por sesión, en su día. */
export function marcasDe(filas: FilaDeSemana[]): Map<string, EstadoDeMarca[]> {
  const marcas = new Map<string, EstadoDeMarca[]>()
  for (const fila of filas) {
    const dia = marcas.get(fila.agenda.fechaActual) ?? []
    dia.push(estadoDeFila(fila))
    marcas.set(fila.agenda.fechaActual, dia)
  }
  return marcas
}

/**
 * «Mis entrenos»: la semana del cliente, de lunes a domingo, con la tira de
 * días de Main.dc.html y las filas de Nutricion.dc.html.
 *
 * Con conexión, lo que dice el servidor; sin conexión, lo guardado en el móvil,
 * y la pantalla lo dice.
 */
export function SemanaDelCliente(): React.JSX.Element {
  const router = useRouter()
  const hoy = hoyEn()
  const [semana, setSemana] = useState(() => lunesDe(hoy))
  const { carga, refrescando, refrescar, actualizarAgenda } = useSemana(semana)
  const esEstaSemana = semana === lunesDe(hoy)

  const filas = carga.fase === "lista" ? carga.filas : []
  const enviadas = filas.filter((f) => f.enviadoEn !== null).length
  // La siguiente por hacer va en oro, como la comida que toca en Nutrición.
  const siguiente = filas.find((f) => f.enviadoEn === null && f.agenda.fechaActual >= hoy)

  return (
    <Pantalla>
      <ScrollView
        contentContainerStyle={estilos.contenido}
        refreshControl={
          <RefreshControl
            refreshing={refrescando}
            onRefresh={refrescar}
            tintColor={tema.oro}
            colors={[tema.oro]}
          />
        }
      >
        <View style={estilos.barraSuperior}>
          <BotonAtras onPress={() => router.back()} />
        </View>
        <Text style={texto.titulo} accessibilityRole="header">
          Mis entrenos
        </Text>

        <NavegadorDeSemana
          lunes={semana}
          esEstaSemana={esEstaSemana}
          alCambiar={(dias) => setSemana((s) => sumarDias(s, dias))}
          alVolverAHoy={() => setSemana(lunesDe(hoy))}
        />

        {carga.fase === "cargando" && (
          <View style={estilos.centrado}>
            <ActivityIndicator color={tema.oro} accessibilityLabel="Cargando tu semana" />
          </View>
        )}

        {carga.fase === "error" && (
          <View style={estilos.centrado}>
            <Text style={[texto.cuerpo, estilos.centradoTexto]}>{carga.falta.texto}</Text>
            {carga.falta.reintentable && <BotonSobrio texto="Reintentar" onPress={refrescar} />}
          </View>
        )}

        {carga.fase === "lista" && (
          <>
            <TiraDeSemana lunes={semana} hoy={hoy} marcas={marcasDe(carga.filas)} />

            {carga.soloLocal && (
              <Aviso>
                <Text style={texto.cuerpo}>
                  Sin conexión. Ves las sesiones guardadas en este móvil y puedes seguir
                  registrando: se enviará todo cuando vuelva la red.
                </Text>
              </Aviso>
            )}

            <View style={estilos.seccion}>
              <View style={estilos.cabeceraSeccion}>
                <Text style={texto.seccion}>Sesiones</Text>
                {filas.length > 0 && (
                  <Text style={estilos.cuenta}>
                    {`${String(enviadas)} de ${String(filas.length)}`}
                  </Text>
                )}
              </View>
              {filas.length > 0 && <BarraDeProgreso fraccion={enviadas / filas.length} />}

              {filas.length === 0 ? (
                <Text style={[texto.tenueGrande, estilos.vacio]}>
                  {carga.soloLocal
                    ? "No hay sesiones de esta semana guardadas en el móvil."
                    : "No tienes sesiones esta semana."}
                </Text>
              ) : (
                <Lista>
                  {filas.map((fila, indice) => {
                    const estado = estadoDeFila(fila)
                    const movida = fila.agenda.fechaActual !== fila.agenda.fechaOriginal
                    const detalle = [
                      conMayuscula(fechaLarga(fila.agenda.fechaActual)),
                      TEXTO_DE_ESTADO[estado],
                    ].join(" · ")
                    return (
                      <FilaDeLista
                        key={fila.agenda.id}
                        titulo={fila.nombre}
                        subtitulo={
                          movida
                            ? `${detalle}\nMovida desde el ${fechaLarga(fila.agenda.fechaOriginal)}`
                            : detalle
                        }
                        izquierda={<MarcaDeEstado estado={estado} />}
                        resaltada={fila === siguiente}
                        ultima={indice === filas.length - 1}
                        onPress={() =>
                          router.push({
                            pathname: "/entrenos/[id]",
                            params: { id: fila.agenda.id },
                          })
                        }
                        accessibilityLabel={`${fila.nombre}, ${detalle}`}
                      >
                        {!carga.soloLocal && fila.enviadoEn === null && (
                          <View style={estilos.cambiarDia}>
                            <CambiarDia
                              agenda={fila.agenda}
                              cambiar={(fecha, revision) =>
                                cambiarFecha(fila.agenda.id, fecha, revision)
                              }
                              alCambiar={actualizarAgenda}
                            />
                          </View>
                        )}
                      </FilaDeLista>
                    )
                  })}
                </Lista>
              )}
            </View>

            {esEstaSemana && (
              <Text style={[texto.tenue, estilos.pie]}>
                {conMayuscula(`hoy es ${fechaLarga(hoy)}`)}
              </Text>
            )}
          </>
        )}
      </ScrollView>
    </Pantalla>
  )
}

const estilos = StyleSheet.create({
  contenido: { padding: 20, paddingBottom: 48, gap: 24 },
  barraSuperior: { flexDirection: "row" },
  centrado: { alignItems: "center", justifyContent: "center", paddingVertical: 48, gap: 16 },
  centradoTexto: { textAlign: "center" },
  seccion: { gap: 14 },
  cabeceraSeccion: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
  },
  cuenta: {
    color: tema.oro,
    fontFamily: fuentes.negrita,
    fontSize: 15,
    fontVariant: ["tabular-nums"],
  },
  vacio: { textAlign: "center", paddingVertical: 24 },
  cambiarDia: { paddingLeft: 54, paddingBottom: 6 },
  pie: { textAlign: "center" },
})
