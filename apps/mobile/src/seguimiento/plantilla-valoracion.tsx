import { useRef, useState, type ReactNode } from "react"
import { Pressable, StyleSheet, Text, View } from "react-native"
import {
  crearPruebaEstandar,
  DefinicionCorporalSchema,
  DefinicionPruebaSchema,
  GuardarPlantillaValoracionSchema,
  MagnitudCorporalSchema,
  PRUEBAS_ESTANDAR,
  UNIDADES_CORPORALES,
  UNIDADES_DE_PRUEBA,
  versionarDefinicionCorporal,
  versionarDefinicionPrueba,
  type BloqueCorporal,
  type DefinicionCorporal,
  type DefinicionPrueba,
  type GuardarPlantillaValoracion,
  type MagnitudCorporal,
  type PlantillaValoracion,
  type TipoDePrueba,
  type UnidadCorporal,
  type UnidadDePrueba,
} from "@alpha-omega/shared"

import { AvisoDeError, BotonPrincipal, BotonSecundario, Campo } from "../componentes/formulario"
import { Fila, Tarjeta, Titulo } from "../entrenamiento/plan/piezas"
import { Chips } from "../entrenamiento/sesion/controles"
import { faltaDe } from "../lib/errores"
import { ErrorDePeticion } from "../lib/http"
import { tema } from "../tema"

/**
 * Plantilla de valoración de un cliente: qué campos corporales y qué pruebas
 * se copian a cada visita nueva. No trae listas de perímetros ni de pliegues:
 * los define el entrenador. Renombrar conserva la serie; cambiar cómo se mide
 * sube la versión frente a la guardada. Lo guardado no se quita, se desactiva.
 */

const AVISO_VERSION = "Nueva versión: sus resultados anteriores quedarán en otra serie"

const BLOQUES: ReadonlyArray<{ valor: BloqueCorporal; texto: string }> = [
  { valor: "medidas", texto: "Medidas" },
  { valor: "pliegues", texto: "Pliegues" },
  { valor: "bioimpedancia", texto: "Bioimpedancia" },
]

const MAGNITUD: Record<MagnitudCorporal, string> = {
  peso: "Peso",
  altura: "Altura",
  perimetro: "Perímetro",
  pliegue: "Pliegue",
  grasa: "Grasa",
  masaMuscular: "Masa muscular",
  masaLibreDeGrasa: "Masa libre de grasa",
  agua: "Agua",
  grasaVisceral: "Grasa visceral",
  otra: "Otra",
}

const UNIDAD_CORPORAL: Record<UnidadCorporal, string> = {
  kg: "kg",
  cm: "cm",
  mm: "mm",
  "%": "%",
  l: "l",
  kcal: "kcal",
  años: "años",
  indice: "índice",
}

type Lado = "ninguna" | "izquierda" | "derecha"
const LADOS: ReadonlyArray<{ valor: Lado; texto: string }> = [
  { valor: "ninguna", texto: "Ninguna" },
  { valor: "izquierda", texto: "Izquierda" },
  { valor: "derecha", texto: "Derecha" },
]

const NOMBRE_DE_TIPO: Record<TipoDePrueba, string> = {
  dominadas: "Dominadas",
  suspension: "Aguante en barra",
  flexiones1min: "Flexiones 1 min",
  sentadillas1min: "Sentadillas 1 min",
  pressBanca1rm: "Press banca 1RM",
  cooper: "Cooper",
  personalizada: "Personalizada",
}
const TIPOS = [...PRUEBAS_ESTANDAR, "personalizada" as const].map((valor) => ({
  valor,
  texto: NOMBRE_DE_TIPO[valor],
}))
/** El contrato fija 60 s en estas dos: no se ofrece cambiarla. */
const DURACION_FIJA: readonly TipoDePrueba[] = ["flexiones1min", "sentadillas1min"]

const UNIDAD_PRUEBA: Record<UnidadDePrueba, string> = {
  reps: "repeticiones",
  s: "segundos",
  kg: "kg",
  m: "metros",
  cm: "cm",
  lpm: "lpm",
  puntos: "puntos",
}

/** Qué admite el contrato para cada bloque y magnitud, preguntado a su propio esquema. */
function admite(bloque: BloqueCorporal, magnitud: MagnitudCorporal, unidad: UnidadCorporal) {
  return DefinicionCorporalSchema.safeParse({
    id: "00000000-0000-4000-8000-000000000000",
    version: 1,
    bloque,
    magnitud,
    nombre: "x",
    unidad,
    zona: null,
    lateralidad: null,
    instrumento: null,
    protocolo: null,
    activa: true,
  }).success
}
const PERMITIDAS = Object.fromEntries(
  BLOQUES.map(({ valor: bloque }) => [
    bloque,
    MagnitudCorporalSchema.options
      .map((magnitud) => ({
        magnitud,
        unidades: UNIDADES_CORPORALES.filter((u) => admite(bloque, magnitud, u)),
      }))
      .filter((p) => p.unidades.length > 0),
  ]),
) as Record<BloqueCorporal, Array<{ magnitud: MagnitudCorporal; unidades: UnidadCorporal[] }>>
const unidadesDe = (bloque: BloqueCorporal, magnitud: MagnitudCorporal): UnidadCorporal[] =>
  PERMITIDAS[bloque].find((p) => p.magnitud === magnitud)?.unidades ?? []

