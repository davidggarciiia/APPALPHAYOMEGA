import { useMemo, useState } from "react"
import { ScrollView, StyleSheet, Text, View } from "react-native"
import type { EstadoMedio, MedioFoto, VistaFoto } from "@alpha-omega/shared"

import { hoyAgenda } from "../entrenamiento/fechas"
import { Chips, Dialogo } from "../entrenamiento/sesion/controles"
import { degradadoOro, tema } from "../tema"
import { DeslizadorFotos } from "./deslizador-fotos"
import {
  NOMBRE_DE_VISTA,
  VISTAS_ESTANDAR,
  fechaConAno as fecha,
  haceDias,
  separacion,
  type VistaEstandar,
} from "./fotos-modelo"
import { Accion, ImagenPrivada } from "./imagen-privada"
import type { ApiMedios } from "./medios-api"
import { Pulsable } from "../componentes/pulsable"

type Api = Pick<ApiMedios, "acceso" | "borrar">
type Hueco = "primera" | "segunda"
const HUECOS: Hueco[] = ["primera", "segunda"]
/** Foto elegida a mano, con su nombre por si deja de llegar en la lista. */
type Eleccion = { id: string; etiqueta: string }
/** `fallo` se queda hasta que el servidor confirma la retirada. */
type Retiro = { enCurso: boolean; fallo: boolean }
/** Lado a lado, o las dos en el mismo marco con un divisor que se arrastra. */
type Modo = "lado" | "deslizar"
const MODOS: Array<{ valor: Modo; texto: string }> = [
  { valor: "lado", texto: "Lado a lado" },
  { valor: "deslizar", texto: "Deslizar" },
]

/**
 * Una foto elegida desde fuera (la galería): el comparador pasa a su vista y la
 * pone en el segundo hueco, o en el primero si es la más antigua. `vez` cambia
 * en cada petición, también si se vuelve a pedir la misma foto.
 */
export type EnfoqueFoto = { medioId: string; vez: number }

const VISTAS = NOMBRE_DE_VISTA
const ORDEN_VISTAS: VistaFoto[] = [...VISTAS_ESTANDAR, "otra"]
const NOTA_ALMACEN = "El borrado del almacén aún no ha terminado."
/** Dos columnas de al menos 140 px y la separación; si no caben, una debajo de otra. */
const ANCHO_LADO_A_LADO = 2 * 140 + 12
/** Un borrado no se deshace: entre la lista recibida y lo confirmado gana lo más avanzado. */
const AVANCE: Record<EstadoMedio, number> = {
  pendiente: 0,
  disponible: 1,
  eliminando: 2,
  eliminado: 3,
}

const retirada = (foto: MedioFoto): boolean =>
  foto.estado === "eliminado" || foto.estado === "eliminando"

/** Sin tildes, mayúsculas ni espacios de más: «perfil  Izquierdo» es «Perfil izquierdo». */
const comparable = (texto: string): string =>
  texto.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim().toLowerCase()
const NOMBRES_ESTANDAR = new Set(Object.values(VISTAS).map(comparable))
/** Una «otra» que se llama como una vista estándar no puede parecer esa vista. */
const nombreDeOtra = (etiqueta: string): string =>
  NOMBRES_ESTANDAR.has(comparable(etiqueta)) ? `Otra: ${etiqueta}` : etiqueta

/** «a», «a ni b», «a, b ni c». */
const enumerar = (nombres: string[]): string =>
  nombres.length < 2
    ? nombres.join("")
    : `${nombres.slice(0, -1).join(", ")} ni ${nombres[nombres.length - 1]}`

/** Cómo se nombra una foto dentro de su vista. */
type Rotulo = {
  /** Opción de fecha: «24 sep 2026 · Clienta Demo». */
  texto: string
  /** Lo mismo para el lector: «24 sep 2026, subida por Clienta Demo». */
  accesible: string
  /** Título visible sobre la foto; quién la subió ya va debajo. */
  titulo: string
}

