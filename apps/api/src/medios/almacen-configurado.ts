import { leerVariableOpcional } from "../config/entorno.js"
import { crearAlmacenLocal, type AlmacenObjetos } from "./almacen-objetos.js"
import { crearAlmacenS3 } from "./almacen-s3.js"

/**
 * El almacén de fotos de este proceso, según `ALMACEN`:
 * - `s3`: servicio compatible con S3 (producción). Ver `crearAlmacenS3`.
 * - `local`: disco del servidor; solo para desarrollo y pruebas.
 *
 * Sin `ALMACEN`, en desarrollo se usa el local. En producción
 * (`NODE_ENV=production`) la API no arranca sin elegirlo: guardar fotos
 * corporales en el disco del servidor sin darse cuenta es justo lo que no
 * puede pasar.
 */
export function crearAlmacen(): AlmacenObjetos {
  const tipo = leerVariableOpcional("ALMACEN", "")
  if (tipo === "s3") return crearAlmacenS3()
  if (tipo === "local") return crearAlmacenLocal()
  if (tipo !== "")
    throw new Error(`ALMACEN no válido: «${tipo}». Usa s3 (producción) o local (desarrollo).`)
  if (leerVariableOpcional("NODE_ENV", "") === "production")
    throw new Error(
      "Falta ALMACEN. En producción define ALMACEN=s3 y las variables S3_* (docs/DESPLIEGUE.md).",
    )
  return crearAlmacenLocal()
}
