const { getDefaultConfig } = require("expo/metro-config")

/**
 * Expo detecta los workspaces y resuelve las dependencias desde su consumidor.
 * Forzar una búsqueda plana hace que Expo cargue dependencias de Jest del móvil
 * con versiones incompatibles, aunque el lockfile tenga ambas versiones correctas.
 */
module.exports = getDefaultConfig(__dirname)
