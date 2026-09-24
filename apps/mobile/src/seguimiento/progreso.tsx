import { useCallback, useState } from "react"
import { useFocusEffect } from "expo-router"
import { StyleSheet, Text, View } from "react-native"
import type {
  ListadoDias,
  ListadoMedidas,
  ListadoPruebas,
  ListadoSesiones,
  PlanVigente,
  ProgresionFuerza,
} from "@alpha-omega/shared"

import { AvisoDeError, BotonSecundario } from "../componentes/formulario"
import type { ApiEntrenamiento } from "../entrenamiento/api"
import { hoyAgenda, lunesDeSemana, sumarDias } from "../entrenamiento/fechas"
import { fechaCorta, semanaDelBloque } from "../entrenamiento/plan/modelo"
import { Fila, Pestanas, Tarjeta, Titulo } from "../entrenamiento/plan/piezas"
import { Enlace } from "../entrenamiento/sesion/controles"
import { tema } from "../tema"
import type { ApiSeguimiento } from "./api"
import { AnadirMedida, AnadirPrueba } from "./formularios"
import { Grafica } from "./grafica"
import {
  edadEn,
  masaLibre,
  mediaMovil,
  miles,
  pesoLegible,
  resumenDeSemana,
  suenoLegible,
} from "./modelo"

type Pestana = "peso" | "cintura" | "fuerza" | "pruebas"
const PESTANAS = [
  { valor: "peso", texto: "Peso" },
  { valor: "cintura", texto: "Cintura" },
  { valor: "fuerza", texto: "Fuerza" },
  { valor: "pruebas", texto: "Pruebas físicas" },
] as const

