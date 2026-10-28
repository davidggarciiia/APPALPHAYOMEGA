import { leerVariable } from "../src/config/entorno.js"

import { exigirBaseDePruebas } from "./exigir-base-de-pruebas.js"

/** Se ejecuta tras setup-entorno, cuando POSTGRES_DB ya se ha leido del .env. */
exigirBaseDePruebas(leerVariable("POSTGRES_DB"))
