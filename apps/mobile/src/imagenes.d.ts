/**
 * Metro convierte cada imagen importada en una referencia que `Image` sabe
 * cargar. TypeScript no lo sabe por si solo: sin esto, importar un `.png` es un
 * error de tipos.
 */
declare module "*.png" {
  import type { ImageSourcePropType } from "react-native"

  const imagen: ImageSourcePropType
  export default imagen
}
