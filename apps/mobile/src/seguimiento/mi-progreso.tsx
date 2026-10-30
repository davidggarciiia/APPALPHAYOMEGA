import { Children, useCallback, useState } from "react"
import { randomUUID } from "expo-crypto"
import { useFocusEffect } from "expo-router"
import { StyleSheet, Text, View } from "react-native"
import Svg, { Circle } from "react-native-svg"
import type { ConfiguracionSeguimiento, MedioFoto } from "@alpha-omega/shared"

import { Esqueleto, GrupoEsqueletos } from "../componentes/esqueleto"
import { AvisoDeError, BotonSecundario } from "../componentes/formulario"
import { Hoja } from "../componentes/hoja"
import { Pulsable } from "../componentes/pulsable"
import { fechaCorta } from "../entrenamiento/plan/modelo"
import { Fila, Tarjeta } from "../entrenamiento/plan/piezas"
import { Enlace } from "../entrenamiento/sesion/controles"
import { espacio, radio, tema, tipo } from "../tema"
import type { ApiSeguimiento } from "./api"
import { ComparadorFotos, ImagenPrivada } from "./comparador-fotos"
import { AnadirMedida, AnadirPrueba } from "./formularios"
import { Grafica } from "./grafica"
import type { ApiMedios } from "./medios-api"
import {
  antesYAhora,
  cifra,
  conUnidad,
  diferencia,
  lineasDeEvolucion,
  lineasDeFuerza,
  unidadLegible,
  type AntesYAhora,
  type Linea,
  type LineaFuerza,
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
type Detalle =
  { tipo: "linea"; linea: Linea } | { tipo: "fuerza"; linea: LineaFuerza } | { tipo: "fotos" }

const FUERZA_VISIBLE = 6
const esPeso = (linea: Linea): boolean =>
  linea.seccion === "medidas" && /\bpeso\b/i.test(linea.nombre)

/**
 * «Progreso» del cliente contado como antes → ahora: las fotos, el peso en
 * grande y cada dato con su comparación dibujada. Un toque abre el detalle.
 */
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
  const abrir = (linea: Linea): void => setDetalle({ tipo: "linea", linea })

  const par = datos?.fotos ? antesYAhora(datos.fotos) : null
  const peso = datos?.lineas.find(esPeso)
  const medidas = datos?.lineas.filter((l) => l.seccion === "medidas" && l !== peso) ?? []
  const composicion = datos?.lineas.filter((l) => l.seccion === "composicion") ?? []
  const pruebas = datos?.lineas.filter((l) => l.seccion === "pruebas") ?? []
  const puedeAnadirPrueba = (datos?.configuracion.pruebasPrescritas.length ?? 0) > 0
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
          {par ? (
            <FotosAntesYAhora par={par} api={medios} abrir={() => setDetalle({ tipo: "fotos" })} />
          ) : (
            (datos.fotos?.length ?? 0) > 0 && (
              <Enlace texto="Ver tus fotos" onPress={() => setDetalle({ tipo: "fotos" })} />
            )
          )}
          {datos.fotos === null && (
            <View style={s.grupo}>
              <AvisoDeError mensaje="No se pudieron cargar las fotos." />
              <BotonSecundario
                texto="Reintentar"
                etiquetaAccesible="Reintentar cargar las fotos"
                onPress={recargar}
              />
            </View>
          )}
          {peso && <PesoGrande linea={peso} abrir={() => abrir(peso)} />}
          <Bloque titulo="Medidas" anadir={() => setFormulario("medida")}>
            {medidas.length > 0
              ? medidas.map((linea) => (
                  <Comparacion key={linea.clave} linea={linea} abrir={() => abrir(linea)} />
                ))
              : !peso && <Text style={s.vacio}>Aún sin medidas.</Text>}
          </Bloque>
          {composicion.length > 0 && (
            <Bloque titulo="Composición">
              {composicion.map((linea) =>
                linea.unidad === "%" ? (
                  <Anillos key={linea.clave} linea={linea} abrir={() => abrir(linea)} />
                ) : (
                  <Comparacion key={linea.clave} linea={linea} abrir={() => abrir(linea)} />
                ),
              )}
            </Bloque>
          )}
          {datos.fuerza.length > 0 && (
            <Bloque titulo="Fuerza">
              {(todaLaFuerza ? datos.fuerza : datos.fuerza.slice(0, FUERZA_VISIBLE)).map(
                (linea) => (
                  <Avance
                    key={linea.ejercicioId}
                    nombre={linea.nombre}
                    antes={linea.inicio.pesoKg}
                    ahora={linea.actual.pesoKg}
                    unidad="kg"
                    abrir={() => setDetalle({ tipo: "fuerza", linea })}
                  />
                ),
              )}
              {datos.fuerza.length > FUERZA_VISIBLE && (
                <Enlace
                  texto={todaLaFuerza ? "Ver menos" : `Ver todos (${datos.fuerza.length})`}
                  onPress={() => setTodaLaFuerza((antes) => !antes)}
                />
              )}
            </Bloque>
          )}
          {datos.configuracion.indicadores.includes("pruebas") &&
            (pruebas.length > 0 || puedeAnadirPrueba) && (
              <Bloque
                titulo="Pruebas"
                anadir={puedeAnadirPrueba ? () => setFormulario("prueba") : undefined}
              >
                {pruebas.length === 0 ? (
                  <Text style={s.vacio}>Aún sin resultados.</Text>
                ) : (
                  pruebas.map((linea) => (
                    <Avance
                      key={linea.clave}
                      nombre={linea.nombre}
                      antes={linea.inicio.valor}
                      ahora={linea.actual.valor}
                      unidad={linea.unidad}
                      abrir={() => abrir(linea)}
                    />
                  ))
                )}
              </Bloque>
            )}
        </>
      )}
      <ValoracionesCliente clienteId={clienteId} api={valoraciones} sinAvisoVacio />
      <Hoja
        visible={detalle !== null}
        alCerrar={() => setDetalle(null)}
        titulo={detalle?.tipo === "fotos" ? "Tus fotos" : detalle?.linea.nombre}
      >
        {detalle?.tipo === "linea" && <DetalleLinea linea={detalle.linea} />}
        {detalle?.tipo === "fuerza" && <DetalleFuerza linea={detalle.linea} />}
        {detalle?.tipo === "fotos" && datos?.fotos && (
          <ComparadorFotos
            fotos={datos.fotos}
            api={medios}
            puedeBorrar={(foto) => foto.origen === "cliente" && foto.autor.id === clienteId}
          />
        )}
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

