import { exigirBaseDePruebas } from "../../test/exigir-base-de-pruebas.js"

describe("guarda de la base de los E2E", () => {
  it.each(["alpha_omega_e2e_codex", "alpha_omega_e2e_ci", "ALPHA_E2E"])(
    "admite la base de pruebas %s",
    (nombre) => {
      expect(() => exigirBaseDePruebas(nombre)).not.toThrow()
    },
  )

  it.each(["alpha_omega", "alpha_omega_demo", "alpha_omega_manual_20261027", ""])(
    "se niega a correr contra %s y explica cómo corregirlo",
    (nombre) => {
      expect(() => exigirBaseDePruebas(nombre)).toThrow("POSTGRES_DB=alpha_omega_e2e_codex")
    },
  )
})
