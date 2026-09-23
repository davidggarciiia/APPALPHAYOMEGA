# Encargo para Fable en Claude — iteración 3

Proyecto: `C:/Users/david/Desktop/APP-ALPHA_OMEGA`.

Usa **Agent Skills**, las skills de `C:/Users/david/.claude/skills/`, empezando
por `using-agent-skills/SKILL.md`. Lee `planning-and-task-breakdown` y
`spec-driven-development`; conserva las validaciones entre fases.

David ha pedido repartir trabajo: cerrar lo actual y después nutrición y
seguimiento corporal. Ha ampliado tu parte: **ejercicios y sus animaciones juntos,
vistas de entrenamiento, revisión de rutinas/asignación/resultados, pruebas del
recorrido completo y nutrición completa**. Conecta tú mismo las figuras al registro;
no entregues solo un reproductor para que otro lo termine.
Codex lleva colores comunes/acceso/perfil/inicio, sesión, infraestructura/contratos,
integración y seguimiento corporal. Este encargo sustituye el antiguo reparto de
la iteración 2, cuyo código ya está integrado.

Lee, en este orden:

1. `tasks/iteracion-3/plan.md`.
2. `tasks/iteracion-3/plan-fable.md`.
3. `SPEC-catalogo-ejercicios.md` y `docs/animaciones-ejercicios.md`.
4. Matriz de roles de `SPEC-identity.md` y ADR 0005 cuando toque almacenamiento.

Primero registra F00 y comunica qué rama/SHA tienes y si ya hay trabajo en marcha.
Usa un worktree independiente acordado en C00. No cambies la rama de la carpeta de
Codex. Allí hay cuatro archivos de colores modificados y un `PDF/` ajeno que debes
preservar. Hasta que haya copia/base acordada, la lectura puede hacerse desde la
carpeta principal, sin editar su implementación.

La aprobación de estos planes aún no está registrada en esta entrega. Presenta
tu lectura y primer incremento; una instrucción de David de empezar permite
avanzar en las tareas cuyo alcance ya esté validado. La elección de muestra y las
specs nuevas se revisan cuando haya una propuesta concreta, antes de su código.

No toques contratos compartidos, Prisma, dependencias/lockfile, tema, sesión ni
navegación común. Pide esos cambios a Codex con un contrato y ejemplo concreto.
Sí son tuyas las cuatro vistas de entrenamiento indicadas en F08, el catálogo y
sus medios, el editor de rutinas y las pantallas del entrenador. Recibe primero
el tema de C01 y después trabaja esas vistas sin que Codex las edite en paralelo.
F03b sustituye la anterior C06; F08 absorbe las vistas de C03 y F10 las pruebas
físicas de C07b. El plan de coordinación delimita archivos y dependencias.
No compres animaciones: primero una muestra gratuita con permiso comprobado.
No implementes nutrición sobre suposiciones: F06 especifica y F07 desglosa antes.

Entrega por incrementos en `tasks/iteracion-3/entrega-fable.md`, con commits,
comandos y resultados, plataforma probada y pendientes. Codex revisa e integra.
Las pantallas se conectan a la API real y no se deja código de producción sin uso.
Una prueba web no acredita un recorrido nativo.
