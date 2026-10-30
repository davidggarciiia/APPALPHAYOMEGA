import { AppState } from "react-native"
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native"
import type { ApiEntrenamiento } from "./api"
import type { ListadoSesiones, SesionCliente } from "@alpha-omega/shared"
import { ErrorDePermiso, ErrorDePeticion, ErrorDeSesion, ErrorDelServidor } from "../lib/http"
import { SemanaEntrenamiento } from "./semana"
import { crearApiEntrenamiento } from "./api"
import { crearPeticionAutenticada } from "../lib/peticion-autenticada"
import { fechaLegible, hoyAgenda, lunesDeSemana, sumarDias } from "./fechas"
import { AgendaSemanal } from "./agenda-semanal"
import { almacenDispositivo } from "./almacen-dispositivo"

let mockVisita = 0
jest.mock("expo-router", () => ({
  useFocusEffect: (efecto: () => void) =>
    jest.requireActual<typeof import("react")>("react").useEffect(efecto, [efecto, mockVisita]),
}))
jest.mock("./almacen-dispositivo", () => ({
  almacenDispositivo: { leer: jest.fn(), guardar: jest.fn() },
}))
jest.mock("../lib/direccion-api", () => ({ direccionDeLaApi: () => "http://localhost:3000" }))
jest.mock("../componentes/iconos", () => ({ Icono: () => null }))
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}))

beforeEach(() => {
  mockVisita = 0
  AppState.currentState = "active"
  ;(almacenDispositivo.leer as jest.Mock).mockReset().mockResolvedValue(null)
  ;(almacenDispositivo.guardar as jest.Mock).mockReset().mockResolvedValue(undefined)
})

function listadoDePrueba(nombre = "Fuerza guardada", fecha = lunesDeSemana()) {
  return {
    sesiones: [
      {
        agenda: {
          id: "10000000-0000-4000-8000-000000000000",
          clienteId: "cliente",
          fechaOriginal: fecha,
          fechaActual: fecha,
          estado: "abierta" as const,
          revision: 0,
        },
        nombre,
        enviadoEn: null,
      },
    ],
    total: 1,
  }
}

it("muestra la copia local sin esperar a que responda la red", async () => {
  const listado = listadoDePrueba()
  ;(almacenDispositivo.leer as jest.Mock).mockResolvedValue(listado)
  const api = { semana: jest.fn(() => new Promise(() => undefined)) } as unknown as ApiEntrenamiento
  await render(<SemanaEntrenamiento clienteId="cliente" api={api} abrir={jest.fn()} copiaLocal />)
  expect(await screen.findByText("Fuerza guardada")).toBeOnTheScreen()
  expect(screen.queryByRole("progressbar", { name: "Cargando entrenamientos" })).toBeNull()
  expect(api.semana).toHaveBeenCalledTimes(1)
})

it("conserva la lista al volver a enfocar mientras actualiza", async () => {
  const api = {
    semana: jest
      .fn()
      .mockResolvedValueOnce(listadoDePrueba())
      .mockImplementation(() => new Promise(() => undefined)),
  } as unknown as ApiEntrenamiento
  const abrir = jest.fn()
  const vista = await render(
    <SemanaEntrenamiento clienteId="cliente" api={api} abrir={abrir} copiaLocal />,
  )
  await screen.findByText("Fuerza guardada")
  mockVisita++
  await vista.rerender(
    <SemanaEntrenamiento clienteId="cliente" api={api} abrir={abrir} copiaLocal />,
  )
  expect(screen.getByText("Fuerza guardada")).toBeOnTheScreen()
  expect(screen.queryByRole("progressbar", { name: "Cargando entrenamientos" })).toBeNull()
})