/** Fotos comparables entre sí: misma vista y, en «otra», misma etiqueta. */
type Grupo = {
  clave: string
  nombre: string
  enFrase: string
  /** De la más antigua a la más reciente. */
  fotos: MedioFoto[]
  rotulos: Map<string, Rotulo>
}

function agrupar(fotos: MedioFoto[]): Grupo[] {
  const grupos = new Map<string, Grupo>()
  for (const foto of fotos) {
    // Una foto pendiente aún no existe para nadie: ni se compara ni se anuncia.
    if (foto.estado === "pendiente") continue
    const otra = foto.vista === "otra"
    const clave = otra ? `otra:${foto.etiqueta ?? ""}` : foto.vista
    const nombre = otra
      ? nombreDeOtra(foto.etiqueta ?? "Otra")
      : VISTAS[foto.vista as VistaEstandar]
    const grupo: Grupo = grupos.get(clave) ?? {
      clave,
      nombre,
      enFrase: otra ? `«${nombre}»` : nombre.toLowerCase(),
      fotos: [],
      rotulos: new Map(),
    }
    grupo.fotos.push(foto)
    grupos.set(clave, grupo)
  }
  const lista = [...grupos.values()]
  for (const grupo of lista) {
    grupo.fotos.sort(
      (a, b) => a.fechaToma.localeCompare(b.fechaToma) || a.creadoEn.localeCompare(b.creadoEn),
    )
    grupo.rotulos = rotulosDeFecha(grupo.fotos)
  }
  const posicion = (g: Grupo): number => ORDEN_VISTAS.indexOf(g.fotos[0]!.vista)
  return lista.sort((a, b) => posicion(a) - posicion(b) || a.nombre.localeCompare(b.nombre, "es"))
}

/**
 * «24 sep 2026»; si el mismo día hay dos fotos de la vista, se añade quién la
 * subió, y si también coincide, un número.
 */
function rotulosDeFecha(fotos: MedioFoto[]): Grupo["rotulos"] {
  const veces = new Map<string, number>()
  for (const f of fotos) veces.set(f.fechaToma, (veces.get(f.fechaToma) ?? 0) + 1)
  const usados = new Map<string, number>()
  const rotulos: Grupo["rotulos"] = new Map()
  for (const f of fotos) {
    const dia = fecha(f.fechaToma)
    if ((veces.get(f.fechaToma) ?? 0) < 2) {
      rotulos.set(f.id, { texto: dia, accesible: dia, titulo: dia })
      continue
    }
    const clave = `${f.fechaToma} ${f.autor.nombre}`
    const repetido = (usados.get(clave) ?? 0) + 1
    usados.set(clave, repetido)
    const orden = repetido > 1 ? ` (${repetido})` : ""
    rotulos.set(f.id, {
      texto: `${dia} · ${f.autor.nombre}${orden}`,
      accesible: `${dia}, subida por ${f.autor.nombre}${orden}`,
      titulo: `${dia}${orden}`,
    })
  }
  return rotulos
}

/** Nombre completo de una foto en todas sus etiquetas: «Frente, 24 sep 2026». */
const etiquetaDe = (grupo: Grupo, foto: MedioFoto): string =>
  `${grupo.nombre}, ${grupo.rotulos.get(foto.id)!.accesible}`

/** Las dos del mismo día: se explica, con quién subió cada una. */
function textoMismoDia(primera: MedioFoto, segunda: MedioFoto): string {
  const dia = `Las dos fotos son del mismo día (${fecha(primera.fechaToma)})`
  return primera.autor.nombre === segunda.autor.nombre
    ? `${dia} y las subió ${primera.autor.nombre}.`
    : `${dia}: una la subió ${primera.autor.nombre} y la otra, ${segunda.autor.nombre}.`
}

