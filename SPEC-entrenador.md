# Spec: perfil de entrenador

Estado: borrador para aprobar (29-10-2026). Amplía `SPEC.md` y `SPEC-entrenamiento.md`; no los sustituye.

## Objetivo

El criterio de éxito del proyecto es que el entrenador abra el panel y vea qué ha
levantado cada cliente esta semana sin preguntárselo a nadie. Hoy el Inicio del
entrenador lista tareas (sesiones por revisar, molestias, clientes sin plan) pero
no enseña cargas. Este trabajo lleva el perfil de entrenador al nivel del de
cliente con tres capacidades, en el móvil (390 px) y para carteras de menos de
15 clientes. Queda fuera una agenda de «hoy»: el dueño la descarta.

| Módulo                 | Qué resuelve                                                              | Depende de          |
| ---------------------- | ------------------------------------------------------------------------- | ------------------- |
| `resumen-semanal`      | Qué ha levantado cada cliente esta semana frente a la anterior            | —                   |
| `progresion-ejercicio` | Evolución de cada ejercicio de un cliente y cuándo subir carga            | reglas compartidas  |
| `gestion-clientes`     | Encontrar, editar, reactivar o dar de baja clientes desde la cartera      | API de identity hoy |
| `ficha-cliente`        | Ficha rediseñada: qué hacer ahora, su semana, sus cargas y accesos claros | los tres anteriores |

Orden: `progresion-ejercicio` (sus reglas puras las reutiliza el resumen) →
`resumen-semanal` → `gestion-clientes` → `ficha-cliente`.

El dueño considera la ficha actual «súper poco intuitiva» (cabecera amontonada,
«SEMANA» ambiguo, «CREAR PLAN NUEVO» como acción principal, cinco pestañas con una
oculta). Su rediseño sale de Claude Design y se especifica en
`tasks/diseno-movil/ESPEC-ficha.md`; esta spec se actualizará con sus criterios en
cuanto el dueño apruebe el diseño.

## Criterios de aceptación

### resumen-semanal (Inicio del entrenador)

1. Una tarjeta por cliente activo para la semana elegida (por defecto la actual;
   flechas a semanas anteriores) con: sesiones enviadas de las previstas; para cada
   ejercicio principal compuesto, la mejor serie de la semana (kg × reps @ RIR) y su
   diferencia con la semana anterior (sube, igual, baja y cuánto); récords de la
   semana; molestias abiertas.
2. Orden: primero quien necesita atención (molestia abierta, rendimiento a la baja en
   dos sesiones seguidas, ninguna sesión enviada a mitad de semana), después por nombre.
3. Solo cuenta resultados ENVIADOS: los borradores siguen privados (regla de
   `SPEC-entrenamiento.md`, «Qué ve el entrenador»).
4. Una sola petición a un endpoint agregado nuevo de la API; con 15 clientes y 8
   semanas de historial responde en menos de 500 ms en local (prueba e2e con datos).
5. Se refresca al volver a la pantalla y como mucho cada 10 s mientras está visible
   y la app activa. Tocar la tarjeta abre la ficha del cliente.
6. Lo que ya hay en el panel (por revisar, molestias, sin plan) se integra, no se
   duplica.

### progresion-ejercicio (ficha → Progreso)

7. Lista de los ejercicios con historial del cliente; al abrir uno: gráfica semanal
   de la mejor serie (kg y 1RM estimado con Epley) y las últimas sesiones con sus
   series (kg × reps @ RIR, fecha).
8. El entrenador NO sube cargas: solo prescribe el RIR objetivo (como en la rutina
   del PDF) y el cliente aplica la doble progresión. Regla pura en `packages/shared`
   con pruebas unitarias de cada caso:
   - Para el CLIENTE, en su sesión: si en la última sesión TODAS las series llegaron
     al tope del rango con al menos el RIR mínimo pedido, sugerencia «Sube carga la
     próxima vez» (+ `subidaKg` del ejercicio, o 2,5 kg en tren superior y 5 kg en
     inferior si no hay), editable y nunca obligatoria.
   - Para el ENTRENADOR, solo observación por ejercicio: «Progresa» (sube carga o
     reps frente a la anterior), «Estancado» (igual tres sesiones seguidas) o «Baja»
     (baja dos sesiones seguidas). Sin acciones de subir carga.
9. Reutiliza `GET clientes/:clienteId/fuerza` y la gráfica existente
   (`src/seguimiento/grafica.tsx`); amplía la API solo si falta un dato, con contrato
   en `packages/shared` y prueba e2e.

### gestion-clientes (Cartera y ficha)

10. Cartera con filtros Activos / Pendientes de activar / De baja y búsqueda por
    nombre y apellidos.
11. Desde la ficha, «Datos del cliente»: editar nombre y apellidos y correo, reenviar
    la activación a un pendiente, dar de baja y reactivar con confirmación. Usa los
    endpoints que ya existen (`PATCH usuarios/:id`, `PATCH usuarios/:id/correo`,
    `POST usuarios/:id/reenviar-activacion`, `/desactivar`, `/reactivar`) y lo que ya
    haya en `app/cliente/[id].tsx`, sin duplicarlo.
12. Si la edad y el sexo que necesitan los protocolos de pliegues y el cálculo de
    gasto no se guardan en el cliente, se añaden como columnas opcionales (migración
    aditiva, sin tocar datos existentes) y se editan en «Datos del cliente».

### Para los tres

13. Diseño del ESPEC móvil (`tasks/diseno-movil/ESPEC.md`): limpio, sin títulos de
    relleno, esqueletos de carga, estados vacío y error, movimiento de marca con
    alternativa de movimiento reducido, objetivos táctiles de 44 px o más.
14. Suites del móvil y de la API, e2e de la API contra la base de pruebas,
    typecheck y lint en verde. Ninguna prueba borrada sin su sustituta.

## Comandos

```
npm run typecheck
npm run lint
npm test --workspace apps/mobile
npm test --workspace apps/api
POSTGRES_DB=alpha_omega_e2e_codex npm run test:e2e --workspace apps/api
npm run build --workspace apps/api
```

## Estructura

- Contratos y reglas puras: `packages/shared/src/` (`entrenamiento.ts` o un módulo nuevo `progresion.ts`).
- API: `apps/api/src/entrenamiento/` (endpoint agregado) y `apps/api/src/identity/` (si hace falta la migración).
- Móvil: `apps/mobile/src/inicio-entrenador/`, `apps/mobile/src/entrenamiento-entrenador/ficha/`, `apps/mobile/app/cartera.tsx`, `apps/mobile/app/cliente/[id].tsx`.

## Estrategia de pruebas

TDD en cada tarea: reglas puras con pruebas unitarias en `packages/shared`, servicios
de la API con unitarias y e2e (guarda de la base de pruebas), pantallas con React
Native Testing Library. Las guardas estáticas de accesibilidad y la puerta de
cobertura siguen igual.

## Límites

- Siempre: contratos en `packages/shared`; borradores invisibles para el entrenador; mobile-first; movimiento reducido.
- Preguntar antes: dependencias nuevas; migraciones que no sean aditivas; cambiar permisos o quién ve qué.
- Nunca: enseñar borradores al entrenador; borrar o reescribir resultados enviados; tocar los flujos del cliente salvo para compartir componentes.

## Preguntas abiertas

- Si el dueño quiere más tarde una agenda de «hoy», sería un cuarto módulo.
