import { useCallback, useRef, useState } from "react"
import { useFocusEffect } from "expo-router"
import { Pressable, StyleSheet, Text, View } from "react-native"
import type {
  CambiarValoracion,
  DefinicionCorporal,
  ListadoValoraciones,
  PlantillaValoracion,
  ValoracionProfesional,
} from "@alpha-omega/shared"

import { AvisoDeError, BotonPrincipal, BotonSecundario, Campo } from "../componentes/formulario"
import { fechaLegible, hoyAgenda } from "../entrenamiento/fechas"
import { Fila, Tarjeta, Titulo } from "../entrenamiento/plan/piezas"
import { Enlace } from "../entrenamiento/sesion/controles"
import { faltaDe } from "../lib/errores"
import { ErrorDePeticion } from "../lib/http"
import { tema } from "../tema"
import {
  CAMPO_CORPORAL_VACIO,
  cambioDe,
  edicionDe,
  type CampoCorporal,
  type EdicionValoracion,
} from "./valoracion-modelo"
import type { ApiValoraciones } from "./valoraciones-api"

type Estado = "guardado" | "cambios" | "guardando" | "error" | "conflicto"

function medidasDe(valoracion: ValoracionProfesional): DefinicionCorporal[] {
  return valoracion.borrador!.documento.definiciones.corporales.filter(
    (d) => d.bloque === "medidas",
  )
}

const TEXTO_DE_ESTADO: Record<Estado, string> = {
  guardado: "Guardado",
  cambios: "Cambios sin guardar",
  guardando: "Guardando…",
  error: "No se pudo guardar",
  conflicto: "Otra edición se guardó antes",
}

