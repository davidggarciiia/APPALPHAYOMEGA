# Tareas activas — experiencia del cliente

> [Plan y decisiones](plan.md). Marcar una tarea hecha solo con criterios y verificación demostrados. El archivo de planes anteriores conserva sus pendientes históricos sin declararlos terminados.

## Revisión integral posterior · 24-09-2026

El [informe de revisión integral](revision-integral-2026-09-24.md) consolida fallos, integración y comprobaciones pendientes. No da por terminadas las tareas físicas ni reabre funciones aplazadas en la coordinación con Claude.

- [ ] **RI01:** cierre de entrenamiento que muestre/congele exactamente la intención de envío.
- [ ] **RI02:** proteger la edición de medidas y pruebas mientras se guardan.
- [ ] **RI03:** registrar ejecución parcial, omisiones y RIR de calentamiento/vuelta a la calma.
- [ ] **RI04:** distinguir comida sin registro habilitado de falta de conexión.
- [ ] **RI05:** evitar cálculos y fechas que mezclen medidas de tomas diferentes.
- [ ] **RI06:** conservar acceso a medidas/pruebas recientes e históricas al superar 500.
- [ ] **RI07:** retirar explícitamente archivos temporales de fotos en Android/iOS.

Cada RI tiene escenario en el informe y desglose ejecutable a continuación. **Claude es el responsable de esta nueva pasada, por petición de David.** No se han corregido estas RI como parte del parche ya verificado de fotos/consentimiento.

### Método y controles comunes de la nueva pasada

- Trabajar con Agent Skills: especificación vigente → tarea pequeña → regresión que falle → cambio mínimo → pruebas → revisión → commit acotado. No tocar código de otra tarea para hacer pasar una prueba.
- Cada tarea enumera hasta cinco archivos de lógica/pruebas. Cambios de especificación y evidencia se registran junto a ella; si aparece otro consumidor de lógica, subdividir antes de editarlo.
- Después de cada tarea: su prueba focal, `npm run typecheck` y `git diff --check`. Resultado esperado: salida 0, ninguna regresión. Registrar resultado real, no el esperado.
- Las rutas citadas son relativas a `C:/Users/david/Desktop/APP-ALPHA_OMEGA`. Los archivos marcados **nuevo** se crean; los restantes se han localizado en esta revisión.
- HTTP en una terminal de pruebas: `$env:POSTGRES_DB='alpha_omega_e2e_codex'`, `$env:ALMACEN='local'`, `$env:MEDIOS_LIMPIEZA_MINUTOS='0'` y un `ALMACEN_LOCAL_DIR` temporal propio. Verificar destino antes de migrar. No arrancar la API habitual desde esa terminal con el entorno de pruebas heredado.

### RI00 · Consolidar la base sin perder trabajo

**Entrega:** identificar las instantáneas de la carpeta principal y de `claude/mejoras-pdf`, preservar las correcciones de Codex y preparar la integración de D01. **Dependencias:** ninguna. **Tamaño:** S de coordinación; si aparecen conflictos de producto, crear subtareas por módulo antes de resolverlos.

- [x] Ejecutar `git status --short`, `git log -5 --oneline`, `git worktree list` y `git log --oneline codex/cliente-intuitivo..claude/mejoras-pdf`. Leer el estado local de ambos worktrees y `tasks/coordinacion-claude-codex.md`.
- [x] Revisar/consolidar en commits acotados los cambios de la carpeta principal que aún están sin commit. No usar `git add .`, `reset --hard`, `clean` ni sobreescribir documentos/archivos del usuario. Mantener las pruebas de consentimiento pendiente y los intentos recuperables de foto. La nueva petición de David autoriza continuar la corrección con Claude; la nota antigua de esperar otro commit no obliga a desechar este árbol.
- [x] Reconciliar el alcance y guardar los SHA efectivamente usados. La integración de metros debe conservar ambos cambios de `registros.service.ts`: unidad de distancia y comprobación transaccional del consentimiento. No sustituir `todo.md` por la copia antigua del worktree.

**Archivos de coordinación:** `tasks/coordinacion-claude-codex.md`, `tasks/evidencia-valoraciones.md`. **Verificar:** cambios identificados por módulo, ningún archivo perdido y ningún pendiente marcado por inercia. No repetir T00, no volver a integrar Fable desde una base antigua.

**Evidencia 24-09-2026, 22:00 (Claude):**

- **Base de partida.** Carpeta principal en `f931b5c`, con 21 archivos modificados y 12 nuevos sin commit (tanda de Codex). La rama `claude/mejoras-pdf` estaba en `dc27dcb`: D01 completo e integración de `f931b5c` sin conflictos; ahí sigue en curso D01.h, dos ajustes de la revisión de D01.
- **Árbol comprobado antes de consolidar.** `npm run typecheck` y `npm run lint` salen con 0. `npm test`: 188 pruebas API en 23 suites y 452 móviles en 65 suites. HTTP de fotos, consentimiento y registro en `alpha_omega_e2e_codex` (`medios`, `medios-persistencia`, `consentimiento`, `consentimiento-pendientes`, `valoraciones-fotos`, `solicitudes-fotos` y `entrenamiento-registro`): 7 suites y 46 pruebas.
- **Commits por módulo, con archivos explícitos:**
  - `d40ef20`: consentimiento dentro de la escritura del entrenamiento.
  - `bcd58bb`: intentos de foto con clave privada por intento, más `apps/api/prisma/rollback/intentos_foto.sql`, que faltaba. Esa reversión se ensayó en `alpha_omega_e2e_codex`: aplicar, revertir y volver a aplicar.
  - `789cee2`: evolución, comparador y aportación del cliente en Progreso.
  - `4661c59`: avisos en Inicio (E02b).
  - `d2e9b0c`: documentación de la revisión y el encargo.
- **Resultado.** Ningún archivo perdido; solo quedan sin seguimiento los archivos personales de David (`PDF/`, `compass_artifact_*.md` y el HTML de pantallas). Alcance de los PDF: D01, D04 y D07, según la decisión posterior registrada en `a79cfc5` y en la coordinación.
- **Figuras (adelanto de FIG01).** La simulación sin `--confirmar` desde esta carpeta detecta las 52 figuras: «52 creados, 52 figuras asociadas, 0 figuras sin importar». `MEDIOS_DIR` apunta a `%LOCALAPPDATA%\alpha-omega\medios`, que tiene 104 archivos. La revisión de Codex no veía esa carpeta desde su entorno.

### RI01 · Mostrar el cierre comprometido

**Entrega:** al enviar o reintentar se ve exactamente el feedback que contiene la intención. **Dependencia:** RI00. **Tamaño:** M, 4 archivos.

**Archivos:** `apps/mobile/src/entrenamiento/sesion/cierre.tsx`, `apps/mobile/src/entrenamiento/sesion/pantallas.spec.tsx`, `apps/mobile/src/entrenamiento/registro-cliente.tsx`; **nuevo:** `apps/mobile/src/entrenamiento/registro-cliente.spec.tsx`.

- [ ] Añadir una regresión del cierre con `cierreInicial={{ esfuerzo: 8, energia: 2, incomodo: true }}`, notas «Me cansé», `pendiente=true`: se muestran esos valores sin controles editables y reintentar no exige responder otra vez. Añadir casos enviando y cierre antiguo ausente; comprobar el fallo antes del cambio.
- [ ] Añadir `cierreInicial` al componente y alimentarlo desde `envioPendiente.registro`, después `intencionEnvio.registro`, después la edición. Mostrar un resumen de consulta al estar pendiente; mientras se envía, proteger los valores elegidos. El reintento conserva UUID y payload; no cambiar la lógica de `ControlRegistro.enviar` para aceptar una edición tardía.
- [ ] Probar en integración abrir/cerrar el resumen, intentar enviar sin red, volver y reintentar: nota, esfuerzo, energía y molestia visibles coinciden con el payload original. Sin cierre histórico: texto neutral y reintento válido, sin datos inventados.

**Verificar:** `npm test --workspace apps/mobile -- --runInBand src/entrenamiento/sesion/pantallas.spec.tsx src/entrenamiento/registro-cliente.spec.tsx src/entrenamiento/registro-control.spec.ts`. Recorrido manual posterior: cerrar entreno → perder conexión → volver → continuar envío.

### RI02 · Proteger medidas y pruebas durante el guardado

**Entrega:** ni una respuesta lenta ni un reintento pierden una edición o crean dobles registros. **Dependencia:** RI00. **Tamaño:** M, 4 archivos; las dos partes comparten el mismo formulario y no añaden endpoints.

**Archivos:** `apps/mobile/src/seguimiento/formularios.tsx`, **nuevo:** `apps/mobile/src/seguimiento/formularios.spec.tsx`, `apps/mobile/src/entrenamiento/sesion/controles.tsx`, `apps/mobile/src/entrenamiento/sesion/pantallas.spec.tsx`.

- [ ] Reproducir con una promesa controlada: escribir 70,5 kg, guardar, intentar escribir 80 y cancelar antes de responder. Hacer lo mismo con una prueba. Comprobar que el formulario actual admite esos cambios; fijar la expectativa de campos y cancelación bloqueados.
- [ ] Añadir `ocupado?: boolean` al `Dialogo`, por defecto falso, para deshabilitar Confirmar/Cancelar y `onRequestClose` mientras guarda. Propagar el estado a `Campo.editable`, botones de prueba y accesibilidad. Una referencia síncrona impide arrancar dos escrituras en el mismo ciclo; al fallar se desbloquea y conserva datos/error.
- [ ] Fijar el ID por contenido intentado: repetir los mismos datos tras error reutiliza UUID; una edición distinta crea otro. Probar pérdida de respuesta, cambio de valor y reintento; éxito limpia solo el formulario que estaba bloqueado, una sola vez. No alterar diálogos ajenos cuando `ocupado` se omite.

**Regresión de arranque para el archivo nuevo:**

```tsx
import { describe, expect, it, jest } from "@jest/globals"
import { act, fireEvent, render, screen } from "@testing-library/react-native"
import { AnadirMedida } from "./formularios"

jest.mock("expo-crypto", () => ({
  randomUUID: () => "11111111-1111-4111-8111-111111111111",
}))

describe("guardado protegido", () => {
  it("no admite cambios ni cancelación mientras guarda", async () => {
    let resolver!: () => void
    const esperando = new Promise<void>((resolve) => {
      resolver = resolve
    })
    const registrar = jest.fn(() => esperando)
    const cerrar = jest.fn()
    await render(<AnadirMedida visible cerrar={cerrar} registrar={registrar} />)
    await fireEvent.changeText(screen.getByLabelText("Peso (kg)"), "70,5")
    await fireEvent.press(screen.getByRole("button", { name: "Guardar" }))
    expect(screen.getByLabelText("Peso (kg)").props.editable).toBe(false)
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeDisabled()
    expect(cerrar).not.toHaveBeenCalled()
    await act(async () => resolver())
    expect(registrar).toHaveBeenCalledTimes(1)
    expect(cerrar).toHaveBeenCalledTimes(1)
  })
})
```

**Verificar:** `npm test --workspace apps/mobile -- --runInBand src/seguimiento/formularios.spec.tsx src/seguimiento/pantallas.spec.tsx src/entrenamiento/sesion/pantallas.spec.tsx`. Reutilizar el mock de `expo-crypto` de los tests de pantallas cuando lo requiera el entorno del archivo nuevo.

### RI04 · Mostrar el motivo real de solo consulta en comidas

**Entrega:** una dieta sin registro habilitado no se anuncia como desconectada ni ofrece guardar sin efecto. **Dependencia:** RI00. **Tamaño:** M, 4 archivos.

**Archivos:** `apps/mobile/app/nutricion/comida.tsx`, `apps/mobile/src/nutricion/comida-del-dia.tsx`, `apps/mobile/src/nutricion/comida-del-dia.spec.tsx`; **nuevo:** `apps/mobile/src/nutricion/comida-ruta.spec.tsx`.

- [ ] En la prueba de componente usar la comida sintética existente y un motivo `registroDesactivado`: no aparece «Sin conexión» ni «Registrar comida» y no se escribe nada. En la ruta reproducir `enLinea=true`, `documento.registroComidas=false`.
- [ ] Sustituir el booleano ambiguo por `motivoSoloLectura?: "sinConexion" | "registroDesactivado"`. Mostrar texto y controles según el motivo; propagar el bloqueo al botón de registrar de ambos formatos. Con registro desactivado: «Tu profesional ha dejado esta comida solo para consultar». Con falta de red: conservar la elección y permitir reintentar la carga/conexión sin fingir guardado.
- [ ] Cubrir plato único, varios platos e intercambio en los tres estados; con conexión y registro habilitado mantener confirmación real del servidor y corrección de la comida. Retirar `soloLectura` solo después de actualizar todos sus consumidores localizados con `rg`.

**Verificar:** `npm test --workspace apps/mobile -- --runInBand comida-del-dia.spec.tsx comida-ruta.spec.tsx`. No modificar contratos de dieta ni activar el registro desde la app cliente.

### Control A · RI01, RI02 y RI04

- [ ] Pruebas focales, tipos y lint pasan; los campos bloqueados comunican su estado al lector de pantalla.
- [ ] Recorrido autenticado con red lenta: el cliente ve el contenido que se guarda/envía; no puede efectuar una acción sin efecto. Si falta sesión, registrar exactamente esa verificación como pendiente.

### RI05 · Mostrar medidas de una misma toma

**Entrega:** el punto inicial no fabrica composición corporal mezclando meses. **Dependencia:** RI00. **Tamaño:** M, 4 archivos.

**Archivos:** `apps/mobile/src/seguimiento/progreso.tsx`, `apps/mobile/src/seguimiento/pantallas.spec.tsx`; **nuevos:** `apps/mobile/src/seguimiento/punto-de-partida.ts`, `apps/mobile/src/seguimiento/punto-de-partida.spec.ts`.

- [ ] Reproducir peso 80 kg en enero y grasa 20 % en septiembre: no debe aparecer 64 kg de masa libre como dato de enero. Probar también peso/grasa de una misma fila, campos vacíos, mismo día con dos tomas y fechas coincidentes de autores distintos.
- [ ] Extraer una función pura que seleccione la toma inicial y devuelva valores con fecha/ID de origen. Calcular masa libre solo si esa misma toma contiene peso y grasa; si se muestran valores independientes posteriores, cada uno conserva su fecha y no alimenta el cálculo combinado.
- [ ] Integrarla únicamente en el bloque de punto de partida. Mantener medidas previas, nacimiento/edad calculada para la fecha pertinente, orden y acceso a registros cotidianos. La ausencia queda como ausencia.

**Verificar:** `npm test --workspace apps/mobile -- --runInBand punto-de-partida.spec.ts pantallas.spec.tsx evolucion-valoraciones.spec.tsx`. Comprobar que una corrección de publicación no introduce un punto inicial duplicado por reutilizar datos de otra fuente.

### RI06a · Leer páginas de histórico sin perder lo reciente

**Entrega:** API con paginación estable y permisos existentes; endpoints anteriores compatibles. **Dependencia:** RI00; ejecutar con contratos exclusivamente a cargo del integrador. **Tamaño:** M, 5 archivos.

**Archivos:** `packages/shared/src/seguimiento.ts`, `apps/api/src/seguimiento/seguimiento.controller.ts`, `apps/api/src/seguimiento/seguimiento.service.ts`; **nuevos:** `apps/api/src/seguimiento/paginacion-seguimiento.ts`, `apps/api/test/seguimiento-paginacion.e2e-spec.ts`.

- [ ] Preparar en la base dedicada 501 medidas y 501 pruebas sintéticas, incluidas fechas iguales. Escribir pruebas que recorran las páginas y recuperen los 501 IDs sin duplicados, incluido el más reciente. Antes del cambio debe fallar la ruta/contrato nuevo; demostrar también la omisión de lo reciente en la ruta actual.
- [ ] Implementar los contratos y rutas definidos en `plan.md`. Cursor opaco validado de fecha/creación/ID; consulta por cliente, orden descendente, `limite + 1` y cursor siguiente solo si quedan filas. Cursor inválido: 400; acceso a otro cliente: mismo rechazo del alcance vigente. Una fila eliminada entre páginas no impide seguir por la tupla del cursor.
- [ ] Mantener los esquemas estrictos y campos de las rutas antiguas. Si hay que limitar la respuesta antigua, incluir los 500 más recientes y devolverlos en el orden histórico que esperaba su cliente; la nueva API da acceso al resto. No ejecutar una migración de datos ni eliminar/reescribir resultados.

**Verificar:** `npm run build:shared`; `npm run test:e2e --workspace apps/api -- --runTestsByPath test/seguimiento-paginacion.e2e-spec.ts test/seguimiento.e2e-spec.ts --testTimeout=30000`. Incluir 0/1/500/501 filas, cursores inválidos, cambio de cliente, nutricionista según alcance y orden con empates. Si `index.ts` no exporta por wildcard el módulo actual, separar la actualización de exportación antes de exceder el tamaño.

### RI06b · Consumir todo el histórico desde la app

**Entrega:** Inicio/Progreso siguen recibiendo el formato actual con los resultados recientes y antiguos. **Dependencia:** RI06a y RI05. **Tamaño:** M, 4 archivos.

**Archivos:** `apps/mobile/src/seguimiento/api.ts`, `apps/mobile/src/seguimiento/api.spec.ts`, `apps/mobile/src/seguimiento/pantallas.spec.tsx`; **nuevo:** `apps/mobile/src/seguimiento/paginas.ts`.

- [ ] Probar dos páginas de 500 + 1, página vacía, error en la segunda y cursor repetido. Afirmar que `api.medidas(clienteId)` incluye los 501 IDs ordenados y que el último indicador usa el más reciente; repetir con pruebas de nombres distintos.
- [ ] Añadir recorrido de páginas al adaptador, deduplicación por ID y orden final explícito. No cambiar las firmas consumidas por Inicio/Progreso. Propagar fallo de página y conservar la salida recuperable actual; no tratar como completo un resultado parcial.
- [ ] Medir carga y render con 5.000 registros sintéticos y documentar tiempo/peticiones; comprobar que salir de la pantalla no la repuebla al finalizar una petición antigua. Si la medida muestra un bloqueo de uso, dividir una tarea de lectura bajo demanda con sus contratos antes de esconder datos mediante otro límite silencioso.

**Verificar:** `npm test --workspace apps/mobile -- --runInBand src/seguimiento/api.spec.ts src/seguimiento/pantallas.spec.tsx hoy-inicio.spec.tsx`. Repetir HTTP focal si cambia el contrato. La prueba de rendimiento lleva datos sintéticos y resultados medidos, no una cifra supuesta.

### Control B · RI05, RI06a y RI06b

- [ ] El dato más reciente aparece después de más de 500 registros y el inicial conserva su fecha/origen; la consulta ofrece acceso al histórico completo.
- [ ] Compatibilidad, permisos, tipos y pruebas pasan. Una página fallida tiene recuperación explícita, no gráficos parciales presentados como definitivos.

