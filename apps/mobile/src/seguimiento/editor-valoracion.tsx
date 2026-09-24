import { useCallback, useRef, useState } from "react"
import { useFocusEffect } from "expo-router"
import { Pressable, StyleSheet, Text, View } from "react-native"
import type {
  BloqueValoracion,
  DefinicionCorporal,
  ListadoValoraciones,
  PlantillaValoracion,
  ProximaRevision,
  ValoracionProfesional,
} from "@alpha-omega/shared"

import { AvisoDeError, BotonPrincipal, BotonSecundario } from "../componentes/formulario"
import { fechaLegible, hoyAgenda } from "../entrenamiento/fechas"
import { Fila, Tarjeta, Titulo } from "../entrenamiento/plan/piezas"
import { Enlace } from "../entrenamiento/sesion/controles"
import { faltaDe } from "../lib/errores"
import { tema } from "../tema"
import { BorradorValoracion } from "./borrador-valoracion"
import { EditorPautaRevision, textoDePauta } from "./pauta-revision"
import { EditorPlantilla } from "./plantilla-valoracion"
import type { ReferenciaPrueba } from "./pruebas-valoracion"
import type { ApiValoraciones } from "./valoraciones-api"

type Vista =
  | { tipo: "lista" }
  | { tipo: "visita"; valoracion: ValoracionProfesional; referencias: ReferenciaPrueba[] }
  | { tipo: "plantilla" }
  | { tipo: "pauta" }

const NOMBRE_DE_BLOQUE: Record<BloqueValoracion, string> = {
  medidas: "Medidas",
  pliegues: "Pliegues",
  bioimpedancia: "Bioimpedancia",
  pruebas: "Pruebas físicas",
  fotos: "Fotos",
}
const NOMBRE_DE_ESTADO = {
  borrador: "Borrador",
  publicada: "Publicada",
  corrigiendo: "Corrigiendo",
}

/** Peso y altura: lo mínimo para una primera visita, a elección explícita del entrenador. */
function definicionesBasicas(nuevoId: () => string): DefinicionCorporal[] {
  const base = {
    version: 1,
    bloque: "medidas",
    zona: null,
    lateralidad: null,
    instrumento: null,
    protocolo: null,
    activa: true,
  } as const
  return [
    { ...base, id: nuevoId(), magnitud: "peso", nombre: "Peso", unidad: "kg" },
    { ...base, id: nuevoId(), magnitud: "altura", nombre: "Altura", unidad: "cm" },
  ]
}

/** Bloques que la plantilla puede rellenar hoy (las fotos llegan con su propia tarea). */
function bloquesDisponibles(plantilla: PlantillaValoracion): BloqueValoracion[] {
  const activos = plantilla.corporales.filter((d) => d.activa).map((d) => d.bloque)
  return (["medidas", "pliegues", "bioimpedancia", "pruebas"] as const).filter((b) =>
    b === "pruebas" ? plantilla.pruebas.some((p) => p.activa) : activos.includes(b),
  )
}

/**
 * Resultados anteriores de las mismas pruebas (misma definición y versión),
 * solo como referencia fechada: nunca rellenan el resultado nuevo.
 */
function referenciasDe(
  actual: ValoracionProfesional,
  anterior: ValoracionProfesional | null,
): ReferenciaPrueba[] {
  const publicada = anterior?.publicacion
  if (!publicada || !actual.borrador) return []
  const versiones = new Map(publicada.documento.definiciones.pruebas.map((d) => [d.id, d.version]))
  const actuales = actual.borrador.documento.definiciones.pruebas
  return publicada.documento.pruebas.flatMap((r) =>
    r.estado === "registrado" &&
    actuales.some((d) => d.id === r.definicionId && d.version === versiones.get(r.definicionId))
      ? [
          {
            definicionId: r.definicionId,
            fecha: r.fecha ?? publicada.fechaToma,
            valores: r.valores,
          },
        ]
      : [],
  )
}

