import { Stack } from "expo-router"
import { StatusBar } from "expo-status-bar"

import { tema } from "../src/tema"

export default function DisposicionRaiz(): React.JSX.Element {
  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: tema.fondo },
        }}
      />
    </>
  )
}
