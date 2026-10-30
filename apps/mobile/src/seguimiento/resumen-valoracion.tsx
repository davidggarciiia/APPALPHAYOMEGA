import { useCallback, useRef, useState } from "react"
import { useFocusEffect } from "expo-router"
import { Pressable, StyleSheet, Text, View } from "react-native"
import type {
  BloqueValoracion,
  DefinicionCorporal,
  DefinicionPrueba,
  ProximaRevision,
  PublicacionValoracion,
  ResultadoCorporal,
  ResultadoPrueba,
  ResumenValoracionPublicada,
  TipoValoracion,
} from "@alpha-omega/shared"

import { AvisoDeError, BotonSecundario } from "../componentes/formulario"
import { fechaCorta } from "../entrenamiento/plan/modelo"
import { Fila, Tarjeta, Titulo } from "../entrenamiento/plan/piezas"
import { Enlace } from "../entrenamiento/sesion/controles"
import { tema } from "../tema"
import { decimal } from "./valoracion-modelo"
import type { ApiValoracionesCliente } from "./valoraciones-api"

const PAGINA = 10
const TIPO: Record<TipoValoracion, string> = { inicial: "Valoración inicial", revision: "Revisión" }
const BLOQUE: Record<BloqueValoracion, string> = {
  medidas: "Medidas",
  pliegues: "Pliegues",
  bioimpedancia: "Bioimpedancia",
  pruebas: "Pruebas físicas",
  fotos: "Fotos",
}

/** «10 sep 2026»: entre valoraciones pasan meses, así que el año cuenta. */
const fecha = (dia: string): string => `${fechaCorta(dia)} ${dia.slice(0, 4)}`
/** «82,5 kg»; un índice del fabricante no es kg ni %: se rotula como lo que es. */
const conUnidad = (valor: number, unidad: string): string =>
  unidad === "indice" ? `${decimal(valor)} (índice del fabricante)` : `${decimal(valor)} ${unidad}`

type Publicado<R> = Exclude<R, { estado: "pendiente" }>
type Linea = { texto: string; tono: "tenue" | "fuerte" | "alerta" }
/** Una fila del detalle: nombre, valor a la derecha (si lo hay) y líneas de contexto. */
type Dato = { id: string; nombre: string; valor: string | null; lineas: Linea[] }

const tenue = (texto: string | null | false | undefined): Linea[] =>
  texto ? [{ texto, tono: "tenue" }] : []

/** Cada definición con su resultado publicado; lo que no se publicó no aparece. */
function conResultado<D extends { id: string }, R extends { definicionId: string; estado: string }>(
  definiciones: D[],
  resultados: R[],
): Array<[D, Publicado<R>]> {
  return definiciones.flatMap((d) => {
    const r = resultados.find((x) => x.definicionId === d.id)
    return r && r.estado !== "pendiente" ? [[d, r as Publicado<R>] as [D, Publicado<R>]] : []
  })
}

function datoCorporal(d: DefinicionCorporal, r: Publicado<ResultadoCorporal>): Dato {
  return {
    id: d.id,
    nombre: [d.nombre, d.zona, d.lateralidad].filter(Boolean).join(" · "),
    valor: r.estado === "registrado" ? conUnidad(r.valor, d.unidad) : "No realizado",
    lineas: [
      ...tenue(r.estado === "noRealizado" && r.motivo),
      ...tenue(
        r.estado === "registrado" &&
          r.lecturas &&
          `Lecturas: ${r.lecturas.map(decimal).join(" · ")} ${d.unidad}`,
      ),
      ...tenue(d.instrumento && `Instrumento: ${d.instrumento}`),
    ],
  }
}