function Bloque({
  titulo,
  anadir,
  children,
}: {
  titulo: string
  anadir?: () => void
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <View style={s.grupo}>
      <View style={s.cabecera}>
        <Text style={s.tituloBloque} accessibilityRole="header">
          {titulo}
        </Text>
        {anadir && (
          <Enlace texto="Añadir" etiqueta={`Añadir a ${titulo.toLowerCase()}`} onPress={anadir} />
        )}
      </View>
      {hayContenido(children) && <View style={s.tarjeta}>{children}</View>}
    </View>
  )
}

/** Un bloque sin filas deja solo su título y «Añadir»: sin tarjeta vacía. */
const hayContenido = (children: React.ReactNode): boolean => Children.toArray(children).length > 0

function FotosAntesYAhora({
  par,
  api,
  abrir,
}: {
  par: AntesYAhora
  api: Pick<ApiMedios, "acceso">
  abrir: () => void
}): React.JSX.Element {
  const lados = [
    ["Antes", par.antes],
    ["Ahora", par.ahora],
  ] as const
  return (
    <Pulsable
      onPress={abrir}
      accessibilityLabel={`Fotos: antes, ${fechaCorta(par.antes.fechaToma)}; ahora, ${fechaCorta(par.ahora.fechaToma)}`}
      accessibilityHint="Abre todas tus fotos para comparar"
      style={s.fotos}
    >
      {lados.map(([rotulo, foto]) => (
        <View key={rotulo} style={s.foto}>
          <ImagenPrivada
            medioId={foto.id}
            etiqueta={`${rotulo}, ${fechaCorta(foto.fechaToma)}`}
            acceso={api.acceso}
            recorte
          />
          <View style={s.pieFoto}>
            <Text style={[s.micro, rotulo === "Ahora" && s.acento]}>{rotulo}</Text>
            <Text style={s.fechaFoto}>{fechaCorta(foto.fechaToma)}</Text>
          </View>
        </View>
      ))}
    </Pulsable>
  )
}

