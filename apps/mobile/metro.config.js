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

/**
 * Hace que Metro respete el campo `exports` de los paquetes en lugar de guiarse
 * solo por `main` y `module`.
 *
 * Sin esto, `react-hook-form` no se resuelve: su campo `module` apunta a un
 * fichero `.mjs` que Metro no sigue por esa via, aunque el fichero exista. Con
 * `exports` activado elige la entrada correcta y el paquete carga.
 *
 * Es ademas la direccion a la que va el ecosistema: cada vez mas paquetes
 * describen sus entradas solo con `exports`.
 */
config.resolver.unstable_enablePackageExports = true

module.exports = config
