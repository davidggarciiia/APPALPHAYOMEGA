import { useState } from "react"
import { Pressable, StyleSheet, Text, View } from "react-native"

import { Icono } from "../../componentes/iconos"
import { tema } from "../../tema"
import type { SerieConDistancia } from "../registro-modelo"
import { objetivoDeSerie } from "../sesion/modelo"
import { Fila, Tarjeta, Titulo } from "./piezas"

const RIR = [
  { valor: "5 o más", texto: "Fácil: sube la próxima vez", destacado: false },
  { valor: "3", texto: "Principales", destacado: true },
  { valor: "2", texto: "Accesorios", destacado: true },
  { valor: "1", texto: "Duro: no subas", destacado: true },
  { valor: "0", texto: "Fallo: evítalo", destacado: true },
]

const SEMAFORO = [
  { color: tema.exito, titulo: "Verde · sigue", texto: "Esfuerzo normal, sin dolor" },
  { color: tema.aviso, titulo: "Ámbar · para y avisa", texto: "Va a más: regístrala y avisa" },
  {
    color: tema.error,
    titulo: "Rojo · termina y avisa",
    texto: "Dolor agudo, mareo o falta de aire",
  },
]

/**
 * Una serie de ejemplo por unidad, leída con el formato de la sesión: «8–10»,
 * «30 s» y «20 m». Una unidad nueva sin ejemplo no compila.
 */
const EJEMPLOS = {
  repeticiones: {
    id: "",
    tipoMedicion: "repeticiones",
    pesoKg: null,
    repeticiones: 8,
    repeticionesMax: 10,
  },
  tiempo: { id: "", tipoMedicion: "tiempo", pesoKg: null, segundos: 30 },
  distancia: { id: "", tipoMedicion: "distancia", pesoKg: null, metros: 20 },
} satisfies {
  [U in SerieConDistancia["tipoMedicion"]]: Extract<SerieConDistancia, { tipoMedicion: U }>
}

const ejemplo = (unidad: keyof typeof EJEMPLOS): string => `«${objetivoDeSerie(EJEMPLOS[unidad])}»`

/** Contenido fijo de la app: la guía no depende del plan. */
export const TEMAS_DE_LA_GUIA = [
  {
    titulo: "Esfuerzo global (RPE)",
    texto:
      "Al terminar te preguntamos cuánto te ha costado la sesión, de 0 a 10. 0 es reposo; 5, un esfuerzo moderado; 7–8, duro pero con buena técnica; 10, lo máximo que podrías dar. Responde por la sesión entera, no por la última serie.",
  },
  {
    titulo: "Cómo se ajusta tu sesión",
    texto:
      "Tu entrenador revisa lo que registras: series, repeticiones, RIR, molestias y cómo terminas. Con eso decide si sube la carga, la mantiene o baja el volumen. Si llegas cansado o con molestias, dilo en el check-in: se recortan series de accesorios y los ejercicios principales se mantienen.",
  },
  {
    titulo: "Cómo se mide cada serie",
    texto: `Cada serie indica su unidad junto al objetivo: ${ejemplo("repeticiones")} son repeticiones, ${ejemplo("tiempo")} son segundos y ${ejemplo("distancia")} son metros, por ejemplo al transportar un peso. Registra lo que hayas hecho en esa misma unidad y, si el ejercicio lleva carga, también los kilos.`,
  },
  {
    titulo: "Cómo subir las cargas",
    texto:
      "Trabajas con doble progresión: primero sumas repeticiones con la misma carga hasta completar el máximo del rango en todas las series con el RIR indicado. Entonces sube la carga lo mínimo posible y vuelve al principio del rango. «La próxima vez», al cerrar la sesión, te dice cuándo toca.",
  },
  {
    titulo: "Técnica y respiración",
    texto:
      "Antes que el peso, la técnica. Coge aire antes de bajar, mantén el abdomen firme y suéltalo al subir. Baja controlando, sin rebotes. Si pierdes la postura, para ahí: esa serie ya cuenta. Cada ejercicio tiene «Ver técnica» con los pasos y la animación.",
  },
  {
    titulo: "Qué contar a tu entrenador",
    texto:
      "Cualquier molestia, aunque sea leve o se pase. Si has dormido mal, estás enfermo o has tenido un día muy cargado. Si cambias un ejercicio porque la máquina está ocupada. Y lo que te quite tiempo o energía: trabajo, viajes u otros deportes.",
  },
  {
    titulo: "Semana de calibración",
    texto:
      "Las primeras sesiones de un bloque sirven para encontrar tus cargas. Empieza con el peso orientativo y ajústalo para terminar cada serie con el RIR indicado. Donde pone «Calibrar», busca el peso con el que llegas al rango con técnica limpia: será tu referencia.",
  },
  {
    titulo: "Qué llevar",
    texto:
      "Ropa cómoda y calzado estable, de suela plana para los días de pierna. Agua, una toalla y el móvil con la app para registrar. Si tu entrenador te lo ha indicado: gomas, cinturón o straps.",
  },
]

