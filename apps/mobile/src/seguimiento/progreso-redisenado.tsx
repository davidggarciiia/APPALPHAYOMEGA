import { useCallback, useRef, useState } from "react"
import { randomUUID } from "expo-crypto"
import { useFocusEffect } from "expo-router"
import {
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  SectionList,
  StyleSheet,
  Text,
  View,
} from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import type {
  ConfiguracionSeguimiento,
  DiaDeSeguimiento,
  Evolucion,
  ListadoMedidas,
  MedioFoto,
  ProgresionFuerza,
  PruebaFisica,
  SolicitudFotos,
} from "@alpha-omega/shared"
import { AvisoDeError, BotonSecundario } from "../componentes/formulario"
import { hoyAgenda, lunesDeSemana, sumarDias } from "../entrenamiento/fechas"
import { tema, tipo } from "../tema"
import { faltaDe } from "../lib/errores"
import type { ApiSeguimiento } from "./api"
import type { ApiMedios } from "./medios-api"
import type { ApiEvolucionAvisos, ApiValoracionesCliente } from "./valoraciones-api"
import { crearResumenProgreso, type FilaResumenProgreso } from "./resumen-progreso"
import { resumenDeSemana, miles, suenoLegible } from "./modelo"
import { Grafica } from "./grafica"
import { EvolucionValoraciones } from "./evolucion-valoraciones"
import { ComparadorFotos, ImagenPrivada } from "./comparador-fotos"
import { FotosProgreso } from "./fotos-progreso"
import { FilaComparativa, TarjetaPeso, type Comparativa } from "./tarjetas-progreso"
import { SolicitudesFotos } from "./solicitudes-fotos"
import { AnadirMedida, AnadirPrueba } from "./formularios"
import { ValoracionesCliente } from "./resumen-valoracion"

type Datos = {
  configuracion: ConfiguracionSeguimiento
  dias: DiaDeSeguimiento[]
  medidas: ListadoMedidas
  fuerza: ProgresionFuerza["ejercicios"]
  pruebas: PruebaFisica[]
}
type Detalle = {
  titulo: string
  descripcionGrafica?: string
  puntos?: { fecha: string; valor: number }[]
  historial?: string[]
  evolucion?: boolean
  fotos?: boolean
  solicitudes?: boolean
  valoraciones?: boolean
}
type Fila = {
  clave: string
  nombre: string
  texto: string
  detalle?: Detalle
  sentido?: FilaResumenProgreso["sentido"]
  comparador?: boolean
  comparativa?: Comparativa
  pesoDestacado?: boolean
  fotosCompactas?: boolean
  fechaActual?: string
}
type Seccion = { titulo: string; data: Fila[] }

function posicionEnTarjeta(
  filas: Fila[],
  indice: number,
): "unica" | "primera" | "intermedia" | "ultima" {
  const anterior = filas[indice - 1]?.comparativa
  const siguiente = filas[indice + 1]?.comparativa
  if (!anterior) return siguiente ? "primera" : "unica"
  return siguiente ? "intermedia" : "ultima"
}

const numero = (n: number): string => String(Number(n.toPrecision(12))).replace(".", ",")
const delta = (n: number | null, unidad: string): string =>
  n === null ? "" : ` · ${n > 0 ? "+" : n < 0 ? "−" : ""}${numero(Math.abs(n))} ${unidad}`
const fechaOrden = (
  a: { fecha: string; creadoEn: string; id: string },
  b: { fecha: string; creadoEn: string; id: string },
): number =>
  a.fecha.localeCompare(b.fecha) || a.creadoEn.localeCompare(b.creadoEn) || a.id.localeCompare(b.id)

type Propiedades = {
  clienteId: string
  seguimiento: ApiSeguimiento
  valoraciones?: ApiValoracionesCliente & Pick<ApiEvolucionAvisos, "evolucion">
  medios?: ApiMedios
}

export function ProgresoRedisenado(props: Propiedades): React.JSX.Element {
  return <ProgresoPorCuenta key={props.clienteId} {...props} />
}

