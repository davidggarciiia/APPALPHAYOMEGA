import { useEffect, useRef, useState } from "react"
import { usePreventRemove } from "expo-router/react-navigation"
import {
  Modal,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native"
import { z } from "zod"
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg"
import {
  aplicarAjustesDeFase,
  faseDeSemana,
  AsignarPlanSchema,
  FechaAgendaSchema,
  type AsignarPlan,
  type Bloque,
  type DeporteDelPlan,
  type FaseDeBloque,
  type PatronRutina,
  type Prescripcion,
  type RutinaGuardada,
  type SeccionDeSesion,
} from "@alpha-omega/shared"

import type { ApiDeCatalogo } from "../../catalogo-ejercicios/api"
import { useAccesoAFiguras } from "../../catalogo-ejercicios/figura-ejercicio"
import {
  AvisoDeError,
  BotonEnlace,
  BotonPrincipal,
  BotonSecundario,
} from "../../componentes/formulario"
import type { AlmacenLocal } from "../../entrenamiento/almacen-local"
import { almacenDispositivo } from "../../entrenamiento/almacen-dispositivo"
import type { ApiEntrenamiento } from "../../entrenamiento/api"
import { lunesDeSemana, sumarDias } from "../../entrenamiento/fechas"
import { fechaCorta, INICIALES_DE_DIA, NOMBRES_DE_DIA } from "../../entrenamiento/plan/modelo"
import { textoDeAjustes } from "../../entrenamiento/plan/ajustes-fase"
import { Pestanas, Titulo } from "../../entrenamiento/plan/piezas"
import { RutinaDeLaSemana, type DiaDelPlan } from "../../entrenamiento/plan/rutina"
import { BotonAtras, Dialogo, Enlace } from "../../entrenamiento/sesion/controles"
import { VerTecnica } from "../../entrenamiento/ver-tecnica"
import { AvisoDeshacer } from "../../componentes/aviso-deshacer"
import { Esqueleto, GrupoEsqueletos } from "../../componentes/esqueleto"
import { Hoja } from "../../componentes/hoja"
import { EntradaMarca } from "../../componentes/entrada-marca"
import { useMovimientoReducido } from "../../componentes/movimiento"
import { ErrorDePeticion, ErrorDePermiso, ErrorDelServidor } from "../../lib/http"
import { conRecursoLocalExclusivo } from "../../lib/candado-local"
import { useEnvioUnico } from "../../lib/envio-unico"
import { tema } from "../../tema"
import type { ApiRutinas } from "../api-rutinas"
import { ListadoDeRutinas } from "../listado-rutinas"
import { SelectorEjercicios } from "../selector-ejercicios"
import {
  aSesionEnRutina,
  desdeSesionEnRutina,
  faltaEnDia,
  nuevoDia,
  nuevoEjercicio,
  resumenDeSeccion,
  type DiaDelConstructor,
  type EjercicioDelConstructor,
} from "./modelo"
import { EditorDeBloque, ListaDeSeccion } from "./partes"
import { PanelEjercicio, pautaDeFila, TablaPrincipal } from "./tabla"
import { errorDeValidacion } from "./validacion"
import { AjustePrescripcion, type CampoPrescripcion } from "./ajuste-prescripcion"

/** La misma clave que el editor anterior: una asignación pendiente se recupera en ambos. */
const PendienteSchema = z.strictObject({
  solicitud: AsignarPlanSchema,
  nombres: z.record(z.string(), z.string()),
})

const esDia = (d: unknown): boolean =>
  typeof d === "object" &&
  d !== null &&
  typeof (d as DiaDelConstructor).id === "string" &&
  Array.isArray((d as DiaDelConstructor).ejercicios)

/**
 * El plan a medias, copiado al dispositivo mientras se edita: Android mata el
 * proceso en segundo plano y lo montado vivía solo en memoria. La versión permite
 * descartar una copia de otra forma de la app en lugar de romper al recuperarla.
 */
const BorradorSchema = z.object({
  v: z.literal(1),
  nombre: z.string(),
  semanaInicial: z.string(),
  semanas: z.string(),
  dias: z.array(z.custom<DiaDelConstructor>(esDia)).min(1),
  bloque: z.custom<Bloque>((b) => typeof b === "object" && b !== null),
})
type Borrador = z.infer<typeof BorradorSchema>

const SECCIONES: Array<{ seccion: SeccionDeSesion; titulo: string }> = [
  { seccion: "calentamiento", titulo: "Calentamiento" },
  { seccion: "principal", titulo: "Parte principal" },
  { seccion: "circuito", titulo: "Circuito" },
  { seccion: "final", titulo: "Vuelta a la calma" },
]

const BLOQUE_VACIO: Bloque = { objetivos: [], fases: [], deportes: [], notas: [] }

type Retirada =
  | { tipo: "ejercicio"; indice: number; elemento: EjercicioDelConstructor; diaId: string }
  | { tipo: "fase"; indice: number; elemento: FaseDeBloque }
  | { tipo: "deporte"; indice: number; elemento: DeporteDelPlan }

type LugarDelMensaje = "cabecera" | "plantilla" | "pie"

function tieneBloque(bloque: Bloque): boolean {
  return (
    bloque.objetivos.length + bloque.fases.length + bloque.deportes.length + bloque.notas.length >
      0 || bloque.pasosDiarios !== undefined
  )
}

async function cargarPatron(
  patron: PatronRutina,
  catalogo: ApiDeCatalogo,
): Promise<{ dias: DiaDelConstructor[]; retirados: string[] }> {
  const ids = [...new Set(patron.sesiones.flatMap((s) => s.ejercicios.map((e) => e.ejercicioId)))]
  const fichas = []
  for (let n = 0; n < ids.length; n += 10)
    fichas.push(...(await Promise.all(ids.slice(n, n + 10).map((id) => catalogo.leer(id)))))
  const nombres = Object.fromEntries(fichas.map((e) => [e.id, e.nombre]))
  return {
    dias: patron.sesiones.map((s) => desdeSesionEnRutina(s, nombres)),
    retirados: fichas.filter((e) => e.estado === "retirado").map((e) => e.nombre),
  }
}

/** El plan como lo verá el cliente en «Tu plan», para «Ver como cliente». */
function vistaDelCliente(
  dias: DiaDelConstructor[],
  semanaInicial: string,
  clienteId: string,
  nuevoId: () => string,
  fase?: FaseDeBloque,
): DiaDelPlan[] {
  return [...dias]
    .sort((a, b) => a.diaSemana - b.diaSemana)
    .flatMap((dia): DiaDelPlan[] => {
      if (faltaEnDia(dia)) return []
      const sesion = aSesionEnRutina(dia, nuevoId)
      const nombres = new Map(dia.ejercicios.map((e) => [e.id, e.nombre]))
      const fecha = sumarDias(semanaInicial, dia.diaSemana - 1)
      const prescripcion: Prescripcion = {
        nombre: sesion.nombre,
        ...(sesion.duracion && { duracion: sesion.duracion }),
        ...(sesion.nota && { nota: sesion.nota }),
        ...(sesion.partes && { partes: sesion.partes }),
        ...(sesion.circuito && { circuito: sesion.circuito }),
        ejercicios: sesion.ejercicios.map((e) => ({
          ...e,
          nombre: nombres.get(e.id) ?? "Ejercicio",
        })),
      }
      return [
        {
          resumen: {
            agenda: {
              id: dia.id,
              clienteId,
              fechaOriginal: fecha,
              fechaActual: fecha,
              estado: "abierta",
              revision: 0,
            },
            nombre: sesion.nombre,
            enviadoEn: null,
          },
          prescripcion: aplicarAjustesDeFase(prescripcion, fase?.ajustes),
        },
      ]
    })
}

function escapar(texto: string): string {
  return texto.replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!,
  )
}