function EditorValoracion({
  valoracion: inicial,
  cambiar,
  recargar,
  volver,
}: {
  valoracion: ValoracionProfesional
  cambiar: (datos: CambiarValoracion) => Promise<ValoracionProfesional>
  recargar: () => Promise<ValoracionProfesional>
  volver: () => void
}): React.JSX.Element {
  const [valoracion, setValoracion] = useState(inicial)
  const [edicion, setEdicion] = useState(() => edicionDe(inicial))
  const [estado, setEstado] = useState<Estado>("guardado")
  const [error, setError] = useState("")
  const enCurso = useRef(false)
  const medidas = medidasDe(valoracion)
  const bloqueado = estado === "guardando"

  const editar = (cambio: Partial<EdicionValoracion>): void => {
    if (enCurso.current) return
    setEdicion((actual) => ({ ...actual, ...cambio }))
    if (estado !== "conflicto") setEstado("cambios")
  }
  const campo = (id: string, cambio: Partial<CampoCorporal>): void =>
    editar({
      corporales: {
        ...edicion.corporales,
        [id]: { ...CAMPO_CORPORAL_VACIO, ...edicion.corporales[id], ...cambio },
      },
    })

  const guardar = async (): Promise<void> => {
    if (enCurso.current) return
    const datos = cambioDe(valoracion, edicion)
    if ("error" in datos) {
      setError(datos.error)
      return
    }
    enCurso.current = true
    setEstado("guardando")
    setError("")
    try {
      const guardada = await cambiar(datos)
      setValoracion(guardada)
      setEdicion(edicionDe(guardada))
      setEstado("guardado")
    } catch (fallo) {
      if (fallo instanceof ErrorDePeticion && fallo.detalle.codigo === "revision_obsoleta") {
        setEstado("conflicto")
        setError(
          "Otra edición de esta valoración se guardó antes. Tu edición sigue aquí: carga la versión guardada o conserva la tuya y vuelve a guardar.",
        )
      } else {
        setEstado("error")
        setError(faltaDe(fallo, "No se pudo guardar la valoración. Tu edición sigue aquí.").texto)
      }
    } finally {
      enCurso.current = false
    }
  }

  /** Relee la versión del servidor; con `conservar`, mantiene lo escrito sobre ella. */
  const resolver = async (conservar: boolean): Promise<void> => {
    if (enCurso.current) return
    enCurso.current = true
    try {
      const actual = await recargar()
      setValoracion(actual)
      if (!conservar) setEdicion(edicionDe(actual))
      setEstado(conservar ? "cambios" : "guardado")
      setError("")
    } catch (fallo) {
      setError(faltaDe(fallo, "No se pudo cargar la versión guardada.").texto)
    } finally {
      enCurso.current = false
    }
  }

  return (
    <View style={s.contenido}>
      <View style={s.cabecera}>
        <View style={s.textos}>
          <Text style={s.titulo} accessibilityRole="header">
            {valoracion.tipo === "inicial" ? "Valoración inicial" : "Revisión"}
          </Text>
          <Text
            style={[s.estado, (estado === "error" || estado === "conflicto") && s.estadoAviso]}
            accessibilityLiveRegion="polite"
          >
            {TEXTO_DE_ESTADO[estado]}
          </Text>
        </View>
        <Enlace texto="Volver" onPress={volver} />
      </View>
      <Campo
        etiqueta="Fecha de toma (AAAA-MM-DD)"
        value={edicion.fechaToma}
        editable={!bloqueado}
        onChangeText={(fechaToma) => editar({ fechaToma })}
        maxLength={10}
      />
      <View style={s.grupo}>
        <Titulo>Medidas</Titulo>
        {medidas.length === 0 ? (
          <Text style={s.tenue}>Esta visita no tiene medidas en su plantilla.</Text>
        ) : (
          <Tarjeta>
            {medidas.map((d, n) => {
              const valor = edicion.corporales[d.id] ?? CAMPO_CORPORAL_VACIO
              const nombre = [d.nombre, d.zona, d.lateralidad].filter(Boolean).join(" · ")
              return (
                <Fila key={d.id} primera={n === 0}>
                  <View style={s.textos}>
                    <Campo
                      etiqueta={`${nombre} (${d.unidad})`}
                      value={valor.noRealizado ? "" : valor.texto}
                      placeholder={valor.noRealizado ? "No realizado" : "Sin dato"}
                      editable={!bloqueado && !valor.noRealizado}
                      keyboardType="decimal-pad"
                      maxLength={8}
                      onChangeText={(texto) => campo(d.id, { texto })}
                    />
                    {d.instrumento && <Text style={s.tenue}>{d.instrumento}</Text>}
                  </View>
                  <Pressable
                    accessibilityRole="checkbox"
                    accessibilityLabel={`No realizado — ${d.nombre}`}
                    accessibilityState={{ checked: valor.noRealizado, disabled: bloqueado }}
                    disabled={bloqueado}
                    onPress={() => campo(d.id, { noRealizado: !valor.noRealizado })}
                    style={[s.marca, valor.noRealizado && s.marcaActiva]}
                  >
                    <Text style={s.textoMarca}>No realizado</Text>
                  </Pressable>
                </Fila>
              )
            })}
          </Tarjeta>
        )}
      </View>
      {error !== "" && <AvisoDeError mensaje={error} />}
      {estado === "conflicto" ? (
        <View style={s.grupo}>
          <BotonSecundario texto="Cargar versión guardada" onPress={() => void resolver(false)} />
          <BotonSecundario texto="Conservar mi edición" onPress={() => void resolver(true)} />
        </View>
      ) : (
        <BotonPrincipal
          texto={bloqueado ? "Guardando…" : "Guardar"}
          ocupado={bloqueado}
          onPress={() => void guardar()}
        />
      )}
    </View>
  )
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

const NOMBRE_DE_ESTADO = {
  borrador: "Borrador",
  publicada: "Publicada",
  corrigiendo: "Corrigiendo",
}

/**
 * Valoraciones en la ficha profesional: historial, crear o continuar una
 * visita y editar su borrador. Solo aparecen las acciones con API disponible.
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
  const [abierta, setAbierta] = useState<ValoracionProfesional | null>(null)
  const [error, setError] = useState("")
  const [ocupado, setOcupado] = useState(false)
  const [intento, setIntento] = useState(0)
  // La misma operación en cada reintento: el servidor no crea dos visitas.
  const operacion = useRef<string | null>(null)

  useFocusEffect(
    useCallback(() => {
      let vigente = true
      Promise.all([api.listar(clienteId), api.plantilla(clienteId)])
        .then(([lista, actual]) => {
          if (!vigente) return
          setListado(lista)
          setPlantilla(actual)
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
  const abrir = (id: string): Promise<void> =>
    accion(async () => setAbierta(await api.leer(clienteId, id)), "No se pudo abrir la valoración.")

  if (abierta)
    return (
      <EditorValoracion
        key={abierta.id}
        valoracion={abierta}
        cambiar={(datos) => api.cambiar(clienteId, abierta.id, datos)}
        recargar={() => api.leer(clienteId, abierta.id)}
        volver={() => {
          setAbierta(null)
          setIntento((n) => n + 1)
        }}
      />
    )
  if (error !== "" && listado === null)
    return (
      <View style={s.grupo}>
        <AvisoDeError mensaje={error} />
        <BotonSecundario texto="Reintentar" onPress={() => setIntento((n) => n + 1)} />
      </View>
    )
  if (listado === null || plantilla === null)
    return <Text style={s.tenue}>Cargando valoraciones…</Text>

  const enCurso = listado.valoraciones.find((v) => v.estado !== "publicada")
  const ultima = listado.valoraciones[0]
  const sinMedidas = !plantilla.corporales.some((d) => d.activa && d.bloque === "medidas")
  const crear = (): Promise<void> =>
    accion(async () => {
      operacion.current ??= nuevoId()
      const creada = await api.crear(
        clienteId,
        ultima
          ? {
              operacionId: operacion.current,
              tipo: "revision",
              fechaToma: hoyAgenda(),
              bloques: ["medidas"],
              anteriorId: ultima.id,
              cumplePauta: null,
            }
          : {
              operacionId: operacion.current,
              tipo: "inicial",
              fechaToma: hoyAgenda(),
              bloques: ["medidas"],
            },
      )
      operacion.current = null
      setAbierta(creada)
    }, "No se pudo crear la valoración.")
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
      <Titulo>Valoraciones</Titulo>
      {enCurso ? (
        <BotonPrincipal
          texto="Continuar valoración"
          ocupado={ocupado}
          onPress={() => void abrir(enCurso.id)}
        />
      ) : sinMedidas ? (
        <>
          <Text style={s.tenue}>
            Para empezar, añade a la plantilla de este cliente las medidas que vas a tomar.
          </Text>
          <BotonPrincipal
            texto="Añadir peso y altura a la plantilla"
            ocupado={ocupado}
            onPress={() => void anadirBasicas()}
          />
        </>
      ) : (
        <BotonPrincipal
          texto={ultima ? "Nueva revisión" : "Nueva valoración"}
          ocupado={ocupado}
          onPress={() => void crear()}
        />
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
  contenido: { gap: 20 },
  grupo: { gap: 12 },
  cabecera: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  textos: { flex: 1, gap: 4 },
  titulo: { color: tema.texto, fontFamily: tema.fuenteBoton, fontSize: 20 },
  estado: { color: tema.textoTenue, fontFamily: tema.fuenteTexto, fontSize: 13 },
  estadoAviso: { color: tema.aviso },
  tenue: { color: tema.textoTenue, fontFamily: tema.fuenteTexto, fontSize: 13, lineHeight: 18 },
  texto: { color: tema.texto, fontFamily: tema.fuenteTexto, fontSize: 15 },
  fuerte: { color: tema.texto, fontFamily: tema.fuenteBoton, fontSize: 14 },
  marca: {
    minHeight: 44,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: tema.bordeFuerte,
    justifyContent: "center",
  },
  marcaActiva: { borderColor: tema.acento },
  textoMarca: { color: tema.textoSecundario, fontFamily: tema.fuenteTexto, fontSize: 13 },
})
