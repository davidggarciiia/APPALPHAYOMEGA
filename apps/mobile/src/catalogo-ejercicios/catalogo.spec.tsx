import { describe, it, jest } from "@jest/globals"
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native"
import {
  EjercicioSchema,
  ListadoEjerciciosSchema,
  type Ejercicio,
  type GrupoMuscular,
  type ListadoEjercicios,
} from "@alpha-omega/shared"

import { ErrorDeRed } from "../lib/api"

import type { ApiDeCatalogo, FiltrosDeCatalogo } from "./api"
import { Catalogo } from "./catalogo"

/**
 * Datos de prueba, no respuestas del servidor.
 *
 * Pasan por el esquema compartido para que un cambio de contrato rompa aquí y no
 * en el móvil de nadie. La comprobación contra la API real es aparte.
 */
function ejercicio(
  id: string,
  nombre: string,
  grupoPrincipal: GrupoMuscular,
  gruposSecundarios: GrupoMuscular[] = [],
): Ejercicio {
  return EjercicioSchema.parse({
    id,
    nombre,
    grupoPrincipal,
    gruposSecundarios,
    instrucciones: "Baja controlando y sube sin bloquear.",
    estado: "publicado",
    figura: null,
    video: null,
  })
}

const PRESS = ejercicio("3f2b8c1e-4d5a-4f6b-8a9c-0d1e2f3a4b01", "Press de banca", "pecho", [
  "triceps",
])
const SENTADILLA = ejercicio("3f2b8c1e-4d5a-4f6b-8a9c-0d1e2f3a4b02", "Sentadilla", "cuadriceps", [
  "gluteos",
])
const FONDOS = ejercicio("3f2b8c1e-4d5a-4f6b-8a9c-0d1e2f3a4b03", "Fondos", "triceps", ["pecho"])

/** Catálogo en memoria que filtra como se espera que filtre el servidor. */
function apiEnMemoria(ejercicios: Ejercicio[], total?: number): ApiDeCatalogo {
  return {
    buscar: (filtros: FiltrosDeCatalogo) => {
      const texto = filtros.buscar?.toLowerCase() ?? ""
      const filas = ejercicios.filter(
        (fila) =>
          fila.nombre.toLowerCase().includes(texto) &&
          (filtros.grupo === undefined ||
            fila.grupoPrincipal === filtros.grupo ||
            fila.gruposSecundarios.includes(filtros.grupo)),
      )

      return Promise.resolve(
        ListadoEjerciciosSchema.parse({ ejercicios: filas, total: total ?? filas.length }),
      )
    },
  }
}

function pintar(
  api: ApiDeCatalogo,
  acciones: { onNuevo?: () => void; onAbrir?: (id: string) => void } = {},
) {
  return render(
    <Catalogo
      api={api}
      onNuevo={acciones.onNuevo ?? jest.fn()}
      onAbrir={acciones.onAbrir ?? jest.fn()}
    />,
  )
}

describe("Catálogo de ejercicios", () => {
  it("avisa de que está cargando mientras el servidor no contesta", async () => {
    let contestar: (listado: ListadoEjercicios) => void = () => undefined
    const pendiente = new Promise<ListadoEjercicios>((resolver) => {
      contestar = resolver
    })
    await pintar({ buscar: () => pendiente })

    expect(screen.getByLabelText("Cargando el catálogo")).toBeOnTheScreen()

    contestar(ListadoEjerciciosSchema.parse({ ejercicios: [PRESS], total: 1 }))
    await screen.findByRole("button", { name: "Press de banca. Pecho" })
    expect(screen.queryByLabelText("Cargando el catálogo")).toBeNull()
  })

  it("enseña cada ejercicio con su grupo principal", async () => {
    await pintar(apiEnMemoria([PRESS, SENTADILLA]))

    await screen.findByRole("button", { name: "Press de banca. Pecho" })
    expect(screen.getByRole("button", { name: "Sentadilla. Cuádriceps" })).toBeOnTheScreen()
    expect(screen.getByText("Pecho · Tríceps")).toBeOnTheScreen()
  })

  it("dice que el catálogo está vacío en lugar de enseñar una lista en blanco", async () => {
    await pintar(apiEnMemoria([]))

    await screen.findByText(/Todavía no hay ejercicios/)
  })

  it("cuenta el fallo de red y vuelve a pedir la lista al reintentar", async () => {
    const api = apiEnMemoria([PRESS])
    const buscar = api.buscar
    let fallos = 1
    api.buscar = (filtros) =>
      fallos-- > 0 ? Promise.reject(new ErrorDeRed("sin cobertura")) : buscar(filtros)

    await pintar(api)

    await screen.findByText(/No hemos podido conectar/)
    expect(screen.getByRole("alert")).toHaveTextContent(/No hemos podido conectar/)
    await fireEvent.press(screen.getByRole("button", { name: "REINTENTAR" }))
    await screen.findByRole("button", { name: "Press de banca. Pecho" })
  })

  it("busca por nombre cuando el entrenador deja de teclear", async () => {
    await pintar(apiEnMemoria([PRESS, SENTADILLA]))
    await screen.findByRole("button", { name: "Press de banca. Pecho" })

    await fireEvent.changeText(screen.getByLabelText("Buscar ejercicio"), "senta")

    // Sentadilla ya estaba a la vista: lo que prueba la búsqueda es que el press se va.
    await waitFor(() => {
      expect(screen.queryByRole("button", { name: "Press de banca. Pecho" })).toBeNull()
    })
    expect(screen.getByRole("button", { name: "Sentadilla. Cuádriceps" })).toBeOnTheScreen()
  })

  it("distingue una búsqueda sin resultados de un catálogo vacío", async () => {
    await pintar(apiEnMemoria([PRESS]))
    await screen.findByRole("button", { name: "Press de banca. Pecho" })

    await fireEvent.changeText(screen.getByLabelText("Buscar ejercicio"), "remo")

    await screen.findByText(/Ningún ejercicio coincide/)
  })

  it("filtra por grupo muscular, sea principal o secundario", async () => {
    await pintar(apiEnMemoria([PRESS, SENTADILLA, FONDOS]))
    await screen.findByRole("button", { name: "Sentadilla. Cuádriceps" })

    await fireEvent.press(screen.getByRole("button", { name: "Filtrar por Pecho" }))

    await waitFor(() => {
      expect(screen.queryByRole("button", { name: "Sentadilla. Cuádriceps" })).toBeNull()
    })
    expect(screen.getByRole("button", { name: "Press de banca. Pecho" })).toBeOnTheScreen()
    expect(screen.getByRole("button", { name: "Fondos. Tríceps" })).toBeOnTheScreen()
    expect(screen.getByRole("button", { name: "Filtrar por Pecho" })).toBeSelected()
  })

  it("avisa cuando el servidor tiene más ejercicios de los que caben en la lista", async () => {
    await pintar(apiEnMemoria([PRESS, SENTADILLA], 140))

    await screen.findByText(/Mostrando 2 de 140/)
  })

  it("da acceso al alta y a la edición de un ejercicio", async () => {
    const onNuevo = jest.fn()
    const onAbrir = jest.fn()
    await pintar(apiEnMemoria([PRESS]), { onNuevo, onAbrir })

    await fireEvent.press(screen.getByRole("button", { name: "Crear un ejercicio nuevo" }))
    await fireEvent.press(await screen.findByRole("button", { name: "Press de banca. Pecho" }))

    expect(onNuevo).toHaveBeenCalledTimes(1)
    expect(onAbrir).toHaveBeenCalledWith(PRESS.id)
  })
})
