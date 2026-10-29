import { useEffect, useRef, useState } from "react"
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
  type ValoracionCorporal,
} from "@alpha-omega/shared"

import { edadEn, leerDecimal, miles, pesoLegible } from "../seguimiento/modelo"
import { hoyAgenda } from "../entrenamiento/fechas"
import { Fila, Tarjeta, Titulo } from "../entrenamiento/plan/piezas"
import { fechaCorta } from "../entrenamiento/plan/modelo"
import { degradadoOro, tema } from "../tema"
import { deficit, gastoTotal, gramosDeMacros, porcentajesDe, type Pauta } from "./calculo"
import { esCreatina } from "./hoy-modelo"

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

/** La pauta guardada manda; una valoración parcial conserva sus huecos. */
export function textosIniciales(
  documento: DietaPublicada["documento"] | null,
  medidas: ListadoMedidas | null,
  valoracion: ValoracionCorporal | null = null,
): Formulario {
  const calculo = documento?.calculo
  const objetivo = documento?.tiposDeDia[0]?.objetivo ?? null
  const ultima = <K extends "pesoKg" | "alturaCm" | "grasaPct">(clave: K) =>
    [...(medidas?.medidas ?? [])].reverse().find((m) => m[clave] !== null)?.[clave] ?? null
  const corporal = (magnitud: "peso" | "altura" | "grasa", unidad: "kg" | "cm" | "%") => {
    const definiciones = (valoracion?.definiciones ?? [])
      .filter((d) => d.magnitud === magnitud && d.unidad === unidad)
      .sort((a, b) => Number(b.bloque === "medidas") - Number(a.bloque === "medidas"))
    for (const definicion of definiciones) {
      const resultado = valoracion?.corporales.find((r) => r.definicionId === definicion.id)
      if (resultado?.estado === "registrado") return resultado.valor
    }
    return null
  }
  const nacimiento = medidas?.fechaNacimiento ?? null
  const pct = objetivo ? porcentajesDe(objetivo) : null
  const repartoInicial = {
    kcal: coma(objetivo?.kcal ?? null),
    hidratos: coma(pct?.hidratos ?? 45),
    proteina: coma(pct?.proteina ?? 25),
    grasas: coma(pct?.grasas ?? 30),
  }
  return {
    suplementosIniciales: documento?.suplementos ?? [],
    notaCalculo: calculo?.nota ?? null,
    objetivoInicial:
      objetivo &&
      objetivo.kcal !== null &&
      objetivo.hidratosG !== null &&
      objetivo.proteinaG !== null &&
      objetivo.grasaG !== null
        ? {
            kcal: objetivo.kcal,
            hidratosG: objetivo.hidratosG,
            proteinaG: objetivo.proteinaG,
            grasaG: objetivo.grasaG,
          }
        : null,
    repartoInicial,
    otrasIndicaciones: (documento?.indicaciones ?? []).filter((i) => i.titulo !== "Peso en ayunas")
      .length,
    textos: {
      peso: coma(calculo?.pesoKg ?? (valoracion ? corporal("peso", "kg") : ultima("pesoKg"))),
      altura: coma(
        calculo?.alturaCm ?? (valoracion ? corporal("altura", "cm") : ultima("alturaCm")),
      ),
      edad: coma(calculo?.edad ?? (nacimiento ? edadEn(nacimiento, hoyAgenda()) : null)),
      grasa: coma(
        calculo
          ? calculo.grasaPct
          : valoracion
            ? (valoracion.grasaPorPliegues?.valorPct ?? corporal("grasa", "%"))
            : ultima("grasaPct"),
      ),
      factor: coma(calculo?.factorActividad ?? 1.55),
      ...repartoInicial,
      margen: coma(documento?.tiposDeDia[0]?.margenKcal ?? 100),
    },
    sexo: calculo?.sexo ?? "hombre",
    creatina: (documento?.suplementos ?? []).some(esCreatina),
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
  suplementosIniciales: Suplemento[]
  notaCalculo: string | null
  objetivoInicial: Pauta["objetivo"] | null
  repartoInicial: Pick<Textos, "kcal" | "hidratos" | "proteina" | "grasas">
  otrasIndicaciones: number
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
  if (f.pesoDiario && f.otrasIndicaciones >= 10)
    return "La dieta ya tiene diez indicaciones. Edita las indicaciones antes de añadir el peso diario."
  const grasa = numero(t.grasa)
  if (t.grasa.trim() !== "" && (grasa === null || grasa < 2 || grasa > 70))
    return "Escribe la grasa corporal (2–70 %) o deja el campo vacío."
  const nota = f.nota.trim()
  const sinCambiarObjetivo = (
    Object.keys(f.repartoInicial) as Array<keyof typeof f.repartoInicial>
  ).every((clave) => t[clave] === f.repartoInicial[clave])
  const suplementos = f.suplementosIniciales.filter((s) => f.creatina || !esCreatina(s))
  if (f.creatina && !f.suplementosIniciales.some(esCreatina)) suplementos.push(CREATINA)
  return {
    objetivo:
      sinCambiarObjetivo && f.objetivoInicial
        ? { ...f.objetivoInicial }
        : { kcal: Math.round(k), ...gramosDeMacros(k, reparto) },
    margenKcal: Math.min(1000, Math.round(numero(t.margen) ?? 0)),
    suplementos,
    registroComidas: f.registroComidas,
    pesoDiario: f.pesoDiario,
    nota: nota === "" ? null : nota,
    calculo: {
      pesoKg: p,
      alturaCm: Math.round(al),
      edad: Math.round(ed),
      sexo: f.sexo,
      grasaPct: grasa,
      factorActividad: fa,
      nota: f.notaCalculo,
    },
  }
}

function Campo({
  etiqueta,
  valor,
  cambiar,
  unidad,
  ancho = 72,
  bloqueado = false,
}: {
  etiqueta: string
  valor: string
  cambiar: (texto: string) => void
  unidad?: string
  ancho?: number
  bloqueado?: boolean
}): React.JSX.Element {
  return (
    <View style={s.campoFila}>
      <TextInput
        accessibilityLabel={etiqueta}
        value={valor}
        editable={!bloqueado}
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
  valoracion = null,
  resumen,
  alCambiar,
  bloqueado = false,
}: {
  nombre: string
  /** Borrador o, si no hay, la dieta vigente: de ahí se parte. */
  base: BorradorDieta | DietaPublicada | null
  medidas: ListadoMedidas | null
  valoracion?: ValoracionCorporal | null
  /** «Últimos 7 días», ya calculado. */
  resumen: React.ReactNode
  alCambiar: (pauta: Pauta | string) => void
  bloqueado?: boolean
}): React.JSX.Element {
  const { width } = useWindowDimensions()
  const [formulario, setFormulario] = useState<Formulario>(() =>
    textosIniciales(base?.documento ?? null, medidas, valoracion),
  )
  const editados = useRef(new Set<keyof Textos>())
  useEffect(() => {
    if (base?.documento.calculo) return
    const iniciales = textosIniciales(base?.documento ?? null, medidas, valoracion).textos
    setFormulario((actual) => {
      const textos = { ...actual.textos }
      let cambiado = false
      for (const clave of ["peso", "altura", "grasa", "edad"] as const)
        if (!editados.current.has(clave) && textos[clave] !== iniciales[clave]) {
          textos[clave] = iniciales[clave]
          cambiado = true
        }
      return cambiado ? { ...actual, textos } : actual
    })
  }, [base?.documento, medidas, valoracion])
  const { textos, sexo, creatina, pesoDiario, registroComidas, nota } = formulario
  useEffect(() => {
    alCambiar(pautaDesde(formulario))
  }, [formulario, alCambiar])
  const cambiarFormulario = (cambio: Partial<Formulario>): void => {
    if (!bloqueado) setFormulario((actual) => ({ ...actual, ...cambio }))
  }
  const cambiar =
    (clave: keyof Textos) =>
    (texto: string): void => {
      if (!bloqueado) {
        editados.current.add(clave)
        setFormulario((actual) => ({ ...actual, textos: { ...actual.textos, [clave]: texto } }))
      }
    }

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
  const sinCambiarObjetivo = (
    Object.keys(formulario.repartoInicial) as Array<keyof typeof formulario.repartoInicial>
  ).every((clave) => textos[clave] === formulario.repartoInicial[clave])
  const gramos =
    sinCambiarObjetivo && formulario.objetivoInicial
      ? formulario.objetivoInicial
      : kcal !== null
        ? gramosDeMacros(kcal, pct)
        : null
  const suma = pct.hidratos + pct.proteina + pct.grasas

  const dosColumnas = width >= 900
  const primerNombre = nombre.split(" ")[0] ?? nombre
  const etiquetaCreatina =
    formulario.suplementosIniciales
      .filter(esCreatina)
      .map((s) => (s.dosis === null ? s.nombre : `${s.nombre}, ${s.dosis}`))
      .join("; ") || `${CREATINA.nombre}, ${CREATINA.dosis}`

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
        disabled={bloqueado}
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
          {!base?.documento.calculo && valoracion && (
            <Text style={s.tenue}>Valoración publicada · {fechaCorta(valoracion.fechaToma)}</Text>
          )}
          <Tarjeta>
            <Fila primera>
              <Text style={[s.texto, s.flex]}>Peso</Text>
              <Campo
                bloqueado={bloqueado}
                etiqueta="Peso en kg"
                valor={textos.peso}
                cambiar={cambiar("peso")}
                unidad="kg"
              />
            </Fila>
            <Fila>
              <Text style={[s.texto, s.flex]}>Altura y edad</Text>
              <Campo
                bloqueado={bloqueado}
                etiqueta="Altura en cm"
                valor={textos.altura}
                cambiar={cambiar("altura")}
                unidad="cm"
                ancho={60}
              />
              <Campo
                bloqueado={bloqueado}
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
                    aria-checked={sexo === valor}
                    disabled={bloqueado}
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
                bloqueado={bloqueado}
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
                bloqueado={bloqueado}
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
                  bloqueado={bloqueado}
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
                    bloqueado={bloqueado}
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
                      bloqueado={bloqueado}
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
            {conmutador(etiquetaCreatina, creatina, (v) => cambiarFormulario({ creatina: v }))}
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
          editable={!bloqueado}
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
    height: 44,
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
    minHeight: 44,
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
