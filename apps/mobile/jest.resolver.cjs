const path = require("node:path")
const reanimatedResolver = require("react-native-reanimated/jest/resolver")

module.exports = (request, options) => {
  let basedir = options.basedir
  // npm puede anidar estas dependencias bajo Expo; Jest usa la copia del SDK.
  if (/^(expo-modules-core|expo-asset)(?:\/|$)/.test(request)) {
    basedir = path.dirname(require.resolve("expo/package.json"))
  } else if (/^(react|react-dom|react-reconciler)(?:\/|$)/.test(request)) {
    // Las librerías elevadas a la raíz también usan el React del móvil.
    basedir = __dirname
  } else if (/^test-renderer(?:\/|$)/.test(request)) {
    // El renderer del preset 58 soporta React 19.3; el antiguo 1.2 no.
    basedir = path.dirname(require.resolve("jest-expo/package.json"))
  }
  return reanimatedResolver(request, { ...options, basedir })
}
