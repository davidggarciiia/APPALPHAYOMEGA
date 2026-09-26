import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient } from "@prisma/client"
import { normalizarNombreEjercicio } from "@alpha-omega/shared"

import { EJERCICIOS_DE_DESARROLLO } from "./catalogo-ejercicios/ejercicios-de-desarrollo.js"
import { leerVariable } from "./config/entorno.js"
import { urlDeConexion } from "./config/postgres.js"
import { cifrarContrasena } from "./identity/contrasenas.js"

/**
 * Crea la cuenta del entrenador, que es la unica que no puede nacer por
 * invitacion: no hay nadie que la invite.
 *
 * Es idempotente. Si la cuenta ya existe no la toca, para que ejecutar el seed
 * dos veces no reescriba una contrasena que el entrenador ya haya cambiado.
 *
 * La contrasena sale del entorno y nunca del codigo.
 */
async function sembrarEntrenador(prisma: PrismaClient): Promise<void> {
  const email = leerVariable("SEED_ENTRENADOR_EMAIL").trim().toLowerCase()
  const existente = await prisma.usuario.findUnique({ where: { email } })

  if (existente !== null) {
    console.log(`El entrenador ${email} ya existe. No se toca.`)
    return
  }

  await prisma.usuario.create({
    data: {
      email,
      nombre: "Entrenador",
      passwordHash: await cifrarContrasena(leerVariable("SEED_ENTRENADOR_PASSWORD")),
      rol: "entrenador",
      estado: "activo",
    },
  })

  console.log(`Entrenador creado: ${email}`)
}

/**
 * Carga el catalogo basico de desarrollo.
 *
 * Idempotente por nombre normalizado: un ejercicio que ya existe (tambien si el
 * entrenador lo edito o lo retiro) no se toca. En produccion no se carga nada.
 */
async function sembrarEjercicios(prisma: PrismaClient): Promise<void> {
  if (process.env.NODE_ENV === "production") {
    console.log("NODE_ENV=production: no se cargan ejercicios de desarrollo.")
    return
  }

  let creados = 0
  for (const ejercicio of EJERCICIOS_DE_DESARROLLO) {
    const nombreNormalizado = normalizarNombreEjercicio(ejercicio.nombre)
    const existente = await prisma.ejercicio.findUnique({ where: { nombreNormalizado } })
    if (existente !== null) {
      continue
    }
    await prisma.ejercicio.create({
      data: {
        nombre: ejercicio.nombre,
        nombreNormalizado,
        grupoPrincipal: ejercicio.grupoPrincipal,
        instrucciones: ejercicio.instrucciones,
        gruposSecundarios: { create: ejercicio.gruposSecundarios.map((grupo) => ({ grupo })) },
      },
    })
    creados++
  }

  console.log(`Ejercicios de desarrollo: ${String(creados)} nuevos.`)
}

async function sembrar(): Promise<void> {
  const prisma = new PrismaClient({ adapter: new PrismaPg(urlDeConexion()) })

  try {
    await sembrarEntrenador(prisma)
    await sembrarEjercicios(prisma)
  } finally {
    await prisma.$disconnect()
  }
}

await sembrar()
