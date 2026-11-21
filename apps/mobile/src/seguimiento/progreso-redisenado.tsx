import { useCallback, useEffect, useRef, useState } from "react"
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
  Medida,
  MedioFoto,
  ProgresionFuerza,
  ProximaRevision,
  PruebaFisica,
  SolicitudFotos,
} from "@alpha-omega/shared"
import { Dialogo } from "../componentes/dialogo"
import { Esqueleto, GrupoEsqueletos } from "../componentes/esqueleto"
import { AvisoDeError, BotonSecundario } from "../componentes/formulario"
import { hoyAgenda, lunesDeSemana, sumarDias } from "../entrenamiento/fechas"
import { fechaCorta } from "../entrenamiento/plan/modelo"
import { tema, tipo } from "../tema"
import { faltaDe } from "../lib/errores"
import { ErrorDelServidor } from "../lib/http"
import type { ApiSeguimiento } from "./api"
import type { ApiMedios } from "./medios-api"
import type { ApiEvolucionAvisos, ApiValoracionesCliente } from "./valoraciones-api"
import { crearResumenProgreso, type FilaResumenProgreso } from "./resumen-progreso"
import { resumenDeSemana, miles, suenoLegible } from "./modelo"
import { Grafica } from "./grafica"
import { EvolucionValoraciones } from "./evolucion-valoraciones"
import { ComparadorFotos, ImagenPrivada } from "./comparador-fotos"
import { FotosProgreso, nombreDePose } from "./fotos-progreso"
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
/** Un registro que el propio cliente puede borrar desde el historial. */
type RegistroBorrable = { tipo: "medida" | "prueba"; id: string; resumen: string }
type LineaHistorial = { texto: string; borrar?: RegistroBorrable }
type Detalle = {
  titulo: string
  descripcionGrafica?: string
  puntos?: { fecha: string; valor: number }[]
  /** Unidad de los puntos: rotula el eje y la descripción accesible de la gráfica. */
  unidad?: string
  historial?: LineaHistorial[]
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
/** Qué detalle está abierto: una fila (se relee de los datos vivos) o una pantalla propia. */
type Abierto = { clave: string } | { especial: Detalle }

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

/** «30 oct 2026»: entre registros pasan meses, así que el año cuenta. */
const fechaLarga = (fecha: string): string => `${fechaCorta(fecha)} ${fecha.slice(0, 4)}`

const cambioLegible = (n: number, unidad: string): string =>
  `${n > 0 ? "+" : n < 0 ? "−" : ""}${numero(Math.abs(n))} ${unidad}`

/** La gráfica es una imagen para el lector de pantalla: se lee con sus cifras. */
function etiquetaGrafica(
  base: string,
  puntos: { fecha: string; valor: number }[],
  unidad: string,
): string {
  const primero = puntos[0]!
  const ultimo = puntos[puntos.length - 1]!
  return `${base}. Primero: ${numero(primero.valor)} ${unidad} el ${fechaLarga(primero.fecha)}. Último: ${numero(ultimo.valor)} ${unidad} el ${fechaLarga(ultimo.fecha)}. Cambio: ${cambioLegible(Number((ultimo.valor - primero.valor).toPrecision(12)), unidad)}.`
}

/** Todo lo que lleva una medida: borrarla quita todos sus datos, no solo el que se ve. */
function resumenMedida(m: Medida): string {
  const partes = [
    m.pesoKg !== null && `peso ${numero(m.pesoKg)} kg`,
    m.cinturaCm !== null && `cintura ${numero(m.cinturaCm)} cm`,
    m.grasaPct !== null && `grasa ${numero(m.grasaPct)} %`,
    m.alturaCm !== null && `altura ${m.alturaCm} cm`,
  ].filter((parte) => parte !== false)
  return `Medida del ${fechaLarga(m.fecha)}: ${partes.join(", ")}`
}

const textoObjetivo = (objetivo: NonNullable<ConfiguracionSeguimiento["objetivoPeso"]>): string => {
  const base =
    objetivo.direccion === "bajar"
      ? "Bajar de peso"
      : objetivo.direccion === "subir"
        ? "Subir de peso"
        : "Mantener tu peso"
  return objetivo.rangoKg
    ? `${base} · entre ${numero(objetivo.rangoKg.minimo)} y ${numero(objetivo.rangoKg.maximo)} kg`
    : base
}

type Propiedades = {
  clienteId: string
  seguimiento: ApiSeguimiento
  valoraciones?: ApiValoracionesCliente & Pick<ApiEvolucionAvisos, "evolucion">
  medios?: ApiMedios
  /** Abre directamente las solicitudes de fotos o las valoraciones (enlace de una notificación). */
  abrir?: "fotos" | "valoraciones"
  /** Se avisa al abrir, para que la ruta olvide el parámetro y un enlace igual pueda repetirse. */
  alAbrir?: () => void
}

function Confirmacion({ texto }: { texto: string }): React.JSX.Element {
  return (
    <View style={s.confirmacion}>
      <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={s.textoConfirmacion}>
        {texto}
      </Text>
    </View>
  )
}

export function ProgresoRedisenado(props: Propiedades): React.JSX.Element {
  return <ProgresoPorCuenta key={props.clienteId} {...props} />
}

function ProgresoPorCuenta({
  clienteId,
  seguimiento,
  valoraciones,
  medios,
  abrir,
  alAbrir,
}: Propiedades): React.JSX.Element {
  const [datos, setDatos] = useState<Datos | null>(null)
  const [proxima, setProxima] = useState<ProximaRevision | null>(null)
  const [evolucion, setEvolucion] = useState<Evolucion | null>(null)
  const [fotos, setFotos] = useState<MedioFoto[]>([])
  const [solicitudes, setSolicitudes] = useState<SolicitudFotos[]>([])
  const [error, setError] = useState("")
  const [reintentable, setReintentable] = useState(true)
  const [erroresAdicionales, setErroresAdicionales] = useState<string[]>([])
  const [cargasAdicionales, setCargasAdicionales] = useState(0)
  const [intento, setIntento] = useState(0)
  const [abierto, setAbierto] = useState<Abierto | null>(null)
  const [aBorrar, setABorrar] = useState<RegistroBorrable | null>(null)
  const [borrando, setBorrando] = useState(false)
  const [errorBorrado, setErrorBorrado] = useState("")
  const [confirmacion, setConfirmacion] = useState<{ texto: string; id: number } | null>(null)
  const confirmar = (texto: string): void =>
    setConfirmacion((anterior) => ({ texto, id: (anterior?.id ?? 0) + 1 }))
  const consumido = useRef<string | undefined>(undefined)
  const [solicitudesMontadas, setSolicitudesMontadas] = useState(false)
  // Tras la primera carga, volver a la pantalla recarga en silencio: sin vaciar nada.
  const cargado = useRef(false)
  const borrandoAhora = useRef(false)
  const atrasValoraciones = useRef<(() => boolean) | null>(null)
  const registrarAtras = useCallback((atras: (() => boolean) | null) => {
    atrasValoraciones.current = atras
  }, [])
  const alAbrirActual = useRef(alAbrir)
  alAbrirActual.current = alAbrir
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
      // Primera carga: esqueleto. Después, lo que ya se ve se queda y se renueva al llegar.
      const inicial = !cargado.current
      if (inicial) {
        setDatos(null)
        setEvolucion(null)
        setProxima(null)
        setFotos([])
        setSolicitudes([])
        setError("")
        setReintentable(true)
        setErroresAdicionales([])
        setCargasAdicionales((valoraciones ? 1 : 0) + (medios ? 2 : 0))
      } else setCargasAdicionales(0)
      const terminarAdicional = (): void => {
        if (vigente && inicial) setCargasAdicionales((n) => n - 1)
      }
      // Un fallo al renovar no borra lo ya cargado; un acierto retira su aviso.
      const fallo = (texto: string): void => {
        if (vigente && inicial) setErroresAdicionales((e) => [...e, texto])
      }
      const acierto = (texto: string): void => {
        if (vigente) setErroresAdicionales((e) => e.filter((aviso) => aviso !== texto))
      }
      const AVISO_COMPOSICION = "No se pudo cargar la composición corporal."
      const AVISO_FOTOS = "No se pudieron cargar tus fotos."
      const AVISO_SOLICITUDES = "No se pudieron cargar las solicitudes de fotos."
      if (valoraciones) {
        void valoraciones
          .evolucion(clienteId)
          .then(
            (valor) => {
              if (!vigente) return
              setEvolucion(valor)
              acierto(AVISO_COMPOSICION)
            },
            () => fallo(AVISO_COMPOSICION),
          )
          .finally(terminarAdicional)
        // No es imprescindible: si falla, simplemente no se enseña la próxima revisión.
        void Promise.resolve()
          .then(() => valoraciones.proximaRevision(clienteId))
          .then(
            (valor) => {
              if (vigente) setProxima(valor)
            },
            () => undefined,
          )
      }
      if (medios) {
        void medios
          .fotosDeCliente(clienteId)
          .then(
            (valor) => {
              if (!vigente) return
              setFotos(valor.fotos)
              acierto(AVISO_FOTOS)
            },
            () => fallo(AVISO_FOTOS),
          )
          .finally(terminarAdicional)
        void medios
          .solicitudes(clienteId)
          .then(
            (valor) => {
              if (!vigente) return
              setSolicitudes(valor.solicitudes)
              acierto(AVISO_SOLICITUDES)
            },
            () => fallo(AVISO_SOLICITUDES),
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
          cargado.current = true
          setError("")
          setDatos({
            configuracion,
            dias: dias.dias,
            medidas,
            fuerza: fuerza.ejercicios,
            pruebas: pruebas.pruebas,
          })
        } catch (causa) {
          // Con datos en pantalla, un fallo al renovar no los sustituye por un error.
          if (vigente && inicial) {
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
                unidad: "kg",
                descripcionGrafica: `Evolución de ${e.nombre}: carga en kg`,
                historial: puntos.map((p) => ({
                  texto: `${fechaLarga(p.fecha)}: ${numero(p.pesoKg)} kg × ${p.repeticiones}`,
                })),
              },
            },
          ]
        })
      : []
    const medidas: Fila[] = []
    const tomas = [...datos.medidas.medidas].sort(fechaOrden)
    // Cada línea del historial lleva su medida: si la tomó el propio cliente, se puede borrar.
    const lineaDeMedida = (m: Medida, texto: string): LineaHistorial => ({
      texto,
      borrar:
        m.autorId === clienteId
          ? { tipo: "medida", id: m.id, resumen: resumenMedida(m) }
          : undefined,
    })
    // Grasa y altura las anota el cliente al añadir una medida: se enseñan aunque la
    // configuración no las nombre, para no pedir un dato que luego no se ve.
    for (const [clave, indicador, campo, nombre, unidad] of [
      ["peso", "peso", "pesoKg", "Peso", "kg"],
      ["cintura", "cintura", "cinturaCm", "Cintura", "cm"],
      ["grasa", null, "grasaPct", "Grasa corporal anotada", "%"],
    ] as const) {
      if (indicador !== null && !activos.has(indicador)) continue
      const conValor = tomas.flatMap((m) =>
        m[campo] === null ? [] : [{ m, fecha: m.fecha, valor: m[campo]! }],
      )
      const puntos = conValor.map(({ fecha, valor }) => ({ fecha, valor }))
      const primero = puntos[0],
        ultimo = puntos.at(-1)
      if (!primero || !ultimo) continue
      medidas.push({
        clave,
        nombre,
        fechaActual: ultimo.fecha,
        texto: `${numero(ultimo.valor)} ${unidad}${puntos.length > 1 ? delta(ultimo.valor - primero.valor, unidad) : ""}`,
        comparativa: {
          id: clave,
          nombre,
          inicial: puntos.length > 1 ? primero.valor : null,
          actual: ultimo.valor,
          unidad,
          descripcion: `medida del ${fechaLarga(ultimo.fecha)}`,
        },
        detalle: {
          titulo: nombre,
          puntos,
          unidad,
          historial: conValor.map(({ m, fecha, valor }) =>
            lineaDeMedida(m, `${fechaLarga(fecha)}: ${numero(valor)} ${unidad}`),
          ),
        },
      })
    }
    const conAltura = tomas.filter((m) => m.alturaCm !== null)
    const ultimaAltura = conAltura.at(-1)
    if (ultimaAltura)
      medidas.push({
        clave: "altura",
        nombre: "Altura",
        fechaActual: ultimaAltura.fecha,
        texto: `${ultimaAltura.alturaCm} cm · ${fechaLarga(ultimaAltura.fecha)}`,
        detalle: {
          titulo: "Altura",
          historial: conAltura.map((m) =>
            lineaDeMedida(m, `${fechaLarga(m.fecha)}: ${m.alturaCm} cm`),
          ),
        },
      })
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
          descripcion: `Valoración publicada del ${fechaLarga(ultimo.fecha)}${repetido ? "" : ` · ${metodo}`}`,
        },
        detalle: {
          titulo: `${serie.nombre} · ${metodo}`,
          puntos: puntos.map(({ fecha, valor }) => ({ fecha, valor })),
          unidad: serie.unidad,
          descripcionGrafica: `Evolución de ${serie.nombre}: ${serie.unidad}, ${metodo}`,
          historial: puntos.map((punto) => ({
            texto: `${fechaLarga(punto.fecha)}: ${numero(punto.valor)} ${serie.unidad}`,
          })),
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
        texto: `${numero(ultimoPesoDiario.valor)} kg · ${fechaLarga(ultimoPesoDiario.fecha)}`,
        comparativa: {
          id: "peso-diario",
          nombre: "Peso diario",
          inicial: serieDiaria && puntosDiarios.length > 1 ? puntosDiarios[0]!.valor : null,
          actual: ultimoPesoDiario.valor,
          unidad: "kg",
          descripcion: `registro diario, ${fechaLarga(ultimoPesoDiario.fecha)}`,
        },
        detalle: {
          titulo: "Peso diario",
          puntos: puntosDiarios,
          unidad: "kg",
          historial: puntosDiarios.map((p) => ({
            texto: `${fechaLarga(p.fecha)}: ${numero(p.valor)} kg`,
          })),
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
          texto: `${numero(ultimo.valor)} ${ultimo.unidad}${grupo.length > 1 ? delta(ultimo.valor - primero.valor, ultimo.unidad) : ""} · ${fechaLarga(ultimo.fecha)}`,
          comparativa: {
            id: clave,
            nombre: ultimo.nombre,
            inicial: grupo.length > 1 ? primero.valor : null,
            actual: ultimo.valor,
            unidad: ultimo.unidad,
            descripcion: fechaLarga(ultimo.fecha),
            representacion: "tramo",
          },
          detalle: {
            titulo: ultimo.nombre,
            historial: grupo.map((p) => ({
              texto: `${fechaLarga(p.fecha)}: ${numero(p.valor)} ${p.unidad}`,
              borrar:
                p.autorId === clienteId
                  ? {
                      tipo: "prueba" as const,
                      id: p.id,
                      resumen: `Prueba ${p.nombre} del ${fechaLarga(p.fecha)}: ${numero(p.valor)} ${p.unidad}`,
                    }
                  : undefined,
            })),
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
  const fotosQueFaltan = pendientes.reduce(
    (total, solicitud) =>
      total +
      solicitud.vistas.filter(
        (vista) =>
          !solicitud.medios.some((foto) => foto.vista === vista && foto.estado === "disponible"),
      ).length,
    0,
  )
  const fechaLimite = pendientes
    .flatMap((solicitud) => (solicitud.fechaLimite === null ? [] : [solicitud.fechaLimite]))
    .sort()[0]
  const textoPendientes =
    fotosQueFaltan > 0
      ? `${fotosQueFaltan} ${fotosQueFaltan === 1 ? "foto" : "fotos"}${fechaLimite ? ` · antes del ${fechaLarga(fechaLimite)}` : ""}`
      : ""
  // El detalle se relee de los datos vivos: si se renuevan o se borra su último registro, se actualiza.
  const detalle: Detalle | null =
    abierto === null
      ? null
      : "especial" in abierto
        ? abierto.especial
        : (secciones.flatMap((seccion) => seccion.data).find((fila) => fila.clave === abierto.clave)
            ?.detalle ?? null)
  const objetivo = datos?.configuracion.indicadores.includes("peso")
    ? datos.configuracion.objetivoPeso
    : null
  const pautaProxima = proxima && !proxima.cumplidaPorId ? proxima.pauta : null
  const cuandoProxima = pautaProxima
    ? pautaProxima.fecha
      ? fechaLarga(pautaProxima.fecha)
      : `Cada ${pautaProxima.intervaloSemanas === 1 ? "semana" : `${pautaProxima.intervaloSemanas} semanas`}`
    : ""
  const abrirValoraciones = (): void =>
    setAbierto({ especial: { titulo: "Valoraciones", valoraciones: true } })
  const cerrarSolicitudes = (): void => {
    cierreProtegido.current?.(() => {
      setSolicitudesMontadas(false)
      recargar()
    })
  }
  // El botón atrás de Android sube un nivel: dentro de una valoración vuelve a su lista.
  const atras = (): void => {
    if (atrasValoraciones.current?.()) return
    setAbierto(null)
  }
  const quitarRegistro = (registro: RegistroBorrable): void =>
    setDatos((actual) =>
      actual === null
        ? actual
        : registro.tipo === "medida"
          ? {
              ...actual,
              medidas: {
                ...actual.medidas,
                medidas: actual.medidas.medidas.filter((m) => m.id !== registro.id),
              },
            }
          : { ...actual, pruebas: actual.pruebas.filter((prueba) => prueba.id !== registro.id) },
    )
  const borrarRegistro = async (): Promise<void> => {
    const registro = aBorrar
    if (!registro || borrandoAhora.current) return
    borrandoAhora.current = true
    setBorrando(true)
    setErrorBorrado("")
    try {
      try {
        if (registro.tipo === "medida") await seguimiento.borrarMedida(clienteId, registro.id)
        else await seguimiento.borrarPrueba(clienteId, registro.id)
      } catch (causa) {
        // 404: ya no existe (otro dispositivo o una respuesta perdida). El resultado es el buscado.
        if (!(causa instanceof ErrorDelServidor && causa.codigo === 404)) throw causa
      }
      quitarRegistro(registro)
      setABorrar(null)
      confirmar("Registro eliminado.")
      recargar()
    } catch (causa) {
      setErrorBorrado(faltaDe(causa, "No se pudo eliminar el registro.").texto)
    } finally {
      borrandoAhora.current = false
      setBorrando(false)
    }
  }

  useEffect(() => {
    if (!abrir) {
      consumido.current = undefined
      return
    }
    if (consumido.current === abrir) return
    if (abrir === "fotos" && medios) setSolicitudesMontadas(true)
    else if (abrir === "valoraciones" && valoraciones)
      setAbierto({ especial: { titulo: "Valoraciones", valoraciones: true } })
    else return
    consumido.current = abrir
    alAbrirActual.current?.()
  }, [abrir, medios, valoraciones])
  useEffect(() => {
    if (confirmacion === null) return
    const plazo = setTimeout(() => setConfirmacion(null), 5000)
    return () => clearTimeout(plazo)
  }, [confirmacion])

  const hayCabecera =
    Boolean(objetivo) || pautaProxima !== null || pendientes.length > 0 || solicitudesMontadas
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
      {!detalle && confirmacion && <Confirmacion texto={confirmacion.texto} />}
      {!datos && !error && (
        <View
          accessible
          accessibilityRole="progressbar"
          accessibilityLabel="Cargando progreso"
          accessibilityState={{ busy: true }}
          style={s.esqueleto}
        >
          <GrupoEsqueletos>
            <Esqueleto alto={168} radio={20} />
            <Esqueleto ancho={120} alto={20} estilo={s.esqueletoTitulo} />
            <Esqueleto alto={76} radio={20} />
            <Esqueleto alto={76} radio={20} />
            <Esqueleto alto={76} radio={20} />
          </GrupoEsqueletos>
        </View>
      )}
      {datos && (
        <SectionList
          sections={secciones}
          initialNumToRender={30}
          keyExtractor={(fila) => fila.clave}
          contentContainerStyle={s.listaPrincipal}
          ListHeaderComponent={
            hayCabecera ? (
              <View>
                {objetivo && (
                  <View
                    accessible
                    accessibilityLabel={`Objetivo de peso: ${textoObjetivo(objetivo)}`}
                    style={s.fila}
                  >
                    <Text style={s.etiquetaDato}>Objetivo de peso</Text>
                    <Text style={s.nombre}>{textoObjetivo(objetivo)}</Text>
                  </View>
                )}
                {pautaProxima &&
                  (valoraciones ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Próxima revisión: ${cuandoProxima}. Ver valoraciones`}
                      onPress={abrirValoraciones}
                      style={s.fila}
                    >
                      <Text style={s.etiquetaDato}>Próxima revisión</Text>
                      <Text style={s.nombre}>{cuandoProxima}</Text>
                    </Pressable>
                  ) : (
                    <View
                      accessible
                      accessibilityLabel={`Próxima revisión: ${cuandoProxima}`}
                      style={s.fila}
                    >
                      <Text style={s.etiquetaDato}>Próxima revisión</Text>
                      <Text style={s.nombre}>{cuandoProxima}</Text>
                    </View>
                  ))}
                {(pendientes.length > 0 || solicitudesMontadas) && (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={
                      textoPendientes
                        ? `Fotos pendientes: ${textoPendientes.replace(" · ", ", ")}`
                        : "Fotos pendientes"
                    }
                    onPress={() => {
                      setSolicitudesMontadas(true)
                    }}
                    style={s.fila}
                  >
                    <Text style={s.nombre}>Fotos pendientes</Text>
                    {textoPendientes !== "" && <Text style={s.texto}>{textoPendientes}</Text>}
                  </Pressable>
                )}
              </View>
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
                <BotonSecundario texto="Ver valoraciones" onPress={abrirValoraciones} />
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
                    abrirGaleria={() => setAbierto({ especial: { titulo: "Fotos", fotos: true } })}
                  />
                ) : (
                  <BotonSecundario
                    texto="Ver galería"
                    etiquetaAccesible="Ver galería de fotos"
                    onPress={() => setAbierto({ especial: { titulo: "Fotos", fotos: true } })}
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
                  alPulsar={item.detalle ? () => setAbierto({ clave: item.clave }) : undefined}
                />
              </View>
            ) : item.comparativa ? (
              <FilaComparativa
                fila={{
                  ...item.comparativa,
                  alPulsar: item.detalle ? () => setAbierto({ clave: item.clave }) : undefined,
                }}
                posicion={posicionEnTarjeta(section.data, index)}
              />
            ) : item.detalle ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${item.nombre}, ${item.texto}`}
                onPress={() => setAbierto({ clave: item.clave })}
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
        <Modal visible animationType="none" onRequestClose={atras}>
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
                      onPress={() => setAbierto(null)}
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
                      {fechaLarga(foto.fechaToma)}
                    </Text>
                    <ImagenPrivada
                      medioId={foto.id}
                      etiqueta={`${nombreDePose(foto)}, ${fechaLarga(foto.fechaToma)}`}
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
                  onPress={() => setAbierto(null)}
                  style={s.fila}
                >
                  <Text style={s.nombre}>Volver</Text>
                </Pressable>
                {confirmacion && <Confirmacion texto={confirmacion.texto} />}
                <Text accessibilityRole="header" style={s.titulo}>
                  {detalle.titulo}
                </Text>
                {detalle.puntos && detalle.puntos.length > 1 && (
                  <Grafica
                    puntos={detalle.puntos}
                    tendencia={detalle.puntos}
                    unidad={detalle.unidad}
                    descripcion={
                      detalle.unidad
                        ? etiquetaGrafica(
                            detalle.descripcionGrafica ?? `Evolución de ${detalle.titulo}`,
                            detalle.puntos,
                            detalle.unidad,
                          )
                        : (detalle.descripcionGrafica ?? `Evolución de ${detalle.titulo}`)
                    }
                    izquierda={fechaLarga(detalle.puntos[0]!.fecha)}
                    derecha={fechaLarga(detalle.puntos[detalle.puntos.length - 1]!.fecha)}
                  />
                )}
                {detalle.historial?.map((h, i) => (
                  <View key={`${i}-${h.texto}`} style={s.lineaHistorial}>
                    <Text style={[s.texto, s.textoHistorial]}>{h.texto}</Text>
                    {h.borrar && (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Eliminar el registro del ${h.texto}`}
                        onPress={() => {
                          setErrorBorrado("")
                          setABorrar(h.borrar!)
                        }}
                        style={s.eliminar}
                      >
                        <Text style={s.textoEliminar}>Eliminar</Text>
                      </Pressable>
                    )}
                  </View>
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
                  <ValoracionesCliente
                    clienteId={clienteId}
                    api={valoraciones}
                    registrarAtras={registrarAtras}
                  />
                )}
              </ScrollView>
            )}
            <Dialogo
              visible={aBorrar !== null}
              titulo="¿Eliminar este registro?"
              texto={`${aBorrar?.resumen ?? ""}. Dejará de verlo también tu equipo. Si solo te equivocaste, elimínalo y añade el correcto. No se puede deshacer.`}
              confirmar={borrando ? "Eliminando…" : "Eliminar"}
              cancelar="Cancelar"
              peligro
              ocupado={borrando}
              alCancelar={() => setABorrar(null)}
              alConfirmar={() => void borrarRegistro()}
            >
              {errorBorrado !== "" && <AvisoDeError mensaje={errorBorrado} />}
            </Dialogo>
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
          const nueva = await seguimiento.registrarMedida(clienteId, medida)
          if (nueva)
            setDatos((actual) =>
              actual === null
                ? actual
                : {
                    ...actual,
                    medidas: {
                      ...actual.medidas,
                      medidas: [...actual.medidas.medidas.filter((m) => m.id !== nueva.id), nueva],
                    },
                  },
            )
          confirmar("Medida guardada.")
          recargar()
        }}
      />
      <AnadirPrueba
        visible={formulario === "prueba"}
        cerrar={() => setFormulario(null)}
        pruebas={datos?.configuracion.pruebasPrescritas ?? []}
        registrar={async (prueba) => {
          const nueva = await seguimiento.registrarPrueba(clienteId, prueba)
          if (nueva)
            setDatos((actual) =>
              actual === null
                ? actual
                : {
                    ...actual,
                    pruebas: [...actual.pruebas.filter((p) => p.id !== nueva.id), nueva],
                  },
            )
          confirmar("Prueba guardada.")
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
  esqueleto: { gap: 12, padding: 20 },
  esqueletoTitulo: { marginTop: 12 },
  confirmacion: {
    marginHorizontal: 20,
    marginTop: 8,
    padding: 12,
    borderRadius: 14,
    backgroundColor: tema.exitoFila,
    borderWidth: 1,
    borderColor: tema.exitoBorde,
  },
  textoConfirmacion: { ...tipo.cuerpo, color: tema.exito },
  etiquetaDato: { ...tipo.micro, color: tema.textoTenue },
  lineaHistorial: { flexDirection: "row", alignItems: "center", gap: 12 },
  textoHistorial: { flex: 1 },
  eliminar: { minHeight: 44, minWidth: 44, justifyContent: "center", alignItems: "flex-end" },
  textoEliminar: { ...tipo.secundario, color: tema.error, fontFamily: tema.fuenteBoton },
  titulo: { ...tipo.titulo, color: tema.texto },
  fila: { minHeight: 52, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: tema.borde },
  nombre: { ...tipo.fila, color: tema.texto },
  texto: { ...tipo.cuerpo, color: tema.textoSecundario },
  favorable: { color: tema.exito },
  desfavorable: { color: tema.aviso },
})