const unica = <T,>(lista: readonly T[]): T | null => (lista.length === 1 ? lista[0]! : null)
const textoONulo = (texto: string): string | null => (texto.trim() === "" ? null : texto.trim())
const conAngulos = (textos: string[]): boolean => textos.some((t) => /[<>]/.test(t))
const problemaDe = (issues: ReadonlyArray<{ code: string; message: string }>): string => {
  const propio = issues.find((i) => i.code === "custom")
  return propio ? `${propio.message}.` : "Revisa los datos: algún texto es demasiado largo."
}

/** Comparación sin depender del orden de las claves. */
const firma = (valor: unknown): string =>
  JSON.stringify(valor, (_clave, v: unknown) =>
    v && typeof v === "object" && !Array.isArray(v)
      ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => (a < b ? -1 : 1)))
      : v,
  )

type Juntos<T> = ReadonlyArray<ReadonlyArray<keyof T>>
/** Dependen entre sí: mezclar la magnitud de uno con la unidad de otro daría algo imposible. */
const JUNTOS_CORPORAL: Juntos<DefinicionCorporal> = [["bloque", "magnitud", "unidad"]]

/**
 * «Conservar mi edición» tras un conflicto, en tres sentidos: sobre la versión
 * del servidor se aplican solo los campos que cambié respecto a la que abrí, y
 * la versión se decide contra la suya. Lo que añadió otra persona se mantiene,
 * porque lo guardado no se puede quitar.
 */
function combinar<T extends { id: string; version: number }>(
  mias: T[],
  base: T[],
  servidor: T[],
  versionar: (anterior: T, nueva: T) => T,
  juntos: Juntos<T> = [],
): T[] {
  const antes = new Map(base.map((d) => [d.id, d]))
  const ahora = new Map(servidor.map((d) => [d.id, d]))
  const propias = mias.map((d) => {
    const suya = ahora.get(d.id)
    if (!suya) return d
    const original = antes.get(d.id)
    return versionar(suya, original ? fusionar(original, d, suya, juntos) : d)
  })
  const ids = new Set(mias.map((d) => d.id))
  return [...propias, ...servidor.filter((d) => !ids.has(d.id))]
}

/** `suya` con los campos en que `mia` difiere de `base`. La versión la decide `versionar`. */
function fusionar<T extends { version: number }>(base: T, mia: T, suya: T, juntos: Juntos<T>): T {
  const tocados = new Set(
    (Object.keys(mia) as Array<keyof T>).filter(
      (campo) => campo !== "version" && firma(base[campo]) !== firma(mia[campo]),
    ),
  )
  for (const grupo of juntos)
    if (grupo.some((campo) => tocados.has(campo))) grupo.forEach((campo) => tocados.add(campo))
  const fusionada = { ...suya }
  for (const campo of tocados) fusionada[campo] = mia[campo]
  return fusionada
}

function intercambiar<T extends { id: string }>(lista: T[], a: string, b: string): T[] {
  const i = lista.findIndex((d) => d.id === a)
  const j = lista.findIndex((d) => d.id === b)
  const copia = [...lista]
  copia[i] = lista[j]!
  copia[j] = lista[i]!
  return copia
}

function reemplazar<T extends { id: string }>(lista: T[], nueva: T): T[] {
  return lista.some((d) => d.id === nueva.id)
    ? lista.map((d) => (d.id === nueva.id ? nueva : d))
    : [...lista, nueva]
}

const etiquetaCorporal = (d: DefinicionCorporal): string =>
  d.lateralidad ? `${d.nombre} (${d.lateralidad})` : d.nombre
const detalleCorporal = (d: DefinicionCorporal): string =>
  [
    MAGNITUD[d.magnitud],
    UNIDAD_CORPORAL[d.unidad],
    d.zona,
    d.lateralidad && LADOS.find((l) => l.valor === d.lateralidad)?.texto,
    d.instrumento,
  ]
    .filter(Boolean)
    .join(" · ")
const etiquetaPrueba = (p: DefinicionPrueba): string =>
  p.variante ? `${p.nombre} (${p.variante})` : p.nombre
function detallePrueba(p: DefinicionPrueba): string {
  const principal = p.metricas.find((m) => m.principal)
  return [
    p.variante,
    principal && `${principal.nombre} (${UNIDAD_PRUEBA[principal.unidad]})`,
    p.duracionPrescritaS !== null && `${p.duracionPrescritaS} s`,
    p.instrumento,
  ]
    .filter(Boolean)
    .join(" · ")
}