### RI03 · Registrar parcialmente calentamiento y vuelta a la calma

**Entrega:** permitir corregir series sin perder la presentación compacta. **Dependencia:** RI01 y D01 integrado/verificado; no pisar la tabla mientras Claude activa metros. **Tamaño:** M, 5 archivos.

**Archivos:** `apps/mobile/src/entrenamiento/sesion/partes.tsx`, `apps/mobile/src/entrenamiento/sesion/partes.spec.tsx`, `apps/mobile/src/entrenamiento/registro-cliente.tsx`, `apps/mobile/src/entrenamiento/registro-cliente.spec.tsx`, `apps/mobile/src/entrenamiento/tabla-series.tsx`.

- [ ] Reproducir un calentamiento con dos series: una hecha y otra omitida, distinto tiempo/repeticiones y RIR opcional. Una pulsación en el ejercicio no debe borrar una ejecución parcial ni inventar que se hicieron ambas series.
- [ ] Añadir acceso «Registrar series» en el bloque compacto y reutilizar `TablaSeries` y las operaciones existentes. Mantener el atajo de completar lo pautado para el caso uniforme y explícito; al corregir/omitir conservar estado por serie y orden del bloque.
- [ ] Cubrir tiempo, repeticiones, metros, carga externa/calibración, RIR desactivado/final/por serie y registro bloqueado. Guardar → salir → continuar → enviar conserva la misma ejecución y la prescripción intacta.

**Verificar:** `npm test --workspace apps/mobile -- --runInBand partes.spec.tsx registro-cliente.spec.tsx tabla-series.spec.tsx registro-control.spec.ts`. Si integrar requiere un componente nuevo, dividir presentación e integración antes de sobrepasar cinco archivos.

### Control C · D01 y RI03

- [ ] Registrar y enviar un ejercicio en metros y un calentamiento parcial funciona de profesional a cliente y de vuelta; el historial anterior sigue legible.
- [ ] No hay segundo modelo de series, validación duplicada ni controles que queden activos tras comprometer el envío.

### RI07a · Liberar únicamente archivos temporales propios

**Entrega:** borrado nativo explícito, con propiedad del archivo comprobada. **Dependencia:** RI00. **Tamaño:** M, 4 archivos.

**Archivos:** `apps/mobile/package.json`, `package-lock.json`, `apps/mobile/src/seguimiento/preparar-foto.ts`, `apps/mobile/src/seguimiento/preparar-foto.spec.ts`.

- [ ] Reproducir que `liberarFoto` en Android/iOS no borra el temporal preparado. Añadir pruebas de copia en caché propia, original de galería, URI `content:`/`ph:`, archivo inexistente, error de borrado y web `blob:`.
- [ ] Leer la API de archivos compatible con el SDK Expo instalado y declarar `expo-file-system` como dependencia directa mediante `npx expo install expo-file-system` desde `apps/mobile` si se usa. Identificar explícitamente las copias creadas por selección/preparación y borrar solo esas. No borrar rutas arbitrarias ni el original de la fototeca; no usar rutas proporcionadas por el servidor para eliminar archivos.
- [ ] Hacer el borrado idempotente y esperar o gestionar su resultado sin rechazos no controlados. Mantener reducción, orientación, JPEG y límite de bytes existentes. Documentar la conducta frente a un error real de almacenamiento del dispositivo, sin afirmar que se borró si falló.

**Verificar:** `npm test --workspace apps/mobile -- --runInBand preparar-foto.spec.ts`; `npm run typecheck`. Instalar/compilar no sustituye una comprobación física de cámara, galería y caché.

### RI07b · Integrar la limpieza con reintentos y cierre de pantalla

**Entrega:** conservar la copia mientras permita reintentar y retirarla cuando ya no hace falta. **Dependencia:** RI07a. **Tamaño:** M, hasta 4 archivos.

**Archivos:** `apps/mobile/src/seguimiento/solicitudes-fotos.tsx`, `apps/mobile/src/seguimiento/solicitudes-fotos.spec.tsx`, `apps/mobile/src/seguimiento/preparar-foto.ts`, `apps/mobile/src/seguimiento/preparar-foto.spec.ts`.

- [ ] Probar éxito, fallo de red con reintento idéntico, elección de otra imagen, cancelación y desmontaje durante preparación/subida. Una preparación que termina después de desmontar debe limpiar su copia y no repoblar la pantalla.
- [ ] Integrar la liberación con el estado de cada intento. No borrar una copia usada por un PUT activo ni crear otra operación al reintentar el mismo contenido; al terminar/descartar ya no se conserva un temporal innecesario.
- [ ] Volver a probar varias vistas de una solicitud y la retirada desde el comparador. Registrar qué queda confirmado en servidor y qué es solo selección local.

**Verificar:** `npm test --workspace apps/mobile -- --runInBand solicitudes-fotos.spec.tsx preparar-foto.spec.ts comparador-fotos.spec.tsx`; cámara/galería reales quedan en Q03.

### Continuación F/E · Completar los flujos existentes

No duplicar los desgloses F03b/F04b/F05b/E01b/E02b de abajo. Ejecutarlos después de RI07 y usar su aceptación original. Dividir la integración que exceda cinco archivos:

- [ ] **F03b-1 · Subida profesional reutilizable.** Nuevos `apps/mobile/src/seguimiento/subida-fotos.tsx` y `subida-fotos.spec.tsx`, más `medios-api.ts` si hace falta: destino de valoración, vista/fecha, misma operación al reintentar, estados seleccionada/subiendo/confirmando/disponible/error. Tests con doble pulsación, respuesta perdida y consentimiento retirado. Verificar con `npm test --workspace apps/mobile -- --runInBand subida-fotos.spec.tsx`.
- [ ] **F03b-2 · Conexión al borrador.** `editor-valoracion.tsx` y `editor-valoracion.spec.tsx`: asociar solo medios confirmados a la revisión correcta; conservar el borrador ante error/conflicto. Verificar `npm test --workspace apps/mobile -- --runInBand editor-valoracion.spec.tsx` y HTTP `test/valoraciones-fotos.e2e-spec.ts` / `test/medios.e2e-spec.ts`. Cliente no ve la foto profesional antes de publicar.

### Control D · RI07 y F03b

- [ ] Entrenador sube/guarda/publica, cliente consulta y compara, cancelación/reintento no duplican ni pierden medios.
- [ ] La limpieza de archivos propios está probada en código; el ensayo físico sigue pendiente hasta observarlo. Las regresiones de consentimiento y almacenamiento permanecen verdes.

### E02c · Avisos de seguimiento en la ficha profesional

**Entrega:** entrenador encuentra las fotos recibidas con lectura individual y destino funcional. **Dependencia:** F03b/F04b y E02b. **Tamaño:** M, 4 archivos.

**Archivos:** `apps/mobile/src/entrenamiento-entrenador/ficha/ficha-cliente.tsx`, `ficha-cliente.spec.tsx` en ese directorio; `apps/mobile/src/seguimiento/valoraciones-novedades.tsx`, `valoraciones-novedades.spec.tsx`.

- [ ] Reproducir que la API ofrece el aviso de fotos recibidas pero no se monta en la ficha. Añadir caso con permiso profesional, aviso sin leer y destino a solicitudes/valoración del mismo cliente.
- [ ] Montar el componente existente en modo profesional con la API de valoraciones que ya recibe la ficha. Seleccionar la pestaña/destino útil; marcar lectura solo para el usuario actual. Un fallo permite reintentar y no marca la solicitud revisada.
- [ ] Probar volver/recargar, cliente sin novedades y cambio de cliente sin reutilizar datos anteriores. Revisar no leído tras fotos adicionales: si la API actual no genera un aviso nuevo, documentarlo y resolver el contrato en subtarea antes de prometer esa actualización en UI.

**Verificar:** `npm test --workspace apps/mobile -- --runInBand ficha-cliente.spec.tsx valoraciones-novedades.spec.tsx`; HTTP `test/valoraciones-novedades.e2e-spec.ts`. Recorrido profesional recibe → abre → revisa explícitamente → cliente consulta.

### Integración, catálogo y cierre

- [ ] **D01:** integrar el HEAD final verificado de `claude/mejoras-pdf`, conservando el parche de consentimiento y las RI. Repetir `test/entrenamiento-distancia.e2e-spec.ts` y las pruebas del controlador, tabla y constructor. Si aún hay trabajo activo en esa rama, fijar qué commit se integra; no asumir que su HEAD deja de cambiar.
- [ ] **D04/D07:** continuar sus desgloses existentes según la decisión posterior registrada en coordinación. No ejecutar D02/D03/D05/D06 a partir de un párrafo histórico. Actualizar especificaciones y estado al integrar, conservando lo aplazado como tal.
- [x] **FIG01 · Diagnóstico de figuras.** `docs/animaciones-ejercicios.md`, `tasks/evidencia-valoraciones.md`: localizar originales gratuitos/licencias y carpeta efectiva, contrastar `MEDIOS_DIR` con los archivos y ejecutar `node apps/api/dist/catalogo-ejercicios/preparar-catalogo.js` sin `--confirmar`. Registrar cobertura real. No declarar listos 52 ejercicios por tener un índice de 52 entradas.
- [x] **FIG02 · Activación comprobada.** Tras disponer de los archivos permitidos y la autorización de carga inicial de PR3, importar/asociar sin sobrescribir contenido del entrenador y comprobar reproducción desde la guía/registro. Respetar streaming y restricciones sin conexión de cada medio. Si falta proveedor/archivo/licencia, el ejercicio muestra el recurso técnico disponible sin un control vacío.
      **Evidencia FIG01/FIG02, 24-09-2026 (Claude), con autorización de David («Todo»):**
  - **Carpeta de figuras.** `MEDIOS_DIR` (`%LOCALAPPDATA%\alpha-omega\medios`) contiene las 52 figuras transcodificadas: 104 archivos, entre vídeo y póster. Las licencias están en `docs/animaciones-ejercicios.md`.
  - **Los ejercicios de David.** Tenía 6 en `alpha_omega` y ninguno con figura, por eso el entreno activo mostraba la foto genérica. Solo dos tienen un movimiento equivalente entre las figuras gratuitas. `1125837` añade al catálogo inicial los `equivalentes` «Sentadilla goblet» y «Peso muerto rumano»: si ya existen, reciben la figura en vez de duplicarse. `catalogo-inicial.e2e-spec` y `figuras-de-ejercicio`: 73 pruebas.
  - **Carga.** Primero la simulación («50 creados, 52 figuras asociadas, 2 ya existían, 0 figuras sin importar») y después `--confirmar` con el mismo resultado, salida 0. `alpha_omega` queda con 56 ejercicios y 52 figuras. Sentadilla goblet → `vital-0064` y Peso muerto rumano → `vital-0060`. Press de banca, Remo con mancuerna, Plancha frontal y Puente de glúteos siguen sin figura gratuita: necesitan vídeo del entrenador o figuras de pago. No se modificó ni borró ningún ejercicio ni contenido existente.
  - **Entreno activo.** `registro-cliente.tsx` pide la ficha del ejercicio actual y reproduce su figura. **Pendiente:** verlo en una sesión autenticada (David) y en un móvil real.
- [ ] **E03/Q01/Q02:** ejecutar los recorridos y controles ya definidos abajo después de todas las integraciones; actualizar README/especificaciones y retirar solo código sustituido sin consumidores. Mantener una lista de fallos concretos si aparece una regresión.
- [ ] **Q03 y producción:** registrar resultados físicos/observados, bucket real, correo/enlaces HTTPS, restauración de copia y distribución. Lo externo que falte no se da por resuelto por ejecutar tests.

**Puerta de entrega:** `npm run typecheck`, `npm run lint`, `npm test`, `npm run test:e2e` en base dedicada, `npm run build --workspace apps/api` y `git diff --check`, todos con salida 0 y evidencia de la revisión final de código. Distinguir implementación, navegador, dispositivo y producción; los puntos de control no autorizan cuentas externas, publicación o siembra de la base por sí solos.

## Base

- [x] **T00 · Integración y archivo.** Base Fable integrada por avance directo; rama `codex/cliente-intuitivo` creada; 21 documentos históricos archivados con índice y referencias actualizadas. Los HTML, PDF, scripts y archivos del usuario permanecen. Evidencia: avance directo desde `d7d8ef0`, `git diff --check` sin errores.

## Entrenamiento guiado

- [x] **T01 · Contratos compatibles.** RIR configurable, tipo de carga y serie omitida; documentos antiguos se leen. Evidencia: contratos compartidos y pruebas de compatibilidad API.
- [x] **T02 · Controles profesionales.** Ajustes editables en sesión y constructor, incluso al duplicar y publicar. Evidencia: pruebas de editor/constructor y tipos completos.
- [x] **T03 · Navegación.** Ejercicio actual, lista plegable y orden pautado; RIR final mantiene el ejercicio visible hasta avanzar. Evidencia: pruebas del modelo y la tabla de series.
- [x] **T04 · Registro.** Campos por unidad/carga, «Hecha», omisión, RIR opcional, técnica y molestia accesibles. Calentamiento con carga externa solicita kg. Evidencia: pruebas de componentes y validación de registro.
- [ ] **T05 · Tiempo y recuperación.** Código y pruebas de reloj, pausa, recarga y sincronización pasan; falta comprobar bloqueo, salida y recuperación en un móvil físico.
- [ ] **T06 · Inicio y fecha.** Estados y cambio semanal implementados, incluido inicio sin red desde copia local. Pruebas de semana y API pasan; falta revisión visual del cliente autenticado.

**Punto de control 1:** configurar, iniciar, registrar, salir, continuar y mover fecha conservando prescripción y datos.

## Entrega y comunicación

- [x] **T07 · Envío.** Intención persistida antes de la red, reintentos con UUID estable y conflicto recuperable. Evidencia: pruebas de pérdida de respuesta, desconexión y envío HTTP.
- [x] **T08 · Cierre visible.** Resumen hechas/omitidas/pendientes y estados de guardado/entrega; progresión solo en panel profesional. Evidencia: pruebas de cierre, control y resultado.
- [x] **T09 · Revisión y novedades API.** Revisión explícita y lectura por actor con permisos; las respuestas concurrentes a molestias no duplican avisos. Evidencia: migración aplicada y pruebas HTTP.
- [x] **T10 · Seguimiento visible.** Revisión en panel, novedades en inicio y cambios de día para entrenador; lista paginada sin avisos inaccesibles. Evidencia: pruebas de componentes, persistencia y permisos HTTP.

**Punto de control 2:** envío confirmado sin pérdida; revisión y respuesta distinguibles por cliente.

## Nutrición

- [x] **T11 · Formato por comida.** Selector, valores iniciales, vista previa y confirmación al cambiar de formato con contenido. Evidencia: pruebas de editor, borrador y publicación.
- [x] **T12 · Comidas cliente.** Plato único, varios platos e intercambio explícito; solo el detalle permite registrar, con selección conservada tras fallo. Evidencia: pruebas de las tres situaciones y corrección.
- [x] **T13 · Suplementos.** Inicio muestra solo los publicados y comparte registro diario con Nutrición. Evidencia: pruebas con dietas con/sin suplementos.

## Seguimiento

- [x] **T14 · Configuración y API.** Indicadores, frecuencia, peso y pruebas prescritas con revisión y permisos. Evidencia: migración aditiva y pruebas HTTP en `alpha_omega_e2e_codex`.
- [x] **T15 · Panel profesional.** Editor y vista previa del seguimiento del cliente. Evidencia: pruebas de guardado y relectura.
- [x] **T16 · Progreso.** Indicadores, próximo registro, resultados prescritos e historial. Evidencia: pruebas con datos existentes, vacíos y parciales.

**Punto de control 3:** dieta mixta y seguimiento publicados por profesional coinciden con lo registrado por cliente.

## Final

- [ ] **T17 · Integración y calidad.** Código, especificaciones y servicios integrados en la carpeta principal. Comandos completos pasan; faltan revisión visual a 360/390 px en pantallas autenticadas y dispositivo físico.
- [ ] **Prueba física y observada.** Comprobar en móvil bloqueo, pausa, recuperación y pérdida de conexión. Observar a tres personas continuar, registrar serie, mover día, registrar comida y encontrar respuesta sin instrucciones; guardar resultados.

## Evidencia de integración · 24-09-2026

- `npm run typecheck`: correcto.
- `npm run lint`: correcto; incluye ESLint y Prettier.
- `npm test`: 17 suites / 100 pruebas API; 50 suites / 265 pruebas móvil.
- `$env:POSTGRES_DB='alpha_omega_e2e_codex'; npm run test:e2e` (PowerShell): 31 suites / 318 pruebas HTTP en la base dedicada, sin usar la base de demostración.
- `npm run build --workspace apps/api`: correcto.
- `npx prisma migrate status`: 22 migraciones; base `alpha_omega` al día.
- `git diff --check`: sin errores.
- API integrada en `http://localhost:3000/salud` y web en `http://localhost:8181/login`: ambas responden 200. La sesión del navegador caducó; falta entrar de nuevo para revisar las pantallas autenticadas.

## Primera revisión incremental · 24-09-2026

- [x] **R01 · Copia de entrenamiento compatible.** Si cambia el tipo de carga, recuperar una copia anterior deja pendientes las series cuya carga ya no admite la pauta. El respaldo conserva la ejecución original. Dos regresiones cubren ambos sentidos del cambio y verifican que el registro recuperado sea válido para enviar. `registro-control.spec.ts`: 14 pruebas pasan. Commit `7432a28`.
- [x] **R02 · Guardado del editor de seguimiento.** Los controles y campos se bloquean mientras se guarda; una guarda síncrona evita peticiones duplicadas. Un error conserva el formulario y permite reintentar. Dos pruebas comprueban respuesta demorada y fallo de guardado. Commit `4a7bed5`.
- [x] **R03 · Inicio según la pauta.** Los accesos de peso, pasos y sueño respetan indicadores visibles, orden y frecuencia diaria/semanal. Si no corresponde ninguno se informa en pantalla. El diálogo evita perder una edición durante el envío. Evidencia: regresiones de configuración, día semanal, estado vacío y respuesta demorada en `hoy-inicio.spec.tsx`.
- [x] **R04 · Registro de suplementos.** Inicio y Nutrición esperan a cargar las tomas del día antes de modificarlas y bloquean las pulsaciones mientras guardan. Una toma se marca solo tras confirmación del servidor; un error permite reintentar. Evidencia: regresiones con lecturas demoradas, pulsaciones rápidas, confirmación y fallo de red en ambas pantallas. Pruebas focales de R03/R04: 22/22. Commit `806acd8`.

Pendientes de próximas pasadas: comprobar el acceso desde Inicio a la cintura cuando esté pautada; revisar la corrección de RIR de una serie ya marcada. Son puntos por revisar, no funcionalidades dadas por verificadas.

