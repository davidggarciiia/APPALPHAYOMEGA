import { jest } from "@jest/globals"
import { fireEvent, render, screen } from "@testing-library/react-native"
import { MedioFotoSchema, type MedioFoto } from "@alpha-omega/shared"

import { FotosProgreso } from "./fotos-progreso"
import type { ApiMedios } from "./medios-api"

const cliente = "10000000-0000-4000-8000-000000000001"
const id = (n: number): string => `30000000-0000-4000-8000-${String(n).padStart(12, "0")}`
const foto = (
  n: number,
  fecha: string,
  vista: MedioFoto["vista"] = "frente",
  etiqueta: string | null = null,
): MedioFoto =>
  MedioFotoSchema.parse({
    id: id(n),
    clienteId: cliente,
    autor: { id: cliente, nombre: "Cliente" },
    origen: "cliente",
    vista,
    etiqueta,
    fechaToma: fecha,
    estado: "disponible",
    tipoMime: "image/jpeg",
    bytes: 1234,
    valoracionId: null,
    solicitudId: null,
    creadoEn: `${fecha}T09:00:00.000Z`,
    confirmadoEn: `${fecha}T09:01:00.000Z`,
  })

const acceso = jest.fn<ApiMedios["acceso"]>(async (medioId) => ({
  medioId,
  lectura: {
    url: `https://almacen.test/${medioId}`,
    metodo: "GET",
    cabeceras: {},
    caducaEn: "2099-01-01T00:00:00.000Z",
  },
}))

it("compara la primera y última foto de la misma pose y permite abrir la galería", async () => {
  const abrir = jest.fn()
  const fotos = [
    foto(3, "2026-10-01"),
    foto(4, "2026-03-01", "espalda"),
    foto(1, "2026-01-01"),
    foto(2, "2026-06-01"),
  ]
  await render(<FotosProgreso fotos={fotos} acceso={acceso} abrirGaleria={abrir} />)
  expect(await screen.findByLabelText("Antes: Frente, 1 ene 2026")).toBeOnTheScreen()
  expect(await screen.findByLabelText("Ahora: Frente, 1 oct 2026")).toBeOnTheScreen()
  expect(screen.queryByLabelText(/Espalda/)).toBeNull()
  expect(acceso).not.toHaveBeenCalledWith(id(2))
  expect(acceso).not.toHaveBeenCalledWith(id(4))
  await fireEvent.press(screen.getByRole("button", { name: "Ver galería de fotos" }))
  expect(abrir).toHaveBeenCalledTimes(1)
})

it("prefiere una pose con dos fotos y no mezcla las etiquetas de otras poses", async () => {
  await render(
    <FotosProgreso
      fotos={[
        foto(1, "2026-01-01"),
        foto(2, "2026-02-01", "otra", "Brazo"),
        foto(3, "2026-03-01", "otra", "Pierna"),
        foto(4, "2026-04-01", "otra", "Brazo"),
      ]}
      acceso={acceso}
      abrirGaleria={jest.fn()}
    />,
  )
  expect(await screen.findByLabelText("Antes: Brazo, 1 feb 2026")).toBeOnTheScreen()
  expect(await screen.findByLabelText("Ahora: Brazo, 1 abr 2026")).toBeOnTheScreen()
  expect(screen.queryByLabelText(/Pierna/)).toBeNull()
})

it("con una sola foto explica que falta otra sin inventar una comparación", async () => {
  await render(
    <FotosProgreso
      fotos={[foto(1, "2026-01-01", "espalda")]}
      acceso={acceso}
      abrirGaleria={jest.fn()}
    />,
  )
  expect(await screen.findByLabelText("Antes: Espalda, 1 ene 2026")).toBeOnTheScreen()
  expect(screen.getByText("Falta otra foto de la misma pose para comparar.")).toBeOnTheScreen()
  expect(screen.queryByLabelText(/^Ahora:/)).toBeNull()
})

it("no muestra comparador cuando no hay fotos disponibles", async () => {
  await render(
    <FotosProgreso
      fotos={[{ ...foto(1, "2026-01-01"), estado: "eliminado" }]}
      acceso={acceso}
      abrirGaleria={jest.fn()}
    />,
  )
  expect(screen.queryByRole("button", { name: "Ver galería de fotos" })).toBeNull()
})

