import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react-native"
import { AppState, StyleSheet } from "react-native"
import type {
  CambiarDia,
  ComidaRegistrada,
  DiaDeSeguimiento,
  DietaPublicada,
  DocumentoDieta,
} from "@alpha-omega/shared"
import type { AlmacenLocal } from "../entrenamiento/almacen-local"
import { ErrorDeRed, ErrorDeSesion, ErrorDelServidor } from "../lib/http"
import type { ApiNutricion } from "./api"
import { VistaDieta } from "./vista-dieta"
import type { ApiSeguimiento } from "../seguimiento/api"

function seguimientoEnMemoria() {
  let dia: DiaDeSeguimiento = {
    fecha: "2026-09-24",
    pesoKg: null,
    pasos: null,
    suenoMin: null,
    creatina: null,
    suplementos: [],
  }
  const falta = (): never => {
    throw new Error("no se usa")
  }
  return {
    dias: jest.fn(async () => ({ dias: [dia] })),
    cambiarDia: jest.fn(async (_id: string, _fecha: string, cambio: CambiarDia) => {
      dia = { ...dia, ...cambio }
      return dia
    }),
    configuracion: falta,
    guardarConfiguracion: falta,
    medidas: falta,
    registrarMedida: falta,
    pruebas: falta,
    registrarPrueba: falta,
    fuerza: falta,
    consentimiento: falta,
    borrarMedida: falta,
    borrarPrueba: falta,
  } satisfies ApiSeguimiento
}

jest.mock("../componentes/iconos", () => ({ Icono: () => null }))

jest.mock("expo-router", () => ({
  useFocusEffect: (efecto: () => void) =>
    jest.requireActual<typeof import("react")>("react").useEffect(efecto, [efecto]),
}))
jest.mock("../lib/direccion-api", () => ({ direccionDeLaApi: () => "http://localhost:3000" }))

const CUENTA = "30000000-0000-4000-8000-000000000000"
const ENTRENO = "00000000-0000-4000-8000-000000000001"
const DESCANSO = "00000000-0000-4000-8000-000000000002"

function documento(): DocumentoDieta {
  return {
    formato: 1,
    nombre: "Plan de octubre",
    tiposDeDia: [
      {
        id: ENTRENO,
        nombre: "Entreno",
        objetivo: { kcal: 2300, proteinaG: 160, hidratosG: null, grasaG: null },
        comidas: [
          {
            forma: "alternativas",
            id: "00000000-0000-4000-8000-000000000010",
            nombre: "Desayuno",
            hora: "08:00",
            indicacion: null,
            grupos: [
              {
                nombre: "Opciones dulces",
                alternativas: [
                  {
                    id: "00000000-0000-4000-8000-000000000020",
                    titulo: "Tostadas con fruta",
                    alimentos: [
                      { nombre: "Pan integral", cantidad: "60 g" },
                      { nombre: "Pieza de fruta", cantidad: null },
                    ],
                    nota: null,
                    macros: null,
                  },
                ],
              },
            ],
          },
          {
            forma: "intercambio",
            id: "00000000-0000-4000-8000-000000000011",
            nombre: "Comida",
            hora: null,
            indicacion: null,
            columnas: [
              { nombre: "Proteína", alimentos: [{ nombre: "Pollo", cantidad: "al gusto" }] },
            ],
          },
        ],
      },
      {
        id: DESCANSO,
        nombre: "Descanso",
        objetivo: { kcal: 2100, proteinaG: null, hidratosG: null, grasaG: null },
        comidas: [],
      },
    ],
    // Lunes a sábado entreno; domingo descanso.
    semana: [ENTRENO, ENTRENO, ENTRENO, ENTRENO, ENTRENO, ENTRENO, DESCANSO],
    indicaciones: [{ titulo: "Cómo seguir el plan", texto: "Pesa los alimentos en crudo." }],
  }
}

function publicada(): DietaPublicada {
  return {
    id: "40000000-0000-4000-8000-000000000000",
    clienteId: CUENTA,
    documento: documento(),
    publicadaEn: "2026-09-24T10:00:00.000Z",
  }
}

function almacenEnMemoria(): AlmacenLocal & { datos: Map<string, unknown> } {
  const datos = new Map<string, unknown>()
  return {
    datos,
    habilitar: () => undefined,
    leer: async (_cuenta, clave, esquema) =>
      datos.has(clave) ? esquema.parse(datos.get(clave)) : null,
    guardar: async (_cuenta, clave, valor) => {
      datos.set(clave, JSON.parse(JSON.stringify(valor)))
    },
    borrar: async (_cuenta, clave) => {
      datos.delete(clave)
    },
    listar: async () => [...datos.keys()],
    limpiar: async () => datos.clear(),
  }
}

function api(vigente: ApiNutricion["vigente"]): ApiNutricion {
  const falta = (): never => {
    throw new Error("no se usa")
  }
  return {
    vigente,
    borrador: falta,
    guardar: falta,
    publicar: falta,
    descartar: falta,
    historico: falta,
    delHistorico: falta,
    comidas: async () => ({ comidas: [] }),
    registrarComida: falta,
    quitarComida: falta,
  }
}

