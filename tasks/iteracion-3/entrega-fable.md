# Entrega de Fable — iteración 3

Encargo: [fable.md](fable.md) · Plan: [plan-fable.md](plan-fable.md).
Solo lo escribe Fable. Codex revisa e integra.

Desde el 24-09 este archivo vive solo en el worktree de Fable. La copia sin
seguimiento que dejé en la carpeta de Codex se trasladó aquí y se borró allí.

**Resumen para integrar (24-09):** el plan está completo en código y verificado
por HTTP; lo que falta es visual o físico (ver «F05 — Entrega para integración»,
al final). La rama `codex/fable-iteracion-3` está rebasada sobre
`codex/entrenamiento-iteracion-2` (`bb0af41`), sin push ni merge.

## F00 — Punto de partida (2026-09-23)

**Estado:** hecha.

| Dato                 | Valor                                                                                                                                                                                                                    |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Carpeta de Codex     | `APP-ALPHA_OMEGA`, rama `codex/entrenamiento-iteracion-2`, HEAD `947c9ef71f6d8d37b696607aefc0abfaf60860bf`                                                                                                               |
| Cambios ajenos vivos | Los cuatro archivos de color, `tasks/plan.md` y los planes de `tasks/iteracion-3/` en el índice; `PDF/` e informe `compass_artifact_wf-70bf2b7a-e848-599d-9874-13bf38e6c596_text_markdown.md` sin seguimiento en la raíz |
| Worktree antiguo     | `APP-ALPHA_OMEGA-fable`, rama `codex/fable-catalogo`, HEAD `e629673`, limpio y ya contenido en `947c9ef` (merge-base igual a su HEAD). No hay trabajo de Fable pendiente                                                 |
| Worktree nuevo       | `APP-ALPHA_OMEGA-fable-i3`, rama `codex/fable-iteracion-3`, creado por Codex en C00. Base `db477bf`, que incluye los planes y el tema de C01 (`ce5962d`, `13810bf`)                                                      |

He leído `plan.md`, `plan-fable.md`, `plan-codex.md`, `SPEC-catalogo-ejercicios.md`,
`docs/animaciones-ejercicios.md`, la matriz de roles de `SPEC-identity.md`, el ADR
0005 y todo el código de API, app y contratos.

Línea base medida sobre `947c9ef` con los cambios de color sin terminar:
`npm run typecheck` y `npm run lint` pasan; `npm test` da 76 tests de API y 91 del móvil,
todos en verde. No se ejecutaron los tests HTTP porque Docker está parado.

Límites confirmados: no toco tema, componentes comunes, sesión, `src/lib/`,
contratos, Prisma, dependencias ni lockfile. Mis archivos son los de la tabla
de reparto de `plan.md`.

### Dudas y peticiones a Codex

1. **C00:** resuelto; el worktree se creó en `db477bf`. Todavía no he arrancado
   servidores. Antes de hacerlo compruebo los puertos y usaré 3100 para la API
   y 8181 para Metro, distintos de los tuyos (3000 y 8081).
2. **Base de datos de pruebas:** ¿reutilizo `alpha_omega_fable` para los tests HTTP o hay otra?
3. **Hallazgos de la auditoría del 23-09 que caen en tu parte**, por si no están ya en tus tareas:
   - Cartera, ficha de cliente, alta, nutricionista y mis-clientes llaman a
     `src/lib/api.ts` con el token sin renovar. A los 15 minutos muestran
     «Tu sesión ha caducado».
   - El enlace de recuperación está fijo como `alphaomega://restablecer` en
     `recuperacion.service.ts:71`.
   - La API no configura `trust proxy`. Detrás de un proxy, la clave
     `login:origen:` bloquearía el login de todos los usuarios.
   - La pestaña del entrenador no tiene Inicio, y la pantalla Nutricionista queda
     inaccesible tras tocar otra pestaña.

## F01 — Figuras de ejercicios

**Estado:** hecha. Implementada en F02–F03b (abajo). No se ha comprado nada ni
se ha abierto ninguna cuenta.

