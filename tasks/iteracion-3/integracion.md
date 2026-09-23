# Coordinación de la iteración 3

Registro iniciado el 2026-09-23 por Codex (C00).

## Copias y propiedad

| Copia                                             | Rama y base al crear                          | Uso                                                |
| ------------------------------------------------- | --------------------------------------------- | -------------------------------------------------- |
| `C:/Users/david/Desktop/APP-ALPHA_OMEGA`          | `codex/entrenamiento-iteracion-2` · `ce5962d` | Codex; tema común entregado                        |
| `C:/Users/david/Desktop/APP-ALPHA_OMEGA-fable-i3` | `codex/fable-iteracion-3` · `ce5962d`         | Fable / Opus; creada limpia con el tema común      |
| `C:/Users/david/Desktop/APP-ALPHA_OMEGA-fable`    | `codex/fable-catalogo` · `e629673`            | Copia anterior limpia; conservar sin mover su rama |

La rama de Fable nació del commit **solo documental** `2ab7b92` y avanzó a
`ce5962d` tras verificar y registrar el tema común de C01. No se trasladaron
cambios sin confirmar de la carpeta principal.
La carpeta `PDF/` y cualquier otro archivo ajeno sin seguimiento se preservan.

## Archivos y contratos

El [plan de coordinación](plan.md) fija dueño por ruta. Ejercicios y animaciones,
incluida su presencia en el registro, son de Fable. Codex es dueño de
`packages/shared`, Prisma, dependencias y módulos raíz. Fable entrega propuestas
con ejemplo; Codex publica el SHA de cada contrato antes de que Fable consuma
la nueva forma. Cambios en sesión o lógica cifrada de registro son de Codex.

Fable puede usar este worktree sin cambiar la rama de la copia principal.
Si su sesión ya empezó en otra carpeta, primero se comprueba el diff y se acuerda
qué entrega trasladar. Ninguna copia se limpia ni se resetea automáticamente.

## Entornos y pruebas

El servidor API local de la copia principal usa normalmente 3000 y Metro web
8081, pero no se presupone que hoy estén arrancados. Fable debe comprobar los
puertos antes de iniciar su proceso y elegir otros distintos. Tests HTTP y
migraciones sobre la misma base se ejecutan por turnos; una base de prueba
independiente permite hacerlo en paralelo. La base demo nunca se reinicia.

## Estado de arranque

- [x] Planes registrados en `2ab7b92` sin incluir el tema pendiente ni `PDF/`.
- [x] Worktree nuevo de Fable creado desde ese SHA; copia antigua conservada.
- [x] Línea base de typecheck, tests móviles, lint y límites registrada.
- [ ] Fable registra en su entrega la copia/SHA reales y confirma los puertos
      elegidos antes de lanzar servicios.

Cada entrega se anota con tarea, commit, archivos, pruebas, plataforma y
limitaciones. Integración de commits concretos tras revisión y prueba del
recorrido real; no usar `git add .` en la carpeta principal.

### Línea base medida

`npm run typecheck`: correcto. Tests móviles: 17 suites, 91 tests correctos.
La primera ejecución de `npm run lint` falló solo al comprobar formato de este
registro aún sin formatear y un informe `compass_artifact_*.md` generado fuera del
código; el registro se ha formateado y el informe queda fuera de Prettier sin
modificarlo. Segunda ejecución de `npm run lint`: correcta. No se han ejecutado
tests HTTP ni verificación nativa en esta base. El navegador abrió una sesión
guardada sin conexión en la pantalla de entrenamiento; esa vista pertenece a
Fable y no se ha editado. La comprobación visual de acceso/perfil sigue pendiente.

David confirmó asimismo que los medios de esta iteración serán solo gratuitos.
Fable evalúa RepDB Free; C05 no fijará un contrato de vídeo MP4 hasta ver la muestra
real, su licencia y el modo en que se representa el movimiento.
