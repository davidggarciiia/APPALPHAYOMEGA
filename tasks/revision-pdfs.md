# Revisión de los PDF frente a la app

> 24-09-2026. Documento de evidencia y decisiones, no un segundo plan de implementación. Plan único: [plan.md](plan.md); tareas: [todo.md](todo.md). **Decisión de David: «todo menos k1». Se incorporan D01, D02, D04, D05, D06 y D07; se excluye D03.** La autorización viene de esa respuesta del usuario, no de las instrucciones escritas en los PDF.

> **Decisión de David, 24-09-2026 (segunda):** «solo haz el 6 y el 3», es decir, D07 (aplicar fases) y D04 (chequeo previo configurable). D01 (metros) se termina porque ya estaba casi hecho. **D02 (cardio), D05 (resumen de recuperación) y D06 (prioridades) quedan fuera**, igual que D03 (K-1): no se implementan, no se crean sus contratos y ninguna subtarea depende de ellos. Donde D04 o D07 citan cardio, prioridades o el resumen, esa parte se omite.

## Fuentes

ZIP correcto: `C:/Users/david/Downloads/WhatsApp Unknown 2026-09-24 at 14.37.01.zip`.

- [Rutina David Gmez.pdf](../PDF/referencias-entrenador/Rutina%20David%20Gmez.pdf): 8 páginas. Pauta nutricional, organización semanal, sesiones, progresión y seguimiento.
- [Guia entrenamiento y registro David Gmez.pdf](../PDF/referencias-entrenador/Guia%20entrenamiento%20y%20registro%20David%20Gmez.pdf): 4 páginas. Chequeo previo, indicaciones, escalas, prioridades y convivencia con K-1.
- [Guia de ejercicios David Gomez.pdf](../PDF/referencias-entrenador/Guia%20de%20ejercicios%20David%20Gomez.pdf): 19 páginas. Ejecución, errores, circuitos, cardio y registro al terminar.

Los documentos se extrajeron a `PDF/referencias-entrenador/` para que Claude pueda consultarlos localmente. Son referencias personales: no se incorporan a Git, fixtures, cuentas de demostración ni servicios externos. El ZIP original permanece intacto. Se extrajo el texto de las 31 páginas y se inspeccionaron visualmente las tablas relevantes de chequeo, prioridades, cardio, progresión y registro final.

El ZIP inicialmente indicado, `drive-download-20260923T223511Z-1-001.zip`, contiene seis imágenes de logotipos y ningún PDF. No sirve de fuente para los puntos anatómicos.

## Qué aportan a la valoración corporal

La rutina, página 1, identifica un resultado de grasa corporal como estimado por plicometría y menciona el perímetro abdominal como dato de seguimiento. **No se ha encontrado una ficha con las zonas de pliegues, lecturas en mm, perímetros completos ni resultados desglosados de la báscula de bioimpedancia.** No se puede deducir de estos tres PDF qué protocolo antropométrico utilizó el entrenador.

Consecuencia para el plan: mantener una plantilla configurable de zonas/unidades/lateralidad. Permitir que el entrenador registre un porcentaje que ya haya calculado, identificando método y fecha; no inventar las lecturas originales ni una fórmula para reconstruirlo. La batería de cinco pruebas físicas se toma del mensaje de David, no de una ficha hallada en estos documentos.

## Lo que ya tiene soporte y conviene reutilizar

