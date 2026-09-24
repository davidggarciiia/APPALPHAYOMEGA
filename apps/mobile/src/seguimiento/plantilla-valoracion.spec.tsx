import { act, fireEvent, render, screen } from "@testing-library/react-native"
import {
  crearPruebaEstandar,
  type DefinicionCorporal,
  type ErrorDeApi,
  type GuardarPlantillaValoracion,
  type PlantillaValoracion,
} from "@alpha-omega/shared"

import { ErrorDePeticion } from "../lib/http"
import { EditorPlantilla } from "./plantilla-valoracion"

jest.mock("../componentes/iconos", () => ({ Icono: () => null }))

const AVISO = "Nueva versión: sus resultados anteriores quedarán en otra serie"

let contador = 0
const nuevoId = (): string => `30000000-0000-4000-8000-${String(++contador).padStart(12, "0")}`
beforeEach(() => {
  contador = 0
})

// Definiciones sintéticas: ni puntos anatómicos ni instrumentos reales.
const peso: DefinicionCorporal = {
  id: "40000000-0000-4000-8000-000000000001",
  version: 1,
  bloque: "medidas",
  magnitud: "peso",
  nombre: "Peso",
  unidad: "kg",
  zona: null,
  lateralidad: null,
  instrumento: "Báscula A",
  protocolo: null,
  activa: true,
}
const cintura: DefinicionCorporal = {
  ...peso,
  id: "40000000-0000-4000-8000-000000000002",
  magnitud: "perimetro",
  nombre: "Cintura",
  unidad: "cm",
  zona: "Zona A",
  instrumento: "Cinta A",
}
const PLANTILLA: PlantillaValoracion = { revision: 3, corporales: [peso, cintura], pruebas: [] }

const guardarEco = () =>
  jest.fn(async (datos: GuardarPlantillaValoracion) => ({ ...datos, revision: datos.revision + 1 }))

async function montar({
  plantilla = PLANTILLA,
  guardar = guardarEco(),
  recargar,
}: {
  plantilla?: PlantillaValoracion
  guardar?: (datos: GuardarPlantillaValoracion) => Promise<PlantillaValoracion>
  recargar?: () => Promise<PlantillaValoracion>
} = {}) {
  const cerrar = jest.fn()
  await render(
    <EditorPlantilla
      plantilla={plantilla}
      guardar={guardar}
      nuevoId={nuevoId}
      cerrar={cerrar}
      recargar={recargar}
    />,
  )
  return { guardar, cerrar }
}

const pulsar = (nombre: string) => fireEvent.press(screen.getByRole("button", { name: nombre }))
const elegir = (nombre: string) => fireEvent.press(screen.getByRole("radio", { name: nombre }))
const escribir = (etiqueta: string, texto: string) =>
  fireEvent.changeText(screen.getByLabelText(etiqueta), texto)

const conflicto = (): ErrorDePeticion =>
  new ErrorDePeticion({
    statusCode: 409,
    codigo: "revision_obsoleta",
    message: "La plantilla ha cambiado",
  } satisfies ErrorDeApi)

it("añade un perímetro con lateralidad y envía exactamente la definición nueva", async () => {
  const { guardar } = await montar()
  await pulsar("Añadir campo a Medidas")
  expect(screen.queryByRole("radio", { name: "Pliegue" })).toBeNull()
  expect(screen.queryByRole("radio", { name: "Grasa" })).toBeNull()
  await elegir("Perímetro")
  // Un perímetro solo se mide en cm: la unidad queda elegida y no se ofrece otra.
  expect(screen.getByRole("radio", { name: "cm" })).toBeChecked()
  expect(screen.queryByRole("radio", { name: "kg" })).toBeNull()
  await escribir("Nombre", "Brazo")
  await escribir("Zona (opcional)", "Zona B")
  await elegir("Derecha")
  await escribir("Instrumento (opcional)", "Cinta B")
  await pulsar("Añadir a la plantilla")

  expect(screen.getByText("Brazo")).toBeTruthy()
  expect(screen.getByText("Cambios sin guardar")).toBeTruthy()
  expect(screen.getByText("Nuevo, sin guardar")).toBeTruthy()
  await pulsar("Guardar plantilla")

  expect(guardar).toHaveBeenCalledTimes(1)
  expect(guardar).toHaveBeenCalledWith({
    revision: 3,
    corporales: [
      peso,
      cintura,
      {
        id: "30000000-0000-4000-8000-000000000001",
        version: 1,
        bloque: "medidas",
        magnitud: "perimetro",
        nombre: "Brazo",
        unidad: "cm",
        zona: "Zona B",
        lateralidad: "derecha",
        instrumento: "Cinta B",
        protocolo: null,
        activa: true,
      },
    ],
    pruebas: [],
  })
  expect(await screen.findByText("Guardado")).toBeTruthy()
  expect(screen.queryByText("Nuevo, sin guardar")).toBeNull()
})