type Datos = {
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
}: {
  clienteId: string
  seguimiento: ApiSeguimiento
  entrenamiento: ApiEntrenamiento
}): React.JSX.Element {
  const [pestana, setPestana] = useState<Pestana>("peso")
  const [datos, setDatos] = useState<Datos | null>(null)
  const [error, setError] = useState("")
  const [intento, setIntento] = useState(0)
  const [formulario, setFormulario] = useState<"medida" | "prueba" | null>(null)
  const hoy = hoyAgenda()
  const lunes = lunesDeSemana(hoy)

  useFocusEffect(
    useCallback(() => {
      let vigente = true
      setError("")
      Promise.all([
        seguimiento.dias(clienteId, sumarDias(hoy, -55), hoy),
        seguimiento.medidas(clienteId),
        seguimiento.pruebas(clienteId),
        seguimiento.fuerza(clienteId),
        entrenamiento.plan(clienteId, lunes),
        entrenamiento.semana(clienteId, lunes),
      ])
        .then(([dias, medidas, pruebas, fuerza, { plan }, semana]) => {
          if (vigente)
            setDatos({
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

  return (
    <View style={s.contenido}>
      <Pestanas opciones={PESTANAS} activa={pestana} cambiar={setPestana} />
      {error !== "" && (
        <View style={s.grupo}>
          <AvisoDeError mensaje={error} />
          <BotonSecundario texto="Reintentar" onPress={recargar} />
        </View>
      )}
      {datos === null ? (
        error === "" && <Text style={s.tenue}>Cargando tu progreso…</Text>
      ) : (
        <>
          {pestana === "peso" && <Peso datos={datos} hoy={hoy} />}
          {pestana === "cintura" && <Cintura datos={datos} />}
          {pestana === "fuerza" && <Fuerza ejercicios={datos.fuerza} />}
          {pestana === "pruebas" && (
            <Pruebas pruebas={datos.pruebas} anadir={() => setFormulario("prueba")} />
          )}
          {(pestana === "peso" || pestana === "cintura") && (
            <>
              <Semana datos={datos} lunes={lunes} />
              <Inicio datos={datos} hoy={hoy} anadir={() => setFormulario("medida")} />
            </>
          )}
        </>
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
        cerrar={() => setFormulario(null)}
        registrar={async (prueba) => {
          await seguimiento.registrarPrueba(clienteId, prueba)
          recargar()
        }}
      />
    </View>
  )
}

function Tendencia({
  grande,
  subtitulo,
  cambio,
  children,
}: {
  grande: string
  subtitulo: string
  cambio: string | null
  children?: React.ReactNode
}): React.JSX.Element {
  return (
    <View style={s.destacada}>
      <Text style={s.grande}>{grande}</Text>
      <Text style={s.tenue}>
        {subtitulo}
        {cambio && (
          <Text style={cambio.startsWith("−") ? s.baja : s.sube}>
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
    return (
      <Text style={s.vacio}>
        Apunta tu peso en ayunas desde «Hoy», en el Inicio: aquí verás la media de la semana y cómo
        evoluciona.
      </Text>
    )
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
      grande={pesoLegible(actual.valor)}
      subtitulo="Media semanal"
      cambio={
        actual.valor === inicio
          ? null
          : `${diferencia(actual.valor - inicio, "kg")} respecto al inicio`
      }
    >
      <Grafica
        puntos={puntos}
        tendencia={tendencia.filter((p) => p.fecha >= desde)}
        descripcion={`Peso en ayunas por día. Media de la semana: ${pesoLegible(actual.valor)}. Último: ${pesoLegible(ultimo.pesoKg!)}.`}
        izquierda={fechaCorta(desde)}
        derecha={`${ultimo.fecha === hoy ? "Hoy" : fechaCorta(ultimo.fecha)}, ${pesoLegible(ultimo.pesoKg!)}`}
      />
    </Tendencia>
  )
}

function Cintura({ datos }: { datos: Datos }): React.JSX.Element {
  const medidas = datos.medidas.medidas.filter((m) => m.cinturaCm !== null)
  if (medidas.length === 0)
    return <Text style={s.vacio}>Aún no hay medidas de cintura. Añade una abajo, en «Inicio».</Text>
  const puntos = medidas.map((m) => ({ fecha: m.fecha, valor: m.cinturaCm! }))
  const ultima = puntos[puntos.length - 1]!
  const primera = puntos[0]!
  return (
    <Tendencia
      grande={`${decimal(ultima.valor).replace(",0", "")} cm`}
      subtitulo="Última medida"
      cambio={
        puntos.length > 1
          ? `${diferencia(ultima.valor - primera.valor, "cm")} respecto al inicio`
          : null
      }
    >
      {puntos.length > 1 && (
        <Grafica
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
  if (ejercicios.length === 0)
    return (
      <Text style={s.vacio}>
        Cuando envíes sesiones con carga, aquí verás cómo sube tu mejor serie de cada ejercicio.
      </Text>
    )
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
}: {
  pruebas: ListadoPruebas["pruebas"]
  anadir: () => void
}): React.JSX.Element {
  const porNombre = new Map<string, ListadoPruebas["pruebas"]>()
  for (const prueba of pruebas)
    porNombre.set(prueba.nombre, [...(porNombre.get(prueba.nombre) ?? []), prueba])
  return (
    <View style={s.grupo}>
      <View style={s.cabecera}>
        <Titulo>Tus pruebas</Titulo>
        <Enlace texto="Añadir prueba" onPress={anadir} />
      </View>
      {porNombre.size === 0 ? (
        <Text style={s.vacio}>Aún no hay pruebas físicas. Añade la primera con tu entrenador.</Text>
      ) : (
        <Tarjeta>
          {[...porNombre.entries()].map(([nombre, filas], n) => {
            const ultima = filas[filas.length - 1]!
            const primera = filas[0]!
            const cambio = ultima.valor - primera.valor
            return (
              <Fila key={nombre} primera={n === 0}>
                <View style={s.textos}>
                  <Text style={s.fuerte}>{nombre}</Text>
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
  const hechas = datos.semana.sesiones.filter((s_) => s_.enviadoEn !== null).length
  const titulo = datos.plan ? `Semana ${semanaDelBloque(datos.plan, lunes)}` : "Esta semana"
  const filas: Array<[string, string]> = [
    ["Cintura", cintura ? `${decimal(cintura.cinturaCm!).replace(",0", "")} cm` : "—"],
    [
      "Pasos",
      resumen.pasos === null
        ? "—"
        : `${miles(resumen.pasos)}${objetivo ? ` / ${miles(objetivo)}` : ""}`,
    ],
    ["Sueño", resumen.suenoMin === null ? "—" : suenoLegible(resumen.suenoMin)],
    ["Entrenos", `${hechas} fuerza`],
  ]
  return (
    <View style={s.grupo}>
      <Titulo>{titulo}</Titulo>
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

function Inicio({
  datos,
  hoy,
  anadir,
}: {
  datos: Datos
  hoy: string
  anadir: () => void
}): React.JSX.Element {
  const medidas = datos.medidas.medidas
  const primera = medidas[0]
  const buscar = <K extends "pesoKg" | "grasaPct" | "alturaCm">(clave: K) =>
    medidas.find((m) => m[clave] !== null)?.[clave] ?? null
  const peso = buscar("pesoKg")
  const grasa = buscar("grasaPct")
  const altura = buscar("alturaCm")
  const nacimiento = datos.medidas.fechaNacimiento
  const filas: Array<[string, string]> = []
  if (peso !== null) filas.push(["Peso", pesoLegible(peso)])
  if (grasa !== null) filas.push(["Grasa corporal", `${decimal(grasa)} %`])
  if (peso !== null && grasa !== null)
    filas.push(["Masa libre de grasa", pesoLegible(masaLibre(peso, grasa))])
  if (altura !== null || nacimiento !== null)
    filas.push([
      "Altura y edad",
      [
        altura !== null ? `${altura} cm` : null,
        nacimiento !== null ? `${edadEn(nacimiento, primera?.fecha ?? hoy)} años` : null,
      ]
        .filter(Boolean)
        .join(" · "),
    ])
  return (
    <View style={s.grupo}>
      <View style={s.cabecera}>
        <Titulo>{primera ? `Inicio · ${fechaCorta(primera.fecha)}` : "Inicio"}</Titulo>
        <Enlace texto="Añadir medida" onPress={anadir} />
      </View>
      {filas.length === 0 ? (
        <Text style={s.vacio}>Añade tus primeras medidas: serán tu punto de partida.</Text>
      ) : (
        <Tarjeta>
          {filas.map(([nombre, valor], n) => (
            <Fila key={nombre} primera={n === 0}>
              <Text style={[s.texto, s.textos]}>{nombre}</Text>
              <Text style={s.valor}>{valor}</Text>
            </Fila>
          ))}
        </Tarjeta>
      )}
    </View>
  )
}

const s = StyleSheet.create({
  contenido: { gap: 28 },
  grupo: { gap: 14 },
  cabecera: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  tenue: { color: tema.textoTenue, fontFamily: tema.fuenteTexto, fontSize: 14 },
  vacio: { color: tema.textoTenue, fontFamily: tema.fuenteTexto, fontSize: 15, lineHeight: 22 },
  destacada: { backgroundColor: tema.superficie, borderRadius: 20, padding: 18, gap: 6 },
  grande: {
    color: tema.acento,
    fontFamily: tema.fuenteTitulo,
    fontSize: 44,
    lineHeight: 50,
  },
  sube: { color: tema.acento, fontFamily: tema.fuenteBoton },
  baja: { color: tema.exito, fontFamily: tema.fuenteBoton },
  nombreEjercicio: { color: tema.texto, fontFamily: tema.fuenteBoton, fontSize: 17 },
  textos: { flex: 1 },
  texto: { color: tema.texto, fontFamily: tema.fuenteTexto, fontSize: 15 },
  fuerte: { color: tema.texto, fontFamily: tema.fuenteBoton, fontSize: 15 },
  valor: { color: tema.textoSecundario, fontFamily: tema.fuenteTexto, fontSize: 15 },
})