type Estado = "guardado" | "cambios" | "guardando" | "error" | "conflicto"
const TEXTO_DE_ESTADO: Record<Estado, string> = {
  guardado: "Guardado",
  cambios: "Cambios sin guardar",
  guardando: "Guardando…",
  error: "No se pudo guardar",
  conflicto: "Otra edición se guardó antes",
}

type Abierto =
  | { tipo: "corporal"; id: string | null; bloque: BloqueCorporal }
  | { tipo: "prueba"; id: string | null }

export function EditorPlantilla({
  plantilla,
  guardar,
  nuevoId,
  cerrar,
  recargar,
}: {
  plantilla: PlantillaValoracion
  guardar: (datos: GuardarPlantillaValoracion) => Promise<PlantillaValoracion>
  nuevoId: () => string
  cerrar: () => void
  /** Sin ella no se ofrece «Conservar mi edición» y cargar la guardada cierra el editor. */
  recargar?: () => Promise<PlantillaValoracion>
}): React.JSX.Element {
  const [guardada, setGuardada] = useState(plantilla)
  const [corporales, setCorporales] = useState(plantilla.corporales)
  const [pruebas, setPruebas] = useState(plantilla.pruebas)
  const [estado, setEstado] = useState<Estado>("guardado")
  const [error, setError] = useState("")
  const [abierto, setAbierto] = useState<Abierto | null>(null)
  /** Qué botón del conflicto está cargando la versión guardada. */
  const [recargando, setRecargando] = useState<"guardada" | "mia" | null>(null)
  const enCurso = useRef(false)
  // Mientras se guarda o se recarga nada se edita ni se cierra: el resultado
  // puede ser un error y la edición tiene que seguir aquí para verlo.
  const bloqueado = estado === "guardando" || recargando !== null

  const tocar = (): void => {
    if (estado === "conflicto") return
    setEstado("cambios")
    setError("")
  }
  const cambiarCorporales = (lista: DefinicionCorporal[]): void => {
    if (enCurso.current) return
    setCorporales(lista)
    tocar()
  }
  const cambiarPruebas = (lista: DefinicionPrueba[]): void => {
    if (enCurso.current) return
    setPruebas(lista)
    tocar()
  }
  const abrir = (que: Abierto): void => {
    if (!enCurso.current) setAbierto(que)
  }

  const enviar = async (): Promise<void> => {
    if (enCurso.current) return
    if (corporales.length > 60 || pruebas.length > 20) {
      setError("La plantilla admite 60 campos corporales y 20 pruebas como máximo.")
      return
    }
    const datos: GuardarPlantillaValoracion = { revision: guardada.revision, corporales, pruebas }
    const valida = GuardarPlantillaValoracionSchema.safeParse(datos)
    if (!valida.success) {
      setError(problemaDe(valida.error.issues))
      return
    }
    enCurso.current = true
    setEstado("guardando")
    setError("")
    try {
      const nueva = await guardar(datos)
      setGuardada(nueva)
      setCorporales(nueva.corporales)
      setPruebas(nueva.pruebas)
      setEstado("guardado")
    } catch (fallo) {
      if (fallo instanceof ErrorDePeticion && fallo.detalle.codigo === "revision_obsoleta") {
        setEstado("conflicto")
        setError(
          recargar
            ? "Otra edición de esta plantilla se guardó antes. Tu edición sigue aquí: carga la versión guardada o conserva la tuya y vuelve a guardar."
            : "Otra edición de esta plantilla se guardó antes. Ciérrala y vuelve a abrirla para ver la versión guardada.",
        )
      } else {
        setEstado("error")
        setError(faltaDe(fallo, "No se pudo guardar la plantilla. Tu edición sigue aquí.").texto)
      }
    } finally {
      enCurso.current = false
    }
  }

  const resolver = async (conservar: boolean): Promise<void> => {
    if (enCurso.current) return
    if (!recargar) {
      cerrar()
      return
    }
    enCurso.current = true
    setRecargando(conservar ? "mia" : "guardada")
    try {
      const actual = await recargar()
      setCorporales(
        conservar
          ? combinar(
              corporales,
              guardada.corporales,
              actual.corporales,
              versionarDefinicionCorporal,
              JUNTOS_CORPORAL,
            )
          : actual.corporales,
      )
      setPruebas(
        conservar
          ? combinar(pruebas, guardada.pruebas, actual.pruebas, versionarDefinicionPrueba)
          : actual.pruebas,
      )
      setGuardada(actual)
      setEstado(conservar ? "cambios" : "guardado")
      setError("")
    } catch (fallo) {
      setError(faltaDe(fallo, "No se pudo cargar la versión guardada.").texto)
    } finally {
      enCurso.current = false
      setRecargando(null)
    }
  }

  if (abierto?.tipo === "corporal") {
    const actual = corporales.find((d) => d.id === abierto.id) ?? null
    return (
      <FormularioCorporal
        actual={actual}
        guardada={guardada.corporales.find((d) => d.id === abierto.id) ?? null}
        bloque={abierto.bloque}
        nuevoId={nuevoId}
        aplicar={(definicion) => {
          cambiarCorporales(reemplazar(corporales, definicion))
          setAbierto(null)
        }}
        cancelar={() => setAbierto(null)}
      />
    )
  }
  if (abierto?.tipo === "prueba") {
    return (
      <FormularioPrueba
        actual={pruebas.find((p) => p.id === abierto.id) ?? null}
        guardada={guardada.pruebas.find((p) => p.id === abierto.id) ?? null}
        nuevoId={nuevoId}
        aplicar={(definicion) => {
          cambiarPruebas(reemplazar(pruebas, definicion))
          setAbierto(null)
        }}
        cancelar={() => setAbierto(null)}
      />
    )
  }

  return (
    <View style={s.contenido}>
      <View style={s.cabecera}>
        <View style={s.textos}>
          <Text style={s.titulo} accessibilityRole="header">
            Plantilla de valoración
          </Text>
          <Text
            style={[s.tenue, (estado === "error" || estado === "conflicto") && s.aviso]}
            accessibilityLiveRegion="polite"
          >
            {TEXTO_DE_ESTADO[estado]}
          </Text>
        </View>
        <Accion texto="Cerrar" etiqueta="Cerrar" deshabilitada={bloqueado} pulsar={cerrar} />
      </View>
      <Text style={s.tenue}>Se copia a las visitas nuevas. Las visitas ya creadas no cambian.</Text>

      {BLOQUES.map(({ valor: bloque, texto }) => {
        const lista = corporales.filter((d) => d.bloque === bloque)
        return (
          <Seccion
            key={bloque}
            titulo={texto}
            vacia={lista.length === 0}
            anadir={
              <BotonSecundario
                texto="Añadir campo"
                etiquetaAccesible={`Añadir campo a ${texto}`}
                deshabilitado={bloqueado}
                onPress={() => abrir({ tipo: "corporal", id: null, bloque })}
              />
            }
          >
            <Filas
              grupo={lista}
              todas={corporales}
              guardadas={guardada.corporales}
              cambiar={cambiarCorporales}
              bloqueado={bloqueado}
              detalle={detalleCorporal}
              etiqueta={etiquetaCorporal}
              editar={(d) => abrir({ tipo: "corporal", id: d.id, bloque })}
            />
          </Seccion>
        )
      })}

      <Seccion
        titulo="Pruebas físicas"
        vacia={pruebas.length === 0}
        anadir={
          <BotonSecundario
            texto="Añadir prueba"
            deshabilitado={bloqueado}
            onPress={() => abrir({ tipo: "prueba", id: null })}
          />
        }
      >
        <Filas
          grupo={pruebas}
          todas={pruebas}
          guardadas={guardada.pruebas}
          cambiar={cambiarPruebas}
          bloqueado={bloqueado}
          detalle={detallePrueba}
          etiqueta={etiquetaPrueba}
          editar={(p) => abrir({ tipo: "prueba", id: p.id })}
        />
      </Seccion>

      {error !== "" && <AvisoDeError mensaje={error} />}
      {estado === "conflicto" ? (
        <View style={s.grupo}>
          <BotonSecundario
            texto="Cargar versión guardada"
            ocupado={recargando === "guardada"}
            deshabilitado={bloqueado}
            onPress={() => void resolver(false)}
          />
          {recargar && (
            <BotonSecundario
              texto="Conservar mi edición"
              ocupado={recargando === "mia"}
              deshabilitado={bloqueado}
              onPress={() => void resolver(true)}
            />
          )}
        </View>
      ) : (
        <BotonPrincipal
          texto="Guardar plantilla"
          ocupado={bloqueado}
          onPress={() => void enviar()}
        />
      )}
    </View>
  )
}