**Limitación visual de esta pasada:** el usuario indica que ha entrado en la pestaña de Codex, pero la pestaña accesible a las herramientas sigue mostrando `/login` y redirige allí al abrir Inicio. No se atribuye al usuario ni se da por completada la revisión visual autenticada. Las pruebas en móvil físico y con tres personas siguen pendientes.

**Verificación integrada de esta pasada:** `npm test --workspace apps/mobile -- --runInBand`: 51 suites / 282 pruebas correctas; `npm run typecheck` y `npm run lint`: correctos. Revisión independiente de recuperación y editor sin hallazgos adicionales reproducibles. API `/salud` y web `:8181/login` responden 200. No hay cambios en API, contratos ni migraciones en esta pasada; no se repiten las pruebas HTTP ni se modifican registros de la base principal.

## Preparación para producción · 24-09-2026

Encargo de David: «termina la aplicación, que quede para producción, acuérdate de los muñecos». Lo que no depende de código sigue en `docs/PENDIENTE-PARA-PRODUCCION.md`.

- [x] **PR1 · Consentimiento de datos de salud (RGPD, art. 9).** Texto versionado (`VERSION_CONSENTIMIENTO = "2026-09-24-borrador"`), aceptación explícita sin nada marcado, retirada desde Perfil y reactivación. La API responde 409 `consentimiento_pendiente` en las 10 rutas que guardan datos de salud (medidas, días, pruebas, valoraciones, fotos, molestias y comidas), las use el cliente o su equipo. El guard comprueba el alcance antes para no revelar el consentimiento de clientes ajenos. El entrenador ve el estado en la ficha. Evidencia: `consentimiento.e2e-spec.ts` (4), `consentimiento.guard.spec.ts` (5), `consentimiento.spec.tsx` (7), `errores.spec.ts` (2) y `ficha-cliente.spec.tsx`; suite e2e completa: 41 suites y 436 pruebas. **Pendiente:** revisión legal del texto y aviso de privacidad (PENDIENTE, punto 4).
- [x] **PR2 · Almacén de fotos de producción.** `AlmacenS3` para cualquier servicio compatible con S3: firma tipo y tamaño y desactiva las sumas automáticas, que romperían las URLs prefirmadas. `ALMACEN=s3|local`; con `NODE_ENV=production` la API no arranca sin elegirlo. Evidencia: `almacen-s3.spec.ts` (5) y `almacen-configurado.spec.ts` (4); e2e de fotos con el contrato asíncrono: 28 pruebas. **Pendiente:** elegir proveedor en la UE y probar con un bucket real (PENDIENTE, punto 5).
- [x] **PR3 · Figuras animadas («muñecos») y catálogo inicial.** `catalogo-inicial.ts` tiene 52 ejercicios, uno por figura de Vital Free50 y MoveKit, con textos propios y sin cifras. `preparar-catalogo.js` los crea con su figura; sin `--confirmar` solo informa, y nunca cambia ni borra nada. `catalogo-inicial.e2e-spec.ts`: 60 pruebas en la base desechable. Entorno principal: figuras copiadas a `%LOCALAPPDATA%\alpha-omega\medios\figuras` (104 archivos, 12 MB) y `MEDIOS_DIR` en el `.env` local. **Pendiente de David:** ejecutar `preparar-catalogo.js --confirmar` contra `alpha_omega`. No se ha hecho, porque la regla prohíbe sembrar esa base sin su permiso.
- [x] **PR4 · Despliegue.** `docs/DESPLIEGUE.md`: variables, bucket, migraciones solo con `migrate deploy`, cuenta del entrenador, figuras, arranque, actualización, app con EAS y copias. La API activa los ganchos de cierre (`SIGTERM`). `PENDIENTE-PARA-PRODUCCION.md` queda actualizado con el estado real de los puntos 4, 5, 6, 9, 9b, 9c y 9d.

### Correcciones de la revisión de producción · Codex · 24-09-2026

- [x] **PR1a · Consentimiento en operaciones pendientes.** La confirmación de fotos y los nuevos borradores/envíos de entrenamiento comprueban el cliente propietario y el consentimiento vigente dentro de la transacción. Un bloqueo compartido de la fila coordina la escritura con la retirada. Los reintentos ya completados conservan su respuesta histórica sin crear registros nuevos. `consentimiento-pendientes.e2e-spec.ts`: 6 pruebas de retirada anterior o simultánea. La prueba anterior que dependía del estado de otra se sustituyó por casos aislados; `consentimiento.e2e-spec.ts` conserva sus 4 pruebas originales.
- [x] **PR2a · Foto final separada de la subida.** Cada intento usa una clave UUID registrada antes del PUT; solo la ganadora se publica. Descartar confirma el estado antes del borrado externo, sin mantener transacciones durante I/O. La tabla aditiva `intentos_foto` conserva las claves descartadas para reintentar fallos y recuperar escrituras tardías aun si la intención original se borró. Se mantiene la limpieza del temporal tras caducar y la compatibilidad con fotos antiguas. `medios.e2e-spec.ts`: 18 pruebas, incluidas sustitución de contenido/metadatos, confirmaciones solapadas, escritura más lenta que la transacción, error tras escribir, limpieza fallida y pérdida de respuesta del commit. Migración: `20260924210000_intentos_foto`; transición y límites en ADR 0005.

**Verificación de este tramo:** suite completa `npm test`: 188 pruebas API en 23 suites y 452 móviles en 65 suites. HTTP completo: 448 pruebas en 42 suites, únicamente contra `alpha_omega_e2e_codex` con imágenes sintéticas y almacén temporal. `npm run typecheck` y `npm run build --workspace apps/api`: correctos. Revisión independiente del parche final sin nuevos hallazgos. Las pruebas no sustituyen la comprobación física o con un bucket real. La comprobación global y los pendientes se consolidan en [revisión integral](revision-integral-2026-09-24.md).

## Ampliación propuesta · valoración inicial y revisiones · 24-09-2026

**Estado: planificación; todas las tareas siguientes están pendientes.** Este desglose amplía el mismo trabajo y conserva T05, T06, T17 y la prueba observada pendientes hasta obtener su evidencia. No autoriza por sí mismo implementar, ejecutar migraciones sobre la base principal ni desplegar. El encargo actual consiste en preparar la entrega para Claude con Agent Skills.

**Decisión de David sobre los PDF: «todo menos k1».** Se incorporan al alcance planificado D01, D02 y D04–D07 del [informe de revisión](revision-pdfs.md); D03 queda expresamente excluido. La aprobación amplía el plan para Claude, no cambia el encargo actual de solo documentación. Los tres PDF revisados no aportan una ficha con puntos de pliegues ni resultados desglosados de bioimpedancia. Siguen pendientes la selección concreta de perímetros, puntos, lateralidad e instrumento: usar plantilla configurable sin inventarlos. No copiar datos personales, credenciales ni fotografías reales a documentación o fixtures.

**Nota de vigencia:** el párrafo anterior conserva la primera decisión. La decisión posterior registrada en coordinación limita las mejoras a D01/D04/D07; la ejecución actual comienza en RI00. Los puntos de la valoración ya verificados siguen hechos y los excluidos no se reactivan.

### Instrucciones de ejecución para Claude

- Leer `tasks/plan.md`, este desglose, `SPEC-seguimiento-corporal.md`, `docs/adr/0005-almacenamiento-de-fotos.md` y los contratos/código afectados antes de cada tramo. Aplicar `using-agent-skills` y las skills correspondientes a implementación incremental, contratos, pruebas y revisión. Resolver contradicciones documentales antes de cambiar el comportamiento afectado; continuar el trabajo independiente que sí esté definido.
- **Responsable único de integración: Claude principal.** Solo él modifica `packages/shared/src/*`, `apps/api/prisma/schema.prisma`, migraciones y rollback, registros de módulos Nest, `package.json`, `package-lock.json`, `apps/mobile/app/index.tsx`, `progreso.tsx`, `ficha-cliente.tsx` y `editor-valoracion.tsx`. Si posteriormente se autoriza delegar, asignar únicamente componentes/servicios aislados con dueño explícito; el responsable integra sus contratos y puntos comunes de forma secuencial.
- Los nombres nuevos son rutas propuestas, no archivos existentes. El dominio se denomina seguimiento corporal y su directorio real es `apps/api/src/seguimiento`. Conservar las rutas y registros anteriores; no renombrar el módulo entero.
- Cada tarea enumera un máximo de cinco archivos de producto, pruebas o documentación. La actualización de estado/evidencia en este mismo registro es obligatoria y transversal. Si el trabajo necesita más archivos o más de tres criterios, subdividirlo antes de empezar y conservar el ID padre. No ampliar una tarea para corregir problemas independientes encontrados por el camino.
- En cada cambio de comportamiento: reproducir con una prueba relevante, implementar el mínimo, ejecutar la prueba y registrar evidencia. En cada punto de control ejecutar `npm run typecheck`, las pruebas focales del tramo y `git diff --check`; comprobar el recorrido indicado. Los puntos de control son verificaciones, no peticiones repetidas de permiso cuando la implementación ya esté autorizada.
- Ejecutar los comandos desde la raíz. Antes de pruebas API que importen contratos nuevos, ejecutar `npm run build:shared`. Las pruebas HTTP y cualquier ensayo de migración/rollback usan una base desechable: en una sesión PowerShell dedicada establecer `$env:POSTGRES_DB='alpha_omega_e2e_codex'` y comprobar el destino sin imprimir secretos. Nunca ejecutar reset, seed o rollback sobre `alpha_omega`. Crear la migración con fecha real al implementar; `<fecha>` es un marcador de ruta.
- Las pruebas visuales, físicas y con personas se registran por separado. Un fallo de acceso bloquea la verificación autenticada correspondiente, no toda la implementación independiente. Si falta dispositivo o participación humana, conservar el pendiente y describir exactamente qué evidencia falta.

### C00 · Recuperar el acceso de revisión

**Descripción:** diagnosticar la combinación de servidor, cuenta y sesión que impide revisar el cliente autenticado, sin modificar cuentas reales para que la prueba pase.

**Criterios:**

- [x] Se identifica el entorno de API/web y se confirma una sesión autorizada de cliente y entrenador, o se documenta el bloqueo concreto sin credenciales.
- [x] No se restablecen contraseñas, alteran roles ni crean registros de salud en la cuenta principal como atajo.

**Verificación:** comprobar `/salud`, abrir Inicio y la ficha del cliente con las sesiones disponibles y anotar URL de entorno, rol, fecha y resultado; una redirección a login no cuenta como acceso correcto.

**Dependencias:** ninguna. **Responsable:** Claude principal. **Archivos previstos:** `tasks/evidencia-valoraciones.md` (nuevo). **Tamaño:** S, 1 archivo.

**Evidencia 24-09-2026 (Claude):** bloqueo documentado en [evidencia-valoraciones.md](evidencia-valoraciones.md). `/salud` 200 en 3000 y 3101. La cuenta usada en el navegador solo existe en la base del worktree Fable (`alpha_omega_fable_i3`, web 8182/API 3101); la web principal 8181 usa la API 3000 y `alpha_omega`. En 8181 la sesión figura caducada: **no hay sesión autorizada**; la revisión autenticada espera a que David entre con una cuenta de cliente y otra de entrenador de `alpha_omega`. No se modificó ninguna cuenta ni dato.

### C01 · Revisar las pantallas actuales

**Descripción:** completar una revisión de Inicio, Entreno, Plan, Nutrición y Progreso antes de integrar la ampliación, conservando las decisiones aprobadas.

**Criterios:**

- [ ] Los recorridos de T06/T17 se comprueban autenticados a 360 y 390 px, con fecha, pasos, resultado y capturas sin información privada.
- [ ] Se separan fallos reproducibles, mejoras opcionales y comprobaciones pendientes; ninguna captura web cierra T05 ni la prueba física.

**Verificación:** continuar sesión, corregir una serie, mover día, registrar comida/suplemento, registrar seguimiento y encontrar respuesta del entrenador; comprobar teclado, foco, desplazamiento y retorno.

**Dependencias:** C00 para la parte autenticada. **Responsable:** Claude principal. **Archivos previstos:** `tasks/evidencia-valoraciones.md`. **Tamaño:** S, 1 archivo.

**Punto de control C-A · C00–C01:** [ ] existe evidencia autenticada o un bloqueo preciso; los hallazgos nuevos no se incorporan silenciosamente al alcance. No ejecutar pruebas de código si solo se documentó la observación.

### C02 · Corregir RIR de una serie hecha

**Descripción:** comprobar el pendiente de RIR y corregir únicamente el fallo que se reproduzca al editar una serie ya marcada.

**Criterios:**

- [x] En modo por serie se puede corregir o dejar sin anotar el RIR de una serie hecha, conservando repeticiones, carga y estado.
- [x] La corrección persiste al salir/volver; los modos desactivado y al terminar ejercicio mantienen su comportamiento y el dato sigue siendo opcional.

**Verificación:** `npm test --workspace apps/mobile -- --runInBand tabla-series.spec.tsx registro-control.spec.ts`; recorrido manual hacer → corregir RIR → salir → continuar. Si ya funciona, registrar la evidencia sin un cambio artificial.

**Dependencias:** ninguna para pruebas; C00 para comprobarlo autenticado. **Responsable:** Claude principal. **Archivos previstos:** `apps/mobile/src/entrenamiento/tabla-series.tsx`, `tabla-series.spec.tsx` en el mismo directorio; `apps/mobile/src/entrenamiento/registro-control.ts`, `registro-control.spec.ts` en el mismo directorio. **Tamaño:** M, hasta 4 archivos.

**Evidencia 24-09-2026 (Claude):** fallo reproducido con una prueba que fallaba: en modo por serie la pregunta «¿Cuántas te quedaban?» solo acompañaba a la serie en curso; al marcar la serie hecha, su celda de RIR quedaba fija. Cambio en `tabla-series.tsx`: la celda de una serie hecha es un botón que abre la misma pregunta para corregirla; «Sin anotar» deja el RIR vacío; solo se envía `{ rir }`, sin tocar carga, repeticiones ni estado; con el registro bloqueado no se abre. `registro-control.ts` no necesitó cambios: una prueba nueva confirma que corregir y quitar el RIR persisten al reabrir y que el borrador enviado omite el RIR vacío. `npm test --workspace apps/mobile -- --runInBand tabla-series.spec.tsx registro-control.spec.ts`: 2 suites / 20 pruebas; carpeta `src/entrenamiento`: 26 suites / 114 pruebas; `typecheck` y lint correctos. **Pendiente:** recorrido manual hacer → corregir → salir → continuar, bloqueado por C00.

### C03 · Acceder a cintura cuando está pautada

**Descripción:** completar el acceso desde Inicio al registro de cintura usando el modelo de medidas y la pauta existentes.

**Criterios:**

- [x] Cintura aparece y permite registrar desde Inicio solo cuando lo permite la configuración y corresponde por frecuencia/día; el valor se consulta también en Progreso.
- [x] La unidad es cm, acepta coma decimal y un error mantiene la edición; pulsaciones repetidas durante el guardado no duplican la medida.

**Verificación:** `npm test --workspace apps/mobile -- --runInBand hoy-inicio.spec.tsx pantallas.spec.tsx`; comprobar pauta diaria, semanal, indicador oculto, respuesta demorada y fallo de red.

**Dependencias:** C01 para contrastar el hallazgo, C00 para la prueba visual. **Responsable:** Claude principal. **Archivos previstos:** `apps/mobile/src/nutricion/hoy-inicio.tsx`, `hoy-inicio.spec.tsx` en el mismo directorio; `apps/mobile/src/seguimiento/formularios.tsx`, `pantallas.spec.tsx` en el mismo directorio; `apps/mobile/app/index.tsx`. **Tamaño:** M, hasta 5 archivos.

**Evidencia 24-09-2026 (Claude):** reproducido con seis pruebas que fallaban: Inicio filtraba los indicadores a peso, pasos y sueño, y la cintura pautada nunca aparecía. Cambio en `hoy-inicio.tsx`: la cintura sale en «Hoy» cuando es visible y está solicitada a diario o para el día de la semana; muestra la última medida de hoy (leída solo si toca pedirla), guarda con el registro de medidas existente (`registrarMedida`, cm, coma decimal, 30–300) y comparte el bloqueo de guardado del resto de filas. Un reintento del mismo valor reutiliza su `operacionId`, así que el servidor no duplica la medida. `formularios.tsx` y `app/index.tsx` no necesitaron cambios. Pruebas nuevas: pauta diaria, semanal (toca/no toca), indicador oculto, valor fuera de rango, fallo de red con reintento idempotente, respuesta lenta con pulsaciones repetidas y consulta posterior en Progreso. `npm test --workspace apps/mobile -- --runInBand hoy-inicio.spec.tsx pantallas.spec.tsx`: 4 suites / 44 pruebas; `typecheck`, lint y `git diff --check` correctos. **Pendiente:** comprobación visual autenticada (C00).

**Punto de control C-B · C02–C03:** [x] RIR y cintura tienen evidencia focal; [ ] se revisan sus recorridos autenticados cuando haya sesión (pendiente de C00); [x] T05/T06/T17 solo cambian de estado en la parte realmente verificada (no se han cambiado).

### V01 · Fijar contratos de valoración

**Descripción:** definir los documentos de plantilla, borrador, publicación, corrección, próxima revisión y consulta que utilizarán API y pantallas.

**Criterios:**

- [x] Los contratos diferencian pendiente/registrado/no realizado, cero/sin dato, fecha de toma/creación/publicación, notas internas/conclusión visible y resultados de fuentes distintas.
- [x] IDs y versiones conservan la identidad; `revision` evita sobrescritura y `operacionId` identifica reintentos con conflicto si cambia el contenido.
- [x] La especificación fija por rol qué campos se leen/escriben, el inicio de una corrección y las respuestas de error; no da acceso al nutricionista por reutilizar el documento completo.

**Verificación:** `npm run build:shared`; `npm test --workspace apps/api -- --runInBand valoraciones-contratos.spec.ts`; cubrir documentos parciales, valores inválidos, campos internos excluidos y compatibilidad de contratos previos.

**Dependencias:** lectura del plan; independiente del bloqueo visual C00. **Responsable:** Claude principal, dueño de contratos. **Archivos previstos:** `packages/shared/src/valoraciones.ts`, `packages/shared/src/index.ts`, `apps/api/src/seguimiento/valoraciones-contratos.spec.ts`, `SPEC-seguimiento-corporal.md`. **Tamaño:** M, 4 archivos.

