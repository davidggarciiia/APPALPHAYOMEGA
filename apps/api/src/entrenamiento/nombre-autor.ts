export function nombreDeAutor(autor: { nombre: string; apellidos: string | null }): string {
  return [autor.nombre, autor.apellidos].filter(Boolean).join(" ")
}
