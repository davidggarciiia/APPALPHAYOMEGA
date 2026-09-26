import { useState, type ReactNode } from "react"
import { StyleSheet, Text, TextInput, View } from "react-native"
import Svg, { Path } from "react-native-svg"
import type { Ejercicio } from "@alpha-omega/shared"

import { CampoDeTexto, EnlaceOro, Pastilla, texto } from "../componentes/diseno"
import { Pulsable } from "../componentes/pulsable"
import { fuentes, tema } from "../tema"

import {
  DIAS_DE_LA_SEMANA,
  anadirEjercicio,
  anadirSerie,
  cambiarIndicaciones,
  cambiarMedicion,
  cambiarSerie,
  ejercicioNuevo,
  moverEjercicio,
  quitarEjercicio,
  quitarSerie,
  type EjercicioEnEdicion,
  type NuevoId,
  type SesionEnEdicion,
} from "./plan-en-edicion"
import { SelectorDeEjercicios } from "./selector-ejercicios"

const LETRAS = ["L", "M", "X", "J", "V", "S", "D"] as const

const ICONOS = {
  subir: "M6 15l6-6 6 6",
  bajar: "M6 9l6 6 6-6",
  quitar: "M6 6l12 12M18 6L6 18",
} as const

function BotonIcono({
  icono,
  etiqueta,
  onPress,
  desactivado = false,
}: {
  icono: keyof typeof ICONOS
  etiqueta: string
  onPress: () => void
  desactivado?: boolean
}): React.JSX.Element {
  return (
    <Pulsable
      onPress={onPress}
      disabled={desactivado}
      style={[estilos.icono, desactivado && estilos.apagado]}
      accessibilityRole="button"
      accessibilityLabel={etiqueta}
      accessibilityState={{ disabled: desactivado }}
    >
      <View>
        <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
          <Path
            d={ICONOS[icono]}
            stroke={icono === "quitar" ? tema.error : tema.texto}
            strokeWidth={2.2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      </View>
    </Pulsable>
  )
}

/**
 * Una sesión en edición: nombre, día (si procede), y sus ejercicios con las
 * series. Lo usan el editor de planes, el de rutinas y el ajuste de una sesión
 * ya asignada (este último sin día: la fecha se cambia con «Cambiar día»).
 *
 * `crearEjercicio` es el hueco para dar de alta un ejercicio sin salir de aquí.
 */
export function EditorDeSesion({
  sesion,
  alCambiar,
  nuevoId,
  conDia = true,
  crearEjercicio,
}: {
  sesion: SesionEnEdicion
  alCambiar: (sesion: SesionEnEdicion) => void
  nuevoId: NuevoId
  conDia?: boolean
  crearEjercicio?: (busqueda: string, alCrear: (ejercicio: Ejercicio) => void) => ReactNode
}): React.JSX.Element {
  const [buscando, setBuscando] = useState(false)

  const elegir = (ejercicio: Ejercicio): void => {
    alCambiar(anadirEjercicio(sesion, ejercicioNuevo(nuevoId, ejercicio)))
    setBuscando(false)
  }

  return (
    <View style={estilos.sesion}>
      <CampoDeTexto
        etiqueta="Nombre de la sesión"
        value={sesion.nombre}
        onChangeText={(nombre) => alCambiar({ ...sesion, nombre })}
        placeholder="Torso, Pierna, Full body…"
        maxLength={120}
      />

      {conDia && (
        <View style={estilos.bloque}>
          <Text style={estilos.etiqueta}>Día de la semana</Text>
          <View style={estilos.dias} accessibilityRole="radiogroup">
            {LETRAS.map((letra, indice) => (
              <Pastilla
                key={letra}
                texto={letra}
                elegida={sesion.diaSemana === indice + 1}
                onPress={() => alCambiar({ ...sesion, diaSemana: indice + 1 })}
                accessibilityLabel={DIAS_DE_LA_SEMANA[indice]}
                compacta
              />
            ))}
          </View>
        </View>
      )}

      {sesion.ejercicios.map((ejercicio, indice) => (
        <EditorDeEjercicio
          key={ejercicio.id}
          ejercicio={ejercicio}
          posicion={indice}
          total={sesion.ejercicios.length}
          sesion={sesion}
          alCambiar={alCambiar}
          nuevoId={nuevoId}
        />
      ))}

      {buscando ? (
        <SelectorDeEjercicios
          alElegir={elegir}
          alCerrar={() => setBuscando(false)}
          crear={
            crearEjercicio === undefined
              ? undefined
              : (busqueda) => crearEjercicio(busqueda, elegir)
          }
        />
      ) : (
        <EnlaceOro texto="+ Añadir ejercicio" onPress={() => setBuscando(true)} />
      )}
    </View>
  )
}

function EditorDeEjercicio({
  ejercicio,
  posicion,
  total,
  sesion,
  alCambiar,
  nuevoId,
}: {
  ejercicio: EjercicioEnEdicion
  posicion: number
  total: number
  sesion: SesionEnEdicion
  alCambiar: (sesion: SesionEnEdicion) => void
  nuevoId: NuevoId
}): React.JSX.Element {
  const porTiempo = ejercicio.series[0]?.tipoMedicion === "tiempo"

  return (
    <View style={estilos.ejercicio}>
      <View style={estilos.cabecera}>
        <Text style={estilos.orden}>{String(posicion + 1)}</Text>
        <Text style={[texto.fuerte, estilos.flexible]}>{ejercicio.nombre}</Text>
        <BotonIcono
          icono="subir"
          etiqueta={`Subir ${ejercicio.nombre}`}
          desactivado={posicion === 0}
          onPress={() => alCambiar(moverEjercicio(sesion, ejercicio.id, -1))}
        />
        <BotonIcono
          icono="bajar"
          etiqueta={`Bajar ${ejercicio.nombre}`}
          desactivado={posicion === total - 1}
          onPress={() => alCambiar(moverEjercicio(sesion, ejercicio.id, 1))}
        />
        <BotonIcono
          icono="quitar"
          etiqueta={`Quitar ${ejercicio.nombre}`}
          onPress={() => alCambiar(quitarEjercicio(sesion, ejercicio.id))}
        />
      </View>

      <View style={estilos.dias} accessibilityRole="radiogroup">
        <Pastilla
          texto="Repeticiones"
          elegida={!porTiempo}
          onPress={() => alCambiar(cambiarMedicion(sesion, ejercicio.id, "repeticiones"))}
        />
        <Pastilla
          texto="Tiempo"
          elegida={porTiempo}
          onPress={() => alCambiar(cambiarMedicion(sesion, ejercicio.id, "tiempo"))}
        />
      </View>

      <View
        style={estilos.fila}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <Text style={[estilos.numero, estilos.encabezado]}>Serie</Text>
        <Text style={[estilos.columna, estilos.encabezado]}>Kg (opcional)</Text>
        <Text style={[estilos.columna, estilos.encabezado]}>{porTiempo ? "Segundos" : "Reps"}</Text>
        <View style={estilos.hueco} />
      </View>
      {ejercicio.series.map((serie, indice) => {
        const numero = String(indice + 1)
        return (
          <View key={serie.id} style={estilos.fila}>
            <Text style={estilos.numero}>{numero}</Text>
            <TextInput
              style={estilos.campo}
              value={serie.peso}
              onChangeText={(peso) =>
                alCambiar(cambiarSerie(sesion, ejercicio.id, serie.id, { peso }))
              }
              placeholder="—"
              placeholderTextColor={tema.marcador}
              keyboardType="decimal-pad"
              accessibilityLabel={`${ejercicio.nombre}, serie ${numero}: kilos, opcional`}
            />
            <TextInput
              style={estilos.campo}
              value={serie.valor}
              onChangeText={(valor) =>
                alCambiar(cambiarSerie(sesion, ejercicio.id, serie.id, { valor }))
              }
              keyboardType="number-pad"
              accessibilityLabel={`${ejercicio.nombre}, serie ${numero}: ${
                porTiempo ? "segundos" : "repeticiones"
              }`}
            />
            <BotonIcono
              icono="quitar"
              etiqueta={`Quitar la serie ${numero} de ${ejercicio.nombre}`}
              desactivado={ejercicio.series.length === 1}
              onPress={() => alCambiar(quitarSerie(sesion, ejercicio.id, serie.id))}
            />
          </View>
        )
      })}
      <EnlaceOro
        texto="+ Añadir serie"
        onPress={() => alCambiar(anadirSerie(sesion, ejercicio.id, nuevoId))}
      />
      <CampoDeTexto
        etiqueta="Indicaciones (opcional)"
        value={ejercicio.indicaciones}
        onChangeText={(indicaciones) =>
          alCambiar(cambiarIndicaciones(sesion, ejercicio.id, indicaciones))
        }
        placeholder="Baja controlando, 2 segundos"
        maxLength={2000}
      />
    </View>
  )
}

const estilos = StyleSheet.create({
  sesion: { gap: 18 },
  bloque: { gap: 8 },
  etiqueta: { color: tema.textoTenue, fontFamily: fuentes.media, fontSize: 14 },
  dias: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  ejercicio: {
    gap: 12,
    padding: 14,
    borderRadius: 16,
    backgroundColor: tema.superficieBaja,
    borderWidth: 1,
    borderColor: tema.borde,
  },
  cabecera: { flexDirection: "row", alignItems: "center", gap: 6 },
  orden: { width: 22, color: tema.oro, fontFamily: fuentes.negrita, fontSize: 15 },
  flexible: { flex: 1 },
  icono: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: tema.superficieAlta,
    alignItems: "center",
    justifyContent: "center",
  },
  apagado: { opacity: 0.35 },
  fila: { flexDirection: "row", alignItems: "center", gap: 8 },
  numero: {
    width: 36,
    color: tema.textoTenue,
    fontFamily: fuentes.semi,
    fontSize: 15,
    textAlign: "center",
  },
  encabezado: { fontFamily: fuentes.normal, fontSize: 12, textAlign: "center" },
  columna: { flex: 1, color: tema.textoTenue },
  hueco: { width: 40 },
  campo: {
    flex: 1,
    minWidth: 0,
    width: 0,
    height: 44,
    borderRadius: 10,
    backgroundColor: tema.superficieAlta,
    color: tema.texto,
    fontFamily: fuentes.negrita,
    fontSize: 16,
    textAlign: "center",
    padding: 0,
  },
})
