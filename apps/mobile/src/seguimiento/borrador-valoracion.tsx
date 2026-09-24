import { useRef, useState } from "react"
import { Pressable, StyleSheet, Text, View } from "react-native"
import type {
  BloqueValoracion,
  CambiarValoracion,
  DefinicionCorporal,
  PublicacionValoracion,
  PublicarValoracion,
  ValoracionProfesional,
} from "@alpha-omega/shared"

import { AvisoDeError, BotonPrincipal, BotonSecundario, Campo } from "../componentes/formulario"
import { Fila, Tarjeta, Titulo } from "../entrenamiento/plan/piezas"
import { Enlace } from "../entrenamiento/sesion/controles"
import { faltaDe } from "../lib/errores"
import { ErrorDePeticion } from "../lib/http"
import { tema } from "../tema"
import { BloqueBioimpedancia } from "./bioimpedancia-valoracion"
import { BloquePliegues } from "./pliegues-valoracion"
import { BloquePruebas, type ReferenciaPrueba } from "./pruebas-valoracion"
import {
  CAMPO_CORPORAL_VACIO,
  cambioDe,
  edicionDe,
  type CampoCorporal,
  type EdicionValoracion,
} from "./valoracion-modelo"

type Estado = "guardado" | "cambios" | "guardando" | "publicando" | "error" | "conflicto"
type Seccion = BloqueValoracion | "resumen"

const TEXTO_DE_ESTADO: Record<Estado, string> = {
  guardado: "Guardado",
  cambios: "Cambios sin guardar",
  guardando: "Guardando…",
  publicando: "Publicando…",
  error: "No se pudo guardar",
  conflicto: "Otra edición se guardó antes",
}

const NOMBRE_DE_SECCION: Record<Seccion, string> = {
  medidas: "Medidas",
  pliegues: "Pliegues",
  bioimpedancia: "Bioimpedancia",
  pruebas: "Pruebas físicas",
  fotos: "Fotos",
  resumen: "Conclusión y publicación",
}

/** Bloques con formulario disponible; las fotos llegan con su propia tarea. */
const CON_FORMULARIO: BloqueValoracion[] = ["medidas", "pliegues", "bioimpedancia", "pruebas"]

function corporalesDe(v: ValoracionProfesional, bloque: BloqueValoracion): DefinicionCorporal[] {
  return v.borrador!.documento.definiciones.corporales.filter((d) => d.bloque === bloque)
}

function BloqueMedidas({
  definiciones,
  campos,
  cambiarCampo,
  bloqueado,
}: {
  definiciones: DefinicionCorporal[]
  campos: Record<string, CampoCorporal>
  cambiarCampo: (id: string, cambio: Partial<CampoCorporal>) => void
  bloqueado: boolean
}): React.JSX.Element {
  if (definiciones.length === 0)
    return <Text style={s.tenue}>Esta visita no tiene medidas en su plantilla.</Text>
  return (
    <Tarjeta>
      {definiciones.map((d, n) => {
        const valor = campos[d.id] ?? CAMPO_CORPORAL_VACIO
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
                onChangeText={(texto) => cambiarCampo(d.id, { texto })}
              />
              {d.instrumento && <Text style={s.tenue}>{d.instrumento}</Text>}
            </View>
            <Pressable
              accessibilityRole="checkbox"
              accessibilityLabel={`No realizado — ${d.nombre}`}
              accessibilityState={{ checked: valor.noRealizado, disabled: bloqueado }}
              disabled={bloqueado}
              onPress={() => cambiarCampo(d.id, { noRealizado: !valor.noRealizado })}
              style={[s.marca, valor.noRealizado && s.marcaActiva]}
            >
              <Text style={s.textoMarca}>No realizado</Text>
            </Pressable>
          </Fila>
        )
      })}
    </Tarjeta>
  )
}

