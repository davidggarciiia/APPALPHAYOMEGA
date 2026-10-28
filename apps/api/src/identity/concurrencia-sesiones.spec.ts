import { createHash } from "node:crypto"
import { UnauthorizedException } from "@nestjs/common"
import type { JwtService } from "@nestjs/jwt"
import type { PrismaService } from "../prisma/prisma.service.js"
import type { ServicioDeCorreo } from "../correo/correo.service.js"
import { AuthService } from "./auth.service.js"
import { cifrarContrasena } from "./contrasenas.js"
import { LimitadorDeIntentos } from "./limitador-intentos.service.js"
import { RecuperacionService } from "./recuperacion.service.js"
import { TokensRefrescoService } from "./tokens-refresco.service.js"

function puerta() {
  let abrir!: () => void
  const espera = new Promise<void>((resolve) => {
    abrir = resolve
  })
  return { espera, abrir }
}

type Token = {
  id: string
  usuarioId: string
  hash: string
  familiaId: string
  familiaCreadaEn: Date
  expiraEn: Date
  revocadoEn: Date | null
  motivoRevocacion: string | null
}
const hash = (texto: string) => createHash("sha256").update(texto).digest("hex")

/** Transacciones serializadas; las lecturas exteriores devuelven copias, como Prisma. */
function baseEnMemoria(passwordHash: string) {
  const usuario = {
    id: "u-1",
    email: "ana@example.test",
    nombre: "Ana",
    apellidos: null,
    rol: "cliente",
    estado: "activo",
    passwordHash,
  }
  const filas: Token[] = []
  const recuperacion = {
    id: "reset",
    usuarioId: usuario.id,
    hash: hash("secreto-reset"),
    expiraEn: new Date(Date.now() + 60_000),
    usadoEn: null as Date | null,
  }
  let cola = Promise.resolve()
  let alLeerUsuario: (() => Promise<void>) | undefined
  let alCerrar: (() => Promise<void>) | undefined
  const coincide = (fila: Record<string, unknown>, where: Record<string, unknown>): boolean =>
    Object.entries(where).every(([clave, valor]) => {
      if (typeof valor === "object" && valor !== null && !(valor instanceof Date)) {
        const condicion = valor as { gt?: Date }
        return condicion.gt !== undefined && (fila[clave] as Date) > condicion.gt
      }
      return fila[clave] === valor
    })
  const cliente = {
    usuario: {
      findUnique: async () => {
        const copia = { ...usuario }
        const pausa = alLeerUsuario
        alLeerUsuario = undefined
        await pausa?.()
        return copia
      },
      updateMany: async ({ where, data }: { where: Record<string, unknown>; data: object }) => {
        if (!coincide(usuario, where)) return { count: 0 }
        Object.assign(usuario, data)
        return { count: 1 }
      },
      update: async ({ data }: { data: object }) => {
        Object.assign(usuario, data)
        return { ...usuario }
      },
    },
    tokenRefresco: {
      findUnique: async ({ where }: { where: { id: string } }) => {
        const fila = filas.find((f) => f.id === where.id)
        return fila ? { ...fila } : null
      },
      create: async ({ data }: { data: Omit<Token, "id" | "revocadoEn" | "motivoRevocacion"> }) => {
        const fila = { ...data, id: `t-${filas.length}`, revocadoEn: null, motivoRevocacion: null }
        filas.push(fila)
        return { ...fila }
      },
      updateMany: async ({
        where,
        data,
      }: {
        where: Record<string, unknown>
        data: Partial<Token>
      }) => {
        const coincidentes = filas.filter((f) => coincide(f, where))
        coincidentes.forEach((f) => Object.assign(f, data))
        if (data.motivoRevocacion === "cierre" && where.revocadoEn === null) {
          const pausa = alCerrar
          alCerrar = undefined
          await pausa?.()
        }
        return { count: coincidentes.length }
      },
    },
    tokenRecuperacion: {
      findUnique: async () => ({ ...recuperacion }),
      updateMany: async ({ where, data }: { where: Record<string, unknown>; data: object }) => {
        if (!coincide(recuperacion, where)) return { count: 0 }
        Object.assign(recuperacion, data)
        return { count: 1 }
      },
    },
    $transaction: async (trabajo: (tx: unknown) => Promise<unknown>) => {
      const anterior = cola
      const turno = puerta()
      cola = anterior.then(() => turno.espera)
      await anterior
      try {
        return await trabajo(cliente)
      } finally {
        turno.abrir()
      }
    },
  }
  return {
    prisma: cliente as unknown as PrismaService,
    usuario,
    filas,
    pausarLectura: (pausa: () => Promise<void>) => {
      alLeerUsuario = pausa
    },
    pausarCierre: (pausa: () => Promise<void>) => {
      alCerrar = pausa
    },
  }
}