function Seccion({
  titulo,
  vacia,
  anadir,
  children,
}: {
  titulo: string
  vacia: boolean
  anadir: ReactNode
  children: ReactNode
}): React.JSX.Element {
  return (
    <View style={s.grupo}>
      <Titulo>{titulo}</Titulo>
      {vacia ? <Text style={s.tenue}>Nada todavía.</Text> : <Tarjeta>{children}</Tarjeta>}
      {anadir}
    </View>
  )
}

type Definicion = { id: string; version: number; nombre: string; activa: boolean }

/**
 * Filas de un grupo. Subir y bajar intercambian con la vecina del mismo grupo
 * dentro de la lista completa, que es la que se envía.
 */
function Filas<T extends Definicion>({
  grupo,
  todas,
  guardadas,
  cambiar,
  bloqueado,
  detalle,
  etiqueta,
  editar,
}: {
  grupo: T[]
  todas: T[]
  guardadas: T[]
  cambiar: (lista: T[]) => void
  bloqueado: boolean
  detalle: (d: T) => string
  etiqueta: (d: T) => string
  editar: (d: T) => void
}): React.JSX.Element {
  return (
    <>
      {grupo.map((d, n) => {
        const previa = guardadas.find((g) => g.id === d.id)
        const con = (paso: number) => {
          const vecina = grupo[n + paso]
          return vecina ? () => cambiar(intercambiar(todas, d.id, vecina.id)) : null
        }
        return (
          <FilaDefinicion
            key={d.id}
            primera={n === 0}
            titulo={d.nombre}
            detalle={detalle(d)}
            etiqueta={etiqueta(d)}
            activa={d.activa}
            nueva={!previa}
            nuevaVersion={previa !== undefined && d.version > previa.version}
            bloqueado={bloqueado}
            subir={con(-1)}
            bajar={con(1)}
            editar={() => editar(d)}
            retirar={() =>
              cambiar(
                previa
                  ? reemplazar(todas, { ...d, activa: !d.activa })
                  : todas.filter((x) => x.id !== d.id),
              )
            }
          />
        )
      })}
    </>
  )
}

