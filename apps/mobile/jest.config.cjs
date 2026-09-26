/**
 * Tests de la app con el preset de Expo.
 *
 * Los tests viven en `src/`, nunca en `app/`: Expo Router trataría cualquier
 * fichero de `app/` como una ruta.
 */
module.exports = {
  preset: "jest-expo",
  roots: ["<rootDir>/src"],
  testMatch: ["**/*.spec.ts", "**/*.spec.tsx"],
  setupFiles: ["<rootDir>/jest.setup.cjs"],
}
