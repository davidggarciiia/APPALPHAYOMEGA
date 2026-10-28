# Revisión completa con Ponytail — 27 de octubre de 2026

Se revisaron los archivos completos del proyecto, incluidos los que no tenían
cambios en Git. La revisión comprende fuentes, pruebas, migraciones, rollbacks,
herramientas propias y configuración. El [inventario de cobertura](revision-ponytail-2026-10-27.json)
enumera los 492 archivos revisados y los 27 simplificados; no quedan archivos
pendientes dentro de ese inventario.

| Área                                                  | Archivos revisados |
| ----------------------------------------------------- | -----------------: |
| API: fuentes, pruebas, esquema y SQL                  |                226 |
| App: entrenamiento y seguimiento                      |                132 |
| App: rutas, nutrición, catálogo, formularios y sesión |                103 |
| Contratos compartidos, herramientas y configuración   |                 31 |
| **Total**                                             |            **492** |

La skill está instalada en `C:/Users/david/.codex/skills/ponytail/SKILL.md`,
desde `DietrichGebert/ponytail`, commit
`09c434ab73ca43761c5d8b0c5d341926c2fba710`. Se instaló con el instalador de skills;
no se ejecutaron scripts de ese repositorio externo.

## Simplificaciones aplicadas

Las simplificaciones modifican 27 archivos de código o configuración y eliminan
178 líneas netas respecto al estado recibido, conservando los cambios previos del
proyecto. Después se corrigieron los cuatro avisos de formato pendientes.

- Agenda, nutrición y seguimiento reutilizan los helpers existentes para errores
  HTTP, códigos de Prisma y huellas de peticiones. Se conservan mensajes, entradas
  del hash, orden de comprobaciones, consultas y transacciones.
- Los modelos de entrenamiento reutilizan los tipos compartidos que ya incluyen
  distancia. Se eliminan reconstrucciones provisionales y comentarios obsoletos;
  los nombres exportados siguen disponibles para sus consumidores.
- El editor de dieta reutiliza la comprobación compartida de macros y normaliza
  una vez los alimentos. La creación de una dieta desde Pauta usa un flujo directo.
- Los tres botones de formulario comparten su representación y estados de carga,
  manteniendo sus props públicas, estilos, deshabilitación y nombres accesibles.
- El registro de comidas elimina un mensaje de estado redundante. Pauta reutiliza
  la detección de creatina y los textos iniciales ya calculados. Las dietas archivadas
  se filtran una vez, y la vista de dieta elimina una función ejecutada dentro del JSX.
- La sesión elimina un helper privado con un único uso. La tabla reutiliza la última
  serie hecha, y la ficha del cliente calcula una vez cada última medida disponible.
- La proyección corporal reutiliza el esquema publicado existente. Se elimina un
  objeto temporal que solo envolvía el máximo de un rango.
- El renderizador de animaciones sustituye un bucle de un único elemento por una
  asignación, conservando el cuerpo y el orden de las operaciones.
- ESLint excluye `build/`, que ya está excluido por Git y Prettier y contiene salidas
  generadas. No se desactiva ninguna regla para el código fuente.

Se conservaron expresamente las ramas de permisos, consentimiento, bloqueos,
renovación de sesión, recuperación offline, reintentos y liberación de fotos.
Su parecido no implica que sus efectos sean intercambiables. No se añadieron
dependencias ni se modificaron el esquema de datos, los roles o los contratos.

## Verificación

- Suite conjunta tras la refactorización inicial: **983 pruebas correctas**, 302
  de API y 681 de la app, sin modificar entonces los tests existentes. Comando:
  `npm run test --workspaces --if-present -- --runInBand`.
- `npm run typecheck`: correcto en raíz y todos los workspaces.
- `npm run build --workspace apps/api`: compilación correcta; el paquete
  compartido también se reconstruyó.
- `npm run test:e2e`: **500 pruebas correctas en 45 suites**, contra PostgreSQL
  en `alpha_omega_e2e_codex`, con un almacén local temporal para las fotos sintéticas.
  Las 26 migraciones estaban aplicadas, sin migraciones pendientes.
- `npm run lint`: correcto en todo el repositorio, tanto ESLint como Prettier.
  El script Python se comprobó con `py_compile`.
- Herramientas de animación: **cinco pruebas de poses y dos de geometría evaluada
  en Blender correctas**. Una comparación AST confirma que el cambio del
  renderizador solo sustituye el bucle de un elemento por la asignación y
  conserva íntegro su cuerpo.
- Los cambios recibieron revisión independiente de integración. Se compararon con
  copias del estado de trabajo anterior a cada edición, sin atribuir los cambios
  previos del usuario a esta tarea. El inventario se contrastó con los registros
  de revisión y las huellas de los archivos.

## Límites y estado previo

- Docker Desktop y el contenedor `alpha-omega-db` quedan arrancados y PostgreSQL
  está sano. Para resolver un fallo de arranque se apartaron dos directorios que
  solo contenían sockets temporales antiguos, conservando las copias:
  `C:/Users/david/AppData/Local/Docker/run.before-e2e-20261027-184832` y
  `C:/Users/david/AppData/Local/docker-secrets-engine.before-e2e-20261027-184832`.
- Los scripts históricos que escriben contra la base configurada se revisaron
  estáticamente y no se ejecutaron sobre la base habitual. Los E2E se ejecutaron
  exclusivamente sobre la base dedicada.
- Después se ejecutó la prueba exploratoria web documentada en
  [prueba-manual-2026-10-27.md](prueba-manual-2026-10-27.md), con correcciones y
  regresiones adicionales. No se probó en dispositivo/emulador nativo ni se
  regeneraron los vídeos completos de las animaciones.
- Se corrigió el formato de los cuatro archivos previos pendientes:
  `.claude/launch.json`, `docs/intent/rediseno-ux-cliente.md`,
  `tasks/auditoria-perfil-completo-2026-10-03.md` y
  `tools/animaciones-propias/README.md`. Se verificó la equivalencia del JSON y del
  contenido de los tres Markdown; las rutas de lanzamiento se conservaron.
- La configuración local de las demos de Claude conserva rutas absolutas antiguas
  para la carpeta `APP-ALPHA_OMEGA-unificada`; se revisó y se conservó su destino.
- El inventario excluye dependencias, bundles y artefactos generados, metadatos de
  Git, archivos multimedia, PDFs de referencia y secretos.

La carpeta de trabajo actual es `C:/Users/david/Desktop/DAVID/APP-ALPHA_OMEGA`.
Los enlaces de los tres workspaces de npm se actualizaron en `node_modules/`
porque apuntaban a la ubicación anterior. No se cambiaron dependencias ni el lockfile.
