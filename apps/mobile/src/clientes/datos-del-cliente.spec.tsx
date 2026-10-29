import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native"
import type { FichaDeUsuario } from "@alpha-omega/shared"

import { DatosDelCliente } from "./datos-del-cliente"
import {
  corregirCorreo,
  desactivarUsuario,
  guardarUsuario,
  leerUsuario,
  reactivarUsuario,
  reenviarActivacion,
} from "../lib/api"
import { useSesion } from "../sesion"

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}))
jest.mock("../lib/direccion-api", () => ({ direccionDeLaApi: () => "http://localhost:3000" }))
jest.mock("../lib/api", () => ({
  ...jest.requireActual("../lib/api"),
  leerUsuario: jest.fn(),
  guardarUsuario: jest.fn(),
  corregirCorreo: jest.fn(),
  reenviarActivacion: jest.fn(),
  desactivarUsuario: jest.fn(),
  reactivarUsuario: jest.fn(),
}))
jest.mock("../sesion", () => ({ useSesion: jest.fn() }))
const ficha: FichaDeUsuario = {
  id: "10000000-0000-4000-8000-000000000001",
  nombre: "Lara",
  apellidos: "Demo",
  email: "lara@prueba.local",
  rol: "cliente",
  estado: "activo",
  telefono: null,
  fechaNacimiento: "1990-05-12",
  creadoEn: "2026-10-27T10:00:00Z",
  tieneContrasena: true,
}
const pedir = jest.fn()
const cerrar = jest.fn()
const sesion = {
  estado: { fase: "dentro", usuario: { ...ficha, rol: "entrenador" }, tokenAcceso: "inicial" },
  pedir,
  salir: jest.fn(),
}

beforeEach(() => {
  jest.mocked(useSesion).mockReturnValue(sesion as unknown as ReturnType<typeof useSesion>)
  jest.mocked(leerUsuario).mockResolvedValue(ficha)
  jest
    .mocked(guardarUsuario)
    .mockImplementation(
      async (_pedir, _id, cambios) => ({ ...ficha, ...cambios }) as FichaDeUsuario,
    )
  jest.mocked(desactivarUsuario).mockResolvedValue({ ...ficha, estado: "desactivado" })
})

it("guarda datos válidos, nacimiento español y sexo opcional desde una única hoja", async () => {
  const actualizar = jest.fn()
  await render(<DatosDelCliente clienteId={ficha.id} alCerrar={cerrar} alActualizar={actualizar} />)
  expect(await screen.findByDisplayValue("12/05/1990")).toBeOnTheScreen()
  expect(screen.getByRole("button", { name: "Guardar cambios" })).toBeDisabled()
  await fireEvent.changeText(screen.getByLabelText("Nombre"), "Lucía")
  await fireEvent.changeText(screen.getByLabelText("Nacimiento"), "29/02/1992")
  await fireEvent.press(screen.getByRole("radio", { name: "Mujer" }))
  await fireEvent.press(screen.getByRole("button", { name: "Guardar cambios" }))
  await waitFor(() =>
    expect(guardarUsuario).toHaveBeenCalledWith(pedir, ficha.id, {
      nombre: "Lucía",
      apellidos: "Demo",
      telefono: null,
      fechaNacimiento: "1992-02-29",
      sexo: "mujer",
    }),
  )
  expect(actualizar).toHaveBeenCalled()
})

it("rechaza fechas inexistentes y permite borrar nacimiento y sexo", async () => {
  await render(<DatosDelCliente clienteId={ficha.id} alCerrar={cerrar} />)
  await fireEvent.changeText(await screen.findByLabelText("Nacimiento"), "31/02/1990")
  expect(screen.getByRole("button", { name: "Guardar cambios" })).toBeDisabled()
  await fireEvent.changeText(screen.getByLabelText("Nacimiento"), "")
  await fireEvent.press(screen.getByRole("radio", { name: "Hombre" }))
  await fireEvent.press(screen.getByRole("radio", { name: "Hombre" }))
  await fireEvent.press(screen.getByRole("button", { name: "Guardar cambios" }))
  await waitFor(() =>
    expect(guardarUsuario).toHaveBeenCalledWith(
      pedir,
      ficha.id,
      expect.objectContaining({ fechaNacimiento: null, sexo: null }),
    ),
  )
})

