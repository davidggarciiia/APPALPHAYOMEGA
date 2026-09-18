import { Redirect, useRouter } from "expo-router"
import { FormularioDeEjercicio } from "../../src/catalogo-ejercicios/formulario-ejercicio"
import { useCatalogo } from "../../src/catalogo-ejercicios/use-catalogo"
import { useSesion } from "../../src/sesion"

export default function NuevoEjercicio(): React.JSX.Element {
  const api = useCatalogo()
  const { estado } = useSesion()
  const router = useRouter()
  if (estado.fase !== "dentro" || estado.usuario.rol !== "entrenador") return <Redirect href="/" />
  const volver = (): void => {
    router.replace("/catalogo")
  }
  return <FormularioDeEjercicio api={api} onGuardado={volver} onCancelar={volver} />
}
