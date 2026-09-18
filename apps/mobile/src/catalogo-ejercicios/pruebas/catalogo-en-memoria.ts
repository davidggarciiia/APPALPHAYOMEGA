import {
  CrearEjercicioSchema,
  EjercicioSchema,
  ListadoEjerciciosSchema,
  type CrearEjercicio,
  type Ejercicio,
  type GrupoMuscular,
} from "@alpha-omega/shared"

import { ErrorDelServidor } from "../../lib/api"

import { ErrorDeNombreDuplicado, type ApiDeCatalogo } from "../api"

/**
 * Datos de prueba, no respuestas del servidor.
 *
 * Pasan por el esquema compartido para que un cambio de contrato rompa en las
 * pruebas y no en el móvil de nadie. La comprobación contra la API real es aparte.
 */
export function ejercicioDePrueba(
  id: string,
  nombre: string,
  grupoPrincipal: GrupoMuscular,
  gruposSecundarios: GrupoMuscular[] = [],
  estado: Ejercicio["estado"] = "publicado",
): Ejercicio {
  return EjercicioSchema.parse({
    id,
    nombre,
    grupoPrincipal,
    gruposSecundarios,
    instrucciones: "Baja controlando y sube sin bloquear.",
    estado,
    figura: null,
    video: null,
  })
}

function normalizar(nombre: string): string {
  return nombre.trim().replace(/\s+/g, " ").toLowerCase()
}

/**
 * Catálogo para las pruebas de pantalla, con el comportamiento que el plan pide
 * al servidor: filtra por nombre, grupo y estado, y rechaza nombres repetidos.
 *
 * `total` permite fingir un catálogo más grande que la página devuelta.
 */
export function catalogoEnMemoria(iniciales: Ejercicio[] = [], total?: number): ApiDeCatalogo {
  const ejercicios = [...iniciales]
  let creados = 0

  function guardar(datos: CrearEjercicio, id: string, estado: Ejercicio["estado"]): Ejercicio {
    const limpio = CrearEjercicioSchema.parse(datos)
    const repetido = ejercicios.some(
      (fila) => fila.id !== id && normalizar(fila.nombre) === normalizar(limpio.nombre),
    )
    if (repetido) throw new ErrorDeNombreDuplicado()

    return EjercicioSchema.parse({
      id,
      ...limpio,
      estado,
      figura: null,
      video: null,
    })
  }

  function cambiarEstado(id: string, estado: Ejercicio["estado"]): Ejercicio {
    const posicion = ejercicios.findIndex((fila) => fila.id === id)
    const anterior = ejercicios[posicion]
    if (anterior === undefined) throw new ErrorDelServidor(404)

    const cambiado = { ...anterior, estado }
    ejercicios[posicion] = cambiado

    return cambiado
  }

  return {
    buscar: async (filtros) => {
      const texto = normalizar(filtros.buscar ?? "")
      // Sin pedirlo, solo los publicados: es el valor por defecto del contrato.
      const estado = filtros.estado ?? "publicado"
      const filas = ejercicios.filter(
        (fila) =>
          (estado === "todos" || fila.estado === estado) &&
          normalizar(fila.nombre).includes(texto) &&
          (filtros.grupo === undefined ||
            fila.grupoPrincipal === filtros.grupo ||
            fila.gruposSecundarios.includes(filtros.grupo)),
      )

      return ListadoEjerciciosSchema.parse({ ejercicios: filas, total: total ?? filas.length })
    },

    leer: async (id) => {
      const encontrado = ejercicios.find((fila) => fila.id === id)
      if (encontrado === undefined) throw new ErrorDelServidor(404)

      return encontrado
    },

    crear: async (datos) => {
      creados += 1
      const id = `3f2b8c1e-4d5a-4f6b-8a9c-${String(creados).padStart(12, "0")}`
      const creado = guardar(datos, id, "publicado")
      ejercicios.push(creado)

      return creado
    },

    editar: async (id, datos) => {
      const posicion = ejercicios.findIndex((fila) => fila.id === id)
      const anterior = ejercicios[posicion]
      if (anterior === undefined) throw new ErrorDelServidor(404)

      // Editar el texto no repone un ejercicio retirado.
      const editado = guardar(datos, id, anterior.estado)
      ejercicios[posicion] = editado

      return editado
    },

    retirar: async (id) => cambiarEstado(id, "retirado"),
    reponer: async (id) => cambiarEstado(id, "publicado"),
  }
}