it("sondea al cliente cada 15 segundos y no vuelve a cifrar ni leer documentos iguales", async () => {
  jest.useFakeTimers()
  const listado = listadoDePrueba()
  ;(almacenDispositivo.leer as jest.Mock).mockImplementation(async (_cuenta, clave) =>
    clave.startsWith("semana-") ? listado : null,
  )
  const api = {
    semana: jest.fn().mockResolvedValue(listado),
    leerCliente: jest.fn().mockResolvedValue({ borrador: null }),
  } as unknown as ApiEntrenamiento
  const vista = await render(
    <SemanaEntrenamiento
      clienteId="cliente"
      api={api}
      abrir={jest.fn()}
      copiaLocal
      detectarEmpezadas
    />,
  )
  const lecturas = (almacenDispositivo.leer as jest.Mock).mock.calls.length
  expect(almacenDispositivo.guardar).not.toHaveBeenCalled()
  await act(async () => {
    await jest.advanceTimersByTimeAsync(14_999)
  })
  expect(api.semana).toHaveBeenCalledTimes(1)
  await act(async () => {
    await jest.advanceTimersByTimeAsync(1)
  })
  expect(api.semana).toHaveBeenCalledTimes(2)
  expect(almacenDispositivo.leer).toHaveBeenCalledTimes(lecturas)
  expect(almacenDispositivo.guardar).not.toHaveBeenCalled()
  const nuevos = listadoDePrueba("Fuerza actualizada")
  ;(api.semana as jest.Mock).mockResolvedValue(nuevos)
  await act(async () => {
    await jest.advanceTimersByTimeAsync(15_000)
  })
  expect(screen.getByText("Fuerza actualizada")).toBeOnTheScreen()
  expect(almacenDispositivo.guardar).toHaveBeenCalledTimes(1)
  expect(almacenDispositivo.guardar).toHaveBeenCalledWith(
    "cliente",
    `semana-${lunesDeSemana()}`,
    nuevos,
  )
  await vista.unmount()
  jest.useRealTimers()
})

it("no presenta datos de otra semana mientras carga la elegida", async () => {
  const api = {
    semana: jest
      .fn()
      .mockResolvedValueOnce(listadoDePrueba())
      .mockImplementation(() => new Promise(() => undefined)),
  } as unknown as ApiEntrenamiento
  await render(<SemanaEntrenamiento clienteId="cliente" api={api} abrir={jest.fn()} copiaLocal />)
  await screen.findByText("Fuerza guardada")
  await fireEvent.press(screen.getByRole("button", { name: "Semana siguiente" }))
  expect(screen.queryByText("Fuerza guardada")).toBeNull()
  expect(screen.getByRole("progressbar", { name: "Cargando entrenamientos" })).toBeOnTheScreen()
  expect(screen.getAllByTestId("esqueleto", { includeHiddenElements: true })).toHaveLength(5)
})

it.each([new ErrorDelServidor(503), new SyntaxError("Respuesta inválida")])(
  "conserva la copia ante un error de servidor o respuesta: %s",
  async (error) => {
    ;(almacenDispositivo.leer as jest.Mock).mockResolvedValue(listadoDePrueba())
    const api = { semana: jest.fn().mockRejectedValue(error) } as unknown as ApiEntrenamiento
    await render(<SemanaEntrenamiento clienteId="cliente" api={api} abrir={jest.fn()} copiaLocal />)
    expect(await screen.findByText("Fuerza guardada")).toBeOnTheScreen()
    expect(
      await screen.findByText(
        "No se pudo actualizar la semana. Revisa la conexión y vuelve a intentarlo.",
      ),
    ).toBeOnTheScreen()
  },
)

it.each([new ErrorDeSesion(), new ErrorDePermiso()])(
  "retira la copia si la sesión o los permisos se rechazan: %s",
  async (error) => {
    ;(almacenDispositivo.leer as jest.Mock).mockResolvedValue(listadoDePrueba())
    const api = { semana: jest.fn().mockRejectedValue(error) } as unknown as ApiEntrenamiento
    await render(<SemanaEntrenamiento clienteId="cliente" api={api} abrir={jest.fn()} copiaLocal />)
    expect(screen.queryByText("Fuerza guardada")).toBeNull()
    expect(screen.queryByRole("button", { name: "Reintentar" })).toBeNull()
    expect(
      screen.getByText(
        error instanceof ErrorDeSesion
          ? "Tu sesión ha caducado. Vuelve a entrar."
          : "No tienes permiso para acceder a estos datos.",
      ),
    ).toBeOnTheScreen()
  },
)

it("muestra la respuesta de red aunque falle el guardado de la copia", async () => {
  ;(almacenDispositivo.guardar as jest.Mock).mockRejectedValue(new Error("Disco lleno"))
  const api = {
    semana: jest.fn().mockResolvedValue(listadoDePrueba("Fuerza de red")),
  } as unknown as ApiEntrenamiento
  await render(<SemanaEntrenamiento clienteId="cliente" api={api} abrir={jest.fn()} copiaLocal />)
  expect(await screen.findByText("Fuerza de red")).toBeOnTheScreen()
  expect(screen.queryByRole("button", { name: "Reintentar" })).toBeNull()
})