function ProgresoPorCuenta({
  clienteId,
  seguimiento,
  valoraciones,
  medios,
}: Propiedades): React.JSX.Element {
  const [datos, setDatos] = useState<Datos | null>(null)
  const [evolucion, setEvolucion] = useState<Evolucion | null>(null)
  const [fotos, setFotos] = useState<MedioFoto[]>([])
  const [solicitudes, setSolicitudes] = useState<SolicitudFotos[]>([])
  const [error, setError] = useState("")
  const [reintentable, setReintentable] = useState(true)
  const [erroresAdicionales, setErroresAdicionales] = useState<string[]>([])
  const [cargasAdicionales, setCargasAdicionales] = useState(0)
  const [intento, setIntento] = useState(0)
  const [detalle, setDetalle] = useState<Detalle | null>(null)
  const [solicitudesMontadas, setSolicitudesMontadas] = useState(false)
  const cierreProtegido = useRef<((salir: () => void) => void) | null>(null)
  const registrarCierre = useCallback((proteger: ((salir: () => void) => void) | null) => {
    cierreProtegido.current = proteger
  }, [])
  const [formulario, setFormulario] = useState<"medida" | "prueba" | null>(null)
  const hoy = hoyAgenda()
  const lunes = lunesDeSemana(hoy)

  useFocusEffect(
    useCallback(() => {
      let vigente = true
      setDatos(null)
      setEvolucion(null)
      setFotos([])
      setSolicitudes([])
      setError("")
      setReintentable(true)
      setErroresAdicionales([])
      setDetalle(null)
      setCargasAdicionales((valoraciones ? 1 : 0) + (medios ? 2 : 0))
      const terminarAdicional = (): void => {
        if (vigente) setCargasAdicionales((n) => n - 1)
      }
      if (valoraciones)
        void valoraciones
          .evolucion(clienteId)
          .then(
            (valor) => {
              if (vigente) setEvolucion(valor)
            },
            () => {
              if (vigente)
                setErroresAdicionales((e) => [...e, "No se pudo cargar la composición corporal."])
            },
          )
          .finally(terminarAdicional)
      if (medios) {
        void medios
          .fotosDeCliente(clienteId)
          .then(
            (valor) => {
              if (vigente) setFotos(valor.fotos)
            },
            () => {
              if (vigente) setErroresAdicionales((e) => [...e, "No se pudieron cargar tus fotos."])
            },
          )
          .finally(terminarAdicional)
        void medios
          .solicitudes(clienteId)
          .then(
            (valor) => {
              if (vigente) setSolicitudes(valor.solicitudes)
            },
            () => {
              if (vigente)
                setErroresAdicionales((e) => [
                  ...e,
                  "No se pudieron cargar las solicitudes de fotos.",
                ])
            },
          )
          .finally(terminarAdicional)
      }
      void (async () => {
        try {
          const [configuracion, dias, medidas, fuerza, pruebas] = await Promise.all([
            seguimiento.configuracion(clienteId),
            seguimiento.dias(clienteId, sumarDias(lunes, -7), hoy),
            seguimiento.medidas(clienteId),
            seguimiento.fuerza(clienteId),
            seguimiento.pruebas(clienteId),
          ])
          if (!vigente) return
          setDatos({
            configuracion,
            dias: dias.dias,
            medidas,
            fuerza: fuerza.ejercicios,
            pruebas: pruebas.pruebas,
          })
        } catch (causa) {
          if (vigente) {
            const falta = faltaDe(causa, "No se pudo cargar tu progreso. Revisa la conexión.")
            setError(falta.texto)
            setReintentable(falta.reintentable)
          }
        }
      })()
      return () => {
        vigente = false
      }
    }, [clienteId, seguimiento, valoraciones, medios, hoy, lunes, intento]),
  )

  const secciones: Seccion[] = []
  if (datos) {
    const activos = new Set(datos.configuracion.indicadores)
    const resumen = crearResumenProgreso({
      configuracion: datos.configuracion,
      medidas: datos.medidas.medidas,
      fuerza: datos.fuerza,
      evolucion: evolucion?.series ?? [],
    })
    if (medios && fotos.some((f) => f.estado !== "pendiente"))
      secciones.push({
        titulo: "",
        data: [{ clave: "fotos-compactas", nombre: "Fotos", texto: "", fotosCompactas: true }],
      })
    const ejercicios: Fila[] = activos.has("fuerza")
      ? datos.fuerza.flatMap((e) => {
          const puntos = [...e.puntos].sort((a, b) => a.fecha.localeCompare(b.fecha))
          const primero = puntos[0]
          if (!primero) return []
          const mejor = puntos.reduce((a, b) =>
            b.pesoKg > a.pesoKg || (b.pesoKg === a.pesoKg && b.repeticiones > a.repeticiones)
              ? b
              : a,
          )
          return [
            {
              clave: `fuerza-${e.ejercicioId}`,
              nombre: e.nombre,
              texto: `${numero(mejor.pesoKg)} kg × ${mejor.repeticiones}${puntos.length > 1 ? delta(mejor.pesoKg - primero.pesoKg, "kg") : ""} · primer registro disponible`,
              comparativa: {
                id: `fuerza-${e.ejercicioId}`,
                nombre: e.nombre,
                inicial: puntos.length > 1 ? primero.pesoKg : null,
                actual: mejor.pesoKg,
                unidad: "kg",
                repeticionesInicial: puntos.length > 1 ? primero.repeticiones : null,
                repeticionesActual: mejor.repeticiones,
                representacion: "tramo",
                descripcion: "primer registro disponible",
              },
              detalle: {
                titulo: e.nombre,
                puntos: puntos.map((p) => ({ fecha: p.fecha, valor: p.pesoKg })),
                descripcionGrafica: `Evolución de ${e.nombre}: carga en kg`,
                historial: puntos.map(
                  (p) => `${p.fecha}: ${numero(p.pesoKg)} kg × ${p.repeticiones}`,
                ),
              },
            },
          ]
        })
      : []
    const medidas: Fila[] = []
    for (const [indicador, campo, nombre, unidad] of [
      ["peso", "pesoKg", "Peso", "kg"],
      ["cintura", "cinturaCm", "Cintura", "cm"],
    ] as const) {
      if (!activos.has(indicador)) continue
      const puntos = [...datos.medidas.medidas]
        .sort(fechaOrden)
        .flatMap((m) => (m[campo] === null ? [] : [{ fecha: m.fecha, valor: m[campo]! }]))
      const primero = puntos[0],
        ultimo = puntos.at(-1)
      if (!primero || !ultimo) continue
      medidas.push({
        clave: indicador,
        nombre,
        fechaActual: ultimo.fecha,
        texto: `${numero(ultimo.valor)} ${unidad}${puntos.length > 1 ? delta(ultimo.valor - primero.valor, unidad) : ""}`,
        comparativa: {
          id: indicador,
          nombre,
          inicial: puntos.length > 1 ? primero.valor : null,
          actual: ultimo.valor,
          unidad,
          descripcion: `medida del ${ultimo.fecha}`,
        },
        detalle: {
          titulo: nombre,
          puntos,
          historial: puntos.map((p) => `${p.fecha}: ${numero(p.valor)} ${unidad}`),
        },
      })
    }
    // El contrato no distingue otros perímetros en la configuración: las medidas
    // publicadas en cm siguen el mismo control conservador que cintura.
    const publicadas = activos.has("cintura")
      ? (evolucion?.series ?? []).filter(
          (serie) =>
            serie.bloque === "medidas" &&
            serie.origen === "valoracion" &&
            serie.clasificada &&
            serie.unidad === "cm" &&
            serie.puntos.length > 0,
        )
      : []
    const esCintura = (nombre: string): boolean => nombre.trim().toLowerCase() === "cintura"
    const cinturaLegacy = medidas.find((fila) => fila.clave === "cintura")
    const ultimaCinturaPublicada = publicadas
      .filter((serie) => esCintura(serie.nombre))
      .flatMap((serie) => serie.puntos)
      .reduce((fecha, punto) => (punto.fecha > fecha ? punto.fecha : fecha), "")
    const usarCinturaPublicada =
      ultimaCinturaPublicada !== "" &&
      (!cinturaLegacy || ultimaCinturaPublicada >= cinturaLegacy.fechaActual!)
    if (usarCinturaPublicada && cinturaLegacy) medidas.splice(medidas.indexOf(cinturaLegacy), 1)
    const nombresPublicados = new Map<string, number>()
    for (const serie of publicadas) {
      const nombre = serie.nombre.trim().toLowerCase()
      nombresPublicados.set(nombre, (nombresPublicados.get(nombre) ?? 0) + 1)
    }
    for (const serie of publicadas) {
      if (esCintura(serie.nombre) && cinturaLegacy && !usarCinturaPublicada) continue
      const puntos = [...serie.puntos].sort((a, b) => a.fecha.localeCompare(b.fecha))
      const primero = puntos[0]!,
        ultimo = puntos[puntos.length - 1]!
      const comparable =
        puntos.length > 1 &&
        puntos.every((punto) => punto.valoracionId !== null) &&
        new Set(puntos.map((punto) => punto.valoracionId)).size === puntos.length
      const repetido = (nombresPublicados.get(serie.nombre.trim().toLowerCase()) ?? 0) > 1
      const metodo = serie.metodo ?? "Método no especificado"
      const nombre = repetido ? `${serie.nombre} · ${metodo}` : serie.nombre
      medidas.push({
        clave: serie.clave,
        nombre,
        fechaActual: ultimo.fecha,
        texto: `${numero(ultimo.valor)} ${serie.unidad}${comparable ? delta(ultimo.valor - primero.valor, serie.unidad) : ""}`,
        comparativa: {
          id: serie.clave,
          nombre,
          inicial: comparable ? primero.valor : null,
          actual: ultimo.valor,
          unidad: serie.unidad,
          sentido: "neutral",
          descripcion: `Valoración publicada del ${ultimo.fecha}${repetido ? "" : ` · ${metodo}`}`,
        },
        detalle: {
          titulo: `${serie.nombre} · ${metodo}`,
          puntos: puntos.map(({ fecha, valor }) => ({ fecha, valor })),
          descripcionGrafica: `Evolución de ${serie.nombre}: ${serie.unidad}, ${metodo}`,
          historial: puntos.map(
            (punto) => `${punto.fecha}: ${numero(punto.valor)} ${serie.unidad}`,
          ),
        },
      })
    }
    const diario = new Map<string, number>()
    const serieDiaria = evolucion?.series.find(
      (serie) =>
        serie.clave === "h:dia:pesoKg" && serie.unidad === "kg" && serie.origen === "autorregistro",
    )
    for (const punto of serieDiaria?.puntos ?? []) diario.set(punto.fecha, punto.valor)
    for (const dia of datos.dias) if (dia.pesoKg !== null) diario.set(dia.fecha, dia.pesoKg)
    const puntosDiarios = [...diario]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([fecha, valor]) => ({ fecha, valor }))
    const ultimoPesoDiario = puntosDiarios.at(-1)
    if (activos.has("peso") && ultimoPesoDiario)
      medidas.push({
        clave: "peso-diario",
        nombre: "Peso diario",
        fechaActual: ultimoPesoDiario.fecha,
        texto: `${numero(ultimoPesoDiario.valor)} kg · ${ultimoPesoDiario.fecha}`,
        comparativa: {
          id: "peso-diario",
          nombre: "Peso diario",
          inicial: serieDiaria && puntosDiarios.length > 1 ? puntosDiarios[0]!.valor : null,
          actual: ultimoPesoDiario.valor,
          unidad: "kg",
          descripcion: `registro diario, ${ultimoPesoDiario.fecha}`,
        },
        detalle: {
          titulo: "Peso diario",
          puntos: puntosDiarios,
          historial: puntosDiarios.map((p) => `${p.fecha}: ${numero(p.valor)} kg`),
        },
      })
    const semana = resumenDeSemana(datos.dias, lunes)
    if (activos.has("pasos") && semana.pasos !== null)
      medidas.push({
        clave: "pasos",
        nombre: "Pasos",
        texto: `${miles(semana.pasos)} de media semanal`,
      })
    if (activos.has("sueno") && semana.suenoMin !== null)
      medidas.push({
        clave: "sueno",
        nombre: "Sueño",
        texto: `${suenoLegible(semana.suenoMin)} de media semanal`,
      })
    const filaDiaria = medidas.find((fila) => fila.clave === "peso-diario")
    const filaMedida = medidas.find((fila) => fila.clave === "peso")
    const elegidaPeso =
      filaDiaria && filaMedida
        ? filaDiaria.fechaActual! >= filaMedida.fechaActual!
          ? filaDiaria
          : filaMedida
        : (filaDiaria ?? filaMedida)
    if (elegidaPeso?.comparativa) {
      const esDiaria = elegidaPeso === filaDiaria
      const origenDiarioCompleto = serieDiaria && puntosDiarios.length > 0
      const resumenDiario = origenDiarioCompleto
        ? crearResumenProgreso({
            configuracion: datos.configuracion,
            medidas: [],
            fuerza: [],
            evolucion: [
              {
                ...serieDiaria,
                puntos: puntosDiarios.map((p) => ({
                  ...p,
                  publicacionId: null,
                  valoracionId: null,
                  corregido: false,
                })),
              },
            ],
          }).find((fila) => fila.tipo === "peso")
        : undefined
      const resumenPeso = esDiaria ? resumenDiario : resumen.find((fila) => fila.tipo === "peso")
      elegidaPeso.comparativa = {
        ...elegidaPeso.comparativa,
        nombre: esDiaria ? "Peso en ayunas" : "Peso",
        sentido: resumenPeso?.sentido ?? "neutral",
      }
      elegidaPeso.pesoDestacado = true
      secciones.push({ titulo: "", data: [elegidaPeso] })
    }
    const otrasMedidas = medidas.filter((fila) => fila !== elegidaPeso)
    if (otrasMedidas.length) secciones.push({ titulo: "Medidas", data: otrasMedidas })
    const corporal: Fila[] = (evolucion?.series ?? []).flatMap((serie) => {
      if (
        (serie.bloque !== "bioimpedancia" && serie.bloque !== "pliegues") ||
        serie.origen !== "valoracion" ||
        !serie.clasificada ||
        !serie.puntos.length
      )
        return []
      const puntos = [...serie.puntos].sort((a, b) => a.fecha.localeCompare(b.fecha))
      const primero = puntos[0]!,
        ultimo = puntos[puntos.length - 1]!
      const comparable =
        puntos.length > 1 &&
        primero.valoracionId !== null &&
        ultimo.valoracionId !== null &&
        primero.valoracionId !== ultimo.valoracionId &&
        new Set(puntos.map((p) => p.valoracionId)).size === puntos.length
      return [
        {
          clave: serie.clave,
          nombre: serie.nombre,
          texto: `${numero(ultimo.valor)} ${serie.unidad}${comparable ? delta(ultimo.valor - primero.valor, serie.unidad) : ""}${serie.metodo ? ` · ${serie.metodo}` : ""}`,
          comparativa: {
            id: serie.clave,
            nombre: serie.nombre,
            inicial: comparable ? primero.valor : null,
            actual: ultimo.valor,
            unidad: serie.unidad,
            descripcion: serie.metodo ?? undefined,
            representacion: serie.unidad === "%" ? "anillos" : "barras",
          },
          detalle: { titulo: "Evolución corporal", evolucion: true },
        },
      ]
    })
    if (corporal.length) secciones.push({ titulo: "Composición", data: corporal })
    if (ejercicios.length) secciones.push({ titulo: "Fuerza", data: ejercicios })
    const pruebas: Fila[] = []
    if (activos.has("pruebas")) {
      const grupos = new Map<string, PruebaFisica[]>()
      for (const p of [...datos.pruebas].sort(fechaOrden)) {
        const clave = `${p.pruebaId ?? p.nombre}:${p.unidad}`
        grupos.set(clave, [...(grupos.get(clave) ?? []), p])
      }
      for (const [clave, grupo] of grupos) {
        const primero = grupo[0]!,
          ultimo = grupo[grupo.length - 1]!
        pruebas.push({
          clave,
          nombre: ultimo.nombre,
          texto: `${numero(ultimo.valor)} ${ultimo.unidad}${grupo.length > 1 ? delta(ultimo.valor - primero.valor, ultimo.unidad) : ""} · ${ultimo.fecha}`,
          comparativa: {
            id: clave,
            nombre: ultimo.nombre,
            inicial: grupo.length > 1 ? primero.valor : null,
            actual: ultimo.valor,
            unidad: ultimo.unidad,
            descripcion: ultimo.fecha,
            representacion: "tramo",
          },
          detalle: {
            titulo: ultimo.nombre,
            historial: grupo.map((p) => `${p.fecha}: ${numero(p.valor)} ${p.unidad}`),
          },
        })
      }
    }
    if (pruebas.length) secciones.push({ titulo: "Pruebas", data: pruebas })
  }
  const pendientes = solicitudes.filter(
    (solicitud) =>
      solicitud.estado !== "revisada" &&
      solicitud.vistas.some(
        (vista) =>
          !solicitud.medios.some((foto) => foto.vista === vista && foto.estado === "disponible"),
      ),
  )
  const recargar = (): void => setIntento((n) => n + 1)
  const cerrarSolicitudes = (): void => {
    cierreProtegido.current?.(() => {
      setSolicitudesMontadas(false)
      recargar()
    })
  }
  return (
    <View style={s.pantalla}>
      {error !== "" && (
        <View style={s.aviso}>
          <AvisoDeError mensaje={error} />
          {reintentable && <BotonSecundario texto="Reintentar" onPress={recargar} />}
        </View>
      )}
      {erroresAdicionales.length > 0 && (
        <View style={s.aviso}>
          {erroresAdicionales.map((e) => (
            <AvisoDeError key={e} mensaje={e} />
          ))}
          <BotonSecundario texto="Reintentar" onPress={recargar} />
        </View>
      )}
      {!datos && !error && (
        <Text accessibilityRole="progressbar" accessibilityLabel="Cargando progreso">
          Cargando…
        </Text>
      )}
      {datos && (
        <SectionList
          sections={secciones}
          initialNumToRender={30}
          keyExtractor={(fila) => fila.clave}
          contentContainerStyle={s.listaPrincipal}
          ListHeaderComponent={
            pendientes.length > 0 || solicitudesMontadas ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Fotos pendientes"
                onPress={() => {
                  setSolicitudesMontadas(true)
                }}
                style={s.fila}
              >
                <Text style={s.nombre}>Fotos pendientes</Text>
              </Pressable>
            ) : undefined
          }
          ListEmptyComponent={
            erroresAdicionales.length === 0 &&
            cargasAdicionales === 0 &&
            pendientes.length === 0 ? (
              <Text style={s.texto}>
                Tu entrenador registrará tu punto de partida en la primera valoración
              </Text>
            ) : undefined
          }
          ListFooterComponent={
            <View style={s.aviso}>
              {!secciones.some((seccion) => seccion.titulo === "Medidas") &&
                (datos.configuracion.indicadores.includes("peso") ||
                  datos.configuracion.indicadores.includes("cintura")) && (
                  <BotonSecundario texto="Añadir medida" onPress={() => setFormulario("medida")} />
                )}
              {datos.configuracion.indicadores.includes("pruebas") &&
                datos.configuracion.pruebasPrescritas.length > 0 && (
                  <BotonSecundario texto="Añadir prueba" onPress={() => setFormulario("prueba")} />
                )}
              {valoraciones && (
                <BotonSecundario
                  texto="Ver valoraciones"
                  onPress={() => setDetalle({ titulo: "Valoraciones", valoraciones: true })}
                />
              )}
            </View>
          }
          renderSectionHeader={({ section }) =>
            section.titulo ? (
              <View style={s.encabezadoSeccion}>
                <Text accessibilityRole="header" style={s.titulo}>
                  {section.titulo}
                </Text>
                {section.titulo === "Medidas" &&
                  (datos.configuracion.indicadores.includes("peso") ||
                    datos.configuracion.indicadores.includes("cintura")) && (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Añadir medida"
                      onPress={() => setFormulario("medida")}
                      style={s.anadir}
                    >
                      <Text style={s.textoAnadir}>Añadir</Text>
                    </Pressable>
                  )}
              </View>
            ) : null
          }
          renderItem={({ item, index, section }) =>
            item.fotosCompactas && medios ? (
              <View style={s.espacioIntro}>
                {fotos.some((foto) => foto.estado === "disponible") ? (
                  <FotosProgreso
                    fotos={fotos}
                    acceso={medios.acceso}
                    abrirGaleria={() => setDetalle({ titulo: "Fotos", fotos: true })}
                  />
                ) : (
                  <BotonSecundario
                    texto="Ver galería"
                    etiquetaAccesible="Ver galería de fotos"
                    onPress={() => setDetalle({ titulo: "Fotos", fotos: true })}
                  />
                )}
              </View>
            ) : item.pesoDestacado && item.comparativa ? (
              <View style={s.espacioIntro}>
                <TarjetaPeso
                  etiqueta={item.comparativa.nombre}
                  inicial={item.comparativa.inicial}
                  actual={item.comparativa.actual}
                  unidad={item.comparativa.unidad}
                  sentido={item.comparativa.sentido}
                  descripcion={item.comparativa.descripcion}
                  alPulsar={item.detalle ? () => setDetalle(item.detalle!) : undefined}
                />
              </View>
            ) : item.comparativa ? (
              <FilaComparativa
                fila={{
                  ...item.comparativa,
                  alPulsar: item.detalle ? () => setDetalle(item.detalle!) : undefined,
                }}
                posicion={posicionEnTarjeta(section.data, index)}
              />
            ) : item.detalle ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${item.nombre}, ${item.texto}`}
                onPress={() => setDetalle(item.detalle!)}
                style={s.fila}
              >
                <Text style={s.nombre}>{item.nombre}</Text>
                <Text style={s.texto}>{item.texto}</Text>
              </Pressable>
            ) : (
              <View style={s.fila}>
                <Text style={s.nombre}>{item.nombre}</Text>
                <Text
                  style={[
                    s.texto,
                    item.sentido === "favorable" && s.favorable,
                    item.sentido === "desfavorable" && s.desfavorable,
                  ]}
                >
                  {item.texto}
                </Text>
              </View>
            )
          }
        />
      )}
      {detalle && (
        <Modal visible animationType="none" onRequestClose={() => setDetalle(null)}>
          <SafeAreaView style={s.pantalla}>
            {detalle.fotos && medios ? (
              <FlatList
                testID="galeria-fotos"
                data={[...fotos]
                  .filter((foto) => foto.estado === "disponible")
                  .sort(
                    (a, b) =>
                      a.fechaToma.localeCompare(b.fechaToma) ||
                      a.creadoEn.localeCompare(b.creadoEn) ||
                      a.id.localeCompare(b.id),
                  )}
                keyExtractor={(foto) => foto.id}
                initialNumToRender={3}
                windowSize={5}
                contentContainerStyle={s.lista}
                ListHeaderComponent={
                  <View>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Volver a progreso"
                      onPress={() => setDetalle(null)}
                      style={s.fila}
                    >
                      <Text style={s.nombre}>Volver</Text>
                    </Pressable>
                    <Text accessibilityRole="header" style={s.titulo}>
                      Galería por fecha
                    </Text>
                    <ComparadorFotos
                      fotos={fotos}
                      api={medios}
                      puedeBorrar={(foto) =>
                        foto.origen === "cliente" && foto.autor.id === clienteId
                      }
                      alConfirmarBorrado={(foto) =>
                        setFotos((anteriores) =>
                          anteriores.map((anterior) => (anterior.id === foto.id ? foto : anterior)),
                        )
                      }
                    />
                  </View>
                }
                renderItem={({ item: foto }) => (
                  <View>
                    <Text accessibilityRole="header" style={s.nombre}>
                      {foto.fechaToma}
                    </Text>
                    <ImagenPrivada
                      medioId={foto.id}
                      etiqueta={`${foto.vista}, ${foto.fechaToma}`}
                      acceso={medios.acceso}
                    />
                  </View>
                )}
              />
            ) : (
              <ScrollView contentContainerStyle={s.lista}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Volver a progreso"
                  onPress={() => setDetalle(null)}
                  style={s.fila}
                >
                  <Text style={s.nombre}>Volver</Text>
                </Pressable>
                <Text accessibilityRole="header" style={s.titulo}>
                  {detalle.titulo}
                </Text>
                {detalle.puntos && detalle.puntos.length > 1 && (
                  <Grafica
                    puntos={detalle.puntos}
                    tendencia={detalle.puntos}
                    descripcion={detalle.descripcionGrafica ?? `Evolución de ${detalle.titulo}`}
                    izquierda={detalle.puntos[0]!.fecha}
                    derecha={detalle.puntos[detalle.puntos.length - 1]!.fecha}
                  />
                )}
                {detalle.historial?.map((h, i) => (
                  <Text key={`${i}-${h}`} style={s.texto}>
                    {h}
                  </Text>
                ))}
                {detalle.evolucion && valoraciones && (
                  <EvolucionValoraciones
                    clienteId={clienteId}
                    api={valoraciones}
                    modo="cliente"
                    bloques={["bioimpedancia", "pliegues"]}
                  />
                )}
                {detalle.valoraciones && valoraciones && (
                  <ValoracionesCliente clienteId={clienteId} api={valoraciones} />
                )}
              </ScrollView>
            )}
          </SafeAreaView>
        </Modal>
      )}
      {solicitudesMontadas && medios && (
        <Modal visible animationType="none" onRequestClose={cerrarSolicitudes}>
          <SafeAreaView style={s.pantalla}>
            <ScrollView contentContainerStyle={s.lista}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Volver a progreso"
                onPress={cerrarSolicitudes}
                style={s.fila}
              >
                <Text style={s.nombre}>Volver</Text>
              </Pressable>
              <SolicitudesFotos
                clienteId={clienteId}
                api={medios}
                modo="cliente"
                nuevoId={randomUUID}
                registrarCierre={registrarCierre}
              />
            </ScrollView>
          </SafeAreaView>
        </Modal>
      )}
      <AnadirMedida
        visible={formulario === "medida"}
        indicadores={datos?.configuracion.indicadores}
        cerrar={() => setFormulario(null)}
        registrar={async (medida) => {
          await seguimiento.registrarMedida(clienteId, medida)
          recargar()
        }}
      />
      <AnadirPrueba
        visible={formulario === "prueba"}
        cerrar={() => setFormulario(null)}
        pruebas={datos?.configuracion.pruebasPrescritas ?? []}
        registrar={async (prueba) => {
          await seguimiento.registrarPrueba(clienteId, prueba)
          recargar()
        }}
      />
    </View>
  )
}

const s = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: tema.fondo },
  lista: { gap: 12, padding: 20 },
  listaPrincipal: { padding: 20 },
  espacioIntro: { marginBottom: 24 },
  encabezadoSeccion: {
    marginTop: 24,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  anadir: { minHeight: 44, justifyContent: "center" },
  textoAnadir: { ...tipo.secundario, color: tema.acento, fontFamily: tema.fuenteBoton },
  aviso: { gap: 8, padding: 20 },
  titulo: { ...tipo.titulo, color: tema.texto },
  fila: { minHeight: 52, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: tema.borde },
  nombre: { ...tipo.fila, color: tema.texto },
  texto: { ...tipo.cuerpo, color: tema.textoSecundario },
  favorable: { color: tema.exito },
  desfavorable: { color: tema.aviso },
})
