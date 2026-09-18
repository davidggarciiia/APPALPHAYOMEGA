import { Text, View } from "react-native"
import { BotonSecundario, Campo } from "../componentes/formulario"
import { tema } from "../tema"
import {
  moverEjercicio,
  nuevaSerie,
  type EjercicioEditable,
  type SesionEditable,
} from "./editor-modelo"

export function EditorSesion({
  valor,
  cambiar,
  mostrarDia = true,
}: {
  valor: SesionEditable
  cambiar: (sesion: SesionEditable) => void
  mostrarDia?: boolean
}): React.JSX.Element {
  function ejercicio(id: string, cambios: Partial<EjercicioEditable>): void {
    cambiar({
      ...valor,
      ejercicios: valor.ejercicios.map((e) => (e.id === id ? { ...e, ...cambios } : e)),
    })
  }
  return (
    <View style={{ gap: 12 }}>
      <Campo
        etiqueta="Nombre de sesión"
        value={valor.nombre}
        onChangeText={(nombre) => cambiar({ ...valor, nombre })}
        maxLength={120}
      />
      {mostrarDia && (
        <>
          <Text style={{ color: tema.texto }}>Día de la semana</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map((dia, i) => (
              <BotonSecundario
                key={dia}
                texto={`${valor.diaSemana === i + 1 ? "✓ " : ""}${dia}`}
                onPress={() => cambiar({ ...valor, diaSemana: i + 1 })}
              />
            ))}
          </View>
        </>
      )}
      {valor.ejercicios.map((e, indice) => (
        <View
          key={e.id}
          style={{ borderColor: tema.borde, borderWidth: 1, borderRadius: 14, padding: 12, gap: 8 }}
        >
          <Text style={{ color: tema.texto, fontWeight: "700", fontSize: 18 }}>
            {indice + 1}. {e.nombre}
          </Text>
          <View style={{ flexDirection: "row", gap: 12 }}>
            <BotonSecundario
              texto={`Subir ${e.nombre}`}
              deshabilitado={indice === 0}
              onPress={() => cambiar(moverEjercicio(valor, indice, -1))}
            />
            <BotonSecundario
              texto={`Quitar ${e.nombre}`}
              onPress={() =>
                cambiar({
                  ...valor,
                  ejercicios: valor.ejercicios.filter((otro) => otro.id !== e.id),
                })
              }
            />
          </View>
          <Campo
            etiqueta={`Indicaciones para ${e.nombre}`}
            value={e.indicaciones}
            onChangeText={(indicaciones) => ejercicio(e.id, { indicaciones })}
            multiline
            maxLength={2000}
          />
          {e.series.map((s, numero) => {
            const editar = (cambios: Partial<typeof s>): void =>
              ejercicio(e.id, {
                series: e.series.map((otra) => (otra.id === s.id ? { ...otra, ...cambios } : otra)),
              })
            const etiqueta = `${e.nombre}, serie ${numero + 1}`
            return (
              <View key={s.id} style={{ gap: 4 }}>
                <Text style={{ color: tema.texto }}>Serie {numero + 1}</Text>
                <View style={{ flexDirection: "row", gap: 12 }}>
                  <BotonSecundario
                    texto={s.tipoMedicion === "repeticiones" ? "✓ Repeticiones" : "Repeticiones"}
                    onPress={() => editar({ tipoMedicion: "repeticiones", objetivo: "" })}
                  />
                  <BotonSecundario
                    texto={s.tipoMedicion === "tiempo" ? "✓ Segundos" : "Segundos"}
                    onPress={() => editar({ tipoMedicion: "tiempo", objetivo: "" })}
                  />
                </View>
                <Campo
                  etiqueta={`Peso kg — ${etiqueta} (opcional)`}
                  value={s.peso}
                  keyboardType="decimal-pad"
                  onChangeText={(peso) => editar({ peso })}
                  placeholder="Sin carga prescrita"
                />
                <Campo
                  etiqueta={`${s.tipoMedicion === "repeticiones" ? "Repeticiones" : "Segundos"} — ${etiqueta}`}
                  value={s.objetivo}
                  keyboardType="number-pad"
                  onChangeText={(objetivo) => editar({ objetivo })}
                />
                <BotonSecundario
                  texto={`Quitar serie ${numero + 1} de ${e.nombre}`}
                  deshabilitado={e.series.length === 1}
                  onPress={() =>
                    ejercicio(e.id, { series: e.series.filter((otra) => otra.id !== s.id) })
                  }
                />
              </View>
            )
          })}
          <BotonSecundario
            texto={`Añadir serie a ${e.nombre}`}
            deshabilitado={e.series.length >= 30}
            onPress={() => ejercicio(e.id, { series: [...e.series, nuevaSerie()] })}
          />
        </View>
      ))}
    </View>
  )
}