it("prioriza la sesión empezada más reciente aunque no sea la de hoy", async () => {
  AppState.currentState = "active"
  const lunes = lunesDeSemana()
  const hoy = hoyAgenda()
  const resumen = (id: string, fecha: string) => ({
    agenda: {
      id,
      clienteId: "cliente",
      fechaOriginal: fecha,
      fechaActual: fecha,
      estado: "abierta" as const,
      revision: 0,
    },
    nombre: id,
    enviadoEn: null,
  })
  const sesiones = [
    resumen("antigua", lunes),
    resumen("reciente", sumarDias(lunes, 1)),
    resumen("hoy", hoy),
  ]
  const api = {
    semana: jest.fn(async () => ({ sesiones, total: sesiones.length })),
    leerCliente: jest.fn(
      async (id: string) =>
        ({
          borrador:
            id === "hoy"
              ? null
              : {
                  actualizadoEn:
                    id === "reciente" ? "2026-09-24T11:00:00.000Z" : "2026-09-22T11:00:00.000Z",
                  registro: {
                    checkin: { sensacion: 4, molestia: "nada" },
                    series: [],
                    notas: null,
                  },
                },
        }) as unknown as SesionCliente,
    ),
  } as unknown as ApiEntrenamiento
  await render(<SemanaEntrenamiento clienteId="cliente" api={api} abrir={jest.fn()} resumenHoy />)
  expect(await screen.findByRole("button", { name: "Continuar reciente" })).toBeOnTheScreen()
  expect(screen.queryByRole("button", { name: "Empezar hoy" })).toBeNull()
})

it("el calendario también reconoce una sesión en curso por su borrador", async () => {
  AppState.currentState = "active"
  const lunes = lunesDeSemana()
  const api = {
    semana: jest.fn(async () => ({
      sesiones: [
        {
          agenda: {
            id: "en-curso",
            clienteId: "cliente",
            fechaOriginal: lunes,
            fechaActual: lunes,
            estado: "abierta" as const,
            revision: 1,
          },
          nombre: "Fuerza",
          enviadoEn: null,
        },
      ],
      total: 1,
    })),
    leerCliente: jest.fn(
      async () =>
        ({
          borrador: {
            actualizadoEn: "2026-09-24T10:00:00.000Z",
            registro: { inicio: "2026-09-24T09:00:00.000Z", series: [], notas: null },
          },
        }) as unknown as SesionCliente,
    ),
  } as unknown as ApiEntrenamiento
  await render(
    <SemanaEntrenamiento clienteId="cliente" api={api} abrir={jest.fn()} detectarEmpezadas />,
  )
  expect(
    await screen.findByRole("button", {
      name: `Continuar Fuerza, ${fechaLegible(lunes)}, en curso`,
    }),
  ).toBeOnTheScreen()
})

it("marca continuar con el documento local si la semana se carga sin red", async () => {
  AppState.currentState = "active"
  const lunes = lunesDeSemana()
  const sesion = {
    agenda: {
      id: "10000000-0000-4000-8000-000000000000",
      clienteId: "cliente",
      fechaOriginal: lunes,
      fechaActual: lunes,
      estado: "abierta" as const,
      revision: 0,
    },
    nombre: "Fuerza local",
    enviadoEn: null,
  }
  const leer = almacenDispositivo.leer as jest.Mock
  leer.mockImplementation(async (_cuenta: string, clave: string) =>
    clave === `semana-${lunes}`
      ? { sesiones: [sesion], total: 1 }
      : clave === `sesion-${sesion.agenda.id}`
        ? {
            sesion: { borrador: null },
            edicion: {
              inicio: "2026-09-24T09:00:00.000Z",
              checkin: null,
              series: [],
            },
          }
        : null,
  )
  const api = {
    semana: jest.fn(async () => {
      throw new Error("Sin conexión")
    }),
  } as unknown as ApiEntrenamiento

  await render(
    <SemanaEntrenamiento
      clienteId="cliente"
      api={api}
      abrir={jest.fn()}
      copiaLocal
      detectarEmpezadas
    />,
  )

  expect(
    await screen.findByRole("button", {
      name: `Continuar Fuerza local, ${fechaLegible(lunes)}, en curso`,
    }),
  ).toBeOnTheScreen()
  expect(leer).toHaveBeenCalledWith("cliente", `sesion-${sesion.agenda.id}`, expect.anything())
})

