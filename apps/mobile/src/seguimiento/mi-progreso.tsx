import { useCallback, useState } from "react"
import { randomUUID } from "expo-crypto"
import { useFocusEffect } from "expo-router"
import { StyleSheet, Text, View } from "react-native"
import type { ConfiguracionSeguimiento, MedioFoto } from "@alpha-omega/shared"

import { Esqueleto, GrupoEsqueletos } from "../componentes/esqueleto"
import { AvisoDeError, BotonSecundario } from "../componentes/formulario"
import { Hoja } from "../componentes/hoja"
import { Pulsable } from "../componentes/pulsable"
import { fechaCorta } from "../entrenamiento/plan/modelo"
import { Fila, Tarjeta, Titulo } from "../entrenamiento/plan/piezas"
import { Enlace } from "../entrenamiento/sesion/controles"
import { espacio, radio, tema, tipo } from "../tema"
import type { ApiSeguimiento } from "./api"
import { ComparadorFotos } from "./comparador-fotos"
import { AnadirMedida, AnadirPrueba } from "./formularios"
import { Grafica } from "./grafica"
import type { ApiMedios } from "./medios-api"
import {
  conUnidad,
  diferencia,
  lineasDeEvolucion,
  lineasDeFuerza,
  resumen,
  type Linea,
  type LineaFuerza,
  type Seccion,
  type Sentido,
} from "./mi-progreso-modelo"
import { ValoracionesCliente } from "./resumen-valoracion"
import { SolicitudesFotos } from "./solicitudes-fotos"
import type { ApiEvolucionAvisos, ApiValoracionesCliente } from "./valoraciones-api"

type Datos = {
  configuracion: ConfiguracionSeguimiento
  lineas: Linea[]
  fuerza: LineaFuerza[]
  /** `null` si las fotos no se pudieron cargar; el resto se muestra igual. */
  fotos: MedioFoto[] | null
}
type Detalle = { tipo: "linea"; linea: Linea } | { tipo: "fuerza"; linea: LineaFuerza }

const TITULO: Record<Seccion, string> = {
  medidas: "Medidas",
  composicion: "Composición corporal",
  pruebas: "Pruebas físicas",
}
const FUERZA_VISIBLE = 6