function Accion({
  texto,
  etiqueta,
  pulsar,
  deshabilitada,
}: {
  texto: string
  etiqueta: string
  pulsar: () => void
  deshabilitada: boolean
}): React.JSX.Element {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={etiqueta}
      accessibilityState={{ disabled: deshabilitada }}
      disabled={deshabilitada}
      onPress={pulsar}
      style={({ pressed }) => [s.accion, (pressed || deshabilitada) && s.apagada]}
    >
      <Text style={s.textoAccion}>{texto}</Text>
    </Pressable>
  )
}

function FilaDefinicion({
  primera,
  titulo,
  detalle,
  etiqueta,
  activa,
  nueva,
  nuevaVersion,
  bloqueado,
  subir,
  bajar,
  editar,
  retirar,
}: {
  primera: boolean
  titulo: string
  detalle: string
  /** Nombre accesible de las acciones: «Subir Brazo (derecha)». */
  etiqueta: string
  activa: boolean
  /** Aún no guardada: se puede quitar. Lo guardado solo se desactiva. */
  nueva: boolean
  nuevaVersion: boolean
  bloqueado: boolean
  subir: (() => void) | null
  bajar: (() => void) | null
  editar: () => void
  retirar: () => void
}): React.JSX.Element {
  const retiro = nueva ? "Quitar" : activa ? "Desactivar" : "Activar"
  return (
    <Fila primera={primera}>
      <View style={s.textos}>
        <Text style={[s.nombre, !activa && s.inactiva]}>{titulo}</Text>
        {detalle !== "" && <Text style={s.tenue}>{detalle}</Text>}
        {nueva && <Text style={s.marca}>Nuevo, sin guardar</Text>}
        {!activa && <Text style={s.tenue}>Desactivado: no se copiará a visitas nuevas</Text>}
        {nuevaVersion && <AvisoVersion />}
        <View style={s.acciones}>
          <Accion
            texto="↑"
            etiqueta={`Subir ${etiqueta}`}
            deshabilitada={bloqueado || !subir}
            pulsar={() => subir?.()}
          />
          <Accion
            texto="↓"
            etiqueta={`Bajar ${etiqueta}`}
            deshabilitada={bloqueado || !bajar}
            pulsar={() => bajar?.()}
          />
          <Accion
            texto="Editar"
            etiqueta={`Editar ${etiqueta}`}
            deshabilitada={bloqueado}
            pulsar={editar}
          />
          <Accion
            texto={retiro}
            etiqueta={`${retiro} ${etiqueta}`}
            deshabilitada={bloqueado}
            pulsar={retirar}
          />
        </View>
      </View>
    </Fila>
  )
}

function AvisoVersion(): React.JSX.Element {
  return (
    <Text style={s.aviso} accessibilityLiveRegion="polite">
      {AVISO_VERSION}
    </Text>
  )
}

function Grupo({ etiqueta, children }: { etiqueta: string; children: ReactNode }) {
  return (
    <View style={s.grupoCampo}>
      <Text style={s.etiqueta}>{etiqueta}</Text>
      {children}
    </View>
  )
}

type FormCorporal = {
  bloque: BloqueCorporal
  magnitud: MagnitudCorporal | null
  unidad: UnidadCorporal | null
  nombre: string
  zona: string
  lado: Lado
  instrumento: string
  protocolo: string
}

/** Tras cambiar bloque o magnitud, descarta lo que ya no cabe y elige lo que es único. */
function ajustar(f: FormCorporal): FormCorporal {
  const magnitudes = PERMITIDAS[f.bloque].map((p) => p.magnitud)
  const magnitud = f.magnitud && magnitudes.includes(f.magnitud) ? f.magnitud : unica(magnitudes)
  const unidades = magnitud ? unidadesDe(f.bloque, magnitud) : []
  const unidad = f.unidad && unidades.includes(f.unidad) ? f.unidad : unica(unidades)
  return { ...f, magnitud, unidad }
}

