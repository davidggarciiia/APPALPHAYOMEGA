/* global jest */
/*
 * Reanimated y Worklets arrancan un runtime nativo al importarse. En Jest se
 * sustituyen por sus dobles oficiales: las animaciones se dan por terminadas
 * al instante, que es lo que un test de comportamiento necesita.
 */
jest.mock("react-native-worklets", () => require("react-native-worklets/src/mock"))
jest.mock("react-native-reanimated", () => {
  const doble = require("react-native-reanimated/mock")
  // El doble oficial no trae la API de CSS de Reanimated 4 que usa `Pulsable`,
  // ni `useReducedMotion`, que lee `useMovimientoReducido` hasta que contesta el
  // sistema. En los tests el sistema no pide reducir movimiento.
  return {
    ...doble,
    __esModule: true,
    default: doble.default ?? doble,
    useReducedMotion: () => false,
    cubicBezier: () => "ease-out",
    css: { create: (estilos) => estilos, keyframes: (fotogramas) => fotogramas },
  }
})
