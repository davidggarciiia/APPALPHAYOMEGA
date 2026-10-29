import { act, fireEvent, render, screen } from "@testing-library/react-native"
import type {
  CambiarDia,
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

it("«Hoy» sigue el día de Madrid al pasar de domingo a lunes", async () => {
  jest.useFakeTimers()
  const almacen = almacenEnMemoria()
  const vigente = jest.fn().mockResolvedValue({ dieta: publicada() })
  jest.setSystemTime(new Date("2026-09-20T21:59:58Z")) // domingo 23:59:58 en Madrid
  const domingo = await render(
    <VistaDieta clienteId={CUENTA} cuenta={CUENTA} api={api(vigente)} almacen={almacen} />,
  )
  // Un día sin comidas enseña el objetivo, como «Nutrición sin nutricionista».
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
  expect(screen.queryByRole("checkbox", { name: "Desayuno hecha" })).toBeNull()
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

it("abre la elección de comida sin registrarla desde el círculo del resumen", async () => {
  jest.useFakeTimers()
  jest.setSystemTime(new Date("2026-09-21T08:30:00Z")) // lunes 10:30 en Madrid
  const registrarComida = jest.fn()
  const abrirComida = jest.fn()
  await render(
    <VistaDieta
      clienteId={CUENTA}
      cuenta={CUENTA}
      api={{
        ...api(jest.fn().mockResolvedValue({ dieta: publicada(), deNutricionista: true })),
        registrarComida,
      }}
      almacen={almacenEnMemoria()}
      abrirComida={abrirComida}
    />,
  )
  expect(await screen.findByText("Dieta de tu nutricionista")).toBeOnTheScreen()
  expect(screen.getByRole("button", { name: /^Desayuno, ahora: / })).toBeOnTheScreen()
  expect(screen.queryByRole("checkbox", { name: "Desayuno hecha" })).toBeNull()
  await fireEvent.press(screen.getByRole("button", { name: /^Desayuno, ahora: / }))
  expect(abrirComida).toHaveBeenCalledWith(documento().tiposDeDia[0]?.comidas[0])
  expect(registrarComida).not.toHaveBeenCalled()
  expect(screen.getByText("0 de 2")).toBeOnTheScreen()
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
  await fireEvent.press(await screen.findByRole("checkbox", { name: "Vitamina D tomada" }))
  expect(screen.getByRole("checkbox", { name: "Omega 3 tomada" })).toBeDisabled()
  expect(screen.getByRole("checkbox", { name: "Vitamina D tomada" })).not.toBeChecked()
  await fireEvent.press(screen.getByRole("checkbox", { name: "Omega 3 tomada" }))
  expect(seguimiento.cambiarDia).toHaveBeenCalledTimes(1)
  await act(async () => terminar())
  await fireEvent.press(screen.getByRole("checkbox", { name: "Omega 3 tomada" }))
  expect(screen.getByRole("checkbox", { name: "Vitamina D tomada" })).toBeChecked()
  expect(screen.getByRole("checkbox", { name: "Omega 3 tomada" })).toBeChecked()
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
  await fireEvent.press(await screen.findByRole("checkbox", { name: "Vitamina D tomada" }))
  expect(screen.getByRole("checkbox", { name: "Vitamina D tomada" })).not.toBeChecked()
  expect(screen.getByRole("checkbox", { name: "Vitamina D tomada" })).toBeEnabled()
  await fireEvent.press(screen.getByRole("checkbox", { name: "Vitamina D tomada" }))
  expect(screen.getByRole("checkbox", { name: "Vitamina D tomada" })).toBeChecked()
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
  expect(screen.queryByRole("checkbox", { name: "Omega 3 tomada" })).toBeNull()
  await act(async () => terminar())
  expect(screen.getByRole("checkbox", { name: "Vitamina D tomada" })).toBeChecked()
  await fireEvent.press(screen.getByRole("checkbox", { name: "Omega 3 tomada" }))
  expect(screen.getByRole("checkbox", { name: "Vitamina D tomada" })).toBeChecked()
  expect(screen.getByRole("checkbox", { name: "Omega 3 tomada" })).toBeChecked()
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
  expect(screen.queryByRole("checkbox", { name: "Vitamina D tomada" })).toBeNull()
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
  expect(screen.getByRole("checkbox", { name: "Vitamina D tomada" })).toBeEnabled()
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
    expect(await screen.findByRole("checkbox", { name: "Vitamina D tomada" })).toBeEnabled()

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
    expect(screen.getByRole("checkbox", { name: "Vitamina D tomada" })).toBeEnabled()
  })
})