afterEach(() => {
  jest.useRealTimers()
})

it("prioriza las comidas y muestra los macros completos al abrir su detalle", async () => {
  jest.useFakeTimers()
  jest.setSystemTime(new Date("2026-09-21T08:30:00Z"))
  await render(
    <VistaDieta
      clienteId={CUENTA}
      cuenta={CUENTA}
      api={api(async () => ({ dieta: publicada(), deNutricionista: true }))}
      almacen={almacenEnMemoria()}
    />,
  )
  const detalle = await screen.findByRole("button", { name: "Ver objetivo nutricional" })
  expect(screen.getByRole("button", { name: /^Desayuno, ahora:/ })).toBeOnTheScreen()
  expect(screen.queryByText("kcal al día")).toBeNull()
  await fireEvent.press(detalle)
  expect(screen.getByText("2.300")).toBeOnTheScreen()
  expect(screen.getByText("160 g")).toBeOnTheScreen()
  expect(screen.getByText("kcal al día")).toBeOnTheScreen()
})

it("la tira de los siete días cabe en una pantalla de 360 px", async () => {
  await render(
    <VistaDieta
      clienteId={CUENTA}
      cuenta={CUENTA}
      api={api(async () => ({ dieta: publicada(), deNutricionista: true }))}
      almacen={almacenEnMemoria()}
    />,
  )
  await screen.findByRole("tab", { name: "Lunes: Entreno" })
  const dias = screen.getAllByRole("tab")
  expect(dias).toHaveLength(7)
  const anchoMinimo = dias.reduce(
    (ancho, dia) => ancho + (StyleSheet.flatten(dia.props.style).minWidth ?? 0),
    0,
  )
  let contenedor = dias[0]!.parent
  while (contenedor && !contenedor.props.contentContainerStyle) contenedor = contenedor.parent
  expect(contenedor).not.toBeNull()
  const separacion = StyleSheet.flatten(contenedor!.props.contentContainerStyle).gap ?? 0
  expect(anchoMinimo + 6 * separacion).toBeLessThanOrEqual(360 - 2 * 20)
})

it("sitúa la comida actual primero y distingue la siguiente antes de su hora", async () => {
  jest.useFakeTimers()
  const dieta = publicada()
  dieta.documento.tiposDeDia[0]!.comidas[1]!.hora = "12:00"
  const nutricion = api(async () => ({ dieta, deNutricionista: true }))
  const almacen = almacenEnMemoria()
  jest.setSystemTime(new Date("2026-09-21T11:00:00Z")) // 13:00 en Madrid
  const vista = await render(
    <VistaDieta clienteId={CUENTA} cuenta={CUENTA} api={nutricion} almacen={almacen} />,
  )
  await screen.findByRole("button", { name: /^Comida, ahora:/ })
  const comidas = screen
    .getAllByRole("button")
    .filter((b) => /^(Desayuno|Comida)/.test(b.props.accessibilityLabel ?? ""))
  expect(comidas.map((b) => b.props.accessibilityLabel)).toEqual([
    expect.stringMatching(/^Comida, ahora:/),
    expect.stringMatching(/^Desayuno:/),
  ])
  await vista.unmount()
  jest.setSystemTime(new Date("2026-09-21T04:00:00Z")) // 06:00 en Madrid
  await render(<VistaDieta clienteId={CUENTA} cuenta={CUENTA} api={nutricion} almacen={almacen} />)
  expect(await screen.findByRole("button", { name: /^Desayuno, siguiente:/ })).toBeOnTheScreen()
})

it("la respuesta de una recarga anterior no sustituye la más reciente", async () => {
  let actividad: ((estado: string) => void) | undefined
  const suscripcion = jest.mocked(AppState.addEventListener)
  const anterior = suscripcion.getMockImplementation()!
  suscripcion.mockImplementation(((_evento: string, listener: (estado: string) => void) => {
    actividad = listener
    return { remove: () => undefined }
  }) as typeof AppState.addEventListener)
  let resolverPrimera!: (valor: { dieta: DietaPublicada; deNutricionista: boolean }) => void
  const antigua = new Promise<{ dieta: DietaPublicada; deNutricionista: boolean }>((resolver) => {
    resolverPrimera = resolver
  })
  const vieja = publicada()
  vieja.documento.suplementos = [{ nombre: "Antiguo", dosis: null }]
  const nueva = publicada()
  nueva.documento.suplementos = [{ nombre: "Actual", dosis: null }]
  const vigente = jest
    .fn()
    .mockReturnValueOnce(antigua)
    .mockResolvedValueOnce({ dieta: nueva, deNutricionista: true })
  try {
    await render(
      <VistaDieta
        clienteId={CUENTA}
        cuenta={CUENTA}
        api={api(vigente)}
        almacen={almacenEnMemoria()}
      />,
    )
    await act(async () => actividad?.("active"))
    expect(await screen.findByText("Actual")).toBeOnTheScreen()
    await act(async () => resolverPrimera({ dieta: vieja, deNutricionista: true }))
    expect(screen.getByText("Actual")).toBeOnTheScreen()
    expect(screen.queryByText("Antiguo")).toBeNull()
  } finally {
    suscripcion.mockImplementation(anterior)
  }
})