/** El peso, protagonista: «111,6 → 104,2 kg» y la barra de lo que ha cambiado. */
function PesoGrande({ linea, abrir }: { linea: Linea; abrir: () => void }): React.JSX.Element {
  return (
    <Pulsable
      onPress={abrir}
      accessibilityLabel={etiquetaDe(linea)}
      accessibilityHint="Abre la evolución"
      style={s.tarjeta}
    >
      <Text style={s.micro}>{linea.nombre}</Text>
      <View style={s.lineaGrande}>
        {linea.cambio !== null && (
          <>
            <Text style={s.grandeAntes}>{cifra(linea.inicio.valor)}</Text>
            <Text style={s.flecha}>→</Text>
          </>
        )}
        <Text style={s.grande}>{cifra(linea.actual.valor)}</Text>
        <Text style={s.unidadGrande}>{unidadLegible(linea.unidad)}</Text>
      </View>
      {linea.cambio !== null && (
        <>
          <Barras antes={linea.inicio.valor} ahora={linea.actual.valor} />
          <Pastilla texto={diferencia(linea.cambio, linea.unidad)} sentido={linea.sentido} />
        </>
      )}
    </Pulsable>
  )
}

/** Una medida: «Cintura 118 → 111,5 cm» y dos barras, antes (gris) y ahora (oro). */
function Comparacion({ linea, abrir }: { linea: Linea; abrir: () => void }): React.JSX.Element {
  return (
    <Pulsable
      onPress={abrir}
      accessibilityLabel={etiquetaDe(linea)}
      accessibilityHint="Abre la evolución"
      style={s.fila}
    >
      <Encabezado linea={linea} />
      {linea.cambio !== null && <Barras antes={linea.inicio.valor} ahora={linea.actual.valor} />}
    </Pulsable>
  )
}

/** Un porcentaje (grasa): dos anillos, antes y ahora. */
function Anillos({ linea, abrir }: { linea: Linea; abrir: () => void }): React.JSX.Element {
  return (
    <Pulsable
      onPress={abrir}
      accessibilityLabel={etiquetaDe(linea)}
      accessibilityHint="Abre la evolución"
      style={s.fila}
    >
      <Encabezado linea={linea} />
      <View style={s.anillos}>
        {linea.cambio !== null && (
          <>
            <Anillo valor={linea.inicio.valor} activo={false} />
            <Text style={s.flecha}>→</Text>
          </>
        )}
        <Anillo valor={linea.actual.valor} activo />
      </View>
    </Pulsable>
  )
}