it("solo ofrece las magnitudes y unidades del bloque y pide lo que falta", async () => {
  await montar()
  await pulsar("Añadir campo a Pliegues")
  expect(screen.getByRole("radio", { name: "Pliegue" })).toBeChecked()
  expect(screen.getByRole("radio", { name: "mm" })).toBeChecked()
  expect(screen.queryByRole("radio", { name: "Peso" })).toBeNull()

  await elegir("Bioimpedancia")
  expect(screen.queryByRole("radio", { name: "Pliegue" })).toBeNull()
  await elegir("Agua")
  // Agua admite tres unidades: ninguna se elige por el entrenador.
  for (const unidad of ["%", "l", "kg"])
    expect(screen.getByRole("radio", { name: unidad })).not.toBeChecked()
  await escribir("Nombre", "Agua corporal")
  await pulsar("Añadir a la plantilla")
  expect(screen.getByText("Elige la unidad.")).toBeTruthy()

  await elegir("%")
  await escribir("Nombre", " ")
  await pulsar("Añadir a la plantilla")
  expect(screen.getByText("Escribe el nombre.")).toBeTruthy()
})

it("renombrar conserva la versión y no avisa de otra serie", async () => {
  const { guardar } = await montar()
  await pulsar("Editar Cintura")
  await escribir("Nombre", "Perímetro de cintura")
  expect(screen.queryByText(AVISO)).toBeNull()
  await pulsar("Aplicar cambios")
  expect(screen.getByText("Perímetro de cintura")).toBeTruthy()
  expect(screen.queryByText(AVISO)).toBeNull()
  await pulsar("Guardar plantilla")

  expect(guardar).toHaveBeenCalledWith({
    revision: 3,
    corporales: [peso, { ...cintura, nombre: "Perímetro de cintura" }],
    pruebas: [],
  })
})

it("cambiar el instrumento sube una sola versión respecto a la guardada y lo avisa", async () => {
  const { guardar } = await montar()
  await pulsar("Editar Cintura")
  await escribir("Instrumento (opcional)", "Cinta C")
  expect(screen.getByText(AVISO)).toBeTruthy()
  await pulsar("Aplicar cambios")
  expect(screen.getByText(AVISO)).toBeTruthy()

  // Otro cambio sobre la misma edición no vuelve a subirla.
  await pulsar("Editar Cintura")
  await escribir("Instrumento (opcional)", "Cinta D")
  await pulsar("Aplicar cambios")
  await pulsar("Guardar plantilla")

  expect(guardar).toHaveBeenCalledWith({
    revision: 3,
    corporales: [peso, { ...cintura, instrumento: "Cinta D", version: 2 }],
    pruebas: [],
  })
  await screen.findByText("Guardado")
  // Ya es la versión guardada: el aviso desaparece.
  expect(screen.queryByText(AVISO)).toBeNull()
})

