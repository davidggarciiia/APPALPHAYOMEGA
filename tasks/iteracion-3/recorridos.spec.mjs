/* global URL -- Node */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import test from "node:test"
import vm from "node:vm"

const carpeta = new URL("./", import.meta.url)

test("F09 limpia novedades y sus lecturas antes de borrar la sesión", async () => {
  const texto = readFileSync(new URL("recorrido-f09.mjs", carpeta), "utf8")
  const inicio = texto.indexOf("async function limpiar()")
  const fin = texto.indexOf("\ntry {", inicio)
  const pendientes = { lecturas: 1, novedades: 1, sesiones: 1 }
  const prisma = {
    usuario: { findMany: async () => [{ id: "cliente-sintetico" }] },
    sesionProgramada: { findMany: async () => [{ id: "sesion-sintetica" }] },
    $transaction: async (operaciones) => {
      for (const operacion of operaciones) await operacion()
    },
  }
  for (const modelo of [
    "lecturaNovedad",
    "novedadEntrenamiento",
    "operacionEntrenamiento",
    "referenciaEjercicio",
    "cambioDeFecha",
    "sesionEntrenamiento",
    "sesionProgramada",
    "planEntrenamiento",
    "rutinaGuardada",
    "contenidoDeEjercicio",
    "ejercicio",
    "usuario",
  ]) {
    prisma[modelo] ??= {}
    prisma[modelo].deleteMany = (consulta) => async () => {
      assert.ok(consulta.where)
      if (modelo === "lecturaNovedad") {
        assert.deepEqual(Array.from(consulta.where.novedad.sesionId.in), ["sesion-sintetica"])
        pendientes.lecturas = 0
      }
      if (modelo === "novedadEntrenamiento") {
        assert.equal(pendientes.lecturas, 0, "FK: primero se retiran las lecturas")
        assert.deepEqual(Array.from(consulta.where.sesionId.in), ["sesion-sintetica"])
        pendientes.novedades = 0
      }
      if (modelo === "sesionEntrenamiento") {
        assert.equal(pendientes.novedades, 0, "FK: las novedades aún apuntan a la sesión")
        pendientes.sesiones = 0
      }
    }
  }
  const limpiar = vm.compileFunction(`${texto.slice(inicio, fin)}; return limpiar`, [
    "prisma",
    "SUFIJO",
    "PREFIJO",
  ])(prisma, "@recorrido-f09.test", "recorrido-f09")
  await limpiar()
  assert.deepEqual(pendientes, { lecturas: 0, novedades: 0, sesiones: 0 })
})

for (const archivo of ["recorrido-f09.mjs", "recorrido-n12.mjs"]) {
  test(`${archivo} devuelve código de error si el recorrido detectó un fallo`, () => {
    const texto = readFileSync(new URL(archivo, carpeta), "utf8")
    const resumen = texto.slice(texto.lastIndexOf("console.log(informe.join("))
    for (const fallos of [1, 4, 0]) {
      const proceso = {}
      vm.runInNewContext(resumen, {
        console: { log: () => undefined },
        informe: [],
        MARCADOR: "sintetico",
        fallos,
        process: proceso,
      })
      assert.equal(proceso.exitCode, fallos === 0 ? 0 : 1)
    }
  })

  test(`${archivo} rechaza producción y bases habituales antes de importar Prisma`, () => {
    const texto = readFileSync(new URL(archivo, carpeta), "utf8")
    const prefijo = texto
      .slice(0, texto.indexOf("const { PrismaService }"))
      .replace(/^import .*$/gm, "")
      .replace(/const \{ cargarEntornoLocal \} = await import[^\n]+/g, "")
      .replaceAll("import.meta.url", JSON.stringify(new URL(archivo, carpeta).href))
    const ejecutar = (env) =>
      vm.runInNewContext(prefijo, {
        URL,
        fileURLToPath,
        cargarEntornoLocal: () => undefined,
        process: { env, chdir: () => undefined },
      })
    for (const env of [
      { NODE_ENV: "production", POSTGRES_DB: "alpha_omega_e2e_codex" },
      { NODE_ENV: "test", POSTGRES_DB: "alpha_omega" },
      { NODE_ENV: "test" },
    ]) {
      assert.throws(() => ejecutar(env), /dedicada|producci/)
    }
    for (const base of [
      "alpha_omega_e2e_codex",
      "alpha_omega_manual_20261027",
      "alpha_test",
      "alpha_review_20261027",
    ]) {
      assert.doesNotThrow(() => ejecutar({ NODE_ENV: "test", POSTGRES_DB: base }))
    }
  })
}
