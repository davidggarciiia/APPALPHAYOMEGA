import { useCallback, useState } from "react"
import { useFocusEffect, type Href } from "expo-router"
import { StyleSheet, Text, View } from "react-native"
import type { ListadoUsuarios } from "@alpha-omega/shared"

import { Aviso } from "../componentes/aviso"
import { BotonEnlace } from "../componentes/botones"
import { Esqueleto, GrupoEsqueletos } from "../componentes/esqueleto"
import { Icono } from "../componentes/iconos"
import { Pulsable } from "../componentes/pulsable"
import { hoyAgenda, lunesDeSemana, sumarDias } from "../entrenamiento/fechas"
import { fechaCorta } from "../entrenamiento/plan/modelo"
import { faltaDe, type Falta } from "../lib/errores"
import type { PeticionAutenticada } from "../lib/peticion-autenticada"
import { alto, espacio, radio, tema, tipo } from "../tema"
import {
  ACTIVACIONES_POR_PAGINA,
  ACTIVOS_POR_PAGINA,
  cargarTrabajo,
  type TrabajoEntrenador,
} from "./cargar-trabajo"
import { TarjetaCliente, TarjetaTrabajo, necesitaAtencion, nombreCliente } from "./tarjeta-cliente"
import { useResumenSemanal } from "./use-resumen-semanal"

export function InicioEntrenador({
  nombre,
  pedir,
  abrir,
}: {
  nombre: string
  pedir: PeticionAutenticada
  abrir: (ruta: Href) => void
}): React.JSX.Element {
  const hoy = hoyAgenda()
  const actual = lunesDeSemana(hoy)
  const [semana, setSemana] = useState(actual)
  const resumen = useResumenSemanal(pedir, semana)
  const [trabajo, setTrabajo] = useState<TrabajoEntrenador | null>(null)
  const [error, setError] = useState<Falta | null>(null)
  const [desdeActivos, setDesdeActivos] = useState(0)
  const [desdePendientes, setDesdePendientes] = useState(0)
  const [intento, setIntento] = useState(0)
  useFocusEffect(
    useCallback(() => {
      let vigente = true
      setTrabajo(null)
      setError(null)
      void cargarTrabajo(pedir, desdeActivos, desdePendientes)
        .then((datos) => {
          if (vigente) setTrabajo(datos)
        })
        .catch((causa: unknown) => {
          if (vigente) setError(faltaDe(causa, "No se pudieron cargar las tareas."))
        })
      return () => {
        vigente = false
      }
    }, [pedir, desdeActivos, desdePendientes, intento]),
  )
  const clientes = [...(resumen.datos?.clientes ?? [])].sort(
    (a, b) =>
      Number(necesitaAtencion(b, semana, hoy)) - Number(necesitaAtencion(a, semana, hoy)) ||
      nombreCliente(a).localeCompare(nombreCliente(b), "es"),
  )
  const estaSemana = semana === actual
  const mostrarTrabajo = resumen.error?.reintentable !== false
  return (
    <View style={s.contenido}>
      <Text style={s.nombre} accessibilityRole="header">
        Hola, {nombre}
      </Text>
      <View style={s.semana}>
        <Pulsable
          style={s.flecha}
          accessibilityLabel="Semana anterior"
          onPress={() => setSemana(sumarDias(semana, -7))}
        >
          <Icono nombre="atras" color={tema.texto} tamano={20} />
        </Pulsable>
        <Text style={s.intervalo} accessibilityLiveRegion="polite">
          {fechaCorta(semana)} — {fechaCorta(sumarDias(semana, 6))}
        </Text>
        <Pulsable
          style={s.flecha}
          accessibilityLabel="Semana siguiente"
          disabled={semana >= actual}
          onPress={() => setSemana(sumarDias(semana, 7))}
        >
          <Icono
            nombre="adelante"
            color={semana >= actual ? tema.textoTenue : tema.texto}
            tamano={20}
          />
        </Pulsable>
      </View>
      {resumen.error && (
        <Aviso
          tipo="error"
          mensaje={resumen.error.texto}
          alReintentar={resumen.error.reintentable ? resumen.reintentar : undefined}
        />
      )}
      <View>
        {!resumen.datos && !resumen.error ? (
          <View accessibilityLabel="Cargando resumen semanal" accessibilityState={{ busy: true }}>
            <GrupoEsqueletos>
              <View style={s.grupo}>
                {[0, 1, 2].map((n) => (
                  <Esqueleto key={n} alto={176} radio={radio.tarjeta} />
                ))}
              </View>
            </GrupoEsqueletos>
          </View>
        ) : (
          resumen.datos && (
            <View style={s.grupo}>
              {clientes.length === 0 && <Text style={s.tenue}>Aún no tienes clientes activos</Text>}
              {clientes.map((cliente) => (
                <TarjetaCliente
                  key={cliente.clienteId}
                  cliente={cliente}
                  sinEnvios={
                    cliente.sesionesPrevistas > 0 &&
                    cliente.sesionesEnviadas === 0 &&
                    hoy >= sumarDias(semana, 2)
                  }
                  trabajo={
                    estaSemana && mostrarTrabajo
                      ? trabajo?.clientes.find((t) => t.cliente.id === cliente.clienteId)
                      : undefined
                  }
                  abrir={abrir}
                />
              ))}
            </View>
          )
        )}
      </View>
      {!resumen.datos && resumen.error?.reintentable && estaSemana && trabajo && (
        <View style={s.grupo}>
          {trabajo.clientes
            .filter((t) => t.sinPlan)
            .map((t) => (
              <TarjetaTrabajo key={t.cliente.id} trabajo={t} abrir={abrir} />
            ))}
        </View>
      )}
      {mostrarTrabajo && (
        <>
          {error && (
            <Aviso
              tipo="error"
              mensaje={error.texto}
              alReintentar={error.reintentable ? () => setIntento((n) => n + 1) : undefined}
            />
          )}
          {!trabajo && !error && resumen.datos && (
            <GrupoEsqueletos>
              <Esqueleto alto={alto.tactil} />
            </GrupoEsqueletos>
          )}
          {trabajo && (
            <>
              {estaSemana && trabajo.activos.total > 0 && (
                <Paginacion
                  listado={trabajo.activos}
                  desde={desdeActivos}
                  paso={ACTIVOS_POR_PAGINA}
                  nombre="Planes"
                  anterior="Clientes activos anteriores"
                  siguiente="Siguientes clientes activos"
                  cambiar={setDesdeActivos}
                />
              )}
              {(trabajo.pendientes.total > 0 || desdePendientes > 0) && (
                <View style={s.grupo}>
                  <Text style={s.titulo} accessibilityRole="header">
                    Pendientes de activar
                  </Text>
                  {trabajo.pendientes.usuarios.map((cliente) => (
                    <Pulsable
                      key={cliente.id}
                      style={s.pendiente}
                      accessibilityLabel={`Activar a ${nombreCliente(cliente)}`}
                      onPress={() =>
                        abrir({ pathname: "/cliente/[id]", params: { id: cliente.id } })
                      }
                    >
                      <View style={s.textos}>
                        <Text style={s.destacado}>{nombreCliente(cliente)}</Text>
                        <Text style={s.tenue}>Datos y activación</Text>
                      </View>
                      <Icono nombre="adelante" color={tema.acento} />
                    </Pulsable>
                  ))}
                  <Paginacion
                    listado={trabajo.pendientes}
                    desde={desdePendientes}
                    paso={ACTIVACIONES_POR_PAGINA}
                    nombre="Pendientes de activar"
                    anterior="Pendientes de activar anteriores"
                    siguiente="Siguientes pendientes de activar"
                    cambiar={setDesdePendientes}
                  />
                </View>
              )}
            </>
          )}
        </>
      )}
      <BotonEnlace texto="Ver todos los clientes" onPress={() => abrir("/cartera")} />
    </View>
  )
}