it("conserva el estado local empezado aunque el borrador remoto esté vacío", async () => {
  AppState.currentState = "active"
  const lunes = lunesDeSemana()
  const sesion = {
    agenda: {
      id: "10000000-0000-4000-8000-000000000001",
      clienteId: "cliente",
      fechaOriginal: lunes,
      fechaActual: lunes,
      estado: "abierta" as const,
      revision: 0,
    },
    nombre: "Fuerza pendiente de sincronizar",
    enviadoEn: null,
  }
  ;(almacenDispositivo.leer as jest.Mock).mockImplementation(async (_cuenta, clave) =>
    clave.startsWith("semana-")
      ? null
      : {
          sesion: { borrador: null },
          edicion: { inicio: null, checkin: { sensacion: 4 }, series: [] },
        },
  )
  const api = {
    semana: jest.fn(async () => ({ sesiones: [sesion], total: 1 })),
    leerCliente: jest.fn(async () => ({ borrador: null }) as unknown as SesionCliente),
  } as unknown as ApiEntrenamiento

  await render(
    <SemanaEntrenamiento
      clienteId="cliente"
      api={api}
      abrir={jest.fn()}
      copiaLocal
      detectarEmpezadas
    />,
  )

  expect(
    await screen.findByRole("button", {
      name: `Continuar Fuerza pendiente de sincronizar, ${fechaLegible(lunes)}, en curso`,
    }),
  ).toBeOnTheScreen()
})

it("cambia el día desde la agenda con la revisión vigente", async () => {
  AppState.currentState = "active"
  const lunes = lunesDeSemana()
  const martes = sumarDias(lunes, 1)
  let agenda = {
    id: "sesion",
    clienteId: "cliente",
    fechaOriginal: lunes,
    fechaActual: lunes,
    estado: "abierta" as const,
    revision: 2,
  }
  const mover = jest.fn(async (_id: string, datos: { fecha: string; revision: number }) => {
    agenda = { ...agenda, fechaActual: datos.fecha, revision: agenda.revision + 1 }
    return agenda
  })
  const api = {
    semana: jest.fn(async () => ({
      sesiones: [{ agenda, nombre: "Fuerza", enviadoEn: null }],
      total: 1,
    })),
    mover,
    cambios: jest.fn(async () => ({ cambios: [], total: 0 })),
  } as unknown as ApiEntrenamiento
  await render(<SemanaEntrenamiento clienteId="cliente" api={api} abrir={jest.fn()} />)
  await fireEvent.press(await screen.findByRole("button", { name: "Cambiar día de Fuerza" }))
  await fireEvent.press(screen.getByRole("button", { name: fechaLegible(martes) }))
  expect(mover).toHaveBeenCalledWith("sesion", { fecha: martes, revision: 2 })
  expect(
    await screen.findByRole("button", {
      name: `Empezar Fuerza, ${fechaLegible(martes)}, pendiente`,
    }),
  ).toBeOnTheScreen()
})

it("conserva la fecha y revisión del movimiento si falla el refresco, incluso al reabrir la hoja", async () => {
  const lunes = lunesDeSemana()
  const martes = sumarDias(lunes, 1)
  const miercoles = sumarDias(lunes, 2)
  const agenda = {
    id: "sesion",
    clienteId: "cliente",
    fechaOriginal: lunes,
    fechaActual: lunes,
    estado: "abierta" as const,
    revision: 2,
  }
  const mover = jest.fn(async (_id: string, datos: { fecha: string; revision: number }) => ({
    ...agenda,
    fechaActual: datos.fecha,
    revision: datos.revision + 1,
  }))
  const semana = jest
    .fn()
    .mockResolvedValueOnce({
      sesiones: [{ agenda, nombre: "Fuerza", enviadoEn: null }],
      total: 1,
    })
    .mockRejectedValue(new Error("Sin conexión"))
  const api = {
    semana,
    mover,
    cambios: jest.fn(async () => ({ cambios: [], total: 0 })),
  } as unknown as ApiEntrenamiento
  await render(<SemanaEntrenamiento clienteId="cliente" api={api} abrir={jest.fn()} />)
  await fireEvent.press(await screen.findByRole("button", { name: "Cambiar día de Fuerza" }))
  await fireEvent.press(screen.getByRole("button", { name: fechaLegible(martes) }))
  expect(await screen.findByText("Día cambiado; no se pudo refrescar la semana.")).toBeOnTheScreen()
  expect(semana).toHaveBeenCalledTimes(2)

  await fireEvent.press(screen.getByRole("button", { name: "Cerrar" }))
  await waitFor(() =>
    expect(
      screen.queryByText("Día cambiado; no se pudo refrescar la semana.", {
        includeHiddenElements: true,
      }),
    ).toBeNull(),
  )
  expect(
    await screen.findByRole("button", {
      name: `Empezar Fuerza, ${fechaLegible(martes)}, pendiente`,
    }),
  ).toBeOnTheScreen()
  await fireEvent.press(screen.getByRole("button", { name: "Cambiar día de Fuerza" }))
  await fireEvent.press(screen.getByRole("button", { name: fechaLegible(miercoles) }))
  expect(mover).toHaveBeenLastCalledWith("sesion", { fecha: miercoles, revision: 3 })
  expect(mover).toHaveBeenCalledTimes(2)
})

