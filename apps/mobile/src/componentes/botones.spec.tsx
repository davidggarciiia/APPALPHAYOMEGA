import { describe, it, jest } from "@jest/globals"
import { Profiler } from "react"
import { AccessibilityInfo, Platform, StyleSheet } from "react-native"
import { withRepeat, withSpring, withTiming } from "react-native-reanimated"
import { act, fireEvent, render, screen, userEvent, waitFor } from "@testing-library/react-native"
import * as Haptics from "expo-haptics"

import { BotonDestructivo, BotonEnlace, BotonPrincipal, BotonSecundario, vibrar } from "./botones"

// Los dobles de Reanimated aplican el valor sin animar; se envuelven las dos
// animaciones para comprobar cuándo se piden (muelle al pulsar, ola al cargar).
jest.mock("react-native-reanimated", () => {
  const doble = jest.requireActual<Record<string, (...argumentos: unknown[]) => unknown>>(
    "react-native-reanimated/mock",
  )
  return {
    ...doble,
    withSpring: jest.fn(doble.withSpring),
    withRepeat: jest.fn(doble.withRepeat),
    withTiming: jest.fn(doble.withTiming),
  }
})
jest.mock("expo-haptics", () => ({
  impactAsync: jest.fn(() => Promise.resolve()),
  notificationAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: { Light: "light" },
  NotificationFeedbackType: { Success: "success", Warning: "warning", Error: "error" },
}))

const medida = { nativeEvent: { layout: { width: 220, height: 52 } } }
// Las capas decorativas están ocultas a los lectores de pantalla (y a las consultas por defecto).
const decorativo = { includeHiddenElements: true }

/** Entrega al botón la medida que en el dispositivo le da el diseño. */
async function medir(texto: string): Promise<void> {
  const cuerpo = screen.getByText(texto).parent
  if (!cuerpo) throw new Error("El texto del botón no tiene cuerpo")
  await fireEvent(cuerpo, "layout", medida)
}

function movimientoReducido(activo: boolean): void {
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValueOnce(activo)
}

