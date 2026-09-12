import "reflect-metadata"

import { cargarEntornoLocal } from "../src/config/entorno.js"

/**
 * Preparacion comun a todos los tests.
 *
 * `reflect-metadata` tiene que cargarse antes que cualquier clase decorada, o la
 * inyeccion de dependencias de Nest no encuentra los tipos. En el servidor lo
 * hace main.ts; aqui Jest no ejecuta main.ts, asi que toca hacerlo a mano.
 *
 * Las variables de entorno se cargan por el mismo motivo: los tests levantan la
 * aplicacion de verdad y necesitan la misma configuracion que el servidor.
 */
cargarEntornoLocal()