it("no retrocede la agenda ni su copia si un sondeo antiguo responde después del movimiento", async () => {
  jest.useFakeTimers()
  try {
    const lunes = lunesDeSemana()
    const martes = sumarDias(lunes, 1)
    const miercoles = sumarDias(lunes, 2)
    const listado = listadoDePrueba("Fuerza", lunes)
    const sesion = listado.sesiones[0]!
    sesion.agenda.revision = 2
    const movida = { ...sesion.agenda, fechaActual: martes, revision: 3 }
    let resolverSondeo!: (datos: ListadoSesiones) => void
    const sondeo = new Promise<ListadoSesiones>((resolver) => {
      resolverSondeo = resolver
    })
    const semana = jest
      .fn()
      .mockResolvedValueOnce(listado)
      .mockReturnValueOnce(sondeo)
      .mockRejectedValue(new Error("Sin conexión"))
    const mover = jest.fn(async (_id: string, datos: { fecha: string; revision: number }) => ({
      ...sesion.agenda,
      fechaActual: datos.fecha,
      revision: datos.revision + 1,
    }))
    const api = {
      semana,
      mover,
      cambios: jest.fn(async () => ({ cambios: [], total: 0 })),
    } as unknown as ApiEntrenamiento
    const vista = await render(
      <SemanaEntrenamiento clienteId="cliente" api={api} abrir={jest.fn()} copiaLocal />,
    )
    await screen.findByText("Fuerza")
    await act(async () => jest.advanceTimersByTimeAsync(15_000))
    expect(semana).toHaveBeenCalledTimes(2)
    await fireEvent.press(screen.getByRole("button", { name: "Cambiar día de Fuerza" }))
    await fireEvent.press(screen.getByRole("button", { name: fechaLegible(martes) }))
    expect(
      await screen.findByText("Día cambiado; no se pudo refrescar la semana."),
    ).toBeOnTheScreen()
    expect(semana).toHaveBeenCalledTimes(3)
    await act(async () => resolverSondeo(listado))

    expect(almacenDispositivo.guardar).toHaveBeenLastCalledWith("cliente", `semana-${lunes}`, {
      ...listado,
      sesiones: [{ ...sesion, agenda: movida }],
    })
    await fireEvent.press(screen.getByRole("button", { name: "Cerrar" }))
    await act(async () => jest.advanceTimersByTimeAsync(200))
    expect(
      screen.getByRole("button", { name: `Empezar Fuerza, ${fechaLegible(martes)}, pendiente` }),
    ).toBeOnTheScreen()
    await fireEvent.press(screen.getByRole("button", { name: "Cambiar día de Fuerza" }))
    await fireEvent.press(screen.getByRole("button", { name: fechaLegible(miercoles) }))
    expect(mover).toHaveBeenLastCalledWith(sesion.agenda.id, { fecha: miercoles, revision: 3 })
    await vista.unmount()
  } finally {
    jest.useRealTimers()
  }
})

it("ante conflicto actualiza la revisión y deja reintentar el cambio", async () => {
  AppState.currentState = "active"
  const lunes = lunesDeSemana()
  const miercoles = sumarDias(lunes, 2)
  let revision = 2
  const mover = jest.fn(async (_id: string, datos: { fecha: string; revision: number }) => {
    if (datos.revision === 2) {
      revision = 3
      throw new ErrorDePeticion({
        statusCode: 409,
        codigo: "revision_obsoleta",
        message: "Conflicto",
      })
    }
    revision = 4
    return {
      id: "sesion",
      clienteId: "cliente",
      fechaOriginal: lunes,
      fechaActual: datos.fecha,
      estado: "abierta" as const,
      revision,
    }
  })
  const api = {
    semana: jest.fn(async () => ({
      sesiones: [
        {
          agenda: {
            id: "sesion",
            clienteId: "cliente",
            fechaOriginal: lunes,
            fechaActual: lunes,
            estado: "abierta" as const,
            revision,
          },
          nombre: "Fuerza",
          enviadoEn: null,
        },
      ],
      total: 1,
    })),
    mover,
    cambios: jest.fn(async () => ({ cambios: [], total: 0 })),
  } as unknown as ApiEntrenamiento
  await render(<SemanaEntrenamiento clienteId="cliente" api={api} abrir={jest.fn()} />)
  await fireEvent.press(await screen.findByRole("button", { name: "Cambiar día de Fuerza" }))
  await fireEvent.press(screen.getByRole("button", { name: fechaLegible(miercoles) }))
  expect(
    await screen.findByText("No se pudo cambiar el día. Actualiza la sesión antes de reintentar."),
  ).toBeOnTheScreen()
  await fireEvent.press(screen.getByRole("button", { name: fechaLegible(miercoles) }))
  expect(mover).toHaveBeenLastCalledWith("sesion", { fecha: miercoles, revision: 3 })
})