/** La métrica principal va a la derecha; las demás, con su nombre, debajo. */
function datoPrueba(d: DefinicionPrueba, r: Publicado<ResultadoPrueba>, toma: string): Dato {
  const base = { id: d.id, nombre: [d.nombre, d.variante].filter(Boolean).join(" · ") }
  const instrumento = tenue(d.instrumento && `Instrumento: ${d.instrumento}`)
  if (r.estado === "noRealizado")
    return { ...base, valor: "No realizado", lineas: [...tenue(r.motivo), ...instrumento] }
  const principal = d.metricas.find((m) => m.principal)
  const valor = principal ? r.valores[principal.clave] : undefined
  return {
    ...base,
    valor: principal && valor !== undefined ? conUnidad(valor, principal.unidad) : null,
    lineas: [
      ...d.metricas.flatMap((m) =>
        m === principal || r.valores[m.clave] === undefined
          ? []
          : tenue(`${m.nombre}: ${conUnidad(r.valores[m.clave]!, m.unidad)}`),
      ),
      ...(r.protocoloCompleto ? [] : [{ texto: "Protocolo incompleto", tono: "alerta" } as const]),
      ...tenue(r.fecha !== null && r.fecha !== toma && `Hecha el ${fecha(r.fecha)}`),
      ...tenue(r.notas),
      ...instrumento,
    ],
  }
}

/** Bloques con algo publicado, en el orden de la visita. */
function bloquesDe(p: PublicacionValoracion): Array<{ titulo: string; datos: Dato[] }> {
  const { definiciones, corporales, pruebas, grasaPorPliegues: grasa } = p.documento
  const conValor = conResultado(definiciones.corporales, corporales)
  return [
    ...(["medidas", "pliegues", "bioimpedancia"] as const).map((bloque) => ({
      titulo: BLOQUE[bloque],
      datos: [
        ...conValor.filter(([d]) => d.bloque === bloque).map(([d, r]) => datoCorporal(d, r)),
        ...(bloque === "pliegues" && grasa
          ? [
              {
                id: "grasa",
                nombre: "Grasa por pliegues",
                valor: null,
                lineas: [
                  {
                    texto: `${decimal(grasa.valorPct)} % · ${grasa.metodo} · ${fecha(grasa.fecha)}`,
                    tono: "fuerte" as const,
                  },
                  ...tenue("Calculada por tu entrenador"),
                ],
              },
            ]
          : []),
      ],
    })),
    {
      titulo: BLOQUE.pruebas,
      datos: conResultado(definiciones.pruebas, pruebas).map(([d, r]) =>
        datoPrueba(d, r, p.fechaToma),
      ),
    },
  ].filter((b) => b.datos.length > 0)
}

type Datos = {
  lista: ResumenValoracionPublicada[]
  total: number
  ultima: PublicacionValoracion | null
  proxima: ProximaRevision
}