/** Fuerza y pruebas: «100 ▶ 120 kg» y una barra que pinta en oro lo ganado. */
function Avance({
  nombre,
  antes,
  ahora,
  unidad,
  abrir,
}: {
  nombre: string
  antes: number
  ahora: number
  unidad: string
  abrir: () => void
}): React.JSX.Element {
  const cambio = Math.round((ahora - antes) * 100) / 100
  const posicion = escala(antes, ahora)
  return (
    <Pulsable
      onPress={abrir}
      accessibilityLabel={`${nombre}: ${
        cambio === 0
          ? conUnidad(ahora, unidad)
          : `de ${conUnidad(antes, unidad)} a ${conUnidad(ahora, unidad)}, ${diferencia(cambio, unidad)}`
      }`}
      accessibilityHint="Abre la evolución"
      style={s.fila}
    >
      <View style={s.cabecera}>
        <Text style={s.nombre} numberOfLines={2}>
          {nombre}
        </Text>
        <Text style={s.valores}>
          {cambio !== 0 && <Text style={s.tenue}>{cifra(antes)} ▶ </Text>}
          {conUnidad(ahora, unidad)}
        </Text>
      </View>
      {/* Gris hasta el inicio; oro lo ganado. Si bajó, oro hasta el valor de ahora. */}
      <View style={s.pista} importantForAccessibility="no-hide-descendants">
        <View style={[s.relleno, s.rellenoNeutro, { width: `${posicion.antes}%` }]} />
        <View
          style={[
            s.tramo,
            cambio > 0
              ? { left: `${posicion.antes}%`, width: `${posicion.ahora - posicion.antes}%` }
              : { left: 0, width: `${posicion.ahora}%` },
          ]}
        />
      </View>
    </Pulsable>
  )
}

function Encabezado({ linea }: { linea: Linea }): React.JSX.Element {
  return (
    <View style={s.cabecera}>
      <Text style={s.nombre} numberOfLines={2}>
        {linea.nombre}
      </Text>
      <View style={s.derecha}>
        <Text style={s.valores}>
          {linea.cambio !== null && <Text style={s.tenue}>{cifra(linea.inicio.valor)} → </Text>}
          {conUnidad(linea.actual.valor, linea.unidad)}
        </Text>
        {linea.cambio !== null && (
          <Pastilla texto={diferencia(linea.cambio, linea.unidad)} sentido={linea.sentido} />
        )}
      </View>
    </View>
  )
}

function Barras({ antes, ahora }: { antes: number; ahora: number }): React.JSX.Element {
  const posicion = escala(antes, ahora)
  return (
    <View style={s.barras} importantForAccessibility="no-hide-descendants">
      <View style={s.pista}>
        <View style={[s.relleno, s.rellenoNeutro, { width: `${posicion.antes}%` }]} />
      </View>
      <View style={s.pista}>
        <View style={[s.relleno, { width: `${posicion.ahora}%` }]} />
      </View>
    </View>
  )
}

/**
 * Posición en la barra (0–100) de dos valores. La escala empieza en la mitad
 * del menor: un cambio pequeño se ve sin exagerarlo, y nunca se invierte.
 */
function escala(antes: number, ahora: number): { antes: number; ahora: number } {
  const maximo = Math.max(antes, ahora)
  const base = Math.max(0, Math.min(antes, ahora) / 2)
  const tramo = maximo - base || 1
  return { antes: ((antes - base) / tramo) * 100, ahora: ((ahora - base) / tramo) * 100 }
}

const RADIO_ANILLO = 26
const VUELTA = 2 * Math.PI * RADIO_ANILLO

function Anillo({ valor, activo }: { valor: number; activo: boolean }): React.JSX.Element {
  const parte = Math.min(Math.max(valor, 0), 100) / 100
  return (
    <View style={s.anillo} importantForAccessibility="no-hide-descendants">
      <Svg width={64} height={64} viewBox="0 0 64 64">
        <Circle
          cx={32}
          cy={32}
          r={RADIO_ANILLO}
          stroke={tema.superficieAlta}
          strokeWidth={8}
          fill="none"
        />
        <Circle
          cx={32}
          cy={32}
          r={RADIO_ANILLO}
          stroke={activo ? tema.acento : tema.bordeFuerte}
          strokeWidth={8}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={[VUELTA * parte, VUELTA]}
          transform="rotate(-90 32 32)"
        />
      </Svg>
      <Text style={[s.cifraAnillo, activo && s.acento]}>{cifra(valor)} %</Text>
    </View>
  )
}