**Evidencia 24-09-2026 (Claude):** contratos en `packages/shared/src/valoraciones.ts` (plantilla, definiciones versionadas, resultados pendiente/registrado/noRealizado, documento de borrador, proyección pública y corporal, historial profesional y publicado, crear/cambiar/publicar con `operacionId`, `borradorId` y `revision`, próxima revisión) y código `409 estado_incompatible` en `errores-api.ts`; especificación en `SPEC-seguimiento-corporal.md`, sección «Valoración inicial y revisiones». Revisión adversarial con subagentes (tres enfoques: plan, privacidad, corrección técnica; cada hallazgo verificado por un escéptico): 13 hallazgos confirmados y corregidos antes de construir encima (documento interno vigente para el entrenador y corrección a partir de él, `borradorId` obligatorio para no pisar una corrección, lecturas de pliegue pendientes, cero no admitido en magnitudes físicas, decimales sin ruido, clave de métrica heredada, orden de métricas, historial publicado sin estado, salidas que garantizan definición↔resultado, vínculo pauta→visita, textos visibles documentados); el resto se descartó con motivo. `npm run build:shared` correcto; `npm test --workspace apps/api -- --runInBand valoraciones-contratos.spec.ts`: 19 pruebas.

### V02 · Persistir visitas y publicaciones sin alterar el histórico

**Descripción:** añadir almacenamiento de plantillas, visitas, publicaciones inmutables, pauta de revisión y lectura de avisos, preparando los estados usados en las siguientes tareas.

**Criterios:**

- [x] La migración es aditiva y mantiene medidas, pruebas y diarios antiguos; claves, revisiones e índices sirven al aislamiento por cliente y al historial paginado.
- [x] Se distinguen snapshot de plantilla, borrador, publicación y publicación sustituida; las restricciones impiden duplicar una operación o completar dos veces la misma revisión.
- [x] Migración y reversión se ensayan solo con datos sintéticos en base desechable; el procedimiento no elimina registros históricos ajenos a la ampliación.

**Verificación:** `npx prisma validate`; `npx prisma generate`; aplicar `npx prisma migrate deploy` en la base de prueba, probar reversión/reaplicación según el SQL documentado y ejecutar `npm run test:e2e --workspace apps/api -- --runTestsByPath test/valoraciones-persistencia.e2e-spec.ts`.

**Dependencias:** V01. **Responsable:** Claude principal, único dueño de migraciones. **Archivos previstos:** `apps/api/prisma/schema.prisma`, `apps/api/prisma/migrations/<fecha>_valoraciones/migration.sql`, `apps/api/prisma/rollback/valoraciones.sql`, `apps/api/test/valoraciones-persistencia.e2e-spec.ts`. **Tamaño:** M, 4 archivos.

**Evidencia 24-09-2026 (Claude):** migración aditiva `20260924120000_valoraciones` (plantillas, visitas, borradores, publicaciones, operaciones, próxima revisión y lecturas de avisos) con `CHECK` de coherencia; un solo borrador abierto por visita mediante `valoracionAbiertaId` única (sin índice parcial que Prisma vería como deriva); cada publicación se sustituye como mucho una vez y una visita cumple como mucho una pauta. Reversión `rollback/valoraciones.sql` transaccional. Ensayo en `alpha_omega_e2e_codex` (nombre comprobado antes de cada paso): deploy → rollback → deploy, 7 tablas creadas/eliminadas/recreadas; con una medida sintética previa, la reversión la conservó; filas sintéticas eliminadas después. `npx prisma validate` y `generate` correctos. `valoraciones-persistencia.e2e-spec.ts` + `seguimiento.e2e-spec.ts`: 2 suites / 12 pruebas. Para limpiar fixtures con referencias RESTRICT se añadió `test/valoraciones-ayuda.ts`, llamado desde `entrenamiento-ayuda.ts` (una línea en el ayudante compartido).

### V03 · Guardar y recuperar borradores profesionales

**Descripción:** implementar plantilla y creación/lectura/actualización de valoración bajo el seguimiento existente, con autorización aplicada antes de acceder a los documentos.

**Criterios:**

- [x] El entrenador autorizado guarda y relee una valoración parcial con snapshot de plantilla; el cliente no escribe resultados profesionales ni obtiene un borrador, notas internas o datos ajenos.
- [x] Crear dos veces con la misma operación devuelve la misma visita; contenido distinto o `revision` obsoleta produce conflicto sin perder la versión guardada.
- [x] El listado se pagina y las rutas históricas de seguimiento conservan sus permisos y formatos.

**Verificación:** `npm run test:e2e --workspace apps/api -- --runTestsByPath test/valoraciones.e2e-spec.ts test/seguimiento.e2e-spec.ts`; incluir cliente propio/ajeno, entrenador, nutricionista asignado/no asignado y acceso directo por ID.

**Dependencias:** V02. **Responsable:** Claude principal. **Archivos previstos:** `apps/api/src/seguimiento/valoraciones.controller.ts`, `valoraciones.service.ts`, `plantillas-valoracion.service.ts`, `seguimiento.module.ts` en el mismo directorio; `apps/api/test/valoraciones.e2e-spec.ts`. **Tamaño:** M, 5 archivos.

**Evidencia 24-09-2026 (Claude):** rutas `GET/PUT plantilla-valoracion` (solo entrenador; versión obligatoria al cambiar cómo se mide; no se quitan definiciones), `POST/GET valoraciones`, `GET/PUT valoraciones/:id`. Crear copia la plantilla activa de los bloques elegidos con resultados `pendiente`; mismo `operacionId` devuelve la misma visita y con otro contenido `409 operacion_incompatible` (también en carrera, por la clave única); `PUT` exige `borradorId` y `revision` (`409 estado_incompatible`/`revision_obsoleta` sin perder lo guardado). Cliente y nutricionista reciben solo lo publicado (404 en visitas sin publicar; historial publicado sin estado); nutricionista no asignado y cliente ajeno, 403. `POST` de corrección y `cumplePauta` responden `409 estado_incompatible` hasta V05/V07a. `npm run test:e2e --workspace apps/api -- --runTestsByPath test/valoraciones.e2e-spec.ts test/valoraciones-persistencia.e2e-spec.ts test/seguimiento.e2e-spec.ts` sobre `alpha_omega_e2e_codex`: 3 suites / 19 pruebas.

**Punto de control V-A · V01–V03:** [x] contratos, migración aislada y API pasan; [x] una visita parcial se relee sin duplicados; [x] el cliente no puede obtener su borrador profesional ni datos de otro cliente. Evidencia en V01–V03; `npm run typecheck` y `git diff --check` correctos.

### V04 · Completar la primera valoración básica

**Descripción:** conectar en la ficha profesional un editor por bloques y el cliente HTTP de las operaciones definidas, empezando por fecha, peso y altura.

**Criterios:**

- [x] Desde Progreso de la ficha se crea/continúa una valoración, se guardan fecha y medidas básicas, y tras volver se recupera exactamente lo confirmado.
- [x] Guardando bloquea dobles envíos; el error conserva el formulario y el conflicto ofrece recargar o recuperar la edición sin sustituir silenciosamente datos del servidor.
- [x] Los bloques todavía no implementados no aparentan estar terminados; solo las operaciones con backend disponible aparecen como acciones del editor.

**Verificación:** `npm test --workspace apps/mobile -- --runInBand editor-valoracion.spec.tsx`; cubrir petición HTTP, guardado demorado, fallo, reintento, lectura posterior y conflicto; recorrido profesional crear → guardar → salir → continuar.

**Dependencias:** V03. **Responsable:** Claude principal. **Archivos previstos:** `apps/mobile/src/seguimiento/valoraciones-api.ts`, `use-valoraciones.ts`, `editor-valoracion.tsx`, `editor-valoracion.spec.tsx` en el mismo directorio; `apps/mobile/src/entrenamiento-entrenador/ficha/ficha-cliente.tsx`. **Tamaño:** M, 5 archivos.

**Evidencia 24-09-2026 (Claude):** `valoraciones-api.ts`/`use-valoraciones.ts` (cliente HTTP profesional), `editor-valoracion.tsx` (historial, «Nueva valoración»/«Nueva revisión»/«Continuar valoración», bloque Medidas con coma decimal y «No realizado», estados Guardado/Cambios sin guardar/Guardando…/No se pudo guardar, conflicto con «Cargar versión guardada» o «Conservar mi edición») y pestaña Progreso de la ficha. Si la plantilla no tiene medidas, el entrenador añade explícitamente «peso y altura» (sin protocolo inventado). Solo aparece el bloque con API disponible: nada de pliegues, bioimpedancia, pruebas, fotos ni publicar todavía. Cableado mínimo fuera de los 5 archivos: la ruta `app/entrenador/cliente/[id]/index.tsx` pasa `useValoraciones()` y `ficha-cliente.spec.tsx` recibe la prop. `npm test --workspace apps/mobile -- --runInBand editor-valoracion.spec.tsx ficha-cliente.spec.tsx`: 2 suites / 8 pruebas (creación, guardado, pendiente frente a cero, fuera de rango, guardado lento sin doble envío, fallo y reintento, volver y continuar, conflicto en sus dos salidas). **Pendiente:** recorrido profesional crear → guardar → salir → continuar en navegador autenticado (C00).

### M01 · Configurar la plantilla corporal

**Descripción:** permitir al entrenador seleccionar y ordenar magnitudes corporales, perímetros y puntos de pliegues, sin imponer una lista que David no haya confirmado.

**Criterios:**

- [x] Cada definición tiene ID, nombre, bloque, unidad, zona/lateralidad cuando proceda y estado activo; el profesional puede guardar y reabrir la plantilla.
- [x] Cambiar una etiqueta conserva la identidad; cambiar método/unidad/protocolo crea versión distinta, y desactivar un campo no cambia valoraciones existentes.
- [x] Peso/altura/perímetros se registran con su unidad e instrumento; no se copian resultados anteriores al crear otra visita.

**Verificación:** `npm test --workspace apps/mobile -- --runInBand plantilla-valoracion.spec.tsx editor-valoracion.spec.tsx`; comprobar renombrado, desactivación, coma decimal y copia de definiciones entre visitas.

**Dependencias:** V04. **Responsable:** Claude principal. **Archivos previstos:** `apps/mobile/src/seguimiento/plantilla-valoracion.tsx`, `plantilla-valoracion.spec.tsx`, `editor-valoracion.tsx`, `valoraciones-api.ts` en el mismo directorio. **Tamaño:** M, 4 archivos.

**Evidencia 24-09-2026 (Claude):** `plantilla-valoracion.tsx` (construido por un subagente con archivos exclusivos y dos rondas de revisión escéptica): añadir, ordenar, renombrar (conserva versión) y desactivar; cambiar cómo se mide sube la versión con aviso visible; lo guardado no se borra; cinco pruebas estándar más personalizada; guardado con revisión y conflicto recuperable. Se abre desde «Plantilla» en Valoraciones de la ficha. `plantilla-valoracion.spec.tsx`: 15 pruebas. Deuda anotada: el archivo mide unas 1.100 líneas (subcomponentes en el mismo archivo); conviene dividirlo. **Pendiente:** comprobación visual con datos sintéticos (C00).

**Punto de control V-B · V04–M01:** [x] crear → medir → guardar → continuar funciona desde la ficha (pruebas de componente y HTTP); [x] cambiar la plantilla no cambia el documento de una visita anterior (e2e V03); [ ] visual profesional comprobado con datos sintéticos (pendiente de C00).

### M02 · Registrar pliegues con sus lecturas

**Descripción:** integrar el bloque de plicómetro con los puntos configurados, lecturas repetidas opcionales y valor adoptado explícito.

**Criterios:**

- [x] Cada punto conserva unidad mm, lateralidad/protocolo, lecturas originales y valor adoptado; ausencia y no realizado siguen siendo estados distintos.
- [x] Guardar/reabrir no pierde lecturas; se admite un porcentaje ya calculado por el profesional con método/fecha y origen diferenciados, sin inventar lecturas ni calcular grasa con una fórmula implícita.

**Verificación:** `npm test --workspace apps/mobile -- --runInBand pliegues-valoracion.spec.tsx editor-valoracion.spec.tsx`; probar lecturas múltiples, dato parcial, decimal y relectura del documento guardado.

**Dependencias:** M01. **Responsable:** Claude principal. **Archivos previstos:** `apps/mobile/src/seguimiento/pliegues-valoracion.tsx`, `pliegues-valoracion.spec.tsx`, `editor-valoracion.tsx` en el mismo directorio. **Tamaño:** M, 3 archivos.

**Evidencia 24-09-2026 (Claude):** `pliegues-valoracion.tsx` (subagente + revisión aprobada): hasta 5 lecturas por punto, «Adoptar esta lectura» copia una lectura exacta y el valor adoptado es explícito, sin medias; no realizado con motivo; porcentaje por pliegues con método y fecha, rotulado como calculado por el profesional. El contrato admite lecturas con el valor aún pendiente. Integrado en `borrador-valoracion.tsx` con el modelo común `valoracion-modelo.ts`.

### M03 · Registrar bioimpedancia manual

**Descripción:** incorporar campos habilitados para la báscula con instrumento y unidad explícitos, manteniendo separados sus resultados de los obtenidos por otros métodos.

**Criterios:**

- [x] Se registran solo campos configurados y su instrumento/modelo; kg, porcentajes e índices del fabricante se validan como magnitudes distintas.
- [x] Peso de báscula, peso doméstico, grasa por bioimpedancia y cualquier histórico de otro origen no se sobrescriben ni promedian; masa muscular y masa libre de grasa no se renombran como equivalentes.

**Verificación:** `npm test --workspace apps/mobile -- --runInBand bioimpedancia-valoracion.spec.tsx editor-valoracion.spec.tsx`; reabrir dos visitas con instrumentos distintos y campos opcionales ausentes.

**Dependencias:** M01. **Responsable:** Claude principal. **Archivos previstos:** `apps/mobile/src/seguimiento/bioimpedancia-valoracion.tsx`, `bioimpedancia-valoracion.spec.tsx`, `editor-valoracion.tsx` en el mismo directorio. **Tamaño:** M, 3 archivos.

**Evidencia 24-09-2026 (Claude):** `bioimpedancia-valoracion.tsx` (subagente + revisión aprobada): agrupado por báscula, unidades explícitas («índice del fabricante» aparte de kg y %), masa muscular y masa libre de grasa separadas, peso de báscula distinto del de Medidas. Integrado en el borrador. Pruebas de pliegues, bioimpedancia y pruebas: 28 en total.

### P01 · Definir las cinco pruebas y su comparabilidad

**Descripción:** fijar las definiciones reutilizables de las cinco pruebas indicadas por David y su información de contexto.

**Criterios:**

- [x] Dominadas/suspensión son variantes diferentes; flexiones y sentadillas guardan 60 s; banca registra 1RM medido; Cooper guarda distancia, duración e instrumento, más FC disponible y tiempo de recuperación cuando exista.
- [x] Cambiar variante/protocolo/unidad produce una serie distinta; 1RM medido no se mezcla con fuerza estimada ni flexiones de un minuto con «flexiones seguidas» del histórico.
- [x] No se inventa sexta prueba ni baremos, fórmulas de VO₂máx o instrucciones de esfuerzos máximos; el entrenador puede definir otra prueba con contrato validado.

**Verificación:** `npm run build:shared`; `npm test --workspace apps/api -- --runInBand valoraciones-contratos.spec.ts`; casos de cada prueba, variante, resultado cero, ausencia de FC y protocolo no completado.

**Dependencias:** V01; ejecutar tras M02/M03 para el orden de entrega. **Responsable:** Claude principal, dueño de contratos. **Archivos previstos:** `packages/shared/src/pruebas-valoracion.ts`, `packages/shared/src/valoraciones.ts`, `packages/shared/src/index.ts`, `apps/api/src/seguimiento/valoraciones-contratos.spec.ts`. **Tamaño:** M, 4 archivos.

**Evidencia 24-09-2026 (Claude):** `pruebas-valoracion.ts`: las cinco pruebas de David (dominadas y aguante en barra como variantes distintas, flexiones y sentadillas de 60 s, 1RM medido, Cooper con distancia, duración, banda pectoral y FC opcional con su tiempo de recuperación), reglas por tipo y validación de resultados (enteros, límites) sin baremos ni fórmulas; personalizada libre. `valoraciones-contratos.spec.ts`: 23 pruebas.

**Punto de control M-P · M02–P01:** [x] medidas/pliegues/bioimpedancia conservan fuente y lecturas; [x] las cinco definiciones son válidas y sus variantes no se confunden; [x] no se inventan puntos antropométricos a partir de los PDF.

### P02 · Completar las pruebas en una visita

**Descripción:** integrar el formulario de resultados profesionales con campos adaptados a cada prueba y referencias anteriores solo de lectura.

**Criterios:**

- [x] El entrenador registra las cinco pruebas, o marca cualquiera no realizada con motivo opcional; unidades y protocolo aparecen junto al resultado y se conservan tras guardar.
- [x] Los campos opcionales de FC no son obligatorios para guardar Cooper; la referencia anterior muestra su fecha y no rellena el resultado nuevo.

**Verificación:** `npm test --workspace apps/mobile -- --runInBand pruebas-valoracion.spec.tsx editor-valoracion.spec.tsx`; recorrido con dominadas y suspensión en fechas distintas, prueba incompleta y Cooper sin FC de recuperación.

**Dependencias:** P01 y V04. **Responsable:** Claude principal. **Archivos previstos:** `apps/mobile/src/seguimiento/pruebas-valoracion.tsx`, `pruebas-valoracion.spec.tsx`, `editor-valoracion.tsx` en el mismo directorio. **Tamaño:** M, 3 archivos.

**Evidencia 24-09-2026 (Claude):** `pruebas-valoracion.tsx` (subagente + revisión aprobada): estado explícito Pendiente/Registrar/No realizada, métricas con unidad, FC opcional, fecha si fue otro día, notas visibles al publicar y referencia anterior fechada de solo lectura (solo misma definición y versión). Tras la revisión, «Protocolo completo» ya no viene marcado: se exige elegir. **Pendiente:** recorrido autenticado (C00).

### V05 · Publicar y corregir una valoración

**Descripción:** completar desde el resumen profesional la publicación confirmada y la creación/publicación de una corrección vinculada a la versión que sustituye.

**Criterios:**

- [x] Una publicación parcial contiene solo datos y conclusión visibles permitidos, con autor/fecha; notas internas y borradores quedan excluidos también de respuestas por ID.
- [x] Reintentar tras respuesta perdida devuelve la misma publicación; revisión obsoleta o contenido distinto con la misma operación da conflicto sin doble publicación.
- [x] Corregir conserva el original inmutable y la relación de sustitución; no crea otra visita ni un punto adicional de evolución para la misma medición.

**Verificación:** `npm run test:e2e --workspace apps/api -- --runTestsByPath test/valoraciones.e2e-spec.ts`; `npm test --workspace apps/mobile -- --runInBand editor-valoracion.spec.tsx`; probar publicación simultánea, respuesta perdida y corrección consultada por cliente.