it("al cambiar de cuenta no enseña la dieta anterior mientras carga la nueva", async () => {
  const almacen = almacenEnMemoria()
  const nutricion = api(
    jest
      .fn()
      .mockResolvedValueOnce({ dieta: publicada(), deNutricionista: true })
      .mockImplementationOnce(() => new Promise(() => undefined)),
  )
  const vista = await render(
    <VistaDieta clienteId={CUENTA} cuenta={CUENTA} api={nutricion} almacen={almacen} />,
  )
  expect(await screen.findByText("Dieta de tu nutricionista")).toBeOnTheScreen()
  await vista.rerender(
    <VistaDieta clienteId="otra" cuenta="otra" api={nutricion} almacen={almacen} />,
  )
  expect(screen.getByLabelText("Cargando dieta")).toBeOnTheScreen()
  expect(screen.queryByText("Dieta de tu nutricionista")).toBeNull()
})

it("«Hoy» sigue el día de Madrid al pasar de domingo a lunes", async () => {
  jest.useFakeTimers()
  const almacen = almacenEnMemoria()
  const vigente = jest.fn().mockResolvedValue({ dieta: publicada() })
  jest.setSystemTime(new Date("2026-09-20T21:59:58Z")) // domingo 23:59:58 en Madrid
  const domingo = await render(
    <VistaDieta clienteId={CUENTA} cuenta={CUENTA} api={api(vigente)} almacen={almacen} />,
  )
  // Un día sin comidas enseña el objetivo, como «Nutrición sin nutricionista».
  await fireEvent.press(await screen.findByRole("button", { name: "Ver objetivo nutricional" }))
  expect(await screen.findByText("2.100")).toBeOnTheScreen()
  expect(screen.getByText("kcal al día")).toBeOnTheScreen()
  expect(screen.queryByText(/Proteína/)).toBeNull()
  await domingo.unmount()

  jest.setSystemTime(new Date("2026-09-20T22:00:01Z")) // lunes 00:00:01 en Madrid
  await render(
    <VistaDieta clienteId={CUENTA} cuenta={CUENTA} api={api(vigente)} almacen={almacen} />,
  )
  expect(await screen.findByRole("tab", { name: "Lunes: Entreno" })).toBeSelected()
  expect(screen.getByText("0 de 2")).toBeOnTheScreen()
})

it("muestra alternativas, intercambio e indicaciones tal como se escribieron", async () => {
  jest.useFakeTimers()
  jest.setSystemTime(new Date("2026-09-21T08:00:00Z")) // lunes
  await render(
    <VistaDieta
      clienteId={CUENTA}
      cuenta={CUENTA}
      api={api(jest.fn().mockResolvedValue({ dieta: publicada() }))}
      almacen={almacenEnMemoria()}
    />,
  )
  await fireEvent.press(await screen.findByRole("button", { name: "Ver la semana completa" }))
  expect(await screen.findByText("2.300")).toBeOnTheScreen()
  expect(screen.getByText("160 g")).toBeOnTheScreen()
  expect(screen.getByText("Opciones dulces")).toBeOnTheScreen()
  expect(screen.getByText("60 g")).toBeOnTheScreen()
  expect(screen.getByText("Pieza de fruta")).toBeOnTheScreen()
  expect(screen.getByText("al gusto")).toBeOnTheScreen()
  expect(screen.getByText("Elige un alimento de cada grupo y combínalos.")).toBeOnTheScreen()
  expect(screen.getByRole("header", { name: "Cómo seguir el plan" })).toBeOnTheScreen()
})

it("sin dieta publicada lo dice en lugar de enseñar un ejemplo", async () => {
  await render(
    <VistaDieta
      clienteId={CUENTA}
      cuenta={CUENTA}
      api={api(jest.fn().mockResolvedValue({ dieta: null }))}
      almacen={almacenEnMemoria()}
    />,
  )
  expect(await screen.findByText(/Tu dieta aún no está publicada/)).toBeOnTheScreen()
})

it("muestra el esqueleto de objetivo y cinco comidas mientras llega la dieta", async () => {
  await render(
    <VistaDieta
      clienteId={CUENTA}
      cuenta={CUENTA}
      api={api(() => new Promise(() => undefined))}
      almacen={almacenEnMemoria()}
    />,
  )
  expect(screen.getByLabelText("Cargando dieta")).toBeOnTheScreen()
  expect(screen.getAllByTestId("esqueleto", { includeHiddenElements: true })).toHaveLength(6)
  expect(screen.queryByText("Cargando tu dieta…")).toBeNull()
})