/** «Progreso» del cliente: qué ha cambiado desde el inicio y, a un toque, el detalle. */
export function MiProgreso({
  clienteId,
  seguimiento,
  valoraciones,
  medios,
}: {
  clienteId: string
  seguimiento: Pick<
    ApiSeguimiento,
    "configuracion" | "fuerza" | "registrarMedida" | "registrarPrueba"
  >
  valoraciones: ApiValoracionesCliente & Pick<ApiEvolucionAvisos, "evolucion">
  /** `api` estable entre renderizados (como el de `useMedios`). */
  medios: ApiMedios
}): React.JSX.Element {
  const [datos, setDatos] = useState<Datos | null>(null)
  const [error, setError] = useState("")
  const [intento, setIntento] = useState(0)
  const [detalle, setDetalle] = useState<Detalle | null>(null)
  const [formulario, setFormulario] = useState<"medida" | "prueba" | null>(null)
  const [todaLaFuerza, setTodaLaFuerza] = useState(false)

  useFocusEffect(
    useCallback(() => {
      let vigente = true
      setError("")
      Promise.all([
        seguimiento.configuracion(clienteId),
        valoraciones.evolucion(clienteId),
        seguimiento.fuerza(clienteId),
        medios.fotosDeCliente(clienteId).then(
          (listado) => listado.fotos,
          () => null,
        ),
      ])
        .then(([configuracion, evolucion, fuerza, fotos]) => {
          if (!vigente) return
          setDatos({
            configuracion,
            lineas: lineasDeEvolucion(evolucion.series, configuracion),
            fuerza: configuracion.indicadores.includes("fuerza")
              ? lineasDeFuerza(fuerza.ejercicios)
              : [],
            fotos,
          })
        })
        .catch(() => {
          if (vigente) setError("No se pudo cargar tu progreso. Revisa la conexión.")
        })
      return () => {
        vigente = false
      }
    }, [seguimiento, valoraciones, medios, clienteId, intento]),
  )
  const recargar = (): void => setIntento((n) => n + 1)

  const puedeAnadirPrueba = (datos?.configuracion.pruebasPrescritas.length ?? 0) > 0
  const lineasDe = (seccion: Seccion): Linea[] =>
    datos?.lineas.filter((l) => l.seccion === seccion) ?? []
  const filasResumen = datos ? resumen(datos.lineas, datos.fuerza) : []
  const vacio =
    datos !== null &&
    datos.lineas.length === 0 &&
    datos.fuerza.length === 0 &&
    (datos.fotos?.length ?? 0) === 0

  return (
    <View style={s.pantalla}>
      <SolicitudesFotos
        clienteId={clienteId}
        api={medios}
        modo="cliente"
        nuevoId={randomUUID}
        ocultarSinPendientes
      />
      {error !== "" && (
        <View style={s.grupo}>
          <AvisoDeError mensaje={error} />
          <BotonSecundario texto="Reintentar" onPress={recargar} />
        </View>
      )}
      {datos === null ? (
        error === "" && <CargaProgreso />
      ) : (
        <>
          {vacio && (
            <Text style={s.vacio}>
              Tu entrenador registrará tu punto de partida en la primera valoración.
            </Text>
          )}
          {filasResumen.length > 0 && (
            <View style={s.grupo}>
              <Titulo>Desde el inicio</Titulo>
              <Tarjeta>
                {filasResumen.map((fila, n) => (
                  <Fila key={fila.clave} primera={n === 0}>
                    <View
                      accessible
                      accessibilityLabel={`${fila.nombre}: de ${fila.inicio} a ${fila.actual}, ${fila.cambio}`}
                      style={s.filaResumen}
                    >
                      <Text style={s.nombre} numberOfLines={1}>
                        {fila.nombre}
                      </Text>
                      <View style={s.derecha}>
                        <Text style={s.valor}>
                          {fila.inicio} → {fila.actual}
                        </Text>
                        <Cambio texto={fila.cambio} sentido={fila.sentido} />
                      </View>
                    </View>
                  </Fila>
                ))}
              </Tarjeta>
            </View>
          )}
          {datos.fuerza.length > 0 && (
            <View style={s.grupo}>
              <Titulo>Fuerza</Titulo>
              <Tarjeta>
                {(todaLaFuerza ? datos.fuerza : datos.fuerza.slice(0, FUERZA_VISIBLE)).map(
                  (linea, n) => (
                    <FilaPulsable
                      key={linea.ejercicioId}
                      primera={n === 0}
                      nombre={linea.nombre}
                      valor={`${conUnidad(linea.actual.pesoKg, "kg")} × ${linea.actual.repeticiones}`}
                      cambio={linea.cambio ? diferencia(linea.cambio, "kg") : null}
                      sentido={linea.cambio && linea.cambio > 0 ? "favorable" : "neutral"}
                      abrir={() => setDetalle({ tipo: "fuerza", linea })}
                    />
                  ),
                )}
              </Tarjeta>
              {datos.fuerza.length > FUERZA_VISIBLE && (
                <Enlace
                  texto={todaLaFuerza ? "Ver menos" : `Ver todos (${datos.fuerza.length})`}
                  onPress={() => setTodaLaFuerza((antes) => !antes)}
                />
              )}
            </View>
          )}
          <SeccionDeLineas
            titulo={TITULO.medidas}
            lineas={lineasDe("medidas")}
            abrir={(linea) => setDetalle({ tipo: "linea", linea })}
            anadir={() => setFormulario("medida")}
            vacio="Aún sin medidas."
          />
          <SeccionDeLineas
            titulo={TITULO.composicion}
            lineas={lineasDe("composicion")}
            abrir={(linea) => setDetalle({ tipo: "linea", linea })}
          />
          {(datos.configuracion.indicadores.includes("pruebas") ||
            lineasDe("pruebas").length > 0) && (
            <SeccionDeLineas
              titulo={TITULO.pruebas}
              lineas={lineasDe("pruebas")}
              abrir={(linea) => setDetalle({ tipo: "linea", linea })}
              anadir={puedeAnadirPrueba ? () => setFormulario("prueba") : undefined}
              vacio={puedeAnadirPrueba ? "Aún sin resultados." : undefined}
            />
          )}
          {datos.fotos === null ? (
            <View style={s.grupo}>
              <Titulo>Fotos</Titulo>
              <AvisoDeError mensaje="No se pudieron cargar las fotos." />
              <BotonSecundario
                texto="Reintentar"
                etiquetaAccesible="Reintentar cargar las fotos"
                onPress={recargar}
              />
            </View>
          ) : (
            datos.fotos.length > 0 && (
              <View style={s.grupo}>
                <Titulo>Fotos</Titulo>
                <ComparadorFotos
                  fotos={datos.fotos}
                  api={medios}
                  puedeBorrar={(foto) => foto.origen === "cliente" && foto.autor.id === clienteId}
                />
              </View>
            )
          )}
        </>
      )}
      <ValoracionesCliente clienteId={clienteId} api={valoraciones} sinAvisoVacio />
      <Hoja
        visible={detalle !== null}
        alCerrar={() => setDetalle(null)}
        titulo={detalle?.linea.nombre}
      >
        {detalle?.tipo === "linea" && <DetalleLinea linea={detalle.linea} />}
        {detalle?.tipo === "fuerza" && <DetalleFuerza linea={detalle.linea} />}
      </Hoja>
      <AnadirMedida
        visible={formulario === "medida"}
        cerrar={() => setFormulario(null)}
        registrar={async (medida) => {
          await seguimiento.registrarMedida(clienteId, medida)
          recargar()
        }}
      />
      <AnadirPrueba
        visible={formulario === "prueba"}
        pruebas={datos?.configuracion.pruebasPrescritas ?? []}
        cerrar={() => setFormulario(null)}
        registrar={async (prueba) => {
          await seguimiento.registrarPrueba(clienteId, prueba)
          recargar()
        }}
      />
    </View>
  )
}