/** Una visita ya publicada, sin borrador abierto: se consulta y, si hace falta, se corrige. */
function VisitaPublicada({
  valoracion,
  corregir,
  ocupado,
  volver,
}: {
  valoracion: ValoracionProfesional
  corregir: () => void
  ocupado: boolean
  volver: () => void
}): React.JSX.Element {
  const publicacion = valoracion.publicacion!
  const documento = publicacion.documento
  return (
    <View style={s.grupo}>
      <View style={s.cabecera}>
        <Text style={[s.titulo, s.textos]} accessibilityRole="header">
          {valoracion.tipo === "inicial" ? "Valoración inicial" : "Revisión"}
        </Text>
        <Enlace texto="Volver" onPress={volver} />
      </View>
      <Text style={s.texto}>
        Publicada el {fechaLegible(publicacion.publicadaEn.slice(0, 10))}
        {publicacion.numero > 1 ? ` · corrección ${publicacion.numero - 1}` : ""} · tomada el{" "}
        {fechaLegible(publicacion.fechaToma)}
      </Text>
      <Text style={s.tenue}>
        {documento.corporales.length} datos corporales y {documento.pruebas.length} pruebas
        publicados.
      </Text>
      {documento.conclusion && <Text style={s.texto}>{documento.conclusion}</Text>}
      {valoracion.documentoVigente?.notasInternas && (
        <Text style={s.tenue}>Notas internas: {valoracion.documentoVigente.notasInternas}</Text>
      )}
      <BotonSecundario texto={ocupado ? "Abriendo…" : "Corregir"} onPress={corregir} />
      <Text style={s.tenue}>
        Corregir crea una versión nueva de esta misma visita; la anterior se conserva.
      </Text>
    </View>
  )
}

/**
 * Valoraciones en la ficha profesional: historial, plantilla, próxima revisión,
 * crear o continuar una visita, publicarla y corregirla.
 */
