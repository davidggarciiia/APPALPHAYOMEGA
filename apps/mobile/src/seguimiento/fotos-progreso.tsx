import { Pressable, StyleSheet, Text, View } from "react-native"
import type { MedioFoto, VistaFoto } from "@alpha-omega/shared"

import { fechaCorta } from "../entrenamiento/plan/modelo"
import { espacio, tema, tipo } from "../tema"
import { ImagenPrivada } from "./comparador-fotos"
import type { ApiMedios } from "./medios-api"

const VISTAS: Record<Exclude<VistaFoto, "otra">, string> = {
  frente: "Frente",
  espalda: "Espalda",
  perfilIzquierdo: "Perfil izquierdo",
  perfilDerecho: "Perfil derecho",
}
const ORDEN: VistaFoto[] = ["frente", "espalda", "perfilIzquierdo", "perfilDerecho", "otra"]

/** Una pose personalizada solo se compara con la misma etiqueta. */
function nombre(foto: MedioFoto): string {
  if (foto.vista !== "otra") return VISTAS[foto.vista]
  const etiqueta = foto.etiqueta ?? "Otra"
  const comparable = (valor: string): string =>
    valor
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase()
  return Object.values(VISTAS).some((vista) => comparable(vista) === comparable(etiqueta))
    ? `Otra: ${etiqueta}`
    : etiqueta
}

function fecha(foto: MedioFoto): string {
  return `${fechaCorta(foto.fechaToma)} ${foto.fechaToma.slice(0, 4)}`
}

export function FotosProgreso({
  fotos,
  acceso,
  abrirGaleria,
}: {
  fotos: MedioFoto[]
  acceso: ApiMedios["acceso"]
  abrirGaleria: () => void
}): React.JSX.Element | null {
  const grupos = new Map<string, MedioFoto[]>()
  const vistos = new Set<string>()
  for (const foto of fotos) {
    if (foto.estado !== "disponible" || vistos.has(foto.id)) continue
    vistos.add(foto.id)
    const clave = foto.vista === "otra" ? `otra:${foto.etiqueta ?? ""}` : foto.vista
    const grupo = grupos.get(clave) ?? []
    grupo.push(foto)
    grupos.set(clave, grupo)
  }
  const ordenados = [...grupos.values()].sort(
    (a, b) => ORDEN.indexOf(a[0]!.vista) - ORDEN.indexOf(b[0]!.vista),
  )
  const grupo = ordenados.find((fotosDePose) => fotosDePose.length > 1) ?? ordenados[0]
  if (!grupo) return null
  grupo.sort(
    (a, b) =>
      a.fechaToma.localeCompare(b.fechaToma) ||
      a.creadoEn.localeCompare(b.creadoEn) ||
      a.id.localeCompare(b.id),
  )
  const primera = grupo[0]!
  const ultima = grupo.length > 1 ? grupo[grupo.length - 1] : undefined
  const pose = nombre(primera)
  return (
    <View style={s.contenido}>
      <View style={s.par}>
        <View style={s.panel}>
          <ImagenPrivada
            key={primera.id}
            medioId={primera.id}
            etiqueta={`Antes: ${pose}, ${fecha(primera)}`}
            acceso={acceso}
          />
          <View style={s.rotulo}>
            <Text style={s.etiqueta}>Antes</Text>
            <Text style={s.fecha}>{fecha(primera)}</Text>
          </View>
        </View>
        {ultima && (
          <View style={s.panel}>
            <ImagenPrivada
              key={ultima.id}
              medioId={ultima.id}
              etiqueta={`Ahora: ${pose}, ${fecha(ultima)}`}
              acceso={acceso}
            />
            <View style={s.rotulo}>
              <Text style={[s.etiqueta, s.ahora]}>Ahora</Text>
              <Text style={s.fecha}>{fecha(ultima)}</Text>
            </View>
          </View>
        )}
      </View>
      {!ultima && <Text style={s.aviso}>Falta otra foto de la misma pose para comparar.</Text>}
      {ultima && primera.fechaToma === ultima.fechaToma && (
        <Text style={s.aviso}>Las dos fotos son del mismo día.</Text>
      )}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Ver galería de fotos"
        accessibilityHint={
          ultima
            ? `${pose}: antes ${fecha(primera)}, ahora ${fecha(ultima)}.${primera.fechaToma === ultima.fechaToma ? " Las dos fotos son del mismo día." : ""}`
            : `${pose}: una foto del ${fecha(primera)}; falta otra para comparar.`
        }
        onPress={abrirGaleria}
        style={s.abrir}
      >
        <Text style={s.textoAbrir}>Ver galería</Text>
      </Pressable>
    </View>
  )
}

const s = StyleSheet.create({
  contenido: { gap: espacio[8] },
  par: { flexDirection: "row", gap: espacio[8] },
  panel: { flex: 1, minWidth: 0, gap: espacio[8] },
  rotulo: { flexDirection: "row", justifyContent: "space-between", gap: espacio[8] },
  etiqueta: { ...tipo.micro, color: tema.textoTenue },
  ahora: { color: tema.acento },
  fecha: { ...tipo.secundario },
  aviso: { ...tipo.secundario },
  abrir: { minHeight: 44, justifyContent: "center", alignSelf: "flex-start" },
  textoAbrir: { ...tipo.fila, color: tema.acento },
})
