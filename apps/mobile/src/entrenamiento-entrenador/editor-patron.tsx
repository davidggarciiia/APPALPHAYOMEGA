import { useState } from "react"
import { Text, View } from "react-native"
import type { ApiDeCatalogo } from "../catalogo-ejercicios/api"
import { BotonSecundario } from "../componentes/formulario"
import { tema } from "../tema"
import { agregarEjercicio, nuevaSesion, type SesionEditable } from "./editor-modelo"
import { EditorSesion } from "./editor-sesion"
import { SelectorEjercicios } from "./selector-ejercicios"

export function EditorPatron({
  sesiones,
  cambiar,
  catalogo,
}: {
  sesiones: SesionEditable[]
  cambiar: (s: SesionEditable[]) => void
  catalogo: ApiDeCatalogo
}): React.JSX.Element {
  const [indice, setIndice] = useState(0)
  const seleccion = Math.min(indice, sesiones.length - 1)
  const sesion = sesiones[seleccion]!
  const editar = (nueva: SesionEditable): void =>
    cambiar(sesiones.map((s, i) => (i === seleccion ? nueva : s)))
  return (
    <View style={{ gap: 12 }}>
      {sesiones.length > 1 && (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {sesiones.map((s, i) => (
            <BotonSecundario
              key={s.id}
              texto={`${seleccion === i ? "✓ " : ""}Sesión ${i + 1}${s.nombre ? ` · ${s.nombre}` : ""}`}
              onPress={() => setIndice(i)}
            />
          ))}
        </View>
      )}
      <Text style={{ fontFamily: tema.fuenteTexto, color: tema.textoTenue }}>
        Sesión {seleccion + 1} de {sesiones.length}
      </Text>
      <EditorSesion valor={sesion} cambiar={editar} />
      {sesion.ejercicios.length < 40 && (
        <SelectorEjercicios api={catalogo} elegir={(e) => editar(agregarEjercicio(sesion, e))} />
      )}
      {sesiones.length > 1 && (
        <BotonSecundario
          texto="Quitar esta sesión del plan"
          onPress={() => {
            cambiar(sesiones.filter((_, i) => i !== seleccion))
            setIndice(0)
          }}
        />
      )}
      {sesiones.length < 14 && (
        <BotonSecundario
          texto="Añadir otra sesión"
          onPress={() => {
            cambiar([...sesiones, nuevaSesion()])
            setIndice(sesiones.length)
          }}
        />
      )}
    </View>
  )
}