describe.each<[string, typeof BotonPrincipal]>([
  ["principal", BotonPrincipal],
  ["secundario", BotonSecundario],
  ["destructivo", BotonDestructivo],
])("Botón %s", (_nombre, Boton) => {
  it("normal: es un botón con nombre, llama a onPress una vez y vibra suave al pulsar", async () => {
    const guardar = jest.fn()
    await render(<Boton texto="Guardar" onPress={guardar} />)
    const boton = screen.getByRole("button", { name: "Guardar" })
    expect(boton).toBeEnabled()
    expect(boton.props.accessibilityState).toEqual({ disabled: false, busy: false })

    // Pulsación real (pressIn, pressOut y onPress) en vez de llamar a los manejadores.
    await userEvent.setup().press(boton)
    expect(guardar).toHaveBeenCalledTimes(1)
    expect(Haptics.impactAsync).toHaveBeenCalledTimes(1)
    expect(Haptics.impactAsync).toHaveBeenCalledWith("light")
    expect(withSpring).toHaveBeenCalled()
  })

  it("etiquetaAccesible sustituye al nombre sin cambiar el texto visible", async () => {
    await render(<Boton texto="Sí" etiquetaAccesible="Sí, borrar el plan" onPress={jest.fn()} />)
    expect(screen.getByRole("button", { name: "Sí, borrar el plan" })).toBeOnTheScreen()
    expect(screen.getByText("Sí")).toBeOnTheScreen()
  })

  it("sinMargen quita el margen superior propio, para alinear varios botones en una fila", async () => {
    const margen = (boton: ReturnType<typeof screen.getByRole>): unknown =>
      (StyleSheet.flatten(boton.props.style as object) as { marginTop?: number }).marginTop
    await render(
      <>
        <Boton texto="Con margen" onPress={jest.fn()} />
        <Boton texto="Sin margen" onPress={jest.fn()} sinMargen />
      </>,
    )
    expect(margen(screen.getByRole("button", { name: "Con margen" }))).toBeGreaterThan(0)
    expect(margen(screen.getByRole("button", { name: "Sin margen" }))).toBe(0)
  })

  it("compacto conserva 52 px táctiles y deja espacio al texto de los accesos en fila", async () => {
    await render(<Boton texto="Crear plan nuevo" onPress={jest.fn()} compacto sinMargen />)
    const texto = screen.getByText("Crear plan nuevo")
    expect(StyleSheet.flatten(texto.parent?.props.style)).toMatchObject({
      minHeight: 52,
      paddingHorizontal: 12,
    })
    expect(StyleSheet.flatten(texto.props.style)).toMatchObject({
      fontSize: 14,
      lineHeight: 20,
      letterSpacing: 0.4,
    })
  })

  it("ocupado: conserva el nombre, anuncia la carga y no admite otra pulsación", async () => {
    const guardar = jest.fn()
    await render(<Boton texto="Guardar" onPress={guardar} ocupado />)
    const boton = screen.getByRole("button", { name: "Guardar" })
    expect(boton).toBeDisabled()
    expect(boton.props.accessibilityState).toEqual({ disabled: true, busy: true })
    expect(screen.getByTestId("boton-puntos", decorativo)).toBeOnTheScreen()
    expect(withRepeat).toHaveBeenCalled()
    await fireEvent.press(boton)
    expect(guardar).not.toHaveBeenCalled()
    expect(Haptics.impactAsync).not.toHaveBeenCalled()
  })

  it("deshabilitado: no carga, no vibra y no llama a onPress", async () => {
    const guardar = jest.fn()
    await render(<Boton texto="Guardar" onPress={guardar} deshabilitado />)
    const boton = screen.getByRole("button", { name: "Guardar" })
    expect(boton).toBeDisabled()
    expect(boton.props.accessibilityState).toEqual({ disabled: true, busy: false })
    expect(screen.queryByTestId("boton-puntos", decorativo)).toBeNull()
    await fireEvent(boton, "pressIn")
    await fireEvent.press(boton)
    expect(guardar).not.toHaveBeenCalled()
    expect(Haptics.impactAsync).not.toHaveBeenCalled()
  })

  it("el objetivo táctil mide al menos 48 px de alto", async () => {
    await render(<Boton texto="Guardar" onPress={jest.fn()} />)
    const cuerpo = screen.getByText("Guardar").parent
    expect(StyleSheet.flatten(cuerpo?.props.style).minHeight).toBeGreaterThanOrEqual(48)
  })

  it("con movimiento reducido no hay muelle ni destello, solo borde y opacidad", async () => {
    movimientoReducido(true)
    const guardar = jest.fn()
    await render(<Boton texto="Guardar" onPress={guardar} />)
    await waitFor(() => expect(AccessibilityInfo.isReduceMotionEnabled).toHaveBeenCalled())
    await screen.rerender(<Boton texto="Guardar" onPress={guardar} ocupado />)
    // La carga sigue visible, pero fija.
    expect(screen.getByTestId("boton-puntos", decorativo)).toBeOnTheScreen()
    expect(withRepeat).not.toHaveBeenCalled()
    await screen.rerender(<Boton texto="Guardar" onPress={guardar} />)
    const boton = screen.getByRole("button", { name: "Guardar" })
    await fireEvent(boton, "pressIn")
    await fireEvent(boton, "pressOut")
    expect(withSpring).not.toHaveBeenCalled()
    expect(withTiming).not.toHaveBeenCalled()
    expect(screen.queryByTestId("boton-brillo", decorativo)).toBeNull()
    await fireEvent.press(boton)
    expect(guardar).toHaveBeenCalledTimes(1)
  })

  it("pulsar, pasar el ratón y enfocar no renderizan de nuevo; la medida se toma una vez", async () => {
    const confirmaciones = jest.fn()
    await render(
      <Profiler id="boton" onRender={confirmaciones}>
        <Boton texto="Guardar" onPress={jest.fn()} />
      </Profiler>,
    )
    const boton = screen.getByRole("button", { name: "Guardar" })
    expect(screen.queryByTestId("boton-borde", decorativo)).toBeNull()

    await medir("Guardar")
    expect(screen.getByTestId("boton-borde", decorativo)).toBeOnTheScreen()
    const trasMedir = confirmaciones.mock.calls.length

    await medir("Guardar")
    await fireEvent(boton, "pressIn")
    await fireEvent(boton, "pressOut")
    await fireEvent(boton, "hoverIn")
    await fireEvent(boton, "hoverOut")
    await fireEvent(boton, "focus")
    await fireEvent(boton, "blur")
    expect(confirmaciones).toHaveBeenCalledTimes(trasMedir)
  })

  it("el bisel, el borde y el destello son decorativos para los lectores de pantalla", async () => {
    await render(<Boton texto="Guardar" onPress={jest.fn()} />)
    await medir("Guardar")
    const borde = screen.getByTestId("boton-borde", decorativo)
    expect(borde.props.importantForAccessibility).toBe("no-hide-descendants")
    expect(borde.props.accessible).toBe(false)
  })
})

