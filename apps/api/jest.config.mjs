/**
 * Tests unitarios. Los de extremo a extremo usan test/jest-e2e.json.
 *
 * La API es ESM porque NestJS 12 lo es. Eso obliga a tres cosas aqui:
 *  - `extensionsToTreatAsEsm` para que Jest no intente cargar los .ts como CommonJS
 *  - `useESM` en ts-jest, para que compile a modulos y no a require()
 *  - el mapeo que quita el `.js` de los imports relativos: en el codigo fuente
 *    escribimos la extension de lo que habra tras compilar, pero Jest tiene que
 *    encontrar el fichero .ts que existe ahora
 */
export default {
  moduleFileExtensions: ["js", "json", "ts"],
  rootDir: "src",
  testEnvironment: "node",
  testRegex: ".*\\.spec\\.ts$",
  extensionsToTreatAsEsm: [".ts"],
  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1",
  },
  setupFiles: ["<rootDir>/../test/setup-entorno.ts"],
  transform: {
    "^.+\\.ts$": ["ts-jest", { useESM: true, tsconfig: "<rootDir>/../tsconfig.json" }],
  },
  collectCoverageFrom: ["**/*.service.ts", "**/*.guard.ts"],
}