**Dependencias:** P02, M02, M03 y V03. **Responsable:** Claude principal. **Archivos previstos:** `apps/api/src/seguimiento/valoraciones.controller.ts`, `valoraciones.service.ts` en el mismo directorio; `apps/api/test/valoraciones.e2e-spec.ts`; `apps/mobile/src/seguimiento/editor-valoracion.tsx`, `editor-valoracion.spec.tsx` en el mismo directorio. **Tamaño:** M, 5 archivos; subdividir API/UI si excede una sesión enfocada.

**Evidencia 24-09-2026 (Claude):** API: `POST valoraciones/:id/publicaciones` congela la proyección pública e idempotente por operación; corrección con `corrigePublicacionId` sobre la misma visita desde el documento interno vigente, con revisión que continúa la publicada; carreras de publicación resueltas por claves únicas. `valoraciones.e2e-spec.ts` (bloque V05): publicación parcial por rol, reintento, conflictos, carrera (201 + 409) y corrección sin duplicar visita ni punto. UI: `borrador-valoracion.tsx` publica solo lo guardado, con la misma operación en cada reintento, y `editor-valoracion.tsx` ofrece «Corregir» en visitas publicadas. `editor-valoracion.spec.tsx`: 11 pruebas. **Pendiente:** comprobación visual autenticada.

**Punto de control P-V · P02–V05:** [x] entrenador completa → guarda → publica → corrige sin duplicar; [x] cliente solo puede leer publicaciones autorizadas; [x] estados Guardado/Publicado se comprueban con fallo de red (prueba de componente con ErrorDeRed).

### V06 · Mostrar la valoración al cliente

**Descripción:** añadir en Progreso la última valoración publicada, resumen, cambios destacados por el entrenador e historial consultable, manteniendo registros actuales.

**Criterios:**

- [x] El cliente ve fecha de toma, conclusión/autor, datos disponibles y publicación corregida identificable; abrir el detalle no expone controles profesionales ni notas internas.
- [x] Progreso conserva indicadores cotidianos y ofrece detalle/historial con destino funcional; «Ver mi evolución» se incorpora en E01b al conectar la comparación, sin un botón vacío entre incrementos. Vacío/carga/error/parcial no convierten ausencias en ceros.

**Verificación:** `npm test --workspace apps/mobile -- --runInBand resumen-valoracion.spec.tsx pantallas.spec.tsx`; comprobar primera visita, historial paginado, publicación corregida y cliente sin valoraciones a 360/390 px.

**Dependencias:** V05. **Responsable:** Claude principal. **Archivos previstos:** `apps/mobile/src/seguimiento/resumen-valoracion.tsx`, `resumen-valoracion.spec.tsx`, `progreso.tsx`, `valoraciones-api.ts` en el mismo directorio. **Tamaño:** M, 4 archivos.

**Evidencia 24-09-2026 (Claude):** `resumen-valoracion.tsx` (subagente): última valoración con autor, fecha, conclusión, destacados con unidad y «Corregida»; próxima revisión; historial paginado y detalle por bloque sin controles profesionales ni ceros; montado en Progreso del cliente (`progreso.tsx` y `app/progreso.tsx`). 12 pruebas; `pantallas.spec.tsx` sigue en verde. «Ver mi evolución» queda para E01b. **Pendiente:** 360/390 px autenticado.

### V07 · Programar y repetir una revisión

**Descripción:** permitir fecha/intervalo o «Sin programar» y generar una revisión vinculada con los bloques seleccionados, sin copiar resultados. Se divide API y UI para incluir su presentación al cliente.

#### V07a · Pauta y repetición en API

**Descripción:** persistir la pauta y crear la revisión vinculada bajo los permisos profesionales existentes.

**Criterios:**

- [x] La pauta conserva fecha/intervalo y bloques; puede quitarse y la actualización simultánea usa revisión para evitar sobrescritura.
- [x] La visita nueva reutiliza definiciones y protocolos con resultados vacíos; los valores anteriores solo sirven de referencia con fecha.
- [x] Una solicitud se completa únicamente al confirmar la acción definida en el contrato y vincular la revisión; abrirla o reintentar no la completa/duplica.

**Verificación:** `npm run test:e2e --workspace apps/api -- --runTestsByPath test/valoraciones.e2e-spec.ts`; cubrir quitar pauta, conflicto, repetición y reintento de completar solicitud.

**Dependencias:** V05. **Responsable:** Claude principal. **Archivos previstos:** `apps/api/src/seguimiento/valoraciones.controller.ts`, `valoraciones.service.ts` en el mismo directorio; `apps/api/test/valoraciones.e2e-spec.ts`. **Tamaño:** M, 3 archivos.

**Evidencia 24-09-2026 (Claude):** `GET/PUT proxima-revision` (cliente lee, entrenador guarda con revisión o deja «Sin programar»); crear una revisión con `cumplePauta` marca `cumplidaPorId` en la misma transacción, reintentar no duplica y una segunda revisión no vuelve a cumplirla; guardar pauta nueva la deja pendiente. `valoraciones.e2e-spec.ts` + persistencia: 18 pruebas.

#### V07b · Pautar y consultar la siguiente revisión

**Descripción:** conectar la programación profesional, repetición de visita y próxima pauta visible para el cliente.

**Criterios:**

- [x] El entrenador programa/cancela la pauta y abre una revisión con bloques seleccionados y resultados vacíos; anterior y actual se distinguen por fecha.
- [x] El cliente consulta próxima fecha/intervalo o «Sin programar» sin controles profesionales; se muestra el valor confirmado, no una edición fallida.

**Verificación:** `npm test --workspace apps/mobile -- --runInBand editor-valoracion.spec.tsx resumen-valoracion.spec.tsx`; inicial → programar → revisión parcial → publicar → consultar próxima pauta.

**Dependencias:** V07a y V06. **Responsable:** Claude principal. **Archivos previstos:** `apps/mobile/src/seguimiento/editor-valoracion.tsx`, `editor-valoracion.spec.tsx`, `resumen-valoracion.tsx`, `resumen-valoracion.spec.tsx`, `valoraciones-api.ts` en el mismo directorio. **Tamaño:** M, 5 archivos.

**Evidencia 24-09-2026 (Claude):** `pauta-revision.tsx` (programar por fecha o intervalo con bloques, o dejar sin programar, mostrando solo lo confirmado) y en `editor-valoracion.tsx` «Hacer la revisión pautada» con `cumplePauta` y bloques disponibles; el cliente ve la pauta en su resumen. Cubierto en `editor-valoracion.spec.tsx` y `resumen-valoracion.spec.tsx`.

**Punto de control V-C · V06, V07a–V07b:** [x] inicial y revisión se distinguen en cliente; [x] nueva revisión no hereda resultados; [x] próxima pauta y estado de realización son coherentes entre roles.

### F01 · Contratos y persistencia de medios privados

**Descripción:** preparar fotografías privadas y sus vínculos. Se ejecuta en las dos subtareas siguientes para no superar cinco archivos.

#### F01a · Contrato de fotografías

**Descripción:** definir solicitudes, operaciones y proyecciones de lectura con formatos y límites explícitos.

**Criterios:**

- [x] El contrato identifica dueño, autor, vista/fecha, origen, estado, vínculo y operación; define formatos, límites y errores de selección/subida/confirmación/acceso/eliminación.
- [x] La clave de objeto y los enlaces temporales no son identificadores editables de la foto; una solicitud propia puede recibir una foto antes de existir valoración.

**Verificación:** `npm run build:shared`; `npm test --workspace apps/api -- --runInBand medios-contratos.spec.ts`; cubrir formato/tamaño inválidos, estados incompatibles, operaciones repetidas y DTO público sin claves internas.

**Dependencias:** V01 y V07. **Responsable:** Claude principal, dueño de contratos. **Archivos previstos:** `packages/shared/src/medios.ts`, `packages/shared/src/index.ts`, `apps/api/src/medios/medios-contratos.spec.ts`. **Tamaño:** M, 3 archivos.

**Evidencia 24-09-2026 (Claude):** `medios.ts`: JPEG/PNG/WebP hasta 8 MB, vistas comparables, estados pendiente/disponible/eliminando/eliminado, origen profesional o cliente, destino visita o solicitud, DTO sin clave ni enlaces, solicitudes con recibida frente a revisada. `medios-contratos.spec.ts`: 5 pruebas.

#### F01b · Persistencia de fotografías y solicitudes

**Descripción:** guardar objetos y relaciones de forma aditiva sin convertir enlaces caducables en datos permanentes.

**Criterios:**

- [x] Migración aditiva guarda medios, intenciones, solicitudes, vínculos y estado de eliminación con claves/índices por propietario; nunca guarda una URL firmada como localización permanente.
- [x] Una intención repetida no duplica medio; incorporar una aportación a valoración reutiliza el objeto y no altera quién lo aportó.

**Verificación:** `npx prisma validate`; `npx prisma generate`; ensayo migración/reversión/reaplicación aislado; `npm run test:e2e --workspace apps/api -- --runTestsByPath test/medios-persistencia.e2e-spec.ts`.

**Dependencias:** F01a y V02. **Responsable:** Claude principal, dueño de migraciones. **Archivos previstos:** `apps/api/prisma/schema.prisma`, `apps/api/prisma/migrations/<fecha>_medios_privados/migration.sql`, `apps/api/prisma/rollback/medios_privados.sql`, `apps/api/test/medios-persistencia.e2e-spec.ts`. **Tamaño:** M, 4 archivos.

**Evidencia 24-09-2026 (Claude):** migración `20260924130000_medios_privados` con CHECK de formato, tamaño, etiqueta, origen y estados; solo la clave del objeto, nunca una URL. Ensayo deploy → rollback (con una solicitud sintética y la plantilla ajena conservada) → deploy en `alpha_omega_e2e_codex`. `medios-persistencia.e2e-spec.ts`: 4 pruebas.

**Punto de control F-A · F01a–F01b:** [x] permisos/estados definidos y migración aislada validada; [x] relaciones permiten aportación previa a la valoración sin duplicar objetos.

### F02 · Subida, confirmación y acceso autorizados

**Descripción:** implementar el flujo de objetos privados compatible con S3 usando almacenamiento local de prueba. Se divide infraestructura y API.

#### F02a · Adaptador local de objetos

**Descripción:** configurar almacenamiento local compatible con S3 y un adaptador reemplazable por configuración.

**Criterios:**

- [x] El entorno local permite cargar, verificar, leer temporalmente y eliminar un objeto privado; no publica el bucket ni necesita contratar un proveedor.
- [x] Configuración usa variables documentadas sin secretos, claves aleatorias y caducidad acotada; las dependencias seleccionadas son compatibles con los runtimes del repo y se justifican brevemente.

**Verificación:** levantar únicamente el servicio local de objetos; comprobar objeto sintético sin acceso público, firma válida y firma caducada; `npm run build --workspace apps/api`. Los casos automáticos de integración se incorporan en F02b.

**Dependencias:** F01b. **Responsable:** Claude principal, dueño de dependencias/configuración. **Archivos previstos:** `docker-compose.yml`, `.env.example`, `apps/api/package.json`, `package-lock.json`, `apps/api/src/medios/almacen-objetos.ts`. **Tamaño:** M, 5 archivos.

**Evidencia 24-09-2026 (Claude):** **Desviación consciente:** no se descargó MinIO ni el SDK de S3 (descargar requiere autorización de David). `almacen-objetos.ts` define la interfaz del almacén y `AlmacenLocal`, con el mismo contrato que un S3 con URLs prefirmadas: enlaces HMAC con caducidad (15 min subida, 5 lectura), objetos en `.almacen-local/` ignorado por git, variables opcionales `ALMACEN_LOCAL_DIR`, `API_URL_PUBLICA` y `ALMACEN_LOCAL_SECRETO` (aleatorio por arranque si falta). El adaptador S3 de producción queda pendiente de elegir proveedor.

#### F02b · API privada de medios

**Descripción:** exponer intención, confirmación y lectura temporal con validación del objeto y autorización por contexto.

**Criterios:**

- [x] Intención, confirmación y lectura temporal comprueban rol, cliente, vínculo y estado; objeto ajeno/pendiente o subida manipulada se rechazan antes de vincular o firmar acceso.
- [x] Confirmación verifica existencia, contenido/formato y tamaño reales; la imagen servida y miniaturas no conservan localización y se mantienen privadas.
- [x] Mismo reintento confirma una sola foto; expiración o fallo se informa como recuperable sin registrar éxito ni filtrar claves/enlaces en logs.

**Verificación:** `npm run test:e2e --workspace apps/api -- --runTestsByPath test/medios.e2e-spec.ts`; probar acceso directo por ID, propietario distinto, nutricionista según contrato, objeto ausente, MIME falseado, tamaño excesivo, firma caducada y respuesta perdida contra almacén local.

**Dependencias:** F02a. **Responsable:** Claude principal. **Archivos previstos:** `apps/api/src/medios/medios.controller.ts`, `medios.service.ts`, `medios.module.ts` en el mismo directorio; `apps/api/src/app.module.ts`; `apps/api/test/medios.e2e-spec.ts`. **Tamaño:** M, 5 archivos; extraer y subdividir verificación de imágenes si excede la sesión.

**Evidencia 24-09-2026 (Claude):** rutas `/medios/subidas`, `/medios/:id/confirmacion`, `/medios/:id/acceso` y el almacén local firmado. La confirmación exige objeto presente, formato real por firma de bytes y tamaño anunciado, y retira metadatos por LISTA BLANCA (`imagenes.ts`, subagente, 46 pruebas: Exif/GPS, XMP, C2PA, comentarios, tIME…). Sin miniaturas (no se decodifican imágenes). `medios.e2e-spec.ts`: 3 pruebas (roles, reintento, firma ajena o caducada, 413, formato falseado).

#### F02c · Vincular fotos profesionales a una valoración

**Descripción:** completar las rutas mínimas de listado/vínculo en valoración antes de conectar la subida profesional de F03.

**Criterios:**

- [x] Entrenador autorizado vincula solo medios propios del cliente, confirmados y no eliminados; un reintento devuelve el mismo vínculo.
- [x] Cliente solo obtiene fotos de publicaciones propias; listado/vínculo por ID rechaza medios ajenos o pendientes y mantiene el borrador privado.

**Verificación:** `npm run test:e2e --workspace apps/api -- --runTestsByPath test/valoraciones-fotos.e2e-spec.ts test/medios.e2e-spec.ts`; adjuntar → publicar → consultar cliente y pruebas negativas por ID.

**Dependencias:** F02b y V05. **Responsable:** Claude principal. **Archivos previstos:** `apps/api/src/seguimiento/valoraciones.controller.ts`, `valoraciones.service.ts`, `seguimiento.module.ts` en el mismo directorio; `apps/api/src/medios/medios.module.ts`; `apps/api/test/valoraciones-fotos.e2e-spec.ts`. **Tamaño:** M, 5 archivos.

**Evidencia 24-09-2026 (Claude):** `POST/GET valoraciones/:id/fotos`; publicar marca `publicadaEn` de las fotos de la visita; el cliente solo ve fotos publicadas; nutricionista 403; aportación del cliente incorporada sin nueva subida ni cambio de autor. `valoraciones-fotos.e2e-spec.ts`: 3 pruebas.

**Punto de control F-B · F02a–F02c:** [x] ninguna foto/miniatura es pública; [x] objeto ausente/ajeno no se confirma/vincula; [x] adjuntar/publicar/consultar funciona en API con imágenes sintéticas sin proveedor de producción.

### F03 · Aportar fotografías desde la app

**Descripción:** integrar selección/preparación y subida visible sin almacenar fotografías corporales como contenido sin conexión.

#### F03a · Seleccionar y preparar una imagen

**Descripción:** preparar una imagen utilizable desde web/móvil conservando orientación y retirando localización.

**Criterios:**

- [ ] Selección respeta permisos/cancelación; orientación, reducción de tamaño y retirada de localización producen un formato admitido por F01a.
- [ ] Un formato no soportado se informa sin fingir conversión y el archivo temporal se libera al cancelar/finalizar; una foto ajena no se incluye en fixtures.

**Verificación:** `npm test --workspace apps/mobile -- --runInBand preparar-foto.spec.ts`; probar imagen sintética girada, metadatos de ubicación sintéticos, selección cancelada y tamaño final; comprobar selección real en los entornos web/móvil soportados.

**Evidencia provisional 24-09-2026 (Codex):** `preparar-foto.ts` y sus pruebas se integraron al envío de solicitudes del cliente. El formato, reducción, cancelación y permisos tienen pruebas sintéticas. La selección real en web y móvil sigue pendiente.

**Dependencias:** F01a. **Responsable:** Claude principal, dueño de dependencias. **Archivos previstos:** `apps/mobile/package.json`, `package-lock.json`, `apps/mobile/src/seguimiento/preparar-foto.ts`, `preparar-foto.spec.ts` en el mismo directorio. **Tamaño:** M, 4 archivos.

#### F03b · Mostrar y recuperar el proceso de subida

**Descripción:** conectar al editor el envío directo y confirmación con estados recuperables.

**Criterios:**

- [ ] El entrenador adjunta una foto a su borrador y ve seleccionada/subiendo/confirmando/disponible/error; solo medios confirmados pueden asociarse.
- [ ] Fallo, respuesta perdida y doble pulsación reutilizan la operación adecuada sin duplicar; cancelar no publica ni deja una foto aparente.
- [ ] No se persisten URLs firmadas ni imágenes para modo sin conexión y una foto en borrador sigue privada hasta publicación.

**Verificación:** `npm test --workspace apps/mobile -- --runInBand subida-fotos.spec.tsx editor-valoracion.spec.tsx`; simular interrupción de red en subida/confirmación, expiración y reintento; recorrido local adjuntar → guardar → publicar → consultar.

**Evidencia provisional 24-09-2026 (Codex):** el envío desde una solicitud del cliente pide intención, sube con el enlace temporal y confirma; una prueba cubre el reintento con el mismo UUID y archivo en memoria. **Falta:** adjuntar fotos profesionales al borrador de valoración, estados del editor y recorrido guardar/publicar.

**Dependencias:** F02c y F03a. **Responsable:** Claude principal. **Archivos previstos:** `apps/mobile/src/seguimiento/medios-api.ts`, `subida-fotos.tsx`, `subida-fotos.spec.tsx`, `editor-valoracion.tsx` en el mismo directorio. **Tamaño:** M, 4 archivos.

**Punto de control F-C · F03a–F03b:** [ ] una subida interrumpida se recupera sin duplicado; [ ] solo disponible significa confirmada; [ ] una foto profesional no publicada no aparece en cliente.

### F04 · Solicitar y recibir fotos del cliente

**Descripción:** permitir aportaciones solicitadas por el entrenador, identificando autor y recepción sin considerarlas revisadas automáticamente.

#### F04a · Solicitudes y vínculos en API

**Descripción:** crear solicitudes y recibir/vincular medios propios sin exigir una visita previa.

**Criterios:**