function textoPerdidas(etiquetas: string[], hayOtraFecha: boolean): string {
  const lista = etiquetas.join(" y ")
  const frase =
    etiquetas.length === 1
      ? `La foto elegida (${lista}) ha dejado de estar en la lista.`
      : `Las fotos elegidas (${lista}) han dejado de estar en la lista.`
  return hayOtraFecha ? `${frase} Se vuelve a comparar la más antigua con la más reciente.` : frase
}

/**
 * Comparación de fotos de evolución: dos fechas de la misma vista, lado a lado
 * o superpuestas con un divisor que se arrastra. Nunca rellena un hueco con
 * otra vista ni con otra fecha; lo que falta se dice con texto. Los enlaces de
 * lectura solo viven en memoria mientras se muestra la foto.
 * `api` debe ser estable entre renderizados (como el de `useMedios`).
 */
export function ComparadorFotos({
  fotos,
  api,
  puedeBorrar,
  hoy = hoyAgenda(),
  enfoque,
  alRetirar,
}: {
  fotos: MedioFoto[]
  api: Api
  puedeBorrar: (foto: MedioFoto) => boolean
  /** Para contar los días transcurridos («Hace 84 días»). */
  hoy?: string
  enfoque?: EnfoqueFoto
  /** La retirada que confirma el servidor, para que quien da la lista la actualice. */
  alRetirar?: (medio: MedioFoto) => void
}): React.JSX.Element {
  const [confirmadas, setConfirmadas] = useState<Record<string, MedioFoto>>({})
  const [retiros, setRetiros] = useState<Record<string, Retiro>>({})
  const [aBorrar, setABorrar] = useState<{ foto: MedioFoto; etiqueta: string } | null>(null)
  const [vista, setVista] = useState<string | null>(null)
  const [elegidas, setElegidas] = useState<Record<string, Partial<Record<Hueco, Eleccion>>>>({})
  /** Elecciones que dejaron de llegar en la lista, para avisar en su vista. */
  const [perdidas, setPerdidas] = useState<{ clave: string; etiquetas: string[] } | null>(null)
  const [ancho, setAncho] = useState(0)
  const [modo, setModo] = useState<Modo>("lado")
  const [enfocada, setEnfocada] = useState<number | null>(null)

  const grupos = useMemo(
    () =>
      agrupar(
        fotos.map((f) => {
          const confirmada = confirmadas[f.id]
          return confirmada && AVANCE[confirmada.estado] > AVANCE[f.estado] ? confirmada : f
        }),
      ),
    [fotos, confirmadas],
  )

  if (grupos.length === 0) {
    return <Text style={s.explicacion}>Aún no hay fotos para comparar.</Text>
  }

  if (enfoque && enfoque.vez !== enfocada) {
    // Ajuste durante el render, como el de las fotos desaparecidas: la foto
    // pedida pasa a su vista y a un hueco elegido a mano.
    setEnfocada(enfoque.vez)
    const destino = grupos.find((g) => g.fotos.some((f) => f.id === enfoque.medioId))
    const pedida = destino?.fotos.find((f) => f.id === enfoque.medioId)
    if (destino && pedida) {
      const hueco: Hueco = destino.fotos[0] === pedida ? "primera" : "segunda"
      const nueva: Eleccion = { id: pedida.id, etiqueta: etiquetaDe(destino, pedida) }
      setVista(destino.clave)
      setElegidas((antes) => ({ ...antes, [destino.clave]: { [hueco]: nueva } }))
      setPerdidas(null)
    }
  }

  const claveVista = vista ?? grupos[0]!.clave
  const grupo = grupos.find((g) => g.clave === claveVista)
  const buscar = (medioId: string | undefined): MedioFoto | undefined =>
    medioId === undefined ? undefined : grupo?.fotos.find((f) => f.id === medioId)
  const eleccion = (grupo && elegidas[grupo.clave]) ?? {}
  const desaparecidas = HUECOS.flatMap((hueco) => {
    const elegida = eleccion[hueco]
    return elegida && !buscar(elegida.id) ? [elegida.etiqueta] : []
  })
  if (grupo && desaparecidas.length > 0) {
    // Una foto elegida a mano ya no llega: no se pasa en silencio a otra
    // fecha. Se olvida la elección de la vista y se avisa. Es un ajuste durante
    // el render (patrón de React): se repite el render antes de pintar.
    const clave = grupo.clave
    setElegidas((antes) => {
      const resto = { ...antes }
      delete resto[clave]
      return resto
    })
    setPerdidas({ clave, etiquetas: desaparecidas })
  }
  const vigente = desaparecidas.length > 0 ? {} : eleccion
  const primeraElegida = buscar(vigente.primera?.id)
  const segundaElegida = buscar(vigente.segunda?.id)
  // Por defecto, la más antigua y la más reciente; nunca la que ya ocupa el otro hueco.
  const primera = grupo && (primeraElegida ?? grupo.fotos.find((f) => f !== segundaElegida))
  const segunda =
    grupo && grupo.fotos.length > 1
      ? (segundaElegida ?? [...grupo.fotos].reverse().find((f) => f !== primera))
      : undefined
  const aviso =
    grupo && perdidas?.clave === grupo.clave
      ? textoPerdidas(perdidas.etiquetas, grupo.fotos.length > 1)
      : null
  const sinFotos = VISTAS_ESTANDAR.filter((v) => !grupos.some((g) => g.clave === v)).map((v) =>
    VISTAS[v].toLowerCase(),
  )

  const elegir = (hueco: Hueco, medioId: string): void => {
    const elegida = buscar(medioId)
    if (!grupo || !elegida) return
    const clave = grupo.clave
    const nueva: Eleccion = { id: medioId, etiqueta: etiquetaDe(grupo, elegida) }
    setElegidas((antes) => ({ ...antes, [clave]: { ...antes[clave], [hueco]: nueva } }))
    setPerdidas(null)
  }

  const retirar = (foto: MedioFoto): void => {
    if (retiros[foto.id]?.enCurso) return
    setRetiros((antes) => ({
      ...antes,
      [foto.id]: { enCurso: true, fallo: antes[foto.id]?.fallo ?? false },
    }))
    api.borrar(foto.id).then(
      (medio) => {
        // Solo cambia lo que el servidor confirma, no lo que se pidió.
        setConfirmadas((antes) => ({ ...antes, [medio.id]: medio }))
        setRetiros((antes) => {
          const resto = { ...antes }
          delete resto[foto.id]
          return resto
        })
        alRetirar?.(medio)
      },
      () => setRetiros((antes) => ({ ...antes, [foto.id]: { enCurso: false, fallo: true } })),
    )
  }

  const lado = ancho >= ANCHO_LADO_A_LADO
  const panel = (hueco: Hueco, g: Grupo, foto: MedioFoto, otra?: MedioFoto): React.JSX.Element => (
    <PanelFoto
      key={hueco}
      hueco={hueco}
      grupo={g}
      foto={foto}
      otra={otra}
      lado={lado}
      hoy={hoy}
      elegir={(medioId) => elegir(hueco, medioId)}
      api={api}
      borrable={puedeBorrar(foto)}
      retiro={retiros[foto.id] ?? null}
      pedirBorrado={(etiqueta) => setABorrar({ foto, etiqueta })}
      reintentarBorrado={() => retirar(foto)}
    />
  )

  const dosFechas = grupo && primera && segunda ? { grupo, primera, segunda } : null
  // Se superponen solo dos fotos que se pueden ver; lo retirado se ve lado a lado.
  const visible = (f: MedioFoto): boolean =>
    f.estado === "disponible" && retiros[f.id]?.fallo !== true
  const deslizando = modo === "deslizar" && dosFechas !== null
  const rotuloDeslizable = (g: Grupo, f: MedioFoto) => ({
    medioId: f.id,
    etiqueta: etiquetaDe(g, f),
    rotulo: `${g.rotulos.get(f.id)!.titulo} · ${haceDias(f.fechaToma, hoy)}`,
  })

  return (
    <View style={s.comparador}>
      <Chips
        etiqueta="Vista"
        opciones={grupos.map((g) => ({ valor: g.clave, texto: g.nombre }))}
        elegidas={grupo ? [grupo.clave] : []}
        cambiar={([clave]) => {
          if (!clave) return
          setVista(clave)
          setPerdidas(null)
        }}
      />

      {sinFotos.length > 0 && (
        <Text style={s.explicacion}>{`Sin fotos de ${enumerar(sinFotos)}.`}</Text>
      )}

      {aviso && (
        <Text style={s.aviso} accessibilityRole="alert" accessibilityLiveRegion="polite">
          {aviso}
        </Text>
      )}

      {!grupo && (
        <Text style={s.explicacion} accessibilityLiveRegion="polite">
          Ya no hay fotos de esa vista. Elige otra de la lista.
        </Text>
      )}

      {grupo && primera && !segunda && (
        <Text style={s.explicacion} accessibilityLiveRegion="polite">
          {`Solo hay una foto de ${grupo.enFrase} (${fecha(primera.fechaToma)}). Para comparar hace falta otra de la misma vista con otra fecha.`}
        </Text>
      )}

      {dosFechas && (
        <Chips
          etiqueta="Cómo comparar"
          opciones={MODOS}
          elegidas={[modo]}
          cambiar={([elegido]) => elegido && setModo(elegido)}
        />
      )}

      {dosFechas && dosFechas.primera.fechaToma === dosFechas.segunda.fechaToma ? (
        <Text style={s.explicacion} accessibilityLiveRegion="polite">
          {textoMismoDia(dosFechas.primera, dosFechas.segunda)}
        </Text>
      ) : (
        dosFechas && (
          <Text style={s.separacion}>
            {separacion(dosFechas.primera.fechaToma, dosFechas.segunda.fechaToma)}
          </Text>
        )
      )}

      {deslizando && dosFechas ? (
        <View style={s.comparador}>
          {HUECOS.map((hueco) => {
            const foto = hueco === "primera" ? dosFechas.primera : dosFechas.segunda
            const otra = hueco === "primera" ? dosFechas.segunda : dosFechas.primera
            return (
              <SelectorFecha
                key={hueco}
                hueco={hueco}
                grupo={dosFechas.grupo}
                foto={foto}
                otra={otra}
                elegir={(medioId) => elegir(hueco, medioId)}
              />
            )
          })}
          {visible(dosFechas.primera) && visible(dosFechas.segunda) ? (
            (() => {
              // Antes es siempre la de fecha anterior, se haya elegido en el hueco que sea.
              const [antes, despues] =
                dosFechas.primera.fechaToma <= dosFechas.segunda.fechaToma
                  ? [dosFechas.primera, dosFechas.segunda]
                  : [dosFechas.segunda, dosFechas.primera]
              return (
                <DeslizadorFotos
                  key={`${antes.id}-${despues.id}`}
                  antes={rotuloDeslizable(dosFechas.grupo, antes)}
                  despues={rotuloDeslizable(dosFechas.grupo, despues)}
                  acceso={api.acceso}
                />
              )
            })()
          ) : (
            <Text style={s.explicacion} accessibilityLiveRegion="polite">
              Para deslizar hacen falta dos fotos que se puedan ver. Elige otra fecha o compáralas
              lado a lado.
            </Text>
          )}
        </View>
      ) : (
        grupo &&
        primera && (
          <View
            testID="fotos-comparadas"
            onLayout={(e) => setAncho(e.nativeEvent.layout.width)}
            style={[s.par, lado ? s.ladoALado : s.apiladas]}
          >
            {panel("primera", grupo, primera, segunda)}
            {segunda && panel("segunda", grupo, segunda, primera)}
          </View>
        )
      )}

      <Dialogo
        visible={aBorrar !== null}
        titulo="¿Eliminar esta foto?"
        texto={`${aBorrar?.etiqueta ?? ""}. Se borrará la imagen y en el historial constará como foto retirada. No se puede deshacer.`}
        confirmar="Eliminar"
        cancelar="Cancelar"
        peligro
        alCancelar={() => setABorrar(null)}
        alConfirmar={() => {
          if (!aBorrar) return
          setABorrar(null)
          retirar(aBorrar.foto)
        }}
      />
    </View>
  )
}

