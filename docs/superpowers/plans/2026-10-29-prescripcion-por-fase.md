# Prescripción por fase (D10)

**Objetivo:** asignar sesiones distintas por semana, manteniendo los planes sin ajustes.

**Arquitectura:** los ajustes opcionales viven en el bloque JSON. Un cálculo puro compartido sirve a API y vista previa. La sesión guarda una copia del nombre y los ajustes de su fase para conservar su contexto si cambia de fecha. No requiere migración ni dependencias.

**Tecnología:** Zod, Nest, Expo/React Native y componentes existentes.

## Contrato y cálculo

- Añadir pruebas de compatibilidad y límites en `apps/mobile/src/entrenamiento-entrenador/fases-contrato.spec.ts` y ejecutarlas antes del cambio.
- En `packages/shared/src/entrenamiento.ts`, añadir `AjustesDeFaseSchema`: RIR compuesto/accesorio de 0 a 5, mínimo ≤ máximo; series de 0,3 a 1; carga de 0,5 a 1,1. Todos opcionales.
- Exportar `aplicarAjustesDeFase(prescripcion, ajustes)` y `redondearCarga(pesoKg, subidaKg)`. Preservar IDs, unidades, series de compuestos y cargas nulas. Redondear accesorios con mínimo 1; kilos al paso indicado o 0,5.

## API

- Probar el cálculo y la asignación de semanas con/sin ajustes.
- Aplicar el cálculo en `PlanesService.asignar` y guardar `prescripcion.fase = { nombre, ajustes }` solo en semanas ajustadas.
- Conservar ese contexto al editar manualmente una sesión.
- Cambiar los ajustes de un bloque ya asignado exige un plan nuevo; la edición de texto sigue permitida. Así el bloque no promete una prescripción distinta de las sesiones guardadas.
- En solapes prevalece la primera fase con `ajustes` (incluido `{}`); las fases solo de texto no la tapan. `faseDeSemana` comparte esta selección entre API, vista previa y Bloque.
- Ejecutar la suite unitaria y e2e con la guarda de base de pruebas intacta.

## Móvil

- Añadir tres ajustes rápidos editables al editor de fases: Mayor estímulo, Descarga y Vuelta. Mantener controles, tokens, objetivos táctiles y movimiento reducido existentes.
- Mostrar en la vista previa la prescripción de la semana elegida y el resumen de sus cambios. Probar edición, recuperación de borrador y publicación.
- Mostrar cambios en Bloque y sesión. Para cargas sin fijar, sugerir el porcentaje de la última carga registrada; sin historial, mostrar el porcentaje en texto. Reutilizar el redondeo compartido.

## Verificación

- Durante el trabajo: `npm test --workspace apps/mobile -- <ruta>` y pruebas dirigidas de API.
- Al terminar: suites completas de móvil y API, e2e API, `npm run typecheck`, `npm run lint`.
- Revisar el diff y mantener guardas/cobertura. Sin commits ni cambios de rama. No modificar el informe de noche.