function Paginacion({
  listado,
  desde,
  paso,
  nombre,
  anterior,
  siguiente,
  cambiar,
}: {
  listado: ListadoUsuarios
  desde: number
  paso: number
  nombre: string
  anterior: string
  siguiente: string
  cambiar: (desde: number) => void
}): React.JSX.Element {
  return (
    <View style={s.grupo}>
      <Text style={s.tenue}>
        {nombre} ·{" "}
        {listado.usuarios.length === 0
          ? `0 de ${listado.total}`
          : `${Math.min(desde + 1, listado.total)}–${Math.min(desde + listado.usuarios.length, listado.total)} de ${listado.total}`}
      </Text>
      <View style={s.paginacion}>
        {desde > 0 && (
          <BotonEnlace
            texto="Anteriores"
            etiquetaAccesible={anterior}
            onPress={() => cambiar(Math.max(0, desde - paso))}
          />
        )}
        {desde + paso < listado.total && (
          <BotonEnlace
            texto="Siguientes"
            etiquetaAccesible={siguiente}
            onPress={() => cambiar(desde + paso)}
          />
        )}
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  contenido: { gap: espacio[24] },
  grupo: { gap: espacio[12] },
  nombre: { ...tipo.tituloPantalla, color: tema.texto },
  titulo: { ...tipo.titulo, color: tema.texto },
  tenue: { ...tipo.secundario, color: tema.textoTenue },
  semana: { flexDirection: "row", alignItems: "center", gap: espacio[8] },
  intervalo: { ...tipo.fila, ...tipo.cifras, color: tema.texto, flex: 1, textAlign: "center" },
  flecha: {
    width: alto.tactil,
    minHeight: alto.tactil,
    borderRadius: radio.campo,
    justifyContent: "center",
    alignItems: "center",
  },
  pendiente: {
    backgroundColor: tema.superficie,
    borderRadius: radio.tarjetaInterna,
    padding: espacio[16],
    minHeight: 72,
    flexDirection: "row",
    alignItems: "center",
    gap: espacio[12],
  },
  textos: { flex: 1, minWidth: 0, gap: espacio[4] },
  destacado: { ...tipo.fila, color: tema.texto },
  paginacion: {
    flexDirection: "row",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: espacio[12],
  },
})
