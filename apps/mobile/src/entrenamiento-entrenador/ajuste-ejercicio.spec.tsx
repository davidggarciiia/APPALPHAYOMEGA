import { fireEvent, render, screen, waitFor } from "@testing-library/react-native"
import { CambiarPrescripcionSchema, type SesionEntrenador } from "@alpha-omega/shared"

import type { ApiEntrenamiento } from "../entrenamiento/api"
import { ErrorDelServidor } from "../lib/http"
import { AjusteEjercicio } from "./ajuste-ejercicio"

jest.mock("../entrenamiento/fechas", () => ({
  ...jest.requireActual("../entrenamiento/fechas"),
  hoyAgenda: () => "2026-10-26",
}))
jest.mock("../componentes/iconos", () => ({ Icono: () => null }))
jest.mock("react-native-safe-area-context", () => ({
  ...jest.requireActual("react-native-safe-area-context"),
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}))

const sesion: SesionEntrenador = {
  agenda: {
    id: "sesion",
    clienteId: "cliente",
    fechaActual: "2026-10-28",
    fechaOriginal: "2026-10-28",
    estado: "abierta",
    revision: 0,
  },
  revisionPrescripcion: 3,
  permiteAjuste: true,
  enviadoEn: null,
  prescripcion: {
    nombre: "Empuje",
    nota: "Mantén el ritmo",
    duracion: "50 min",
    partes: { calentamiento: "5", fuerza: "45" },
    ejercicios: [
      {
        id: "10000000-0000-4000-8000-000000000001",
        ejercicioId: "20000000-0000-4000-8000-000000000001",
        nombre: "Press banca",
        indicaciones: null,
        rir: { min: 2, max: 3 },
        subidaKg: 2.5,
        series: [
          {
            id: "30000000-0000-4000-8000-000000000001",
            tipoMedicion: "repeticiones",
            repeticiones: 8,
            pesoKg: 60,
          },
          {
            id: "30000000-0000-4000-8000-000000000002",
            tipoMedicion: "repeticiones",
            repeticiones: 10,
            pesoKg: 55,
          },
        ],
      },
      {
        id: "10000000-0000-4000-8000-000000000002",
        ejercicioId: "20000000-0000-4000-8000-000000000002",
        nombre: "Remo",
        indicaciones: null,
        series: [
          {
            id: "30000000-0000-4000-8000-000000000003",
            tipoMedicion: "repeticiones",
            repeticiones: 10,
            pesoKg: 50,
          },
        ],
      },
    ],
  },
}

async function preparar(candidata = sesion, siguiente?: SesionEntrenador) {
  const api = {
    plan: jest.fn().mockResolvedValue({ plan: { semanaInicial: "2026-10-26", semanas: 2 } }),
    semana: jest.fn().mockResolvedValue({
      sesiones: [candidata, ...(siguiente ? [siguiente] : [])].map(({ agenda }) => ({
        agenda,
        enviadoEn: null,
      })),
    }),
    leerEntrenador: jest.fn(async (id: string) =>
      id === siguiente?.agenda.id ? siguiente : candidata,
    ),
    ajustar: jest.fn().mockResolvedValue(candidata),
    asignar: jest.fn(),
  }
  const volver = jest.fn()
  await render(
    <AjusteEjercicio
      clienteId="cliente"
      ejercicioId="20000000-0000-4000-8000-000000000001"
      nombreCliente="David García"
      api={api as unknown as ApiEntrenamiento}
      volver={volver}
    />,
  )
  return { api, volver }
}

it("abre la próxima sesión ajustable y guarda solo el RIR, conservando series y otros ejercicios", async () => {
  const { api, volver } = await preparar()
  expect(await screen.findByText(/Empuje · miércoles, 28 oct/)).toBeOnTheScreen()
  expect(screen.getByRole("button", { name: "Guardar ajuste" })).toBeDisabled()
  expect(screen.queryByText(/Sube carga|subidaKg|Carga inicial/)).toBeNull()
  await fireEvent.press(screen.getByRole("radio", { name: "RIR 4" }))
  await fireEvent.press(screen.getByRole("button", { name: "Guardar ajuste" }))
  await waitFor(() => expect(api.ajustar).toHaveBeenCalledTimes(1))
  expect(api.ajustar).toHaveBeenCalledWith("sesion", {
    revisionPrescripcion: 3,
    ...sesion.prescripcion,
    ejercicios: sesion.prescripcion.ejercicios.map(({ nombre: _nombre, ...e }) =>
      e.ejercicioId === "20000000-0000-4000-8000-000000000001"
        ? { ...e, rir: { min: 4, max: 4 } }
        : e,
    ),
  })
  expect(api.asignar).not.toHaveBeenCalled()
  await waitFor(() => expect(volver).toHaveBeenCalledTimes(1))
})

it("sin próximas sesiones ajustables explica el vacío sin iniciar un plan", async () => {
  const { api } = await preparar({ ...sesion, permiteAjuste: false })
  expect(
    await screen.findByText("No hay una próxima sesión ajustable con este ejercicio."),
  ).toBeOnTheScreen()
  expect(screen.queryByRole("button", { name: "Guardar ajuste" })).toBeNull()
  expect(api.asignar).not.toHaveBeenCalled()
})