/** «Exportar PDF» en la web: una página limpia que el navegador imprime o guarda como PDF. */
function exportarPdf(nombre: string, cliente: string, dias: DiaDelConstructor[]): void {
  const filas = (ejercicios: EjercicioDelConstructor[]): string =>
    ejercicios
      .map(
        (e) =>
          `<tr><td>${escapar(e.nombre)}</td><td>${escapar(pautaDeFila(e))}</td><td>${escapar(e.rir)}</td><td>${escapar(e.descanso)}</td><td>${e.calibrar ? "Calibrar" : escapar(e.carga ? `${e.carga} kg` : "")}</td><td>${escapar(e.subida ? `${e.subida} kg` : "")}</td></tr>`,
      )
      .join("")
  const secciones = (dia: DiaDelConstructor): string => {
    const tiempos: Record<SeccionDeSesion, string> = {
      calentamiento: dia.partes.calentamiento,
      principal: dia.partes.fuerza,
      circuito: dia.partes.cardio,
      final: dia.partes.calma,
    }
    return SECCIONES.map(({ seccion, titulo }) => {
      const ejercicios = dia.ejercicios.filter((e) => e.seccion === seccion)
      const tiempo = tiempos[seccion].trim()
      if (ejercicios.length === 0 && tiempo === "") return ""
      const nombre =
        seccion === "circuito" && dia.circuito.nombre
          ? `${titulo} · ${dia.circuito.nombre}`
          : titulo
      return `<h3>${escapar(nombre)}</h3>${tiempo ? `<p>Duración: ${escapar(tiempo)} min</p>` : ""}${seccion === "circuito" ? `<p>${escapar(resumenDeSeccion(dia, seccion))}</p>` : ""}<table><tr><th>Ejercicio</th><th>Pauta</th><th>RIR</th><th>Descanso</th><th>Carga inicial</th><th>Subida</th></tr>${filas(ejercicios)}</table>`
    }).join("")
  }
  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${escapar(nombre)}</title><style>body{font-family:Arial,sans-serif;margin:32px;color:#111}h1{margin:0 0 4px}h2{margin:28px 0 8px}p{color:#555;margin:0}table{border-collapse:collapse;width:100%;margin-top:8px}td,th{border-bottom:1px solid #ddd;padding:6px 8px;text-align:left;font-size:13px}th{color:#666}</style></head><body><h1>${escapar(nombre)}</h1><p>${escapar(cliente)}</p>${[
    ...dias,
  ]
    .sort((a, b) => a.diaSemana - b.diaSemana)
    .map(
      (d) =>
        `<h2>${escapar(`${NOMBRES_DE_DIA[d.diaSemana - 1]} · ${d.nombre}`)}</h2>${d.duracion ? `<p>Duración estimada ${escapar(d.duracion)}</p>` : ""}${secciones(d)}`,
    )
    .join("")}</body></html>`
  const ventana = window.open("", "_blank")
  if (!ventana) return
  ventana.document.write(html)
  ventana.document.close()
  ventana.focus()
  ventana.print()
}

/**
 * Constructor de planes del diseño: bloque y fases, días, otros deportes, cada
 * parte de la sesión con su tabla, el panel del ejercicio, «Ver como cliente»,
 * «Exportar PDF», «Guardar como plantilla» y «Publicar».
 */
export function ConstructorPlan({
  clienteId,
  cuentaId,
  nombreCliente,
  almacen,
  api,
  catalogo,
  rutinas,
  nuevoId,
  terminado,
  volver,
}: {
  clienteId: string
  cuentaId: string
  nombreCliente: string
  almacen: AlmacenLocal
  api: ApiEntrenamiento
  catalogo: ApiDeCatalogo
  rutinas: ApiRutinas
  nuevoId: () => string
  terminado: () => void
  volver: () => void
}): React.JSX.Element {
  const { width } = useWindowDimensions()
  const reducido = useMovimientoReducido()
  const ancho = width >= 1000
  const acceso = useAccesoAFiguras()
  const [nombre, setNombre] = useState("")
  const [semanaInicial, setSemanaInicial] = useState(() => sumarDias(lunesDeSemana(), 7))
  const [semanas, setSemanas] = useState("6")
  const [dias, setDias] = useState<DiaDelConstructor[]>(() => [nuevoDia(nuevoId, 1)])
  const [activo, setActivo] = useState<string>(() => dias[0]!.id)
  const [bloque, setBloque] = useState<Bloque>(BLOQUE_VACIO)
  const [elegido, setElegido] = useState<string | null>(null)
  const [hojaEjercicio, setHojaEjercicio] = useState(false)
  const [datosBloque, setDatosBloque] = useState(false)
  const [datosDia, setDatosDia] = useState(false)
  const [ajustando, setAjustando] = useState<{ id: string; campo: CampoPrescripcion } | null>(null)
  const [ajusteValido, setAjusteValido] = useState(true)
  const [anadiendo, setAnadiendo] = useState<SeccionDeSesion | null>(null)
  const [plantillas, setPlantillas] = useState(false)
  /** Plantilla elegida sobre un plan ya empezado: se pregunta antes de sustituirlo. */
  const [sustituyendoPor, setSustituyendoPor] = useState<RutinaGuardada | null>(null)
  /** «Quitar día» con ejercicios: elimina todo lo del día, así que se pregunta antes. */
  const [quitandoDia, setQuitandoDia] = useState(false)
  const [retirada, setRetirada] = useState<Retirada | null>(null)
  const retiradaId = useRef(0)
  const retiradaInicio = useRef(0)
  const retiradaDeshecha = useRef<Retirada | null>(null)
  const [comoCliente, setComoCliente] = useState(false)
  const [semanaVista, setSemanaVista] = useState("1")
  const [diaVista, setDiaVista] = useState<string | null>(null)
  const [confirmando, setConfirmando] = useState<AsignarPlan | null>(null)
  const [tecnica, setTecnica] = useState<EjercicioDelConstructor | null>(null)
  const [error, setError] = useState("")
  const [aviso, setAviso] = useState("")
  const [lugarDelMensaje, setLugarDelMensaje] = useState<LugarDelMensaje>("cabecera")
  const [guardandoPlantilla, setGuardandoPlantilla] = useState(false)
  const [ocupado, setOcupado] = useState(false)
  const [pendiente, setPendiente] = useState<AsignarPlan | null>(null)
  const [recuperado, setRecuperado] = useState(false)
  const [errorRecuperacion, setErrorRecuperacion] = useState("")
  const [intentoRecuperacion, setIntentoRecuperacion] = useState(0)
  const [saliendo, setSaliendo] = useState(false)
  const [salidaAutorizada, setSalidaAutorizada] = useState(false)
  const salida = useRef<(() => void) | null>(null)
  const versionInicial = useRef({ nombre, semanaInicial, semanas, dias, bloque })
  // Las listas se actualizan de forma inmutable: sus referencias detectan cambios sin serializarlas.
  const sinCambios =
    nombre === versionInicial.current.nombre &&
    semanaInicial === versionInicial.current.semanaInicial &&
    semanas === versionInicial.current.semanas &&
    dias === versionInicial.current.dias &&
    bloque === versionInicial.current.bloque
  const enCurso = useRef(false)
  const clave = `plan-${clienteId}`
  const claveBorrador = `borrador-plan-${clienteId}`
  /** Copia de una sesión anterior pendiente de decidir: recuperarla o empezar de cero. */
  const [borrador, setBorrador] = useState<Borrador | null>(null)
  const sinGuardar = pendiente === null && !sinCambios && !salidaAutorizada

  useEffect(() => {
    if (!retirada) return
    const id = setTimeout(() => setRetirada(null), 5000)
    return () => clearTimeout(id)
  }, [retirada])

  usePreventRemove(sinGuardar, ({ repeat }) => {
    salida.current = repeat
    setSaliendo(true)
  })
  useEffect(() => {
    if (Platform.OS !== "web" || !sinGuardar) return
    const impedir = (evento: BeforeUnloadEvent): void => {
      evento.preventDefault()
      evento.returnValue = ""
    }
    globalThis.addEventListener("beforeunload", impedir)
    return () => globalThis.removeEventListener("beforeunload", impedir)
  }, [sinGuardar])
  useEffect(() => {
    if (!salidaAutorizada) return
    const continuar = salida.current
    salida.current = null
    continuar?.()
  }, [salidaAutorizada])
  const pedirSalida = (): void => {
    if (sinCambios) volver()
    else {
      salida.current = volver
      setSaliendo(true)
    }
  }

  // Una asignación que no llegó a confirmarse se recupera con su misma operación.
  useEffect(() => {
    let vigente = true
    setRecuperado(false)
    setErrorRecuperacion("")
    void almacen
      .leer(cuentaId, clave, PendienteSchema)
      .then((guardado) => {
        if (!vigente) return
        setRecuperado(true)
        if (!guardado) {
          // Sin publicación pendiente: puede haber un plan a medias de antes de que se cerrase la app.
          void almacen
            .leer(cuentaId, claveBorrador, BorradorSchema)
            .then((copia) => {
              if (vigente && copia) setBorrador(copia)
            })
            .catch(() => undefined)
          return
        }
        const { solicitud, nombres } = guardado
        const recuperados = solicitud.patron.sesiones.map((s) => desdeSesionEnRutina(s, nombres))
        setNombre(solicitud.nombre)
        setSemanaInicial(solicitud.semanaInicial)
        setSemanas(String(solicitud.semanas))
        setDias(recuperados)
        setActivo(recuperados[0]?.id ?? "")
        setBloque(solicitud.bloque ?? BLOQUE_VACIO)
        setPendiente(solicitud)
        setAviso("Hay una publicación sin confirmar: reintenta y no se duplicará.")
      })
      .catch(() => {
        if (vigente)
          setErrorRecuperacion(
            "No se pudo recuperar la publicación pendiente. Reintenta antes de crear otro plan.",
          )
      })
    return () => {
      vigente = false
    }
  }, [almacen, cuentaId, clave, claveBorrador, intentoRecuperacion])

  // Autoguardado: sin esperar a «Publicar». Mientras haya una copia anterior sin decidir
  // no se pisa, para que no se pierda si el entrenador cierra sin recuperarla.
  useEffect(() => {
    if (!recuperado || pendiente !== null || salidaAutorizada || borrador !== null || sinCambios)
      return
    const id = setTimeout(() => {
      void almacen
        .guardar(cuentaId, claveBorrador, { v: 1, nombre, semanaInicial, semanas, dias, bloque })
        .catch(() => undefined)
    }, 800)
    return () => clearTimeout(id)
  }, [
    nombre,
    semanaInicial,
    semanas,
    dias,
    bloque,
    sinCambios,
    recuperado,
    pendiente,
    salidaAutorizada,
    borrador,
  ])
  // Se publique o se descarte, el borrador ya no tiene objeto.
  useEffect(() => {
    if (salidaAutorizada) void almacen.borrar(cuentaId, claveBorrador).catch(() => undefined)
  }, [salidaAutorizada])
  const recuperarBorrador = (copia: Borrador): void => {
    setRetirada(null)
    setNombre(copia.nombre)
    setSemanaInicial(copia.semanaInicial)
    setSemanas(copia.semanas)
    setDias(copia.dias)
    setActivo(copia.dias[0]!.id)
    setBloque(copia.bloque)
    setBorrador(null)
  }
  const descartarBorrador = (): void => {
    void almacen.borrar(cuentaId, claveBorrador).catch(() => undefined)
    setBorrador(null)
  }

  const dia = dias.find((d) => d.id === activo) ?? dias[0]!
  const cambiarDia = (cambio: Partial<DiaDelConstructor>): void =>
    setDias((todos) => todos.map((d) => (d.id === dia.id ? { ...d, ...cambio } : d)))
  const cambiarEjercicio = (id: string, cambio: Partial<EjercicioDelConstructor>): void =>
    cambiarDia({ ejercicios: dia.ejercicios.map((e) => (e.id === id ? { ...e, ...cambio } : e)) })
  const quitarDia = (): void => {
    setRetirada(null)
    setAjustando(null)
    setHojaEjercicio(false)
    const resto = dias.filter((d) => d.id !== dia.id)
    setDias(resto)
    setActivo(resto[0]!.id)
  }
  const quitar = (id: string): void => {
    const indice = dia.ejercicios.findIndex((e) => e.id === id)
    const elemento = dia.ejercicios[indice]
    if (!elemento) return
    retiradaId.current++
    retiradaInicio.current = Date.now()
    setRetirada({ tipo: "ejercicio", indice, elemento, diaId: dia.id })
    cambiarDia({ ejercicios: dia.ejercicios.filter((e) => e.id !== id) })
    if (elegido === id) setElegido(null)
    setAjustando(null)
  }
  const quitarFase = (indice: number): void => {
    retiradaId.current++
    retiradaInicio.current = Date.now()
    const elemento = bloque.fases[indice]!
    setRetirada(
      elemento.nombre.trim() || elemento.detalle?.trim() || elemento.ajustes !== undefined
        ? { tipo: "fase", indice, elemento }
        : null,
    )
    setBloque((actual) => ({ ...actual, fases: actual.fases.filter((_, n) => n !== indice) }))
  }
  const quitarDeporte = (indice: number): void => {
    retiradaId.current++
    retiradaInicio.current = Date.now()
    const elemento = bloque.deportes[indice]!
    setRetirada(elemento.nombre.trim() ? { tipo: "deporte", indice, elemento } : null)
    setBloque((actual) => ({ ...actual, deportes: actual.deportes.filter((_, n) => n !== indice) }))
  }
  const deshacer = (): void => {
    if (!retirada || retiradaDeshecha.current === retirada) return
    retiradaDeshecha.current = retirada
    const { indice } = retirada
    // Insertar en el estado actual conserva lo editado desde la retirada.
    if (retirada.tipo === "ejercicio") {
      const ejercicio = retirada.elemento
      setDias((actuales) =>
        actuales.map((d) =>
          d.id === retirada.diaId
            ? {
                ...d,
                ejercicios: [
                  ...d.ejercicios.slice(0, indice),
                  ejercicio,
                  ...d.ejercicios.slice(indice),
                ],
              }
            : d,
        ),
      )
    } else if (retirada.tipo === "fase") {
      const fase = retirada.elemento
      setBloque((actual) => ({
        ...actual,
        fases: [...actual.fases.slice(0, indice), fase, ...actual.fases.slice(indice)],
      }))
    } else {
      const deporte = retirada.elemento
      setBloque((actual) => ({
        ...actual,
        deportes: [...actual.deportes.slice(0, indice), deporte, ...actual.deportes.slice(indice)],
      }))
    }
    setRetirada(null)
  }
  const barraDeshacer = retirada && (
    <AvisoDeshacer
      key={retiradaId.current}
      mensaje={
        retirada.tipo === "fase"
          ? `Fase «${retirada.elemento.nombre || "Sin nombre"}» quitada`
          : `${retirada.elemento.nombre} quitado`
      }
      alDeshacer={deshacer}
      id={retiradaId.current}
      iniciadoEn={retiradaInicio.current}
      alExpirar={() => setRetirada(null)}
      animar={!ajustando && !datosBloque && !hojaEjercicio}
    />
  )
  const mover = (id: string, desplazamiento: number): void => {
    const lista = [...dia.ejercicios]
    const i = lista.findIndex((e) => e.id === id)
    const seccion = lista[i]?.seccion
    let j = i + desplazamiento
    while (j >= 0 && j < lista.length && lista[j]!.seccion !== seccion) j += desplazamiento
    if (i < 0 || j < 0 || j >= lista.length) return
    ;[lista[i], lista[j]] = [lista[j]!, lista[i]!]
    cambiarDia({ ejercicios: lista })
  }
  const ejercicioElegido = dia.ejercicios.find((e) => e.id === elegido) ?? null
  const ejercicioAjustado = dia.ejercicios.find((e) => e.id === ajustando?.id) ?? null
  const abrirEjercicio = (id: string): void => {
    setAjustando(null)
    setElegido(id)
    setHojaEjercicio(true)
  }

  const sesionesDelPlan = (): AsignarPlan["patron"]["sesiones"] =>
    dias.map((d) => {
      try {
        return aSesionEnRutina(d, nuevoId)
      } catch (fallo) {
        setActivo(d.id)
        if (fallo instanceof z.ZodError) {
          const ruta = fallo.issues[0]?.path ?? []
          const indice = ruta[0] === "ejercicios" && typeof ruta[1] === "number" ? ruta[1] : null
          const ejercicio = indice === null ? undefined : d.ejercicios[indice]
          setElegido(ejercicio?.id ?? null)
          const errorDelCampo = new z.ZodError(
            fallo.issues.map((issue) => ({
              ...issue,
              path: ejercicio ? issue.path.slice(2) : issue.path,
            })),
          )
          throw new Error(
            `${NOMBRES_DE_DIA[d.diaSemana - 1]} · ${d.nombre || "Sin nombre"}${ejercicio ? ` · ${ejercicio.nombre}` : ""} · ${errorDeValidacion(errorDelCampo)}`,
          )
        }
        throw new Error(
          `${NOMBRES_DE_DIA[d.diaSemana - 1]} · ${d.nombre || "Sin nombre"}: ${fallo instanceof Error ? fallo.message : "Revisa este día."}`,
        )
      }
    })

  const construir = (operacionId: string): AsignarPlan => {
    const sesiones = sesionesDelPlan()
    const repetidos = sesiones.map((s) => s.diaSemana)
    if (new Set(repetidos).size !== repetidos.length)
      throw new Error("Hay dos días en el mismo día de la semana.")
    return AsignarPlanSchema.parse({
      operacionId,
      nombre: nombre.trim() || sesiones[0]!.nombre,
      semanaInicial,
      semanas: Number(semanas),
      patron: { sesiones },
      ...(tieneBloque(bloque) && { bloque }),
    })
  }

  const preparar = (lugar: LugarDelMensaje = "cabecera"): void => {
    if (!ajusteValido) return
    setAjustando(null)
    setLugarDelMensaje(lugar)
    setError("")
    try {
      setConfirmando(pendiente ?? construir(nuevoId()))
    } catch (e) {
      setError(
        e instanceof z.ZodError
          ? errorDeValidacion(e)
          : e instanceof Error
            ? e.message
            : "Revisa el plan.",
      )
    }
  }

  const previsualizar = (): void => {
    if (!ajusteValido) return
    setAjustando(null)
    setLugarDelMensaje("cabecera")
    try {
      construir(nuevoId())
      setSemanaVista("1")
      setDiaVista(null)
      setComoCliente(true)
      setError("")
    } catch {
      setError("Revisa el plan antes de previsualizar: el lunes y los objetivos deben ser válidos.")
    }
  }

  const publicar = async (solicitud: AsignarPlan): Promise<void> => {
    if (enCurso.current) return
    enCurso.current = true
    setOcupado(true)
    setError("")
    try {
      await conRecursoLocalExclusivo(`ao-publicacion-${cuentaId}-${clienteId}`, async () => {
        const guardado = await almacen.leer(cuentaId, clave, PendienteSchema)
        if (guardado && guardado.solicitud.operacionId !== solicitud.operacionId) {
          setPendiente(guardado.solicitud)
          setConfirmando(null)
          setError("Hay otra publicación pendiente. Confirma el plan guardado antes de crear otro.")
          return
        }
        await almacen.guardar(cuentaId, clave, {
          solicitud,
          nombres: Object.fromEntries(
            dias.flatMap((d) => d.ejercicios.map((e) => [e.ejercicioId, e.nombre])),
          ),
        })
        setPendiente(solicitud)
        await api.asignar(clienteId, solicitud)
        await almacen.borrar(cuentaId, clave)
        setConfirmando(null)
        salida.current = terminado
        setSalidaAutorizada(true)
      })
    } catch (fallo) {
      setConfirmando(null)
      setError(
        fallo instanceof ErrorDePeticion
          ? fallo.message
          : "No se pudo confirmar la publicación. Reintenta: se conserva la misma operación para no duplicarla.",
      )
      if (
        fallo instanceof ErrorDePermiso ||
        (fallo instanceof ErrorDelServidor &&
          fallo.codigo >= 400 &&
          fallo.codigo < 500 &&
          fallo.codigo !== 401)
      ) {
        try {
          await almacen.borrar(cuentaId, clave)
          setPendiente(null)
        } catch {
          setError("No se pudo limpiar la publicación pendiente. Reintenta antes de editar.")
        }
      }
    } finally {
      enCurso.current = false
      setOcupado(false)
    }
  }

  const guardarPlantilla = useEnvioUnico(async (): Promise<void> => {
    if (!ajusteValido) return
    setLugarDelMensaje("plantilla")
    setGuardandoPlantilla(true)
    setError("")
    setAviso("")
    try {
      const sesiones = sesionesDelPlan()
      await rutinas.crear({ nombre: nombre.trim() || sesiones[0]!.nombre, patron: { sesiones } })
      setAviso("Guardado como plantilla en Rutinas.")
    } catch (e) {
      setError(
        e instanceof Error && !(e instanceof z.ZodError)
          ? e.message
          : "No se pudo guardar la plantilla.",
      )
    } finally {
      setGuardandoPlantilla(false)
    }
  })

  const elegirPlantilla = async (rutina: RutinaGuardada): Promise<void> => {
    setLugarDelMensaje("cabecera")
    setOcupado(true)
    setError("")
    try {
      const { dias: cargados, retirados } = await cargarPatron(rutina.patron, catalogo)
      setDias(cargados)
      setRetirada(null)
      setActivo(cargados[0]?.id ?? "")
      setNombre(rutina.nombre)
      setPlantillas(false)
      setDatosBloque(false)
      if (retirados.length > 0)
        setError(`Sustituye los ejercicios retirados antes de publicar: ${retirados.join(", ")}`)
    } catch {
      setError("No se pudo cargar la rutina. Reintenta con conexión.")
    } finally {
      setOcupado(false)
    }
  }

  const libres = [1, 2, 3, 4, 5, 6, 7].filter((n) => !dias.some((d) => d.diaSemana === n))
  const seccionesVisibles = SECCIONES.filter(
    (s) =>
      s.seccion === "principal" ||
      dia.ejercicios.some((e) => e.seccion === s.seccion) ||
      (retirada?.tipo === "ejercicio" &&
        retirada.diaId === dia.id &&
        retirada.elemento.seccion === s.seccion) ||
      anadiendo === s.seccion,
  )
  const faltan = SECCIONES.filter((s) => !seccionesVisibles.includes(s))

  const panel = ejercicioElegido !== null && (
    <PanelEjercicio
      key={ejercicioElegido.id}
      ejercicio={ejercicioElegido}
      nombreCliente={nombreCliente}
      cambiar={cambiarEjercicio}
      verTecnica={() => {
        setHojaEjercicio(false)
        setTecnica(ejercicioElegido)
      }}
      alListo={() => setHojaEjercicio(false)}
      alCambiarValidez={setAjusteValido}
    />
  )

  const mensaje = (
    <>
      {aviso !== "" && <Text style={s.aviso}>{aviso}</Text>}
      {error !== "" && <AvisoDeError mensaje={error} />}
    </>
  )

  if (!recuperado)
    return (
      <View style={s.contenido}>
        <BotonAtras etiqueta="Volver a la ficha" onPress={volver} />
        {errorRecuperacion ? (
          <>
            <AvisoDeError mensaje={errorRecuperacion} />
            <BotonSecundario
              texto="Reintentar recuperación"
              onPress={() => setIntentoRecuperacion((n) => n + 1)}
            />
          </>
        ) : (
          <GrupoEsqueletos>
            <View
              style={s.carga}
              accessibilityLabel="Cargando plan"
              accessibilityRole="progressbar"
            >
              <Esqueleto alto={44} />
              {[0, 1, 2, 3].map((n) => (
                <Esqueleto key={n} alto={72} />
              ))}
            </View>
          </GrupoEsqueletos>
        )}
      </View>
    )

  if (pendiente !== null) {
    return (
      <View style={s.contenido}>
        <BotonAtras etiqueta="Volver a la ficha" onPress={volver} />
        <Titulo>{pendiente.nombre}</Titulo>
        <Text style={s.aviso}>
          La publicación está pendiente de confirmar. Reintenta el plan guardado antes de editar: se
          conservan todas sus sesiones y series.
        </Text>
        {error !== "" && <AvisoDeError mensaje={error} />}
        <BotonPrincipal
          texto="Reintentar publicación"
          onPress={() => preparar()}
          deshabilitado={ocupado}
        />
        <Dialogo
          visible={confirmando !== null}
          titulo="¿Publicar el plan?"
          texto={`${pendiente.patron.sesiones.length * pendiente.semanas} sesiones de ${pendiente.nombre}.`}
          confirmar={ocupado ? "Publicando…" : "Publicar plan"}
          cancelar="Cancelar"
          ocupado={ocupado}
          alConfirmar={() => confirmando && void publicar(confirmando)}
          alCancelar={() => setConfirmando(null)}
        />
      </View>
    )
  }

  return (
    <KeyboardAvoidingView
      style={s.raiz}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      enabled={ajustando === null}
    >
      <ScrollView
        testID="scroll-del-plan"
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={[s.contenido, ajustando !== null && s.conAjuste]}
      >
        <View style={s.barraSuperior}>
          <BotonAtras etiqueta="Volver a la ficha" onPress={pedirSalida} />
          {!sinCambios && <Text style={s.sinPublicar}>Sin publicar</Text>}
        </View>
        <View style={s.cabecera}>
          <View style={s.textos}>
            <TextInput
              accessibilityLabel="Nombre del bloque"
              value={nombre}
              onChangeText={setNombre}
              placeholder="NOMBRE DEL BLOQUE"
              placeholderTextColor={tema.marcador}
              maxLength={120}
              style={s.titulo}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Editar datos del bloque"
              accessibilityHint="Fecha de inicio, semanas y fases"
              onPress={() => {
                setAjustando(null)
                setDatosBloque(true)
              }}
              style={s.metadatos}
            >
              <Text style={s.tenue}>
                {nombreCliente} ·{" "}
                {FechaAgendaSchema.safeParse(semanaInicial).success
                  ? `empieza el ${fechaCorta(semanaInicial)}`
                  : "fecha de inicio pendiente"}{" "}
                · {semanas || "?"} semanas
              </Text>
            </Pressable>
          </View>
        </View>
        {borrador && (
          <View style={s.recuperacion}>
            <Text style={s.aviso}>
              Tienes un plan sin publicar guardado en este dispositivo. ¿Quieres seguir con él?
            </Text>
            <BotonSecundario
              texto="Recuperar mi plan"
              onPress={() => recuperarBorrador(borrador)}
            />
            <BotonSecundario texto="Empezar de cero" onPress={descartarBorrador} />
          </View>
        )}

        <Hoja
          visible={datosBloque}
          alCerrar={() => setDatosBloque(false)}
          titulo="Datos del bloque"
        >
          <View style={s.datosHoja}>
            <View style={s.datos}>
              <View style={s.dato}>
                <Text style={s.tenue}>Lunes de inicio</Text>
                <TextInput
                  accessibilityLabel="Lunes de inicio (AAAA-MM-DD)"
                  value={semanaInicial}
                  onChangeText={setSemanaInicial}
                  placeholder="2026-09-28"
                  placeholderTextColor={tema.marcador}
                  maxLength={10}
                  keyboardType="numbers-and-punctuation"
                  style={s.campo}
                />
              </View>
              <View style={s.dato}>
                <Text style={s.tenue}>Semanas</Text>
                <TextInput
                  accessibilityLabel="Número de semanas"
                  value={semanas}
                  onChangeText={setSemanas}
                  keyboardType="number-pad"
                  maxLength={2}
                  style={[s.campo, s.corto]}
                />
              </View>
              <Enlace
                texto={plantillas ? "Cerrar plantillas" : "Partir de una plantilla"}
                onPress={() => setPlantillas(!plantillas)}
              />
            </View>
            {plantillas && (
              <ListadoDeRutinas
                api={rutinas}
                elegir={(r) => {
                  setDatosBloque(false)
                  if (sinCambios) void elegirPlantilla(r)
                  else setSustituyendoPor(r)
                }}
              />
            )}

            <EditorDeBloque
              bloque={bloque}
              semanas={Number(semanas) || 1}
              cambiar={setBloque}
              quitarFase={quitarFase}
              quitarDeporte={quitarDeporte}
              avisoFases={retirada?.tipo === "fase" ? barraDeshacer : null}
              avisoDeportes={retirada?.tipo === "deporte" ? barraDeshacer : null}
            />
            <BotonSecundario texto="Listo" onPress={() => setDatosBloque(false)} sinMargen />
          </View>
        </Hoja>

        <View style={s.diasFila}>
          <View style={s.flex}>
            <Pestanas
              opciones={[...dias]
                .sort((a, b) => a.diaSemana - b.diaSemana)
                .map((d) => ({
                  valor: d.id,
                  texto: `${NOMBRES_DE_DIA[d.diaSemana - 1]!.slice(0, 3).replace(/^./, (c) => c.toUpperCase())} · ${d.nombre || "Sin nombre"}`,
                }))}
              activa={dia.id}
              cambiar={(id) => {
                setActivo(id)
                setElegido(null)
                setAnadiendo(null)
                setAjustando(null)
                setHojaEjercicio(false)
              }}
            />
          </View>
          {libres.length > 0 && (
            <Enlace
              texto="+ Día"
              etiqueta="Añadir día"
              onPress={() => {
                const nuevo = nuevoDia(nuevoId, libres[0]!)
                setDias((todos) => [...todos, nuevo])
                setActivo(nuevo.id)
                setElegido(null)
                setAjustando(null)
              }}
            />
          )}
        </View>

        <View style={s.diaCabecera}>
          <TextInput
            accessibilityLabel="Nombre del día"
            value={dia.nombre}
            onChangeText={(v) => cambiarDia({ nombre: v })}
            placeholder="Empuje"
            placeholderTextColor={tema.marcador}
            maxLength={120}
            style={[s.campo, s.nombreDia]}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Editar datos del día"
            style={s.editarDia}
            onPress={() => {
              setAjustando(null)
              setDatosDia(true)
            }}
          >
            <Text style={s.textoEditar}>···</Text>
          </Pressable>
        </View>
        <Hoja visible={datosDia} alCerrar={() => setDatosDia(false)} titulo="Datos del día">
          <View style={s.datosHoja}>
            <ScrollView
              testID="selector-dia-semana"
              horizontal
              keyboardShouldPersistTaps="handled"
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={s.semana}
              accessibilityRole="radiogroup"
              accessibilityLabel="Día de la semana"
            >
              {INICIALES_DE_DIA.map((inicial, i) => {
                const n = i + 1
                const ocupadoPorOtro = dias.some((d) => d.diaSemana === n && d.id !== dia.id)
                const elegidoDia = dia.diaSemana === n
                return (
                  <Pressable
                    key={inicial}
                    accessibilityRole="radio"
                    aria-checked={elegidoDia}
                    accessibilityState={{ checked: elegidoDia, disabled: ocupadoPorOtro }}
                    accessibilityLabel={NOMBRES_DE_DIA[i]}
                    disabled={ocupadoPorOtro}
                    onPress={() => cambiarDia({ diaSemana: n })}
                    style={[s.diaSemana, elegidoDia && s.diaElegido, ocupadoPorOtro && s.apagado]}
                  >
                    <Text style={[s.textoDia, elegidoDia && s.textoDiaElegido]}>{inicial}</Text>
                  </Pressable>
                )
              })}
            </ScrollView>
            <View style={s.dato}>
              <Text style={s.tenue}>Duración estimada</Text>
              <TextInput
                accessibilityLabel="Duración estimada"
                value={dia.duracion}
                onChangeText={(v) => cambiarDia({ duracion: v })}
                placeholder="100–115 min"
                placeholderTextColor={tema.marcador}
                maxLength={30}
                style={s.campo}
              />
            </View>
            {(["calentamiento", "fuerza", "cardio", "calma"] as const).map((parte) => (
              <View key={parte} style={s.dato}>
                <Text style={s.tenue}>
                  {parte === "calentamiento"
                    ? "Calentar"
                    : parte[0]!.toUpperCase() + parte.slice(1)}{" "}
                  (min)
                </Text>
                <TextInput
                  accessibilityLabel={`Minutos de ${parte}`}
                  value={dia.partes[parte]}
                  onChangeText={(v) => cambiarDia({ partes: { ...dia.partes, [parte]: v } })}
                  placeholder="8–10"
                  placeholderTextColor={tema.marcador}
                  maxLength={20}
                  style={[s.campo, s.corto]}
                />
              </View>
            ))}
            <TextInput
              accessibilityLabel="Nota del día para el cliente"
              value={dia.nota}
              onChangeText={(v) => cambiarDia({ nota: v })}
              placeholder="Nota para el cliente"
              placeholderTextColor={tema.marcador}
              maxLength={300}
              multiline
              style={s.campo}
            />
            <BotonSecundario texto="Listo" onPress={() => setDatosDia(false)} sinMargen />
          </View>
        </Hoja>
        <View testID="acciones-del-dia">
          <View style={s.accionesDia}>
            <BotonEnlace
              texto={guardandoPlantilla ? "Guardando plantilla…" : "Guardar como plantilla"}
              ocupado={guardandoPlantilla}
              deshabilitado={!ajusteValido}
              onPress={guardarPlantilla}
            />
            {dias.length > 1 && (
              <Enlace
                texto="Quitar día"
                onPress={() => (dia.ejercicios.length === 0 ? quitarDia() : setQuitandoDia(true))}
              />
            )}
          </View>
          {lugarDelMensaje === "plantilla" && mensaje}
        </View>

        <EntradaMarca style={s.cuerpo}>
          <View style={s.flex}>
            {seccionesVisibles.map(({ seccion, titulo }) => {
              const ejercicios = dia.ejercicios.filter((e) => e.seccion === seccion)
              const minutos =
                dia.partes[
                  seccion === "calentamiento"
                    ? "calentamiento"
                    : seccion === "circuito"
                      ? "cardio"
                      : "calma"
                ]
              const resumen =
                seccion === "principal"
                  ? `${ejercicios.reduce((total, e) => total + (Number(e.series) || 0), 0)} series`
                  : minutos
                    ? `${minutos} min`
                    : resumenDeSeccion(dia, seccion)
              return (
                <View key={seccion} style={s.seccion}>
                  <Titulo estilo={s.tituloSeccion} derecha={resumen}>
                    {seccion === "circuito" ? dia.circuito.nombre || titulo : titulo}
                  </Titulo>
                  {seccion === "circuito" && (
                    <View style={s.datos}>
                      <TextInput
                        accessibilityLabel="Nombre del circuito"
                        value={dia.circuito.nombre}
                        onChangeText={(v) =>
                          cambiarDia({ circuito: { ...dia.circuito, nombre: v } })
                        }
                        placeholder="Core"
                        placeholderTextColor={tema.marcador}
                        maxLength={30}
                        style={[s.campo, s.flex]}
                      />
                      <TextInput
                        accessibilityLabel="Vueltas del circuito"
                        value={dia.circuito.vueltas}
                        onChangeText={(v) =>
                          cambiarDia({ circuito: { ...dia.circuito, vueltas: v } })
                        }
                        placeholder="2"
                        placeholderTextColor={tema.marcador}
                        keyboardType="number-pad"
                        maxLength={2}
                        style={[s.campo, s.corto]}
                      />
                      <TextInput
                        accessibilityLabel="Descanso entre vueltas"
                        value={dia.circuito.descanso}
                        onChangeText={(v) =>
                          cambiarDia({ circuito: { ...dia.circuito, descanso: v } })
                        }
                        placeholder="60–90 s"
                        placeholderTextColor={tema.marcador}
                        maxLength={30}
                        style={[s.campo, s.flex]}
                      />
                    </View>
                  )}
                  {seccion === "principal" ? (
                    <TablaPrincipal
                      ejercicios={ejercicios}
                      elegido={elegido}
                      elegir={abrirEjercicio}
                      cambiar={cambiarEjercicio}
                      ajustar={(id, campo) => {
                        setElegido(id)
                        setAjustando({ id, campo })
                      }}
                      quitar={quitar}
                      mover={mover}
                      ancha={ancho}
                    />
                  ) : (
                    <ListaDeSeccion
                      ejercicios={ejercicios}
                      elegido={elegido}
                      elegir={abrirEjercicio}
                      cambiar={cambiarEjercicio}
                      quitar={quitar}
                    />
                  )}
                  <Enlace
                    texto="+ Ejercicio"
                    etiqueta="Añadir desde la biblioteca"
                    onPress={() => {
                      setAjustando(null)
                      setAnadiendo(seccion)
                    }}
                  />
                </View>
              )
            })}
            {faltan.length > 0 && (
              <View style={s.datos}>
                {faltan.map(({ seccion, titulo }) => (
                  <Enlace
                    key={seccion}
                    texto={`Añadir ${titulo.toLowerCase()}`}
                    onPress={() => {
                      setAjustando(null)
                      setAnadiendo(seccion)
                    }}
                  />
                ))}
              </View>
            )}
          </View>
        </EntradaMarca>
        {Platform.OS === "web" && (
          <Enlace
            texto="Exportar PDF"
            onPress={() => exportarPdf(nombre || "Plan", nombreCliente, dias)}
          />
        )}
      </ScrollView>
      <View testID="pie-del-plan" style={s.pie}>
        <Svg pointerEvents="none" style={s.degradadoPie} width="100%" height={20}>
          <Defs>
            <LinearGradient id="fondo-plan" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={tema.fondo} stopOpacity={0} />
              <Stop offset="1" stopColor={tema.fondo} />
            </LinearGradient>
          </Defs>
          <Rect width="100%" height={20} fill="url(#fondo-plan)" />
        </Svg>
        {retirada?.tipo === "ejercicio" && ajustando === null && barraDeshacer}
        {lugarDelMensaje !== "plantilla" && mensaje}
        <View style={s.botones}>
          <View style={s.boton}>
            <BotonSecundario
              texto="Ver como cliente"
              onPress={previsualizar}
              deshabilitado={!ajusteValido}
              compacto
              sinMargen
            />
          </View>
          <View style={s.boton}>
            <BotonPrincipal
              texto="Publicar"
              onPress={() => preparar("pie")}
              deshabilitado={guardandoPlantilla || !ajusteValido}
              compacto
              sinMargen
            />
          </View>
        </View>
      </View>
      {ajustando && ejercicioAjustado && (
        <AjustePrescripcion
          key={`${ajustando.id}-${ajustando.campo}`}
          ejercicio={ejercicioAjustado}
          campo={ajustando.campo}
          cambiar={cambiarEjercicio}
          cerrar={() => setAjustando(null)}
          alCambiarValidez={setAjusteValido}
          margenInferior={96}
          aviso={retirada?.tipo === "ejercicio" ? barraDeshacer : null}
        />
      )}
      <Hoja
        visible={hojaEjercicio && ejercicioElegido !== null}
        alCerrar={() => setHojaEjercicio(false)}
        titulo="Editar ejercicio"
      >
        {panel}
      </Hoja>
      <Hoja visible={anadiendo !== null} alCerrar={() => setAnadiendo(null)} titulo="Ejercicios">
        {anadiendo !== null && (
          <View style={s.biblioteca}>
            <SelectorEjercicios
              api={catalogo}
              elegir={(e) => {
                cambiarDia({
                  ejercicios: [...dia.ejercicios, nuevoEjercicio(e, anadiendo, nuevoId)],
                })
                setAnadiendo(null)
              }}
            />
          </View>
        )}
      </Hoja>

      <Modal
        testID="vista-cliente"
        visible={comoCliente}
        animationType={reducido ? "none" : "slide"}
        onRequestClose={() => setComoCliente(false)}
      >
        <ScrollView style={s.modal} contentContainerStyle={s.contenidoModal}>
          <BotonAtras
            etiqueta="Cerrar la vista del cliente"
            onPress={() => setComoCliente(false)}
          />
          <Text style={s.tituloModal}>Así lo verá {nombreCliente}</Text>
          {comoCliente && (
            <Pestanas
              opciones={Array.from({ length: Number(semanas) }, (_, i) => ({
                valor: String(i + 1),
                texto: `Semana ${i + 1}`,
              }))}
              activa={semanaVista}
              cambiar={(valor) => {
                setSemanaVista(valor)
                setDiaVista(null)
              }}
            />
          )}
          {comoCliente &&
            (() => {
              const fase = faseDeSemana(bloque.fases, Number(semanaVista))
              const ajustes = textoDeAjustes(fase?.ajustes)
              const vista = vistaDelCliente(
                dias,
                sumarDias(semanaInicial, (Number(semanaVista) - 1) * 7),
                clienteId,
                nuevoId,
                fase,
              )
              return vista.length === 0 ? (
                <Text style={s.tenue}>Completa al menos un día para verlo como el cliente.</Text>
              ) : (
                <>
                  {fase && (
                    <Text style={s.tenue}>
                      {fase.nombre}
                      {fase.detalle ? ` · ${fase.detalle}` : ""}
                    </Text>
                  )}
                  {ajustes && (
                    <Text testID="ajustes-semana-previa" style={s.tenue}>
                      {ajustes}
                    </Text>
                  )}
                  <RutinaDeLaSemana
                    dias={vista}
                    elegido={diaVista}
                    elegir={setDiaVista}
                    hoy=""
                    verTecnica={() => undefined}
                    abrir={() => undefined}
                  />
                </>
              )
            })()}
        </ScrollView>
      </Modal>

      <Dialogo
        visible={confirmando !== null}
        titulo="¿Publicar el plan?"
        texto={
          confirmando
            ? `${nombreCliente} verá el plan en su app desde el ${fechaCorta(confirmando.semanaInicial)}: ${confirmando.semanas * confirmando.patron.sesiones.length} sesiones en ${confirmando.semanas} semanas. Las sesiones que ya tenga se conservan.`
            : ""
        }
        confirmar={ocupado ? "Publicando…" : "Publicar plan"}
        cancelar="Cancelar"
        ocupado={ocupado}
        alConfirmar={() => confirmando && void publicar(confirmando)}
        alCancelar={() => setConfirmando(null)}
      />
      <Dialogo
        visible={quitandoDia}
        titulo="¿Quitar este día?"
        texto={`Se eliminan los ${dia.ejercicios.length} ejercicios de «${dia.nombre || "Sin nombre"}». No se puede deshacer.`}
        confirmar="Quitar este día"
        cancelar="Conservarlo"
        peligro
        alConfirmar={() => {
          setQuitandoDia(false)
          quitarDia()
        }}
        alCancelar={() => setQuitandoDia(false)}
      />
      <Dialogo
        visible={sustituyendoPor !== null}
        titulo="¿Sustituir lo que has montado?"
        texto="Cargar la plantilla reemplaza los días y ejercicios que llevas montados. No se puede deshacer."
        confirmar="Sustituir por la plantilla"
        cancelar="Conservar lo mío"
        peligro
        alConfirmar={() => {
          const plantilla = sustituyendoPor
          setSustituyendoPor(null)
          if (plantilla) void elegirPlantilla(plantilla)
        }}
        alCancelar={() => setSustituyendoPor(null)}
      />
      <Dialogo
        visible={saliendo}
        titulo="¿Salir sin guardar el plan?"
        texto="Los cambios de este plan todavía no se han publicado. Si sales ahora se perderán."
        confirmar="Salir sin guardar"
        cancelar="Seguir editando"
        ocupado={ocupado}
        alConfirmar={() => {
          setSaliendo(false)
          setSalidaAutorizada(true)
        }}
        alCancelar={() => {
          salida.current = null
          setSaliendo(false)
        }}
      />
      {tecnica && (
        <VerTecnica
          cuenta={cuentaId}
          ejercicioId={tecnica.ejercicioId}
          nombre={tecnica.nombre}
          leer={catalogo.leer}
          almacen={almacenDispositivo}
          acceso={acceso}
          cerrar={() => setTecnica(null)}
        />
      )}
    </KeyboardAvoidingView>
  )
}

const s = StyleSheet.create({
  raiz: { flex: 1 },
  flex: { flex: 1 },
  contenido: {
    gap: 20,
    padding: 20,
    paddingTop: 8,
    width: "100%",
    maxWidth: 1000,
    alignSelf: "center",
  },
  conAjuste: { paddingBottom: 230 },
  barraSuperior: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sinPublicar: { color: tema.aviso, fontFamily: tema.fuenteTexto, fontSize: 13 },
  cabecera: { gap: 8 },
  textos: { gap: 4 },
  metadatos: { minHeight: 44, justifyContent: "center" },
  datosHoja: { gap: 24 },
  biblioteca: { minHeight: 400 },
  carga: { gap: 16 },
  titulo: {
    color: tema.texto,
    fontFamily: tema.fuenteTitulo,
    fontSize: 28,
    lineHeight: 34,
    minHeight: 44,
    textTransform: "uppercase",
    paddingVertical: 2,
  },
  tenue: { color: tema.textoTenue, fontFamily: tema.fuenteTexto, fontSize: 13 },
  botones: { flexDirection: "row", gap: 8, width: "100%" },
  boton: { flex: 1, minWidth: 0 },
  recuperacion: { gap: 8 },
  aviso: {
    backgroundColor: tema.exitoSuave,
    color: tema.texto,
    borderRadius: 12,
    padding: 12,
    fontFamily: tema.fuenteBoton,
  },
  datos: { flexDirection: "row", flexWrap: "wrap", alignItems: "flex-end", gap: 12 },
  dato: { gap: 4 },
  campo: {
    minHeight: 52,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: tema.bordeFuerte,
    backgroundColor: tema.superficie,
    color: tema.texto,
    fontFamily: tema.fuenteTexto,
    fontSize: 15,
    paddingHorizontal: 12,
  },
  corto: { width: 72, textAlign: "center" },
  diasFila: { flexDirection: "row", alignItems: "center", gap: 12 },
  diaCabecera: { flexDirection: "row", flexWrap: "wrap", alignItems: "flex-end", gap: 12 },
  nombreDia: { flex: 1, minWidth: 0, fontFamily: tema.fuenteBoton },
  editarDia: { width: 44, minHeight: 44, justifyContent: "center", alignItems: "center" },
  textoEditar: { color: tema.acento, fontFamily: tema.fuenteBoton, fontSize: 24 },
  semana: { flexDirection: "row", gap: 4 },
  diaSemana: {
    width: 44,
    minHeight: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: tema.bordeFuerte,
    alignItems: "center",
    justifyContent: "center",
  },
  diaElegido: { borderColor: tema.acento, backgroundColor: tema.acentoSuave },
  apagado: { opacity: 0.35 },
  textoDia: { color: tema.texto, fontFamily: tema.fuenteBoton, fontSize: 14 },
  textoDiaElegido: { color: tema.acento },
  accionesDia: { flexDirection: "row", flexWrap: "wrap", gap: 16 },
  pie: {
    gap: 12,
    padding: 20,
    paddingTop: 12,
    backgroundColor: tema.fondo,
  },
  degradadoPie: { position: "absolute", top: -20, left: 0, right: 0 },
  cuerpo: { gap: 20 },
  tituloSeccion: {
    fontFamily: tema.fuenteTitulo,
    fontSize: 20,
    lineHeight: 24,
    textTransform: "uppercase",
  },
  seccion: { gap: 12, marginBottom: 24 },
  modal: { flex: 1, backgroundColor: tema.fondo },
  contenidoModal: { padding: 20, gap: 20, maxWidth: 720, width: "100%", alignSelf: "center" },
  tituloModal: {
    color: tema.texto,
    fontFamily: tema.fuenteTitulo,
    fontSize: 28,
    textTransform: "uppercase",
  },
})