it("enseña el objetivo junto a las comidas y permite consultar otro día sin registrarlo", async () => {
  jest.useFakeTimers()
  jest.setSystemTime(new Date("2026-09-21T08:00:00Z"))
  const dieta = publicada()
  dieta.documento.tiposDeDia[0]!.objetivo = {
    kcal: 2300,
    hidratosG: 288,
    proteinaG: 144,
    grasaG: 64,
  }
  dieta.documento.tiposDeDia[0]!.margenKcal = 100
  const vigente = jest.fn().mockResolvedValue({ dieta, deNutricionista: true })
  const registrarComida = jest.fn()
  await render(
    <VistaDieta
      clienteId={CUENTA}
      cuenta={CUENTA}
      api={{ ...api(vigente), registrarComida }}
      almacen={almacenEnMemoria()}
    />,
  )
  await fireEvent.press(await screen.findByRole("button", { name: "Ver objetivo nutricional" }))
  expect(await screen.findByText("2.300")).toBeOnTheScreen()
  expect(screen.getByText("kcal al día · entre 2.200 y 2.400")).toBeOnTheScreen()
  expect(screen.getByText("Carbohidratos")).toBeOnTheScreen()
  expect(screen.getByText("Proteínas")).toBeOnTheScreen()
  expect(screen.getByText("Grasas")).toBeOnTheScreen()
  expect(screen.getByText("50 %")).toBeOnTheScreen()
  expect(screen.getAllByText("25 %")).toHaveLength(2)
  expect(screen.getByRole("button", { name: /^Desayuno/ })).toBeOnTheScreen()
  expect(screen.getByRole("tab", { name: "Lunes: Entreno" })).toBeSelected()
  await fireEvent.press(screen.getByRole("tab", { name: "Domingo: Descanso" }))
  expect(screen.getByText("2.100")).toBeOnTheScreen()
  expect(screen.getByRole("tab", { name: "Domingo: Descanso" })).toBeSelected()
  expect(screen.queryByRole("progressbar", { name: "Comidas hechas" })).toBeNull()
  expect(registrarComida).not.toHaveBeenCalled()
  expect(vigente).toHaveBeenCalledTimes(1)
  await fireEvent.press(screen.getByRole("tab", { name: "Lunes: Entreno" }))
  expect(screen.getByText("0 de 2")).toBeOnTheScreen()
})

it("sin conexión enseña la última copia y, si no hay, pide conexión", async () => {
  jest.useFakeTimers()
  jest.setSystemTime(new Date("2026-09-24T10:30:00Z")) // jueves con comidas, tras la publicación
  const almacen = almacenEnMemoria()
  const vigente = jest.fn().mockResolvedValueOnce({ dieta: publicada(), deNutricionista: true })
  const primera = await render(
    <VistaDieta clienteId={CUENTA} cuenta={CUENTA} api={api(vigente)} almacen={almacen} />,
  )
  expect(await screen.findByText("Dieta de tu nutricionista")).toBeOnTheScreen()
  await primera.unmount()
  expect(almacen.datos.has("dieta-vigente")).toBe(true)

  vigente.mockRejectedValue(new ErrorDeRed("Sin red"))
  const sinRed = await render(
    <VistaDieta clienteId={CUENTA} cuenta={CUENTA} api={api(vigente)} almacen={almacen} />,
  )
  expect(await screen.findByText(/Sin conexión · copia del/)).toBeOnTheScreen()
  expect(screen.getByText("Dieta de tu nutricionista")).toBeOnTheScreen()
  // Sin conexión se ve la dieta y se puede consultar el plato; no se marca desde el resumen.
  expect(screen.getByRole("button", { name: /^Desayuno: / })).toBeOnTheScreen()
  expect(screen.queryByRole("checkbox", { name: "Comida hecha: Desayuno" })).toBeNull()
  await sinRed.unmount()

  await render(
    <VistaDieta
      clienteId={CUENTA}
      cuenta={CUENTA}
      api={api(vigente)}
      almacen={almacenEnMemoria()}
    />,
  )
  expect(await screen.findByText(/Necesitas conexión para descargar tu dieta/)).toBeOnTheScreen()
})

it("sin registros de comidas no presenta un progreso de cero", async () => {
  jest.useFakeTimers()
  jest.setSystemTime(new Date("2026-09-24T10:30:00Z"))
  await render(
    <VistaDieta
      clienteId={CUENTA}
      cuenta={CUENTA}
      api={{
        ...api(async () => ({ dieta: publicada(), deNutricionista: true })),
        comidas: async () => {
          throw new ErrorDeRed("Sin red")
        },
      }}
      almacen={almacenEnMemoria()}
    />,
  )
  expect(await screen.findByText("Registro de comidas no disponible")).toBeOnTheScreen()
  expect(screen.queryByText("0 de 2")).toBeNull()
  expect(screen.queryByRole("progressbar", { name: "Comidas hechas" })).toBeNull()
  expect(screen.getByRole("button", { name: /^Desayuno: / })).toBeOnTheScreen()
})

it("una copia antigua sin autor lo presenta como profesional", async () => {
  const almacen = almacenEnMemoria()
  almacen.datos.set("dieta-vigente", { dieta: publicada(), actualizadaEn: "2026-09-24T10:30:00Z" })
  await render(
    <VistaDieta
      clienteId={CUENTA}
      cuenta={CUENTA}
      api={api(async () => {
        throw new ErrorDeRed("Sin red")
      })}
      almacen={almacen}
    />,
  )
  expect(await screen.findByText("Dieta de tu profesional")).toBeOnTheScreen()
})

