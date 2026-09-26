/**
 * Tests de la app con el preset de Expo.
 *
 * `jest-expo` simula los modulos nativos (llavero, constantes, enrutador) para
 * que los componentes se puedan montar en Node. Eso significa que un test en
 * verde aqui NO demuestra que algo funcione en un telefono: lo que toca el
 * llavero de verdad, la red del movil o el motor de JavaScript de Hermes se
 * comprueba en un dispositivo y se anota aparte.
 *
 * Los tests viven en `src/`, junto a lo que prueban. Nunca dentro de `app/`:
 * Expo Router trata cada fichero de esa carpeta como una ruta de la aplicacion.
 */
module.exports = {
  preset: "jest-expo",
  roots: ["<rootDir>/src"],
  testMatch: ["**/*.spec.ts", "**/*.spec.tsx"],
  // Dobles en memoria del llavero, que no existe fuera del teléfono.
  setupFiles: ["<rootDir>/jest.setup.cjs"],
}