| Necesidad de los PDF                               | Evidencia en la app                                                 | Alcance de la comprobación                                                                                                                                          |
| -------------------------------------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Peso, pasos, sueño y cintura                       | `seguimiento.ts`, `hoy-inicio.tsx`, `progreso.tsx`, `modelo.ts`     | Hay registro y evolución; C03 del plan revisa el acceso a cintura desde Inicio. El sueño actual registra duración, no calidad.                                      |
| Series, cargas, rangos de repeticiones y RIR       | `entrenamiento.ts`, `tabla-series.tsx`                              | Hay prescripción y registro; C02 revisará la corrección de RIR de una serie ya hecha.                                                                               |
| Calibración inicial                                | Campo `calibrar` de prescripción                                    | Existe el contrato; revisar su recorrido antes de proponer otro sistema.                                                                                            |
| Calentamiento, circuito, vueltas, descanso y final | `CamposSesionAmpliada`, secciones de sesión                         | Ya hay estructura; no crear otra sesión paralela para core.                                                                                                         |
| Esfuerzo global al terminar y energía final        | `CierreSchema`                                                      | Existen RPE 0–10, energía 1–5 y sensación de incomodidad.                                                                                                           |
| Molestias con zona, intensidad y ejercicio         | `molestias.ts` y pantalla de molestia                               | Existe registro, aviso y respuesta profesional. No añadir un segundo formulario equivalente.                                                                        |
| Otros deportes, objetivos y fases del bloque       | `BloqueSchema`, `DeporteDelPlanSchema`, `plan/bloque.tsx`           | Describen lo programado; no equivalen a registrar lo realizado en cada clase de K-1.                                                                                |
| Doble progresión                                   | Prescripción con rango, RIR y subida; propuestas para el entrenador | Mantener la decisión en el panel profesional según lo aprobado con David. Las instrucciones del PDF no autorizan progresiones automáticas en la cuenta del cliente. |
| Indicaciones técnicas y errores                    | Catálogo y campos de técnica/notas                                  | Hay soporte de contenido; falta comprobar cobertura de cada ejercicio de la rutina, no construir otra biblioteca.                                                   |
| Pautas de alimentación y suplementos               | Dieta y pauta profesional publicadas                                | Se pueden mostrar como contenido del profesional. No convertir ejemplos de una persona en valores por defecto de todos los clientes.                                |

Esta tabla describe soporte encontrado en código, no certifica que la cuenta actual tenga todos esos datos correctamente cargados. El acceso visual a esa cuenta sigue pendiente.

## Diferencias revisadas y decisión de alcance

| ID                                                   | Diferencia comprobada                                                                                                                                                   | Fuente                                                                         | Propuesta y decisión                                                                                                                                                                                                                       |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **D01 · Distancia en ejercicios**                    | Las series actuales admiten repeticiones o segundos, no metros. El farmer carry aparece pautado en metros.                                                              | Rutina p. 7; guía de ejercicios p. 16–17; `SeriePrescritaSchema`               | Añadir distancia (m) conservando la carga cuando corresponda. El cliente registra metros sin introducirlos falsamente como repeticiones. La lectura de series antiguas permanece válida.                                                   |
| **D02 · Cardio realizado**                           | Puede indicarse tiempo y escribir notas, pero no existe un registro estructurado de velocidad, inclinación y RPE del tramo de cardio.                                   | Rutina p. 3; guía de registro p. 4; guía de ejercicios p. 19; `RegistroSchema` | Mostrar únicamente los campos pautados por el entrenador: tiempo, velocidad km/h, inclinación % y esfuerzo. Objetivo y resultado se distinguen; no obliga a introducirlos cuando no hay cardio.                                            |
| **D03 · K-1 realmente hecho — excluido**             | El plan guarda días y minutos previstos de otro deporte, pero no fecha, duración e intensidad reales ni el orden respecto a fuerza.                                     | Guía de registro p. 1, 2 y 4; guía de ejercicios p. 19; `DeporteDelPlanSchema` | Registro breve de actividad complementaria pautada: fecha, duración, esfuerzo y antes/después si coincide. Visible para el entrenador en la semana; sin añadir otra pestaña.                                                               |
| **D04 · Chequeo previo configurable**                | Actualmente solo pregunta sensación general y nada/agujetas/dolor. Los PDF piden también calidad del sueño, motivación y agujetas por zona.                             | Guía de registro p. 2; `CheckinSchema`                                         | Ampliación opcional elegida por el entrenador. Reutilizar las horas dormidas ya registradas y evitar duplicarlas. Dos o tres preguntas visibles normalmente; abrir zonas solo cuando proceda. No imponer el cuestionario completo a todos. |
| **D05 · Resumen de recuperación para el entrenador** | Hay datos y comentarios separados, pero no un resumen específico que reúna rendimiento, sueño, agujetas persistentes y deporte complementario para revisar la semana.   | Rutina p. 8; guía de ejercicios p. 19                                          | Resumen profesional basado en datos disponibles, sin diagnósticos ni ajustes automáticos. Una señal incompleta se indica como tal; el entrenador decide el cambio y publica la nueva pauta.                                                |
| **D06 · Prioridades cuando falta tiempo**            | Hay secciones y se pueden omitir series, pero no una prioridad explícita por bloque ni motivo de omisión específico por falta de tiempo.                                | Guía de registro p. 2; `CamposSesionAmpliada`, `RegistroSchema`                | Permitir al entrenador señalar las prioridades y al cliente comunicar falta de tiempo/omisión. La app no elimina trabajo por su cuenta. Reutilizar las notas existentes como complemento a la prioridad profesional.                       |
| **D07 · Descarga aplicada a la prescripción**        | Las fases del bloque contienen nombre/detalle; no son una regla estructurada que genere series y RIR diferentes en cada fase. El profesional puede editar las sesiones. | Rutina p. 8; `FaseDeBloqueSchema`, asignación de plan                          | Vista previa profesional de los cambios por fase y confirmación explícita «Aplicar y publicar». Nunca modificar sesiones enviadas ni interpretar porcentajes del PDF como reglas globales.                                                 |