function construirCorporal(
  f: FormCorporal,
  id: string,
  actual: DefinicionCorporal | null,
): DefinicionCorporal | null {
  if (!f.magnitud || !f.unidad) return null
  return {
    id,
    version: actual?.version ?? 1,
    bloque: f.bloque,
    magnitud: f.magnitud,
    nombre: f.nombre.trim(),
    unidad: f.unidad,
    zona: textoONulo(f.zona),
    lateralidad: f.lado === "ninguna" ? null : f.lado,
    instrumento: textoONulo(f.instrumento),
    protocolo: textoONulo(f.protocolo),
    activa: actual?.activa ?? true,
  }
}

function FormularioCorporal({
  actual,
  guardada,
  bloque,
  nuevoId,
  aplicar,
  cancelar,
}: {
  actual: DefinicionCorporal | null
  /** La versión guardada, contra la que se decide si hay versión nueva. */
  guardada: DefinicionCorporal | null
  bloque: BloqueCorporal
  nuevoId: () => string
  aplicar: (definicion: DefinicionCorporal) => void
  cancelar: () => void
}): React.JSX.Element {
  const [f, setF] = useState<FormCorporal>(() =>
    ajustar({
      bloque: actual?.bloque ?? bloque,
      magnitud: actual?.magnitud ?? null,
      unidad: actual?.unidad ?? null,
      nombre: actual?.nombre ?? "",
      zona: actual?.zona ?? "",
      lado: actual?.lateralidad ?? "ninguna",
      instrumento: actual?.instrumento ?? "",
      protocolo: actual?.protocolo ?? "",
    }),
  )
  const [error, setError] = useState("")
  const id = useRef(actual?.id ?? null)
  const cambiar = (cambio: Partial<FormCorporal>): void =>
    setF((previo) => ajustar({ ...previo, ...cambio }))
  const candidata = guardada ? construirCorporal(f, guardada.id, actual) : null
  const sube =
    guardada !== null &&
    candidata !== null &&
    versionarDefinicionCorporal(guardada, candidata).version > guardada.version

  const enviar = (): void => {
    if (!f.magnitud) return setError("Elige qué se mide.")
    if (!f.unidad) return setError("Elige la unidad.")
    if (f.nombre.trim() === "") return setError("Escribe el nombre.")
    if (conAngulos([f.nombre, f.zona, f.instrumento, f.protocolo]))
      return setError("Escribe los textos sin los signos < y >.")
    id.current ??= nuevoId()
    const definicion = construirCorporal(f, id.current, actual)!
    const valida = DefinicionCorporalSchema.safeParse(definicion)
    if (!valida.success) return setError(problemaDe(valida.error.issues))
    aplicar(guardada ? versionarDefinicionCorporal(guardada, definicion) : definicion)
  }

  return (
    <View style={s.contenido}>
      <Text style={s.titulo} accessibilityRole="header">
        {actual ? "Editar campo" : "Nuevo campo"}
      </Text>
      <Grupo etiqueta="Bloque">
        <Chips
          etiqueta="Bloque"
          opciones={BLOQUES}
          elegidas={[f.bloque]}
          cambiar={([valor]) => valor && cambiar({ bloque: valor })}
        />
      </Grupo>
      <Grupo etiqueta="Qué se mide">
        <Chips
          etiqueta="Qué se mide"
          opciones={PERMITIDAS[f.bloque].map((p) => ({
            valor: p.magnitud,
            texto: MAGNITUD[p.magnitud],
          }))}
          elegidas={f.magnitud ? [f.magnitud] : []}
          cambiar={([valor]) => valor && cambiar({ magnitud: valor })}
        />
      </Grupo>
      {f.magnitud && (
        <Grupo etiqueta="Unidad">
          <Chips
            etiqueta="Unidad"
            opciones={unidadesDe(f.bloque, f.magnitud).map((u) => ({
              valor: u,
              texto: UNIDAD_CORPORAL[u],
            }))}
            elegidas={f.unidad ? [f.unidad] : []}
            cambiar={([valor]) => valor && cambiar({ unidad: valor })}
          />
        </Grupo>
      )}
      <View>
        <Campo
          etiqueta="Nombre"
          value={f.nombre}
          maxLength={60}
          onChangeText={(nombre) => cambiar({ nombre })}
        />
        <Campo
          etiqueta="Zona (opcional)"
          value={f.zona}
          maxLength={60}
          onChangeText={(zona) => cambiar({ zona })}
        />
      </View>
      <Grupo etiqueta="Lateralidad">
        <Chips
          etiqueta="Lateralidad"
          opciones={LADOS}
          elegidas={[f.lado]}
          cambiar={([valor]) => valor && cambiar({ lado: valor })}
        />
      </Grupo>
      <View>
        <Campo
          etiqueta="Instrumento (opcional)"
          value={f.instrumento}
          maxLength={80}
          onChangeText={(instrumento) => cambiar({ instrumento })}
        />
        <Campo
          etiqueta="Protocolo (opcional)"
          value={f.protocolo}
          maxLength={300}
          multiline
          onChangeText={(protocolo) => cambiar({ protocolo })}
        />
      </View>
      {sube && <AvisoVersion />}
      {error !== "" && <AvisoDeError mensaje={error} />}
      <View>
        <BotonPrincipal
          texto={actual ? "Aplicar cambios" : "Añadir a la plantilla"}
          onPress={enviar}
        />
        <BotonSecundario texto="Cancelar" onPress={cancelar} />
      </View>
    </View>
  )
}

