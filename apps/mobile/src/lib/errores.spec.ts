import { faltaDe } from "./errores"
import { ErrorDePermiso, ErrorDePeticion, ErrorDeRed } from "./http"

it("un acceso denegado no atribuye la pantalla a un rol concreto", () => {
  expect(faltaDe(new ErrorDePermiso(), "No se pudo cargar.")).toEqual({
    texto: "No tienes permiso para acceder a estos datos.",
    reintentable: false,
    sesionCaducada: false,
  })
})

it("sin consentimiento enseña el motivo del servidor y no ofrece reintentar", () => {
  const falta = faltaDe(
    new ErrorDePeticion({
      statusCode: 409,
      codigo: "consentimiento_pendiente",
      message: "Este cliente aún no ha dado su consentimiento para tratar sus datos de salud.",
    }),
    "No se pudo guardar.",
  )
  expect(falta).toEqual({
    texto: "Este cliente aún no ha dado su consentimiento para tratar sus datos de salud.",
    reintentable: false,
    sesionCaducada: false,
  })
})

it("otros conflictos siguen usando el texto de respaldo", () => {
  const falta = faltaDe(
    new ErrorDePeticion({ statusCode: 409, codigo: "revision_obsoleta", message: "x" }),
    "No se pudo guardar.",
  )
  expect(falta.texto).toBe("No se pudo guardar.")
  expect(faltaDe(new ErrorDeRed(), "No se pudo guardar.").reintentable).toBe(true)
})
