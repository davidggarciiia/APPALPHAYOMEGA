import type { PrismaService } from "../prisma/prisma.service.js"

import type { ActivacionService } from "./activacion.service.js"
import type { TokensRefrescoService } from "./tokens-refresco.service.js"
import { UsuariosService } from "./usuarios.service.js"

const ENTRENADOR = "11111111-1111-4111-8111-111111111111"
const CLIENTE = "22222222-2222-4222-8222-222222222222"

type Fila = {
  id: string
  email: string
  nombre: string
  apellidos: string | null
  telefono: string | null
  fechaNacimiento: Date | null
  passwordHash: string | null
  rol: "cliente" | "entrenador" | "nutricionista" | "empleado"
  estado: "pendiente" | "activo" | "desactivado"
  creadoEn: Date
}

function fila(cambios: Partial<Fila> = {}): Fila {
  return {
    id: CLIENTE,
    email: "ana@ejemplo.test",
    nombre: "Ana",
    apellidos: null,
    telefono: null,
    fechaNacimiento: null,
    passwordHash: null,
    rol: "cliente",
    estado: "pendiente",
    creadoEn: new Date("2026-01-01T10:00:00.000Z"),
    ...cambios,
  }
}

/**
 * Un doble de Prisma que apunta lo que se le pide.
 *
 * Interesa comprobar la regla, no la base: si `desactivar` se olvidara de
 * revocar sesiones o de quemar enlaces, el estado quedaria igualmente en
 * "desactivado" y el fallo no se veria hasta que alguien reactivara la cuenta.
 */
function prismaFalso(inicial: Fila): {
  prisma: PrismaService
  escrituras: Array<Record<string, unknown>>
  enlacesQuemados: number
} {
  const escrituras: Array<Record<string, unknown>> = []
  const registro = { enlacesQuemados: 0 }
  let actual = inicial

  const cliente = {
    usuario: {
      findUnique: ({ where }: { where: { id?: string; email?: string } }) =>
        Promise.resolve(
          where.id === undefined || where.id === actual.id
            ? where.email === undefined || where.email === actual.email
              ? actual
              : null
            : null,
        ),
      update: ({ data }: { data: Record<string, unknown> }) => {
        escrituras.push(data)
        actual = { ...actual, ...(data as Partial<Fila>) }
        return Promise.resolve(actual)
      },
    },
    tokenActivacion: {
      updateMany: () => {
        registro.enlacesQuemados += 1
        return Promise.resolve({ count: 1 })
      },
    },
    $transaction: (trabajo: (tx: unknown) => Promise<unknown>) => trabajo(cliente),
  }

  return {
    prisma: cliente as unknown as PrismaService,
    escrituras,
    get enlacesQuemados() {
      return registro.enlacesQuemados
    },
  }
}

function servicioCon(
  inicial: Fila,
  espias: { revocarTodosDe?: () => Promise<void> } = {},
): {
  servicio: UsuariosService
  escrituras: Array<Record<string, unknown>>
  sesionesRevocadas: () => number
  enlacesQuemados: () => number
} {
  const falso = prismaFalso(inicial)
  let revocadas = 0

  const refrescos = {
    revocarTodosDe: async () => {
      revocadas += 1
      await espias.revocarTodosDe?.()
    },
  } as unknown as TokensRefrescoService

  const activacion = {
    enviarEnlace: () => Promise.resolve(),
  } as unknown as ActivacionService

  return {
    servicio: new UsuariosService(falso.prisma, activacion, refrescos),
    escrituras: falso.escrituras,
    sesionesRevocadas: () => revocadas,
    enlacesQuemados: () => falso.enlacesQuemados,
  }
}

describe("UsuariosService: reglas de gestion", () => {
  it("dar de baja revoca las sesiones y quema los enlaces vivos", async () => {
    const { servicio, escrituras, sesionesRevocadas, enlacesQuemados } = servicioCon(
      fila({ estado: "activo", passwordHash: "$argon2id$..." }),
    )

    const ficha = await servicio.desactivar(ENTRENADOR, CLIENTE)

    expect(ficha.estado).toBe("desactivado")
    expect(escrituras).toContainEqual({ estado: "desactivado" })
    // Las tres escrituras son una sola decision. Si falta cualquiera de las dos
    // ultimas, el guard sigue cortando el acceso y el fallo queda tapado hasta
    // que alguien reactive la cuenta.
    expect(sesionesRevocadas()).toBe(1)
    expect(enlacesQuemados()).toBe(1)
  })

  it("reactivar deriva el estado de si hay contrasena", async () => {
    const sinClave = servicioCon(fila({ estado: "desactivado", passwordHash: null }))
    const conClave = servicioCon(fila({ estado: "desactivado", passwordHash: "$argon2id$..." }))

    // Un "activo" sin contrasena no puede iniciar sesion nunca y tampoco puede
    // recibir un enlace: quedaria encerrado fuera de su propia cuenta.
    await expect(sinClave.servicio.reactivar(ENTRENADOR, CLIENTE)).resolves.toMatchObject({
      estado: "pendiente",
    })
    await expect(conClave.servicio.reactivar(ENTRENADOR, CLIENTE)).resolves.toMatchObject({
      estado: "activo",
    })
  })

  it("reactivar a quien no esta de baja no escribe nada", async () => {
    const { servicio, escrituras } = servicioCon(fila({ estado: "activo" }))

    await servicio.reactivar(ENTRENADOR, CLIENTE)

    expect(escrituras).toHaveLength(0)
  })

  it("nadie se administra a si mismo", async () => {
    const { servicio, escrituras, sesionesRevocadas } = servicioCon(fila({ id: ENTRENADOR }))

    await expect(servicio.desactivar(ENTRENADOR, ENTRENADOR)).rejects.toThrow()
    await expect(servicio.reactivar(ENTRENADOR, ENTRENADOR)).rejects.toThrow()
    await expect(servicio.actualizar(ENTRENADOR, ENTRENADOR, { nombre: "Yo" })).rejects.toThrow()
    await expect(
      servicio.corregirCorreo(ENTRENADOR, ENTRENADOR, "otro@ejemplo.test"),
    ).rejects.toThrow()

    expect(escrituras).toHaveLength(0)
    expect(sesionesRevocadas()).toBe(0)
  })

  it("solo se corrige el correo de quien sigue pendiente", async () => {
    const pendiente = servicioCon(fila({ estado: "pendiente" }))
    const activo = servicioCon(fila({ estado: "activo", passwordHash: "$argon2id$..." }))

    await expect(
      pendiente.servicio.corregirCorreo(ENTRENADOR, CLIENTE, "bueno@ejemplo.test"),
    ).resolves.toMatchObject({ email: "bueno@ejemplo.test" })

    await expect(
      activo.servicio.corregirCorreo(ENTRENADOR, CLIENTE, "bueno@ejemplo.test"),
    ).rejects.toThrow()
  })

  it("la ficha dice si hay contrasena, nunca cual", async () => {
    const { servicio } = servicioCon(fila({ passwordHash: "$argon2id$v=19$secreto" }))

    const ficha = await servicio.leer(CLIENTE)

    expect(ficha.tieneContrasena).toBe(true)
    expect(JSON.stringify(ficha)).not.toContain("argon2")
  })

  it("un identificador que no existe no es un fallo del servidor", async () => {
    const { servicio } = servicioCon(fila())

    await expect(servicio.leer("33333333-3333-4333-8333-333333333333")).rejects.toThrow(
      /no existe/i,
    )
  })
})