/** Fechas de la vista para un hueco; la que ocupa el otro hueco no se puede elegir. */
function SelectorFecha({
  hueco,
  grupo,
  foto,
  otra,
  elegir,
}: {
  hueco: Hueco
  grupo: Grupo
  foto: MedioFoto
  otra: MedioFoto
  elegir: (medioId: string) => void
}): React.JSX.Element {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      accessibilityRole="radiogroup"
      accessibilityLabel={`Fecha de la ${hueco} foto`}
      contentContainerStyle={s.fechas}
    >
      {grupo.fotos.map((f) => {
        const opcion = grupo.rotulos.get(f.id)!
        const marcada = f.id === foto.id
        // La fecha que ya ocupa la otra foto no se compara consigo misma.
        const ocupada = f.id === otra.id
        return (
          <Pulsable
            key={f.id}
            accessibilityRole="radio"
            accessibilityLabel={
              retirada(f) ? `${opcion.accesible}, foto retirada` : opcion.accesible
            }
            accessibilityState={{ checked: marcada, disabled: ocupada }}
            disabled={ocupada}
            onPress={() => elegir(f.id)}
            style={[s.fecha, marcada && [s.fechaElegida, degradadoOro], ocupada && s.fechaOcupada]}
          >
            <Text style={[s.textoFecha, marcada && s.textoFechaElegida]}>{opcion.texto}</Text>
          </Pulsable>
        )
      })}
    </ScrollView>
  )
}

