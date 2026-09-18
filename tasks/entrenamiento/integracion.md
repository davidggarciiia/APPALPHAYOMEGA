# Continuación e integración de la segunda iteración

David pide a Codex terminar lo pendiente de Fable e integrar toda la iteración,
sin código muerto. Esta instrucción transfiere F01–F08 a Codex y autoriza continuar
los bloques dependientes C04–C19 sin esperar una entrega externa. Se mantienen
las especificaciones y los criterios de aceptación. Los checkpoints conservan
pruebas y revisión; se informa del resultado durante la ejecución. No hay despliegue
ni push implícitos.

## Base y recuperación del trabajo

- Base de Codex: `11076a8`; árbol limpio al empezar.
- Trabajo de Fable: `9fc9003..e629673`, rama `codex/fable-catalogo`.
- El worktree de Fable está limpio. Sus commits son aditivos sobre C03a: la
  diferencia con Codex en HTTP/Metro/documentos se debe a su base más antigua.
  Se integran sus commits conservando C03b y los documentos posteriores.
- Fable completó API del catálogo y preparó UI con tests. Faltan adaptador HTTP,
  rutas y recorrido real. F04–F08 y C04–C19 no están implementados.

## Orden de los bloques

1. Revisar e integrar commits de Fable; corregir hallazgos reproducidos.
2. F02c: conectar catálogo a HTTP, crear rutas, enlazar inicio. Completar 400
   tipados sin cambiar identidad. Mover el catálogo en memoria a soporte de tests.
3. C08–C09: persistencia aditiva y primera asignación/consulta, con permisos y
   copia de prescripción. Continuar por tareas de máximo cinco archivos.
4. F04 + C10: editor de una sesión y semana del cliente, con API real.
5. C04–C07: almacenamiento privado, recuperación offline, renovación y salida
   con protección de borradores. Los tests nativos se distinguen de mocks/web.
6. C11–C15 + F05: registro, sincronización, cambio de día, envío atómico y
   resultados que se actualizan en el panel del entrenador.
7. C16–C17 + F06–F07: varias semanas, rutinas reutilizables y ajustes seguros.
8. C18–C19 + F08: concurrencia, recorrido integrado, limpieza de artefactos
   sin uso y actualización de documentación.

Cada bloque se desglosa con los archivos de `todo.md` y `todo-fable.md`. Si una
tarea necesita más de cinco archivos, se divide antes de implementarla. La
integración de código ya escrito por Fable conserva sus commits originales.
Los datos en memoria solo pueden ser fixtures usados por pruebas: ninguna ruta
de producción debe importarlos. No se eliminan elementos sin comprobar usos.

## Evidencia exigida

- TDD para lógica nueva y reproducciones de fallos; tests, typecheck, lint y
  compilación de API antes de guardar entregas.
- HTTP con PostgreSQL: permisos, privacidad, idempotencia, carreras e históricos.
- Browser: entrenador crea/asigna; cliente mueve/registra/envía; entrenador lee.
- Comprobar rutas accesibles, imports y consumidores; no completar con stubs.
- Registrar cualquier comprobación de dispositivo pendiente sin presentarla como hecha.

## Seguimiento

- [ ] Commits de Fable revisados e integrados.
- [ ] Catálogo conectado y comprobado.
- [ ] Asignación y consulta integradas.
- [ ] Borrador privado y sesión offline integrados.
- [ ] Cambio de día, envío y resultado integrados.
- [ ] Varias semanas, rutinas y ajustes integrados.
- [ ] Pruebas, revisión, limpieza y documentación finales.
