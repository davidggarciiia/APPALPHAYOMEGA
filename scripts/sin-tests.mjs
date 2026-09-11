/**
 * Marcador temporal. El proyecto todavia no tiene tests.
 *
 * Antes, `npm run test` terminaba en verde sin ejecutar nada, porque
 * `--workspaces --if-present` no encuentra ningun script de test y sale con
 * exito. Un verde que no prueba nada es peor que un rojo honesto: invita a
 * commitear creyendo que algo se ha verificado.
 *
 * La tarea 3 borra este fichero y devuelve el script de test de verdad.
 */
console.error("")
console.error("  Todavia no hay tests en el proyecto.")
console.error("  Los primeros llegan con la tarea 3 (esqueleto de la API).")
console.error("  Este comando falla a proposito para no dar un verde falso.")
console.error("")
process.exit(1)