function registradaHecha(comidaId: string, dietaId = publicada().id): ComidaRegistrada {
  return {
    fecha: "2026-09-21",
    comidaId,
    dietaId,
    eleccion: { tipo: "hecha" },
    registradaEn: "2026-09-21T08:31:00.000Z",
  }
}
const DESAYUNO = "00000000-0000-4000-8000-000000000010"

describe("casilla de la comida (N1)", () => {
  beforeEach(() => {
    jest.useFakeTimers()
    jest.setSystemTime(new Date("2026-09-21T08:30:00Z")) // lunes 10:30 en Madrid
  })

  it("marca la comida como hecha con un toque, sin elegir plato, y permite deshacer", async () => {
    const registrarComida = jest.fn(async () => registradaHecha(DESAYUNO))
    const quitarComida = jest.fn(async () => undefined)
    const abrirComida = jest.fn()
    await render(
      <VistaDieta
        clienteId={CUENTA}
        cuenta={CUENTA}
        api={{
          ...api(jest.fn().mockResolvedValue({ dieta: publicada(), deNutricionista: true })),
          registrarComida,
          quitarComida,
        }}
        almacen={almacenEnMemoria()}
        abrirComida={abrirComida}
      />,
    )
    const casilla = await screen.findByRole("checkbox", { name: "Comida hecha: Desayuno" })
    expect(casilla).not.toBeChecked()
    expect(screen.getByText("0 de 2")).toBeOnTheScreen()
    await fireEvent.press(casilla)
    expect(registrarComida).toHaveBeenCalledWith(CUENTA, "2026-09-21", DESAYUNO, {
      dietaId: publicada().id,
      eleccion: { tipo: "hecha" },
    })
    expect(abrirComida).not.toHaveBeenCalled()
    expect(await screen.findByText("1 de 2")).toBeOnTheScreen()
    expect(screen.getByRole("checkbox", { name: "Comida hecha: Desayuno" })).toBeChecked()
    // La fila anuncia que está hecha y la confirmación está junto a la lista.
    expect(screen.getByRole("button", { name: "Desayuno, hecha" })).toBeOnTheScreen()
    expect(screen.getByText("Registrada: Desayuno")).toBeOnTheScreen()
    await fireEvent.press(screen.getByRole("button", { name: "Deshacer Desayuno" }))
    expect(quitarComida).toHaveBeenCalledWith(CUENTA, "2026-09-21", DESAYUNO)
    await waitFor(() => expect(screen.getByText("0 de 2")).toBeOnTheScreen())
    expect(screen.queryByText("Registrada: Desayuno")).toBeNull()
    expect(screen.getByRole("checkbox", { name: "Comida hecha: Desayuno" })).not.toBeChecked()
  })

  it("tocar una comida ya hecha la quita; entrar a elegir plato sigue abriendo la comida", async () => {
    const quitarComida = jest.fn(async () => undefined)
    const registrarComida = jest.fn()
    const abrirComida = jest.fn()
    await render(
      <VistaDieta
        clienteId={CUENTA}
        cuenta={CUENTA}
        api={{
          ...api(jest.fn().mockResolvedValue({ dieta: publicada(), deNutricionista: true })),
          comidas: async () => ({ comidas: [registradaHecha(DESAYUNO)] }),
          registrarComida,
          quitarComida,
        }}
        almacen={almacenEnMemoria()}
        abrirComida={abrirComida}
      />,
    )
    const casilla = await screen.findByRole("checkbox", { name: "Comida hecha: Desayuno" })
    await waitFor(() => expect(casilla).toBeChecked())
    await fireEvent.press(screen.getByRole("button", { name: "Desayuno, hecha" }))
    expect(abrirComida).toHaveBeenCalledWith(documento().tiposDeDia[0]?.comidas[0])
    await fireEvent.press(casilla)
    expect(quitarComida).toHaveBeenCalledTimes(1)
    expect(registrarComida).not.toHaveBeenCalled()
    await waitFor(() => expect(screen.getByText("0 de 2")).toBeOnTheScreen())
  })

  it("si falla el guardado la casilla no queda marcada y lo dice", async () => {
    await render(
      <VistaDieta
        clienteId={CUENTA}
        cuenta={CUENTA}
        api={{
          ...api(jest.fn().mockResolvedValue({ dieta: publicada(), deNutricionista: true })),
          registrarComida: async () => {
            throw new ErrorDeRed("Sin red")
          },
        }}
        almacen={almacenEnMemoria()}
        abrirComida={jest.fn()}
      />,
    )
    await fireEvent.press(await screen.findByRole("checkbox", { name: "Comida hecha: Desayuno" }))
    expect(await screen.findByRole("alert")).toBeOnTheScreen()
    expect(screen.getByRole("checkbox", { name: "Comida hecha: Desayuno" })).not.toBeChecked()
    expect(screen.getByText("0 de 2")).toBeOnTheScreen()
    expect(screen.getByRole("checkbox", { name: "Comida hecha: Desayuno" })).toBeEnabled()
  })

  it("con el registro desactivado la casilla solo informa: ni se pulsa ni se anuncia como control", async () => {
    const dieta = publicada()
    dieta.documento.registroComidas = false
    const registrarComida = jest.fn()
    await render(
      <VistaDieta
        clienteId={CUENTA}
        cuenta={CUENTA}
        api={{
          ...api(jest.fn().mockResolvedValue({ dieta, deNutricionista: true })),
          registrarComida,
        }}
        almacen={almacenEnMemoria()}
        abrirComida={jest.fn()}
      />,
    )
    expect(await screen.findByRole("button", { name: /^Desayuno, ahora: / })).toBeOnTheScreen()
    expect(screen.queryByRole("checkbox", { name: "Comida hecha: Desayuno" })).toBeNull()
    expect(registrarComida).not.toHaveBeenCalled()
  })
})

