import { useFocusEffect, useRouter } from "expo-router"
import { useCallback, useEffect, useRef, useState } from "react"
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import {
  hoyEn,
  lunesDe,
  sumarDias,
  type ResumenSesion,
  type SesionProgramada,
} from "@alpha-omega/shared"

import { Aviso, Cabecera, Pastilla } from "../componentes/cabecera"
import { CambiarDia } from "../componentes/cambiar-dia"
import { BotonSecundario } from "../componentes/formulario"
import { faltaDe, type Falta } from "../lib/errores"
import { conMayuscula, fechaCorta, fechaLarga, rangoDeSemana } from "../lib/fechas"
import { ErrorDeRed } from "../lib/http"
import { useSesion } from "../sesion"
import { tema } from "../tema"

import { listarCopias } from "./almacen-borradores"
import { cambiarFecha, listarSemana } from "./api"
import type { CopiaLocal } from "./copia-local"
import { abrirSesionEnCurso } from "./use-sesion-en-curso"

type Fila = ResumenSesion & { enCurso: boolean }

type Carga =
  | { fase: "cargando" }
  | { fase: "lista"; filas: Fila[]; soloLocal: boolean }
  | { fase: "error"; falta: Falta }

function desdeCopias(copias: CopiaLocal[], semana: string): Fila[] {
  const domingo = sumarDias(semana, 6)
  return copias
    .filter((c) => c.sesion.agenda.fechaActual >= semana && c.sesion.agenda.fechaActual <= domingo)
    .map((c) => ({
      agenda: c.sesion.agenda,
      nombre: c.sesion.prescripcion.nombre,
      enviadoEn: c.resultado?.enviadoEn ?? c.sesion.enviadoEn,
      enCurso: c.resultado === null && Object.keys(c.entradas).length > 0,
    }))
    .sort((a, b) => a.agenda.fechaActual.localeCompare(b.agenda.fechaActual))
}

/**
 * «Mis entrenos»: la semana del cliente, de lunes a domingo.
 *
 * Con conexión, lo que dice el servidor, y de paso se descargan las sesiones
 * abiertas para poder registrarlas en la sala sin cobertura. Sin conexión, lo
 * que ya estaba guardado en el móvil, y la pantalla lo dice.
 */
