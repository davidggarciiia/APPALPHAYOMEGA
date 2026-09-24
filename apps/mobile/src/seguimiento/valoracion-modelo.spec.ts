import {
  crearPruebaEstandar,
  type DefinicionCorporal,
  type DocumentoValoracion,
  type ValoracionProfesional,
} from "@alpha-omega/shared"

import { CAMPO_PRUEBA_VACIO, cambioDe, edicionDe } from "./valoracion-modelo"

// Definiciones y valores sintéticos.
const peso: DefinicionCorporal = {
  id: "40000000-0000-4000-8000-000000000001",
  version: 1,
  bloque: "medidas",
  magnitud: "peso",
  nombre: "Peso",
  unidad: "kg",
  zona: null,
  lateralidad: null,
  instrumento: null,
  protocolo: null,
  activa: true,
}
const pliegue: DefinicionCorporal = {
  ...peso,
  id: "40000000-0000-4000-8000-000000000002",
  bloque: "pliegues",
  magnitud: "pliegue",
  nombre: "Punto A",
  unidad: "mm",
}
const cooper = crearPruebaEstandar("cooper", "40000000-0000-4000-8000-000000000003")

function visita(documento: Partial<DocumentoValoracion> = {}): ValoracionProfesional {
  return {
    id: "20000000-0000-4000-8000-000000000000",
    clienteId: "10000000-0000-4000-8000-000000000000",
    tipo: "inicial",
    anteriorId: null,
    estado: "borrador",
    creadaEn: "2026-09-24T08:00:00.000Z",
    publicacion: null,
    documentoVigente: null,
    borrador: {
      id: "50000000-0000-4000-8000-000000000000",
      revision: 4,
      fechaToma: "2026-09-24",
      corrigePublicacionId: null,
      creadoEn: "2026-09-24T08:00:00.000Z",
      actualizadoEn: "2026-09-24T08:00:00.000Z",
      documento: {
        definiciones: { corporales: [peso, pliegue], pruebas: [cooper] },
        bloques: ["medidas", "pliegues", "pruebas"],
        corporales: [
          { definicionId: peso.id, estado: "registrado", valor: 80.5 },
          { definicionId: pliegue.id, estado: "pendiente", lecturas: [12.2, 12.6] },
        ],
        pruebas: [{ definicionId: cooper.id, estado: "pendiente" }],
        grasaPorPliegues: null,
        destacados: [],
        conclusion: null,
        notasInternas: "Nota sintética",
        ...documento,
      },
    },
  }
}

it("ida y vuelta sin cambios devuelve el mismo documento", () => {
  const v = visita()
  const cambio = cambioDe(v, edicionDe(v))
  expect(cambio).toEqual({
    borradorId: v.borrador!.id,
    revision: 4,
    fechaToma: "2026-09-24",
    contenido: {
      bloques: ["medidas", "pliegues", "pruebas"],
      corporales: v.borrador!.documento.corporales,
      pruebas: v.borrador!.documento.pruebas,
      grasaPorPliegues: null,
      destacados: [],
      conclusion: null,
      notasInternas: "Nota sintética",
    },
  })
  expect(edicionDe(v).corporales[pliegue.id]?.lecturas).toEqual(["12,2", "12,6"])
})

it("adopta el valor del pliegue con coma decimal sin perder las lecturas", () => {
  const v = visita()
  const edicion = edicionDe(v)
  edicion.corporales[pliegue.id] = { ...edicion.corporales[pliegue.id]!, texto: "12,4" }
  const cambio = cambioDe(v, edicion)
  expect("contenido" in cambio && cambio.contenido.corporales[1]).toEqual({
    definicionId: pliegue.id,
    estado: "registrado",
    valor: 12.4,
    lecturas: [12.2, 12.6],
  })
})

it("no realizado guarda su motivo y un texto vacío queda pendiente, no a cero", () => {
  const v = visita()
  const edicion = edicionDe(v)
  edicion.corporales[peso.id] = { ...edicion.corporales[peso.id]!, texto: "" }
  edicion.corporales[pliegue.id] = {
    texto: "",
    noRealizado: true,
    motivo: "Motivo sintético",
    lecturas: [],
  }
  const cambio = cambioDe(v, edicion)
  expect("contenido" in cambio && cambio.contenido.corporales).toEqual([
    { definicionId: peso.id, estado: "pendiente" },
    { definicionId: pliegue.id, estado: "noRealizado", motivo: "Motivo sintético" },
  ])
})

it("valida con los mismos límites que el servidor", () => {
  const v = visita()
  const con = (texto: string) => {
    const edicion = edicionDe(v)
    edicion.corporales[peso.id] = { ...edicion.corporales[peso.id]!, texto }
    return cambioDe(v, edicion)
  }
  expect(con("0")).toEqual({ error: "Peso: escribe un valor entre 30 y 400 kg." })
  expect(con("80,5x")).toEqual({ error: "Peso: escribe un número, por ejemplo 12,5." })
  expect("contenido" in con("79,95")).toBe(true)
  const lectura = edicionDe(v)
  lectura.corporales[pliegue.id] = { ...lectura.corporales[pliegue.id]!, lecturas: ["0"] }
  expect(cambioDe(v, lectura)).toEqual({
    error: "Punto A: cada lectura mayor que 0 y hasta 100 mm.",
  })
})

it("Cooper se guarda sin frecuencia cardiaca y exige las métricas obligatorias", () => {
  const v = visita()
  const edicion = edicionDe(v)
  edicion.pruebas[cooper.id] = {
    ...CAMPO_PRUEBA_VACIO,
    estado: "registrado",
    valores: { distancia: "2400", duracion: "" },
  }
  expect(cambioDe(v, edicion)).toEqual({ error: "Cooper: falta duración." })
  edicion.pruebas[cooper.id] = {
    ...CAMPO_PRUEBA_VACIO,
    estado: "registrado",
    valores: { distancia: "2400", duracion: "720", fcMedia: "" },
    protocoloCompleto: false,
    fecha: "2026-09-25",
    notas: "Nota visible",
  }
  const cambio = cambioDe(v, edicion)
  expect("contenido" in cambio && cambio.contenido.pruebas).toEqual([
    {
      definicionId: cooper.id,
      estado: "registrado",
      valores: { distancia: 2400, duracion: 720 },
      protocoloCompleto: false,
      fecha: "2026-09-25",
      notas: "Nota visible",
    },
  ])
})

it("el porcentaje por pliegues necesita valor, método y fecha", () => {
  const v = visita()
  const edicion = edicionDe(v)
  edicion.grasa = { texto: "18,5", metodo: "", fecha: "2026-09-24" }
  expect(cambioDe(v, edicion)).toEqual({
    error: "Grasa por pliegues: indica el método con el que la calculaste.",
  })
  edicion.grasa = { texto: "18,5", metodo: "Método del entrenador", fecha: "2026-09-24" }
  const cambio = cambioDe(v, edicion)
  expect("contenido" in cambio && cambio.contenido.grasaPorPliegues).toEqual({
    valorPct: 18.5,
    metodo: "Método del entrenador",
    fecha: "2026-09-24",
  })
})