describe("sesiones: carreras de credenciales, cierre y refresco", () => {
  it("no emite una sesión con la contraseña antigua después de restablecerla", async () => {
    const base = baseEnMemoria(await cifrarContrasena("antigua-correcta"))
    const tokens = new TokensRefrescoService(base.prisma)
    const auth = new AuthService(
      base.prisma,
      { signAsync: async () => "jwt" } as unknown as JwtService,
      tokens,
      new LimitadorDeIntentos(),
    )
    const recuperacion = new RecuperacionService(
      base.prisma,
      {} as ServicioDeCorreo,
      new LimitadorDeIntentos(),
      tokens,
    )
    const leida = puerta(),
      continuar = puerta()
    base.pausarLectura(async () => {
      leida.abrir()
      await continuar.espera
    })
    const login = auth
      .iniciarSesion({ email: base.usuario.email, contrasena: "antigua-correcta" }, "ip")
      .then(
        (sesion) => sesion,
        (error: unknown) => error,
      )
    await leida.espera
    await recuperacion.restablecer("reset.secreto-reset", "nueva-correcta", "otra-ip")
    continuar.abrir()
    expect(await login).toBeInstanceOf(UnauthorizedException)
    expect(base.filas.filter((f) => f.revocadoEn === null)).toHaveLength(0)
  })

  it("cerrar durante un reintento de gracia no deja ningún sucesor vivo", async () => {
    const base = baseEnMemoria("hash-no-usado")
    const tokens = new TokensRefrescoService(base.prisma)
    const inicial = await tokens.emitir(base.usuario.id)
    await tokens.canjear(inicial.token)
    const cerrado = puerta(),
      continuar = puerta()
    base.pausarCierre(async () => {
      cerrado.abrir()
      await continuar.espera
    })
    const cierre = tokens.revocar(inicial.token)
    await cerrado.espera
    const refresco = tokens.canjear(inicial.token).catch((error: unknown) => error)
    // Da al canje la oportunidad de terminar si el cierre no tiene el candado.
    await new Promise<void>((resolve) => setImmediate(resolve))
    continuar.abrir()
    await Promise.all([cierre, refresco])
    expect(base.filas.filter((f) => f.revocadoEn === null)).toHaveLength(0)
  })

  it("cuatro canjes simultáneos conservan un sucesor sin denunciar reuso falso", async () => {
    const base = baseEnMemoria("hash-no-usado")
    const tokens = new TokensRefrescoService(base.prisma)
    const inicial = await tokens.emitir(base.usuario.id)
    await Promise.allSettled(Array.from({ length: 4 }, () => tokens.canjear(inicial.token)))
    expect(base.filas.filter((f) => f.revocadoEn === null)).toHaveLength(1)
    expect(base.filas.some((f) => f.motivoRevocacion === "reuso")).toBe(false)
  })

  it("rechaza otro reintento inmediato sin revocar el sucesor recibido", async () => {
    const base = baseEnMemoria("hash-no-usado")
    const tokens = new TokensRefrescoService(base.prisma)
    const inicial = await tokens.emitir(base.usuario.id)
    await tokens.canjear(inicial.token)
    const recuperada = await tokens.canjear(inicial.token)
    await expect(tokens.canjear(inicial.token)).rejects.toBeInstanceOf(UnauthorizedException)
    expect(await tokens.sesionSigueViva(recuperada.nuevo.id)).toBe(true)
    expect(base.filas.filter((f) => f.revocadoEn === null)).toHaveLength(1)
  })

  it("un reuso fuera de la gracia corta el sucesor y la gracia de toda la familia", async () => {
    const base = baseEnMemoria("hash-no-usado")
    const tokens = new TokensRefrescoService(base.prisma)
    const inicial = await tokens.emitir(base.usuario.id)
    const rotada = await tokens.canjear(inicial.token)
    const recuperada = await tokens.canjear(inicial.token)
    base.filas.find((f) => f.id === inicial.id)!.revocadoEn = new Date(0)
    await expect(tokens.canjear(inicial.token)).rejects.toBeInstanceOf(UnauthorizedException)
    expect(await tokens.sesionSigueViva(recuperada.nuevo.id)).toBe(false)
    expect(base.filas.filter((f) => f.revocadoEn === null)).toHaveLength(0)
    await expect(tokens.canjear(rotada.nuevo.token)).rejects.toBeInstanceOf(UnauthorizedException)
    await expect(tokens.canjear(recuperada.nuevo.token)).rejects.toBeInstanceOf(
      UnauthorizedException,
    )
  })
})