export function SemanaDelCliente(): React.JSX.Element {
  const { estado } = useSesion()
  const router = useRouter()
  const usuario = estado.fase === "dentro" || estado.fase === "local" ? estado.usuario : null
  const enLinea = estado.fase === "dentro"

  const [semana, setSemana] = useState(() => lunesDe(hoyEn()))
  const [carga, setCarga] = useState<Carga>({ fase: "cargando" })
  const [intento, setIntento] = useState(0)
  const [refrescando, setRefrescando] = useState(false)
  const primerFoco = useRef(true)

  useEffect(() => {
    if (usuario === null) {
      return
    }
    let vigente = true
    const cargar = async (): Promise<void> => {
      const copias = await listarCopias(usuario.id).catch(() => [] as CopiaLocal[])
      const enCurso = new Set(
        desdeCopias(copias, semana)
          .filter((f) => f.enCurso)
          .map((f) => f.agenda.id),
      )
      if (!enLinea) {
        if (vigente)
          setCarga({ fase: "lista", filas: desdeCopias(copias, semana), soloLocal: true })
        return
      }
      try {
        const listado = await listarSemana(usuario.id, semana)
        if (!vigente) return
        setCarga({
          fase: "lista",
          filas: listado.sesiones.map((s) => ({ ...s, enCurso: enCurso.has(s.agenda.id) })),
          soloLocal: false,
        })
        // Descarga en segundo plano de lo que se puede entrenar esta semana.
        const guardadas = new Set(copias.map((c) => c.sesionId))
        for (const sesion of listado.sesiones) {
          if (sesion.agenda.estado === "abierta" && !guardadas.has(sesion.agenda.id)) {
            await abrirSesionEnCurso(usuario.id, sesion.agenda.id).catch(() => undefined)
          }
        }
      } catch (error) {
        if (!vigente) return
        if (error instanceof ErrorDeRed) {
          setCarga({ fase: "lista", filas: desdeCopias(copias, semana), soloLocal: true })
        } else {
          setCarga({ fase: "error", falta: faltaDe(error, "No hemos podido cargar tu semana.") })
        }
      }
    }
    void cargar().finally(() => {
      if (vigente) setRefrescando(false)
    })
    return () => {
      vigente = false
    }
  }, [usuario, enLinea, semana, intento])

  useFocusEffect(
    useCallback(() => {
      if (primerFoco.current) {
        primerFoco.current = false
        return
      }
      setIntento((n) => n + 1)
    }, []),
  )

  const actualizarAgenda = (agenda: SesionProgramada): void => {
    setCarga((actual) =>
      actual.fase !== "lista"
        ? actual
        : {
            ...actual,
            filas: actual.filas
              .map((fila) => (fila.agenda.id === agenda.id ? { ...fila, agenda } : fila))
              .sort((a, b) => a.agenda.fechaActual.localeCompare(b.agenda.fechaActual)),
          },
    )
  }

  const esEstaSemana = semana === lunesDe(hoyEn())

  return (
    <SafeAreaView style={estilos.pantalla}>
      <Cabecera titulo="MIS ENTRENOS" onVolver={() => router.back()} />

      <View style={estilos.navegador}>
        <Pressable
          onPress={() => setSemana((s) => sumarDias(s, -7))}
          accessibilityRole="button"
          accessibilityLabel="Semana anterior"
          hitSlop={12}
          style={estilos.flecha}
        >
          <Text style={estilos.textoFlecha}>‹</Text>
        </Pressable>
        <View style={estilos.centroSemana}>
          <Text style={estilos.semana}>{rangoDeSemana(semana).toUpperCase()}</Text>
          {!esEstaSemana && (
            <Pressable onPress={() => setSemana(lunesDe(hoyEn()))} accessibilityRole="button">
              <Text style={estilos.hoy}>VOLVER A ESTA SEMANA</Text>
            </Pressable>
          )}
        </View>
        <Pressable
          onPress={() => setSemana((s) => sumarDias(s, 7))}
          accessibilityRole="button"
          accessibilityLabel="Semana siguiente"
          hitSlop={12}
          style={estilos.flecha}
        >
          <Text style={estilos.textoFlecha}>›</Text>
        </Pressable>
      </View>

      {carga.fase === "cargando" && (
        <View style={estilos.centrado}>
          <ActivityIndicator color={tema.oro} accessibilityLabel="Cargando tu semana" />
        </View>
      )}

      {carga.fase === "error" && (
        <View style={estilos.centrado}>
          <Text style={estilos.mensaje}>{carga.falta.texto}</Text>
          {carga.falta.reintentable && (
            <BotonSecundario texto="REINTENTAR" onPress={() => setIntento((n) => n + 1)} />
          )}
        </View>
      )}

      {carga.fase === "lista" && (
        <FlatList
          data={carga.filas}
          keyExtractor={(fila) => fila.agenda.id}
          contentContainerStyle={estilos.lista}
          refreshControl={
            <RefreshControl
              refreshing={refrescando}
              onRefresh={() => {
                setRefrescando(true)
                setIntento((n) => n + 1)
              }}
              tintColor={tema.oro}
              colors={[tema.oro]}
            />
          }
          ListHeaderComponent={
            carga.soloLocal ? (
              <Aviso>
                <Text style={estilos.textoAviso}>
                  Sin conexión. Ves las sesiones guardadas en este móvil y puedes seguir
                  registrando: se enviará todo cuando vuelva la red.
                </Text>
              </Aviso>
            ) : null
          }
          ListEmptyComponent={
            <Text style={estilos.vacio}>
              {carga.soloLocal
                ? "No hay sesiones de esta semana guardadas en el móvil."
                : "No tienes sesiones esta semana."}
            </Text>
          }
          renderItem={({ item }) => (
            <View style={estilos.tarjeta}>
              {/* La tarjeta y «Cambiar día» son dos botones hermanos, no anidados. */}
              <Pressable
                onPress={() =>
                  router.push({ pathname: "/entrenos/[id]", params: { id: item.agenda.id } })
                }
                style={({ pressed }) => [estilos.zonaPulsable, pressed && estilos.pulsado]}
                accessibilityRole="button"
                accessibilityLabel={`${item.nombre}, ${fechaLarga(item.agenda.fechaActual)}`}
              >
                <View style={estilos.filaSuperior}>
                  <Text style={estilos.dia}>
                    {fechaCorta(item.agenda.fechaActual).toUpperCase()}
                  </Text>
                  {item.enviadoEn !== null ? (
                    <Pastilla texto="ENVIADO" tono="exito" />
                  ) : item.enCurso ? (
                    <Pastilla texto="EN CURSO" tono="oro" />
                  ) : (
                    <Pastilla texto="PENDIENTE" />
                  )}
                </View>
                <Text style={estilos.nombre}>{item.nombre}</Text>
                {item.agenda.fechaActual !== item.agenda.fechaOriginal && (
                  <Text style={estilos.movida}>
                    {`Movida desde el ${fechaLarga(item.agenda.fechaOriginal)}`}
                  </Text>
                )}
              </Pressable>
              {!carga.soloLocal && item.enviadoEn === null && (
                <CambiarDia
                  agenda={item.agenda}
                  cambiar={(fecha, revision) => cambiarFecha(item.agenda.id, fecha, revision)}
                  alCambiar={actualizarAgenda}
                />
              )}
            </View>
          )}
        />
      )}
      {carga.fase === "lista" && esEstaSemana && carga.filas.length > 0 && (
        <Text style={estilos.pie}>{conMayuscula(`hoy es ${fechaLarga(hoyEn())}`)}</Text>
      )}
    </SafeAreaView>
  )
}

const estilos = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: tema.fondo },
  navegador: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  flecha: { paddingHorizontal: 16, paddingVertical: 4 },
  textoFlecha: { color: tema.oro, fontSize: 28 },
  centroSemana: { alignItems: "center", gap: 4 },
  semana: { color: tema.texto, fontSize: 14, fontWeight: "700", letterSpacing: 2 },
  hoy: { color: tema.oroSuave, fontSize: 10, letterSpacing: 1.5 },
  centrado: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 16 },
  mensaje: { color: tema.texto, fontSize: 15, textAlign: "center" },
  lista: { padding: 20, gap: 12 },
  tarjeta: {
    backgroundColor: tema.superficie,
    borderColor: tema.borde,
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    gap: 8,
  },
  zonaPulsable: { gap: 8 },
  pulsado: { opacity: 0.75 },
  filaSuperior: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  dia: { color: tema.oroSuave, fontSize: 12, fontWeight: "700", letterSpacing: 2 },
  nombre: { color: tema.texto, fontSize: 18, fontWeight: "600" },
  movida: { color: tema.textoTenue, fontSize: 12, fontStyle: "italic" },
  textoAviso: { color: tema.texto, fontSize: 13, lineHeight: 19 },
  vacio: { color: tema.textoTenue, fontSize: 14, textAlign: "center", marginTop: 40 },
  pie: { color: tema.textoTenue, fontSize: 12, textAlign: "center", paddingBottom: 12 },
})