/** Conclusión visible, notas internas y cambios que se destacan al cliente. */
function Resumen({
  valoracion,
  edicion,
  editar,
  bloqueado,
}: {
  valoracion: ValoracionProfesional
  edicion: EdicionValoracion
  editar: (cambio: Partial<EdicionValoracion>) => void
  bloqueado: boolean
}): React.JSX.Element {
  const documento = valoracion.borrador!.documento
  const anotadas = [
    ...documento.definiciones.corporales.filter((d) => {
      const c = edicion.corporales[d.id]
      return c && !c.noRealizado && c.texto.trim() !== ""
    }),
    ...documento.definiciones.pruebas.filter((d) => edicion.pruebas[d.id]?.estado === "registrado"),
  ]
  const alternar = (id: string): void => {
    const elegido = edicion.destacados.includes(id)
    if (!elegido && edicion.destacados.length >= 6) return
    editar({
      destacados: elegido
        ? edicion.destacados.filter((d) => d !== id)
        : [...edicion.destacados, id],
    })
  }
  return (
    <View style={s.grupo}>
      <Campo
        etiqueta="Conclusión para el cliente"
        value={edicion.conclusion}
        editable={!bloqueado}
        multiline
        maxLength={2000}
        onChangeText={(conclusion) => editar({ conclusion })}
      />
      <Text style={s.tenue}>El cliente la verá al publicar.</Text>
      <Campo
        etiqueta="Notas internas"
        value={edicion.notasInternas}
        editable={!bloqueado}
        multiline
        maxLength={4000}
        onChangeText={(notasInternas) => editar({ notasInternas })}
      />
      <Text style={s.tenue}>Solo para ti: no se publican.</Text>
      <Text style={s.subtitulo}>Qué destacar al cliente (hasta 6)</Text>
      {anotadas.length === 0 ? (
        <Text style={s.tenue}>Anota algún resultado para poder destacarlo.</Text>
      ) : (
        <View style={s.chips}>
          {anotadas.map((d) => {
            const elegido = edicion.destacados.includes(d.id)
            return (
              <Pressable
                key={d.id}
                accessibilityRole="checkbox"
                accessibilityLabel={`Destacar ${d.nombre}`}
                accessibilityState={{ checked: elegido, disabled: bloqueado }}
                disabled={bloqueado}
                onPress={() => alternar(d.id)}
                style={[s.chip, elegido && s.chipElegido]}
              >
                <Text style={[s.textoChip, elegido && s.textoChipElegido]}>{d.nombre}</Text>
              </Pressable>
            )
          })}
        </View>
      )}
    </View>
  )
}

/**
 * Borrador de una visita: un bloque abierto cada vez, guardado explícito con su
 * estado visible y publicación que requiere lo guardado y la confirmación del
 * servidor. Un fallo conserva la edición; un conflicto no pisa el servidor.
 */