it("en el inicio marca fuerza y otro deporte, y tocar el día abre su sesión pendiente", async () => {
  const lunes = lunesDeSemana()
  const agenda = {
    clienteId: "cliente",
    fechaOriginal: lunes,
    fechaActual: lunes,
    estado: "abierta" as const,
    revision: 0,
  }
  const abrir = jest.fn()
  await render(
    <AgendaSemanal
      semana={lunes}
      resumenHoy
      cambiarSemana={jest.fn()}
      abrir={abrir}
      deportes={[{ nombre: "K-1", dias: [1], minutos: 60 }]}
      listado={{
        total: 2,
        sesiones: [
          { agenda: { ...agenda, id: "pendiente" }, nombre: "Sesión pendiente", enviadoEn: null },
          {
            agenda: { ...agenda, id: "enviado", estado: "cerrada" },
            nombre: "Sesión enviada",
            enviadoEn: "2026-09-14T10:00:00Z",
          },
        ],
      }}
    />,
  )
  expect(screen.queryByRole("header", { name: "Esta semana" })).toBeNull()
  expect(screen.queryByText("Otro deporte")).toBeNull()
  expect(screen.queryByText("Últimos entrenos de la semana")).toBeNull()
  await fireEvent.press(
    screen.getByRole("button", {
      name: new RegExp(`^${fechaLegible(lunes)}.*: Sesión pendiente, Sesión enviada, hecha, K-1$`),
    }),
  )
  expect(abrir).toHaveBeenCalledWith("pendiente")
})

it("la agenda distingue continuar una sesión empezada y ver el resumen enviado", async () => {
  const lunes = lunesDeSemana()
  const agenda = {
    clienteId: "cliente",
    fechaOriginal: lunes,
    fechaActual: lunes,
    estado: "abierta" as const,
    revision: 0,
  }
  await render(
    <AgendaSemanal
      semana={lunes}
      listado={{
        total: 2,
        sesiones: [
          { agenda: { ...agenda, id: "en-curso" }, nombre: "Fuerza", enviadoEn: null },
          {
            agenda: { ...agenda, id: "hecha", estado: "cerrada" },
            nombre: "Carrera",
            enviadoEn: "2026-09-24T10:00:00.000Z",
          },
        ],
      }}
      empezadas={{ "en-curso": "2026-09-24T09:00:00.000Z" }}
      cambiarSemana={jest.fn()}
      abrir={jest.fn()}
      resumenHoy={false}
    />,
  )
  expect(
    screen.getByRole("button", { name: `Continuar Fuerza, ${fechaLegible(lunes)}, en curso` }),
  ).toBeOnTheScreen()
  expect(
    screen.getByRole("button", { name: `Ver resumen de Carrera, ${fechaLegible(lunes)}, enviado` }),
  ).toBeOnTheScreen()
})

it.each([0, 1, 2])("anuncia el número de sesiones del día con su plural: %i", async (cantidad) => {
  const lunes = lunesDeSemana()
  const sesion = listadoDePrueba().sesiones[0]!
  await render(
    <AgendaSemanal
      semana={lunes}
      listado={{
        total: cantidad,
        sesiones: Array.from({ length: cantidad }, (_, n) => ({
          ...sesion,
          agenda: { ...sesion.agenda, id: `sesion-${n}` },
        })),
      }}
      cambiarSemana={jest.fn()}
      abrir={jest.fn()}
      resumenHoy
    />,
  )
  expect(screen.getByLabelText(new RegExp(`^${fechaLegible(lunes)}`)).props.accessibilityHint).toBe(
    `${cantidad} ${cantidad === 1 ? "sesión" : "sesiones"}`,
  )
})

