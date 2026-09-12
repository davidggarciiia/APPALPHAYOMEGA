import type { PrismaService } from "../prisma/prisma.service.js"

import { AlcanceClienteService } from "./alcance-cliente.service.js"
import type { Rol } from "@alpha-omega/shared"

function prismaConAsignacion(existe: boolean): PrismaService {
  return {
    asignacionNutricionista: {
      findUnique: () => Promise.resolve(existe ? { id: "a-1" } : null),
    },
  } as unknown as PrismaService
}

const ANA = "cliente-ana"
const LUIS = "cliente-luis"

function como(rol: Rol, sub: string): { sub: string; rol: Rol } {
  return { sub, rol }
}

describe("AlcanceClienteService.puedeAcceder", () => {
  it("el entrenador accede a cualquier cliente", async () => {
    const servicio = new AlcanceClienteService(prismaConAsignacion(false))

    await expect(servicio.puedeAcceder(como("entrenador", "e-1"), ANA)).resolves.toBe(true)
    await expect(servicio.puedeAcceder(como("entrenador", "e-1"), LUIS)).resolves.toBe(true)
  })

  it("un cliente accede solo a lo suyo", async () => {
    const servicio = new AlcanceClienteService(prismaConAsignacion(false))

    await expect(servicio.puedeAcceder(como("cliente", ANA), ANA)).resolves.toBe(true)
    await expect(servicio.puedeAcceder(como("cliente", ANA), LUIS)).resolves.toBe(false)
  })

  it("el nutricionista accede solo si hay asignacion", async () => {
    const conAsignacion = new AlcanceClienteService(prismaConAsignacion(true))
    const sinAsignacion = new AlcanceClienteService(prismaConAsignacion(false))

    await expect(conAsignacion.puedeAcceder(como("nutricionista", "n-1"), ANA)).resolves.toBe(true)
    await expect(sinAsignacion.puedeAcceder(como("nutricionista", "n-1"), ANA)).resolves.toBe(false)
  })

  it("el empleado no accede a ningun cliente", async () => {
    // Incluso con una asignacion en la base, que no deberia existir para este
    // rol: la regla no consulta nada, deniega por lo que es.
    const servicio = new AlcanceClienteService(prismaConAsignacion(true))

    await expect(servicio.puedeAcceder(como("empleado", "emp-1"), ANA)).resolves.toBe(false)
  })

  it("un cliente no se cuela pidiendo su propio identificador con otro rol", async () => {
    const servicio = new AlcanceClienteService(prismaConAsignacion(false))

    // El sub del token es lo que manda, no el parametro de la ruta.
    await expect(servicio.puedeAcceder(como("cliente", LUIS), ANA)).resolves.toBe(false)
  })
})