function PanelFoto({
  hueco,
  grupo,
  foto,
  otra,
  lado,
  hoy,
  elegir,
  api,
  borrable,
  retiro,
  pedirBorrado,
  reintentarBorrado,
}: {
  hueco: Hueco
  grupo: Grupo
  foto: MedioFoto
  otra: MedioFoto | undefined
  lado: boolean
  hoy: string
  elegir: (medioId: string) => void
  api: Api
  borrable: boolean
  retiro: Retiro | null
  pedirBorrado: (etiqueta: string) => void
  reintentarBorrado: () => void
}): React.JSX.Element {
  const etiqueta = etiquetaDe(grupo, foto)
  // Un fallo al retirar solo cuenta mientras la foto sigue disponible: si la
  // lista llega con la foto ya retirada, manda la lista.
  const fallo = foto.estado === "disponible" && retiro?.fallo === true
  const enCurso = foto.estado !== "eliminado" && retiro?.enCurso === true
  return (
    <View style={[s.panel, lado ? s.panelLado : s.panelApilado]}>
      {otra && (
        <SelectorFecha hueco={hueco} grupo={grupo} foto={foto} otra={otra} elegir={elegir} />
      )}

      {/* El lector lee la vista y la fecha en la propia imagen o en su hueco. */}
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Text style={s.rotulo}>{`${grupo.nombre}, ${grupo.rotulos.get(foto.id)!.titulo}`}</Text>
      </View>
      <Text style={s.hace}>{haceDias(foto.fechaToma, hoy)}</Text>
      <Text style={s.autor}>Subida por {foto.autor.nombre}</Text>

      {retirada(foto) ? (
        <View
          style={[s.marco, s.hueco]}
          accessible
          accessibilityLabel={
            foto.estado === "eliminando"
              ? `${etiqueta}: foto retirada. ${NOTA_ALMACEN}`
              : `${etiqueta}: foto retirada`
          }
        >
          <Text style={s.textoRetirada}>Foto retirada</Text>
          {foto.estado === "eliminando" && <Text style={s.nota}>{NOTA_ALMACEN}</Text>}
        </View>
      ) : fallo ? (
        // Se pidió retirarla: no se vuelve a mostrar ni se pide su enlace.
        <View
          style={[s.marco, s.hueco]}
          accessible
          accessibilityLabel={`${etiqueta}: pendiente de retirar`}
        >
          <Text style={s.textoRetirada}>Pendiente de retirar</Text>
        </View>
      ) : (
        <ImagenPrivada key={foto.id} medioId={foto.id} etiqueta={etiqueta} acceso={api.acceso} />
      )}

      {fallo && !enCurso && (
        <Text style={s.error} accessibilityRole="alert" accessibilityLiveRegion="assertive">
          No se ha podido retirar la foto: sigue pendiente de retirar.
        </Text>
      )}
      {borrable && foto.estado === "disponible" && !fallo && (
        <Accion
          texto={enCurso ? "Retirando…" : "Eliminar foto"}
          etiqueta={
            enCurso ? `Retirando la foto de ${etiqueta}` : `Eliminar la foto de ${etiqueta}`
          }
          ocupado={enCurso}
          peligro
          onPress={() => pedirBorrado(etiqueta)}
        />
      )}
      {borrable && (fallo || foto.estado === "eliminando") && (
        <Accion
          texto="Reintentar retirada"
          etiqueta={`Reintentar la retirada de ${etiqueta}`}
          ocupado={enCurso}
          peligro
          onPress={reintentarBorrado}
        />
      )}
    </View>
  )
}