function SeccionDeLineas({
  titulo,
  lineas,
  abrir,
  anadir,
  vacio,
}: {
  titulo: string
  lineas: Linea[]
  abrir: (linea: Linea) => void
  anadir?: () => void
  /** Sin él, una sección sin datos no se pinta. */
  vacio?: string
}): React.JSX.Element | null {
  if (lineas.length === 0 && !vacio) return null
  return (
    <View style={s.grupo}>
      <View style={s.cabecera}>
        <Titulo>{titulo}</Titulo>
        {anadir && (
          <Enlace texto="Añadir" etiqueta={`Añadir a ${titulo.toLowerCase()}`} onPress={anadir} />
        )}
      </View>
      {lineas.length === 0 ? (
        <Text style={s.vacio}>{vacio}</Text>
      ) : (
        <Tarjeta>
          {lineas.map((linea, n) => (
            <FilaPulsable
              key={linea.clave}
              primera={n === 0}
              nombre={linea.nombre}
              valor={conUnidad(linea.actual.valor, linea.unidad)}
              cambio={linea.cambio === null ? null : diferencia(linea.cambio, linea.unidad)}
              sentido={linea.sentido}
              abrir={() => abrir(linea)}
            />
          ))}
        </Tarjeta>
      )}
    </View>
  )
}

function FilaPulsable({
  primera,
  nombre,
  valor,
  cambio,
  sentido,
  abrir,
}: {
  primera: boolean
  nombre: string
  valor: string
  cambio: string | null
  sentido: Sentido
  abrir: () => void
}): React.JSX.Element {
  return (
    <Fila primera={primera}>
      <Pulsable
        onPress={abrir}
        accessibilityLabel={`${nombre}: ${valor}${cambio ? `, ${cambio} desde el inicio` : ""}`}
        accessibilityHint="Abre la evolución"
        style={s.filaPulsable}
      >
        <Text style={s.nombre} numberOfLines={2}>
          {nombre}
        </Text>
        <View style={s.derecha}>
          <Text style={s.valor}>{valor}</Text>
          {cambio && <Cambio texto={cambio} sentido={sentido} />}
        </View>
      </Pulsable>
    </Fila>
  )
}

function Cambio({ texto, sentido }: { texto: string; sentido: Sentido }): React.JSX.Element {
  return (
    <Text
      style={[
        s.cambio,
        sentido === "favorable" && s.favorable,
        sentido === "desfavorable" && s.desfavorable,
      ]}
    >
      {texto}
    </Text>
  )
}