/** Valoraciones publicadas para el cliente: la última, la próxima revisión y el historial. */
export function ValoracionesCliente({
  clienteId,
  api,
  sinAvisoVacio = false,
}: {
  clienteId: string
  api: ApiValoracionesCliente
  /** Progreso: sin valoraciones ni revisión programada no explica nada (ya lo dice una vez). */
  sinAvisoVacio?: boolean
}): React.JSX.Element {
  const [datos, setDatos] = useState<Datos | null>(null)
  const [error, setError] = useState("")
  const [intento, setIntento] = useState(0)
  const [abierta, setAbierta] = useState<PublicacionValoracion | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [aviso, setAviso] = useState("")
  const enCurso = useRef(false)

  useFocusEffect(
    useCallback(() => {
      let vigente = true
      setError("")
      Promise.all([api.listarPublicadas(clienteId, PAGINA, 0), api.proximaRevision(clienteId)])
        .then(async ([listado, proxima]) => {
          const primera = listado.valoraciones[0]
          const ultima = primera
            ? (await api.leerPublicada(clienteId, primera.id)).publicacion
            : null
          if (vigente)
            setDatos({ lista: listado.valoraciones, total: listado.total, ultima, proxima })
        })
        .catch(() => {
          if (vigente) setError("No se pudieron cargar tus valoraciones. Revisa la conexión.")
        })
      return () => {
        vigente = false
      }
    }, [api, clienteId, intento]),
  )

  const accion = async (hacer: () => Promise<void>, fallo: string): Promise<void> => {
    if (enCurso.current) return
    enCurso.current = true
    setOcupado(true)
    setAviso("")
    try {
      await hacer()
    } catch {
      setAviso(fallo)
    } finally {
      enCurso.current = false
      setOcupado(false)
    }
  }
  const verMas = (cargadas: number): Promise<void> =>
    accion(async () => {
      const pagina = await api.listarPublicadas(clienteId, PAGINA, cargadas)
      setDatos((actual) => {
        if (!actual) return actual
        const nuevas = pagina.valoraciones.filter((v) => !actual.lista.some((a) => a.id === v.id))
        const lista = [...actual.lista, ...nuevas]
        // Una página vacía cierra el historial aunque el total diga otra cosa.
        return { ...actual, lista, total: nuevas.length === 0 ? lista.length : pagina.total }
      })
    }, "No se pudieron cargar más valoraciones.")
  const abrir = (id: string): Promise<void> =>
    accion(async () => {
      setAbierta((await api.leerPublicada(clienteId, id)).publicacion)
    }, "No se pudo abrir la valoración. Revisa la conexión.")

  if (abierta) return <Detalle publicacion={abierta} volver={() => setAbierta(null)} />
  return (
    <View style={s.contenido}>
      {error !== "" && (
        <View style={s.grupo}>
          <AvisoDeError mensaje={error} />
          <BotonSecundario texto="Reintentar" onPress={() => setIntento((n) => n + 1)} />
        </View>
      )}
      {datos === null ? (
        error === "" && <Text style={s.tenue}>Cargando tus valoraciones…</Text>
      ) : (
        <>
          {datos.ultima ? (
            <Ultima publicacion={datos.ultima} abrir={() => setAbierta(datos.ultima)} />
          ) : sinAvisoVacio ? null : (
            <Text style={s.vacio}>
              Aún no tienes valoraciones publicadas. Cuando tu entrenador publique la primera, la
              verás aquí.
            </Text>
          )}
          {!(sinAvisoVacio && !datos.proxima.pauta) && <Proxima proxima={datos.proxima} />}
          {datos.lista.length > 1 && (
            <View style={s.grupo}>
              <Titulo>Historial de valoraciones</Titulo>
              <Tarjeta>
                {datos.lista.slice(1).map((v, n) => (
                  <Pressable
                    key={v.id}
                    accessibilityRole="button"
                    accessibilityLabel={`Abrir ${TIPO[v.tipo].toLowerCase()} del ${fecha(v.fechaToma)}${v.numeroPublicacion > 1 ? ", corregida" : ""}`}
                    accessibilityState={{ disabled: ocupado }}
                    disabled={ocupado}
                    onPress={() => void abrir(v.id)}
                    style={({ pressed }) => pressed && s.pulsado}
                  >
                    <Fila primera={n === 0}>
                      <View style={[s.linea, s.flex]}>
                        <Text style={s.texto}>{TIPO[v.tipo]}</Text>
                        {v.numeroPublicacion > 1 && <Text style={s.marca}>Corregida</Text>}
                      </View>
                      <Text style={s.valor}>{fecha(v.fechaToma)}</Text>
                    </Fila>
                  </Pressable>
                ))}
              </Tarjeta>
            </View>
          )}
          {aviso !== "" && <AvisoDeError mensaje={aviso} />}
          {datos.total > datos.lista.length && (
            <BotonSecundario
              texto="Ver más"
              etiquetaAccesible="Ver más valoraciones"
              ocupado={ocupado}
              onPress={() => void verMas(datos.lista.length)}
            />
          )}
        </>
      )}
    </View>
  )
}

function Encabezado({
  p,
  titulo = false,
}: {
  p: PublicacionValoracion
  titulo?: boolean
}): React.JSX.Element {
  return (
    <View style={s.textos}>
      <View style={s.linea}>
        <Text style={s.nombre} accessibilityRole={titulo ? "header" : undefined}>
          {TIPO[p.tipo]}
        </Text>
        {p.numero > 1 && <Text style={s.marca}>Corregida</Text>}
      </View>
      <Text style={s.tenue}>
        Tomada el {fecha(p.fechaToma)} · por {p.autor.nombre}
      </Text>
      {p.documento.conclusion && <Text style={s.conclusion}>{p.documento.conclusion}</Text>}
    </View>
  )
}

/** Los cambios que el entrenador eligió destacar, en su orden; un no realizado lo dice. */
function Ultima({
  publicacion,
  abrir,
}: {
  publicacion: PublicacionValoracion
  abrir: () => void
}): React.JSX.Element {
  const datos = bloquesDe(publicacion).flatMap((b) => b.datos)
  const destacados = publicacion.documento.destacados.flatMap((id) =>
    datos.filter((d) => d.id === id && d.valor !== null),
  )
  return (
    <View style={s.grupo}>
      <Titulo>Última valoración</Titulo>
      <View style={s.destacada}>
        <Encabezado p={publicacion} />
        {destacados.map((d) => (
          <Fila key={d.id}>
            <Text style={[s.texto, s.flex]}>{d.nombre}</Text>
            <Text style={s.valor}>{d.valor}</Text>
          </Fila>
        ))}
        <Enlace
          texto="Ver detalle"
          etiqueta="Ver el detalle de tu última valoración"
          onPress={abrir}
        />
      </View>
    </View>
  )
}

