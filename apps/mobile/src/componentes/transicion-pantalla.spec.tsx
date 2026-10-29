import { useState } from "react"
import { AccessibilityInfo, Pressable, Text, TextInput } from "react-native"
import { router, Stack, type Href } from "expo-router"
import { act, fireEvent, renderRouter, screen } from "expo-router/testing-library"
import * as Reanimated from "react-native-reanimated"

import { envolverPantalla } from "./transicion-pantalla"

beforeEach(() => jest.spyOn(Reanimated, "withTiming"))

afterEach(() => {
  jest.restoreAllMocks()
  jest.useRealTimers()
})

function Inicio(): React.JSX.Element {
  const [texto, fijar] = useState("")
  return (
    <>
      <TextInput accessibilityLabel="Borrador" value={texto} onChangeText={fijar} />
      <Pressable accessibilityRole="button" onPress={() => router.push("/detalle" as Href)}>
        <Text>Abrir detalle</Text>
      </Pressable>
    </>
  )
}

it.each([false, true])(
  "la pila conserva borradores e interacción al enfocar y volver (reducido: %s)",
  async (reducido) => {
    jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(reducido)
    const vista = renderRouter(
      {
        _layout: () => (
          <Stack
            screenLayout={envolverPantalla}
            screenOptions={{ headerShown: false, animation: "none" }}
          />
        ),
        index: Inicio,
        detalle: () => <Text>Detalle</Text>,
      },
      { initialUrl: "/" },
    )
    await vista
    await fireEvent.changeText(await screen.findByLabelText("Borrador"), "Sin perder")
    jest.mocked(Reanimated.withTiming).mockClear()
    await fireEvent.press(screen.getByRole("button", { name: "Abrir detalle" }))
    expect(vista.getPathname()).toBe("/detalle")
    expect(await screen.findByText("Detalle")).toBeOnTheScreen()
    if (reducido) expect(Reanimated.withTiming).not.toHaveBeenCalled()
    else
      expect(Reanimated.withTiming).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ duration: 220 }),
      )

    jest.mocked(Reanimated.withTiming).mockClear()
    await act(() => router.back())
    expect(vista.getPathname()).toBe("/")
    expect(await screen.findByDisplayValue("Sin perder")).toBeOnTheScreen()
    if (reducido) expect(Reanimated.withTiming).not.toHaveBeenCalled()
    else
      expect(Reanimated.withTiming).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ duration: 220 }),
      )
  },
)
