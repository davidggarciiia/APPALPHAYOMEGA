import { renderHook } from "@testing-library/react-native"

import { useEnvioUnico } from "./envio-unico"

it("lanza la acción una sola vez mientras la anterior no ha terminado", async () => {
  let terminar = (): void => undefined
  const accion = jest.fn(
    () =>
      new Promise<void>((resolver) => {
        terminar = resolver
      }),
  )
  const { result } = await renderHook(() => useEnvioUnico(accion))

  result.current()
  result.current()
  expect(accion).toHaveBeenCalledTimes(1)

  terminar()
  await new Promise((resolver) => setTimeout(resolver, 0))
  result.current()
  expect(accion).toHaveBeenCalledTimes(2)
})