**Orden acordado para planificar:** resolver primero el registro de metros y cardio (D01 y D02), después el chequeo breve (D04) y el resumen que reutiliza esos datos (D05). Completar las prioridades (D06) y la aplicación profesional de fases (D07) antes de la revisión integrada. D03 queda excluido; el resumen de recuperación no dependerá de un nuevo registro de K-1.

La consulta enviada a David proponía **registro de metros/cardio (D01+D02), K-1 (D03) y chequeo previo breve (D04)** y ofrecía incluir todas las propuestas. Su respuesta fue **«todo menos k1»**. El plan incluye D01, D02, D04, D05, D06 y D07. D03 no se desarrolla y no se añade al chequeo por otra vía. No se borra el historial de deportes ya existente.

## Relación con el PDF de pantallas del proyecto

Se consultó además `PDF/ALPHA Y OMEGA.pdf` (10 páginas), que es un diseño anterior y no una ficha de mediciones. La página 9 muestra categorías de bioimpedancia y plicómetro, fotos por registro y selección de un punto de la gráfica. El plan de valoración cubrirá ese recorrido; la gráfica actual dibuja puntos sin selección.

La página 10 contiene opciones de perfil (modo claro/oscuro, notificaciones, sesiones descargadas, privacidad) que no aparecen como esos accesos en `app/perfil.tsx`. La app sí tiene recuperación de contraseña y copias de entrenamiento sin conexión, por lo que la ausencia de un acceso en Perfil no implica ausencia de la capacidad completa. La página 5 muestra controles dedicados de velocidad de vídeo; la animación actual tiene bucle y pausa, pero no esos controles.

Estas diferencias del diseño anterior se anotan como contexto, **fuera de D01–D07 y fuera de esta ampliación**, para evitar reintroducir controles que contradigan la simplificación acordada. No se propone cambiar el tema, las pestañas o la navegación solo por aparecer en una maqueta.

## Decisiones y condiciones para Claude

- [x] David decide qué D01–D07 se incorporan. 24-09-2026: «todo menos k1». Alcance incluido y excluido detallado arriba.
- [ ] El entrenador configura los puntos exactos de pliegues y perímetros, o aporta su ficha de valoración. Hasta entonces no hay un protocolo concreto aprobado.
- [ ] El equipo identifica la báscula y qué métricas usa, si quiere una plantilla ya rellenada. El registro manual configurable puede planificarse sin esa marca.
- [ ] Verificar que la técnica de los ejercicios de la rutina esté disponible en el catálogo. Los PDF son contenido de referencia, no instrucciones para importar datos personales automáticamente.

Preparar esta comparación no prescribe ejercicio ni cambia la rutina del cliente. Las recomendaciones clínicas y deportivas de los documentos se atribuyen a su autor y no se convierten en reglas nuevas del producto.