/** Pestaña «Guía»: la escala de RIR, el semáforo de molestias y los temas. */
export function Guia(): React.JSX.Element {
  const [abierto, setAbierto] = useState<string | null>(null)
  return (
    <View style={s.contenido}>
      <View style={s.grupo}>
        <Titulo>Cuántas te dejas (RIR)</Titulo>
        <Tarjeta>
          {RIR.map((fila, n) => (
            <Fila key={fila.valor} primera={n === 0}>
              <Text style={[s.valor, fila.destacado && s.valorDorado]}>{fila.valor}</Text>
              <Text style={s.texto}>{fila.texto}</Text>
            </Fila>
          ))}
        </Tarjeta>
      </View>
      <View style={s.grupo}>
        <Titulo>Molestias</Titulo>
        <Tarjeta>
          {SEMAFORO.map((fila, n) => (
            <Fila key={fila.titulo} primera={n === 0}>
              <View style={[s.punto, { backgroundColor: fila.color }]} />
              <View style={s.textos}>
                <Text style={s.fuerte}>{fila.titulo}</Text>
                <Text style={s.tenue}>{fila.texto}</Text>
              </View>
            </Fila>
          ))}
        </Tarjeta>
      </View>
      <View style={s.grupo}>
        <Titulo>Más</Titulo>
        <Tarjeta>
          {TEMAS_DE_LA_GUIA.map((tema_, n) => {
            const visible = abierto === tema_.titulo
            return (
              <View key={tema_.titulo} style={n > 0 && s.separado}>
                <Pressable
                  style={s.tema}
                  accessibilityRole="button"
                  accessibilityState={{ expanded: visible }}
                  onPress={() => setAbierto(visible ? null : tema_.titulo)}
                >
                  <Text style={[s.fuerte, s.textos]}>{tema_.titulo}</Text>
                  <View style={visible && s.girado} aria-hidden>
                    <Icono nombre="adelante" color={tema.textoTenue} tamano={18} />
                  </View>
                </Pressable>
                {visible && <Text style={s.explicacion}>{tema_.texto}</Text>}
              </View>
            )
          })}
        </Tarjeta>
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  contenido: { gap: 28 },
  grupo: { gap: 14 },
  valor: { width: 64, color: tema.texto, fontFamily: tema.fuenteBoton, fontSize: 15 },
  valorDorado: { color: tema.acento },
  texto: { flex: 1, color: tema.textoSecundario, fontFamily: tema.fuenteTexto, fontSize: 15 },
  punto: { width: 8, height: 8, borderRadius: 2, marginTop: 7 },
  textos: { flex: 1, gap: 2 },
  fuerte: { color: tema.texto, fontFamily: tema.fuenteBoton, fontSize: 15 },
  tenue: { color: tema.textoTenue, fontFamily: tema.fuenteTexto, fontSize: 14 },
  separado: { borderTopWidth: 1, borderTopColor: tema.borde },
  tema: { minHeight: 52, flexDirection: "row", alignItems: "center", gap: 12 },
  girado: { transform: [{ rotate: "90deg" }] },
  explicacion: {
    color: tema.textoSecundario,
    fontFamily: tema.fuenteTexto,
    fontSize: 14,
    lineHeight: 21,
    paddingBottom: 16,
  },
})
