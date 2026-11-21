# Plan: reservas con bonos y seguimiento

Fuente: `SPEC-reservas.md`. Implementa Codex (`gpt-6.1-sol`) una tarea cada vez; esta
sesión revisa, verifica y commitea.

- [x] R1 · `bonos`: servicios, bonos, movimientos y seguimiento activo (migración aditiva, contratos, API, e2e). Criterios 1–4.
- [x] R2 · `disponibilidad`: el entrenador abre huecos, los repite semanalmente y cierra los libres (API + e2e). Criterio 5. El cliente no consulta huecos libres.
- [x] R3 · `reservas`: API implementada, 15/15 e2e enfocadas y 3/3 de contrato verdes; verificación global y cobertura completas correctas. El entrenador asigna un hueco a un cliente con crédito o cupo, cancela decidiendo si devuelve y marca asistencia; concurrencia y avisos al cliente al asignar/cancelar. Criterios 7–10 reinterpretados según decisión del dueño del 30-10.
- [x] Checkpoint 1: API 539/539 y E2E 589/589 verdes; cobertura superior al 80 % en las cuatro métricas. Con autorización de David se reconstruyó únicamente `alpha_omega_e2e_codex`: 30 migraciones en orden, historial actualizado y 589/589 E2E repetidas sobre la base limpia. Contrato listo para revisión de Claude antes de iniciar R4. Ver detalle en `para-codex-2026-10-30.md`.
- [ ] R4 · Cliente, solo consulta: reservas junto a las sesiones del plan en el calendario expandido de Hoy, saldo y cupo mensual. Sin acciones para reservar ni cancelar. Criterio 11 reinterpretado.
- [ ] R5 · Entrenador: agenda por día/semana que distingue personal y seguimiento; abrir huecos, asignar, cancelar y marcar asistencia; cargar bonos y activar seguimiento desde la ficha. Criterio 12.
- [ ] R6 · Datos de demo (David con bono de 10 entrenos y seguimiento activo, huecos de la semana) y revisión final.
- [ ] Checkpoint 2: vídeo a 390 px de la asignación desde la agenda del entrenador y de la reserva con saldo en el calendario del cliente.

R1 expone `GET /bonos/servicios` y, bajo `/bonos/clientes/:clienteId`, `GET /`
(saldo), `GET /movimientos` (paginado), `POST /cargas`, `POST /ajustes` y
`PATCH /seguimiento`. Solo el entrenador escribe; el cliente lee lo suyo.
Las cargas y ajustes requieren un `operacionId` estable en los reintentos;
reutilizarlo con otros datos devuelve 409. Cada carga representa un bono y el
saldo se calcula sumando movimientos, sin caducidad. El cupo se concede al activar
el seguimiento o en la primera lectura del mes en Europe/Madrid; desactivar y
reactivar conserva los movimientos del mes. Quiromasaje solo figura en el modelo.