it("desactiva una definición guardada sin ofrecer quitarla y quita una nueva sin guardar", async () => {
  const { guardar } = await montar()
  expect(screen.queryByRole("button", { name: "Quitar Peso" })).toBeNull()
  await pulsar("Desactivar Peso")
  expect(screen.getByRole("button", { name: "Activar Peso" })).toBeTruthy()
  expect(screen.getByText("Desactivado: no se copiará a visitas nuevas")).toBeTruthy()

  await pulsar("Añadir campo a Pliegues")
  await escribir("Nombre", "Pliegue A")
  await elegir("Izquierda")
  await pulsar("Añadir a la plantilla")
  expect(screen.queryByRole("button", { name: "Desactivar Pliegue A (izquierda)" })).toBeNull()
  await pulsar("Quitar Pliegue A (izquierda)")
  expect(screen.queryByText("Pliegue A")).toBeNull()

  await pulsar("Guardar plantilla")
  expect(guardar).toHaveBeenCalledWith({
    revision: 3,
    corporales: [{ ...peso, activa: false }, cintura],
    pruebas: [],
  })
})

it("ordena dentro de cada bloque", async () => {
  const { guardar } = await montar()
  expect(screen.getByRole("button", { name: "Subir Peso" })).toBeDisabled()
  expect(screen.getByRole("button", { name: "Bajar Cintura" })).toBeDisabled()
  await pulsar("Subir Cintura")
  await pulsar("Guardar plantilla")
  expect(guardar).toHaveBeenCalledWith({ revision: 3, corporales: [cintura, peso], pruebas: [] })
})

it("añade Dominadas y Aguante en barra como definiciones distintas", async () => {
  const { guardar } = await montar()
  await pulsar("Añadir prueba")
  // Las cinco pruebas indicadas (dominadas y aguante como variantes) y la personalizada.
  expect(screen.getAllByRole("radio").map((r) => r.props.accessibilityLabel)).toEqual([
    "Dominadas",
    "Aguante en barra",
    "Flexiones 1 min",
    "Sentadillas 1 min",
    "Press banca 1RM",
    "Cooper",
    "Personalizada",
  ])
  await elegir("Dominadas")
  await escribir("Variante (opcional)", "Agarre A")
  await pulsar("Añadir a la plantilla")
  await pulsar("Añadir prueba")
  await elegir("Aguante en barra")
  await pulsar("Añadir a la plantilla")
  expect(screen.getByText("Dominadas")).toBeTruthy()
  expect(screen.getByText("Aguante en barra")).toBeTruthy()
  await pulsar("Guardar plantilla")

  expect(guardar).toHaveBeenCalledWith({
    revision: 3,
    corporales: [peso, cintura],
    pruebas: [
      crearPruebaEstandar("dominadas", "30000000-0000-4000-8000-000000000001", "Agarre A"),
      crearPruebaEstandar("suspension", "30000000-0000-4000-8000-000000000002"),
    ],
  })
})

it("añade una prueba personalizada con su métrica principal", async () => {
  const { guardar } = await montar()
  await pulsar("Añadir prueba")
  await elegir("Personalizada")
  await escribir("Nombre", "Prueba A")
  await escribir("Qué se anota (opcional)", "Alcance")
  await pulsar("Añadir a la plantilla")
  expect(screen.getByText("Elige la unidad.")).toBeTruthy()
  await elegir("cm")
  await pulsar("Añadir a la plantilla")
  await pulsar("Guardar plantilla")

  expect(guardar).toHaveBeenCalledWith({
    revision: 3,
    corporales: [peso, cintura],
    pruebas: [
      {
        id: "30000000-0000-4000-8000-000000000001",
        version: 1,
        tipo: "personalizada",
        nombre: "Prueba A",
        variante: null,
        protocolo: null,
        duracionPrescritaS: null,
        instrumento: null,
        metricas: [
          { clave: "resultado", nombre: "Alcance", unidad: "cm", principal: true, opcional: false },
        ],
        activa: true,
      },
    ],
  })
})