it("un conflicto al guardar conserva la selección y permite recargar", async () => {
  const { api, volver } = await preparar()
  await screen.findByRole("radio", { name: "RIR 4" })
  api.ajustar.mockRejectedValue(new ErrorDelServidor(409))
  await fireEvent.press(screen.getByRole("radio", { name: "RIR 4" }))
  await fireEvent.press(screen.getByRole("button", { name: "Guardar ajuste" }))
  expect(await screen.findByText(/La sesión cambió o el cliente ya empezó/)).toBeOnTheScreen()
  expect(screen.getByRole("radio", { name: "RIR 4", checked: true })).toBeOnTheScreen()
  expect(screen.getByRole("button", { name: "Recargar versión actual" })).toBeOnTheScreen()
  expect(volver).not.toHaveBeenCalled()
})

it("salta sesiones empezadas y selecciona la primera fecha ajustable con el ejercicio", async () => {
  const siguiente = {
    ...sesion,
    agenda: { ...sesion.agenda, id: "siguiente", fechaActual: "2026-10-30" },
  }
  const { api } = await preparar({ ...sesion, permiteAjuste: false }, siguiente)
  expect(await screen.findByText(/Empuje · viernes, 30 oct/)).toBeOnTheScreen()
  expect(api.leerEntrenador.mock.calls).toEqual([["sesion"], ["siguiente"]])
  await fireEvent.press(screen.getByRole("radio", { name: "RIR 4" }))
  await fireEvent.press(screen.getByRole("button", { name: "Guardar ajuste" }))
  await waitFor(() => expect(api.ajustar).toHaveBeenCalledWith("siguiente", expect.anything()))
})

it("el ejercicio fuera del bloque actual no inicia una asignación ni abre otra hoja", async () => {
  await preparar({
    ...sesion,
    prescripcion: {
      ...sesion.prescripcion,
      ejercicios: sesion.prescripcion.ejercicios.filter(
        (e) => e.ejercicioId !== "20000000-0000-4000-8000-000000000001",
      ),
    },
  })
  expect(
    await screen.findByText("No hay una próxima sesión ajustable con este ejercicio."),
  ).toBeOnTheScreen()
  expect(screen.queryByText("Editar ejercicio")).toBeNull()
})

it("cerrar con un RIR cambiado pide confirmación y permite conservar la selección", async () => {
  const { volver } = await preparar()
  await fireEvent.press(await screen.findByRole("radio", { name: "RIR 4" }))
  await fireEvent.press(screen.getByRole("button", { name: "Cerrar" }))
  expect(await screen.findByText("¿Salir sin guardar?")).toBeOnTheScreen()
  await fireEvent.press(screen.getByRole("button", { name: "Seguir editando" }))
  expect(screen.getByRole("radio", { name: "RIR 4", checked: true })).toBeOnTheScreen()
  expect(volver).not.toHaveBeenCalled()
})

it("excluye la fase derivada del payload estricto de ajuste y conserva el resto de la sesión", async () => {
  const { api } = await preparar({
    ...sesion,
    prescripcion: {
      ...sesion.prescripcion,
      fase: { nombre: "Descarga", ajustes: { factorCarga: 0.9 } },
      circuito: { nombre: "Core", vueltas: 2, descanso: "60 s" },
    },
  })
  await fireEvent.press(await screen.findByRole("radio", { name: "RIR 4" }))
  await fireEvent.press(screen.getByRole("button", { name: "Guardar ajuste" }))
  await waitFor(() => expect(api.ajustar).toHaveBeenCalledTimes(1))
  const payload = api.ajustar.mock.calls[0]![1]
  expect(CambiarPrescripcionSchema.safeParse(payload).success).toBe(true)
  expect(payload).not.toHaveProperty("fase")
  expect(payload).toMatchObject({
    nombre: "Empuje",
    nota: "Mantén el ritmo",
    duracion: "50 min",
    partes: sesion.prescripcion.partes,
    circuito: { nombre: "Core", vueltas: 2, descanso: "60 s" },
  })
})

it("si se repite el ejercicio en calentamiento y principal cambia solo el RIR principal", async () => {
  const principal = sesion.prescripcion.ejercicios[0]!
  const calentamiento = {
    ...principal,
    id: "10000000-0000-4000-8000-000000000003",
    seccion: "calentamiento" as const,
    nombre: "Activación de press",
    rir: { min: 5, max: 5 },
    series: [
      {
        id: "30000000-0000-4000-8000-000000000004",
        tipoMedicion: "repeticiones" as const,
        repeticiones: 10,
        pesoKg: 20,
      },
    ],
  }
  const { api } = await preparar({
    ...sesion,
    prescripcion: { ...sesion.prescripcion, ejercicios: [calentamiento, principal] },
  })
  expect(await screen.findByText("Press banca")).toBeOnTheScreen()
  await fireEvent.press(screen.getByRole("radio", { name: "RIR 4" }))
  await fireEvent.press(screen.getByRole("button", { name: "Guardar ajuste" }))
  await waitFor(() => expect(api.ajustar).toHaveBeenCalledTimes(1))
  const payload = api.ajustar.mock.calls[0]![1]
  expect(CambiarPrescripcionSchema.safeParse(payload).success).toBe(true)
  expect(payload.ejercicios[0]).toMatchObject({
    rir: { min: 5, max: 5 },
    series: calentamiento.series,
  })
  expect(payload.ejercicios[1]).toMatchObject({ rir: { min: 4, max: 4 }, series: principal.series })
})