describe("día elegido y vuelta (N5)", () => {
  it("«Ver la semana completa» abre la semana en el día elegido y volver conserva ese día", async () => {
    jest.useFakeTimers()
    jest.setSystemTime(new Date("2026-09-21T08:00:00Z")) // lunes
    await render(
      <VistaDieta
        clienteId={CUENTA}
        cuenta={CUENTA}
        api={api(jest.fn().mockResolvedValue({ dieta: publicada(), deNutricionista: true }))}
        almacen={almacenEnMemoria()}
      />,
    )
    await fireEvent.press(await screen.findByRole("tab", { name: "Domingo: Descanso" }))
    await fireEvent.press(screen.getByRole("button", { name: "Ver la semana completa" }))
    expect(screen.getByRole("header", { name: "Domingo · Descanso" })).toBeOnTheScreen()
    expect(screen.getAllByRole("tab", { name: "Domingo: Descanso" })[0]).toBeSelected()
    await fireEvent.press(screen.getByRole("button", { name: "Volver a Nutrición" }))
    expect(screen.getByRole("tab", { name: "Domingo: Descanso" })).toBeSelected()
    expect(screen.queryByRole("button", { name: "Volver a Nutrición" })).toBeNull()
  })
})

it("el tipo de día de la tira se lee a 12 px o más", async () => {
  await render(
    <VistaDieta
      clienteId={CUENTA}
      cuenta={CUENTA}
      api={api(async () => ({ dieta: publicada(), deNutricionista: true }))}
      almacen={almacenEnMemoria()}
    />,
  )
  const lunes = await screen.findByRole("tab", { name: "Lunes: Entreno" })
  const tipo = within(lunes).getByText("Entreno")
  expect(StyleSheet.flatten(tipo.props.style).fontSize).toBeGreaterThanOrEqual(12)
})

it("bloquea todos los suplementos hasta confirmar y conserva las dos tomas sucesivas", async () => {
  const seguimiento = seguimientoEnMemoria()
  const dieta = publicada()
  dieta.documento.suplementos = [
    { nombre: "Vitamina D", dosis: null },
    { nombre: "Omega 3", dosis: null },
  ]
  let terminar!: () => void
  const pendiente = new Promise<void>((resolve) => {
    terminar = resolve
  })
  const guardar = seguimiento.cambiarDia.getMockImplementation()!
  seguimiento.cambiarDia.mockImplementationOnce(async (...args) => {
    await pendiente
    return guardar(...args)
  })
  await render(
    <VistaDieta
      clienteId={CUENTA}
      cuenta={CUENTA}
      api={api(async () => ({ dieta, deNutricionista: false }))}
      almacen={almacenEnMemoria()}
      seguimiento={seguimiento}
    />,
  )
  await fireEvent.press(await screen.findByRole("checkbox", { name: "Vitamina D" }))
  expect(screen.getByRole("checkbox", { name: "Omega 3" })).toBeDisabled()
  expect(screen.getByRole("checkbox", { name: "Vitamina D" })).not.toBeChecked()
  await fireEvent.press(screen.getByRole("checkbox", { name: "Omega 3" }))
  expect(seguimiento.cambiarDia).toHaveBeenCalledTimes(1)
  await act(async () => terminar())
  await fireEvent.press(screen.getByRole("checkbox", { name: "Omega 3" }))
  expect(screen.getByRole("checkbox", { name: "Vitamina D" })).toBeChecked()
  expect(screen.getByRole("checkbox", { name: "Omega 3" })).toBeChecked()
  expect(seguimiento.cambiarDia).toHaveBeenLastCalledWith(CUENTA, expect.any(String), {
    suplementos: ["Vitamina D", "Omega 3"],
  })
})