export function BorradorValoracion({
  valoracion: inicial,
  referencias,
  cambiar,
  recargar,
  publicar,
  nuevoId,
  publicada,
  volver,
}: {
  valoracion: ValoracionProfesional
  referencias: ReferenciaPrueba[]
  cambiar: (datos: CambiarValoracion) => Promise<ValoracionProfesional>
  recargar: () => Promise<ValoracionProfesional>
  publicar: (datos: PublicarValoracion) => Promise<PublicacionValoracion>
  nuevoId: () => string
  publicada: (publicacion: PublicacionValoracion) => void
  volver: () => void
}): React.JSX.Element {
  const [valoracion, setValoracion] = useState(inicial)
  const [edicion, setEdicion] = useState(() => edicionDe(inicial))
  const [estado, setEstado] = useState<Estado>("guardado")
  const [error, setError] = useState("")
  const [abierta, setAbierta] = useState<Seccion>(
    () => inicial.borrador!.documento.bloques.find((b) => CON_FORMULARIO.includes(b)) ?? "resumen",
  )
  const enCurso = useRef(false)
  // La misma operación en cada reintento: una respuesta perdida no publica dos veces.
  const operacionPublicar = useRef<string | null>(null)
  const borrador = valoracion.borrador!
  const bloqueado = estado === "guardando" || estado === "publicando"
  const secciones: Seccion[] = [
    ...borrador.documento.bloques.filter((b) => CON_FORMULARIO.includes(b)),
    "resumen",
  ]

  const editar = (cambio: Partial<EdicionValoracion>): void => {
    if (enCurso.current) return
    setEdicion((actual) => ({ ...actual, ...cambio }))
    operacionPublicar.current = null
    if (estado !== "conflicto") setEstado("cambios")
  }
  const campo = (id: string, cambio: Partial<CampoCorporal>): void =>
    editar({
      corporales: {
        ...edicion.corporales,
        [id]: { ...CAMPO_CORPORAL_VACIO, ...edicion.corporales[id], ...cambio },
      },
    })

  const conflicto = (): void => {
    setEstado("conflicto")
    setError(
      "Otra edición de esta valoración se guardó antes. Tu edición sigue aquí: carga la versión guardada o conserva la tuya y vuelve a guardar.",
    )
  }

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
      if (fallo instanceof ErrorDePeticion && fallo.detalle.codigo === "revision_obsoleta")
        conflicto()
      else {
        setEstado("error")
        setError(faltaDe(fallo, "No se pudo guardar la valoración. Tu edición sigue aquí.").texto)
      }
    } finally {
      enCurso.current = false
    }
  }

  const publicarAhora = async (): Promise<void> => {
    if (enCurso.current || estado !== "guardado") return
    enCurso.current = true
    setEstado("publicando")
    setError("")
    operacionPublicar.current ??= nuevoId()
    try {
      const publicacion = await publicar({
        operacionId: operacionPublicar.current,
        borradorId: borrador.id,
        revision: borrador.revision,
        sustituyePublicacionId: borrador.corrigePublicacionId,
      })
      operacionPublicar.current = null
      publicada(publicacion)
    } catch (fallo) {
      setEstado("guardado")
      if (fallo instanceof ErrorDePeticion && fallo.detalle.codigo === "revision_obsoleta")
        conflicto()
      else if (fallo instanceof ErrorDePeticion) setError(fallo.detalle.message)
      else
        setError(
          faltaDe(
            fallo,
            "No sabemos si se publicó. Vuelve a pulsar Publicar: no se publicará dos veces.",
          ).texto,
        )
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

  const titulo = borrador.corrigePublicacionId
    ? "Corrección de la valoración"
    : valoracion.tipo === "inicial"
      ? "Valoración inicial"
      : "Revisión"

  return (
    <View style={s.contenido}>
      <View style={s.cabecera}>
        <View style={s.textos}>
          <Text style={s.titulo} accessibilityRole="header">
            {titulo}
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
      {secciones.map((seccion) => (
        <View key={seccion} style={s.grupo}>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded: abierta === seccion }}
            accessibilityLabel={NOMBRE_DE_SECCION[seccion]}
            onPress={() => setAbierta(seccion)}
            style={s.encabezado}
          >
            <Titulo>{NOMBRE_DE_SECCION[seccion]}</Titulo>
            <Text style={s.tenue}>{abierta === seccion ? "Abierto" : "Abrir"}</Text>
          </Pressable>
          {abierta === seccion && seccion === "medidas" && (
            <BloqueMedidas
              definiciones={corporalesDe(valoracion, "medidas")}
              campos={edicion.corporales}
              cambiarCampo={campo}
              bloqueado={bloqueado}
            />
          )}
          {abierta === seccion && seccion === "pliegues" && (
            <BloquePliegues
              definiciones={corporalesDe(valoracion, "pliegues")}
              campos={edicion.corporales}
              grasa={edicion.grasa}
              cambiarCampo={campo}
              cambiarGrasa={(grasa) => editar({ grasa })}
              bloqueado={bloqueado}
            />
          )}
          {abierta === seccion && seccion === "bioimpedancia" && (
            <BloqueBioimpedancia
              definiciones={corporalesDe(valoracion, "bioimpedancia")}
              campos={edicion.corporales}
              cambiarCampo={campo}
              bloqueado={bloqueado}
            />
          )}
          {abierta === seccion && seccion === "pruebas" && (
            <BloquePruebas
              definiciones={borrador.documento.definiciones.pruebas}
              campos={edicion.pruebas}
              referencias={referencias}
              cambiar={(id, prueba) => editar({ pruebas: { ...edicion.pruebas, [id]: prueba } })}
              bloqueado={bloqueado}
            />
          )}
          {abierta === seccion && seccion === "resumen" && (
            <Resumen
              valoracion={valoracion}
              edicion={edicion}
              editar={editar}
              bloqueado={bloqueado}
            />
          )}
        </View>
      ))}
      {error !== "" && <AvisoDeError mensaje={error} />}
      {estado === "conflicto" ? (
        <View style={s.grupo}>
          <BotonSecundario texto="Cargar versión guardada" onPress={() => void resolver(false)} />
          <BotonSecundario texto="Conservar mi edición" onPress={() => void resolver(true)} />
        </View>
      ) : (
        <View style={s.grupo}>
          <BotonPrincipal
            texto={estado === "guardando" ? "Guardando…" : "Guardar"}
            ocupado={bloqueado}
            onPress={() => void guardar()}
          />
          {estado === "guardado" || estado === "publicando" ? (
            <BotonSecundario
              texto={
                estado === "publicando"
                  ? "Publicando…"
                  : borrador.corrigePublicacionId
                    ? "Publicar la corrección"
                    : "Publicar"
              }
              onPress={() => void publicarAhora()}
            />
          ) : (
            <Text style={s.tenue}>Guarda los cambios para poder publicar.</Text>
          )}
        </View>
      )}
    </View>
  )
}

const s = StyleSheet.create({
  contenido: { gap: 20 },
  grupo: { gap: 12 },
  cabecera: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  encabezado: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  textos: { flex: 1, gap: 4 },
  titulo: { color: tema.texto, fontFamily: tema.fuenteBoton, fontSize: 20 },
  subtitulo: { color: tema.texto, fontFamily: tema.fuenteSemi, fontSize: 15 },
  estado: { color: tema.textoTenue, fontFamily: tema.fuenteTexto, fontSize: 13 },
  estadoAviso: { color: tema.aviso },
  tenue: { color: tema.textoTenue, fontFamily: tema.fuenteTexto, fontSize: 13, lineHeight: 18 },
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
  textoChip: { color: tema.textoSecundario, fontFamily: tema.fuenteTexto, fontSize: 14 },
  textoChipElegido: { color: tema.texto },
})
