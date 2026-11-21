import { useCallback, useState } from "react"
import { useFocusEffect, type Href } from "expo-router"
import { StyleSheet, Text, TextInput, View } from "react-native"
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
import { ACTIVACIONES_POR_PAGINA, cargarTrabajo, type TrabajoEntrenador } from "./cargar-trabajo"
import {
  TarjetaCliente,
  necesitaAtencion,
  nombreCliente,
  sinPlanEstaSemana,
} from "./tarjeta-cliente"
import { useResumenSemanal } from "./use-resumen-semanal"

/** Con menos clientes que estos, buscar y filtrar estorban más que ayudan. */
const CLIENTES_PARA_BUSCAR = 6
/**
 * Tarjetas que se pintan de una vez. Cada una mide 176 px o más, y esta pantalla
 * vive dentro del desplazamiento de la pantalla de Inicio, donde una lista
 * virtualizada no podría descartar nada: se pinta por tramos y se avisa de cuántos
 * quedan, igual que la cartera.
 */
const TARJETAS_POR_TRAMO = 12

const normalizar = (texto: string): string =>
  texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()

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
  const [desdePendientes, setDesdePendientes] = useState(0)
  const [intento, setIntento] = useState(0)
  const [busqueda, setBusqueda] = useState("")
  const [soloAtencion, setSoloAtencion] = useState(false)
  const [tramos, setTramos] = useState(1)
  useFocusEffect(
    useCallback(() => {
      let vigente = true
      setTrabajo(null)
      setError(null)
      void cargarTrabajo(pedir, desdePendientes)
        .then((datos) => {
          if (vigente) setTrabajo(datos)
        })
        .catch((causa: unknown) => {
          if (vigente) setError(faltaDe(causa, "No se pudieron cargar las tareas."))
        })
      return () => {
        vigente = false
      }
    }, [pedir, desdePendientes, intento]),
  )
  const clientes = [...(resumen.datos?.clientes ?? [])].sort(
    (a, b) =>
      Number(necesitaAtencion(b, semana, hoy)) - Number(necesitaAtencion(a, semana, hoy)) ||
      nombreCliente(a).localeCompare(nombreCliente(b), "es"),
  )
  const enAtencion = clientes.filter((cliente) => necesitaAtencion(cliente, semana, hoy))
  const terminos = normalizar(busqueda).split(/\s+/).filter(Boolean)
  const coincidentes = (soloAtencion ? enAtencion : clientes).filter((cliente) => {
    const nombreNormal = normalizar(nombreCliente(cliente))
    return terminos.every((termino) => nombreNormal.includes(termino))
  })
  const visibles = coincidentes.slice(0, tramos * TARJETAS_POR_TRAMO)
  const puedeFiltrar = clientes.length >= CLIENTES_PARA_BUSCAR
  const mostrarTrabajo = resumen.error?.reintentable !== false
  const cambiarSemana = (nueva: string): void => {
    setSemana(nueva)
    setTramos(1)
  }
  return (
    <View style={s.contenido}>
      <View style={s.saludo}>
        <Text style={[s.nombre, s.textos]} accessibilityRole="header">
          Hola, {nombre}
        </Text>
        <BotonEnlace
          texto="Actualizar"
          etiquetaAccesible="Actualizar el resumen semanal"
          ocupado={resumen.actualizando}
          onPress={resumen.refrescar}
        />
      </View>
      <View style={s.semana}>
        <Pulsable
          style={s.flecha}
          accessibilityLabel="Semana anterior"
          onPress={() => cambiarSemana(sumarDias(semana, -7))}
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
          onPress={() => cambiarSemana(sumarDias(semana, 7))}
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
              {puedeFiltrar && (
                <View style={s.grupo}>
                  <View style={s.buscador}>
                    <TextInput
                      style={s.campo}
                      value={busqueda}
                      onChangeText={(texto) => {
                        setBusqueda(texto)
                        setTramos(1)
                      }}
                      placeholder="Buscar cliente por nombre"
                      placeholderTextColor={tema.textoTenue}
                      selectionColor={tema.acento}
                      accessibilityLabel="Buscar cliente por nombre"
                      autoCorrect={false}
                      autoCapitalize="none"
                      returnKeyType="search"
                    />
                  </View>
                  <View style={s.filtros}>
                    {[
                      { atencion: false, texto: `Todos · ${clientes.length}` },
                      { atencion: true, texto: `Requieren atención · ${enAtencion.length}` },
                    ].map((filtro) => (
                      <Pulsable
                        key={String(filtro.atencion)}
                        style={[s.filtro, soloAtencion === filtro.atencion && s.filtroPuesto]}
                        accessibilityLabel={filtro.texto}
                        accessibilityState={{ selected: soloAtencion === filtro.atencion }}
                        onPress={() => {
                          setSoloAtencion(filtro.atencion)
                          setTramos(1)
                        }}
                      >
                        <Text
                          style={[s.textoFiltro, soloAtencion === filtro.atencion && s.textoPuesto]}
                        >
                          {filtro.texto}
                        </Text>
                      </Pulsable>
                    ))}
                  </View>
                </View>
              )}
              {clientes.length === 0 && <Text style={s.tenue}>Aún no tienes clientes activos</Text>}
              {clientes.length > 0 && coincidentes.length === 0 && (
                <Text style={s.tenue} accessibilityLiveRegion="polite">
                  {terminos.length > 0
                    ? "Nadie coincide con la búsqueda"
                    : "Ahora mismo nadie requiere atención"}
                </Text>
              )}
              {visibles.map((cliente) => (
                <TarjetaCliente
                  key={cliente.clienteId}
                  cliente={cliente}
                  sinEnvios={
                    cliente.sesionesPrevistas > 0 &&
                    cliente.sesionesEnviadas === 0 &&
                    hoy >= sumarDias(semana, 2)
                  }
                  sinPlan={sinPlanEstaSemana(cliente, semana, hoy)}
                  abrir={abrir}
                />
              ))}
              {visibles.length < coincidentes.length && (
                <View style={s.grupo}>
                  <Text style={s.tenue}>
                    {`Mostrando ${visibles.length} de ${coincidentes.length}`}
                  </Text>
                  <BotonEnlace
                    texto="Mostrar más clientes"
                    etiquetaAccesible={`Mostrar más clientes, quedan ${coincidentes.length - visibles.length}`}
                    onPress={() => setTramos((n) => n + 1)}
                  />
                </View>
              )}
            </View>
          )
        )}
      </View>
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
  saludo: { flexDirection: "row", alignItems: "center", gap: espacio[8] },
  nombre: { ...tipo.tituloPantalla, color: tema.texto },
  buscador: {
    backgroundColor: tema.superficie,
    borderWidth: 1,
    borderColor: tema.bordeFuerte,
    borderRadius: radio.campo,
    paddingHorizontal: espacio[12],
  },
  campo: {
    ...tipo.cuerpo,
    color: tema.texto,
    minHeight: alto.campo,
    paddingVertical: espacio[12],
  },
  filtros: { flexDirection: "row", flexWrap: "wrap", gap: espacio[8] },
  filtro: {
    borderColor: tema.bordeFuerte,
    borderWidth: 1,
    borderRadius: radio.pastilla,
    paddingHorizontal: espacio[16],
    minHeight: alto.tactil,
    justifyContent: "center",
  },
  filtroPuesto: { backgroundColor: tema.acentoSuave, borderColor: tema.acento },
  textoFiltro: { ...tipo.secundario, fontFamily: tema.fuenteSemi, color: tema.textoTenue },
  textoPuesto: { color: tema.acento },
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
