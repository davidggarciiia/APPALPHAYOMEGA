# Entrega de Fable — iteración 3

Encargo: [fable.md](fable.md) · Plan: [plan-fable.md](plan-fable.md).
Solo lo escribe Fable. Codex revisa e integra.

Desde el 24-09 este archivo vive solo en el worktree de Fable. La copia sin
seguimiento que dejé en la carpeta de Codex se trasladó aquí y se borró allí.

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

**Estado:** fuentes decididas por David; falta que Codex acuerde el contrato en
C05. No se ha comprado nada ni se ha abierto ninguna cuenta.

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

- Codex: acordar el contrato, la entrega y la dependencia `expo-video` en C05, y
  comprobar en la base demo los ids de Sentadilla con barra y Dominadas.
- Guardar copia con fecha de la página del paquete gratuito y del EULA de Vital
  junto a los archivos, cuando exista el almacenamiento.
- Hecho en `1865449`: `docs/animaciones-ejercicios.md` recoge la decisión vigente.

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