### Decisiones de David (23 y 24-09)

1. Todo tiene que ser gratis.
2. Dentro de lo gratuito, prima la calidad de lo que ve el cliente. Que una
   comparativa la publique un competidor no cuenta.
3. RepDB queda descartado porque no le gusta su diseño plano. Su estilo
   «classic» y la animación del plan Standard sí le gustan, pero son de pago.
4. **Se combinan tres fuentes:**
   - las 50 animaciones gratuitas de **Vital**;
   - las 2 gratuitas de **MoveKit**;
   - **vídeos propios del entrenador** para el resto, en el hueco `video` de la ficha.

   David acepta que convivan dos muñecos distintos.

5. David autorizó descargar los paquetes de RepDB y de Vital para evaluarlos
   fuera del repositorio.

### Fuentes contrastadas

| Fuente                  | Qué trae gratis                                                                                  | Licencia verificada en la fuente oficial                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Resultado                       |
| ----------------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------- |
| **Vital, Free50**       | 50 animaciones 3D de gimnasio, con un maniquí vestido sobre fondo blanco                         | Página oficial del paquete gratuito y README de `github.com/exercisedb-pro/exercisedb-dataset`: «Free to use in your own projects under the same commercial license terms as the paid packages». En el EULA (versión 2026.1), el apartado 4 permite «Mobile applications», «Self-host the Assets on your own servers or CDN», «Store the Assets offline inside your application or system» y «Crop, resize, compress, transcode». El apartado 5 prohíbe redistribuir los archivos originales como producto independiente | **Elegida**                     |
| **MoveKit, muestra**    | 2 animaciones 3D con figura anatómica y músculo resaltado (dominadas y aperturas con mancuernas) | [Muestra](https://movekit.com/free-sample): «The sample is licensed, not sold, under the MoveKit License Agreement version 1.0, effective 2026-08-04, the same agreement that governs paid downloads». [Licencia](https://movekit.com/license), sección 3: «may display and stream the Content to end users»; prohíbe «provide end users with the ability to download, extract, or otherwise obtain the raw Content files». No menciona caché, dispositivo ni uso sin conexión                                           | **Elegida**, solo por streaming |
| RepDB Free              | 601 ejercicios con dos poses planas; el fundido da saltos en algunos                             | `LICENSE-DATA.md` v1.0: uso comercial dentro de la app con crédito visible; el material classic y el animado de `premium-samples/` es «evaluation-only»                                                                                                                                                                                                                                                                                                                                                                  | Descartada por diseño           |
| Everkinetic, ExerciseDB | Dibujos de líneas / GIF de 180p                                                                  | CC BY-SA 4.0 / según el informe `compass_...`, solo uso no comercial                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Descartadas                     |

**Una ambigüedad.** El apartado 3 del EULA de Vital condiciona la licencia al
pago («successful payment»). Lo que la extiende al paquete gratuito es la frase
oficial citada arriba. Hay que guardar copia de esa página y del EULA con fecha
junto a los archivos. Si David quiere eliminar cualquier duda antes de publicar,
basta un correo a Vital, pero es opcional.

### Paquetes evaluados

Ambos están fuera del repositorio, en `%LOCALAPPDATA%\Temp`.

| Archivo                                   | Origen                                                  | SHA-256                                                            | Contenido                                                                                                                                                                                                        |
| ----------------------------------------- | ------------------------------------------------------- | ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `vital-free-pack-20260924.zip` (282 MB)   | `https://vitalanimations.com/VitalAnimations.zip`       | `96a318fcb120a250c1d7c188f9de83f12d099d15e9b3ee3a87b6dd40fe10913b` | `Free50/`: 50 MP4 (ids 0051–0100) y `50gymworkouts.json`, con nombre, parte del cuerpo, músculos, equipo e instrucciones en inglés. `Character Samples/`: clips de otras categorías. No trae archivo de licencia |
| `alpha-omega-movekit-sample-20260918.zip` | `https://movekit.com/downloads/movekit-free-sample.zip` | `ad7f314b37ebe09dafd21e1cd2fd548778635f1afbcb43851cbde105181320ca` | 2 MP4, pósteres PNG, JSON, CSV y `LICENSE.txt`                                                                                                                                                                   |

**Formato de los clips:**

- **Vital:** H.264 de 1080×1080 a 30 fps, de 3,5 a 6,2 s, **con pista de audio
  AAC**. Pesa 203,6 MB en total.
- **MoveKit:** H.264 de 1936×1072 a 30 fps, sin audio.

**Prueba de codificación para el móvil:** 720p, H.264 Main, CRF 26, `faststart` y
sin audio. Ocupa entre 140 y 370 KB por clip:

| Clip                             | Original | 720p   |
| -------------------------------- | -------- | ------ |
| Vital 0054, sentadilla con barra | 3,3 MB   | 256 KB |
| Vital 0087, press Arnold         | 1,7 MB   | 139 KB |
| MoveKit, dominadas               | 3,2 MB   | 215 KB |
| MoveKit, aperturas               | 4,8 MB   | 370 KB |

Las 52 animaciones cabrían en unos 10–15 MB. Las pruebas están en
`%LOCALAPPDATA%\Temp\ao-vital` y `ao-muestra`.

**Qué cubre Vital Free50:**

- Piernas: sentadillas, búlgaras, zancadas, peso muerto rumano, hip thrust,
  prensa, extensión y curl femoral.
- Hombros: press militar, Arnold, elevaciones y pájaros.
- Tríceps en polea, contractor de pecho y máquinas de cardio.

**Qué no cubre ni Vital ni MoveKit:** press de banca, remos, curl de bíceps y
abdominales. Esos ejercicios quedan sin figura, con la ficha diciendo que no hay
vídeo, hasta que el entrenador grabe los suyos.

### Muestra propuesta para el recorrido de extremo a extremo

Un clip de cada fuente, para probar las dos licencias con el mismo contrato y el
mismo reproductor:

| Catálogo             | Fuente e id        | Grupos (vocabulario cerrado)                                                      | Serie de la prueba | Sin conexión                                   |
| -------------------- | ------------------ | --------------------------------------------------------------------------------- | ------------------ | ---------------------------------------------- |
| Sentadilla con barra | Vital `0054`       | Principal `cuadriceps`, secundario `gluteos`                                      | Repeticiones       | Sí, lo permite el EULA                         |
| Dominadas            | MoveKit `pull-ups` | Principal `espalda`, secundario `biceps`; el trapecio no existe en el vocabulario | Repeticiones       | No: solo streaming hasta que MoveKit lo aclare |

**Cómo se asocian a los ejercicios del catálogo:**

- El vínculo se guarda como fuente más id externo (`vital` + `0054`). Nunca se
  deduce del nombre en inglés.
- Lo elige el entrenador en el formulario del ejercicio, viendo el clip antes de
  guardar.
- Los ids reales de la base demo se comprueban en C05; ahora no se pudo porque
  Docker estaba parado.
- Los nombres de los clips se traducen en nuestro índice de medios, no en los
  archivos originales.

### Propuesta de contrato para C05 (lo decide y publica Codex)

`video` sigue siendo `null` hasta que existan los vídeos propios. Sustituye
`figura: z.null()` por:

```ts
export const FiguraSchema = z.strictObject({
  url: z.url(), // entrega autorizada; nunca la ruta interna de almacenamiento
  poster: z.url().nullable(),
  version: z.string().min(1), // cambia al sustituir el archivo e invalida cachés
  origen: z.enum(["propio", "licenciado", "provisional"]),
  licencia: z.string(), // "Vital Animations EULA 2026.1", "MoveKit License Agreement v1.0"
  sinConexion: z.boolean(), // la licencia permite guardar copia en el dispositivo
})
// EjercicioSchema: figura: FiguraSchema.nullable(), video: z.null()
```

`sinConexion` sale de la licencia de cada fuente y no se decide en la pantalla.
Con Vital es `true`; con MoveKit, `false`.

**Entrega del archivo, a decidir en C05:**

- **Mi propuesta:** el servidor guarda solo los clips transcodificados que usa el
  catálogo. Los sirve un endpoint autenticado, `GET /ejercicios/:id/figura`, con
  los roles del catálogo (cliente y entrenador). No hay URL pública, y el
  nutricionista y el empleado no tienen acceso.
- **Reproductor:** el móvil manda el `Bearer` en `headers`, que
  [`VideoSourceObject` de expo-video SDK 57](https://docs.expo.dev/versions/v57.0.0/sdk/video/)
  admite. Esa página confirma que expo-video funciona en Android, iOS y web, y
  que viene incluido en Expo Go. Es una dependencia nueva y la instala Codex.
- **Con almacenamiento de objetos:** una URL firmada, como en el ADR 0005.
- **Ya no hace falta `expo-image`:** todas las fuentes son MP4, así que un solo
  reproductor sirve para todo.

**Pausar y silenciar:**

- expo-video no pausa solo al salir de la pantalla; hay que hacerlo con los
  eventos del foco.
- Los clips de Vital llevan pista de audio: se elimina al transcodificar y además
  el reproductor va con `muted`.

### Uso sin conexión (F04)

- **Vital:** el EULA permite guardar los clips dentro de la app, así que F04 se
  puede hacer con Vital.
- **Caché de expo-video:** la documentación dice que «the cache functions
  offline», pero también que «the system can clear the cache». Para garantizar
  el uso sin conexión hace falta almacenamiento propio, y eso lo decide C05.
- **MoveKit:** se queda en streaming, sin `useCaching`, hasta que MoveKit
  confirme por escrito que permite copias en el dispositivo. Esa consulta la
  haría David.

### Pendiente

- C05 lo hizo Fable por encargo de David (ver F02–F04); Codex lo revisa.
- Asociar las figuras a los ejercicios de la base demo lo hace el entrenador
  desde la ficha; no se ha tocado la base demo.
- Guardar copia con fecha de la página del paquete gratuito y del EULA de Vital
  junto a los archivos importados.
- `docs/animaciones-ejercicios.md` recoge la decisión y cómo importar.

## F06 — Especificación de nutrición

**Estado:** hecha. [SPEC-nutricion.md](../../SPEC-nutricion.md) fue **aprobada por David el 24-09**
junto con los cinco supuestos. En la revisión se añadieron dos decisiones:

- **Solo objetivos:** un cliente sin dieta contratada recibe únicamente kcal y
  macros, sin comidas.
- **Datos reales:** se usan los datos que escriba el profesional. David asume el
  riesgo de que el consentimiento siga aplazado; la dieta se trata igualmente
  como sensible.

**Cómo se hizo:** con `spec-driven-development`, en dos rondas de preguntas a
David el 24-09. Las referencias fueron el prototipo v2 (tipos de día, comidas
con alternativas y anillo de macros) y una dieta real en PDF que aportó David.
Esa dieta es de una clienta real: solo se usó para entender el formato, no se
copió al repositorio y los ejemplos de la especificación son inventados.

**Decisiones de David:**

1. La semana se organiza por tipos de día.
2. Cada comida tiene alternativas agrupadas o una tabla de intercambio, como en el PDF.
3. Las kcal y los macros los escribe el profesional.
4. Las cantidades son texto libre.
5. El profesional trabaja en borrador y el cliente ve la dieta al publicarla.
6. Las dietas anteriores solo las ve el profesional.
7. Cada dieta se prepara desde cero.
8. El cliente la lee sin conexión.

**Supuestos confirmados:**

- los números son opcionales;
- con un solo tipo de día, todos los días son iguales;
- la hora de cada comida es opcional;
- el borrador pertenece al cliente, no a quien lo empezó;
- cada alternativa puede llevar una nota y, si se quiere, sus macros.

**Qué necesitará de Codex en F07/C09:**

- el contrato Zod `packages/shared/src/nutricion.ts` (la especificación incluye una propuesta);
- el modelo y la migración aditiva;
- registrar `NutricionModule` en `app.module.ts`;
- los accesos: pestaña del cliente, botón en la ficha y fila en «Mis clientes».

## F07 — Plan y tareas de nutrición

**Estado:** plan escrito en [tasks/nutricion/plan.md](../nutricion/plan.md) y
tareas en [tasks/nutricion/todo.md](../nutricion/todo.md). **Aprobado por David el
24-09.** Implementado entero (ver «Nutrición N00–N12»), N00 y N11 incluidos por
encargo de David.

**Cómo se hizo:** con `planning-and-task-breakdown`. Hay 13 tareas (N00–N12) en
tramos verticales:

1. API completa: N01–N03.
2. Dieta solo de objetivos de principio a fin: N04–N05b.
3. Alternativas, intercambio e indicaciones: N06–N08.
4. Histórico y uso sin conexión: N09–N10.
5. Recorrido final: N12.

**Qué pido a Codex (C09 y N11):**

- **N00:** el contrato Zod, el modelo `Dieta`, la migración con dos índices únicos
  parciales y el esqueleto `nutricion.module.ts` registrado en `AppModule`. La
  propuesta completa está en `plan.md`.
- **N11:** que `_layout.tsx` deje abrir `/nutricion` sin conexión (`fase: "local"`),
  que hoy solo permite `/entrenamiento`. Además, la pestaña «Dieta» del cliente, el
  botón en la ficha y las filas de «Mis clientes».

**Decisiones de David en la revisión:**

1. Habrá botones para duplicar dentro de la misma dieta (tipo de día, comida y
   alternativa).
2. El entrenador y el nutricionista pueden preparar y publicar la dieta del
   mismo cliente.

## F08 — Diseño de las vistas de entrenamiento

**Estado:** código hecho en `393df77` (antes `dc2b428`). Con Docker ya en marcha,
el borrador y el resultado se comprobaron por HTTP (F09). **Falta la revisión
visual**, que requiere iniciar sesión en la app: queda en el guion para David.

**Qué cambia:** solo `agenda-semanal.tsx`, `tabla-series.tsx`,
`registro-cliente.tsx` y `resultado.tsx`, con los tokens de C01 y siguiendo
`Alpha Omega App v2.dc.html`:

| Elemento          | Antes (monocromo)            | Ahora (referencia v2)                                                                                                                                |
| ----------------- | ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Día elegido       | Fondo `acento`               | Fondo `texto` (negro) y letra clara                                                                                                                  |
| Punto del día     | Carácter «●»                 | Barra de 22×4: `exito` si todo está enviado, `boton` si queda algo pendiente                                                                         |
| Foto de la sesión | Filtro de escala de grises   | En color                                                                                                                                             |
| «Hoy · …»         | Gris                         | `acento` en mayúsculas                                                                                                                               |
| Botón principal   | `acento`, 17 px              | `boton`, 19 px en negrita: texto grande WCAG, por encima de 3:1 como `BotonPrincipal`                                                                |
| Serie hecha       | Fila `fondo`                 | Fila `exitoSuave`; la marca pasa a `exito`; los campos a `suave`                                                                                     |
| Progreso          | Negro                        | `boton`                                                                                                                                              |
| Resultado enviado | Círculo de 72 px en `acento` | Círculo de 90 px en `boton`, título en mayúsculas y dos cifras reales: series hechas y fecha y hora de envío. «Hecho» en `exito` y «Omitida» en gris |

**Qué no cambia:** comportamiento, datos, etiquetas accesibles ni la lógica de
registro de Codex. No se ha inventado ninguna cifra; la duración que muestra el
prototipo se omite porque la API no la tiene.

**Verificación:** `npm run typecheck`, `npm run lint` y
`npm run test --workspace apps/mobile -- --runInBand` (17 suites, 91 tests) pasan
en la copia de Fable.

**Pendiente:**

- Revisión visual a 320, 390, 768 y 1440 px con la API real.
- Guardar y reabrir un borrador sintético.
- Consultar un resultado ya enviado.

El guion está en [pruebas-entrenamiento-fable.md](pruebas-entrenamiento-fable.md).

**Referencia nueva sin aplicar:** en la carpeta de Codex apareció
`Alpha & Omega · Pantallas con el plan.html` (sin seguimiento). Tiene 14 pantallas
(cliente: inicio, añadir deporte, check-in, sesión en curso, técnica del ejercicio,
registrar molestia, cierre de sesión, plan, guía, nutrición y progreso; entrenador:
ficha y constructor de planes; nutricionista: ficha) con un estilo oscuro distinto
de la v2. F08 sigue la v2 que marca el plan, y varias de esas pantallas describen
funciones que no están en ningún plan. Si David quiere que sea la nueva
referencia, hay que decidirlo antes de rehacer vistas.

## F02–F04 — Figuras en la app

**Estado:** hecho y probado por HTTP y en componentes. Falta la prueba física
sin conexión (F04, en el guion de F10).

| Commit    | Qué                                                                                                                                                                              |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `db1738e` | **C05 (zona de Codex):** tabla `contenidos_de_ejercicio` (una figura y un vídeo por ejercicio, clave del índice, origen y licencia), con una reversión que no borra asociaciones |
| `1975a54` | **F02:** contrato `figura` (zona de Codex), índice de 52 medios, importador con ffmpeg a `MEDIOS_DIR` y las rutas de medios, asignación, vídeo y póster                          |
| `bfadf2b` | `expo-video` 57.0.4 con `npx expo install` (package.json, lockfile y app.json: zona de Codex). Un paquete MIT sin dependencias nuevas                                            |
| `5e6b81f` | **F03:** reproductor y selector del entrenador en la ficha                                                                                                                       |
| `0172761` | **F03b:** «Ver técnica» en el registro del cliente, con la ficha guardada para verla sin red                                                                                     |
| `78fe623` | Documentación y `MEDIOS_DIR` en `.env.example` (zona común)                                                                                                                      |
| `9e3600f` | Tipado de la prueba e2e para el typecheck del monorepo                                                                                                                           |

**Decisiones de diseño:**

- Los MP4 no entran en el repo: el EULA de Vital prohíbe redistribuirlos. La API
  sirve solo medios del índice, por id de ejercicio y tras comprobar el rol;
  nunca una URL ni una ruta que venga de fuera.
- En Android e iOS el reproductor lleva la cabecera `Authorization` y caché solo
  para Vital. En web `expo-video` no admite cabeceras: se descarga con `fetch` y se
  reproduce un blob que se libera al salir.
- La versión del medio va en la dirección, así que cambiar de figura invalida la
  caché del móvil.
- El clip va en bucle, silenciado y con botón de pausa (WCAG 2.2.2). Si el
  sistema pide menos movimiento, empieza parado. Se para al salir de la pantalla.
- **Sin conexión:** se usa la caché del reproductor, que el sistema puede vaciar.
  No hay almacenamiento propio garantizado, y la app y la documentación lo dicen
  así. Si David quiere garantía, es una tarea aparte.

**Verificación:** 12 pruebas HTTP de figuras y 4 unitarias del índice; 10 del
reproductor, 7 del selector y 5 de «Ver técnica». Contra la API real con los 52
clips: 11 de 11 comprobaciones (vídeo de 256 KB, rangos 206, póster y
denegaciones). Los bundles web y Android compilan.

## Nutrición N00–N12

**Estado:** implementada entera. Falta la revisión visual de David (checkpoints 2
y 3 del plan) y la prueba en dispositivo del modo sin conexión.

| Commit    | Tareas                                                                                                                                                                                            |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `84ae10f` | **N00 (zona de Codex):** contrato, modelo `Dieta`, migración con CHECK y reversión. Sin índices parciales (Prisma los ve como deriva): la unicidad la garantiza un bloqueo de la fila del cliente |
| `ed2052e` | N01–N03: borrador, publicación idempotente, descarte, vigente e histórico                                                                                                                         |
| `0cb121c` | N04–N09: vista del cliente (Hoy y Semana), editor con alternativas, intercambio, indicaciones y duplicados, panel del profesional e histórico                                                     |
| `d21e9b0` | N10 y **N11 (zona de Codex):** copia cifrada sin conexión, pestaña «Dieta», botón en la ficha y filas de «Mis clientes»                                                                           |
| `50fd8de` | Correos en minúsculas en las cuentas de prueba                                                                                                                                                    |
| `6c6918a` | N12: recorrido HTTP reproducible (`tasks/iteracion-3/recorrido-n12.mjs`)                                                                                                                          |

**N12, trazado de los 15 criterios de la spec:**

| Criterio                                     | Prueba                                                                 |
| -------------------------------------------- | ---------------------------------------------------------------------- |
| 1 Borrador invisible para el cliente         | e2e «el cliente no ve el borrador y sí la dieta…»; recorrido           |
| 2 Publicar y archivar                        | e2e «una segunda publicación archiva la primera»; histórico; recorrido |
| 3 El cliente B no ve al A                    | e2e de permisos; recorrido (403 en dieta, borrador e histórico)        |
| 4 El cliente no escribe                      | e2e de permisos; recorrido                                             |
| 5 Nutricionista con y sin asignación, y baja | e2e «pierde el acceso al retirarle la asignación»; recorrido           |
| 6 Empleado y sin sesión                      | e2e; recorrido (403 y 401 en las seis rutas)                           |
| 7 Revisión obsoleta                          | e2e del borrador; recorrido                                            |
| 8 Publicación idempotente                    | e2e, incluida la carrera; recorrido                                    |
| 9 «Hoy» en Madrid de domingo a lunes         | `vista-dieta.spec.tsx`                                                 |
| 10 Números opcionales y límites              | pruebas del contrato; recorrido                                        |
| 11 Cantidades en texto libre                 | contrato; `vista-dieta.spec.tsx`; recorrido                            |
| 12 Sin conexión y cambio de cuenta           | `vista-dieta.spec.tsx` (copia y aviso); **dispositivo pendiente**      |
| 13 Baja y pendiente                          | e2e del borrador; recorrido (histórico conservado)                     |
| 14 Nada de la dieta en los registros         | recorrido con marcador único: 0 apariciones en el registro de la API   |
| 15 Solo objetivos                            | contrato; editor; recorrido                                            |

Recorrido N12 contra la API real (24-09, puerto 3101): **28 de 28 pasos** y
limpieza completa.

## F09 y F10 — Pruebas de entrenamiento

Detalle en [pruebas-entrenamiento-fable.md](pruebas-entrenamiento-fable.md).

- **F09:** recorrido HTTP de catálogo, rutinas, planes, agenda, registro y
  resultados con cuentas sintéticas: **29 de 29**, reproducible con
  `tasks/iteracion-3/recorrido-f09.mjs`. Sin defectos en catálogo, rutinas ni
  resultados. La revisión en pantalla queda en el guion para David.
- **F10:** sin dispositivo en esta sesión. El guion para Android e iOS está
  preparado; no se sustituye por una prueba web.

## F05 — Entrega para integración

**Rama:** `codex/fable-iteracion-3`, 22 commits sobre `bb0af41`. SHA previo al
rebase: `0107015`.

**Verificación en el estado integrado (24-09):**

| Comando                                       | Resultado                                 |
| --------------------------------------------- | ----------------------------------------- |
| `npm run typecheck`                           | OK                                        |
| `npm run lint`                                | OK                                        |
| `npm test`                                    | API 14 suites / 89; móvil 24 suites / 136 |
| `npm run test:e2e`                            | 25 suites / 289                           |
| `prisma migrate diff` (esquema frente a base) | Sin diferencias                           |

**Commits en zona de Codex, para revisar:** `84ae10f` (contrato, modelo y
migración de nutrición), `d21e9b0` (`_layout.tsx`, `armazon.tsx`, ficha del
cliente y «Mis clientes»), `0a2bd82` (`direccion-api.ts`: puerto de desarrollo
configurable), `db1738e` y `1975a54` (Prisma y contrato de figuras), `bfadf2b`
(dependencia) y `78fe623` (`.env.example`). David pidió cerrar el plan entero,
incluidas estas piezas.

**Para Codex:**

1. `carrera-refresco.e2e-spec.ts` falló una vez con toda la suite e2e en marcha
   y aislado pasa 3 de 3. Parece intermitente bajo carga.
2. Las migraciones `20260924010000_nutricion` y `20260924020000_figuras_de_ejercicio`
   solo se han aplicado en `alpha_omega_fable_i3`. La base demo no se ha tocado.
3. Para tener figuras hay que importar los clips a un `MEDIOS_DIR` privado
   (`docs/animaciones-ejercicios.md`). Sin él, el catálogo funciona sin figuras.

**Entorno que dejo en marcha** (procesos míos, se pueden cerrar): la API antigua
en el 3100, la nueva en el 3101, Metro web en el 8181 y un servidor estático en
el 8765. No pude pararlos porque el sistema de permisos lo denegó.

**Pendiente, con dueño:**

| Qué                                                                  | Dueño                      |
| -------------------------------------------------------------------- | -------------------------- |
| Revisión visual de F08, figuras y nutrición (guion)                  | David                      |
| Prueba física en Android e iOS: F10, F04 y criterio 12 de nutrición  | David, con el guion        |
| Revisión de los commits en su zona e integración (C07)               | Codex                      |
| ~~Decidir si `Pantallas con el plan.html` pasa a ser la referencia~~ | Resuelto: ver abajo        |
| Almacenamiento propio si hace falta garantía sin conexión en figuras | David decide; tarea aparte |
| Pregunta abierta de la spec: adjuntar el PDF de la dieta             | David                      |

## Diseño nuevo (Design.html, 24-09)

David aportó `Design.html` (17 pantallas: 14 del cliente a 390 px y 3 del
profesional a 1440 px) y pidió adaptarlo a la app sin más preguntas. Sustituye
a la referencia v2 que seguía F08. El archivo no entra en el repositorio.

| Commit    | Qué                                                                                                                                                                                                                                                            |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `62c5789` | **Zona de Codex:** tema oscuro (mismos nombres de tokens), Anton y Archivo (OFL) en lugar de Barlow, logotipos del diseño, componentes comunes, armazón con barra inferior de iconos y barra lateral del profesional desde 1024 px, `react-native-svg` 15.15.4 |
| `1642994` | Pantallas del cliente: Entreno, sesión en curso, técnica, cierre y nutrición; inicio del profesional                                                                                                                                                           |
| `0871294` | Archivo en los textos que salían con la fuente del sistema; opciones elegidas en dorado                                                                                                                                                                        |
| `1a29897` | Iconos ocultos sin avisos en web; título alineado en escritorio                                                                                                                                                                                                |

**Primera adaptación** (hasta `1a29897`): solo lo que la app ya tenía. David
pidió después «basarse 100 % en el diseño», también donde contradice decisiones
anteriores (el cliente marca sus comidas). Las 17 pantallas se construyeron con
datos reales en los tramos D1–D8 de `tasks/diseno/plan.md`, que recoge commits,
migraciones y lo que no se ha hecho y por qué (mensajería, «Proponer variante»,
calorías medias, PDF solo en web, animación de press banca, «Salud»).

**Verificación de D1–D8:** typecheck, lint y pruebas en cada commit (móvil 49
suites / 206 pruebas; API unitarias y e2e 30 suites / 314). En la batería e2e
completa en paralelo falla a veces `carrera-refresco` (Codex, ya conocida);
`entrenamiento-asignacion` contaba planes de toda la base y se acotó en
`27e3e21`. En la web (8181, API 3101, base del worktree) con la cuenta de prueba:
Inicio, check-in, sesión en curso (descanso, RIR, «Anterior»), molestia, cierre,
Plan (Rutina, Bloque, Guía), Progreso, Nutrición con «Tu plato» y «Media
mañana». Las pantallas del profesional se vieron con una ruta temporal de vista
previa (retirada): ficha del nutricionista con las cifras del diseño (2.247 /
3.483 kcal, 366 / 203 / 108 g), ficha del cliente y constructor.