type FormPrueba = {
  tipo: TipoDePrueba | null
  nombre: string
  variante: string
  protocolo: string
  instrumento: string
  duracion: string
  /** Solo personalizada: nombre y unidad de la métrica principal. */
  metrica: string
  unidad: UnidadDePrueba | null
}

function formPrueba(p: DefinicionPrueba | null): FormPrueba {
  const principal = p?.metricas.find((m) => m.principal)
  return {
    tipo: p?.tipo ?? null,
    nombre: p?.nombre ?? "",
    variante: p?.variante ?? "",
    protocolo: p?.protocolo ?? "",
    instrumento: p?.instrumento ?? "",
    duracion: p?.duracionPrescritaS == null ? "" : String(p.duracionPrescritaS),
    metrica: principal?.nombre ?? "",
    unidad: principal?.unidad ?? null,
  }
}

/** Segundos enteros de 1 a 3600; vacío es «sin duración prescrita». */
function leerDuracion(texto: string): number | null | undefined {
  const limpio = texto.trim()
  if (limpio === "") return null
  const valor = /^\d{1,4}$/.test(limpio) ? Number(limpio) : NaN
  return valor >= 1 && valor <= 3_600 ? valor : undefined
}

const ID_PROVISIONAL = "00000000-0000-4000-8000-000000000000"

function construirPrueba(
  f: FormPrueba & { tipo: TipoDePrueba },
  id: string,
  actual: DefinicionPrueba | null,
): DefinicionPrueba {
  const base = actual ?? (f.tipo === "personalizada" ? null : crearPruebaEstandar(f.tipo, id))
  const principal = {
    clave: "resultado",
    nombre: f.metrica.trim() || "Resultado",
    unidad: f.unidad ?? "puntos",
    principal: true,
    opcional: false,
  }
  const metricas =
    f.tipo !== "personalizada"
      ? base!.metricas
      : (base?.metricas.map((m) =>
          m.principal ? { ...m, nombre: principal.nombre, unidad: principal.unidad } : m,
        ) ?? [principal])
  return {
    id,
    version: actual?.version ?? 1,
    tipo: f.tipo,
    nombre: f.nombre.trim(),
    variante: textoONulo(f.variante),
    protocolo: textoONulo(f.protocolo),
    duracionPrescritaS: DURACION_FIJA.includes(f.tipo)
      ? (base?.duracionPrescritaS ?? null)
      : (leerDuracion(f.duracion) ?? null),
    instrumento: textoONulo(f.instrumento),
    metricas,
    activa: actual?.activa ?? true,
  }
}

