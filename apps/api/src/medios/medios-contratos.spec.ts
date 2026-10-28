import {
  AccesoMedioSchema,
  BYTES_MAXIMOS_FOTO,
  CrearSolicitudFotosSchema,
  IntencionSubidaSchema,
  MedioFotoSchema,
  SolicitarSubidaSchema,
  SolicitudFotosSchema,
} from "@alpha-omega/shared"

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`

// Datos sintéticos: ninguna foto ni persona real.
const subida = {
  operacionId: id(1),
  clienteId: id(2),
  destino: { tipo: "valoracion", valoracionId: id(3) },
  vista: "frente",
  etiqueta: null,
  fechaToma: "2026-09-24",
  tipoMime: "image/jpeg",
  bytes: 350_000,
}
const medio = {
  id: id(10),
  clienteId: id(2),
  autor: { id: id(11), nombre: "Entrenador" },
  origen: "profesional",
  vista: "frente",
  etiqueta: null,
  fechaToma: "2026-09-24",
  estado: "disponible",
  tipoMime: "image/jpeg",
  bytes: 350_000,
  valoracionId: id(3),
  solicitudId: null,
  creadoEn: "2026-09-24T10:00:00.000Z",
  confirmadoEn: "2026-09-24T10:00:05.000Z",
}
const enlace = {
  url: "http://localhost:3000/medios/local/objeto?caduca=1&firma=abc",
  metodo: "PUT",
  cabeceras: { "Content-Type": "image/jpeg" },
  caducaEn: "2026-09-24T10:05:00.000Z",
}

describe("contratos de fotos privadas", () => {
  it("admite el nombre y apellidos máximos del perfil unidos con un espacio", () => {
    const autor = { id: medio.autor.id, nombre: `${"n".repeat(80)} ${"a".repeat(120)}` }
    expect(MedioFotoSchema.safeParse({ ...medio, autor }).success).toBe(true)
    expect(
      MedioFotoSchema.safeParse({ ...medio, autor: { ...autor, nombre: autor.nombre + "a" } })
        .success,
    ).toBe(false)
  })

  it("acepta una subida a una visita o a una solicitud sin valoración", () => {
    expect(SolicitarSubidaSchema.safeParse(subida).success).toBe(true)
    expect(
      SolicitarSubidaSchema.safeParse({
        ...subida,
        destino: { tipo: "solicitud", solicitudId: id(4) },
      }).success,
    ).toBe(true)
  })

  it("rechaza formatos, tamaños y etiquetas no admitidos", () => {
    const valida = (cambios: Record<string, unknown>) =>
      SolicitarSubidaSchema.safeParse({ ...subida, ...cambios }).success
    expect(valida({ tipoMime: "image/gif" })).toBe(false)
    expect(valida({ tipoMime: "image/heic" })).toBe(false)
    expect(valida({ bytes: 0 })).toBe(false)
    expect(valida({ bytes: BYTES_MAXIMOS_FOTO + 1 })).toBe(false)
    expect(valida({ bytes: 1.5 })).toBe(false)
    expect(valida({ vista: "otra", etiqueta: null })).toBe(false)
    expect(valida({ vista: "otra", etiqueta: "Brazo" })).toBe(true)
    expect(valida({ vista: "frente", etiqueta: "Brazo" })).toBe(false)
    expect(valida({ vista: "otra", etiqueta: "<b>x</b>" })).toBe(false)
    expect(valida({ destino: { tipo: "valoracion" } })).toBe(false)
    expect(valida({ operacionId: "x" })).toBe(false)
  })

  it("la foto se identifica por su id: sin clave de objeto ni enlaces en el DTO", () => {
    expect(MedioFotoSchema.safeParse(medio).success).toBe(true)
    expect(MedioFotoSchema.safeParse({ ...medio, clave: "clientes/x/y.jpg" }).success).toBe(false)
    expect(MedioFotoSchema.safeParse({ ...medio, url: enlace.url }).success).toBe(false)
    expect(IntencionSubidaSchema.safeParse({ medio, subida: enlace }).success).toBe(true)
    expect(IntencionSubidaSchema.safeParse({ medio, subida: null }).success).toBe(true)
    expect(
      AccesoMedioSchema.safeParse({ medioId: medio.id, lectura: { ...enlace, metodo: "GET" } })
        .success,
    ).toBe(true)
    expect(
      AccesoMedioSchema.safeParse({ medioId: medio.id, lectura: { ...enlace, url: "no-es-url" } })
        .success,
    ).toBe(false)
  })

  it("distingue pendiente, disponible, eliminando y eliminado, y origen profesional o cliente", () => {
    for (const estado of ["pendiente", "disponible", "eliminando", "eliminado"])
      expect(MedioFotoSchema.safeParse({ ...medio, estado }).success).toBe(true)
    expect(MedioFotoSchema.safeParse({ ...medio, estado: "revisada" }).success).toBe(false)
    expect(
      MedioFotoSchema.safeParse({
        ...medio,
        origen: "cliente",
        valoracionId: null,
        solicitudId: id(4),
      }).success,
    ).toBe(true)
  })

  it("una solicitud pide vistas concretas y separa recibida de revisada", () => {
    const crear = {
      operacionId: id(20),
      vistas: ["frente", "espalda"],
      fechaLimite: null,
      mensaje: null,
    }
    expect(CrearSolicitudFotosSchema.safeParse(crear).success).toBe(true)
    expect(CrearSolicitudFotosSchema.safeParse({ ...crear, vistas: [] }).success).toBe(false)
    expect(
      CrearSolicitudFotosSchema.safeParse({ ...crear, vistas: ["frente", "frente"] }).success,
    ).toBe(false)
    expect(CrearSolicitudFotosSchema.safeParse({ ...crear, vistas: ["otra"] }).success).toBe(false)
    const solicitud = {
      id: id(21),
      clienteId: id(2),
      autor: { id: id(11), nombre: "Entrenador" },
      vistas: ["frente"],
      fechaLimite: "2026-10-01",
      mensaje: "Con la misma luz",
      estado: "recibida",
      creadaEn: "2026-09-24T10:00:00.000Z",
      recibidaEn: "2026-09-25T10:00:00.000Z",
      revisadaEn: null,
      medios: [{ ...medio, origen: "cliente", valoracionId: null, solicitudId: id(21) }],
    }
    expect(SolicitudFotosSchema.safeParse(solicitud).success).toBe(true)
    expect(SolicitudFotosSchema.safeParse({ ...solicitud, estado: "aceptada" }).success).toBe(false)
  })
})
