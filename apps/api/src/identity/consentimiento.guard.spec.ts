import { jest } from "@jest/globals"
import { ConflictException, ForbiddenException, type ExecutionContext } from "@nestjs/common"
import type { Reflector } from "@nestjs/core"
import type { Rol } from "@alpha-omega/shared"

import type { AlcanceClienteService } from "./alcance-cliente.service.js"
import { ConsentimientoGuard } from "./consentimiento.guard.js"
import type { ConsentimientoService } from "./consentimiento.service.js"

const CLIENTE = "10000000-0000-4000-8000-000000000001"
const OTRO = "10000000-0000-4000-8000-000000000002"
const ENTRENADOR = "20000000-0000-4000-8000-000000000001"

type Peticion = {
  usuario?: { sub: string; rol: Rol }
  params?: Record<string, string>
  body?: unknown
}

function montar({
  marcada = true,
  vigentes = [CLIENTE],
  acceso = (usuario: { sub: string; rol: Rol }, clienteId: string) =>
    usuario.rol === "entrenador" || usuario.sub === clienteId,
} = {}) {
  const vigente = jest.fn(async (id: string) => vigentes.includes(id))
  const guard = new ConsentimientoGuard(
    { getAllAndOverride: () => marcada } as unknown as Reflector,
    { vigente } as unknown as ConsentimientoService,
    { puedeAcceder: async (u, c) => acceso(u, c) } as Pick<
      AlcanceClienteService,
      "puedeAcceder"
    > as AlcanceClienteService,
  )
  const pasar = (peticion: Peticion) =>
    guard.canActivate({
      getHandler: () => undefined,
      getClass: () => undefined,
      switchToHttp: () => ({ getRequest: () => peticion }),
    } as unknown as ExecutionContext)
  return { pasar, vigente }
}

describe("ConsentimientoGuard", () => {
  it("no actúa en rutas sin marcar", async () => {
    const { pasar, vigente } = montar({ marcada: false })
    await expect(pasar({})).resolves.toBe(true)
    expect(vigente).not.toHaveBeenCalled()
  })

  it("deja guardar al cliente con consentimiento vigente y al entrenador sobre él", async () => {
    const { pasar } = montar()
    await expect(pasar({ usuario: { sub: CLIENTE, rol: "cliente" } })).resolves.toBe(true)
    await expect(
      pasar({ usuario: { sub: ENTRENADOR, rol: "entrenador" }, params: { clienteId: CLIENTE } }),
    ).resolves.toBe(true)
  })

  it("sin consentimiento responde 409 consentimiento_pendiente, lo guarde quien lo guarde", async () => {
    const { pasar } = montar({ vigentes: [] })
    const propio = pasar({ usuario: { sub: CLIENTE, rol: "cliente" } })
    await expect(propio).rejects.toBeInstanceOf(ConflictException)
    await expect(propio).rejects.toMatchObject({
      response: { codigo: "consentimiento_pendiente" },
    })
    await expect(
      pasar({ usuario: { sub: ENTRENADOR, rol: "entrenador" }, body: { clienteId: CLIENTE } }),
    ).rejects.toMatchObject({ response: { codigo: "consentimiento_pendiente" } })
  })

  it("sin acceso al cliente no revela su consentimiento: deja que la ruta deniegue", async () => {
    const { pasar, vigente } = montar({ vigentes: [] })
    await expect(
      pasar({ usuario: { sub: CLIENTE, rol: "cliente" }, body: { clienteId: OTRO } }),
    ).resolves.toBe(true)
    expect(vigente).not.toHaveBeenCalled()
  })

  it("una ruta marcada que no identifica al cliente se deniega", async () => {
    const { pasar } = montar()
    await expect(pasar({ usuario: { sub: ENTRENADOR, rol: "entrenador" } })).rejects.toBeInstanceOf(
      ForbiddenException,
    )
    await expect(pasar({ params: { clienteId: CLIENTE } })).rejects.toBeInstanceOf(
      ForbiddenException,
    )
  })
})