function Pastilla({ texto, sentido }: { texto: string; sentido: Sentido }): React.JSX.Element {
  return (
    <Text
      style={[
        s.pastilla,
        sentido === "favorable" && s.pastillaBien,
        sentido === "desfavorable" && s.pastillaMal,
      ]}
    >
      {texto}
    </Text>
  )
}

function etiquetaDe(linea: Linea): string {
  return linea.cambio === null
    ? `${linea.nombre}: ${conUnidad(linea.actual.valor, linea.unidad)}`
    : `${linea.nombre}: de ${conUnidad(linea.inicio.valor, linea.unidad)} a ${conUnidad(linea.actual.valor, linea.unidad)}, ${diferencia(linea.cambio, linea.unidad)}`
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
        <Esqueleto alto={240} radio={radio.tarjeta} />
        <Esqueleto alto={160} radio={radio.tarjeta} />
      </GrupoEsqueletos>
    </View>
  )
}

const s = StyleSheet.create({
  pantalla: { gap: espacio[32] },
  grupo: { gap: espacio[12] },
  tarjeta: {
    backgroundColor: tema.superficie,
    borderRadius: radio.tarjeta,
    padding: espacio[20],
    gap: espacio[20],
  },
  cabecera: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: espacio[12],
  },
  tituloBloque: { ...tipo.titulo, color: tema.texto },
  fotos: { flexDirection: "row", gap: espacio[8] },
  foto: { flex: 1, gap: espacio[8] },
  pieFoto: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
  fechaFoto: { ...tipo.secundario },
  micro: { ...tipo.micro, color: tema.textoTenue },
  acento: { color: tema.acento },
  lineaGrande: {
    flexDirection: "row",
    alignItems: "baseline",
    flexWrap: "wrap",
    gap: espacio[8],
  },
  grande: { ...tipo.heroCompacto, ...tipo.cifras },
  grandeAntes: { ...tipo.heroCompacto, ...tipo.cifras, color: tema.textoTenue },
  unidadGrande: { ...tipo.titulo, color: tema.acento },
  flecha: { ...tipo.titulo, color: tema.textoTenue },
  fila: { gap: espacio[8], minHeight: 44 },
  nombre: { ...tipo.fila, color: tema.texto, flex: 1 },
  derecha: { alignItems: "flex-end", gap: espacio[4] },
  valores: { ...tipo.fila, ...tipo.cifras, color: tema.texto },
  barras: { gap: espacio[4] },
  pista: {
    height: 10,
    borderRadius: 5,
    backgroundColor: tema.superficieAlta,
    overflow: "hidden",
  },
  relleno: { height: 10, borderRadius: 5, backgroundColor: tema.acento },
  rellenoNeutro: { backgroundColor: tema.bordeFuerte },
  tramo: {
    position: "absolute",
    top: 0,
    height: 10,
    borderRadius: 5,
    backgroundColor: tema.acento,
  },
  anillos: { flexDirection: "row", alignItems: "center", gap: espacio[12] },
  anillo: { width: 64, height: 64, alignItems: "center", justifyContent: "center" },
  cifraAnillo: {
    position: "absolute",
    ...tipo.secundario,
    ...tipo.cifras,
    color: tema.textoSecundario,
  },
  pastilla: {
    ...tipo.secundario,
    ...tipo.cifras,
    color: tema.textoSecundario,
    backgroundColor: tema.superficieAlta,
    borderRadius: radio.pastilla,
    paddingHorizontal: espacio[8],
    paddingVertical: espacio[2],
    overflow: "hidden",
    alignSelf: "flex-start",
  },
  pastillaBien: { color: tema.exito, backgroundColor: tema.exitoSuave },
  pastillaMal: { color: tema.aviso, backgroundColor: tema.acentoSuave },
  fecha: { ...tipo.cuerpo, color: tema.texto, flex: 1 },
  valor: { ...tipo.cuerpo, ...tipo.cifras, color: tema.textoSecundario },
  tenue: { ...tipo.secundario, color: tema.textoTenue },
  vacio: { ...tipo.cuerpo, color: tema.textoTenue },
})
