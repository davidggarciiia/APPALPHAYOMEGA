import type { PersistenciaCifrada } from "./almacen-local"

// Adaptador de desarrollo web. El navegador no ofrece el llavero nativo.
const prefijo = (cuenta: string): string => `ao.documento.${cuenta}.`
export const persistencia: PersistenciaCifrada = {
  leer: async (cuenta, clave) => localStorage.getItem(prefijo(cuenta) + clave),
  escribir: async (cuenta, clave, valor) => {
    localStorage.setItem(prefijo(cuenta) + clave, valor)
  },
  borrar: async (cuenta, clave) => {
    localStorage.removeItem(prefijo(cuenta) + clave)
  },
  listar: async (cuenta) =>
    Object.keys(localStorage)
      .filter((clave) => clave.startsWith(prefijo(cuenta)))
      .map((clave) => clave.slice(prefijo(cuenta).length)),
  limpiar: async (cuenta) => {
    for (const clave of Object.keys(localStorage))
      if (clave.startsWith(prefijo(cuenta))) localStorage.removeItem(clave)
  },
}
