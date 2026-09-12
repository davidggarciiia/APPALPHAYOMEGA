const path = require("node:path")

const { getDefaultConfig } = require("expo/metro-config")

/**
 * Metro por defecto solo mira dentro de la carpeta de la app. En un monorepo eso
 * no basta: `@alpha-omega/shared` vive fuera y las dependencias estan izadas a la
 * raiz. Estas tres lineas le ensenan donde buscar.
 */
const raizApp = __dirname
const raizMonorepo = path.resolve(raizApp, "..", "..")

const config = getDefaultConfig(raizApp)

config.watchFolders = [raizMonorepo]
config.resolver.nodeModulesPaths = [
  path.resolve(raizApp, "node_modules"),
  path.resolve(raizMonorepo, "node_modules"),
]
config.resolver.disableHierarchicalLookup = true

module.exports = config
