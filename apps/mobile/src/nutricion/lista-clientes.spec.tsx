import { fireEvent, render, screen } from "@testing-library/react-native"
import type { ResumenUsuario } from "@alpha-omega/shared"

import { filtrarClientes, ListaClientes } from "./lista-clientes"

function cliente(n: number, nombre: string, apellidos: string | null = null): ResumenUsuario {
  return {
    id: `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`,
    nombre,
    apellidos,
    email: `cliente${n}@ejemplo.test`,
    rol: "cliente",
    estado: "activo",
  }
}

const SEIS = [
  cliente(1, "María", "Gómez Ruiz"),
  cliente(2, "Pedro"),
  cliente(3, "Lucía", "Pérez"),
  cliente(4, "Álvaro", "Martín"),
  cliente(5, "Marta"),
  cliente(6, "Jon", "Etxeberria"),
]

describe("filtrarClientes", () => {
  it("busca sin distinguir mayúsculas ni tildes, en nombre, apellidos y correo", () => {
    expect(filtrarClientes(SEIS, "maria").map((c) => c.nombre)).toEqual(["María"])
    expect(filtrarClientes(SEIS, "  ALVARO ").map((c) => c.nombre)).toEqual(["Álvaro"])
    expect(filtrarClientes(SEIS, "perez").map((c) => c.nombre)).toEqual(["Lucía"])
    expect(filtrarClientes(SEIS, "cliente5@").map((c) => c.nombre)).toEqual(["Marta"])
    expect(filtrarClientes(SEIS, "mar").map((c) => c.nombre)).toEqual(["María", "Álvaro", "Marta"])
    expect(filtrarClientes(SEIS, "")).toBe(SEIS)
  })
})

describe("ListaClientes", () => {
  it("con pocos clientes no ofrece búsqueda", async () => {
    await render(<ListaClientes clientes={SEIS.slice(0, 3)} abrir={jest.fn()} />)
    expect(screen.queryByLabelText("Buscar cliente")).toBeNull()
    expect(screen.getAllByRole("button")).toHaveLength(3)
  })

  it("filtra en el dispositivo, cuenta los resultados y abre el cliente elegido", async () => {
    const abrir = jest.fn()
    await render(<ListaClientes clientes={SEIS} abrir={abrir} />)
    expect(screen.getAllByRole("button")).toHaveLength(6)
    await fireEvent.changeText(screen.getByLabelText("Buscar cliente"), "lucia")
    expect(screen.getAllByRole("button")).toHaveLength(1)
    expect(screen.getByText("1 de 6")).toBeTruthy()
    await fireEvent.press(
      screen.getByRole("button", { name: "Lucía Pérez. cliente3@ejemplo.test" }),
    )
    expect(abrir).toHaveBeenCalledWith(SEIS[2])
  })

  it("sin coincidencias lo dice, distinto de no tener clientes", async () => {
    await render(<ListaClientes clientes={SEIS} abrir={jest.fn()} />)
    await fireEvent.changeText(screen.getByLabelText("Buscar cliente"), "zzz")
    expect(screen.getByText("Ningún cliente coincide con lo que buscas.")).toBeTruthy()
    expect(screen.queryByText(/todavía no te ha asignado/)).toBeNull()
  })

  it("sin clientes asignados explica que aparecerán aquí", async () => {
    await render(<ListaClientes clientes={[]} abrir={jest.fn()} />)
    expect(screen.getByText(/todavía no te ha asignado ningún cliente/)).toBeTruthy()
  })
})
