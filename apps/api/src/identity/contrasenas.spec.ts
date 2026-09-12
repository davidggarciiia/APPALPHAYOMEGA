import { cifrarContrasena, verificarContrasena } from "./contrasenas.js"

describe("contrasenas", () => {
  it("usa Argon2id y no otra variante", async () => {
    const resultado = await cifrarContrasena("cualquier-cosa")

    // El propio hash declara el algoritmo con el que se genero. Este test existe
    // porque la constante de la libreria es un enum ambiente sin valor en
    // ejecucion, y un descuido ahi degrada la variante en silencio.
    expect(resultado.startsWith("$argon2id$")).toBe(true)
  })

  it("produce hashes distintos para la misma contrasena", async () => {
    const uno = await cifrarContrasena("misma-contrasena")
    const otro = await cifrarContrasena("misma-contrasena")

    // Sal aleatoria: dos usuarios con la misma contrasena no comparten hash, asi
    // que nadie puede deducir uno a partir del otro.
    expect(uno).not.toBe(otro)
  })

  it("verifica la contrasena correcta", async () => {
    const guardado = await cifrarContrasena("la-buena")

    await expect(verificarContrasena(guardado, "la-buena")).resolves.toBe(true)
  })

  it("rechaza la contrasena incorrecta", async () => {
    const guardado = await cifrarContrasena("la-buena")

    await expect(verificarContrasena(guardado, "la-mala")).resolves.toBe(false)
  })

  it("devuelve false ante un hash corrupto en lugar de reventar", async () => {
    await expect(verificarContrasena("esto-no-es-un-hash", "lo-que-sea")).resolves.toBe(false)
  })
})
