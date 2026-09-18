import * as contratos from "@alpha-omega/shared"

describe("Errores compartidos de API", () => {
  it("permite reconocer un nombre duplicado sin comparar el mensaje", () => {
    const error = contratos.ErrorDeApiSchema.parse({
      statusCode: 409,
      codigo: "nombre_duplicado",
      message: "Elige otro nombre para este ejercicio",
    })
    expect(error.codigo).toBe("nombre_duplicado")
    expect(error.statusCode).toBe(409)
  })

  it("distingue datos inválidos de un conflicto de revisión u operación", () => {
    expect(
      contratos.ErrorDeApiSchema.parse({
        statusCode: 400,
        codigo: "solicitud_invalida",
        message: "Revisa los datos",
      }).statusCode,
    ).toBe(400)
    for (const codigo of ["revision_obsoleta", "operacion_incompatible"]) {
      expect(
        contratos.ErrorDeApiSchema.parse({ statusCode: 409, codigo, message: "Hay un conflicto" })
          .codigo,
      ).toBe(codigo)
    }
  })

  it("rechaza códigos mezclados con otro estado y datos privados adicionales", () => {
    const valido = { statusCode: 409, codigo: "nombre_duplicado", message: "Nombre ocupado" }
    for (const incompatible of [
      { ...valido, statusCode: 400 },
      { ...valido, codigo: "solicitud_invalida" },
      { ...valido, codigo: "un_codigo_desconocido" },
      { ...valido, statusCode: 401 },
      { ...valido, message: "  " },
      { ...valido, message: "a".repeat(1001) },
      { ...valido, borrador: { notas: "Datos privados" } },
    ]) {
      expect(contratos.ErrorDeApiSchema.safeParse(incompatible).success).toBe(false)
    }
  })
})
