/* global jest */
/* Dobles de los módulos nativos que no existen fuera del teléfono. */
jest.mock("expo-secure-store", () => {
  const almacen = new Map()
  return {
    WHEN_UNLOCKED_THIS_DEVICE_ONLY: 0,
    setItemAsync: jest.fn(async (clave, valor) => {
      almacen.set(clave, valor)
    }),
    getItemAsync: jest.fn(async (clave) => almacen.get(clave) ?? null),
    deleteItemAsync: jest.fn(async (clave) => {
      almacen.delete(clave)
    }),
    __almacen: almacen,
  }
})
