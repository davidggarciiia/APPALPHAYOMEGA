type ProveedorClave = {
  leer: () => Promise<string | null>
  crear: () => Promise<string>
  guardar: (clave: string) => Promise<void>
  hayDocumentos: () => Promise<boolean>
}

export async function recuperarClave(
  proveedor: ProveedorClave,
  permitirCrear: boolean,
): Promise<string> {
  const guardada = await proveedor.leer()
  if (guardada !== null) return guardada
  if (!permitirCrear || (await proveedor.hayDocumentos()))
    throw new Error(
      "La clave local no está disponible. Se conservan los documentos para recuperar el acceso.",
    )
  const nueva = await proveedor.crear()
  await proveedor.guardar(nueva)
  return nueva
}
