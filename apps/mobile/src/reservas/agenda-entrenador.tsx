import { useCallback, useEffect, useState } from "react"
import { ScrollView, StyleSheet, View } from "react-native"

import type { ApiReservas } from "./api"
import { AgendaSemana } from "./agenda-semana"
import { CobrosEntrenador } from "./cobros-entrenador"
import { HorarioEntrenador } from "./horario-entrenador"
import { Segmentos } from "./piezas"
import { SolicitudesEntrenador } from "./solicitudes-entrenador"

type Seccion = "agenda" | "horario" | "solicitudes" | "cobros"

/**
 * Pestaña «Agenda» del entrenador: su semana, su horario, las solicitudes de
 * producto y los cobros, en un control segmentado. Cada sección carga lo suyo
 * al abrirse, así que volver a una la trae al día.
 */
export function AgendaEntrenador({
  api,
  ahora = () => new Date(),
}: {
  api: ApiReservas
  /** Reloj inyectable para las pruebas. */
  ahora?: () => Date
}): React.JSX.Element {
  const [seccion, setSeccion] = useState<Seccion>("agenda")
  const [pendientes, setPendientes] = useState(0)
  const contar = useCallback((n: number) => setPendientes(n), [])

  // El globo de «Solicitudes» se ve desde cualquier sección.
  useEffect(() => {
    let vigente = true
    api
      .solicitudesPendientes()
      .then(({ solicitudes }) => {
        if (vigente) setPendientes(solicitudes.filter((s) => s.estado === "pendiente").length)
      })
      .catch(() => undefined)
    return () => {
      vigente = false
    }
  }, [api])

  return (
    <ScrollView contentContainerStyle={estilos.contenido} keyboardShouldPersistTaps="handled">
      <Segmentos
        etiqueta="Secciones de la agenda"
        activa={seccion}
        cambiar={setSeccion}
        opciones={[
          { valor: "agenda", texto: "Agenda" },
          { valor: "horario", texto: "Horario" },
          { valor: "solicitudes", texto: "Solicitudes", aviso: pendientes },
          { valor: "cobros", texto: "Cobros" },
        ]}
      />
      <View>
        {seccion === "agenda" && <AgendaSemana api={api} ahora={ahora} />}
        {seccion === "horario" && <HorarioEntrenador api={api} ahora={ahora} />}
        {seccion === "solicitudes" && <SolicitudesEntrenador api={api} alContar={contar} />}
        {seccion === "cobros" && <CobrosEntrenador api={api} ahora={ahora} />}
      </View>
    </ScrollView>
  )
}

const estilos = StyleSheet.create({
  contenido: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 32,
    gap: 20,
    width: "100%",
    maxWidth: 820,
    alignSelf: "center",
  },
})