it("avisa si las fotos comparadas corresponden al mismo día", async () => {
  const primera = foto(1, "2026-01-01")
  const segunda = { ...foto(2, "2026-01-01"), creadoEn: "2026-01-01T10:00:00.000Z" }
  await render(
    <FotosProgreso fotos={[primera, segunda]} acceso={acceso} abrirGaleria={jest.fn()} />,
  )
  expect(await screen.findByText("Las dos fotos son del mismo día.")).toBeOnTheScreen()
})

it("no presenta dos veces la misma foto como una comparación", async () => {
  const repetida = foto(1, "2026-01-01")
  await render(
    <FotosProgreso fotos={[repetida, { ...repetida }]} acceso={acceso} abrirGaleria={jest.fn()} />,
  )
  expect(
    await screen.findByText("Falta otra foto de la misma pose para comparar."),
  ).toBeOnTheScreen()
  expect(screen.queryByLabelText(/^Ahora:/)).toBeNull()
})

it("distingue en las fechas visibles fotos del mismo día y mes de años distintos", async () => {
  await render(
    <FotosProgreso
      fotos={[foto(1, "2025-01-01"), foto(2, "2026-01-01")]}
      acceso={acceso}
      abrirGaleria={jest.fn()}
    />,
  )
  expect(await screen.findByText("1 ene 2025")).toBeOnTheScreen()
  expect(screen.getByText("1 ene 2026")).toBeOnTheScreen()
})

it("no muestra la imagen anterior con la fecha de otra mientras carga el nuevo enlace", async () => {
  const accesoDiferido = jest.fn<ApiMedios["acceso"]>((medioId) =>
    medioId === id(3)
      ? new Promise(() => undefined)
      : Promise.resolve({
          medioId,
          lectura: {
            url: `https://almacen.test/${medioId}`,
            metodo: "GET",
            cabeceras: {},
            caducaEn: "2099-01-01T00:00:00.000Z",
          },
        }),
  )
  const vista = await render(
    <FotosProgreso
      fotos={[foto(1, "2026-01-01"), foto(2, "2026-10-01")]}
      acceso={accesoDiferido}
      abrirGaleria={jest.fn()}
    />,
  )
  await screen.findByRole("image", { name: "Antes: Frente, 1 ene 2026" })
  await vista.rerender(
    <FotosProgreso
      fotos={[foto(3, "2025-01-01"), foto(2, "2026-10-01")]}
      acceso={accesoDiferido}
      abrirGaleria={jest.fn()}
    />,
  )
  expect(screen.queryByRole("image", { name: "Antes: Frente, 1 ene 2025" })).toBeNull()
  expect(screen.getByLabelText("Antes: Frente, 1 ene 2025: cargando foto")).toBeOnTheScreen()
})

it("permite reintentar la foto sin un botón anidado ni abrir la galería", async () => {
  const abrir = jest.fn()
  const accesoConFallo = jest
    .fn<ApiMedios["acceso"]>()
    .mockRejectedValueOnce(new Error("Sin conexión"))
    .mockImplementation(async (medioId) => ({
      medioId,
      lectura: {
        url: `https://almacen.test/${medioId}`,
        metodo: "GET",
        cabeceras: {},
        caducaEn: "2099-01-01T00:00:00.000Z",
      },
    }))
  await render(
    <FotosProgreso fotos={[foto(1, "2026-01-01")]} acceso={accesoConFallo} abrirGaleria={abrir} />,
  )
  const reintento = await screen.findByRole("button", {
    name: "Reintentar la foto de Antes: Frente, 1 ene 2026",
  })
  let ancestro = reintento.parent
  while (ancestro) {
    expect(ancestro.props.accessibilityRole).not.toBe("button")
    ancestro = ancestro.parent
  }
  await fireEvent.press(reintento)
  expect(abrir).not.toHaveBeenCalled()
  expect(await screen.findByRole("image", { name: "Antes: Frente, 1 ene 2026" })).toBeOnTheScreen()
  await fireEvent.press(screen.getByRole("button", { name: "Ver galería de fotos" }))
  expect(abrir).toHaveBeenCalledTimes(1)
})
