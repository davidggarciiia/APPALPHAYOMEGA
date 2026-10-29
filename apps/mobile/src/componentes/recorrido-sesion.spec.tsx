import { act, fireEvent, render, screen } from "@testing-library/react-native"
import { AccessibilityInfo } from "react-native"
import { withTiming } from "react-native-reanimated"
import * as Haptics from "expo-haptics"

import { RecorridoSesion } from "./recorrido-sesion"

jest.mock("react-native-reanimated", () => {
  const base = jest.requireActual("react-native-reanimated/mock")
  return { ...base, withTiming: jest.fn(base.withTiming) }
})
jest.mock("expo-haptics", () => ({
  impactAsync: jest.fn(() => Promise.resolve()),
  notificationAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: { Light: "light" },
  NotificationFeedbackType: { Success: "success", Warning: "warning", Error: "error" },
}))

beforeEach(() => jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(false))
afterEach(() => jest.restoreAllMocks())

it("expone progreso acotado y un total vacío nunca cuenta como completo", async () => {
  const vista = await render(<RecorridoSesion hechas={10} total={0} />)
  expect(screen.getByRole("progressbar").props.accessibilityValue).toEqual({
    min: 0,
    max: 0,
    now: 0,
  })
  expect(Haptics.notificationAsync).not.toHaveBeenCalled()
  await vista.rerender(<RecorridoSesion hechas={12} total={10} />)
  expect(screen.getByRole("progressbar").props.accessibilityValue).toEqual({
    min: 0,
    max: 10,
    now: 10,
  })
})

it("anima la proporción medida y solo vibra al pasar a completado", async () => {
  const vista = await render(<RecorridoSesion hechas={1} total={4} />)
  await fireEvent(screen.getByTestId("recorrido-pista"), "layout", {
    nativeEvent: { layout: { width: 200 } },
  })
  jest.mocked(withTiming).mockClear()
  await vista.rerender(<RecorridoSesion hechas={2} total={4} />)
  expect(withTiming).toHaveBeenCalledWith(0.5, expect.objectContaining({ duration: 260 }))
  await vista.rerender(<RecorridoSesion hechas={4} total={4} />)
  expect(Haptics.notificationAsync).toHaveBeenCalledTimes(1)
  await vista.rerender(<RecorridoSesion hechas={4} total={4} />)
  expect(Haptics.notificationAsync).toHaveBeenCalledTimes(1)
})

it("con movimiento reducido actualiza el progreso y conserva la háptica sin animaciones", async () => {
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(true)
  const vista = await render(<RecorridoSesion hechas={1} total={4} />)
  jest.mocked(withTiming).mockClear()
  await act(async () => {
    await vista.rerender(<RecorridoSesion hechas={4} total={4} />)
  })
  expect(screen.getByRole("progressbar").props.accessibilityValue.now).toBe(4)
  expect(Haptics.notificationAsync).toHaveBeenCalledWith("success")
  expect(withTiming).not.toHaveBeenCalled()
})