it("confirma descartar cambios y conserva la edición al cancelar o renovar token", async () => {
  const vista = await render(<DatosDelCliente clienteId={ficha.id} alCerrar={cerrar} />)
  await fireEvent.changeText(await screen.findByLabelText("Nombre"), "Pendiente")
  jest.mocked(useSesion).mockReturnValue({
    ...sesion,
    estado: { ...sesion.estado, tokenAcceso: "renovado" },
  } as unknown as ReturnType<typeof useSesion>)
  await vista.rerender(<DatosDelCliente clienteId={ficha.id} alCerrar={cerrar} />)
  expect(leerUsuario).toHaveBeenCalledTimes(1)
  await fireEvent.press(screen.getByRole("button", { name: "Cerrar" }))
  expect(screen.getByText("¿Salir sin guardar?")).toBeOnTheScreen()
  expect(cerrar).not.toHaveBeenCalled()
  await fireEvent.press(screen.getByRole("button", { name: "Seguir editando" }))
  expect(screen.getByDisplayValue("Pendiente")).toBeOnTheScreen()
  await fireEvent(screen.getByTestId("hoja-modal"), "requestClose")
  await fireEvent.press(screen.getByRole("button", { name: "Salir sin guardar" }))
  expect(cerrar).toHaveBeenCalledTimes(1)
})

it("pide confirmación antes de dar de baja", async () => {
  await render(<DatosDelCliente clienteId={ficha.id} alCerrar={cerrar} />)
  await fireEvent.press(await screen.findByRole("button", { name: "Dar de baja" }))
  expect(desactivarUsuario).not.toHaveBeenCalled()
  await fireEvent.press(screen.getByRole("button", { name: "Confirmar baja" }))
  await waitFor(() => expect(desactivarUsuario).toHaveBeenCalledWith(pedir, ficha.id))
})

it.each([true, false])(
  "confirma reactivar y explica el estado de destino (contraseña %s)",
  async (tieneContrasena) => {
    jest.mocked(leerUsuario).mockResolvedValue({ ...ficha, estado: "desactivado", tieneContrasena })
    jest.mocked(reactivarUsuario).mockResolvedValue({
      ...ficha,
      estado: tieneContrasena ? "activo" : "pendiente",
      tieneContrasena,
    })
    await render(<DatosDelCliente clienteId={ficha.id} alCerrar={cerrar} />)
    await fireEvent.press(await screen.findByRole("button", { name: "Reactivar" }))
    expect(
      screen.getByText(tieneContrasena ? /Volverá a estar activo/ : /Volverá a estar pendiente/),
    ).toBeOnTheScreen()
    expect(reactivarUsuario).not.toHaveBeenCalled()
    await fireEvent.press(screen.getByRole("button", { name: "Confirmar reactivación" }))
    await waitFor(() => expect(reactivarUsuario).toHaveBeenCalledWith(pedir, ficha.id))
  },
)

it("confirma correo pendiente y conserva los cambios si falla", async () => {
  jest
    .mocked(leerUsuario)
    .mockResolvedValue({ ...ficha, estado: "pendiente", tieneContrasena: false })
  jest.mocked(corregirCorreo).mockRejectedValue(new Error("red"))
  await render(<DatosDelCliente clienteId={ficha.id} alCerrar={cerrar} />)
  await fireEvent.changeText(await screen.findByLabelText("Correo"), "nuevo@prueba.local")
  await fireEvent.press(screen.getByRole("button", { name: "Guardar cambios" }))
  expect(corregirCorreo).not.toHaveBeenCalled()
  await fireEvent.press(screen.getByRole("button", { name: "Confirmar correo" }))
  expect(await screen.findByText("No hemos podido guardar los cambios.")).toBeOnTheScreen()
  expect(screen.getByDisplayValue("nuevo@prueba.local")).toBeOnTheScreen()
  expect(guardarUsuario).not.toHaveBeenCalled()
})

it("respeta correo de una cuenta activa y muestra fallo de reenvío sin afirmar éxito", async () => {
  jest
    .mocked(leerUsuario)
    .mockResolvedValue({ ...ficha, estado: "pendiente", tieneContrasena: false })
  jest
    .mocked(reenviarActivacion)
    .mockResolvedValue({ usuario: { ...ficha, estado: "pendiente" }, correoEnviado: false })
  await render(<DatosDelCliente clienteId={ficha.id} alCerrar={cerrar} />)
  await fireEvent.press(await screen.findByRole("button", { name: "Reenviar activación" }))
  expect(
    await screen.findByText(/El enlace anterior ya no vale y el nuevo no ha salido/),
  ).toBeOnTheScreen()
})

it("bloquea cierre y otras acciones durante el guardado", async () => {
  let resolver!: (nueva: FichaDeUsuario) => void
  jest.mocked(guardarUsuario).mockImplementation(
    () =>
      new Promise((resolve) => {
        resolver = resolve
      }),
  )
  await render(<DatosDelCliente clienteId={ficha.id} alCerrar={cerrar} />)
  expect((await screen.findByLabelText("Correo")).props.editable).toBe(false)
  await fireEvent.changeText(screen.getByLabelText("Nombre"), "Otro")
  await fireEvent.press(screen.getByRole("button", { name: "Guardar cambios" }))
  await fireEvent.press(screen.getByRole("button", { name: "Cerrar" }))
  expect(cerrar).not.toHaveBeenCalled()
  expect(screen.getByRole("button", { name: "Dar de baja" })).toBeDisabled()
  await act(() => resolver({ ...ficha, nombre: "Otro" }))
})