it("lista por la fecha actual, abre la sesión y cambia de semana sin conservar filas anteriores", async () => {
  AppState.currentState = "active"
  const lunes = lunesDeSemana()
  const martes = sumarDias(lunes, 1)
  const api = crearApiEntrenamiento(crearPeticionAutenticada(() => "token"))
  const abrir = jest.fn()
  const consultar = jest.spyOn(api, "semana").mockResolvedValue({
    sesiones: [
      {
        agenda: {
          id: "10000000-0000-4000-8000-000000000000",
          clienteId: "20000000-0000-4000-8000-000000000000",
          fechaOriginal: lunes,
          fechaActual: martes,
          estado: "abierta",
          revision: 1,
        },
        nombre: "Fuerza",
        enviadoEn: null,
      },
    ],
    total: 1,
  })
  await render(<SemanaEntrenamiento clienteId="cliente" api={api} abrir={abrir} />)
  await screen.findByRole("button", { name: `Empezar Fuerza, ${fechaLegible(martes)}, pendiente` })
  expect(screen.getByText(`Movido desde ${fechaLegible(lunes)}`)).toBeOnTheScreen()
  expect(
    screen.queryByRole("button", { name: `Empezar Fuerza, ${fechaLegible(lunes)}, pendiente` }),
  ).toBeNull()
  await fireEvent.press(
    screen.getByRole("button", { name: `Empezar Fuerza, ${fechaLegible(martes)}, pendiente` }),
  )
  expect(abrir).toHaveBeenCalledWith("10000000-0000-4000-8000-000000000000")
  consultar.mockResolvedValue({ sesiones: [], total: 0 })
  await fireEvent.press(screen.getByRole("button", { name: "Semana siguiente" }))
  expect(await screen.findByText("Sin entrenamientos esta semana")).toBeOnTheScreen()
  expect(
    screen.queryByRole("button", { name: `Empezar Fuerza, ${fechaLegible(martes)}, pendiente` }),
  ).toBeNull()
})

it.each([
  {
    hoy: "2027-02-17",
    semanas: ["2027-02-01", "2027-02-08", "2027-02-15", "2027-02-22"],
  },
  {
    hoy: "2026-10-14",
    semanas: ["2026-09-28", "2026-10-05", "2026-10-12", "2026-10-19", "2026-10-26"],
  },
  {
    hoy: "2026-03-18",
    semanas: ["2026-02-23", "2026-03-02", "2026-03-09", "2026-03-16", "2026-03-23", "2026-03-30"],
  },
])(
  "Ver mes consulta todas sus semanas y abre una sesión ajena a la actual: $hoy",
  async ({ hoy, semanas }) => {
    jest.useFakeTimers()
    jest.setSystemTime(new Date(`${hoy}T12:00:00Z`))
    let vista: Awaited<ReturnType<typeof render>> | undefined
    try {
      const fecha = `${hoy.slice(0, 7)}-01`
      const sesion = listadoDePrueba("Sesión de otra semana", fecha)
      const consultar = jest.fn(async (_clienteId: string, lunes: string) =>
        lunes === semanas[0] ? sesion : { sesiones: [], total: 0 },
      )
      const api = {
        semana: consultar,
        leerCliente: jest.fn(async () => ({ borrador: null })),
      } as unknown as ApiEntrenamiento
      const abrir = jest.fn()
      vista = await render(
        <SemanaEntrenamiento clienteId="cliente" api={api} abrir={abrir} resumenHoy />,
      )
      expect(consultar).toHaveBeenCalledWith("cliente", lunesDeSemana(hoy), expect.any(AbortSignal))
      consultar.mockClear()

      await fireEvent.press(screen.getByRole("button", { name: "Ver mes" }))
      const dia = await screen.findByRole("button", {
        name: `${fechaLegible(fecha)}: Sesión de otra semana, pendiente`,
      })
      expect(consultar.mock.calls).toEqual(semanas.map((lunes) => ["cliente", lunes]))
      await fireEvent.press(dia)
      expect(abrir).toHaveBeenCalledWith(sesion.sesiones[0]!.agenda.id)
    } finally {
      await vista?.unmount()
      jest.useRealTimers()
    }
  },
)

