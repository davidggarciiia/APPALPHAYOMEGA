# Informe de la noche — 28-10-2026

Rama de trabajo: `mejoras/base-2026-10-28` (solo commits locales; **ningún push ni despliegue**). Base de la rama: `codex/cliente-intuitivo`. La base `alpha_omega` no se ha tocado.

## Qué se hizo

### 1. Auditorías (solo lectura) — 126 hallazgos, ningún P0

- [flujos-entrenamiento.md](auditoria-noche-2026-10-28/flujos-entrenamiento.md): 71 hallazgos (cliente, entrenador, API, rendimiento, animación) con archivo, línea, causa y arreglo mínimo.
- [flujos-nutricion-seguimiento-acceso.md](auditoria-noche-2026-10-28/flujos-nutricion-seguimiento-acceso.md): 55 hallazgos (acceso, nutrición, seguimiento, fotos, catálogo).
- Cada informe termina con un top 10 en conjuntos de archivos disjuntos para repartir el trabajo.
- El informe de **rendimiento** y el de **skills y plugins** quedaron **parciales** (los agentes chocaron con el límite de uso): ver «Pendiente».

### 2. Correcciones aplicadas (cada una con prueba que falla antes y pasa después)

| ID de la auditoría | Qué arreglaba                                                                                                                                                                                                       | Commit    |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| A-01…A-05, A-07    | La puerta de consentimiento se abría ante cualquier error (500, sesión caducada); pantalla sin zona segura ni indicador; «Go» del teclado enviaba dos veces; activar cuenta no confirmaba el éxito ni dejaba salida | `81e80b0` |
| N-01, S-02, T-17   | El teclado tapaba el campo y «Guardar» al apuntar peso, pasos, sueño, cintura o responder una molestia                                                                                                              | `391be7c` |
| T-15               | La respuesta escrita para una molestia aparecía ya puesta en la siguiente (indicación de salud al cliente equivocado)                                                                                               | `96244ed` |
| E-02               | «Hecha» sin peso no hacía nada visible: el aviso salía al pie, fuera de la vista                                                                                                                                    | `e1c324b` |
| E-01               | «Terminar» solo estaba en la cabecera; ahora hay «Terminar entreno» al pie al acabar la última serie                                                                                                                | `d0faf4c` |
| S-01               | Salir de Progreso con una foto sin confirmar la perdía en silencio                                                                                                                                                  | `5bff1d0` |
| T-01               | El constructor de planes no autoguardaba: 10–30 min de trabajo perdidos si Android mataba el proceso                                                                                                                | `d22ad0b` |
| T-02               | Elegir una plantilla machacaba el plan montado sin preguntar                                                                                                                                                        | `a471635` |

También: **pantalla de carga con el vídeo del logo** (agente, integrada tras revisar su código), CI de GitHub, plazos de PostgreSQL y correo, cobertura del 80 % ejecutable, guarda de E2E, pruebas de acceso, y exclusión de los worktrees de agentes de Git, Prettier y ESLint.

### 3. Pantalla de carga con el vídeo — decisión del agente que debes validar

- Se usó `logo-rapido-x3.mp4` (1,2 s) como pediste, **pero no tal cual**: el original (780×1688) lleva un marco redondeado gris y su fondo es `#0A0A0A`, no el `#0E0D0B` de la app. El agente lo recodificó a un **recorte cuadrado de 770×770 centrado en el logo**, con el negro llevado al fondo de la app, para que no se vea un rectángulo sobre el fondo. Tu archivo original **no se tocó**. Si prefieres el vídeo entero, se cambia en `apps/mobile/assets/video/` y en el componente.
- Splash nativo: imagen estática del logo (plugin `expo-splash-screen`). **En Expo Go no se ve** (Expo Go usa su propio splash); solo se ve en una build propia.
- Comportamiento: se cierra con fundido cuando fuentes, sesión y vídeo han terminado; se salta tocando; con «reducir movimiento» no reproduce el vídeo; tope duro de 1,5 s para no bloquear nunca la app.

## Verificación

- Antes de los cambios de la noche: 390 pruebas de API, 733 del móvil, 512 E2E; cobertura fusionada 96,06 % líneas / 86,56 % ramas.
- Tras integrar la pantalla de carga: **762 pruebas del móvil en 90 suites, tipos y lint en verde**. Después se añadieron más pruebas con T-01 y T-02 (cada grupo verificado por separado).
- **No se ha ejecutado la CI en GitHub.** La simulación local sin `.env` da 512/512 E2E.

## Lo que NO está comprobado

- **Nada se ha visto en un móvil.** Háptica, animaciones nativas, teclado en Android/iOS y rendimiento nativo solo se prueban en dispositivo (Expo Go).
- El aviso de `Image` de `react-native-web` se corrigió en el código pero no se volvió a mirar en la consola de un navegador.
- Las auditorías son **estáticas**: se leyó el código, no se ejecutó la app con datos reales. Cada hallazgo indica si es CONFIRMADO (leído) o SOSPECHADO.

## Pendiente (en orden de prioridad)

1. **Sistema de botones** con esquina cortada y animación (agente en curso): se integra cuando termine y pase todo.
2. **Autoguardado del editor de dieta (N-02, P1):** misma pérdida de datos que T-01, en el editor de nutrición.
3. **Resto de P1/P2 de las auditorías** (ver los dos informes): confirmaciones al quitar días y ejercicios (T-04), 409 de consentimiento mal explicado (P-01), parpadeo al recargar Inicio y Nutrición (N-03, N-06), copia sin conexión en nutrición (N-04, N-05), sondeos de 5 s con escritura cifrada (E-04, E-05).
4. **Rendimiento:** informe parcial; faltan las medidas de arranque, bundle y endpoints.
5. **Skills y plugins:** informe parcial; no se instaló nada de terceros esta noche.
6. **Decisiones tuyas de antes:** borrado a petición (A o B), login con Google, dos políticas de acceso, y cómo repartir los commits de Codex (hecho en 4 commits por capa).

## Cómo probarlo en tu móvil (Expo Go)

```bash
npm run db:up
npm run dev --workspace apps/api
npm run dev --workspace apps/mobile
```

Después escanea el QR con Expo Go. La dirección de la API se deduce sola del servidor de Metro. Necesitas el usuario del seed (`SEED_ENTRENADOR_EMAIL` de tu `.env`).