- [x] Entrenador crea solicitudes con vistas/fecha o intervalo; solo el cliente destinatario aporta, incluso si todavía no existe valoración, y reintentar no duplica solicitud ni vínculo.
- [x] Incorporar la aportación a una valoración conserva medio, autor/origen y permisos; «recibida» y «revisada» son estados separados mediante acción profesional explícita.
- [x] Aportar a la solicitud reutiliza las comprobaciones de F02c y valida todos los IDs; no acepta medios pendientes, ajenos o eliminados.

**Verificación:** `npm run test:e2e --workspace apps/api -- --runTestsByPath test/solicitudes-fotos.e2e-spec.ts test/medios.e2e-spec.ts`; probar solicitud sin visita, vista opcional, reintento, enlace ajeno y recepción sin revisión.

**Dependencias:** F02c y V07b. **Responsable:** Claude principal. **Archivos previstos:** `apps/api/src/seguimiento/solicitudes-fotos.controller.ts`, `solicitudes-fotos.service.ts`, `seguimiento.module.ts` en el mismo directorio; `apps/api/test/solicitudes-fotos.e2e-spec.ts`. **Tamaño:** M, 4 archivos.

**Evidencia 24-09-2026 (Claude):** `POST/GET solicitudes-fotos` y `POST solicitudes-fotos/:id/revision`; la confirmación de una aportación marca la solicitud «recibida»; revisar es explícito e idempotente. `solicitudes-fotos.e2e-spec.ts`: 3 pruebas.

#### F04b · Aportar y revisar desde las pantallas

**Descripción:** conectar el encargo del entrenador y la aportación del cliente con sus estados reales.

**Criterios:**

- [ ] Cliente encuentra su solicitud y aporta las vistas elegidas mediante F03; solo ve acciones correspondientes a su propio encargo y estado.
- [ ] Entrenador puede solicitar, recibir, revisar e incorporar fotos sin volver a subirlas; ambas pantallas muestran fecha, autor y estado correcto.

**Verificación:** `npm test --workspace apps/mobile -- --runInBand solicitudes-fotos.spec.tsx subida-fotos.spec.tsx`; recorrido entrenador solicita → cliente aporta → entrenador revisa/incorpora → cliente consulta.

**Dependencias:** F04a, F03b y V06. **Responsable:** Claude principal. **Archivos previstos:** `apps/mobile/src/seguimiento/solicitudes-fotos.tsx`, `solicitudes-fotos.spec.tsx`, `medios-api.ts`, `progreso.tsx`, `editor-valoracion.tsx` en el mismo directorio. **Tamaño:** M, 5 archivos.

**Evidencia provisional 24-09-2026 (Codex):** el cliente aporta desde cámara o galería las vistas pedidas, reintenta sin volver a elegir la foto y puede completar las vistas pendientes aunque una primera ya conste como recibida. El entrenador conserva recepción, revisión e incorporación. Pruebas focales pasan; falta recorrer ambos roles en la app autenticada.

**Punto de control F-D · F04a–F04b:** [ ] aportación solicitada funciona antes/después de una valoración; [ ] el mismo objeto se incorpora sin duplicar; [ ] recibir y revisar se distinguen en ambos roles.

### F05 · Comparar y retirar fotografías

**Descripción:** completar el historial visual y el ciclo de eliminación/limpieza, con subtareas separadas para API y presentación.

#### F05a · Eliminar y limpiar sin perder fotos vinculadas

**Descripción:** gestionar eliminación explícita y limpieza de cargas abandonadas con reintentos verificables.

**Criterios:**

- [x] Eliminación explícita autorizada retira acceso y elimina original/miniaturas; fallo del almacén conserva estado pendiente y se puede reintentar sin devolver éxito falso. (No hay miniaturas: solo se guarda el original.)
- [x] Limpieza de intenciones caducadas omite medios vinculados; una valoración no se elimina por limpiar una subida, y su historial identifica una foto retirada sin revivirla.

**Verificación:** `npm run test:e2e --workspace apps/api -- --runTestsByPath test/medios.e2e-spec.ts`; simular fallo de borrado, reintento, medio vinculado, intención caducada y lectura de una foto eliminada.

**Dependencias:** F04a. **Responsable:** Claude principal. **Archivos previstos:** `apps/api/src/medios/medios.service.ts`, `medios.controller.ts`, `limpieza-medios.ts`, `medios.module.ts` en el mismo directorio; `apps/api/test/medios.e2e-spec.ts`. **Tamaño:** M, 5 archivos; eliminación del adaptador ya preparada en F02a.

**Evidencia 24-09-2026 (Claude, con subagente y revisión escéptica en dos rondas):** `DELETE /medios/:id` pasa a «eliminando» antes de borrar el objeto. Si el almacén falla, responde 503 y queda «eliminando» sin acceso; repetirlo la retira. `LimpiezaMedios` descarta las intenciones «pendiente» una hora después de caducar y respeta las que un reintento renueva. Una confirmación tardía que la limpieza ya podría descartar responde 409 sin quedar disponible. DELETE sobre una foto aún «pendiente» responde 409 (decisión: no se puede retirar lo que no está confirmado; la limpieza la descarta). `medios.e2e-spec.ts`: 13 pruebas, incluidos el fallo simulado del almacén, los reintentos cruzados con la limpieza y el listado por rol; suite e2e completa de la API: 41 suites y 436 pruebas.

#### F05b · Comparación por vista y fecha

**Descripción:** mostrar dos fotografías equivalentes y completar el acceso/eliminación y cierre de sesión.

**Criterios:**

- [ ] Cliente/profesional comparan dos fechas de la misma vista; una sola foto, vista ausente o foto retirada se explica sin sustituirla por otra fecha/vista.
- [ ] Eliminar exige acción explícita del rol autorizado y refleja el estado confirmado o pendiente; cerrar sesión retira imágenes y referencias controladas por la app.
- [ ] La comparación es usable a 360/390 px y con lector de pantalla; los enlaces caducados se renuevan mediante API autorizada, sin caché corporal persistente.

**Verificación:** `npm test --workspace apps/mobile -- --runInBand comparador-fotos.spec.tsx`; comprobar dos fechas, vista ausente, firma expirada, eliminación fallida y logout; inspección visual con imágenes sintéticas.

**Dependencias:** F05a y F04b. **Responsable:** Claude principal. **Archivos previstos:** `apps/mobile/src/seguimiento/comparador-fotos.tsx`, `comparador-fotos.spec.tsx`, `progreso.tsx`, `medios-api.ts` en el mismo directorio; `apps/mobile/src/sesion.tsx`. **Tamaño:** M, 5 archivos.

**Evidencia provisional 24-09-2026 (Claude y Codex):** el comparador está conectado a «Ver mi evolución» en Progreso y pasan sus pruebas focales de selección, enlaces y retirada. Falta comprobar logout, accesibilidad y tamaños 360/390 px en la app.

**Punto de control F-E · F05a–F05b:** [ ] comparación no rellena huecos; [ ] eliminación/limpieza se comprueban con fallo del almacén; [ ] logout elimina referencias visibles y la autorización se revisa al renovar acceso.

### E01 · Comparar resultados equivalentes

**Descripción:** unir consultas históricas y nuevas publicaciones sin duplicarlas y presentar cambios entre fechas comparables.

#### E01a · Consulta de evolución y legado

**Descripción:** adaptar histórico y publicaciones a una consulta común con identidad y procedencia verificables.

**Criterios:**

- [x] Devuelve publicaciones vigentes y registros previos con origen, fecha, unidad, método/protocolo y paginación/período; el legado sin clasificación se identifica y no se agrupa por mera coincidencia de fecha. (Filtro por periodo `desde`/`hasta`; sin paginación, que el contrato no pide.)
- [x] Separa variantes, unidades, instrumentos/métodos no equivalentes y medido/estimado; correcciones sustituyen el punto visible sin borrar su auditoría ni duplicar visitas.

**Verificación:** `npm run test:e2e --workspace apps/api -- --runTestsByPath test/evolucion-valoraciones.e2e-spec.ts test/seguimiento.e2e-spec.ts`; fixtures sintéticos de legado más inicial/revisión/corrección, cambios de variante y fechas coincidentes.

**Dependencias:** V07 y P01. **Responsable:** Claude principal. **Archivos previstos:** `apps/api/src/seguimiento/evolucion-valoraciones.service.ts`, `evolucion-valoraciones.controller.ts`, `seguimiento.module.ts` en el mismo directorio; `apps/api/test/evolucion-valoraciones.e2e-spec.ts`. **Tamaño:** M, 4 archivos.

**Evidencia 24-09-2026 (Claude, con subagente y revisión escéptica aprobada):** `GET seguimiento/clientes/:clienteId/evolucion`. Los formatos de clave de serie están documentados en `SerieEvolucionSchema`. Un protocolo incompleto va en serie aparte, el histórico se separa por origen y el nutricionista no recibe pruebas físicas. `evolucion-valoraciones.e2e-spec.ts`: 8 pruebas (legado, inicial, revisión y corrección; versión nueva, series distintas en la misma fecha, borrador invisible, periodo y permisos) y `seguimiento.e2e-spec.ts` sin cambios.

#### E01b · Evolución comprensible en Progreso

**Descripción:** presentar comparaciones y gráficos sin ocultar fuentes incompatibles ni estados parciales.

**Criterios:**

- [ ] «Ver mi evolución» abre inicial frente a última y selector de fechas con datos, unidades, procedencia y diferencia solo cuando son comparables; explicar incompatibilidad o ausencia sin inventar cero.
- [ ] Cambios de peso mantienen lectura neutral salvo objetivo profesional aplicable; fotografías abren el comparador existente y no se ocultan diarios o pruebas prescritas anteriores.

**Verificación:** `npm test --workspace apps/mobile -- --runInBand evolucion-valoraciones.spec.tsx pantallas.spec.tsx`; comprobar dato único, parcial, fuentes diferentes, cero real y corrección; recorrido a 360/390 px.

**Dependencias:** E01a, V06 y F05b. **Responsable:** Claude principal. **Archivos previstos:** `apps/mobile/src/seguimiento/evolucion-valoraciones.tsx`, `evolucion-valoraciones.spec.tsx`, `progreso.tsx`, `valoraciones-api.ts` en el mismo directorio. **Tamaño:** M, 4 archivos.

**Evidencia provisional 24-09-2026 (Claude y Codex):** «Ver mi evolución» abre bajo demanda el histórico en Progreso y permite ocultarlo sin quitar indicadores ni el resumen de valoraciones. Las pruebas focales de evolución y pantalla pasan; el recorrido visual autenticado a 360/390 px sigue pendiente.

**Punto de control E-A · E01a–E01b:** [ ] legado y visitas nuevas conviven sin duplicados; [ ] solo equivalentes muestran diferencia; [ ] comparaciones vacías/parciales y móvil estrecho tienen evidencia.

### E02 · Avisar de publicaciones y solicitudes

**Descripción:** incorporar novedades de valoración a Inicio con lectura por actor, sin una nueva pestaña ni mensajes externos.

#### E02a · Novedades con lectura persistida

**Descripción:** consultar novedades y guardar su lectura por actor usando las publicaciones/solicitudes como origen.

**Criterios:**

- [x] API consulta publicaciones/solicitudes autorizadas y registra lectura por usuario y novedad, idempotente; no marca una foto revisada por leer el aviso.
- [x] Reintentos no duplican avisos y un enlace identifica su destino vigente; publicaciones corregidas y solicitudes completadas mantienen un estado comprensible.

**Verificación:** `npm run test:e2e --workspace apps/api -- --runTestsByPath test/valoraciones-novedades.e2e-spec.ts`; probar dos dispositivos, otro cliente, lectura repetida y destinos corregidos/completados.

**Dependencias:** V02, V05 y F04a. **Responsable:** Claude principal. **Archivos previstos:** `apps/api/src/seguimiento/valoraciones-novedades.service.ts`, `valoraciones-novedades.controller.ts`, `seguimiento.module.ts` en el mismo directorio; `apps/api/test/valoraciones-novedades.e2e-spec.ts`. **Tamaño:** M, 4 archivos.

**Evidencia 24-09-2026 (Claude, con subagente y revisión escéptica aprobada):** `GET avisos` y `POST avisos/leidos`, sin tabla nueva: los avisos se derivan de publicaciones y solicitudes. Salen los 50 más recientes; `sinLeer` cuenta los de esa lista (documentado en el contrato). La lectura va por usuario, es idempotente y no revisa nada. `valoraciones-novedades.e2e-spec.ts`: 6 pruebas (publicada y corregida, reintento, dos sesiones, fotos recibidas y revisión, ids ajenos, tope de 50 y permisos). Queda anotado sin cambiar: el aviso `fotosRecibidas` nace con la primera foto y no se reactiva con las siguientes.

#### E02b · Mostrar avisos y acciones en Inicio

**Descripción:** integrar avisos en Inicio y enlazar al destino existente de Progreso.

**Criterios:**

- [ ] Inicio muestra valoración publicada y solicitudes accionables, con autor/fecha y acceso a Progreso; no presenta controles profesionales al cliente.
- [ ] Lectura persiste al volver/iniciar sesión y un fallo conserva reintento; los accesos diarios, comidas/suplementos y avisos de entrenamiento existentes siguen disponibles.

**Verificación:** `npm test --workspace apps/mobile -- --runInBand valoraciones-novedades.spec.tsx hoy-inicio.spec.tsx novedades.spec.tsx`; abrir aviso → consultar destino → volver → recargar; comprobar sin novedades y con error de lectura.

**Dependencias:** E02a y E01b. **Responsable:** Claude principal. **Archivos previstos:** `apps/mobile/src/seguimiento/valoraciones-novedades.tsx`, `valoraciones-novedades.spec.tsx`, `valoraciones-api.ts` en el mismo directorio; `apps/mobile/app/index.tsx`. **Tamaño:** M, 4 archivos.

**Evidencia provisional 24-09-2026 (Claude):** Inicio monta avisos de seguimiento junto a sus accesos actuales; lectura, persistencia y reintento tienen pruebas del componente. Falta comprobar navegación y lectura en una sesión autenticada real.

**Punto de control E-B · E02a–E02b:** [ ] publicaciones y solicitudes se encuentran desde Inicio; [ ] lectura no equivale a revisión; [ ] avisos y destinos disponen de evidencia visual autenticada o pendientes explícitos.

### Ampliaciones de los PDF vigentes: D01, D04 y D07

**Estado actualizado:** D01 se integra desde la rama de mejoras; D04 y D07 siguen en el alcance. La decisión posterior registrada en coordinación y `a79cfc5` («solo el 6 y el 3», terminando metros) sustituye aquí la primera respuesta «todo menos k1». Los desgloses D02/D05/D06 se conservan como historial excluido: no se ejecutan, no se marcan hechos y no bloquean las tareas vigentes. Ejecutar este tramo después de E02b y antes de E03/Q, salvo D01, que se integra antes de RI03. D03 no tiene tareas de implementación: no crear registro nuevo de K-1, ni importar sus datos personales. Conservar `DeporteDelPlanSchema`, el bloque «Otros deportes» y el histórico ya existente.

Los documentos JSON de prescripción/registro permiten ampliar estos campos de forma compatible; no crear tablas duplicadas si no hacen falta. Antes de activar cualquier nueva unión discriminada, preparar todos sus consumidores para mantener compilación y lectura histórica. Contratos, índices de exportación y archivos compartidos siguen siendo propiedad exclusiva de Claude principal. Los nombres de campos/rutas nuevos se fijan una vez en el primer contrato de cada D y se reutilizan en API/UI.

### D01 · Registrar distancia en metros

**Descripción:** permitir ejercicios por distancia, como transportes, con carga cuando corresponda, sin tratarlos como repeticiones ni mezclarlos con fuerza estimada. La variante nueva se activa al terminar de preparar sus consumidores.

#### D01.a · Definir distancia y preparar los contratos

**Descripción:** introducir definiciones/validadores auxiliares de distancia y documentar su integración futura, manteniendo todavía las uniones activas anteriores.

**Criterios:**

- [ ] Distancia se expresa en metros con objetivo/resultado separados, admite carga según el ejercicio y no acepta simultáneamente repeticiones o segundos como resultado de esa serie.
- [ ] Se enumeran consumidores de `tipoMedicion` con `rg`; la nueva variante queda validable de forma aislada y no se publica hasta D01.g.

**Verificación:** `npm run build:shared`; `npm test --workspace apps/api -- --runInBand contratos.spec.ts`; casos metros/carga, dato vacío, negativo y documento histórico; `npm run typecheck` mantiene la app existente compilable.

**Dependencias:** C02 y E02b por orden de integración. **Responsable:** Claude principal. **Archivos previstos:** `packages/shared/src/entrenamiento.ts`, `apps/api/src/entrenamiento/contratos.spec.ts`, `SPEC-entrenamiento.md`. **Tamaño:** M, hasta 3 archivos; confirmar el nombre de la especificación vigente antes de editar.

#### D01.b · Preparar edición y construcción de series

**Descripción:** eliminar supuestos binarios de los modelos profesionales y preparar campos de distancia sin habilitarlos aún al usuario.

**Criterios:**

- [ ] Editor de sesión y constructor conservan IDs, unidad y carga al cargar/duplicar una serie; los modelos pueden representar la variante nueva mediante el contrato auxiliar.
- [ ] Las prescripciones existentes producen el mismo documento y la interfaz no ofrece metros antes de su activación completa.

**Verificación:** `npm test --workspace apps/mobile -- --runInBand editor-modelo.spec.ts modelo.spec.ts`; casos de carga, duplicación, rango y cambio de unidad; `npm run typecheck`.

**Dependencias:** D01.a. **Responsable:** Claude principal. **Archivos previstos:** `apps/mobile/src/entrenamiento-entrenador/editor-modelo.ts`, `editor-modelo.spec.ts` en el mismo directorio; `apps/mobile/src/entrenamiento-entrenador/constructor/modelo.ts`, `modelo.spec.ts` en el mismo directorio; `apps/mobile/src/entrenamiento-entrenador/editor-plan.tsx`. **Tamaño:** M, 5 archivos.

**Punto de control D1-A · D01.a–D01.b:** [ ] contratos auxiliares y preparación del editor pasan; [ ] las unidades antiguas siguen operativas; [ ] aún no se pueden emitir documentos nuevos incompletamente soportados.

#### D01.c · Preparar registro y recuperación local

**Descripción:** adaptar modelos y control de copias para que una nueva unidad no termine interpretada como segundos o repeticiones.

**Criterios:**

- [ ] Un registro de distancia puede prepararse, guardarse y recuperarse; cambiar la unidad de la prescripción deja pendiente la serie incompatible y conserva el respaldo original.
- [ ] Los modelos de sesión no calculan descanso, volumen o repeticiones a partir de metros; las copias anteriores siguen legibles.

