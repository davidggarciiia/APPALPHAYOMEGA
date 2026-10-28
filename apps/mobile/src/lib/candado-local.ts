import { Platform } from "react-native"

const colas = new Map<string, Promise<void>>()

/** En web coordina pestañas; en nativo coordina los usuarios del mismo almacén. */
export async function conRecursoLocalExclusivo<T>(
  nombre: string,
  accion: () => Promise<T>,
): Promise<T> {
  if (Platform.OS === "web") {
    if (typeof navigator === "undefined" || !navigator.locks)
      return Promise.reject(
        new Error("Este navegador no permite coordinar las copias locales entre pestañas"),
      )
    return navigator.locks.request(nombre, { mode: "exclusive" }, accion)
  }
  const siguiente = (colas.get(nombre) ?? Promise.resolve()).then(accion)
  const cola = siguiente.then(
    () => undefined,
    () => undefined,
  )
  colas.set(nombre, cola)
  void cola.then(() => {
    if (colas.get(nombre) === cola) colas.delete(nombre)
  })
  return siguiente
}