function FormularioPrueba({
  actual,
  guardada,
  nuevoId,
  aplicar,
  cancelar,
}: {
  actual: DefinicionPrueba | null
  guardada: DefinicionPrueba | null
  nuevoId: () => string
  aplicar: (definicion: DefinicionPrueba) => void
  cancelar: () => void
}): React.JSX.Element {
  const [f, setF] = useState<FormPrueba>(() => formPrueba(actual))
  const [error, setError] = useState("")
  const id = useRef(actual?.id ?? null)
  const cambiar = (cambio: Partial<FormPrueba>): void =>
    setF((previo) => ({ ...previo, ...cambio }))
  const elegirTipo = (tipo: TipoDePrueba): void =>
    setF((previo) => ({
      ...formPrueba(tipo === "personalizada" ? null : crearPruebaEstandar(tipo, ID_PROVISIONAL)),
      tipo,
      variante: previo.variante,
      protocolo: previo.protocolo,
    }))
  const tipo = f.tipo
  const sube =
    guardada !== null &&
    tipo !== null &&
    versionarDefinicionPrueba(guardada, construirPrueba({ ...f, tipo }, guardada.id, actual))
      .version > guardada.version

  const enviar = (): void => {
    if (!tipo) return setError("Elige una prueba.")
    if (f.nombre.trim() === "") return setError("Escribe el nombre.")
    if (tipo === "personalizada" && !f.unidad) return setError("Elige la unidad.")
    if (!DURACION_FIJA.includes(tipo) && leerDuracion(f.duracion) === undefined)
      return setError("Escribe la duración en segundos enteros, de 1 a 3600.")
    if (conAngulos([f.nombre, f.variante, f.protocolo, f.instrumento, f.metrica]))
      return setError("Escribe los textos sin los signos < y >.")
    id.current ??= nuevoId()
    const definicion = construirPrueba({ ...f, tipo }, id.current, actual)
    const valida = DefinicionPruebaSchema.safeParse(definicion)
    if (!valida.success) return setError(problemaDe(valida.error.issues))
    aplicar(guardada ? versionarDefinicionPrueba(guardada, definicion) : definicion)
  }

  return (
    <View style={s.contenido}>
      <Text style={s.titulo} accessibilityRole="header">
        {actual ? "Editar prueba" : "Nueva prueba"}
      </Text>
      {actual ? (
        <Text style={s.tenue}>Prueba: {NOMBRE_DE_TIPO[actual.tipo]}</Text>
      ) : (
        <Grupo etiqueta="Prueba">
          <Chips
            etiqueta="Prueba"
            opciones={TIPOS}
            elegidas={tipo ? [tipo] : []}
            cambiar={([valor]) => valor && elegirTipo(valor)}
          />
        </Grupo>
      )}
      {tipo && (
        <>
          <View>
            <Campo
              etiqueta="Nombre"
              value={f.nombre}
              maxLength={60}
              onChangeText={(nombre) => cambiar({ nombre })}
            />
            <Campo
              etiqueta="Variante (opcional)"
              value={f.variante}
              maxLength={80}
              onChangeText={(variante) => cambiar({ variante })}
            />
            {tipo === "personalizada" && (
              <Campo
                etiqueta="Qué se anota (opcional)"
                value={f.metrica}
                maxLength={40}
                onChangeText={(metrica) => cambiar({ metrica })}
              />
            )}
          </View>
          {tipo === "personalizada" && (
            <Grupo etiqueta="Unidad">
              <Chips
                etiqueta="Unidad"
                opciones={UNIDADES_DE_PRUEBA.map((u) => ({ valor: u, texto: UNIDAD_PRUEBA[u] }))}
                elegidas={f.unidad ? [f.unidad] : []}
                cambiar={([valor]) => valor && cambiar({ unidad: valor })}
              />
            </Grupo>
          )}
          <View>
            {DURACION_FIJA.includes(tipo) ? (
              <Text style={[s.tenue, s.separado]}>Duración prescrita: 60 s</Text>
            ) : (
              <Campo
                etiqueta="Duración prescrita en segundos (opcional)"
                value={f.duracion}
                keyboardType="number-pad"
                maxLength={4}
                onChangeText={(duracion) => cambiar({ duracion })}
              />
            )}
            <Campo
              etiqueta="Instrumento (opcional)"
              value={f.instrumento}
              maxLength={80}
              onChangeText={(instrumento) => cambiar({ instrumento })}
            />
            <Campo
              etiqueta="Protocolo (opcional)"
              value={f.protocolo}
              maxLength={300}
              multiline
              onChangeText={(protocolo) => cambiar({ protocolo })}
            />
          </View>
        </>
      )}
      {sube && <AvisoVersion />}
      {error !== "" && <AvisoDeError mensaje={error} />}
      <View>
        <BotonPrincipal
          texto={actual ? "Aplicar cambios" : "Añadir a la plantilla"}
          onPress={enviar}
        />
        <BotonSecundario texto="Cancelar" onPress={cancelar} />
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  contenido: { gap: 20 },
  grupo: { gap: 12 },
  grupoCampo: { gap: 8 },
  cabecera: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  textos: { flex: 1, minWidth: 0, gap: 4 },
  titulo: { color: tema.texto, fontFamily: tema.fuenteBoton, fontSize: 20 },
  etiqueta: { color: tema.texto, fontFamily: tema.fuenteSemi, fontSize: 15 },
  nombre: { color: tema.texto, fontFamily: tema.fuenteSemi, fontSize: 16 },
  inactiva: { color: tema.textoTenue },
  tenue: { color: tema.textoTenue, fontFamily: tema.fuenteTexto, fontSize: 13, lineHeight: 18 },
  separado: { marginTop: 16 },
  marca: { color: tema.acento, fontFamily: tema.fuenteSemi, fontSize: 13 },
  aviso: { color: tema.aviso, fontFamily: tema.fuenteSemi, fontSize: 13, lineHeight: 18 },
  acciones: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 },
  accion: {
    minHeight: 44,
    minWidth: 44,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: tema.bordeFuerte,
    alignItems: "center",
    justifyContent: "center",
  },
  apagada: { opacity: 0.5 },
  textoAccion: { color: tema.texto, fontFamily: tema.fuenteSemi, fontSize: 14 },
})