it("mantiene el nombre y la dosis larga del suplemento en el mismo ancho disponible", async () => {
  const seguimiento = seguimientoEnMemoria()
  const dieta = publicada()
  const dosis = "3–5 g diarios; también en descanso"
  dieta.documento.suplementos = [{ nombre: "Creatina monohidrato", dosis }]
  await render(
    <VistaDieta
      clienteId={CUENTA}
      cuenta={CUENTA}
      api={api(async () => ({ dieta, deNutricionista: false }))}
      almacen={almacenEnMemoria()}
      seguimiento={seguimiento}
    />,
  )
  const fila = await screen.findByRole("checkbox", { name: "Creatina monohidrato" })
  const nombre = screen.getByText("Creatina monohidrato")
  const detalle = screen.getByText(dosis)
  // La dosis continúa debajo del nombre: no le roba el ancho como otra columna.
  expect(detalle.parent === nombre.parent).toBe(true)
  expect(StyleSheet.flatten(detalle.parent!.props.style)).toMatchObject({ flex: 1, minWidth: 0 })
  expect(StyleSheet.flatten(detalle.parent!.props.style).flexDirection ?? "column").toBe("column")
  expect(nombre).toHaveStyle({ fontSize: 16 })
  expect(detalle).toHaveStyle({ fontSize: 13 })
  expect(detalle.props.numberOfLines).toBeUndefined()
  expect(StyleSheet.flatten(fila.props.style).minHeight).toBeGreaterThanOrEqual(44)
  await fireEvent.press(detalle)
  expect(screen.getByRole("checkbox", { name: "Creatina monohidrato" })).toBeChecked()
  expect(seguimiento.cambiarDia).toHaveBeenLastCalledWith(CUENTA, expect.any(String), {
    creatina: true,
  })
})

it("una recarga anterior al guardado no borra suplementos ya confirmados", async () => {
  const seguimiento = seguimientoEnMemoria()
  const anterior = await seguimiento.dias()
  let terminarLectura!: () => void
  seguimiento.dias
    .mockClear()
    .mockResolvedValueOnce(anterior)
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          terminarLectura = () => resolve(anterior)
        }),
    )
  const dieta = publicada()
  dieta.documento.suplementos = [
    { nombre: "Vitamina D", dosis: null },
    { nombre: "Omega 3", dosis: null },
  ]
  const nutricion = api(async () => ({ dieta, deNutricionista: false }))
  const almacen = almacenEnMemoria()
  const vista = await render(
    <VistaDieta
      clienteId={CUENTA}
      cuenta={CUENTA}
      api={nutricion}
      almacen={almacen}
      seguimiento={seguimiento}
    />,
  )
  await screen.findByRole("checkbox", { name: "Vitamina D" })
  await vista.rerender(
    <VistaDieta
      clienteId={CUENTA}
      cuenta={CUENTA}
      api={nutricion}
      almacen={almacen}
      seguimiento={{ ...seguimiento }}
    />,
  )
  expect(seguimiento.dias).toHaveBeenCalledTimes(2)
  await fireEvent.press(screen.getByRole("checkbox", { name: "Vitamina D" }))
  expect(screen.getByRole("checkbox", { name: "Vitamina D" })).toBeChecked()

  await act(async () => terminarLectura())
  expect(screen.getByRole("checkbox", { name: "Vitamina D" })).toBeChecked()
  await fireEvent.press(screen.getByRole("checkbox", { name: "Omega 3" }))
  expect(seguimiento.cambiarDia).toHaveBeenLastCalledWith(CUENTA, expect.any(String), {
    suplementos: ["Vitamina D", "Omega 3"],
  })
})

it("un error al guardar suplementos deja reintentar sin mostrarlos como tomados", async () => {
  const seguimiento = seguimientoEnMemoria()
  seguimiento.cambiarDia.mockRejectedValueOnce(new Error("Sin conexión"))
  const dieta = publicada()
  dieta.documento.suplementos = [{ nombre: "Vitamina D", dosis: null }]
  await render(
    <VistaDieta
      clienteId={CUENTA}
      cuenta={CUENTA}
      api={api(async () => ({ dieta, deNutricionista: false }))}
      almacen={almacenEnMemoria()}
      seguimiento={seguimiento}
    />,
  )
  await fireEvent.press(await screen.findByRole("checkbox", { name: "Vitamina D" }))
  expect(screen.getByRole("checkbox", { name: "Vitamina D" })).not.toBeChecked()
  expect(screen.getByRole("checkbox", { name: "Vitamina D" })).toBeEnabled()
  await fireEvent.press(screen.getByRole("checkbox", { name: "Vitamina D" }))
  expect(screen.getByRole("checkbox", { name: "Vitamina D" })).toBeChecked()
})