it("el destello diagonal es solo del principal y con movimiento permitido", async () => {
  await render(<BotonPrincipal texto="Guardar" onPress={jest.fn()} />)
  expect(screen.getByTestId("boton-brillo", decorativo)).toBeOnTheScreen()
  await screen.unmount()

  await render(<BotonSecundario texto="Cancelar" onPress={jest.fn()} />)
  expect(screen.queryByTestId("boton-brillo", decorativo)).toBeNull()
})

it("el principal barre una sola vez a los 600 ms y al pulsarlo", async () => {
  jest.useFakeTimers()
  try {
    await render(<BotonPrincipal texto="Guardar" onPress={jest.fn()} />)
    const barridos = () =>
      jest.mocked(withTiming).mock.calls.filter(([, opciones]) => opciones?.duration === 420)
    await act(() => jest.advanceTimersByTime(599))
    expect(barridos()).toHaveLength(0)
    await act(() => jest.advanceTimersByTime(1))
    expect(barridos()).toHaveLength(1)
    await act(() => jest.advanceTimersByTime(5000))
    expect(barridos()).toHaveLength(1)
    await fireEvent(screen.getByRole("button", { name: "Guardar" }), "pressIn")
    expect(barridos()).toHaveLength(2)
  } finally {
    jest.useRealTimers()
  }
})

describe("destructivo con mantener pulsado", () => {
  it("un toque no confirma; mantener pulsado llama a onPress una vez y avisa con vibración", async () => {
    const borrar = jest.fn()
    await render(<BotonDestructivo texto="Eliminar" onPress={borrar} mantenerParaConfirmar />)
    const boton = screen.getByRole("button", { name: "Eliminar" })
    expect(boton.props.accessibilityHint).toBe("Mantén pulsado para confirmar")
    expect(screen.getByText("Mantén pulsado")).toBeOnTheScreen()

    const usuario = userEvent.setup()
    await usuario.press(boton)
    expect(borrar).not.toHaveBeenCalled()

    await usuario.longPress(boton, { duration: 1000 })
    expect(borrar).toHaveBeenCalledTimes(1)
    expect(Haptics.notificationAsync).toHaveBeenCalledWith("warning")
  })

  it("con lector de pantalla la acción activar confirma directamente", async () => {
    const borrar = jest.fn()
    await render(<BotonDestructivo texto="Eliminar" onPress={borrar} mantenerParaConfirmar />)
    await fireEvent(screen.getByRole("button", { name: "Eliminar" }), "accessibilityAction", {
      nativeEvent: { actionName: "activate" },
    })
    expect(borrar).toHaveBeenCalledTimes(1)
  })

  it("pinta la barra de confirmación solo en ese modo", async () => {
    await render(<BotonDestructivo texto="Eliminar" onPress={jest.fn()} mantenerParaConfirmar />)
    await medir("Eliminar")
    expect(screen.getByTestId("boton-barra", decorativo)).toBeOnTheScreen()
    await screen.unmount()

    await render(<BotonDestructivo texto="Eliminar" onPress={jest.fn()} />)
    await medir("Eliminar")
    expect(screen.queryByTestId("boton-barra", decorativo)).toBeNull()
    expect(screen.queryByText("Mantén pulsado")).toBeNull()
  })

  it("por defecto basta un toque y no hay pista", async () => {
    const borrar = jest.fn()
    await render(<BotonDestructivo texto="Eliminar" onPress={borrar} />)
    await userEvent.setup().press(screen.getByRole("button", { name: "Eliminar" }))
    expect(borrar).toHaveBeenCalledTimes(1)
  })

  it("mantener con movimiento reducido confirma y vibra sin interpolar la barra", async () => {
    movimientoReducido(true)
    const borrar = jest.fn()
    await render(<BotonDestructivo texto="Eliminar" onPress={borrar} mantenerParaConfirmar />)
    await userEvent
      .setup()
      .longPress(screen.getByRole("button", { name: "Eliminar" }), { duration: 1000 })
    expect(borrar).toHaveBeenCalledTimes(1)
    expect(Haptics.notificationAsync).toHaveBeenCalledWith("warning")
    expect(withTiming).not.toHaveBeenCalled()
    expect(withSpring).not.toHaveBeenCalled()
  })
})