function DetalleLinea({ linea }: { linea: Linea }): React.JSX.Element {
  return (
    <View style={s.grupo}>
      {linea.puntos.length > 1 && (
        <Grafica
          puntos={linea.puntos}
          tendencia={linea.puntos}
          descripcion={`${linea.nombre}: de ${conUnidad(linea.inicio.valor, linea.unidad)} el ${fechaCorta(linea.inicio.fecha)} a ${conUnidad(linea.actual.valor, linea.unidad)} el ${fechaCorta(linea.actual.fecha)}.`}
          izquierda={fechaCorta(linea.inicio.fecha)}
          derecha={fechaCorta(linea.actual.fecha)}
        />
      )}
      <Historial
        filas={linea.puntos.map((p) => ({
          fecha: p.fecha,
          valor: conUnidad(p.valor, linea.unidad),
        }))}
      />
      {linea.otras.map((otra) => {
        const ultimo = [...otra.puntos].sort((a, b) => a.fecha.localeCompare(b.fecha)).at(-1)!
        return (
          <Text key={otra.clave} style={s.tenue}>
            Otra medición{otra.metodo ? ` (${otra.metodo})` : ""}:{" "}
            {conUnidad(ultimo.valor, otra.unidad)} el {fechaCorta(ultimo.fecha)}
          </Text>
        )
      })}
    </View>
  )
}

function DetalleFuerza({ linea }: { linea: LineaFuerza }): React.JSX.Element {
  return (
    <View style={s.grupo}>
      {linea.puntos.length > 1 && (
        <Grafica
          puntos={linea.puntos.map((p) => ({ fecha: p.fecha, valor: p.pesoKg }))}
          tendencia={linea.puntos.map((p) => ({ fecha: p.fecha, valor: p.pesoKg }))}
          descripcion={`${linea.nombre}: de ${conUnidad(linea.inicio.pesoKg, "kg")} × ${linea.inicio.repeticiones} a ${conUnidad(linea.actual.pesoKg, "kg")} × ${linea.actual.repeticiones}.`}
          izquierda={fechaCorta(linea.inicio.fecha)}
          derecha={fechaCorta(linea.actual.fecha)}
        />
      )}
      <Historial
        filas={linea.puntos.map((p) => ({
          fecha: p.fecha,
          valor: `${conUnidad(p.pesoKg, "kg")} × ${p.repeticiones}`,
        }))}
      />
    </View>
  )
}

/** Del más reciente al más antiguo. */
function Historial({
  filas,
}: {
  filas: Array<{ fecha: string; valor: string }>
}): React.JSX.Element {
  return (
    <Tarjeta>
      {[...filas].reverse().map((fila, n) => (
        <Fila key={`${fila.fecha}-${n}`} primera={n === 0}>
          <Text style={s.fecha}>{fechaCorta(fila.fecha)}</Text>
          <Text style={s.valor}>{fila.valor}</Text>
        </Fila>
      ))}
    </Tarjeta>
  )
}

function CargaProgreso(): React.JSX.Element {
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel="Cargando progreso"
      style={s.pantalla}
    >
      <GrupoEsqueletos>
        <Esqueleto alto={160} radio={radio.tarjeta} />
        <Esqueleto alto={220} radio={radio.tarjeta} />
      </GrupoEsqueletos>
    </View>
  )
}

const s = StyleSheet.create({
  pantalla: { gap: espacio[28] },
  grupo: { gap: espacio[12] },
  cabecera: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  filaResumen: { flex: 1, flexDirection: "row", alignItems: "center", gap: espacio[12] },
  filaPulsable: {
    flex: 1,
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: espacio[12],
  },
  nombre: { ...tipo.fila, color: tema.texto, flex: 1 },
  derecha: { alignItems: "flex-end", gap: 2 },
  valor: { ...tipo.cuerpo, ...tipo.cifras, color: tema.textoSecundario },
  cambio: { ...tipo.secundario, ...tipo.cifras },
  favorable: { color: tema.exito },
  desfavorable: { color: tema.aviso },
  fecha: { ...tipo.cuerpo, color: tema.texto, flex: 1 },
  tenue: { ...tipo.secundario },
  vacio: { ...tipo.cuerpo, color: tema.textoTenue },
})