it("espera el registro del día antes de habilitar las tomas", async () => {
  const seguimiento = seguimientoEnMemoria()
  await seguimiento.cambiarDia(CUENTA, "2026-09-24", { suplementos: ["Vitamina D"] })
  let terminar!: () => void
  const pendiente = new Promise<void>((resolve) => {
    terminar = resolve
  })
  const leer = seguimiento.dias.getMockImplementation()!
  seguimiento.dias.mockImplementationOnce(async () => {
    await pendiente
    return leer()
  })
  const dieta = publicada()
  dieta.documento.suplementos = [
    { nombre: "Vitamina D", dosis: null },
    { nombre: "Omega 3", dosis: null },
  ]
  await render(
    <VistaDieta
      clienteId={CUENTA}
      cuenta={CUENTA}
      api={api(async () => ({ dieta, deNutricionista: false }))}
      almacen={almacenEnMemoria()}
      seguimiento={seguimiento}
    />,
  )
  expect(await screen.findByLabelText("Omega 3: registro no disponible")).toBeOnTheScreen()
  expect(screen.queryByRole("checkbox", { name: "Omega 3" })).toBeNull()
  await act(async () => terminar())
  expect(screen.getByRole("checkbox", { name: "Vitamina D" })).toBeChecked()
  await fireEvent.press(screen.getByRole("checkbox", { name: "Omega 3" }))
  expect(screen.getByRole("checkbox", { name: "Vitamina D" })).toBeChecked()
  expect(screen.getByRole("checkbox", { name: "Omega 3" })).toBeChecked()
})

it("limpia el error de lectura al volver a cargar correctamente", async () => {
  const seguimiento = seguimientoEnMemoria()
  seguimiento.dias.mockRejectedValueOnce(new Error("Sin red"))
  const dieta = publicada()
  dieta.documento.suplementos = [{ nombre: "Vitamina D", dosis: null }]
  const nutricion = api(async () => ({ dieta, deNutricionista: false }))
  const almacen = almacenEnMemoria()
  const vista = await render(
    <VistaDieta
      clienteId={CUENTA}
      cuenta={CUENTA}
      api={nutricion}
      almacen={almacen}
      seguimiento={seguimiento}
    />,
  )
  expect(
    await screen.findByText("No se pudieron cargar los registros de hoy. Revisa la conexión."),
  ).toBeTruthy()
  expect(screen.queryByRole("checkbox", { name: "Vitamina D" })).toBeNull()
  expect(screen.getByLabelText("Vitamina D: registro no disponible")).toBeOnTheScreen()
  await vista.rerender(
    <VistaDieta
      clienteId={CUENTA}
      cuenta={CUENTA}
      api={nutricion}
      almacen={almacen}
      seguimiento={{ ...seguimiento }}
    />,
  )
  expect(screen.getByRole("checkbox", { name: "Vitamina D" })).toBeEnabled()
  expect(
    screen.queryByText("No se pudieron cargar los registros de hoy. Revisa la conexión."),
  ).toBeNull()
})

describe("fallos que no son de red (N-05, N-06)", () => {
  const conCopia = async () => {
    const almacen = almacenEnMemoria()
    const vigente = jest.fn().mockResolvedValueOnce({ dieta: publicada(), deNutricionista: true })
    const primera = await render(
      <VistaDieta clienteId={CUENTA} cuenta={CUENTA} api={api(vigente)} almacen={almacen} />,
    )
    await screen.findByText("Dieta de tu nutricionista")
    await primera.unmount()
    return { almacen, vigente }
  }

  it("un error del servidor también enseña la copia descargada, no «No hemos podido cargar»", async () => {
    const { almacen, vigente } = await conCopia()
    vigente.mockRejectedValue(new ErrorDelServidor(503))
    await render(
      <VistaDieta clienteId={CUENTA} cuenta={CUENTA} api={api(vigente)} almacen={almacen} />,
    )
    expect(await screen.findByText(/Sin conexión · copia del/)).toBeOnTheScreen()
    expect(screen.getByText("Dieta de tu nutricionista")).toBeOnTheScreen()
    expect(screen.queryByText("No hemos podido cargar tu dieta.")).toBeNull()
  })

  it("una sesión caducada no enseña la copia: es otro problema", async () => {
    const { almacen, vigente } = await conCopia()
    vigente.mockRejectedValue(new ErrorDeSesion("caducada"))
    await render(
      <VistaDieta clienteId={CUENTA} cuenta={CUENTA} api={api(vigente)} almacen={almacen} />,
    )
    expect(await screen.findByText("No hemos podido cargar tu dieta.")).toBeOnTheScreen()
  })

  it("al recargar no deja los suplementos sin registro mientras llega la respuesta", async () => {
    const seguimiento = seguimientoEnMemoria()
    const dieta = publicada()
    dieta.documento.suplementos = [{ nombre: "Vitamina D", dosis: null }]
    const nutricion = api(async () => ({ dieta, deNutricionista: false }))
    const almacen = almacenEnMemoria()
    const vista = await render(
      <VistaDieta
        clienteId={CUENTA}
        cuenta={CUENTA}
        api={nutricion}
        almacen={almacen}
        seguimiento={seguimiento}
      />,
    )
    expect(await screen.findByRole("checkbox", { name: "Vitamina D" })).toBeEnabled()

    seguimiento.dias.mockImplementationOnce(() => new Promise(() => undefined))
    await vista.rerender(
      <VistaDieta
        clienteId={CUENTA}
        cuenta={CUENTA}
        api={nutricion}
        almacen={almacen}
        seguimiento={{ ...seguimiento }}
      />,
    )
    expect(screen.getByRole("checkbox", { name: "Vitamina D" })).toBeEnabled()
  })
})
