import { Text, Pressable } from "react-native"
import { fireEvent, render, screen } from "@testing-library/react-native"
import { ProveedorDeSesion, useSesion } from "./sesion"
import { ErrorDeRed, ErrorDeSesion, refrescarSesion } from "./lib/api"
import { borrarTokenRefresco, leerTokenRefresco } from "./lib/almacen-seguro"
import { leerIdentidadLocal, leerLimpieza } from "./lib/sesion-local"
import { hayCambiosLocales } from "./entrenamiento/documento-local"
import { almacenDispositivo } from "./entrenamiento/almacen-dispositivo"

jest.mock("./lib/direccion-api", () => ({ direccionDeLaApi: () => "http://localhost:3000" }))
jest.mock("./lib/api", () => ({
  ...jest.requireActual("./lib/api"),
  refrescarSesion: jest.fn(),
  cerrarSesionEnServidor: jest.fn(async () => undefined),
}))
jest.mock("./lib/almacen-seguro", () => ({
  leerTokenRefresco: jest.fn(),
  borrarTokenRefresco: jest.fn(async () => undefined),
  guardarTokenRefresco: jest.fn(async () => undefined),
}))
jest.mock("./lib/sesion-local", () => ({
  marcarLimpieza: jest.fn(async () => undefined),
  leerLimpieza: jest.fn(async () => null),
  terminarLimpieza: jest.fn(async () => undefined),
  leerCuentaLocal: jest.fn(async () => "10000000-0000-4000-8000-000000000000"),
  leerIdentidadLocal: jest.fn(),
  guardarIdentidadLocal: jest.fn(async () => undefined),
  borrarIdentidadLocal: jest.fn(async () => undefined),
}))
jest.mock("./entrenamiento/documento-local", () => ({ hayCambiosLocales: jest.fn() }))
jest.mock("./entrenamiento/almacen-dispositivo", () => ({
  almacenDispositivo: { habilitar: jest.fn(), limpiar: jest.fn(async () => undefined) },
}))

const local = {
  id: "10000000-0000-4000-8000-000000000000",
  nombre: "Cliente",
  rol: "cliente" as const,
}
function Visor(): React.JSX.Element {
  const { estado, salir } = useSesion()
  return (
    <>
      <Text>{estado.fase}</Text>
      <Pressable accessibilityRole="button" onPress={() => void salir()}>
        <Text>Salir</Text>
      </Pressable>
    </>
  )
}
beforeEach(() => {
  jest.clearAllMocks()
  jest.mocked(leerTokenRefresco).mockResolvedValue("refresco")
  jest.mocked(leerIdentidadLocal).mockResolvedValue(local)
  jest.mocked(hayCambiosLocales).mockResolvedValue(false)
  jest.mocked(leerLimpieza).mockResolvedValue(null)
})

it("al reiniciar termina una limpieza pendiente antes de renovar o habilitar acceso", async () => {
  jest.mocked(leerLimpieza).mockResolvedValue({ cuenta: local.id })
  await render(
    <ProveedorDeSesion>
      <Visor />
    </ProveedorDeSesion>,
  )
  await screen.findByText("fuera")
  expect(refrescarSesion).not.toHaveBeenCalled()
  expect(almacenDispositivo.limpiar).toHaveBeenCalledWith(local.id)
})
it("un fallo de red restaura acceso local de cliente y conserva la credencial", async () => {
  jest.mocked(refrescarSesion).mockRejectedValue(new ErrorDeRed("Sin red"))
  await render(
    <ProveedorDeSesion>
      <Visor />
    </ProveedorDeSesion>,
  )
  await screen.findByText("local")
  expect(borrarTokenRefresco).not.toHaveBeenCalled()
})
it("un 401 confirmado no concede acceso local", async () => {
  jest.mocked(refrescarSesion).mockRejectedValue(new ErrorDeSesion("Revocada"))
  await render(
    <ProveedorDeSesion>
      <Visor />
    </ProveedorDeSesion>,
  )
  await screen.findByText("fuera")
  expect(borrarTokenRefresco).toHaveBeenCalled()
  expect(almacenDispositivo.limpiar).toHaveBeenCalledWith(local.id)
})
it("permite cancelar la salida con cambios pendientes y limpia la cuenta al confirmar", async () => {
  jest.mocked(refrescarSesion).mockResolvedValue({
    usuario: { ...local, email: "cliente@example.test", apellidos: null, estado: "activo" },
    tokenAcceso: "acceso",
    tokenRefresco: "nuevo",
  })
  jest.mocked(hayCambiosLocales).mockResolvedValue(true)
  await render(
    <ProveedorDeSesion>
      <Visor />
    </ProveedorDeSesion>,
  )
  await screen.findByText("dentro")
  await fireEvent.press(screen.getByRole("button", { name: "Salir" }))
  await fireEvent.press(await screen.findByRole("button", { name: "Seguir entrenando" }))
  expect(almacenDispositivo.limpiar).not.toHaveBeenCalled()
  await fireEvent.press(screen.getByRole("button", { name: "Salir" }))
  await fireEvent.press(await screen.findByRole("button", { name: "Descartar y cerrar sesión" }))
  await screen.findByText("fuera")
  expect(almacenDispositivo.limpiar).toHaveBeenCalledWith(local.id)
})