**Verificación:** `npm test --workspace apps/mobile -- --runInBand registro-modelo.spec.ts registro-control.spec.ts modelo.spec.ts`; ida/vuelta y cambios entre las tres unidades con datos sintéticos.

**Dependencias:** D01.a. **Responsable:** Claude principal. **Archivos previstos:** `apps/mobile/src/entrenamiento/registro-modelo.ts`, `registro-modelo.spec.ts`, `registro-control.ts`, `registro-control.spec.ts` en el mismo directorio; `apps/mobile/src/entrenamiento/sesion/modelo.ts`. **Tamaño:** M, 5 archivos.

#### D01.d · Preparar entrada y lectura del cliente

**Descripción:** adaptar campos y etiquetas de tabla, sesión y resultado a magnitudes explícitas, manteniendo oculto el nuevo selector hasta D01.g.

**Criterios:**

- [ ] En la variante de distancia se solicita m y, cuando corresponda, kg; marcar/corregir/omitir conserva la unidad y sus valores sin reutilizar el campo de repeticiones.
- [ ] Vista activa y resumen muestran metros con accesibilidad y validación coherentes; las series existentes conservan su presentación.

**Verificación:** `npm test --workspace apps/mobile -- --runInBand tabla-series.spec.tsx partes.spec.tsx`; cubrir distancia con/sin carga, error y corrección; `npm run typecheck`.

**Dependencias:** D01.c. **Responsable:** Claude principal. **Archivos previstos:** `apps/mobile/src/entrenamiento/tabla-series.tsx`, `tabla-series.spec.tsx`, `registro-cliente.tsx`, `resultado.tsx` en el mismo directorio; `apps/mobile/src/entrenamiento/sesion/partes.tsx`. **Tamaño:** M, 5 archivos.

**Punto de control D1-B · D01.c–D01.d:** [ ] copias y formularios no confunden unidades; [ ] errores y recuperación pasan; [ ] metros aún no se publica desde un editor incompleto.

#### D01.e · Preparar prescripción visible y referencias

**Descripción:** completar los restantes consumidores profesionales y de guía para mostrar la unidad nueva sin perder carga, IDs o histórico.

**Criterios:**

- [ ] Tabla del constructor, editor, guía y ficha muestran la unidad explícita; los ternarios que asumían solo tiempo/repeticiones tienen tratamiento correcto de distancia.
- [ ] Los documentos existentes siguen editándose y leyéndose igual; el inventario de D01.a no deja un consumidor que interprete metros como otra unidad.

**Verificación:** `npm test --workspace apps/mobile -- --runInBand editor-sesion.spec.tsx constructor.spec.tsx ficha-modelo.spec.ts`; revisar la guía con una serie sintética de cada unidad y ejecutar `npm run typecheck`.

**Dependencias:** D01.b y D01.d. **Responsable:** Claude principal. **Archivos previstos:** `apps/mobile/src/entrenamiento-entrenador/editor-sesion.tsx`, `ficha-modelo.ts` en el mismo directorio; `apps/mobile/src/entrenamiento-entrenador/constructor/tabla.tsx`; `apps/mobile/src/entrenamiento/plan/guia.tsx`; `apps/mobile/src/entrenamiento/sesion/tiempo.ts`. **Tamaño:** M, 5 archivos; subdividir cualquier consumidor adicional descubierto.

#### D01.f · Validar distancia en entrega e histórico

**Descripción:** preparar persistencia/lectura de sesiones y el cálculo de métricas para la variante nueva sin alterar los registros ya enviados.

**Criterios:**

- [ ] Validación de entrega exige coincidir con unidad/carga pautadas y mantiene idempotencia/conflictos; el servidor no acepta valores de otra unidad ni cambia documentos históricos.
- [ ] Distancia queda excluida de cálculos de fuerza por repeticiones y se devuelve como metros en la lectura profesional.

**Verificación:** `npm run test:e2e --workspace apps/api -- --runTestsByPath test/entrenamiento-distancia.e2e-spec.ts test/entrenamiento-registro.e2e-spec.ts`; casos de contrato auxiliar preparados para activarse en D01.g y regresión actual; `npm test --workspace apps/mobile -- --runInBand contratos.spec.ts`.

**Dependencias:** D01.a y D01.e. **Responsable:** Claude principal. **Archivos previstos:** `apps/api/src/entrenamiento/registros.service.ts`, `sesiones.service.ts` en el mismo directorio; `apps/api/test/entrenamiento-distancia.e2e-spec.ts`; `apps/mobile/src/entrenamiento-entrenador/detalle.tsx`, `contratos.spec.ts` en el mismo directorio. **Tamaño:** M, 5 archivos. No marcar las pruebas HTTP de metros como pasadas antes de activar su contrato.

#### D01.g · Activar metros y comprobar el recorrido

**Descripción:** incorporar la variante preparada en las uniones públicas y habilitar su selección cuando todos sus consumidores están listos.

**Criterios:**

- [ ] Crear/duplicar/publicar una prescripción en metros y registrar/entregar/consultar su resultado funciona con carga cuando procede; los documentos anteriores siguen válidos.
- [ ] Se ejecutan los casos HTTP de metros, reintento y cambio de pauta y se comprueba la recuperación en cliente; no quedan casos preparados sin ejecutar.

**Verificación:** `npm run typecheck`; `npm run test:e2e --workspace apps/api -- --runTestsByPath test/entrenamiento-distancia.e2e-spec.ts`; `npm test --workspace apps/mobile -- --runInBand editor-sesion.spec.tsx tabla-series.spec.tsx registro-control.spec.ts`; recorrido completo autenticado.

**Dependencias:** D01.f. **Responsable:** Claude principal. **Archivos previstos:** `packages/shared/src/entrenamiento.ts`, `apps/mobile/src/entrenamiento-entrenador/editor-sesion.tsx`, `apps/mobile/src/entrenamiento-entrenador/constructor/tabla.tsx`, `apps/mobile/src/entrenamiento-entrenador/editor-sesion.spec.tsx`, `apps/api/test/entrenamiento-distancia.e2e-spec.ts`. **Tamaño:** M, 5 archivos.

**Punto de control D1-C · D01.e–D01.g:** [ ] metros funciona de prescripción a resultado; [ ] legado, copias locales y fuerza conservan significado; [ ] ningún resultado real se ha convertido entre unidades de forma implícita.

### D02 · Cardio pautado y realizado

**Fuera de esta entrega según la decisión posterior registrada.** Se conserva el desglose histórico sin ejecutarlo ni exigirlo para D04/D07/E03/Q.

**Descripción:** añadir registro estructurado de tiempo, velocidad km/h, inclinación % y RPE del cardio, con campos elegidos por el entrenador y objetivo separado de ejecución.

#### D02.a · Contrato y validación de cardio

**Descripción:** ampliar de forma opcional prescripción/registro del bloque existente y validar sus campos contra la pauta leída por el servidor.

**Criterios:**

- [ ] Cada tramo mantiene ID y campos habilitados, objetivo puntual o rango y resultado con unidad; la ausencia de cardio no añade campos obligatorios al documento antiguo.
- [ ] RPE de cardio se distingue del RPE global de cierre; campos no pautados o valores inválidos se rechazan sin modificar la sesión.

**Verificación:** `npm run build:shared`; `npm test --workspace apps/api -- --runInBand contratos.spec.ts`; `npm run test:e2e --workspace apps/api -- --runTestsByPath test/entrenamiento-cardio.e2e-spec.ts`.

**Dependencias:** D01.g. **Responsable:** Claude principal. **Archivos previstos:** `packages/shared/src/entrenamiento.ts`, `apps/api/src/entrenamiento/contratos.spec.ts`, `apps/api/src/entrenamiento/registros.service.ts`, `apps/api/test/entrenamiento-cardio.e2e-spec.ts`. **Tamaño:** M, 4 archivos.

#### D02.b · Configurar cardio profesional

**Descripción:** añadir controles al editor/constructor existentes para elegir qué objetivos y datos solicitar en cardio.

**Criterios:**

- [ ] Entrenador selecciona tiempo/velocidad/inclinación/RPE y sus objetivos; guardar, duplicar y publicar conserva la pauta, sin copiar valores de los PDF como predeterminados.
- [ ] La vista previa distingue campos de consulta y campos que completará el cliente; quitar cardio no borra históricos entregados.

**Verificación:** `npm test --workspace apps/mobile -- --runInBand cardio-editor.spec.tsx editor-sesion.spec.tsx constructor.spec.tsx`; comprobar publicación y relectura profesional.

**Dependencias:** D02.a. **Responsable:** Claude principal. **Archivos previstos:** `apps/mobile/src/entrenamiento-entrenador/cardio-editor.tsx`, `cardio-editor.spec.tsx`, `editor-sesion.tsx` en el mismo directorio; `apps/mobile/src/entrenamiento-entrenador/constructor/partes.tsx`, `modelo.ts` en el mismo directorio. **Tamaño:** M, 5 archivos.

**Punto de control D2-A · D02.a–D02.b:** [ ] pauta de cardio se guarda/publica y valida en servidor; [ ] no altera sesiones sin cardio ni confunde RPE local/global.

#### D02.c · Registrar y recuperar cardio

**Descripción:** mostrar únicamente campos pautados y conservar su edición con la copia y entrega de entrenamiento existentes.

**Criterios:**

- [ ] Cliente ve objetivos y registra valores reales con decimal/unidad; omitir o no completar un tramo no crea cero ni obliga a rellenar datos no solicitados.
- [ ] Guardado, recarga y reintento conservan resultados sin duplicar; un cambio de pauta incompatible conserva respaldo y pide revisar solo lo afectado.

**Verificación:** `npm test --workspace apps/mobile -- --runInBand cardio-registro.spec.tsx registro-control.spec.ts`; pérdida de conexión, respuesta perdida y cambio de prescripción; comprobar entrega con la prueba HTTP D02.a.

**Dependencias:** D02.b. **Responsable:** Claude principal. **Archivos previstos:** `apps/mobile/src/entrenamiento/cardio-registro.tsx`, `cardio-registro.spec.tsx`, `registro-cliente.tsx`, `registro-modelo.ts`, `registro-control.ts` en el mismo directorio. **Tamaño:** M, 5 archivos.

#### D02.d · Leer objetivos y resultados de cardio

**Descripción:** presentar cardio realizado al cliente y al entrenador sin ocultarlo en una nota genérica.

**Criterios:**

- [ ] Resumen cliente y detalle profesional muestran por tramo objetivos/resultados y unidades; RPE de cierre permanece separado.
- [ ] Sesión antigua, tramo parcial y cardio omitido tienen lectura correcta y no duplican tiempo activo como tiempo de cardio.

**Verificación:** `npm test --workspace apps/mobile -- --runInBand cardio-resumen.spec.tsx detalle.spec.tsx`; recorrido publicar → realizar → entregar → revisar con cardio parcial y completo.

**Dependencias:** D02.c. **Responsable:** Claude principal. **Archivos previstos:** `apps/mobile/src/entrenamiento/cardio-resumen.tsx`, `cardio-resumen.spec.tsx`, `resultado.tsx` en el mismo directorio; `apps/mobile/src/entrenamiento-entrenador/detalle.tsx`, `detalle.spec.tsx` en el mismo directorio. **Tamaño:** M, 5 archivos.

**Punto de control D2-B · D02.c–D02.d:** [ ] cardio llega del editor al profesional con datos reales separados; [ ] errores y sesiones antiguas se han comprobado.

### D03 · K-1 realmente hecho — excluido

No crear tareas, formulario, API, tabla ni señal de «actividad realizada» de K-1. Los deportes ya programados y su histórico se conservan. D05 puede mostrar esa programación con su etiqueta, nunca deducir que se realizó ni exigir un registro excluido por David.

### D04 · Chequeo previo breve configurable

**Descripción:** permitir que el entrenador configure por cliente preguntas de sensación, energía previa, calidad del sueño, motivación y agujetas por zona, reutilizando duración de sueño y molestias existentes. Mantener el chequeo anterior como valor inicial; las respuestas siguen siendo opcionales.

#### D04.a · Contrato de configuración y respuesta

**Descripción:** añadir configuración por cliente y snapshot de preguntas/respuestas al check-in de sesión con compatibilidad de documentos previos.

**Criterios:**

- [ ] La pauta del cliente habilita preguntas con IDs/escalas explícitos; cada sesión conserva la pauta utilizada y los registros antiguos de sensación/molestia siguen válidos.
- [ ] Calidad del sueño se distingue de horas dormidas; agujetas y dolor no duplican el formulario ni sustituyen el flujo existente de molestias.

**Verificación:** `npm run build:shared`; `npm test --workspace apps/api -- --runInBand contratos.spec.ts`; cubrir configuración ausente, preguntas habilitadas, escalas y documentos históricos.

**Dependencias vigentes:** D01.g integrado y E02b; D02 está excluida y no bloquea el chequeo. **Responsable:** Claude principal. **Archivos previstos:** `packages/shared/src/entrenamiento.ts`, `packages/shared/src/seguimiento.ts`, `apps/api/src/entrenamiento/contratos.spec.ts`, `apps/api/src/seguimiento/contratos.spec.ts`. **Tamaño:** M, 4 archivos.

#### D04.b · Guardar la configuración del cliente

**Descripción:** persistir la selección profesional dentro de la configuración existente de seguimiento con sus revisiones y permisos.

**Criterios:**

- [ ] Entrenador autorizado guarda/relee preguntas por cliente; revisión obsoleta produce conflicto y cliente/nutricionista no las modifican.
- [ ] Configuración anterior mantiene el check-in actual; actualizar preguntas no reescribe sesiones ya iniciadas ni respuestas históricas.

**Verificación:** `npm run test:e2e --workspace apps/api -- --runTestsByPath test/seguimiento.e2e-spec.ts`; configuración antigua, guardado/relectura, concurrencia y acceso ajeno.

**Dependencias:** D04.a. **Responsable:** Claude principal. **Archivos previstos:** `apps/api/src/seguimiento/seguimiento.service.ts`, `seguimiento.controller.ts` en el mismo directorio; `apps/api/test/seguimiento.e2e-spec.ts`. **Tamaño:** M, 3 archivos.

**Punto de control D4-A · D04.a–D04.b:** [ ] configuración por cliente se guarda con revisión y permisos; [ ] ausencia de ampliación mantiene el check-in anterior.

#### D04.c · Conservar la pauta usada en sesión

**Descripción:** fijar el snapshot de preguntas aplicables cuando comienza el registro y validar las respuestas contra esa versión.

**Criterios:**

- [ ] Sesión/check-in conserva la versión usada; un cambio posterior de preguntas no invalida silenciosamente una respuesta pendiente de enviar ni modifica el histórico.
- [ ] API rechaza respuestas ajenas a la pauta o escalas inválidas; repetir inicio/envío no cambia la pauta capturada ni duplica registro.

**Verificación:** `npm run test:e2e --workspace apps/api -- --runTestsByPath test/entrenamiento-checkin.e2e-spec.ts test/entrenamiento-registro.e2e-spec.ts`; iniciar → cambiar configuración → enviar/recuperar, con pérdida de respuesta.

**Dependencias:** D04.b. **Responsable:** Claude principal. **Archivos previstos:** `apps/api/src/entrenamiento/sesiones.service.ts`, `registros.service.ts` en el mismo directorio; `apps/api/test/entrenamiento-checkin.e2e-spec.ts`. **Tamaño:** M, 3 archivos.

#### D04.d · Configurar preguntas profesionales

**Descripción:** añadir selección y vista previa al seguimiento de la ficha del cliente.

**Criterios:**

- [ ] Entrenador habilita preguntas por cliente y conserva su selección al guardar/reabrir; la vista previa explica qué verá el cliente.
- [ ] La presentación normal contiene dos o tres preguntas; zonas se despliegan solo cuando corresponde y no se impone el cuestionario completo a todos.

**Verificación:** `npm test --workspace apps/mobile -- --runInBand checkin-configuracion.spec.tsx configuracion.spec.tsx`; pautas mínima/ampliada, guardado fallido y revisión obsoleta.

**Dependencias:** D04.c. **Responsable:** Claude principal. **Archivos previstos:** `apps/mobile/src/seguimiento/checkin-configuracion.tsx`, `checkin-configuracion.spec.tsx`, `configuracion.tsx`, `configuracion.spec.tsx` en el mismo directorio. **Tamaño:** M, 4 archivos.

**Punto de control D4-B · D04.c–D04.d:** [ ] pauta y snapshot se conservan al cambiar configuración; [ ] selección profesional tiene vista previa breve y errores recuperables.

#### D04.e · Responder sin duplicar datos cotidianos

**Descripción:** integrar las preguntas al inicio de sesión y mostrar el sueño diario disponible como referencia fechada.

**Criterios:**

- [ ] Cliente responde solo lo pautado; sueño ya registrado se reutiliza con fecha/origen y no se vuelve a pedir ni sobrescribir desde el check-in.
- [ ] Las zonas aparecen según la respuesta; dolor permite acceder a molestias existente y las respuestas sobreviven a salir/volver y a un fallo de entrega.

**Verificación:** `npm test --workspace apps/mobile -- --runInBand pantallas.spec.tsx registro-modelo.spec.ts`; probar sin sueño registrado, sueño existente, agujetas por zona, dolor y recuperación local.

**Dependencias:** D04.d. **Responsable:** Claude principal. **Archivos previstos:** `apps/mobile/src/entrenamiento/sesion/check-in.tsx`, `pantallas.spec.tsx` en el mismo directorio; `apps/mobile/src/entrenamiento/registro-cliente.tsx`, `registro-modelo.ts`, `registro-modelo.spec.ts` en el mismo directorio. **Tamaño:** M, 5 archivos.

#### D04.f · Consultar el check-in publicado en el registro

**Descripción:** mostrar las respuestas reales y su pauta de origen en la revisión profesional y resumen autorizado.

**Criterios:**

- [ ] El profesional ve escalas, zonas y ausencias sin diagnosticar ni convertir falta de respuesta en mala recuperación.
- [ ] Cambiar la pauta futura no altera preguntas/respuestas del registro entregado; las molestias conservan su canal y estado de revisión.

**Verificación:** `npm test --workspace apps/mobile -- --runInBand checkin-resumen.spec.tsx detalle.spec.tsx`; lectura de registro antiguo, ampliado y pauta cambiada después del envío.

**Dependencias:** D04.e. **Responsable:** Claude principal. **Archivos previstos:** `apps/mobile/src/entrenamiento/checkin-resumen.tsx`, `checkin-resumen.spec.tsx`, `resultado.tsx` en el mismo directorio; `apps/mobile/src/entrenamiento-entrenador/detalle.tsx`, `detalle.spec.tsx` en el mismo directorio. **Tamaño:** M, 5 archivos.

**Punto de control D4-C · D04.e–D04.f:** [ ] el chequeo breve se responde y consulta sin duplicar sueño/molestias; [ ] historial conserva la pauta usada y las respuestas opcionales.

