import { useCallback, useState } from "react"
import { randomUUID } from "expo-crypto"
import { useFocusEffect } from "expo-router"
import { StyleSheet, Text, View } from "react-native"
import type {
  ConfiguracionSeguimiento,
  ListadoDias,
  ListadoMedidas,
  ListadoPruebas,
  ListadoSesiones,
  PlanVigente,
  ProgresionFuerza,
} from "@alpha-omega/shared"

import { AvisoDeError, BotonSecundario } from "../componentes/formulario"
import { EntradaMarca } from "../componentes/entrada-marca"
import { Esqueleto, GrupoEsqueletos } from "../componentes/esqueleto"
import type { ApiEntrenamiento } from "../entrenamiento/api"
import { hoyAgenda, lunesDeSemana, sumarDias } from "../entrenamiento/fechas"
import { fechaCorta } from "../entrenamiento/plan/modelo"
import { Fila, Pestanas, Tarjeta, Titulo } from "../entrenamiento/plan/piezas"
import { Enlace } from "../entrenamiento/sesion/controles"
import { espacio, radio, tema, tipo } from "../tema"
import type { ApiSeguimiento } from "./api"
import { EditorConfiguracionSeguimiento } from "./configuracion"
import { AnadirMedida, AnadirPrueba } from "./formularios"
import { EvolucionValoraciones } from "./evolucion-valoraciones"
import { Grafica } from "./grafica"
import type { ApiMedios } from "./medios-api"
import { ValoracionesCliente } from "./resumen-valoracion"
import { SolicitudesFotos } from "./solicitudes-fotos"
import type { ApiEvolucionAvisos, ApiValoracionesCliente } from "./valoraciones-api"
import { puntoDePartida, type ValorDeToma } from "./punto-de-partida"
import {
  edadEn,
  mediaMovil,
  miles,
  pesoLegible,
  proximosRegistros,
  resumenDeSemana,
  sentidoDelPeso,
  suenoLegible,
} from "./modelo"

type Pestana = ConfiguracionSeguimiento["indicadores"][number]
const NOMBRE: Record<Pestana, string> = {
  peso: "Peso",
  pasos: "Pasos",
  sueno: "Sueño",
  cintura: "Cintura",
  fuerza: "Fuerza",
  pruebas: "Pruebas físicas",
}

type Datos = {
  configuracion: ConfiguracionSeguimiento
  dias: ListadoDias["dias"]
  medidas: ListadoMedidas
  pruebas: ListadoPruebas["pruebas"]
  fuerza: ProgresionFuerza["ejercicios"]
  plan: PlanVigente | null
  semana: ListadoSesiones
}

const decimal = (valor: number): string => valor.toFixed(1).replace(".", ",")
/** «−0,2 kg», «+1,0 cm». */
function diferencia(valor: number, unidad: string): string {
  const signo = valor > 0 ? "+" : valor < 0 ? "−" : "±"
  return `${signo}${decimal(Math.abs(valor))} ${unidad}`
}

