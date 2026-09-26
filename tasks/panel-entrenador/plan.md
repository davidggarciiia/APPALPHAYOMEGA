# Plan: panel del entrenador completo

> Aprobado por David el 2026-09-26 en su sesión con Claude, y ampliado ese mismo
> día con los documentos del servicio real. Tareas en [todo.md](todo.md).
> Diseño: [docs/diseno/panel-entrenador.md](../../docs/diseno/panel-entrenador.md)
> y [prototipo](../../docs/diseno/prototipo-entrenador.html). Decisiones: la
> [intención](../../docs/intent/app-alpha-omega.md), apartado del 2026-09-26.

## Resultado

El entrenador hace en la app todo lo que hoy hace en papel: prepara el bloque con
sus fases, prescribe cada día, asigna, sigue lo que hace cada cliente, ve cómo
llega (check-in) y qué le molesta, ajusta con ayuda de la progresión sugerida,
escribe su guía y su pauta nutricional, y puede seguir entregando un PDF.

## Punto de partida

La rama `dev` reúne las ramas paralelas del 18 al 26 de septiembre:

- API completa de catálogo, fechas de agenda y entrenamiento: asignar planes,
  panel semanal, resultados, ajustes, anular y rutinas guardadas.
- Lado cliente: semana, registro sin conexión, borrador cifrado y envío.
- CI, tests móviles, renovación de sesión, animaciones y el logo en SVG.
- El export de Claude Design (17 pantallas) y su auditoría de accesibilidad.
- El sistema visual de Claude Design ya aplicado al lado cliente (tokens,
  fuentes, degradados y `src/componentes/diseno.tsx`), hecho por otra sesión.

No existe ninguna pantalla de entrenos del entrenador.

## Decisiones

| Tema            | Decisión                                                                                                                                                    |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Alcance         | Toda la app del entrenador; se digitaliza el servicio completo                                                                                              |
| Reparto         | Esta sesión, de punta a punta, API incluida                                                                                                                 |
| Rama            | Todo sale de `dev`; cada fase se entrega con un PR contra `dev`                                                                                             |
| Plataforma      | La misma app Expo: barra lateral desde 1024 px de ancho, pestañas en el teléfono                                                                            |
| Estilo          | El de Claude Design en toda la app                                                                                                                          |
| Orden           | Entrenos primero; horarios (H05–H17) después, dentro de la navegación nueva                                                                                 |
| Entra           | Prescripción rica, fases y progresión sugerida, check-in completo, molestias, cierre, guía y reglas, técnica por ejercicio, pauta nutricional, exportar PDF |
| Fuera por ahora | Mensajes y comentarios, push, cronómetro de descanso                                                                                                        |
| Privacidad      | Los documentos reales no entran en el repositorio; prototipo y pruebas con datos inventados                                                                 |

## Fases

| Fase | Entrega                                                                   | Revisión de David                         |
| ---- | ------------------------------------------------------------------------- | ----------------------------------------- |
| 0    | Rama `dev` integrada y verde                                              | Hecha                                     |
| 1    | Documento de diseño, prototipo, enmiendas de spec y este plan             | **Checkpoint A**: prototipo y enmiendas   |
| 2    | Sistema visual, componentes base y navegación adaptable                   | Checkpoint B: navegación y estilo         |
| 3    | Pantallas del entrenador sobre la API que ya existe                       | Checkpoint C: recorrido completo          |
| 4    | Prescripción rica, catálogo ampliado, fases, progresión, señales, guía    | Requiere el checkpoint A                  |
| 5    | Check-in, molestias y cierre; pauta nutricional; exportar PDF             | Checkpoint D: servicio completo           |
| 6    | Horarios y reservas (H05–H17), con sus pestañas en la navegación nueva    | Requiere que David revise sus specs (H00) |
| 7    | `seguimiento-corporal`, nutrición del nutricionista, `leads` y `fichajes` | Cada uno: entrevista, spec y plan antes   |

Las fases 2 y 3 pueden empezar cuando David apruebe el prototipo. Las 4 y 5
esperan también a la aprobación de las enmiendas de spec.

## Cómo se construye

**Navegación.** Grupo `app/(entrenador)/` con `Tabs` de Expo Router y
`tabBarPosition: "left"` desde 1024 px. Stacks anidados para ficha, constructor y
asignar. Las pantallas actuales de cartera, ficha de cuenta y nutricionista se
mueven al grupo. El `Enrutador` manda al entrenador a `/hoy`. `app.json` pasa a
`supportsTablet: true`.

**Estilo.** Tokens nuevos en `src/tema.ts`, fuentes Anton y Archivo con
`@expo-google-fonts/*`, y degradado con `experimental_backgroundImage` de
RN 0.86 si funciona en web y nativo, o `expo-linear-gradient` si no. Componentes
base en `src/componentes/`. Se reutilizan `Pulsable`, `Cabecera`, `Aviso`,
`Pastilla`, `CambiarDia` y `ResultadoSesion`.

**Datos.** Cada pantalla sigue el patrón de `cartera.tsx` y `semana.tsx` (fase,
`vigente`, `useFocusEffect`, `faltaDe`) con su `api.ts` sobre `pedirConSesion`.
El panel se refresca con un `useSondeo` que solo corre con la pantalla visible y
la app activa, cada 5 s.

**API.** Los cambios son aditivos. Las prescripciones guardadas siguen validando:
los campos nuevos son opcionales o tienen valor por defecto. Cada ruta nueva
tiene pruebas de denegación para los cuatro roles y la petición sin sesión. Las
operaciones del cliente que pueden repetirse llevan id de operación.

**Sin conexión.** El check-in, las molestias y el registro de deporte se
guardan primero en el teléfono y se envían en cola, como el borrador. La
recomendación del check-in se calcula en el teléfono con los umbrales
descargados con la sesión.

## Dependencias nuevas

Aprobadas con el plan: `@expo-google-fonts/anton`, `@expo-google-fonts/archivo`
y, si hace falta, `expo-linear-gradient`. Para exportar a PDF se propondrá
`expo-print` en su tarea. Todas en la versión que fije el SDK 57, con
`npx expo install`.

## Verificación

- Cada tarea: `npm run lint`, `npm run typecheck`, `npm test` y, si toca la API,
  `npm run test:e2e` contra Postgres. La CI corre en cada PR a `dev`.
- Recorrido en web con Playwright a 390 y 1440 px en cada checkpoint, con
  capturas.
- La prueba en un teléfono real queda para David y se apunta como pendiente.
  Ninguna prueba con dobles cuenta como prueba nativa.

## Riesgos

| Riesgo                                                           | Tratamiento                                                             |
| ---------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Alcance enorme con precio cerrado                                | Una fase por PR y checkpoint; la fase 7 no se programa sin spec         |
| La molestia en directo rompe la privacidad del borrador          | Excepción escrita en el spec y pruebas de que el borrador sigue privado |
| Web y nativo se comportan distinto (lateral, fuentes, degradado) | Se prueba en las dos antes de extenderlo                                |
| Otras sesiones siguen trabajando en sus ramas                    | Todo lo nuevo sale de `dev`                                             |
| Datos de salud sin consentimiento                                | Solo datos de prueba hasta las tareas 19 y 21 de `identity`             |
| La progresión sugiere mal si el registro es malo                 | El entrenador confirma y puede fijar la carga; nada se aplica solo      |
