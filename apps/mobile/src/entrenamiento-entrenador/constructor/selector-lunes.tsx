import { useState } from "react"
import { Pressable, StyleSheet, Text, View } from "react-native"
import { SemanaSchema } from "@alpha-omega/shared"

import { hoyAgenda, lunesDeSemana, sumarDias } from "../../entrenamiento/fechas"
import { alto, tema } from "../../tema"

const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"]
const MESES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
]

/** Cuántos lunes se ofrecen: un trimestre por delante basta para programar un bloque. */
const CUANTOS = 12

/** «lunes 23 de noviembre»; con el año si no es el actual: «lunes 4 de enero de 2027». */
export function fechaLarga(fecha: string, hoy: string = hoyAgenda()): string {
  const [anio, mes, dia] = fecha.split("-").map(Number)
  const semana = DIAS[new Date(`${fecha}T00:00:00Z`).getUTCDay()]
  const texto = `${semana ?? ""} ${String(dia)} de ${MESES[(mes ?? 1) - 1] ?? ""}`
  return anio === Number(hoy.slice(0, 4)) ? texto : `${texto} de ${String(anio)}`
}

/** Los próximos lunes desde hoy (hoy mismo, si es lunes). */
export function proximosLunes(hoy: string = hoyAgenda(), cantidad: number = CUANTOS): string[] {
  const primero = lunesDeSemana(hoy)
  const desde = primero < hoy ? sumarDias(primero, 7) : primero
  return Array.from({ length: cantidad }, (_, n) => sumarDias(desde, n * 7))
}

const esLunes = (fecha: string): boolean => SemanaSchema.safeParse(fecha).success

/**
 * El lunes en que empieza el bloque, a elegir de una lista de fechas legibles.
 * El contrato exige un lunes: con una lista no hace falta escribir ni comprobar nada.
 */
export function SelectorDeLunes({
  valor,
  cambiar,
}: {
  valor: string
  cambiar: (fecha: string) => void
}): React.JSX.Element {
  const [abierto, setAbierto] = useState(false)
  const hoy = hoyAgenda()
  const valido = esLunes(valor)
  const lunes = proximosLunes(hoy)
  // Un lunes ya empezado (un borrador antiguo) sigue a la vista para poder conservarlo.
  const opciones = valido && !lunes.includes(valor) ? [valor, ...lunes] : lunes
  const texto = valido ? fechaLarga(valor, hoy) : "Elige un lunes"
  return (
    <View style={s.caja}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          valido ? `Lunes de inicio: ${texto}` : "Lunes de inicio: elige un lunes"
        }
        accessibilityHint={abierto ? "Cierra la lista de lunes" : "Abre la lista de lunes"}
        accessibilityState={{ expanded: abierto }}
        onPress={() => setAbierto(!abierto)}
        style={s.valor}
      >
        <Text style={[s.texto, !valido && s.pendiente]}>{texto}</Text>
        <Text style={s.cambiar} aria-hidden>
          {abierto ? "Cerrar" : "Cambiar"}
        </Text>
      </Pressable>
      {abierto && (
        <View accessibilityRole="radiogroup" accessibilityLabel="Lunes de inicio" style={s.lista}>
          {opciones.map((fecha) => {
            const elegido = fecha === valor
            return (
              <Pressable
                key={fecha}
                accessibilityRole="radio"
                aria-checked={elegido}
                accessibilityState={{ checked: elegido }}
                accessibilityLabel={fechaLarga(fecha, hoy)}
                onPress={() => {
                  cambiar(fecha)
                  setAbierto(false)
                }}
                style={[s.opcion, elegido && s.opcionElegida]}
              >
                <Text style={[s.textoOpcion, elegido && s.textoElegida]}>
                  {fechaLarga(fecha, hoy)}
                </Text>
              </Pressable>
            )
          })}
        </View>
      )}
    </View>
  )
}

const s = StyleSheet.create({
  caja: { gap: 8 },
  valor: {
    minHeight: alto.campo,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: tema.bordeFuerte,
    backgroundColor: tema.suave,
  },
  texto: { flexShrink: 1, color: tema.texto, fontFamily: tema.fuenteBoton, fontSize: 16 },
  pendiente: { color: tema.aviso },
  cambiar: { color: tema.acento, fontFamily: tema.fuenteSemi, fontSize: 14 },
  lista: { gap: 6 },
  opcion: {
    minHeight: alto.tactil,
    justifyContent: "center",
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: tema.borde,
  },
  opcionElegida: { borderColor: tema.acento, backgroundColor: tema.acentoSuave },
  textoOpcion: { color: tema.texto, fontFamily: tema.fuenteTexto, fontSize: 15 },
  textoElegida: { fontFamily: tema.fuenteBoton, color: tema.acento },
})