/** «Progreso»: peso, cintura, fuerza y pruebas físicas, con la semana y el punto de partida. */
export function ProgresoCliente({
  clienteId,
  seguimiento,
  entrenamiento,
  valoraciones,
  medios,
  modo = "cliente",
}: {
  clienteId: string
  seguimiento: ApiSeguimiento
  entrenamiento: ApiEntrenamiento
  /** Valoraciones publicadas del cliente; en la ficha profesional van aparte. */
  valoraciones?: ApiValoracionesCliente & Pick<ApiEvolucionAvisos, "evolucion">
  /** Solicitudes, aportación y consulta de fotografías privadas del cliente. */
  medios?: ApiMedios
  modo?: "cliente" | "entrenador"
}): React.JSX.Element {
  const [pestana, setPestana] = useState<Pestana>()
  const [datos, setDatos] = useState<Datos | null>(null)
  const [error, setError] = useState("")
  const [intento, setIntento] = useState(0)
  const [formulario, setFormulario] = useState<"medida" | "prueba" | null>(null)
  const [verEvolucion, setVerEvolucion] = useState(false)
  const hoy = hoyAgenda()
  const lunes = lunesDeSemana(hoy)

  useFocusEffect(
    useCallback(() => {
      let vigente = true
      setError("")
      Promise.all([
        seguimiento.configuracion(clienteId),
        seguimiento.dias(clienteId, sumarDias(hoy, -55), hoy),
        seguimiento.medidas(clienteId),
        seguimiento.pruebas(clienteId),
        seguimiento.fuerza(clienteId),
        entrenamiento.plan(clienteId, lunes),
        entrenamiento.semana(clienteId, lunes),
      ])
        .then(([configuracion, dias, medidas, pruebas, fuerza, { plan }, semana]) => {
          if (vigente)
            setDatos({
              configuracion,
              dias: dias.dias,
              medidas,
              pruebas: pruebas.pruebas,
              fuerza: fuerza.ejercicios,
              plan,
              semana,
            })
        })
        .catch(() => {
          if (vigente) setError("No se pudo cargar tu progreso. Revisa la conexión.")
        })
      return () => {
        vigente = false
      }
    }, [seguimiento, entrenamiento, clienteId, hoy, lunes, intento]),
  )

  const recargar = (): void => setIntento((n) => n + 1)
  const opciones =
    datos?.configuracion.indicadores.map((valor) => ({ valor, texto: NOMBRE[valor] })) ?? []
  const activa = opciones.some((opcion) => opcion.valor === pestana) ? pestana : opciones[0]?.valor

  return (
    <View style={s.contenido}>
      {modo === "entrenador" && datos && (
        <EditorConfiguracionSeguimiento
          valor={datos.configuracion}
          guardar={async (configuracion) => {
            const guardada = await seguimiento.guardarConfiguracion(clienteId, configuracion)
            setDatos((actual) => (actual ? { ...actual, configuracion: guardada } : actual))
            return guardada
          }}
          recargar={recargar}
        />
      )}
      {opciones.length > 0 && activa && (
        <Pestanas opciones={opciones} activa={activa} cambiar={setPestana} />
      )}
      {error !== "" && (
        <View style={s.grupo}>
          <AvisoDeError mensaje={error} />
          <BotonSecundario texto="Reintentar" onPress={recargar} />
        </View>
      )}
      {datos === null ? (
        error === "" && <CargaProgreso />
      ) : (
        <EntradaMarca style={s.contenido}>
          {!activa && <Text style={s.vacio}>Aún sin indicadores activos.</Text>}
          {activa === "peso" && <Peso datos={datos} hoy={hoy} />}
          {activa === "pasos" && <DatoDiario datos={datos} tipo="pasos" />}
          {activa === "sueno" && <DatoDiario datos={datos} tipo="sueno" />}
          {activa === "cintura" && <Cintura datos={datos} />}
          {activa === "fuerza" && <Fuerza ejercicios={datos.fuerza} />}
          {activa === "pruebas" && (
            <Pruebas
              pruebas={datos.pruebas}
              anadir={() => setFormulario("prueba")}
              pautadas={datos.configuracion.pruebasPrescritas}
              puedeAnadir={modo === "cliente" && datos.configuracion.pruebasPrescritas.length > 0}
            />
          )}
          {(activa === "peso" || activa === "cintura") && (
            <>
              <Semana datos={datos} lunes={lunes} />
              <Inicio datos={datos} hoy={hoy} anadir={() => setFormulario("medida")} />
            </>
          )}
          {modo === "cliente" && <SiguientesRegistros datos={datos} hoy={hoy} />}
        </EntradaMarca>
      )}
      {modo === "cliente" && valoraciones && (
        <ValoracionesCliente clienteId={clienteId} api={valoraciones} />
      )}
      {modo === "cliente" && valoraciones && (
        <View style={s.grupo}>
          <BotonSecundario
            texto={verEvolucion ? "Ocultar mi evolución" : "Ver mi evolución"}
            onPress={() => setVerEvolucion((actual) => !actual)}
          />
          {verEvolucion && (
            <EvolucionValoraciones
              clienteId={clienteId}
              api={valoraciones}
              modo="cliente"
              fotos={
                medios
                  ? {
                      api: medios,
                      puedeBorrar: (foto) =>
                        foto.origen === "cliente" && foto.autor.id === clienteId,
                    }
                  : undefined
              }
            />
          )}
        </View>
      )}
      {modo === "cliente" && medios && (
        <SolicitudesFotos clienteId={clienteId} api={medios} modo="cliente" nuevoId={randomUUID} />
      )}
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

function CargaProgreso(): React.JSX.Element {
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel="Cargando progreso"
      style={s.contenido}
    >
      <GrupoEsqueletos>
        <Esqueleto alto={44} />
        <View style={s.destacada}>
          <Esqueleto ancho="55%" alto={60} />
          <Esqueleto ancho="70%" alto={18} />
          <Esqueleto alto={140} />
        </View>
        <Esqueleto alto={168} radio={radio.tarjeta} />
      </GrupoEsqueletos>
    </View>
  )
}

function DatoDiario({ datos, tipo }: { datos: Datos; tipo: "pasos" | "sueno" }): React.JSX.Element {
  const valores = datos.dias.filter((dia) => dia[tipo === "pasos" ? "pasos" : "suenoMin"] !== null)
  const ultimo = valores[valores.length - 1]
  if (!ultimo)
    return (
      <Tendencia
        grande="—"
        unidad={tipo === "pasos" ? "pasos" : "h"}
        subtitulo="Sin registros"
        cambio={null}
      />
    )
  const valor = tipo === "pasos" ? miles(ultimo.pasos!) : suenoLegible(ultimo.suenoMin!)
  const puntos = valores.map((dia) => ({
    fecha: dia.fecha,
    valor: tipo === "pasos" ? dia.pasos! : dia.suenoMin!,
  }))
  return (
    <Tendencia
      grande={valor}
      unidad={tipo === "pasos" ? "pasos" : undefined}
      subtitulo={`Último registro · ${fechaCorta(ultimo.fecha)}`}
      cambio={null}
    >
      <Grafica
        animar
        puntos={puntos}
        tendencia={puntos}
        descripcion={`${NOMBRE[tipo]} por día. Último registro: ${valor}${tipo === "pasos" ? " pasos" : ""}.`}
        izquierda={fechaCorta(puntos[0]!.fecha)}
        derecha={fechaCorta(ultimo.fecha)}
      />
    </Tendencia>
  )
}

function SiguientesRegistros({
  datos,
  hoy,
}: {
  datos: Datos
  hoy: string
}): React.JSX.Element | null {
  const siguientes = proximosRegistros(datos.configuracion, datos.dias, datos.medidas.medidas, hoy)
  if (siguientes.length === 0) return null
  return (
    <View style={s.grupo}>
      <Titulo>Próximos registros</Titulo>
      <Tarjeta>
        {siguientes.map((r, n) => (
          <Fila key={r.indicador} primera={n === 0}>
            <Text style={[s.texto, s.textos]}>{NOMBRE[r.indicador]}</Text>
            <Text style={s.valor}>{r.fecha === hoy ? "Hoy" : fechaCorta(r.fecha)}</Text>
          </Fila>
        ))}
      </Tarjeta>
    </View>
  )
}

function Tendencia({
  grande,
  unidad,
  subtitulo,
  cambio,
  sentido = "neutral",
  children,
}: {
  grande: string
  unidad?: string
  subtitulo: string
  cambio: string | null
  sentido?: "neutral" | "favorable" | "desfavorable"
  children?: React.ReactNode
}): React.JSX.Element {
  return (
    <View style={s.destacada}>
      <Text style={s.grande}>
        {grande}
        {unidad && <Text style={s.unidad}> {unidad}</Text>}
      </Text>
      <Text style={s.tenue}>
        {subtitulo}
        {cambio && (
          <Text
            style={
              sentido === "favorable" ? s.baja : sentido === "desfavorable" ? s.error : s.tenue
            }
          >
            {" · "}
            {cambio}
          </Text>
        )}
      </Text>
      {children}
    </View>
  )
}

function Peso({ datos, hoy }: { datos: Datos; hoy: string }): React.JSX.Element {
  const conPeso = datos.dias.filter((d) => d.pesoKg !== null)
  if (conPeso.length === 0)
    return <Tendencia grande="—" unidad="kg" subtitulo="Sin registros" cambio={null} />
  const tendencia = mediaMovil(datos.dias, 7)
  const actual = tendencia[tendencia.length - 1]!
  const inicio = datos.medidas.medidas.find((m) => m.pesoKg !== null)?.pesoKg ?? tendencia[0]!.valor
  const ultimo = conPeso[conPeso.length - 1]!
  const recientes = conPeso.filter((d) => d.fecha >= sumarDias(hoy, -27))
  const puntos = (recientes.length > 1 ? recientes : conPeso).map((d) => ({
    fecha: d.fecha,
    valor: d.pesoKg!,
  }))
  const desde = puntos[0]!.fecha
  return (
    <Tendencia
      grande={decimal(actual.valor)}
      unidad="kg"
      subtitulo="Media semanal"
      sentido={sentidoDelPeso(datos.configuracion.objetivoPeso, inicio, actual.valor)}
      cambio={
        actual.valor === inicio
          ? null
          : `${diferencia(actual.valor - inicio, "kg")} desde el inicio`
      }
    >
      <Grafica
        animar
        puntos={puntos}
        tendencia={tendencia.filter((p) => p.fecha >= desde)}
        descripcion={`Peso en ayunas por día. Media de la semana: ${pesoLegible(actual.valor)}. Último: ${pesoLegible(ultimo.pesoKg!)}.`}
        izquierda={fechaCorta(desde)}
        derecha={`${ultimo.fecha === hoy ? "Hoy" : fechaCorta(ultimo.fecha)}, ${pesoLegible(ultimo.pesoKg!)}`}
      />
      {datos.configuracion.objetivoPeso && (
        <Text style={s.tenue}>
          Objetivo: {datos.configuracion.objetivoPeso.direccion}
          {datos.configuracion.objetivoPeso.rangoKg
            ? ` · ${pesoLegible(datos.configuracion.objetivoPeso.rangoKg.minimo)}–${pesoLegible(datos.configuracion.objetivoPeso.rangoKg.maximo)}`
            : ""}
        </Text>
      )}
    </Tendencia>
  )
}

function Cintura({ datos }: { datos: Datos }): React.JSX.Element {
  const medidas = datos.medidas.medidas.filter((m) => m.cinturaCm !== null)
  if (medidas.length === 0)
    return <Tendencia grande="—" unidad="cm" subtitulo="Sin medidas" cambio={null} />
  const puntos = medidas.map((m) => ({ fecha: m.fecha, valor: m.cinturaCm! }))
  const ultima = puntos[puntos.length - 1]!
  const primera = puntos[0]!
  return (
    <Tendencia
      grande={decimal(ultima.valor).replace(",0", "")}
      unidad="cm"
      subtitulo="Última medida"
      cambio={
        puntos.length > 1
          ? `${diferencia(ultima.valor - primera.valor, "cm")} desde el inicio`
          : null
      }
    >
      {puntos.length > 1 && (
        <Grafica
          animar
          puntos={puntos}
          tendencia={puntos}
          descripcion={`Cintura por medida. Primera: ${decimal(primera.valor)} cm. Última: ${decimal(ultima.valor)} cm.`}
          izquierda={fechaCorta(primera.fecha)}
          derecha={`${fechaCorta(ultima.fecha)}, ${decimal(ultima.valor)} cm`}
        />
      )}
    </Tendencia>
  )
}

function Fuerza({ ejercicios }: { ejercicios: ProgresionFuerza["ejercicios"] }): React.JSX.Element {
  if (ejercicios.length === 0) return <Text style={s.vacio}>Aún sin sesiones con carga.</Text>
  return (
    <View style={s.grupo}>
      {ejercicios.map((ejercicio) => {
        const primero = ejercicio.puntos[0]!
        const ultimo = ejercicio.puntos[ejercicio.puntos.length - 1]!
        const cambio = ultimo.pesoKg - primero.pesoKg
        return (
          <View key={ejercicio.ejercicioId} style={s.destacada}>
            <Text style={s.nombreEjercicio}>{ejercicio.nombre}</Text>
            <Text style={s.tenue}>
              Mejor serie: {decimal(ultimo.pesoKg).replace(",0", "")} kg × {ultimo.repeticiones}
              {cambio !== 0 && (
                <Text style={cambio > 0 ? s.sube : s.baja}> · {diferencia(cambio, "kg")}</Text>
              )}
            </Text>
            {ejercicio.puntos.length > 1 && (
              <Grafica
                puntos={ejercicio.puntos.map((p) => ({ fecha: p.fecha, valor: p.estimado }))}
                tendencia={ejercicio.puntos.map((p) => ({ fecha: p.fecha, valor: p.estimado }))}
                descripcion={`${ejercicio.nombre}: de ${primero.pesoKg} kg × ${primero.repeticiones} a ${ultimo.pesoKg} kg × ${ultimo.repeticiones}.`}
                izquierda={fechaCorta(primero.fecha)}
                derecha={fechaCorta(ultimo.fecha)}
              />
            )}
          </View>
        )
      })}
    </View>
  )
}

function Pruebas({
  pruebas,
  anadir,
  pautadas,
  puedeAnadir,
}: {
  pruebas: ListadoPruebas["pruebas"]
  anadir: () => void
  pautadas: ConfiguracionSeguimiento["pruebasPrescritas"]
  puedeAnadir: boolean
}): React.JSX.Element {
  const ordenadas = [...pruebas].sort(
    (a, b) => a.fecha.localeCompare(b.fecha) || a.creadoEn.localeCompare(b.creadoEn),
  )
  const porNombre = new Map<string, ListadoPruebas["pruebas"]>()
  for (const prueba of ordenadas) {
    const clave = `${prueba.pruebaId ?? prueba.nombre}:${prueba.unidad}`
    porNombre.set(clave, [...(porNombre.get(clave) ?? []), prueba])
  }
  return (
    <View style={s.grupo}>
      {pautadas.length > 0 && (
        <View style={s.grupo}>
          <Titulo>Pruebas pautadas</Titulo>
          <Tarjeta>
            {pautadas.map((p, n) => {
              const ultima = ordenadas
                .filter((resultado) => resultado.pruebaId === p.id && resultado.unidad === p.unidad)
                .at(-1)
              return (
                <Fila key={p.id} primera={n === 0}>
                  <Text style={[s.texto, s.textos]}>
                    {p.nombre} · {p.unidad}
                  </Text>
                  <Text style={s.valor}>
                    {ultima ? `${String(ultima.valor).replace(".", ",")} ${p.unidad}` : "Pendiente"}
                  </Text>
                </Fila>
              )
            })}
          </Tarjeta>
        </View>
      )}
      <View style={s.cabecera}>
        <Titulo>Historial de pruebas</Titulo>
        {puedeAnadir && <Enlace texto="Añadir prueba" onPress={anadir} />}
      </View>
      {porNombre.size === 0 ? (
        <Text style={s.vacio}>Aún no hay resultados de pruebas físicas.</Text>
      ) : (
        <Tarjeta>
          {[...porNombre.entries()].map(([clave, filas], n) => {
            const ultima = filas[filas.length - 1]!
            const primera = filas[0]!
            const cambio = ultima.valor - primera.valor
            return (
              <Fila key={clave} primera={n === 0}>
                <View style={s.textos}>
                  <Text style={s.fuerte}>{ultima.nombre}</Text>
                  <Text style={s.tenue}>{fechaCorta(ultima.fecha)}</Text>
                </View>
                <Text style={s.valor}>
                  {String(ultima.valor).replace(".", ",")} {ultima.unidad}
                  {filas.length > 1 && cambio !== 0 && (
                    <Text style={cambio > 0 ? s.sube : s.baja}>
                      {"  "}
                      {cambio > 0 ? "+" : "−"}
                      {String(Math.abs(cambio)).replace(".", ",")}
                    </Text>
                  )}
                </Text>
              </Fila>
            )
          })}
        </Tarjeta>
      )}
    </View>
  )
}

function Semana({ datos, lunes }: { datos: Datos; lunes: string }): React.JSX.Element {
  const resumen = resumenDeSemana(datos.dias, lunes)
  const cintura = [...datos.medidas.medidas]
    .reverse()
    .find((m) => m.cinturaCm !== null && m.fecha <= sumarDias(lunes, 6))
  const objetivo = datos.plan?.bloque?.pasosDiarios
  const filas: Array<[string, string]> = [
    ["Cintura", cintura ? `${decimal(cintura.cinturaCm!).replace(",0", "")} cm` : "—"],
    [
      "Pasos",
      resumen.pasos === null
        ? "—"
        : `${miles(resumen.pasos)}${objetivo ? ` / ${miles(objetivo)}` : ""}`,
    ],
    ["Sueño", resumen.suenoMin === null ? "—" : suenoLegible(resumen.suenoMin)],
  ]
  return (
    <View style={s.grupo}>
      <Titulo>Semana</Titulo>
      <Tarjeta>
        {filas.map(([nombre, valor], n) => (
          <Fila key={nombre} primera={n === 0}>
            <Text style={[s.texto, s.textos]}>{nombre}</Text>
            <Text style={s.valor}>{valor}</Text>
          </Fila>
        ))}
      </Tarjeta>
    </View>
  )
}

/** Punto de partida: la primera toma, sin combinar valores de tomas distintas. */
function Inicio({
  datos,
  hoy,
  anadir,
}: {
  datos: Datos
  hoy: string
  anadir: () => void
}): React.JSX.Element {
  const inicio = puntoDePartida(datos.medidas.medidas)
  const nacimiento = datos.medidas.fechaNacimiento
  // Un dato de otra fecha lleva la suya: no se presenta como parte de la primera toma.
  const nota = (dato: ValorDeToma, prefijo: string): string | null =>
    dato.fecha === inicio?.toma.fecha ? null : `${prefijo} ${fechaCorta(dato.fecha)}`
  const filas: Array<{ nombre: string; valor: string; nota: string | null }> = []
  if (inicio?.peso)
    filas.push({
      nombre: "Peso",
      valor: pesoLegible(inicio.peso.valor),
      nota: nota(inicio.peso, "Medida del"),
    })
  if (inicio?.grasa)
    filas.push({
      nombre: "Grasa corporal",
      valor: `${decimal(inicio.grasa.valor)} %`,
      nota: nota(inicio.grasa, "Medida del"),
    })
  if (inicio?.masaLibre)
    filas.push({
      nombre: "Masa libre de grasa",
      valor: pesoLegible(inicio.masaLibre.valor),
      nota: nota(inicio.masaLibre, "Medida del"),
    })
  const altura = inicio?.altura ?? null
  if (altura !== null || nacimiento !== null)
    filas.push({
      nombre: "Altura y edad",
      valor: [
        altura !== null ? `${altura.valor} cm` : null,
        // La edad que tenía en la primera toma.
        nacimiento !== null ? `${edadEn(nacimiento, inicio?.toma.fecha ?? hoy)} años` : null,
      ]
        .filter(Boolean)
        .join(" · "),
      nota: altura !== null ? nota(altura, "Altura del") : null,
    })
  return (
    <View style={s.grupo}>
      <View style={s.cabecera}>
        <Titulo>{inicio ? `Inicio · ${fechaCorta(inicio.toma.fecha)}` : "Inicio"}</Titulo>
        <Enlace texto="Añadir medida" onPress={anadir} />
      </View>
      {filas.length === 0 ? (
        <Text style={s.vacio}>Añade tus primeras medidas: serán tu punto de partida.</Text>
      ) : (
        <Tarjeta>
          {filas.map(({ nombre, valor, nota }, n) => (
            <Fila key={nombre} primera={n === 0}>
              <View style={s.textos}>
                <Text style={s.texto}>{nombre}</Text>
                {nota !== null && <Text style={s.tenue}>{nota}</Text>}
              </View>
              <Text style={s.valor}>{valor}</Text>
            </Fila>
          ))}
        </Tarjeta>
      )}
    </View>
  )
}

const s = StyleSheet.create({
  contenido: { gap: espacio[28] },
  grupo: { gap: espacio[12] },
  cabecera: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  tenue: { ...tipo.secundario },
  vacio: { ...tipo.cuerpo, color: tema.textoTenue },
  destacada: {
    backgroundColor: tema.superficie,
    borderRadius: radio.tarjeta,
    padding: espacio[16],
    gap: espacio[8],
  },
  grande: {
    color: tema.acento,
    fontFamily: tema.fuenteTitulo,
    fontSize: 56,
    lineHeight: 60,
    fontVariant: ["tabular-nums"],
  },
  unidad: { fontSize: 22, lineHeight: 26 },
  sube: { color: tema.acento, fontFamily: tema.fuenteBoton },
  baja: { color: tema.exito, backgroundColor: tema.exitoSuave, fontFamily: tema.fuenteBoton },
  error: { color: tema.error, fontFamily: tema.fuenteBoton },
  nombreEjercicio: { color: tema.texto, fontFamily: tema.fuenteBoton, fontSize: 17 },
  textos: { flex: 1 },
  texto: { color: tema.texto, fontFamily: tema.fuenteTexto, fontSize: 15 },
  fuerte: { color: tema.texto, fontFamily: tema.fuenteBoton, fontSize: 15 },
  valor: { color: tema.textoSecundario, fontFamily: tema.fuenteTexto, fontSize: 15 },
})