function Proxima({
  proxima: { pauta, cumplidaPorId },
}: {
  proxima: ProximaRevision
}): React.JSX.Element {
  const cuando = !pauta
    ? "Sin programar"
    : pauta.fecha
      ? fecha(pauta.fecha)
      : `Cada ${pauta.intervaloSemanas === 1 ? "semana" : `${pauta.intervaloSemanas} semanas`}`
  return (
    <View style={s.grupo}>
      <Titulo>Próxima revisión</Titulo>
      <View style={s.destacada}>
        <Text style={s.fuerte}>{cuando}</Text>
        {pauta && <Text style={s.tenue}>{pauta.bloques.map((b) => BLOQUE[b]).join(" · ")}</Text>}
        {cumplidaPorId && <Text style={s.hecha}>La revisión pautada ya se realizó.</Text>}
      </View>
    </View>
  )
}

/** Solo lectura: lo publicado, agrupado por bloque, sin controles profesionales. */
function Detalle({
  publicacion,
  volver,
}: {
  publicacion: PublicacionValoracion
  volver: () => void
}): React.JSX.Element {
  const bloques = bloquesDe(publicacion)
  return (
    <View style={s.contenido}>
      <View style={s.cabecera}>
        <Encabezado p={publicacion} titulo />
        <Enlace texto="Volver" etiqueta="Volver al resumen" onPress={volver} />
      </View>
      {bloques.length === 0 && (
        <Text style={s.vacio}>Esta valoración no tiene datos publicados.</Text>
      )}
      {bloques.map(({ titulo, datos }) => (
        <View key={titulo} style={s.grupo}>
          <Titulo>{titulo}</Titulo>
          <Tarjeta>
            {datos.map((d, n) => (
              <Fila key={d.id} primera={n === 0}>
                <View style={s.textos}>
                  <Text style={s.texto}>{d.nombre}</Text>
                  {d.lineas.map((l, i) => (
                    <Text key={`${i}-${l.texto}`} style={s[l.tono]}>
                      {l.texto}
                    </Text>
                  ))}
                </View>
                {d.valor !== null && <Text style={s.valor}>{d.valor}</Text>}
              </Fila>
            ))}
          </Tarjeta>
        </View>
      ))}
    </View>
  )
}

const s = StyleSheet.create({
  contenido: { gap: 28 },
  grupo: { gap: 14 },
  cabecera: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  textos: { flex: 1, gap: 4 },
  flex: { flex: 1 },
  linea: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 },
  destacada: { backgroundColor: tema.superficie, borderRadius: 20, padding: 18, gap: 8 },
  nombre: { color: tema.texto, fontFamily: tema.fuenteBoton, fontSize: 18 },
  marca: {
    color: tema.acento,
    fontFamily: tema.fuenteSemi,
    fontSize: 12,
    borderWidth: 1,
    borderColor: tema.bordeDestacado,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  conclusion: { color: tema.textoSecundario, fontFamily: tema.fuenteTexto, fontSize: 15 },
  tenue: { color: tema.textoTenue, fontFamily: tema.fuenteTexto, fontSize: 14, lineHeight: 20 },
  vacio: { color: tema.textoTenue, fontFamily: tema.fuenteTexto, fontSize: 15, lineHeight: 22 },
  texto: { color: tema.texto, fontFamily: tema.fuenteTexto, fontSize: 15 },
  fuerte: { color: tema.texto, fontFamily: tema.fuenteBoton, fontSize: 15 },
  alerta: { color: tema.aviso, fontFamily: tema.fuenteSemi, fontSize: 14 },
  hecha: { color: tema.exito, fontFamily: tema.fuenteSemi, fontSize: 14 },
  valor: {
    color: tema.textoSecundario,
    fontFamily: tema.fuenteTexto,
    fontSize: 15,
    maxWidth: "55%",
    textAlign: "right",
  },
  pulsado: { opacity: 0.8 },
})