it("cambiar la variante de una prueba guardada sube su versión", async () => {
  const dominadas = crearPruebaEstandar("dominadas", "40000000-0000-4000-8000-000000000009")
  const { guardar } = await montar({ plantilla: { ...PLANTILLA, pruebas: [dominadas] } })
  await pulsar("Editar Dominadas")
  await escribir("Variante (opcional)", "Agarre B")
  expect(screen.getByText(AVISO)).toBeTruthy()
  await pulsar("Aplicar cambios")
  await pulsar("Guardar plantilla")
  expect(guardar).toHaveBeenCalledWith({
    ...PLANTILLA,
    pruebas: [{ ...dominadas, variante: "Agarre B", version: 2 }],
  })
})

/** Lo que no debe poder pulsarse mientras se guarda o se carga la versión guardada. */
const BLOQUEADOS = ["Activar Peso", "Añadir campo a Medidas", "Añadir prueba", "Cerrar"]

it("un guardado lento no se envía dos veces y bloquea la edición", async () => {
  let confirmar!: (valor: PlantillaValoracion) => void
  const guardar = jest.fn(
    (_datos: GuardarPlantillaValoracion) =>
      new Promise<PlantillaValoracion>((resolve) => {
        confirmar = resolve
      }),
  )
  const { cerrar } = await montar({ guardar })
  await pulsar("Desactivar Peso")
  await pulsar("Guardar plantilla")
  expect(screen.getByText("Guardando…")).toBeTruthy()
  // Nada se anuncia disponible sin serlo, y cerrar ahora perdería un fallo posterior.
  for (const nombre of BLOQUEADOS)
    expect(screen.getByRole("button", { name: nombre })).toBeDisabled()
  await pulsar("Cerrar")
  expect(cerrar).not.toHaveBeenCalled()
  await pulsar("Guardar plantilla")
  expect(guardar).toHaveBeenCalledTimes(1)

  await act(async () => confirmar({ ...guardar.mock.calls[0]![0], revision: 4 }))
  expect(screen.getByText("Guardado")).toBeTruthy()
  for (const nombre of BLOQUEADOS)
    expect(screen.getByRole("button", { name: nombre })).toBeEnabled()

  await pulsar("Activar Peso")
  await pulsar("Guardar plantilla")
  expect(guardar.mock.calls[1]![0].revision).toBe(4)
})

it("un fallo al guardar conserva la edición y permite reintentar", async () => {
  const guardar = jest.fn(
    async (_datos: GuardarPlantillaValoracion): Promise<PlantillaValoracion> => {
      throw new Error("sin conexión")
    },
  )
  await montar({ guardar })
  await pulsar("Editar Cintura")
  await escribir("Nombre", "Cintura media")
  await pulsar("Aplicar cambios")
  await pulsar("Guardar plantilla")

  expect(
    await screen.findByText("No se pudo guardar la plantilla. Tu edición sigue aquí."),
  ).toBeTruthy()
  expect(screen.getByText("Cintura media")).toBeTruthy()
  await pulsar("Guardar plantilla")
  expect(guardar).toHaveBeenCalledTimes(2)
  expect(guardar.mock.calls[1]![0]).toEqual(guardar.mock.calls[0]![0])
})