const s = StyleSheet.create({
  comparador: { gap: 14 },
  explicacion: {
    color: tema.textoTenue,
    fontFamily: tema.fuenteTexto,
    fontSize: 15,
    lineHeight: 21,
  },
  separacion: { color: tema.texto, fontFamily: tema.fuenteSemi, fontSize: 15 },
  aviso: { color: tema.aviso, fontFamily: tema.fuenteSemi, fontSize: 15, lineHeight: 21 },
  par: { gap: 12 },
  ladoALado: { flexDirection: "row", alignItems: "flex-start" },
  apiladas: { flexDirection: "column" },
  panel: { gap: 8, maxWidth: 480 },
  panelLado: { flex: 1, minWidth: 0 },
  panelApilado: { width: "100%", alignSelf: "center" },
  fechas: { flexDirection: "row", gap: 8 },
  fecha: {
    minHeight: 44,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: tema.bordeFuerte,
    justifyContent: "center",
  },
  fechaElegida: { borderColor: "transparent" },
  fechaOcupada: { opacity: 0.45 },
  textoFecha: { color: tema.texto, fontFamily: tema.fuenteSemi, fontSize: 14 },
  textoFechaElegida: { color: tema.sobreAcento, fontFamily: tema.fuenteBoton },
  rotulo: { color: tema.texto, fontFamily: tema.fuenteBoton, fontSize: 16 },
  hace: { color: tema.acento, fontFamily: tema.fuenteSemi, fontSize: 14 },
  autor: { color: tema.textoTenue, fontFamily: tema.fuenteTexto, fontSize: 13 },
  marco: {
    width: "100%",
    aspectRatio: 3 / 4,
    borderRadius: 12,
    backgroundColor: tema.hundido,
    overflow: "hidden",
  },
  hueco: { alignItems: "center", justifyContent: "center", gap: 10, padding: 12 },
  textoRetirada: {
    color: tema.texto,
    fontFamily: tema.fuenteSemi,
    fontSize: 15,
    textAlign: "center",
  },
  nota: { color: tema.textoTenue, fontFamily: tema.fuenteTexto, fontSize: 13, textAlign: "center" },
  error: { color: tema.error, fontFamily: tema.fuenteSemi, fontSize: 14, textAlign: "center" },
})