export function ValoracionesProfesional({
  clienteId,
  api,
  nuevoId,
}: {
  clienteId: string
  api: ApiValoraciones
  nuevoId: () => string
}): React.JSX.Element {
  const [listado, setListado] = useState<ListadoValoraciones | null>(null)
  const [plantilla, setPlantilla] = useState<PlantillaValoracion | null>(null)
  const [proxima, setProxima] = useState<ProximaRevision | null>(null)
  const [vista, setVista] = useState<Vista>({ tipo: "lista" })
  const [eligiendo, setEligiendo] = useState<BloqueValoracion[] | null>(null)
  const [error, setError] = useState("")
  const [ocupado, setOcupado] = useState(false)
  const [intento, setIntento] = useState(0)
  // La misma operación en cada reintento: el servidor no crea dos visitas ni correcciones.
  const operacion = useRef<string | null>(null)

  useFocusEffect(
    useCallback(() => {
      let vigente = true
      Promise.all([api.listar(clienteId), api.plantilla(clienteId), api.proximaRevision(clienteId)])
        .then(([lista, actual, pauta]) => {
          if (!vigente) return
          setListado(lista)
          setPlantilla(actual)
          setProxima(pauta)
          setError("")
        })
        .catch((fallo: unknown) => {
          if (vigente) setError(faltaDe(fallo, "No se pudieron cargar las valoraciones.").texto)
        })
      return () => {
        vigente = false
      }
    }, [api, clienteId, intento]),
  )

  const accion = async (hacer: () => Promise<void>, respaldo: string): Promise<void> => {
    if (ocupado) return
    setOcupado(true)
    setError("")
    try {
      await hacer()
    } catch (fallo) {
      setError(faltaDe(fallo, respaldo).texto)
    } finally {
      setOcupado(false)
    }
  }
  const mostrar = async (valoracion: ValoracionProfesional): Promise<void> => {
    const anterior =
      valoracion.borrador && valoracion.anteriorId
        ? await api.leer(clienteId, valoracion.anteriorId).catch(() => null)
        : null
    setVista({ tipo: "visita", valoracion, referencias: referenciasDe(valoracion, anterior) })
  }
  const abrir = (id: string): Promise<void> =>
    accion(async () => mostrar(await api.leer(clienteId, id)), "No se pudo abrir la valoración.")
  const alLista = (): void => {
    setVista({ tipo: "lista" })
    setEligiendo(null)
    setIntento((n) => n + 1)
  }

  if (vista.tipo === "plantilla" && plantilla)
    return (
      <EditorPlantilla
        plantilla={plantilla}
        guardar={(datos) => api.guardarPlantilla(clienteId, datos)}
        recargar={() => api.plantilla(clienteId)}
        nuevoId={nuevoId}
        cerrar={alLista}
      />
    )
  if (vista.tipo === "pauta" && proxima)
    return (
      <EditorPautaRevision
        proxima={proxima}
        guardar={(datos) => api.guardarProximaRevision(clienteId, datos)}
        recargar={() => api.proximaRevision(clienteId)}
        cerrar={alLista}
      />
    )
  if (vista.tipo === "visita") {
    const { valoracion } = vista
    if (valoracion.borrador)
      return (
        <BorradorValoracion
          key={valoracion.borrador.id}
          valoracion={valoracion}
          referencias={vista.referencias}
          cambiar={(datos) => api.cambiar(clienteId, valoracion.id, datos)}
          recargar={() => api.leer(clienteId, valoracion.id)}
          publicar={(datos) => api.publicar(clienteId, valoracion.id, datos)}
          nuevoId={nuevoId}
          publicada={() => void abrir(valoracion.id)}
          volver={alLista}
        />
      )
    const corregir = (): Promise<void> =>
      accion(async () => {
        operacion.current ??= nuevoId()
        const correccion = await api.crear(clienteId, {
          operacionId: operacion.current,
          corrigePublicacionId: valoracion.publicacion!.id,
        })
        operacion.current = null
        await mostrar(correccion)
      }, "No se pudo abrir la corrección.")
    return (
      <View style={s.grupo}>
        <VisitaPublicada
          valoracion={valoracion}
          corregir={() => void corregir()}
          ocupado={ocupado}
          volver={alLista}
        />
        {error !== "" && <AvisoDeError mensaje={error} />}
      </View>
    )
  }
  if (error !== "" && listado === null)
    return (
      <View style={s.grupo}>
        <AvisoDeError mensaje={error} />
        <BotonSecundario texto="Reintentar" onPress={() => setIntento((n) => n + 1)} />
      </View>
    )
  if (listado === null || plantilla === null || proxima === null)
    return <Text style={s.tenue}>Cargando valoraciones…</Text>

  const enCurso = listado.valoraciones.find((v) => v.estado !== "publicada")
  const ultima = listado.valoraciones[0]
  const disponibles = bloquesDisponibles(plantilla)
  const pautaPendiente = proxima.pauta && !proxima.cumplidaPorId ? proxima.pauta : null
  const crear = (bloques: BloqueValoracion[], cumplePauta: number | null): Promise<void> =>
    accion(async () => {
      if (bloques.length === 0) throw new Error("Elige al menos un bloque.")
      operacion.current ??= nuevoId()
      const base = { operacionId: operacion.current, fechaToma: hoyAgenda(), bloques }
      const creada = await api.crear(
        clienteId,
        ultima
          ? { ...base, tipo: "revision", anteriorId: ultima.id, cumplePauta }
          : { ...base, tipo: "inicial" },
      )
      operacion.current = null
      await mostrar(creada)
    }, "No se pudo crear la valoración. Elige al menos un bloque y vuelve a intentarlo.")
  const anadirBasicas = (): Promise<void> =>
    accion(async () => {
      setPlantilla(
        await api.guardarPlantilla(clienteId, {
          ...plantilla,
          corporales: [...plantilla.corporales, ...definicionesBasicas(nuevoId)],
        }),
      )
    }, "No se pudo guardar la plantilla.")

  return (
    <View style={s.grupo}>
      <View style={s.cabecera}>
        <View style={s.textos}>
          <Titulo>Valoraciones</Titulo>
        </View>
        <Enlace texto="Plantilla" onPress={() => setVista({ tipo: "plantilla" })} />
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Próxima revisión: ${textoDePauta(proxima.pauta)}. Cambiar`}
        onPress={() => setVista({ tipo: "pauta" })}
        style={s.pauta}
      >
        <Text style={s.texto}>Próxima revisión: {textoDePauta(proxima.pauta)}</Text>
        <Text style={s.enlace}>Cambiar</Text>
      </Pressable>
      {enCurso ? (
        <BotonPrincipal
          texto="Continuar valoración"
          ocupado={ocupado}
          onPress={() => void abrir(enCurso.id)}
        />
      ) : disponibles.length === 0 ? (
        <>
          <Text style={s.tenue}>
            Para empezar, añade a la plantilla de este cliente lo que vas a medir.
          </Text>
          <BotonPrincipal
            texto="Añadir peso y altura a la plantilla"
            ocupado={ocupado}
            onPress={() => void anadirBasicas()}
          />
        </>
      ) : eligiendo ? (
        <View style={s.grupo}>
          <Text style={s.subtitulo}>Qué incluye esta visita</Text>
          <View style={s.chips}>
            {disponibles.map((b) => {
              const elegido = eligiendo.includes(b)
              return (
                <Pressable
                  key={b}
                  accessibilityRole="checkbox"
                  accessibilityLabel={NOMBRE_DE_BLOQUE[b]}
                  accessibilityState={{ checked: elegido, disabled: ocupado }}
                  disabled={ocupado}
                  onPress={() =>
                    setEligiendo(elegido ? eligiendo.filter((x) => x !== b) : [...eligiendo, b])
                  }
                  style={[s.chip, elegido && s.chipElegido]}
                >
                  <Text style={s.textoChip}>{NOMBRE_DE_BLOQUE[b]}</Text>
                </Pressable>
              )
            })}
          </View>
          <BotonPrincipal
            texto={ultima ? "Crear revisión" : "Crear valoración"}
            ocupado={ocupado}
            onPress={() => void crear(eligiendo, null)}
          />
          <BotonSecundario texto="Cancelar" onPress={() => setEligiendo(null)} />
        </View>
      ) : (
        <>
          {ultima && pautaPendiente && (
            <BotonPrincipal
              texto={`Hacer la revisión pautada (${textoDePauta(pautaPendiente)})`}
              ocupado={ocupado}
              onPress={() =>
                void crear(
                  pautaPendiente.bloques.filter((b) => disponibles.includes(b)),
                  proxima.revision,
                )
              }
            />
          )}
          <BotonSecundario
            texto={ultima ? "Nueva revisión" : "Nueva valoración"}
            onPress={() => setEligiendo(disponibles)}
          />
        </>
      )}
      {error !== "" && <AvisoDeError mensaje={error} />}
      {listado.valoraciones.length === 0 ? (
        <Text style={s.tenue}>Aún no hay valoraciones.</Text>
      ) : (
        <Tarjeta>
          {listado.valoraciones.map((v, n) => (
            <Pressable
              key={v.id}
              accessibilityRole="button"
              accessibilityLabel={`${v.tipo === "inicial" ? "Inicial" : "Revisión"} del ${fechaLegible(v.fechaToma)}, ${NOMBRE_DE_ESTADO[v.estado]}`}
              onPress={() => void abrir(v.id)}
            >
              <Fila primera={n === 0}>
                <Text style={[s.texto, s.textos]}>
                  {v.tipo === "inicial" ? "Inicial" : "Revisión"} · {fechaLegible(v.fechaToma)}
                </Text>
                <Text style={s.fuerte}>{NOMBRE_DE_ESTADO[v.estado]}</Text>
              </Fila>
            </Pressable>
          ))}
        </Tarjeta>
      )}
      {listado.total > listado.valoraciones.length && (
        <Text style={s.tenue}>
          Mostrando {listado.valoraciones.length} de {listado.total}.
        </Text>
      )}
    </View>
  )
}

const s = StyleSheet.create({
  grupo: { gap: 12 },
  cabecera: { flexDirection: "row", gap: 12, alignItems: "center" },
  textos: { flex: 1, gap: 4 },
  titulo: { color: tema.texto, fontFamily: tema.fuenteBoton, fontSize: 20 },
  subtitulo: { color: tema.texto, fontFamily: tema.fuenteSemi, fontSize: 15 },
  tenue: { color: tema.textoTenue, fontFamily: tema.fuenteTexto, fontSize: 13, lineHeight: 18 },
  texto: { color: tema.texto, fontFamily: tema.fuenteTexto, fontSize: 15 },
  fuerte: { color: tema.texto, fontFamily: tema.fuenteBoton, fontSize: 14 },
  enlace: { color: tema.acento, fontFamily: tema.fuenteBoton, fontSize: 14 },
  pauta: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    minHeight: 44,
    paddingHorizontal: 14,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: tema.bordeFuerte,
    justifyContent: "center",
  },
  chipElegido: { borderColor: tema.acento, backgroundColor: tema.acentoSuave },
  textoChip: { color: tema.texto, fontFamily: tema.fuenteTexto, fontSize: 14 },
})