### D05 · Resumen semanal de recuperación profesional

**Fuera de esta entrega según la decisión posterior registrada.** Se conserva el desglose histórico sin ejecutarlo ni exigirlo para E03/Q.

**Descripción:** reunir datos disponibles para que el entrenador revise rendimiento, sueño, esfuerzo y molestias/agujetas; no generar diagnósticos ni cambiar prescripciones automáticamente.

#### D05.a · Contrato del resumen

**Descripción:** definir una proyección semanal con fuentes, cobertura y fechas, consultable solo por el profesional autorizado.

**Criterios:**

- [ ] La respuesta reúne registros entregados, sueño diario, RPE/energía ya existentes y check-in ampliado, mostrando datos faltantes y procedencia de cada señal.
- [ ] Actividad programada se etiqueta como programada; no se añade ni se infiere K-1 realizado, y no se fijan umbrales clínicos o cambios automáticos.

**Verificación:** `npm run build:shared`; `npm test --workspace apps/api -- --runInBand recuperacion-contratos.spec.ts`; semanas vacías/parciales, campos de cobertura y fuentes válidas.

**Dependencias:** D02.d y D04.f. **Responsable:** Claude principal. **Archivos previstos:** `packages/shared/src/recuperacion.ts`, `packages/shared/src/index.ts`, `apps/api/src/entrenamiento/recuperacion-contratos.spec.ts`. **Tamaño:** M, 3 archivos.

#### D05.b · Integrar cálculo y acceso al resumen

**Descripción:** implementar/registrar el servicio y exponer la consulta autorizada, verificando agregaciones sin promediar ausencia como cero.

**Criterios:**

- [ ] Los agregados usan únicamente datos comparables y muestran denominador/cobertura; agujetas repetidas se describen por registros/fechas sin diagnóstico de persistencia clínica.
- [ ] El servicio se integra en el módulo existente con alcance profesional y límites de período; no se amplía el acceso de otros roles ni se infiere actividad realizada.

**Verificación:** `npm test --workspace apps/api -- --runInBand recuperacion-semanal.spec.ts`; `npm run test:e2e --workspace apps/api -- --runTestsByPath test/recuperacion-semanal.e2e-spec.ts`; comprobar semana, zona horaria, cobertura y cliente no autorizado.

**Dependencias:** D05.a. **Responsable:** Claude principal. **Archivos previstos:** `apps/api/src/entrenamiento/entrenamiento.module.ts`, `entrenamiento.controller.ts`, `recuperacion-semanal.service.ts`, `recuperacion-semanal.spec.ts` en el mismo directorio; `apps/api/test/recuperacion-semanal.e2e-spec.ts`. **Tamaño:** M, 5 archivos.

**Punto de control D5-A · D05.a–D05.b:** [ ] resumen usa fuentes reales y cobertura; [ ] permisos y semana vacía pasan; [ ] no contiene registro nuevo ni inferencias de K-1.

#### D05.c · Consultar recuperación en la ficha

**Descripción:** mostrar al entrenador la semana y enlaces a los registros de origen, dejando toda decisión de cambio en sus controles habituales.

**Criterios:**

- [ ] La ficha presenta rendimiento, sueño, esfuerzo y molestias disponibles con fechas, cobertura y navegación al origen; información incompleta se declara explícitamente.
- [ ] Consultar el resumen no cambia cargas, series, descansos, fases ni dietas; cualquier cambio se edita y publica por el profesional.

**Verificación:** `npm test --workspace apps/mobile -- --runInBand recuperacion-semanal.spec.tsx ficha-cliente.spec.tsx`; semana con datos, parcial y vacía, error de red y cambio de semana.

**Dependencias:** D05.b. **Responsable:** Claude principal. **Archivos previstos:** `apps/mobile/src/entrenamiento-entrenador/recuperacion-api.ts`, `recuperacion-semanal.tsx`, `recuperacion-semanal.spec.tsx` en el mismo directorio; `apps/mobile/src/entrenamiento-entrenador/ficha/ficha-cliente.tsx`, `ficha-cliente.spec.tsx` en el mismo directorio. **Tamaño:** M, 5 archivos.

### D06 · Prioridades cuando falta tiempo

**Fuera de esta entrega según la decisión posterior registrada.** Se conserva el desglose histórico sin ejecutarlo ni exigirlo para D07/E03/Q.

**Descripción:** permitir que el entrenador indique prioridad de ejercicios/bloques y que el cliente comunique falta de tiempo sin que la app quite trabajo automáticamente.

#### D06.a · Contrato de prioridad y omisión

**Descripción:** añadir prioridad profesional opcional y motivo de omisión a la estructura de sesión/registro existente.

**Criterios:**

- [ ] La prioridad pertenece a la pauta del ejercicio/bloque, conserva orden publicado y tiene lectura compatible cuando falta; el motivo «falta de tiempo» diferencia omisión de pendiente/hecha.
- [ ] Declarar falta de tiempo no modifica prescripción ni marca series omitidas automáticamente; el servidor valida estado y motivo coherentes.

**Verificación:** `npm run build:shared`; `npm test --workspace apps/api -- --runInBand contratos.spec.ts`; `npm run test:e2e --workspace apps/api -- --runTestsByPath test/entrenamiento-prioridades.e2e-spec.ts`.

**Dependencias:** D04.f. **Responsable:** Claude principal. **Archivos previstos:** `packages/shared/src/entrenamiento.ts`, `apps/api/src/entrenamiento/contratos.spec.ts`, `apps/api/src/entrenamiento/registros.service.ts`, `apps/api/test/entrenamiento-prioridades.e2e-spec.ts`. **Tamaño:** M, 4 archivos.

**Punto de control D5-D6 · D05.c–D06.a:** [ ] resumen profesional no aplica cambios; [ ] contrato de prioridad/omisión no altera documentos anteriores ni programa reducciones automáticas.

#### D06.b · Pautar y presentar prioridades

**Descripción:** integrar prioridad y nota profesional en editor/constructor y lectura del plan con la solución más sencilla que exprese lo pautado.

**Criterios:**

- [ ] Profesional asigna prioridades explícitas a ejercicios/bloques y las conserva al guardar/duplicar/publicar; una nota existente puede complementarlas sin duplicar formularios.
- [ ] Cliente consulta prioridad y nota junto al bloque; la app no reordena ni elimina trabajo por interpretar el texto.

**Verificación:** `npm test --workspace apps/mobile -- --runInBand prioridades.spec.tsx editor-sesion.spec.tsx constructor.spec.tsx`; prioridad ausente, bloques distintos y publicación/relectura.

**Dependencias:** D06.a. **Responsable:** Claude principal. **Archivos previstos:** `apps/mobile/src/entrenamiento-entrenador/prioridades.tsx`, `prioridades.spec.tsx`, `editor-sesion.tsx` en el mismo directorio; `apps/mobile/src/entrenamiento-entrenador/constructor/partes.tsx`; `apps/mobile/src/entrenamiento/plan/guia.tsx`. **Tamaño:** M, 5 archivos.

#### D06.c · Comunicar omisión por tiempo

**Descripción:** añadir el motivo al control de omitir y conservarlo en copia, entrega y consulta de resultados.

**Criterios:**

- [ ] Cliente puede omitir expresamente por falta de tiempo y corregir esa decisión antes del envío; el resto de series mantiene su estado y la copia conserva el motivo.
- [ ] Entrenador ve qué se omitió y por qué, diferenciado de pendiente; ningún clic en «falta de tiempo» cambia automáticamente toda la sesión.

**Verificación:** `npm test --workspace apps/mobile -- --runInBand tabla-series.spec.tsx registro-control.spec.ts`; `npm run test:e2e --workspace apps/api -- --runTestsByPath test/entrenamiento-prioridades.e2e-spec.ts`; comprobar omitir → salir → continuar → entregar → revisar.

**Dependencias:** D06.b. **Responsable:** Claude principal. **Archivos previstos:** `apps/mobile/src/entrenamiento/tabla-series.tsx`, `tabla-series.spec.tsx`, `registro-control.ts`, `resultado.tsx` en el mismo directorio; `apps/mobile/src/entrenamiento-entrenador/detalle.tsx`. **Tamaño:** M, 5 archivos; cualquier cambio adicional de persistencia requiere subtarea acotada.

**Punto de control D6 · D06.b–D06.c:** [ ] prioridades se leen y omisiones se revisan con motivo; [ ] la app no elimina, reordena o completa series por su cuenta.

### D07 · Aplicación profesional de fases y descarga

**Descripción:** ampliar las fases existentes con vista previa sin mutación y confirmación «Aplicar y publicar» sobre sesiones futuras elegibles, sin convertir ejemplos de los PDF en reglas globales. `SesionEntrenamiento.borrador` es ejecución privada del cliente: nunca usarla como borrador profesional ni crear otra capa de borradores de pauta.

#### D07.a · Contrato de propuesta de fase

**Descripción:** definir cambios elegidos por el profesional y su resultado de vista previa, manteniendo las fases descriptivas antiguas válidas.

**Criterios:**

- [ ] Una fase puede seguir siendo solo nombre/detalle; los ajustes opcionales de series, rango/RIR y descanso identifican destinos, cambios propuestos, revisión de origen y exclusiones.
- [ ] No hay porcentajes de descarga ni RIR universales por defecto; la propuesta distingue antes/después y rechaza objetivos inválidos o fuera de las semanas del plan.

**Verificación:** `npm run build:shared`; `npm test --workspace apps/api -- --runInBand fases-prescripcion.spec.ts`; casos fase descriptiva, ajustes elegidos, límites y documento anterior.

**Dependencias vigentes:** D01.g integrado y D04.f. D02/D06 están excluidas y no bloquean las fases. **Responsable:** Claude principal. **Archivos previstos:** `packages/shared/src/entrenamiento.ts`, `apps/api/src/entrenamiento/fases-prescripcion.ts`, `apps/api/src/entrenamiento/fases-prescripcion.spec.ts`. **Tamaño:** M, 3 archivos.

#### D07.b · Previsualizar y aplicar con revisión

**Descripción:** exponer cálculo de propuesta sin mutación y aplicación profesional transaccional e idempotente sobre las sesiones permitidas.

**Criterios:**

- [ ] Previsualizar no escribe; «Aplicar y publicar» exige `revisionPrescripcion` vigente, es transaccional e idempotente y hace visible solo la pauta confirmada por el servidor.
- [ ] Sesiones empezadas, enviadas o con envío pendiente conocido quedan protegidas/excluidas; borrador offline desconocido conserva ambas versiones mediante recuperación, sin cambiar histórico ni pisar edición concurrente.

**Verificación:** `npm run test:e2e --workspace apps/api -- --runTestsByPath test/entrenamiento-fases.e2e-spec.ts test/plan-bloque.e2e-spec.ts`; comprobar preview sin escritura, concurrencia, reintento y mezcla de futuras/enviadas/en curso.

**Dependencias:** D07.a. **Responsable:** Claude principal. **Archivos previstos:** `apps/api/src/entrenamiento/planes.service.ts`, `sesiones.service.ts`, `entrenamiento.controller.ts` en el mismo directorio; `apps/api/test/entrenamiento-fases.e2e-spec.ts`; `apps/mobile/src/entrenamiento/api.ts`. **Tamaño:** M, 5 archivos.

**Punto de control D7-A · D07.a–D07.b:** [ ] vista previa no modifica datos; [ ] aplicación tiene revisión/idempotencia; [ ] registros enviados y en curso se conservan y las exclusiones son visibles.

#### D07.c · Revisar y aplicar la fase desde el panel

**Descripción:** integrar vista previa profesional con cancelación o confirmación explícita «Aplicar y publicar» usando la prescripción existente.

**Criterios:**

- [ ] Entrenador selecciona fase/objetivos, ve antes/después y exclusiones, puede cancelar sin cambios o confirmar «Aplicar y publicar»; un error/conflicto conserva una salida recuperable.
- [ ] Cliente ve la pauta anterior hasta confirmación del servidor y después la actualización completa; no se toca la ejecución privada ni los resultados históricos.

**Verificación:** `npm test --workspace apps/mobile -- --runInBand fases-prescripcion.spec.tsx editor-plan.spec.tsx`; recorrido proponer → cancelar; proponer → aplicar/publicar → confirmar → consultar cliente; fallo/recarga/reintento sin cambio parcial.

**Dependencias:** D07.b. **Responsable:** Claude principal. **Archivos previstos:** `apps/mobile/src/entrenamiento-entrenador/fases-prescripcion.tsx`, `fases-prescripcion.spec.tsx`, `editor-plan.tsx`, `editor-plan.spec.tsx` en el mismo directorio; `apps/mobile/src/entrenamiento-entrenador/constructor/partes.tsx`. **Tamaño:** M, 5 archivos.

### E03 · Revisar los recorridos integrados del cliente

**Descripción:** repetir la revisión actual de la app con valoraciones y todas las D aprobadas incorporadas, documentando accesibilidad, consistencia y cualquier regresión reproducible.

**Criterios:**

- [ ] Los recorridos de C01, nueva valoración → evolución → solicitud fotográfica y las D aprobadas se verifican autenticados a 360/390 px, incluyendo vacío, parcial, carga y error.
- [ ] Se comprueban foco/teclado, coma decimal, controles táctiles, etiquetas y volver; una regresión abre una subtarea concreta antes de ampliar archivos o dar el recorrido por bueno.

**Verificación:** recorrido manual de ambos roles en la misma instancia con datos sintéticos; `npm test --workspace apps/mobile -- --runInBand pantallas.spec.tsx hoy-inicio.spec.tsx`; registrar capturas saneadas y pasos en el informe.

**Dependencias vigentes:** C01, E01b, E02b/E02c, RI01–RI07 y D07.c, con D01/D04 integrados. D02/D03/D05/D06 están excluidas y no bloquean esta revisión. **Responsable:** Claude principal. **Archivos previstos:** `tasks/evidencia-valoraciones.md`, `apps/mobile/src/seguimiento/pantallas.spec.tsx`. **Tamaño:** S, hasta 2 archivos.

**Punto de control D7-B · D07.c y E03:** [ ] todas las D aprobadas funcionan junto al plan de valoración; [ ] no se implementó K-1 nuevo; [ ] cliente solo registra/consulta y entrenador decide/aplica/publica; [ ] revisión visual integral de E03 realizada antes de Q.

### Q01 · Probar compatibilidad, concurrencia y permisos completos

**Descripción:** ejecutar una matriz integrada con datos sintéticos que combine legado, nuevas visitas, correcciones y fotografías, incluyendo dos dispositivos y pérdida de respuestas.

**Criterios:**

- [ ] Se leen registros antiguos y nuevos; cambios de plantilla, protocolo, unidad, fase y publicación no pierden resultados, crean equivalencias falsas ni duplican puntos; metros/check-in/fases conservan los documentos anteriores. No exigir funciones de D02/D05/D06 excluidas.
- [ ] Creación/guardado/publicación/vínculo/lectura con reintentos o concurrencia conserva un resultado consistente; cliente ajeno y nutricionista fuera de alcance no obtienen datos ni medios.
- [ ] Logs/fixtures no contienen fotos reales, credenciales, notas privadas o enlaces firmados; pruebas se ejecutan contra base y almacenamiento aislados.

**Verificación:** `npm run test:e2e --workspace apps/api -- --runTestsByPath test/valoraciones-compatibilidad.e2e-spec.ts test/matriz-roles.e2e-spec.ts test/medios.e2e-spec.ts`; registrar escenarios concretos y resultado, no solo el número total de pruebas.

**Dependencias:** E03 y F05a. **Responsable:** Claude principal. **Archivos previstos:** `apps/api/test/valoraciones-compatibilidad.e2e-spec.ts`, `apps/api/test/matriz-roles.e2e-spec.ts`, `apps/api/test/medios.e2e-spec.ts`, `tasks/evidencia-valoraciones.md`. **Tamaño:** M, 4 archivos.

### Q02 · Cerrar verificación técnica y documentación

**Descripción:** ejecutar controles completos una vez integrado el trabajo y dejar la especificación y el procedimiento de prueba/despliegue acordes al comportamiento final.

**Criterios:**

- [ ] Tipos, lint, pruebas unitarias/HTTP y build pasan sobre la versión final; cualquier fallo se resuelve mediante subtarea acotada y se repite el control afectado.
- [ ] Se documentan límites, formatos, permisos, caducidad/limpieza, migraciones y operación local; proveedor/región/coste de fotos reales quedan pendientes de decidir antes del despliegue.
- [ ] T05/T06/T17 y pruebas físicas/observadas conservan estado independiente; evidencia técnica no se presenta como aprobación o despliegue ejecutado.

**Verificación:** `npm run typecheck`; `npm run lint`; `npm test`; `npm run test:e2e` en base dedicada; `npm run build --workspace apps/api`; `npx prisma migrate status` en base dedicada; `git diff --check`. Registrar fecha, revisión probada, comandos y resultados sin secretos.

**Dependencias:** Q01. **Responsable:** Claude principal. **Archivos previstos:** `SPEC-seguimiento-corporal.md`, `docs/adr/0005-almacenamiento-de-fotos.md`, `docs/PENDIENTE-PARA-PRODUCCION.md`, `tasks/evidencia-valoraciones.md`. **Tamaño:** M, 4 archivos de documentación; los arreglos de código se subdividen.

### Q03 · Comprobar móvil físico y uso sin instrucciones

**Descripción:** cerrar las comprobaciones que requieren dispositivo real y observación de personas, con resultados separados de la automatización.

**Criterios:**

- [ ] En móvil físico se comprueban bloqueo, salir/volver, pausa, recuperación, pérdida de red y subida interrumpida; T05 solo se cierra si sus condiciones originales pasan.
- [ ] Tres personas intentan continuar sesión, corregir serie, mover día, registrar comida, encontrar respuesta/valoración y comparar evolución sin explicación previa; se registran éxito, tiempo, errores y ayuda requerida sin identificar personas.
- [ ] Los bloqueos de usabilidad se convierten en tareas concretas y se vuelven a comprobar; si falta móvil/personas, la entrega conserva este pendiente explícito.

**Verificación:** ejecución física y sesiones observadas con cuentas/datos sintéticos; registrar dispositivo, versión, pasos, resultados y límites en el informe, sin sustituir observación por capturas de navegador.

**Dependencias:** Q02 y disponibilidad real de dispositivo/participantes. **Responsable:** Claude principal coordina evidencia; observación humana necesaria. **Archivos previstos:** `tasks/evidencia-valoraciones.md`. **Tamaño:** S, 1 archivo; no estimar como una prueba automatizable.

**Punto de control Q · Q01–Q03:** [ ] técnica, visual, físico y observado tienen resultados separados; [ ] cada criterio aprobado enlaza evidencia; [ ] solo se marcan terminadas las tareas demostradas y se entrega la relación precisa de pendientes, decisiones del PDF y almacenamiento de producción.
