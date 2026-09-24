import { Redirect, useLocalSearchParams, useRouter } from "expo-router"
import { z } from "zod"
import { useAccesoAFiguras } from "../../src/catalogo-ejercicios/figura-ejercicio"
import { FormularioDeEjercicio } from "../../src/catalogo-ejercicios/formulario-ejercicio"
import { useCatalogo } from "../../src/catalogo-ejercicios/use-catalogo"
import { useSesion } from "../../src/sesion"

export default function EditarEjercicio(): React.JSX.Element {
  const api = useCatalogo()
  const acceso = useAccesoAFiguras()
  const { estado } = useSesion()
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  if (
    estado.fase !== "dentro" ||
    estado.usuario.rol !== "entrenador" ||
    !z.uuid().safeParse(id).success
  )
    return <Redirect href="/" />
  const volver = (): void => {
    router.replace("/catalogo")
  }
  return (
    <FormularioDeEjercicio
      key={id}
      id={id}
      api={api}
      acceso={acceso}
      onGuardado={volver}
      onCancelar={volver}
    />
  )
}
