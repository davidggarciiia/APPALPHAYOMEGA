import { useEffect, useRef, useState } from "react"
import { useNavigation } from "expo-router"
import { usePreventRemove } from "expo-router/react-navigation"
import {
  Modal,
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
import {
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
import { Pestanas, Titulo } from "../../entrenamiento/plan/piezas"
import { RutinaDeLaSemana, type DiaDelPlan } from "../../entrenamiento/plan/rutina"
import { BotonAtras, Dialogo, Enlace } from "../../entrenamiento/sesion/controles"
import { VerTecnica } from "../../entrenamiento/ver-tecnica"
import { ErrorDePeticion, ErrorDePermiso, ErrorDelServidor } from "../../lib/http"
import { conRecursoLocalExclusivo } from "../../lib/candado-local"
import { useEnvioUnico } from "../../lib/envio-unico"
import { degradadoOro, tema } from "../../tema"
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
          prescripcion,
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
  const ancho = width >= 1000
  const acceso = useAccesoAFiguras()
  const [nombre, setNombre] = useState("")
  const [semanaInicial, setSemanaInicial] = useState(() => sumarDias(lunesDeSemana(), 7))
  const [semanas, setSemanas] = useState("6")
  const [dias, setDias] = useState<DiaDelConstructor[]>(() => [nuevoDia(nuevoId, 1)])
  const [activo, setActivo] = useState<string>(() => dias[0]!.id)
  const [bloque, setBloque] = useState<Bloque>(BLOQUE_VACIO)
  const [elegido, setElegido] = useState<string | null>(null)
  const [anadiendo, setAnadiendo] = useState<SeccionDeSesion | null>(null)
  const [plantillas, setPlantillas] = useState(false)
  /** Plantilla elegida sobre un plan ya empezado: se pregunta antes de sustituirlo. */
  const [sustituyendoPor, setSustituyendoPor] = useState<RutinaGuardada | null>(null)
  /** «Quitar día» con ejercicios: elimina todo lo del día, así que se pregunta antes. */
  const [quitandoDia, setQuitandoDia] = useState(false)
  const [retirada, setRetirada] = useState<Retirada | null>(null)
  const retiradaDeshecha = useRef<Retirada | null>(null)
  const [comoCliente, setComoCliente] = useState(false)
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
  const navigation = useNavigation()
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
    const id = setTimeout(() => setRetirada(null), 6000)
    return () => clearTimeout(id)
  }, [retirada])

  usePreventRemove(sinGuardar, ({ data }) => {
    salida.current = () => navigation.dispatch(data.action)
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
    const resto = dias.filter((d) => d.id !== dia.id)
    setDias(resto)
    setActivo(resto[0]!.id)
  }
  const quitar = (id: string): void => {
    const indice = dia.ejercicios.findIndex((e) => e.id === id)
    const elemento = dia.ejercicios[indice]
    if (!elemento) return
    setRetirada({ tipo: "ejercicio", indice, elemento, diaId: dia.id })
    cambiarDia({ ejercicios: dia.ejercicios.filter((e) => e.id !== id) })
    if (elegido === id) setElegido(null)
  }
  const quitarFase = (indice: number): void => {
    const elemento = bloque.fases[indice]!
    setRetirada(
      elemento.nombre.trim() || elemento.detalle?.trim()
        ? { tipo: "fase", indice, elemento }
        : null,
    )
    setBloque((actual) => ({ ...actual, fases: actual.fases.filter((_, n) => n !== indice) }))
  }
  const quitarDeporte = (indice: number): void => {
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
    <View style={s.barraDeshacer}>
      <Text accessibilityLiveRegion="polite" style={[s.tenue, s.flex]}>
        {retirada.tipo === "fase"
          ? `Fase «${retirada.elemento.nombre || "Sin nombre"}» quitada`
          : `${retirada.elemento.nombre} quitado`}{" "}
        ·
      </Text>
      <Enlace texto="DESHACER" etiqueta="Deshacer" onPress={deshacer} />
    </View>
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
    setLugarDelMensaje("cabecera")
    try {
      construir(nuevoId())
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

  const panel =
    ejercicioElegido !== null ? (
      <PanelEjercicio
        ejercicio={ejercicioElegido}
        nombreCliente={nombreCliente}
        cambiar={cambiarEjercicio}
        verTecnica={() => setTecnica(ejercicioElegido)}
      />
    ) : (
      <View style={s.panelVacio}>
        <Text style={s.tenue}>
          Elige un ejercicio para su nota, sus alternativas y si es compuesto.
        </Text>
      </View>
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
          <Text style={s.tenue}>Recuperando publicaciones pendientes…</Text>
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
    <View style={s.contenido}>
      <BotonAtras etiqueta="Volver a la ficha" onPress={pedirSalida} />
      <View style={s.cabecera}>
        <View style={s.textos}>
          <TextInput
            accessibilityLabel="Nombre del bloque"
            value={nombre}
            onChangeText={setNombre}
            placeholder="BLOQUE 1 · RECOMPOSICIÓN"
            placeholderTextColor={tema.marcador}
            maxLength={120}
            style={s.titulo}
          />
          <Text style={s.tenue}>
            {nombreCliente} ·{" "}
            {FechaAgendaSchema.safeParse(semanaInicial).success
              ? `empieza el ${fechaCorta(semanaInicial)}`
              : "fecha de inicio pendiente"}{" "}
            · {semanas || "?"} semanas
          </Text>
        </View>
        {/* Cada botón crece hasta llenar su fila y envuelve en pantallas estrechas. */}
        <View style={s.botones}>
          <View style={[s.boton, ancho && s.botonAncho]}>
            <BotonSecundario texto="Ver como cliente" onPress={previsualizar} sinMargen />
          </View>
          {Platform.OS === "web" && (
            <View style={[s.boton, ancho && s.botonAncho]}>
              <BotonSecundario
                texto="Exportar PDF"
                onPress={() => exportarPdf(nombre || "Plan", nombreCliente, dias)}
                sinMargen
              />
            </View>
          )}
          <View style={[s.boton, ancho && s.botonAncho]}>
            <BotonPrincipal
              texto="Publicar"
              onPress={() => preparar()}
              deshabilitado={guardandoPlantilla}
              sinMargen
            />
          </View>
        </View>
      </View>
      {lugarDelMensaje === "cabecera" && mensaje}
      {borrador && (
        <View style={s.recuperacion}>
          <Text style={s.aviso}>
            Tienes un plan sin publicar guardado en este dispositivo. ¿Quieres seguir con él?
          </Text>
          <BotonPrincipal texto="Recuperar mi plan" onPress={() => recuperarBorrador(borrador)} />
          <BotonSecundario texto="Empezar de cero" onPress={descartarBorrador} />
        </View>
      )}

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
          elegir={(r) => (sinCambios ? void elegirPlantilla(r) : setSustituyendoPor(r))}
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
            }}
          />
        </View>
        {libres.length > 0 && (
          <Enlace
            texto="Añadir día"
            onPress={() => {
              const nuevo = nuevoDia(nuevoId, libres[0]!)
              setDias((todos) => [...todos, nuevo])
              setActivo(nuevo.id)
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
        <View style={s.semana} accessibilityRole="radiogroup" accessibilityLabel="Día de la semana">
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
                style={[
                  s.diaSemana,
                  elegidoDia && [s.diaElegido, degradadoOro],
                  ocupadoPorOtro && s.apagado,
                ]}
              >
                <Text style={[s.textoDia, elegidoDia && s.textoDiaElegido]}>{inicial}</Text>
              </Pressable>
            )
          })}
        </View>
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
              {parte === "calentamiento" ? "Calentar" : parte[0]!.toUpperCase() + parte.slice(1)}{" "}
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
        <View testID="acciones-del-dia">
          <View style={s.accionesDia}>
            <BotonEnlace
              texto={guardandoPlantilla ? "Guardando plantilla…" : "Guardar como plantilla"}
              ocupado={guardandoPlantilla}
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
      </View>
      <TextInput
        accessibilityLabel="Nota del día para el cliente"
        value={dia.nota}
        onChangeText={(v) => cambiarDia({ nota: v })}
        placeholder="Banca: 60 kg de inicio para 4×6"
        placeholderTextColor={tema.marcador}
        maxLength={300}
        style={s.campo}
      />

      <View style={[s.cuerpo, ancho && s.cuerpoAncho]}>
        <View style={s.flex}>
          {seccionesVisibles.map(({ seccion, titulo }) => {
            const ejercicios = dia.ejercicios.filter((e) => e.seccion === seccion)
            return (
              <View key={seccion} style={s.seccion}>
                <Titulo derecha={resumenDeSeccion(dia, seccion)}>
                  {seccion === "circuito" ? dia.circuito.nombre || titulo : titulo}
                </Titulo>
                {seccion === "circuito" && (
                  <View style={s.datos}>
                    <TextInput
                      accessibilityLabel="Nombre del circuito"
                      value={dia.circuito.nombre}
                      onChangeText={(v) => cambiarDia({ circuito: { ...dia.circuito, nombre: v } })}
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
                    elegir={setElegido}
                    cambiar={cambiarEjercicio}
                    quitar={quitar}
                    mover={mover}
                    ancha={ancho}
                  />
                ) : (
                  <ListaDeSeccion
                    ejercicios={ejercicios}
                    elegido={elegido}
                    elegir={setElegido}
                    cambiar={cambiarEjercicio}
                    quitar={quitar}
                  />
                )}
                {retirada?.tipo === "ejercicio" &&
                  retirada.diaId === dia.id &&
                  retirada.elemento.seccion === seccion &&
                  barraDeshacer}
                {anadiendo === seccion ? (
                  <View style={s.selector}>
                    <SelectorEjercicios
                      api={catalogo}
                      elegir={(e) => {
                        cambiarDia({
                          ejercicios: [...dia.ejercicios, nuevoEjercicio(e, seccion, nuevoId)],
                        })
                        setAnadiendo(null)
                      }}
                    />
                    <BotonSecundario
                      texto="Cerrar la biblioteca"
                      onPress={() => setAnadiendo(null)}
                    />
                  </View>
                ) : (
                  <Enlace
                    texto="Añadir desde la biblioteca"
                    onPress={() => setAnadiendo(seccion)}
                  />
                )}
                {!ancho && ejercicioElegido?.seccion === seccion && panel}
              </View>
            )
          })}
          {faltan.length > 0 && (
            <View style={s.datos}>
              {faltan.map(({ seccion, titulo }) => (
                <Enlace
                  key={seccion}
                  texto={`Añadir ${titulo.toLowerCase()}`}
                  onPress={() => setAnadiendo(seccion)}
                />
              ))}
            </View>
          )}
        </View>
        {ancho && <View style={s.lateral}>{panel}</View>}
      </View>

      <View testID="pie-del-plan" style={s.pie}>
        {lugarDelMensaje === "pie" && mensaje}
        <BotonPrincipal
          texto="Publicar"
          etiquetaAccesible="Publicar al pie"
          onPress={() => preparar("pie")}
          deshabilitado={guardandoPlantilla}
          sinMargen
        />
      </View>

      <Modal
        visible={comoCliente}
        animationType="slide"
        onRequestClose={() => setComoCliente(false)}
      >
        <ScrollView style={s.modal} contentContainerStyle={s.contenidoModal}>
          <BotonAtras
            etiqueta="Cerrar la vista del cliente"
            onPress={() => setComoCliente(false)}
          />
          <Text style={s.tituloModal}>Así lo verá {nombreCliente.split(" ")[0]}</Text>
          {comoCliente &&
            (() => {
              const vista = vistaDelCliente(dias, semanaInicial, clienteId, nuevoId)
              return vista.length === 0 ? (
                <Text style={s.tenue}>Completa al menos un día para verlo como el cliente.</Text>
              ) : (
                <RutinaDeLaSemana
                  dias={vista}
                  elegido={null}
                  elegir={() => undefined}
                  hoy=""
                  verTecnica={() => undefined}
                  abrir={() => undefined}
                />
              )
            })()}
        </ScrollView>
      </Modal>

      <Dialogo
        visible={confirmando !== null}
        titulo="¿Publicar el plan?"
        texto={
          confirmando
            ? `${nombreCliente.split(" ")[0]} verá el plan en su app desde el ${fechaCorta(confirmando.semanaInicial)}: ${confirmando.semanas * confirmando.patron.sesiones.length} sesiones en ${confirmando.semanas} semanas. Las sesiones que ya tenga se conservan.`
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
    </View>
  )
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  contenido: { gap: 20 },
  cabecera: { flexDirection: "row", flexWrap: "wrap", alignItems: "flex-start", gap: 16 },
  textos: { flex: 1, minWidth: 260, gap: 4 },
  titulo: {
    color: tema.texto,
    fontFamily: tema.fuenteTitulo,
    fontSize: 32,
    lineHeight: 38,
    textTransform: "uppercase",
    paddingVertical: 2,
  },
  tenue: { color: tema.textoTenue, fontFamily: tema.fuenteTexto, fontSize: 13 },
  // Debajo del título, a todo el ancho: junto a él lo aplastaban en escritorio y se salían en móvil.
  botones: { flexDirection: "row", flexWrap: "wrap", gap: 8, width: "100%" },
  boton: { flexGrow: 1, flexBasis: 200 },
  botonAncho: { maxWidth: 240 },
  recuperacion: { gap: 8 },
  aviso: {
    backgroundColor: tema.exitoSuave,
    color: tema.texto,
    borderRadius: 12,
    padding: 12,
    fontFamily: tema.fuenteBoton,
  },
  barraDeshacer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: tema.superficieAlta,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  datos: { flexDirection: "row", flexWrap: "wrap", alignItems: "flex-end", gap: 12 },
  dato: { gap: 4 },
  campo: {
    minHeight: 42,
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
  nombreDia: { minWidth: 180, fontFamily: tema.fuenteBoton },
  semana: { flexDirection: "row", gap: 4 },
  diaSemana: {
    width: 36,
    height: 42,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: tema.bordeFuerte,
    alignItems: "center",
    justifyContent: "center",
  },
  diaElegido: { borderColor: "transparent" },
  apagado: { opacity: 0.35 },
  textoDia: { color: tema.texto, fontFamily: tema.fuenteBoton, fontSize: 14 },
  textoDiaElegido: { color: tema.sobreAcento },
  accionesDia: { flexDirection: "row", gap: 16 },
  pie: { gap: 12 },
  cuerpo: { gap: 20 },
  cuerpoAncho: { flexDirection: "row", alignItems: "flex-start" },
  lateral: { width: 300 },
  seccion: { gap: 10, marginBottom: 20 },
  selector: { backgroundColor: tema.superficie, borderRadius: 16, padding: 12, gap: 8 },
  panelVacio: { backgroundColor: tema.superficie, borderRadius: 20, padding: 16 },
  modal: { flex: 1, backgroundColor: tema.fondo },
  contenidoModal: { padding: 20, gap: 20, maxWidth: 720, width: "100%", alignSelf: "center" },
  tituloModal: {
    color: tema.texto,
    fontFamily: tema.fuenteTitulo,
    fontSize: 28,
    textTransform: "uppercase",
  },
})
