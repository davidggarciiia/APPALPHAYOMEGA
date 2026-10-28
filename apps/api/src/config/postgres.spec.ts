import { createServer } from "node:net"
import type { AddressInfo, Socket } from "node:net"

import { Client, Pool } from "pg"
import { opcionesDelPool, urlDeConexion } from "./postgres.js"

describe("transporte de PostgreSQL", () => {
  const nombres = [
    "POSTGRES_USER",
    "POSTGRES_PASSWORD",
    "POSTGRES_DB",
    "POSTGRES_HOST",
    "POSTGRES_PORT",
    "NODE_ENV",
    "PGSSLMODE",
    "PGSSLROOTCERT",
    "PG_CONNECT_TIMEOUT_MS",
    "PG_QUERY_TIMEOUT_MS",
    "PG_IDLE_TIMEOUT_MS",
    "PG_POOL_MAX",
  ] as const
  const anteriores: Record<string, string | undefined> = {}

  beforeEach(() => {
    for (const nombre of nombres) {
      anteriores[nombre] = process.env[nombre]
      delete process.env[nombre]
    }
    Object.assign(process.env, {
      POSTGRES_USER: "synthetic",
      POSTGRES_PASSWORD: "synthetic",
      POSTGRES_DB: "synthetic",
      POSTGRES_HOST: "db.example.invalid",
    })
  })
  afterEach(() => {
    for (const nombre of nombres)
      if (anteriores[nombre] === undefined) delete process.env[nombre]
      else process.env[nombre] = anteriores[nombre]
  })

  it("conserva el PostgreSQL local sin TLS en desarrollo", () => {
    expect(new Client({ connectionString: urlDeConexion() }).ssl).toBe(false)
  })

  it("exige elegir verify-full en producción antes de abrir una conexión", () => {
    process.env.NODE_ENV = "production"
    expect(() => urlDeConexion()).toThrow("PGSSLMODE=verify-full")
    process.env.PGSSLMODE = "disable"
    expect(() => urlDeConexion()).toThrow("PGSSLMODE=verify-full")
  })

  it("activa TLS con certificado y nombre verificados en el adaptador", () => {
    process.env.NODE_ENV = "production"
    process.env.PGSSLMODE = "verify-full"
    const url = urlDeConexion()
    expect(new URL(url).searchParams.get("sslmode")).toBe("verify-full")
    const cliente = new Client({ connectionString: url })
    expect(cliente.ssl).not.toBe(false)
    expect(cliente.ssl).not.toEqual(expect.objectContaining({ rejectUnauthorized: false }))
  })

  it("mantiene TLS estricto con los parámetros que admite Prisma Migrate", () => {
    process.env.NODE_ENV = "production"
    process.env.PGSSLMODE = "verify-full"
    const url = new URL(urlDeConexion("migraciones"))
    expect(url.searchParams.get("sslmode")).toBe("require")
    expect(url.searchParams.get("sslaccept")).toBe("strict")
  })

  it("no permite que el nombre de la base inyecte parámetros de conexión", () => {
    process.env.PGSSLMODE = "verify-full"
    process.env.POSTGRES_DB = "synthetic?sslmode=disable"
    const url = new URL(urlDeConexion())
    expect(decodeURIComponent(url.pathname)).toBe("/synthetic?sslmode=disable")
    expect(url.searchParams.get("sslmode")).toBe("verify-full")
  })

  it("admite una CA explícita y rechaza los modos que debilitan TLS", () => {
    process.env.PGSSLMODE = "verify-full"
    process.env.PGSSLROOTCERT = "C:/certificados/proveedor.pem"
    expect(new URL(urlDeConexion()).searchParams.get("sslrootcert")).toBe(
      "C:/certificados/proveedor.pem",
    )
    const migraciones = new URL(urlDeConexion("migraciones"))
    expect(migraciones.searchParams.get("sslcert")).toBe("C:/certificados/proveedor.pem")
    expect(migraciones.searchParams.get("sslrootcert")).toBeNull()
    for (const modo of ["prefer", "require", "no-verify", "verify-ca", "desconocido"]) {
      process.env.PGSSLMODE = modo
      expect(() => urlDeConexion()).toThrow("PGSSLMODE")
    }
  })

  describe("plazos del pool", () => {
    it("pone plazos por defecto en la conexión y en la consulta", () => {
      expect(opcionesDelPool()).toEqual({
        connectionString: urlDeConexion(),
        connectionTimeoutMillis: 10_000,
        idleTimeoutMillis: 30_000,
        max: 10,
        statement_timeout: 30_000,
        // El servidor cancela primero y libera la conexión; este plazo solo cubre
        // a un servidor que ya no contesta.
        query_timeout: 35_000,
      })
    })

    it("admite plazos propios desde el entorno", () => {
      process.env.PG_CONNECT_TIMEOUT_MS = "2000"
      process.env.PG_QUERY_TIMEOUT_MS = "8000"
      process.env.PG_IDLE_TIMEOUT_MS = "5000"
      process.env.PG_POOL_MAX = "4"
      expect(opcionesDelPool()).toMatchObject({
        connectionTimeoutMillis: 2000,
        statement_timeout: 8000,
        query_timeout: 13_000,
        idleTimeoutMillis: 5000,
        max: 4,
      })
    })

    it.each(["PG_CONNECT_TIMEOUT_MS", "PG_QUERY_TIMEOUT_MS", "PG_IDLE_TIMEOUT_MS", "PG_POOL_MAX"])(
      "rechaza un valor inválido en %s antes de abrir ninguna conexión",
      (nombre) => {
        process.env[nombre] = "0"
        expect(() => opcionesDelPool()).toThrow(nombre)
      },
    )

    it("conserva el TLS estricto de producción junto a los plazos", () => {
      process.env.NODE_ENV = "production"
      process.env.PGSSLMODE = "verify-full"
      const opciones = opcionesDelPool()
      expect(new URL(opciones.connectionString ?? "").searchParams.get("sslmode")).toBe(
        "verify-full",
      )
      expect(opciones.connectionTimeoutMillis).toBe(10_000)
    })

    it("corta la conexión a un servidor que acepta el socket y no contesta", async () => {
      const sockets = new Set<Socket>()
      const mudo = createServer((socket) => {
        sockets.add(socket)
        socket.on("error", () => undefined)
      })
      await new Promise<void>((listo) => mudo.listen(0, "127.0.0.1", listo))
      process.env.POSTGRES_HOST = "127.0.0.1"
      process.env.POSTGRES_PORT = String((mudo.address() as AddressInfo).port)
      process.env.PG_CONNECT_TIMEOUT_MS = "200"
      const pool = new Pool(opcionesDelPool())
      const inicio = Date.now()
      try {
        await expect(pool.query("SELECT 1")).rejects.toThrow(/timeout/i)
        expect(Date.now() - inicio).toBeLessThan(3000)
      } finally {
        await pool.end()
        for (const socket of sockets) socket.destroy()
        await new Promise<void>((listo) => mudo.close(() => listo()))
      }
    })
  })
})
