import { useCallback, useState, type ReactNode } from "react"
import { useFocusEffect, type Href } from "expo-router"
import { StyleSheet, Text, View } from "react-native"
import { ETIQUETA_DE_ZONA, type ListadoUsuarios, type ResumenUsuario } from "@alpha-omega/shared"

import { Aviso } from "../componentes/aviso"
import { BotonEnlace } from "../componentes/botones"
import { EntradaMarca } from "../componentes/entrada-marca"
import { Esqueleto, GrupoEsqueletos } from "../componentes/esqueleto"
import { Icono } from "../componentes/iconos"
import { Pulsable } from "../componentes/pulsable"
import { faltaDe, type Falta } from "../lib/errores"
import type { PeticionAutenticada } from "../lib/peticion-autenticada"
import { espacio, radio, tema, tipo } from "../tema"
import {
  ACTIVACIONES_POR_PAGINA,
  ACTIVOS_POR_PAGINA,
  cargarTrabajo,
  type TrabajoEntrenador,
} from "./cargar-trabajo"

const nombreCompleto = (cliente: ResumenUsuario): string =>
  [cliente.nombre, cliente.apellidos].filter(Boolean).join(" ")

export function InicioEntrenador({
  nombre,
  pedir,
  abrir,
}: {
  nombre: string
  pedir: PeticionAutenticada
  abrir: (ruta: Href) => void
}): React.JSX.Element {
  const [datos, setDatos] = useState<TrabajoEntrenador | null>(null)
  const [error, setError] = useState<Falta | null>(null)
  const [desdeActivos, setDesdeActivos] = useState(0)
  const [desdePendientes, setDesdePendientes] = useState(0)
  const [intento, setIntento] = useState(0)
  useFocusEffect(
    useCallback(() => {
      let vigente = true
      setDatos(null)
      setError(null)
      void cargarTrabajo(pedir, desdeActivos, desdePendientes)
        .then((trabajo) => {
          if (vigente) setDatos(trabajo)
        })
        .catch((causa: unknown) => {
          if (vigente) setError(faltaDe(causa, "No se pudieron cargar las tareas."))
        })
      return () => {
        vigente = false
      }
    }, [pedir, desdeActivos, desdePendientes, intento]),
  )
  const ficha = (id: string): void =>
    abrir({ pathname: "/entrenador/cliente/[id]", params: { id } })
  const sinRevisar = datos?.clientes.filter((c) => c.sesion?.revisadaEn === null) ?? []
  const conMolestias = datos?.clientes.filter((c) => c.totalMolestias > 0) ?? []
  const sinPlan = datos?.clientes.filter((c) => c.sinPlan) ?? []
  const sinTareas =
    sinRevisar.length +
      conMolestias.length +
      sinPlan.length +
      (datos?.pendientes.usuarios.length ?? 0) ===
    0
  const paginaParcial =
    datos &&
    (desdeActivos > 0 ||
      desdePendientes > 0 ||
      datos.activos.total > datos.activos.usuarios.length ||
      datos.pendientes.total > datos.pendientes.usuarios.length)

  return (
    <View style={s.contenido}>
      <Text style={s.nombre} accessibilityRole="header">
        Hola, {nombre}
      </Text>
      <View style={s.grupo}>
        <Text style={s.titulo} accessibilityRole="header">
          Qué toca hoy
        </Text>
        <Text style={s.tenue}>
          Última sesión enviada de cada cliente, molestias abiertas y planes de esta semana.
        </Text>
      </View>
      {error ? (
        <Aviso
          tipo="error"
          mensaje={error.texto}
          alReintentar={error.reintentable ? () => setIntento((n) => n + 1) : undefined}
        />
      ) : !datos ? (
        <View
          accessibilityLabel="Cargando tareas del entrenador"
          accessibilityState={{ busy: true }}
        >
          <GrupoEsqueletos>
            <View style={s.grupo}>
              {[0, 1, 2].map((n) => (
                <Esqueleto key={n} alto={72} radio={radio.tarjetaInterna} />
              ))}
            </View>
          </GrupoEsqueletos>
        </View>
      ) : (
        <EntradaMarca style={s.contenido}>
          <Paginacion
            listado={datos.activos}
            desde={desdeActivos}
            paso={ACTIVOS_POR_PAGINA}
            nombre="Clientes activos"
            anterior="Clientes activos anteriores"
            siguiente="Siguientes clientes activos"
            cambiar={setDesdeActivos}
          />
          {sinTareas && (
            <View style={s.tarjeta}>
              <Text style={s.titulo}>
                {paginaParcial ? "Al día en esta página" : "Todo al día"}
              </Text>
              <Text style={s.tenue}>
                Sin tareas pendientes en los datos consultados. Puedes abrir cada ficha para ver sus
                sesiones anteriores.
              </Text>
            </View>
          )}
          {sinRevisar.length > 0 && (
            <Grupo titulo="Sesiones sin revisar">
              {sinRevisar.map(
                ({ cliente, sesion }) =>
                  sesion && (
                    <Fila
                      key={cliente.id}
                      titulo={nombreCompleto(cliente)}
                      detalle={sesion.prescripcion.nombre}
                      etiqueta={`Revisar ${sesion.prescripcion.nombre} de ${nombreCompleto(cliente)}`}
                      abrir={() =>
                        abrir({
                          pathname: "/entrenamiento/[id]",
                          params: { id: sesion.agenda.id, nombre: nombreCompleto(cliente) },
                        })
                      }
                    />
                  ),
              )}
            </Grupo>
          )}
          {conMolestias.length > 0 && (
            <Grupo titulo="Molestias abiertas">
              {conMolestias.map(({ cliente, molestias, totalMolestias }) => (
                <View key={cliente.id} style={s.grupo}>
                  {molestias.map((m) => (
                    <Fila
                      key={m.id}
                      titulo={nombreCompleto(cliente)}
                      detalle={`${ETIQUETA_DE_ZONA[m.zona]} · ${m.intensidad} de 10${m.ejercicio ? ` · ${m.ejercicio}` : ""}`}
                      etiqueta={`Atender molestia de ${nombreCompleto(cliente)}: ${ETIQUETA_DE_ZONA[m.zona]}, ${m.intensidad} de 10`}
                      abrir={() => ficha(cliente.id)}
                    />
                  ))}
                  {totalMolestias > molestias.length && (
                    <BotonEnlace
                      texto={`Ver las ${totalMolestias} molestias de ${nombreCompleto(cliente)}`}
                      onPress={() => ficha(cliente.id)}
                    />
                  )}
                </View>
              ))}
            </Grupo>
          )}
          {sinPlan.length > 0 && (
            <Grupo titulo="Sin plan esta semana">
              {sinPlan.map(({ cliente }) => (
                <Fila
                  key={cliente.id}
                  titulo={nombreCompleto(cliente)}
                  detalle="Crear plan"
                  etiqueta={`Crear plan para ${nombreCompleto(cliente)}`}
                  abrir={() =>
                    abrir({ pathname: "/entrenador/cliente/[id]/plan", params: { id: cliente.id } })
                  }
                />
              ))}
            </Grupo>
          )}
          {(datos.pendientes.total > 0 || desdePendientes > 0) && (
            <Grupo titulo="Pendientes de activar">
              {datos.pendientes.usuarios.map((cliente) => (
                <Fila
                  key={cliente.id}
                  titulo={nombreCompleto(cliente)}
                  detalle="Datos y activación"
                  etiqueta={`Activar a ${nombreCompleto(cliente)}`}
                  abrir={() => abrir({ pathname: "/cliente/[id]", params: { id: cliente.id } })}
                />
              ))}
              <Paginacion
                listado={datos.pendientes}
                desde={desdePendientes}
                paso={ACTIVACIONES_POR_PAGINA}
                nombre="Pendientes de activar"
                anterior="Pendientes de activar anteriores"
                siguiente="Siguientes pendientes de activar"
                cambiar={setDesdePendientes}
              />
            </Grupo>
          )}
        </EntradaMarca>
      )}
      <BotonEnlace texto="Ver todos los clientes" onPress={() => abrir("/cartera")} />
    </View>
  )
}

function Grupo({ titulo, children }: { titulo: string; children: ReactNode }): React.JSX.Element {
  return (
    <View style={s.grupo}>
      <Text style={s.titulo} accessibilityRole="header">
        {titulo}
      </Text>
      {children}
    </View>
  )
}

function Fila({
  titulo,
  detalle,
  etiqueta,
  abrir,
}: {
  titulo: string
  detalle: string
  etiqueta: string
  abrir: () => void
}): React.JSX.Element {
  return (
    <Pulsable style={s.fila} accessibilityLabel={etiqueta} onPress={abrir}>
      <View style={s.textos}>
        <Text style={s.destacado}>{titulo}</Text>
        <Text style={s.tenue}>{detalle}</Text>
      </View>
      <Icono nombre="adelante" color={tema.acento} />
    </Pulsable>
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
  grupo: { gap: espacio[8] },
  nombre: { ...tipo.tituloPantalla, color: tema.texto },
  titulo: { ...tipo.titulo, color: tema.texto },
  tenue: { ...tipo.secundario, color: tema.textoTenue },
  tarjeta: {
    backgroundColor: tema.superficie,
    borderRadius: radio.tarjeta,
    padding: espacio[16],
    gap: espacio[8],
  },
  fila: {
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
