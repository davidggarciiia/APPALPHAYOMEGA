import { AppState } from "react-native"
import { act, fireEvent, render, screen } from "@testing-library/react-native"
import type { ApiEntrenamiento } from "./api"
import type { SesionCliente } from "@alpha-omega/shared"
import { ErrorDePeticion } from "../lib/http"
import { SemanaEntrenamiento } from "./semana"
import { crearApiEntrenamiento } from "./api"
import { crearPeticionAutenticada } from "../lib/peticion-autenticada"
import { fechaLegible, hoyAgenda, lunesDeSemana, sumarDias } from "./fechas"
import { AgendaSemanal } from "./agenda-semanal"
import { almacenDispositivo } from "./almacen-dispositivo"

jest.mock("expo-router", () => ({
  useFocusEffect: (efecto: () => void) =>
    jest.requireActual<typeof import("react")>("react").useEffect(efecto, [efecto]),
}))
jest.mock("./almacen-dispositivo", () => ({
  almacenDispositivo: { leer: jest.fn(), guardar: jest.fn() },
}))
jest.mock("../lib/direccion-api", () => ({ direccionDeLaApi: () => "http://localhost:3000" }))
jest.mock("../componentes/iconos", () => ({ Icono: () => null }))

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
  ;(almacenDispositivo.leer as jest.Mock).mockResolvedValue({
    sesion: { borrador: null },
    edicion: { inicio: null, checkin: { sensacion: 4 }, series: [] },
  })
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
  expect(screen.getByRole("header", { name: "Esta semana" })).toBeOnTheScreen()
  expect(screen.getByText("Otro deporte")).toBeOnTheScreen()
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

it("filtra por la fecha actual, abre la sesión y limpia el filtro al cambiar semana", async () => {
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
  await fireEvent.press(screen.getByRole("button", { name: `${fechaLegible(lunes)} · 0 sesiones` }))
  expect(
    screen.queryByRole("button", { name: `Empezar Fuerza, ${fechaLegible(martes)}, pendiente` }),
  ).toBeNull()
  await fireEvent.press(
    screen.getByRole("button", { name: `${fechaLegible(martes)} · 1 sesiones` }),
  )
  await fireEvent.press(
    screen.getByRole("button", { name: `Empezar Fuerza, ${fechaLegible(martes)}, pendiente` }),
  )
  expect(abrir).toHaveBeenCalledWith("10000000-0000-4000-8000-000000000000")
  consultar.mockResolvedValue({ sesiones: [], total: 0 })
  await fireEvent.press(screen.getByRole("button", { name: "Semana siguiente" }))
  expect(await screen.findByText("No hay entrenamientos asignados esta semana.")).toBeOnTheScreen()
  expect(screen.queryByRole("button", { name: "Ver toda la semana" })).toBeNull()
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
