import { fireEvent, render, screen, within } from "@testing-library/react-native"
import { View } from "react-native"
import type { ComentarioSesion, ComentarSesion } from "@alpha-omega/shared"

import type { ApiEntrenamiento } from "../entrenamiento/api"
import { ComentariosRevision } from "./comentarios-revision"

it("separa el borrador y la operación de dos sesiones durante un reintento incierto", async () => {
  const publicado = jest.fn()
  const comentar = jest.fn(
    async (sesionId: string, datos: ComentarSesion): Promise<ComentarioSesion> => ({
      id: datos.operacionId,
      sesionId,
      ejercicioPrescritoId: null,
      ejercicio: null,
      texto: datos.texto,
      creadoEn: "2026-10-29T10:00:00Z",
      autor: { id: "entrenador", nombre: "Carlos", rol: "entrenador" },
    }),
  )
  comentar.mockRejectedValueOnce(new Error("Respuesta perdida"))
  const api = { comentar } as unknown as ApiEntrenamiento
  await render(
    <View>
      <ComentariosRevision
        sesionId="A"
        nombre="Ana"
        comentarios={[]}
        api={api}
        publicado={publicado}
        nuevoId={() => "operacion-A"}
      />
      <ComentariosRevision
        sesionId="B"
        nombre="Bea"
        comentarios={[]}
        api={api}
        publicado={publicado}
        nuevoId={() => "operacion-B"}
      />
    </View>,
  )
  const [a, b] = screen.getAllByTestId("comentarios-generales").map((grupo) => within(grupo))
  await fireEvent.changeText(screen.getByLabelText("Comentario para Ana"), "Texto de A")
  await fireEvent.press(a!.getByRole("button", { name: "Enviar comentario general" }))
  await a!.findByRole("button", { name: "Reintentar comentario general" })
  expect(screen.getByLabelText("Comentario para Ana")).toHaveProp("editable", false)
  await fireEvent.changeText(screen.getByLabelText("Comentario para Bea"), "Texto de B")
  await fireEvent.press(b!.getByRole("button", { name: "Enviar comentario general" }))
  await fireEvent.press(a!.getByRole("button", { name: "Reintentar comentario general" }))
  expect(comentar.mock.calls).toEqual([
    ["A", { operacionId: "operacion-A", ejercicioPrescritoId: null, texto: "Texto de A" }],
    ["B", { operacionId: "operacion-B", ejercicioPrescritoId: null, texto: "Texto de B" }],
    ["A", { operacionId: "operacion-A", ejercicioPrescritoId: null, texto: "Texto de A" }],
  ])
  expect(publicado).toHaveBeenNthCalledWith(1, expect.objectContaining({ sesionId: "B" }))
  expect(publicado).toHaveBeenNthCalledWith(2, expect.objectContaining({ sesionId: "A" }))
})
