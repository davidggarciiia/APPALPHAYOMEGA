import { jest } from "@jest/globals"

// Reanimated y Worklets necesitan su parte nativa; en Jest se usan sus dobles oficiales.
// `useReducedMotion` no está en el doble, por eso los botones leen AccessibilityInfo.
jest.mock("react-native-worklets", () => require("react-native-worklets/src/mock"))
jest.mock("react-native-reanimated", () => require("react-native-reanimated/mock"))