it("mantiene la edición al reenviar activación y confirma el envío real", async () => {
  const pendiente = { ...ficha, estado: "pendiente" as const, tieneContrasena: false }
  jest.mocked(leerUsuario).mockResolvedValue(pendiente)
  jest.mocked(reenviarActivacion).mockResolvedValue({ usuario: pendiente, correoEnviado: true })
  await render(<DatosDelCliente clienteId={ficha.id} alCerrar={cerrar} correoFallido />)
  await fireEvent.changeText(await screen.findByLabelText("Nombre"), "Sin guardar")
  await fireEvent.press(screen.getByRole("button", { name: "Reenviar activación" }))
  expect(await screen.findByText("Enlace enviado. El anterior ya no vale.")).toBeOnTheScreen()
  expect(screen.getByDisplayValue("Sin guardar")).toBeOnTheScreen()
  await fireEvent.press(screen.getByRole("button", { name: "Cerrar" }))
  expect(screen.getByText("¿Salir sin guardar?")).toBeOnTheScreen()
  await fireEvent.press(screen.getByRole("button", { name: "Seguir editando" }))
  await fireEvent.press(screen.getByRole("button", { name: "Guardar cambios" }))
  expect(await screen.findByText("Guardado")).toBeOnTheScreen()
  expect(
    screen.queryByText("No se pudo enviar el correo de activación. Vuelve a intentarlo."),
  ).toBeNull()
})

it("conserva contacto pendiente si cambia correo pero falla guardar el resto", async () => {
  const pendiente = { ...ficha, estado: "pendiente" as const, tieneContrasena: false }
  const nuevoCorreo = { ...pendiente, email: "nuevo@prueba.local" }
  jest.mocked(leerUsuario).mockResolvedValue(pendiente)
  jest.mocked(corregirCorreo).mockResolvedValue(nuevoCorreo)
  jest.mocked(guardarUsuario).mockRejectedValueOnce(new Error("red"))
  await render(<DatosDelCliente clienteId={ficha.id} alCerrar={cerrar} />)
  await fireEvent.changeText(await screen.findByLabelText("Nombre"), "Nombre pendiente")
  await fireEvent.changeText(screen.getByLabelText("Correo"), nuevoCorreo.email)
  await fireEvent.press(screen.getByRole("button", { name: "Guardar cambios" }))
  await fireEvent.press(screen.getByRole("button", { name: "Confirmar correo" }))
  expect(await screen.findByText("No hemos podido guardar los cambios.")).toBeOnTheScreen()
  expect(screen.getByDisplayValue("Nombre pendiente")).toBeOnTheScreen()
  expect(screen.getByDisplayValue(nuevoCorreo.email)).toBeOnTheScreen()
  await fireEvent.press(screen.getByRole("button", { name: "Guardar cambios" }))
  await waitFor(() => expect(guardarUsuario).toHaveBeenCalledTimes(2))
  expect(corregirCorreo).toHaveBeenCalledTimes(1)
  expect(screen.queryByText("¿Cambiar correo?")).toBeNull()
})

it("muestra el estado real del consentimiento en solo lectura", async () => {
  await render(
    <DatosDelCliente
      clienteId={ficha.id}
      alCerrar={cerrar}
      consentimiento={{
        version: "actual",
        aceptadoEn: "2026-09-28T10:00:00Z",
        retiradoEn: null,
        vigente: true,
        versionVigente: "actual",
      }}
    />,
  )
  await screen.findByLabelText("Nombre")
  expect(screen.getByText("Consentimiento de salud")).toBeOnTheScreen()
  expect(screen.getByText("Dado el lunes, 28 sept")).toBeOnTheScreen()
  expect(screen.getByText("Vigente")).toBeOnTheScreen()
  expect(screen.queryByRole("button", { name: /Retirar/ })).toBeNull()
})

it("permite reintentar la carga y sustituye los campos al cambiar de cliente", async () => {
  jest.mocked(leerUsuario).mockRejectedValueOnce(new Error("red"))
  const vista = await render(<DatosDelCliente clienteId={ficha.id} alCerrar={cerrar} />)
  await fireEvent.press(await screen.findByRole("button", { name: "Reintentar" }))
  await fireEvent.changeText(await screen.findByLabelText("Nombre"), "Nombre pendiente")
  const otra = { ...ficha, id: "10000000-0000-4000-8000-000000000002", nombre: "Eva" }
  jest.mocked(leerUsuario).mockResolvedValue(otra)
  await vista.rerender(<DatosDelCliente clienteId={otra.id} alCerrar={cerrar} />)
  expect(await screen.findByDisplayValue("Eva")).toBeOnTheScreen()
  expect(screen.queryByDisplayValue("Nombre pendiente")).toBeNull()
})
