# Plan: reservas con bonos y seguimiento

Fuente: `SPEC-reservas.md`. Implementa Codex (`gpt-6.1-sol`) una tarea cada vez; esta
sesión revisa, verifica y commitea.

- [x] R1 · `bonos`: servicios, bonos, movimientos y seguimiento activo (migración aditiva, contratos, API, e2e). Criterios 1–4.
- [ ] R2 · `disponibilidad`: huecos del entrenador, repetición semanal, cierre y listado de huecos libres para el cliente (API + e2e). Criterios 5–6.
- [ ] R3 · `reservas`: reservar con crédito o cupo, concurrencia, petición de cancelación, decisión del entrenador, asistencia y notificaciones (API + e2e). Criterios 7–10.
- [ ] Checkpoint 1: suites de la API y e2e en verde.
- [ ] R4 · Cliente: «Reservar» desde el calendario expandido, mis reservas, saldo y cupo, pedir cancelación. Criterio 11.
- [ ] R5 · Entrenador: agenda que distingue personal y seguimiento, abrir huecos, decidir cancelaciones, cargar bonos y activar seguimiento desde la ficha. Criterio 12.
- [ ] R6 · Datos de demo (David con bono de 10 entrenos y seguimiento activo, huecos de la semana) y revisión final.
- [ ] Checkpoint 2: verificación completa y vídeo de reservar y de la agenda.

R1 expone `GET /bonos/servicios` y, bajo `/bonos/clientes/:clienteId`, `GET /`
(saldo), `GET /movimientos` (paginado), `POST /cargas`, `POST /ajustes` y
`PATCH /seguimiento`. Solo el entrenador escribe; el cliente lee lo suyo.
Las cargas y ajustes requieren un `operacionId` estable en los reintentos;
reutilizarlo con otros datos devuelve 409. Cada carga representa un bono y el
saldo se calcula sumando movimientos, sin caducidad. El cupo se concede al activar
el seguimiento o en la primera lectura del mes en Europe/Madrid; desactivar y
reactivar conserva los movimientos del mes. Quiromasaje solo figura en el modelo.
