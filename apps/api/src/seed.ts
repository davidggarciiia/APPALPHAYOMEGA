import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient } from "@prisma/client"

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
async function sembrar(): Promise<void> {
  const prisma = new PrismaClient({ adapter: new PrismaPg(urlDeConexion()) })

  try {
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
  } finally {
    await prisma.$disconnect()
  }
}

await sembrar()