describe("web", () => {
  it("dibuja el anillo de foco solo en web y no vibra", async () => {
    await render(<BotonPrincipal texto="Guardar" onPress={jest.fn()} />)
    await medir("Guardar")
    expect(screen.queryByTestId("boton-anillo", decorativo)).toBeNull()
    await screen.unmount()

    const web = jest.replaceProperty(Platform, "OS", "web")
    await render(<BotonPrincipal texto="Guardar" onPress={jest.fn()} />)
    await medir("Guardar")
    expect(screen.getByTestId("boton-anillo", decorativo)).toBeOnTheScreen()
    await fireEvent(screen.getByRole("button", { name: "Guardar" }), "pressIn")
    expect(Haptics.impactAsync).not.toHaveBeenCalled()
    web.restore()
  })
})

describe("vibrar", () => {
  it("elige la vibración de cada resultado y no falla si no hay motor háptico", async () => {
    vibrar("exito")
    vibrar("error")
    expect(Haptics.notificationAsync).toHaveBeenNthCalledWith(1, "success")
    expect(Haptics.notificationAsync).toHaveBeenNthCalledWith(2, "error")

    jest.mocked(Haptics.notificationAsync).mockRejectedValueOnce(new Error("sin motor"))
    expect(() => vibrar("aviso")).not.toThrow()
  })
})

describe("BotonEnlace", () => {
  it.each(["Volver", "HE OLVIDADO MI CONTRASEÑA"])(
    "centra el acento bajo todo el texto de «%s»",
    async (texto) => {
      await render(<BotonEnlace texto={texto} onPress={jest.fn()} />)
      const contenido = screen.getByText(texto).parent
      const subrayado = contenido?.children[1]
      if (typeof subrayado !== "object" || subrayado === null)
        throw new Error("El enlace no tiene subrayado")
      expect(StyleSheet.flatten(subrayado.props.style)).toMatchObject({
        left: 0,
        right: 0,
        transformOrigin: "50% 50%",
      })
    },
  )

  it("conserva el muelle de pulsación y la transición al pasar el ratón", async () => {
    await render(<BotonEnlace texto="Volver" onPress={jest.fn()} />)
    const enlace = screen.getByRole("button", { name: "Volver" })
    await fireEvent(enlace, "pressIn")
    await fireEvent(enlace, "pressOut")
    expect(withSpring).toHaveBeenCalledWith(1, expect.any(Object))
    expect(withSpring).toHaveBeenCalledWith(0, expect.any(Object))
    await fireEvent(enlace, "hoverIn")
    await fireEvent(enlace, "hoverOut")
    expect(withTiming).toHaveBeenCalledWith(1, { duration: 120 })
    expect(withTiming).toHaveBeenCalledWith(0, { duration: 160 })
  })

  it("con movimiento reducido responde a pulsación y ratón sin interpolar", async () => {
    movimientoReducido(true)
    const volver = jest.fn()
    await render(<BotonEnlace texto="Volver" onPress={volver} />)
    const enlace = screen.getByRole("button", { name: "Volver" })
    await fireEvent(enlace, "pressIn")
    await fireEvent(enlace, "pressOut")
    await fireEvent(enlace, "hoverIn")
    await fireEvent(enlace, "hoverOut")
    await fireEvent(enlace, "focus")
    await fireEvent(enlace, "blur")
    await fireEvent.press(enlace)
    expect(volver).toHaveBeenCalledTimes(1)
    expect(withSpring).not.toHaveBeenCalled()
    expect(withTiming).not.toHaveBeenCalled()
  })

  it("es un botón con nombre, llama a onPress una vez y mide al menos 48 px", async () => {
    const volver = jest.fn()
    await render(<BotonEnlace texto="Volver" onPress={volver} etiquetaAccesible="Volver a login" />)
    const enlace = screen.getByRole("button", { name: "Volver a login" })
    expect(enlace).toBeEnabled()
    expect(StyleSheet.flatten(enlace.props.style).minHeight).toBeGreaterThanOrEqual(48)
    await fireEvent(enlace, "pressIn")
    await fireEvent.press(enlace)
    expect(volver).toHaveBeenCalledTimes(1)
  })

  it("deshabilitado no llama a onPress", async () => {
    const volver = jest.fn()
    await render(<BotonEnlace texto="Volver" onPress={volver} deshabilitado />)
    const enlace = screen.getByRole("button", { name: "Volver" })
    expect(enlace).toBeDisabled()
    await fireEvent.press(enlace)
    expect(volver).not.toHaveBeenCalled()
  })
})
