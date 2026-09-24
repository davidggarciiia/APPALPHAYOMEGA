import { useEffect, useState } from "react"
import {
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native"
import {
  metabolismoBasal,
  type BorradorDieta,
  type DietaPublicada,
  type ListadoMedidas,
  type Suplemento,
} from "@alpha-omega/shared"

import { edadEn, leerDecimal, miles, pesoLegible } from "../seguimiento/modelo"
import { hoyAgenda } from "../entrenamiento/fechas"
import { Fila, Tarjeta, Titulo } from "../entrenamiento/plan/piezas"
import { degradadoOro, tema } from "../tema"
import { deficit, gastoTotal, gramosDeMacros, porcentajesDe, type Pauta } from "./calculo"

const CREATINA: Suplemento = { nombre: "Creatina monohidrato", dosis: "3–5 g al día" }

/** Estado del formulario: textos tal como se escriben. */
type Textos = {
  peso: string
  altura: string
  edad: string
  grasa: string
  factor: string
  kcal: string
  margen: string
  hidratos: string
  proteina: string
  grasas: string
}

const coma = (valor: number | null | undefined): string =>
  valor === null || valor === undefined ? "" : String(valor).replace(".", ",")

/** Los valores de partida: la pauta guardada o, si no hay, las últimas medidas. */
export function textosIniciales(
  documento: DietaPublicada["documento"] | null,
  medidas: ListadoMedidas | null,
): Formulario {
  const calculo = documento?.calculo
  const objetivo = documento?.tiposDeDia[0]?.objetivo ?? null
  const ultima = <K extends "pesoKg" | "alturaCm" | "grasaPct">(clave: K) =>
    [...(medidas?.medidas ?? [])].reverse().find((m) => m[clave] !== null)?.[clave] ?? null
  const nacimiento = medidas?.fechaNacimiento ?? null
  const pct = objetivo ? porcentajesDe(objetivo) : null
  return {
    textos: {
      peso: coma(calculo?.pesoKg ?? ultima("pesoKg")),
      altura: coma(calculo?.alturaCm ?? ultima("alturaCm")),
      edad: coma(calculo?.edad ?? (nacimiento ? edadEn(nacimiento, hoyAgenda()) : null)),
      grasa: coma(calculo?.grasaPct ?? ultima("grasaPct")),
      factor: coma(calculo?.factorActividad ?? 1.55),
      kcal: coma(objetivo?.kcal ?? null),
      margen: coma(documento?.tiposDeDia[0]?.margenKcal ?? 100),
      hidratos: coma(pct?.hidratos ?? 45),
      proteina: coma(pct?.proteina ?? 25),
      grasas: coma(pct?.grasas ?? 30),
    },
    sexo: calculo?.sexo ?? "hombre",
    creatina: (documento?.suplementos ?? []).some((s) => /creatina/i.test(s.nombre)),
    pesoDiario: (documento?.indicaciones ?? []).some((i) => i.titulo === "Peso en ayunas"),
    registroComidas: documento?.registroComidas ?? true,
    nota: documento?.nota ?? "",
  }
}

type Formulario = {
  textos: Textos
  sexo: "hombre" | "mujer"
  creatina: boolean
  pesoDiario: boolean
  registroComidas: boolean
  nota: string
}

const numero = (texto: string): number | null => {
  const valor = leerDecimal(texto)
  return valor === null || Number.isNaN(valor) ? null : valor
}

/** La pauta que sale del formulario, o qué falta para poder publicarla. */
export function pautaDesde(f: Formulario): Pauta | string {
  const t = f.textos
  const p = numero(t.peso)
  const al = numero(t.altura)
  const ed = numero(t.edad)
  const fa = numero(t.factor)
  const k = numero(t.kcal)
  const reparto = {
    hidratos: numero(t.hidratos) ?? 0,
    proteina: numero(t.proteina) ?? 0,
    grasas: numero(t.grasas) ?? 0,
  }
  if (p === null || p < 30 || p > 400) return "Escribe el peso (30–400 kg)."
  if (al === null || al < 100 || al > 250) return "Escribe la altura (100–250 cm)."
  if (ed === null || ed < 10 || ed > 100) return "Escribe la edad."
  if (fa === null || fa < 1.2 || fa > 2.2) return "El factor de actividad va de 1,2 a 2,2."
  if (k === null || k < 800 || k > 10000) return "Escribe las calorías del objetivo."
  if (reparto.hidratos + reparto.proteina + reparto.grasas !== 100)
    return "Los porcentajes de macros tienen que sumar 100."
  const grasa = numero(t.grasa)
  const nota = f.nota.trim()
  return {
    objetivo: { kcal: Math.round(k), ...gramosDeMacros(k, reparto) },
    margenKcal: Math.min(1000, Math.round(numero(t.margen) ?? 0)),
    suplementos: f.creatina ? [CREATINA] : [],
    registroComidas: f.registroComidas,
    pesoDiario: f.pesoDiario,
    nota: nota === "" ? null : nota,
    calculo: {
      pesoKg: Math.round(p * 10) / 10,
      alturaCm: Math.round(al),
      edad: Math.round(ed),
      sexo: f.sexo,
      grasaPct: grasa === null ? null : Math.round(grasa * 10) / 10,
      factorActividad: Math.round(fa * 100) / 100,
      nota: null,
    },
  }
}

function Campo({
  etiqueta,
  valor,
  cambiar,
  unidad,
  ancho = 72,
}: {
  etiqueta: string
  valor: string
  cambiar: (texto: string) => void
  unidad?: string
  ancho?: number
}): React.JSX.Element {
  return (
    <View style={s.campoFila}>
      <TextInput
        accessibilityLabel={etiqueta}
        value={valor}
        onChangeText={cambiar}
        keyboardType="decimal-pad"
        selectionColor={tema.acento}
        style={[s.campo, { width: ancho }]}
        maxLength={6}
      />
      {unidad && <Text style={s.tenue}>{unidad}</Text>}
    </View>
  )
}

/**
 * «Pauta» de la ficha del nutricionista: cálculo del gasto con Mifflin-St Jeor,
 * objetivo diario con rango y reparto, suplementos, pautas y nota. Devuelve la
 * pauta lista para publicar, o el motivo por el que aún no lo está.
 */
export function PautaNutricion({
  nombre,
  base,
  medidas,
  resumen,
  alCambiar,
}: {
  nombre: string
  /** Borrador o, si no hay, la dieta vigente: de ahí se parte. */
  base: BorradorDieta | DietaPublicada | null
  medidas: ListadoMedidas | null
  /** «Últimos 7 días», ya calculado. */
  resumen: React.ReactNode
  alCambiar: (pauta: Pauta | string) => void
}): React.JSX.Element {
  const { width } = useWindowDimensions()
  const [formulario, setFormulario] = useState<Formulario>(() =>
    textosIniciales(base?.documento ?? null, medidas),
  )
  const { textos, sexo, creatina, pesoDiario, registroComidas, nota } = formulario
  useEffect(() => {
    alCambiar(pautaDesde(formulario))
  }, [formulario, alCambiar])
  const cambiarFormulario = (cambio: Partial<Formulario>): void =>
    setFormulario((actual) => ({ ...actual, ...cambio }))
  const cambiar = (clave: keyof Textos) => (texto: string) =>
    setFormulario((actual) => ({ ...actual, textos: { ...actual.textos, [clave]: texto } }))

  const peso = numero(textos.peso)
  const altura = numero(textos.altura)
  const edad = numero(textos.edad)
  const factor = numero(textos.factor)
  const kcal = numero(textos.kcal)
  const margen = numero(textos.margen) ?? 0
  const pct = {
    hidratos: numero(textos.hidratos) ?? 0,
    proteina: numero(textos.proteina) ?? 0,
    grasas: numero(textos.grasas) ?? 0,
  }
  const basal =
    peso !== null && altura !== null && edad !== null
      ? metabolismoBasal({
          pesoKg: peso,
          alturaCm: Math.round(altura),
          edad: Math.round(edad),
          sexo,
        })
      : null
  const gasto = basal !== null && factor !== null ? gastoTotal(basal, factor) : null
  const gramos = kcal !== null ? gramosDeMacros(kcal, pct) : null
  const suma = pct.hidratos + pct.proteina + pct.grasas

  const dosColumnas = width >= 900
  const primerNombre = nombre.split(" ")[0] ?? nombre

  const conmutador = (
    texto: string,
    valor: boolean,
    cambio: (v: boolean) => void,
  ): React.JSX.Element => (
    <View style={s.conmutador}>
      <Text style={[s.texto, s.flex]}>{texto}</Text>
      <Switch
        accessibilityLabel={texto}
        value={valor}
        onValueChange={cambio}
        trackColor={{ true: tema.acento, false: tema.superficieAlta }}
        thumbColor={tema.texto}
      />
    </View>
  )

  return (
    <View style={s.contenido}>
      {resumen}
      <View style={[s.columnas, dosColumnas && s.columnasAnchas]}>
        <View style={[s.grupo, dosColumnas && s.columna]}>
          <Titulo>Cálculo del gasto</Titulo>
          <Tarjeta>
            <Fila primera>
              <Text style={[s.texto, s.flex]}>Peso</Text>
              <Campo
                etiqueta="Peso en kg"
                valor={textos.peso}
                cambiar={cambiar("peso")}
                unidad="kg"
              />
            </Fila>
            <Fila>
              <Text style={[s.texto, s.flex]}>Altura y edad</Text>
              <Campo
                etiqueta="Altura en cm"
                valor={textos.altura}
                cambiar={cambiar("altura")}
                unidad="cm"
                ancho={60}
              />
              <Campo
                etiqueta="Edad"
                valor={textos.edad}
                cambiar={cambiar("edad")}
                unidad="años"
                ancho={48}
              />
            </Fila>
            <Fila>
              <Text style={[s.texto, s.flex]}>Sexo</Text>
              <View style={s.sexos} accessibilityRole="radiogroup" accessibilityLabel="Sexo">
                {(["hombre", "mujer"] as const).map((valor) => (
                  <Pressable
                    key={valor}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: sexo === valor }}
                    onPress={() => cambiarFormulario({ sexo: valor })}
                    style={[s.sexo, sexo === valor && degradadoOro]}
                  >
                    <Text style={[s.textoSexo, sexo === valor && s.textoSexoActivo]}>
                      {valor === "hombre" ? "Hombre" : "Mujer"}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </Fila>
            <Fila>
              <Text style={[s.texto, s.flex]}>Grasa corporal</Text>
              <Campo
                etiqueta="Grasa corporal en %"
                valor={textos.grasa}
                cambiar={cambiar("grasa")}
                unidad="%"
              />
            </Fila>
            <Fila>
              <Text style={[s.texto, s.flex]}>Metabolismo basal</Text>
              <Text style={s.valor}>
                {basal === null ? "—" : `${miles(basal)} kcal · Mifflin-St Jeor`}
              </Text>
            </Fila>
            <Fila>
              <Text style={[s.texto, s.flex]}>Factor de actividad</Text>
              <Campo
                etiqueta="Factor de actividad"
                valor={textos.factor}
                cambiar={cambiar("factor")}
              />
            </Fila>
            <Fila>
              <Text style={[s.fuerte, s.flex]}>Gasto total estimado</Text>
              <Text style={s.fuerte}>{gasto === null ? "—" : `${miles(gasto)} kcal`}</Text>
            </Fila>
          </Tarjeta>
          <Text style={s.tenue}>
            Se revisa con el peso medio semanal, no con el de un día.
            {peso !== null ? ` Peso de partida: ${pesoLegible(peso)}.` : ""}
          </Text>
        </View>

        <View style={[s.grupo, dosColumnas && s.columna]}>
          <Titulo>Objetivo diario</Titulo>
          <View style={s.objetivo}>
            <View style={s.filaObjetivo}>
              <View style={s.flex}>
                <Text style={s.tenue}>Calorías</Text>
                <Campo
                  etiqueta="Calorías del objetivo"
                  valor={textos.kcal}
                  cambiar={cambiar("kcal")}
                  unidad="kcal"
                  ancho={90}
                />
              </View>
              <View style={s.derecha}>
                <View style={s.campoFila}>
                  <Text style={s.tenue}>Rango ±</Text>
                  <Campo
                    etiqueta="Margen del rango en kcal"
                    valor={textos.margen}
                    cambiar={cambiar("margen")}
                    ancho={56}
                  />
                </View>
                {kcal !== null && (
                  <Text style={s.fuerte}>
                    {miles(kcal - margen)}–{miles(kcal + margen)}
                  </Text>
                )}
                {kcal !== null && gasto !== null && (
                  <Text style={s.tenue}>
                    {(() => {
                      const d = deficit(kcal, gasto)
                      return d.kcal >= 0
                        ? `Déficit de unos ${Math.round(d.kcal / 10) * 10} kcal, un ${d.pct} %`
                        : `Superávit de unos ${Math.round(-d.kcal / 10) * 10} kcal, un ${-d.pct} %`
                    })()}
                  </Text>
                )}
              </View>
            </View>
            <View style={s.barra} accessible={false}>
              <View
                style={[s.tramo, { flex: Math.max(pct.hidratos, 1), backgroundColor: tema.acento }]}
              />
              <View
                style={[
                  s.tramo,
                  { flex: Math.max(pct.proteina, 1), backgroundColor: tema.textoSecundario },
                ]}
              />
              <View
                style={[s.tramo, { flex: Math.max(pct.grasas, 1), backgroundColor: tema.naranja }]}
              />
            </View>
            <View style={s.macros}>
              {(
                [
                  ["hidratos", "Hidratos", gramos?.hidratosG, tema.acento],
                  ["proteina", "Proteína", gramos?.proteinaG, tema.textoSecundario],
                  ["grasas", "Grasas", gramos?.grasaG, tema.naranja],
                ] as const
              ).map(([clave, texto, g, color]) => (
                <View key={clave} style={s.macro}>
                  <View style={s.campoFila}>
                    <View style={[s.punto, { backgroundColor: color }]} />
                    <Text style={s.tenue}>{texto} ·</Text>
                    <Campo
                      etiqueta={`Porcentaje de ${texto.toLowerCase()}`}
                      valor={textos[clave]}
                      cambiar={cambiar(clave)}
                      unidad="%"
                      ancho={44}
                    />
                  </View>
                  <Text style={s.gramos}>{g === undefined ? "—" : `${g} g`}</Text>
                  {clave === "proteina" && g !== undefined && peso !== null && (
                    <Text style={s.tenue}>{coma(Math.round((g / peso) * 10) / 10)} g por kg</Text>
                  )}
                </View>
              ))}
            </View>
            {suma !== 100 && <Text style={s.error}>Los porcentajes suman {suma} %, no 100.</Text>}
            <View style={s.separador} />
            {conmutador(`${CREATINA.nombre}, ${CREATINA.dosis}`, creatina, (v) =>
              cambiarFormulario({ creatina: v }),
            )}
            {conmutador("Peso en ayunas cada día", pesoDiario, (v) =>
              cambiarFormulario({ pesoDiario: v }),
            )}
            {conmutador("Registro de comidas completo", registroComidas, (v) =>
              cambiarFormulario({ registroComidas: v }),
            )}
          </View>
        </View>
      </View>

      <View style={s.grupo}>
        <Titulo>{`Nota para ${primerNombre}`}</Titulo>
        <TextInput
          accessibilityLabel={`Nota para ${primerNombre}`}
          value={nota}
          onChangeText={(texto) => cambiarFormulario({ nota: texto })}
          placeholder="Lo que verá en su pestaña Nutrición…"
          placeholderTextColor={tema.marcador}
          multiline
          maxLength={1000}
          style={s.nota}
        />
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  contenido: { gap: 28 },
  columnas: { gap: 28 },
  columnasAnchas: { flexDirection: "row", alignItems: "flex-start" },
  columna: { flex: 1 },
  grupo: { gap: 12 },
  flex: { flex: 1 },
  texto: { color: tema.texto, fontFamily: tema.fuenteTexto, fontSize: 15 },
  fuerte: { color: tema.texto, fontFamily: tema.fuenteBoton, fontSize: 15 },
  valor: { color: tema.textoSecundario, fontFamily: tema.fuenteTexto, fontSize: 14 },
  tenue: { color: tema.textoTenue, fontFamily: tema.fuenteTexto, fontSize: 13 },
  error: { color: tema.aviso, fontFamily: tema.fuenteTexto, fontSize: 13 },
  campoFila: { flexDirection: "row", alignItems: "center", gap: 6 },
  campo: {
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: tema.bordeFuerte,
    backgroundColor: tema.hundido,
    color: tema.texto,
    fontFamily: tema.fuenteBoton,
    fontSize: 15,
    textAlign: "center",
  },
  sexos: { flexDirection: "row", gap: 6 },
  sexo: {
    minHeight: 36,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: tema.bordeFuerte,
    justifyContent: "center",
  },
  textoSexo: { color: tema.texto, fontFamily: tema.fuenteSemi, fontSize: 14 },
  textoSexoActivo: { color: tema.sobreAcento, fontFamily: tema.fuenteBoton },
  objetivo: {
    backgroundColor: tema.superficie,
    borderRadius: 20,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: tema.bordeDestacado,
  },
  filaObjetivo: { flexDirection: "row", gap: 12 },
  derecha: { alignItems: "flex-end", gap: 4 },
  barra: { flexDirection: "row", gap: 3, height: 6 },
  tramo: { borderRadius: 3 },
  macros: { flexDirection: "row", gap: 12, flexWrap: "wrap" },
  macro: { flex: 1, minWidth: 120, gap: 4 },
  punto: { width: 8, height: 8, borderRadius: 4 },
  gramos: { color: tema.texto, fontFamily: tema.fuenteBoton, fontSize: 20 },
  separador: { height: 1, backgroundColor: tema.borde },
  conmutador: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 44 },
  nota: {
    minHeight: 96,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: tema.bordeFuerte,
    backgroundColor: tema.superficie,
    color: tema.texto,
    fontFamily: tema.fuenteTexto,
    fontSize: 15,
    padding: 14,
    textAlignVertical: "top",
  },
})