describe("conflicto de revisión", () => {
  const nuevaDelServidor: DefinicionCorporal = {
    ...peso,
    id: "40000000-0000-4000-8000-000000000003",
    magnitud: "altura",
    nombre: "Altura",
    unidad: "cm",
  }
  const delServidor: PlantillaValoracion = {
    revision: 5,
    corporales: [peso, { ...cintura, nombre: "Cintura servidor" }, nuevaDelServidor],
    pruebas: [],
  }
  const conConflicto = () =>
    jest
      .fn(async (datos: GuardarPlantillaValoracion) => ({ ...datos, revision: datos.revision + 1 }))
      .mockRejectedValueOnce(conflicto())

  it("conserva mi edición sobre la versión guardada y vuelve a guardar con su revisión", async () => {
    const guardar = conConflicto()
    const recargar = jest.fn(async () => delServidor)
    await montar({ guardar, recargar })
    await pulsar("Desactivar Peso")
    await pulsar("Guardar plantilla")
    expect(await screen.findByText("Otra edición se guardó antes")).toBeTruthy()
    expect(screen.queryByRole("button", { name: "Guardar plantilla" })).toBeNull()

    await pulsar("Conservar mi edición")
    expect(recargar).toHaveBeenCalledTimes(1)
    expect(await screen.findByText("Cambios sin guardar")).toBeTruthy()
    expect(screen.getByText("Cintura servidor")).toBeTruthy()
    await pulsar("Guardar plantilla")

    expect(guardar).toHaveBeenLastCalledWith({
      revision: 5,
      corporales: [
        { ...peso, activa: false },
        { ...cintura, nombre: "Cintura servidor" },
        nuevaDelServidor,
      ],
      pruebas: [],
    })
  })

  /** Guarda, choca con otra edición y conserva la mía sobre `servidor`. */
  async function montarYConservar(
    servidor: PlantillaValoracion,
    editar: () => Promise<void>,
    plantilla: PlantillaValoracion = PLANTILLA,
  ) {
    const guardar = conConflicto()
    await montar({ plantilla, guardar, recargar: async () => servidor })
    await editar()
    await pulsar("Guardar plantilla")
    await screen.findByText("Otra edición se guardó antes")
    await pulsar("Conservar mi edición")
    await screen.findByText("Cambios sin guardar")
    return guardar
  }

  it("solo desactivar no sube la versión ni pisa el instrumento que guardó la otra edición", async () => {
    const cinturaServidor = { ...cintura, instrumento: "Cinta B", version: 2 }
    const guardar = await montarYConservar(
      { revision: 5, corporales: [peso, cinturaServidor], pruebas: [] },
      () => pulsar("Desactivar Cintura"),
    )
    expect(screen.queryByText(AVISO)).toBeNull()
    await pulsar("Guardar plantilla")

    expect(guardar).toHaveBeenLastCalledWith({
      revision: 5,
      corporales: [peso, { ...cinturaServidor, activa: false }],
      pruebas: [],
    })
  })

  it("mi instrumento se versiona contra la guardada y conserva su nombre", async () => {
    const guardar = await montarYConservar(
      { revision: 5, corporales: [peso, { ...cintura, nombre: "Cintura servidor" }], pruebas: [] },
      async () => {
        await pulsar("Editar Cintura")
        await escribir("Instrumento (opcional)", "Cinta C")
        await pulsar("Aplicar cambios")
      },
    )
    expect(screen.getByText(AVISO)).toBeTruthy()
    await pulsar("Guardar plantilla")

    expect(guardar).toHaveBeenLastCalledWith({
      revision: 5,
      corporales: [
        peso,
        { ...cintura, nombre: "Cintura servidor", instrumento: "Cinta C", version: 2 },
      ],
      pruebas: [],
    })
  })

  it("en pruebas suma mi cambio al suyo y sube una versión sobre la suya", async () => {
    const dominadas = crearPruebaEstandar("dominadas", "40000000-0000-4000-8000-000000000009")
    const suya = { ...dominadas, variante: "Agarre S", version: 2 }
    const guardar = await montarYConservar(
      { revision: 5, corporales: [peso, cintura], pruebas: [suya] },
      async () => {
        await pulsar("Editar Dominadas")
        await escribir("Protocolo (opcional)", "Protocolo L")
        await pulsar("Aplicar cambios")
      },
      { ...PLANTILLA, pruebas: [dominadas] },
    )
    await pulsar("Guardar plantilla")

    expect(guardar).toHaveBeenLastCalledWith({
      revision: 5,
      corporales: [peso, cintura],
      pruebas: [{ ...suya, protocolo: "Protocolo L", version: 3 }],
    })
  })

  it("magnitud y unidad viajan juntas para no mezclar una combinación imposible", async () => {
    const agua: DefinicionCorporal = {
      ...peso,
      id: "40000000-0000-4000-8000-000000000004",
      bloque: "bioimpedancia",
      magnitud: "agua",
      nombre: "Agua",
      unidad: "%",
    }
    const guardar = await montarYConservar(
      { revision: 5, corporales: [{ ...agua, unidad: "l", version: 2 }], pruebas: [] },
      async () => {
        await pulsar("Editar Agua")
        await elegir("Grasa")
        await pulsar("Aplicar cambios")
      },
      { revision: 3, corporales: [agua], pruebas: [] },
    )
    await pulsar("Guardar plantilla")

    expect(guardar).toHaveBeenLastCalledWith({
      revision: 5,
      corporales: [{ ...agua, magnitud: "grasa", unidad: "%", version: 3 }],
      pruebas: [],
    })
  })

  it("carga la versión guardada y descarta la edición", async () => {
    const recargar = jest.fn(async () => delServidor)
    await montar({ guardar: conConflicto(), recargar })
    await pulsar("Desactivar Peso")
    await pulsar("Guardar plantilla")
    await pulsar("Cargar versión guardada")

    expect(await screen.findByText("Guardado")).toBeTruthy()
    expect(screen.getByRole("button", { name: "Desactivar Peso" })).toBeTruthy()
    expect(screen.getByText("Altura")).toBeTruthy()
  })

  it("mientras carga la versión guardada lo indica y no deja editar ni cerrar", async () => {
    let entregar!: (valor: PlantillaValoracion) => void
    const recargar = jest.fn(
      () =>
        new Promise<PlantillaValoracion>((resolve) => {
          entregar = resolve
        }),
    )
    const { cerrar } = await montar({ guardar: conConflicto(), recargar })
    await pulsar("Desactivar Peso")
    await pulsar("Guardar plantilla")
    await screen.findByText("Otra edición se guardó antes")
    await pulsar("Conservar mi edición")

    const conservar = screen.getByRole("button", { name: "Conservar mi edición" })
    expect(conservar).toBeBusy()
    expect(conservar).toBeDisabled()
    expect(screen.getByRole("button", { name: "Cargar versión guardada" })).toBeDisabled()
    for (const nombre of BLOQUEADOS)
      expect(screen.getByRole("button", { name: nombre })).toBeDisabled()
    await pulsar("Cerrar")
    await pulsar("Cargar versión guardada")
    expect(cerrar).not.toHaveBeenCalled()
    expect(recargar).toHaveBeenCalledTimes(1)

    await act(async () => entregar(delServidor))
    expect(screen.getByText("Cambios sin guardar")).toBeTruthy()
    for (const nombre of BLOQUEADOS)
      expect(screen.getByRole("button", { name: nombre })).toBeEnabled()
  })

  it("si no se puede cargar la versión guardada, avisa y deja reintentar", async () => {
    const recargar = jest
      .fn(async () => delServidor)
      .mockRejectedValueOnce(new Error("sin conexión"))
    await montar({ guardar: conConflicto(), recargar })
    await pulsar("Desactivar Peso")
    await pulsar("Guardar plantilla")
    await pulsar("Cargar versión guardada")

    expect(await screen.findByText("No se pudo cargar la versión guardada.")).toBeTruthy()
    expect(screen.getByText("Otra edición se guardó antes")).toBeTruthy()
    expect(screen.getByRole("button", { name: "Cargar versión guardada" })).toBeEnabled()
    expect(screen.getByRole("button", { name: "Activar Peso" })).toBeEnabled()
    await pulsar("Cargar versión guardada")
    expect(await screen.findByText("Guardado")).toBeTruthy()
    expect(recargar).toHaveBeenCalledTimes(2)
  })

  it("sin recarga no ofrece conservar la edición y cargar la guardada cierra", async () => {
    const { cerrar } = await montar({ guardar: conConflicto() })
    await pulsar("Desactivar Peso")
    await pulsar("Guardar plantilla")
    await screen.findByText("Otra edición se guardó antes")
    expect(screen.queryByRole("button", { name: "Conservar mi edición" })).toBeNull()
    await pulsar("Cargar versión guardada")
    expect(cerrar).toHaveBeenCalledTimes(1)
  })
})

it("Cerrar llama a cerrar", async () => {
  const { cerrar } = await montar()
  await pulsar("Cerrar")
  expect(cerrar).toHaveBeenCalledTimes(1)
})
