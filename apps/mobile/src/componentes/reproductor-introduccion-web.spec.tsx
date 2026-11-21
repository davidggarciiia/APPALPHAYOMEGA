import { fireEvent, render, screen } from "@testing-library/react-native"

import { ReproductorIntroduccion } from "./reproductor-introduccion.web"

jest.mock("expo-video/build/VideoPlayer.web", () => ({
  getSourceUri: () => "/assets/intro.mp4",
}))

it("reproduce la intro web sin controles ni sonido mediante autoplay del navegador", async () => {
  await render(<ReproductorIntroduccion alEmpezar={jest.fn()} alTerminar={jest.fn()} />)
  const video = screen.container.queryAll((nodo) => nodo.type === "video")[0]
  expect(video).toBeDefined()
  expect(video!.props).toMatchObject({
    src: "/assets/intro.mp4",
    autoPlay: true,
    muted: true,
    playsInline: true,
    controls: false,
    "aria-hidden": true,
    tabIndex: -1,
  })
})

it("avisa al comenzar y deja continuar la app al acabar o fallar el vídeo web", async () => {
  const empezar = jest.fn()
  const terminar = jest.fn()
  await render(<ReproductorIntroduccion alEmpezar={empezar} alTerminar={terminar} />)
  const video = screen.container.queryAll((nodo) => nodo.type === "video")[0]!
  await fireEvent(video, "playing")
  expect(empezar).toHaveBeenCalledTimes(1)
  await fireEvent(video, "ended")
  expect(terminar).toHaveBeenCalledTimes(1)
  await fireEvent(video, "error")
  expect(terminar).toHaveBeenCalledTimes(2)
})