it("si falla una semana del mes muestra el error y permite reintentar sin inventar días vacíos", async () => {
  jest.useFakeTimers()
  jest.setSystemTime(new Date("2026-10-14T12:00:00Z"))
  let vista: Awaited<ReturnType<typeof render>> | undefined
  try {
    const sesion = listadoDePrueba("Fuerza del mes", "2026-10-01")
    let fallar = true
    const consultar = jest.fn(async (_clienteId: string, lunes: string) => {
      if (lunes === "2026-10-19" && fallar) throw new ErrorDelServidor(503)
      return lunes === "2026-09-28" ? sesion : { sesiones: [], total: 0 }
    })
    const api = {
      semana: consultar,
      leerCliente: jest.fn(async () => ({ borrador: null })),
    } as unknown as ApiEntrenamiento
    const abrir = jest.fn()
    vista = await render(
      <SemanaEntrenamiento clienteId="cliente" api={api} abrir={abrir} resumenHoy />,
    )

    await fireEvent.press(screen.getByRole("button", { name: "Ver mes" }))
    expect(await screen.findByText("No se pudo cargar el mes.")).toBeOnTheScreen()
    expect(screen.queryByRole("button", { name: /^jueves, 1 oct/ })).toBeNull()
    expect(abrir).not.toHaveBeenCalled()

    fallar = false
    consultar.mockClear()
    await fireEvent.press(screen.getByRole("button", { name: "Reintentar mes" }))
    expect(
      await screen.findByRole("button", {
        name: `${fechaLegible("2026-10-01")}: Fuerza del mes, pendiente`,
      }),
    ).toBeOnTheScreen()
    expect(consultar.mock.calls).toEqual(
      ["2026-09-28", "2026-10-05", "2026-10-12", "2026-10-19", "2026-10-26"].map((lunes) => [
        "cliente",
        lunes,
      ]),
    )
    expect(screen.queryByText("No se pudo cargar el mes.")).toBeNull()
  } finally {
    await vista?.unmount()
    jest.useRealTimers()
  }
})

it("el mes reconoce en curso una sesión de otra semana con inicio en el borrador", async () => {
  jest.useFakeTimers()
  jest.setSystemTime(new Date("2026-10-14T12:00:00Z"))
  let vista: Awaited<ReturnType<typeof render>> | undefined
  try {
    const sesion = listadoDePrueba("Fuerza empezada", "2026-10-01")
    const leerCliente = jest.fn(async () => ({
      borrador: {
        actualizadoEn: "2026-10-01T10:30:00.000Z",
        registro: {
          inicio: "2026-10-01T10:00:00.000Z",
          checkin: null,
          series: [],
          notas: null,
        },
      },
    }))
    const api = {
      semana: jest.fn(async (_clienteId: string, lunes: string) =>
        lunes === "2026-09-28" ? sesion : { sesiones: [], total: 0 },
      ),
      leerCliente,
    } as unknown as ApiEntrenamiento
    const abrir = jest.fn()
    vista = await render(
      <SemanaEntrenamiento clienteId="cliente" api={api} abrir={abrir} resumenHoy />,
    )

    await fireEvent.press(screen.getByRole("button", { name: "Ver mes" }))
    const dia = await screen.findByRole("button", {
      name: `${fechaLegible("2026-10-01")}: Fuerza empezada, en curso`,
    })
    expect(leerCliente).toHaveBeenCalledWith(sesion.sesiones[0]!.agenda.id)
    expect(
      screen.queryByRole("button", {
        name: `${fechaLegible("2026-10-01")}: Fuerza empezada, pendiente`,
      }),
    ).toBeNull()
    await fireEvent.press(dia)
    expect(abrir).toHaveBeenCalledWith(sesion.sesiones[0]!.agenda.id)
  } finally {
    await vista?.unmount()
    jest.useRealTimers()
  }
})

it("el inicio sigue la semana actual al pasar de domingo a lunes", async () => {
  jest.useFakeTimers()
  jest.setSystemTime(new Date("2026-09-20T21:59:58Z"))
  AppState.currentState = "active"
  const api = crearApiEntrenamiento(crearPeticionAutenticada(() => "token"))
  const consultar = jest.spyOn(api, "semana").mockResolvedValue({ sesiones: [], total: 0 })
  const vista = await render(
    <SemanaEntrenamiento clienteId="cliente" api={api} abrir={jest.fn()} resumenHoy />,
  )
  expect(consultar).toHaveBeenLastCalledWith("cliente", "2026-09-14", expect.any(AbortSignal))
  await act(async () => {
    await jest.advanceTimersByTimeAsync(5000)
  })
  expect(consultar).toHaveBeenLastCalledWith("cliente", "2026-09-21", expect.any(AbortSignal))
  await vista.unmount()
  jest.useRealTimers()
})
