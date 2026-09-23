import { DocumentoDietaSchema } from "@alpha-omega/shared"
import {
  convertir,
  desdeDocumento,
  duplicarTipo,
  nuevaComida,
  nuevaDieta,
  quitarTipo,
  type DietaEditable,
  type GeneradorDeIds,
} from "./editor-modelo"

function generador(): GeneradorDeIds {
  let n = 0
  return () => `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`
}

function conObjetivo(ids: GeneradorDeIds, kcal: string): DietaEditable {
  const dieta = nuevaDieta(ids)
  dieta.nombre = "Objetivos"
  dieta.tipos[0]!.objetivo.kcal = kcal
  return dieta
}

it("una dieta nueva sin números ni comidas no se puede guardar y dice por qué", () => {
  const dieta = nuevaDieta(generador())
  dieta.nombre = "Vacía"
  const { documento, errores } = convertir(dieta)
  expect(documento).toBeNull()
  expect(errores).toEqual(["Todos los días: añade una comida o algún número del objetivo."])
})

it("convierte números enteros, admite separador de miles y nunca pasa lo inválido a 0", () => {
  const ids = generador()
  expect(convertir(conObjetivo(ids, " 2.100 ")).documento?.tiposDeDia[0]?.objetivo?.kcal).toBe(2100)
  expect(convertir(conObjetivo(ids, "2100")).documento?.tiposDeDia[0]?.objetivo?.kcal).toBe(2100)
  for (const invalido of ["1,5", "abc", "-3", "2.1"]) {
    const { documento, errores } = convertir(conObjetivo(ids, invalido))
    expect(documento).toBeNull()
    expect(errores[0]).toMatch(/Todos los días, objetivo, kcal: escribe un número entero/)
  }
})

it("quitar un tipo deja sus días sin asignar hasta reasignarlos", () => {
  const ids = generador()
  const base = conObjetivo(ids, "2000")
  const conDos = duplicarTipo(base, base.tipos[0]!.id, ids)
  const copia = conDos.tipos[1]!
  const semana = conDos.semana.map((id, n) => (n === 6 ? copia.id : id))
  const sinCopia = quitarTipo({ ...conDos, semana }, copia.id)
  expect(convertir(sinCopia).errores).toEqual(["Asigna un tipo de día al domingo."])
  const reasignada = { ...sinCopia, semana: sinCopia.semana.map((id) => id ?? base.tipos[0]!.id) }
  expect(convertir(reasignada).errores).toEqual([])
})

it("duplicar un tipo de día copia sus comidas con identificadores nuevos", () => {
  const ids = generador()
  const dieta = conObjetivo(ids, "2000")
  const comida = nuevaComida(ids, "alternativas")
  comida.nombre = "Desayuno"
  comida.grupos[0]!.alternativas[0]!.titulo = "Tostadas"
  comida.grupos[0]!.alternativas[0]!.alimentos[0]!.nombre = "Pan"
  dieta.tipos[0]!.comidas = [comida]
  const duplicada = duplicarTipo(dieta, dieta.tipos[0]!.id, ids)
  expect(duplicada.tipos.map((t) => t.nombre)).toEqual(["Todos los días", "Todos los días (copia)"])
  const { documento } = convertir(duplicada)
  expect(documento).not.toBeNull()
  expect(DocumentoDietaSchema.safeParse(documento).success).toBe(true)
})

it("ignora filas de alimento vacías y avisa de una cantidad sin alimento", () => {
  const ids = generador()
  const dieta = conObjetivo(ids, "")
  const comida = nuevaComida(ids, "intercambio")
  comida.nombre = "Comida"
  comida.columnas[0]!.alimentos = [
    { clave: ids(), nombre: "Arroz", cantidad: "60 g" },
    { clave: ids(), nombre: "", cantidad: "" },
  ]
  comida.columnas[1]!.alimentos = [{ clave: ids(), nombre: "Pollo", cantidad: "" }]
  comida.columnas[2]!.alimentos = [{ clave: ids(), nombre: "", cantidad: "10 g" }]
  dieta.tipos[0]!.comidas = [comida]
  expect(convertir(dieta).errores).toEqual([
    "Todos los días · Comida · Grasas: hay una cantidad sin alimento.",
    "Todos los días · Comida · Grasas: añade al menos un alimento.",
  ])
  comida.columnas[2]!.alimentos = [{ clave: ids(), nombre: "Aceite de oliva", cantidad: "10 g" }]
  const { documento } = convertir(dieta)
  const leida = documento?.tiposDeDia[0]?.comidas[0]
  expect(leida?.forma === "intercambio" && leida.columnas[0]?.alimentos).toEqual([
    { nombre: "Arroz", cantidad: "60 g" },
  ])
  expect(leida?.forma === "intercambio" && leida.columnas[1]?.alimentos).toEqual([
    { nombre: "Pollo", cantidad: null },
  ])
})

it("rechaza una hora mal escrita", () => {
  const ids = generador()
  const dieta = conObjetivo(ids, "2000")
  const comida = nuevaComida(ids, "alternativas")
  comida.nombre = "Cena"
  comida.hora = "25:00"
  comida.grupos[0]!.alternativas[0]!.titulo = "Pescado"
  comida.grupos[0]!.alternativas[0]!.alimentos[0]!.nombre = "Merluza"
  dieta.tipos[0]!.comidas = [comida]
  expect(convertir(dieta).errores).toEqual([
    "Todos los días · Cena: escribe la hora como HH:MM, por ejemplo 08:30.",
  ])
})

it("editar una dieta publicada y volver a convertirla no cambia su contenido", () => {
  const ids = generador()
  const dieta = conObjetivo(ids, "2300")
  const comida = nuevaComida(ids, "alternativas")
  comida.nombre = "Desayuno"
  comida.hora = "08:00"
  comida.grupos[0]!.nombre = "Opciones dulces"
  comida.grupos[0]!.alternativas[0]!.titulo = "Tostadas"
  comida.grupos[0]!.alternativas[0]!.alimentos[0] = {
    clave: ids(),
    nombre: "Pan",
    cantidad: "60 g",
  }
  dieta.tipos[0]!.comidas = [comida]
  dieta.indicaciones = [{ clave: ids(), titulo: "Pautas", texto: "Pesa en crudo." }]
  const original = convertir(dieta).documento
  expect(original).not.toBeNull()
  expect(convertir(desdeDocumento(original!, ids)).documento).toEqual(original)
})
