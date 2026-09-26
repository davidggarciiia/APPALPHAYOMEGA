# Spec: `nutricion` — pauta del entrenador

> Estado: **borrador para revisión de David**, redactado el 2026-09-26.
> Cubre solo la pauta nutricional que el entrenador ya entrega hoy en la primera
> página de cada rutina. La parte del nutricionista (dietas, alimentos, opciones
> de comidas) se especificará aparte. Mapa: [CAPABILITY-MAP.md](CAPABILITY-MAP.md).
> Diseño: [docs/diseno/panel-entrenador.md](docs/diseno/panel-entrenador.md), ficha › Nutrición.

## Objetivo

El entrenador calcula y publica en la app la pauta nutricional de cada cliente,
como hoy hace en papel, y el cliente la lee. El cliente no registra comidas.

## Qué contiene una pauta

| Parte                | Contenido                                                                                                                                                                             |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Datos de referencia  | Edad, altura, peso y grasa corporal con su método (plicometría, bioimpedancia)                                                                                                        |
| Sexo para la fórmula | Hombre o mujer, solo para el cálculo; se guarda en la pauta, no en el perfil                                                                                                          |
| Metabolismo basal    | Calculado con la fórmula que elige el entrenador: Mifflin-St Jeor por defecto, que necesita el sexo para la fórmula; o Katch-McArdle, que usa la grasa corporal y no depende del sexo |
| Factor de actividad  | Número (1,2 a 1,9) con una nota                                                                                                                                                       |
| Gasto total estimado | Calculado                                                                                                                                                                             |
| Objetivo             | Recomposición, pérdida de grasa, ganancia muscular o mantenimiento, con texto                                                                                                         |
| Calorías             | Rango diario y un valor de ejemplo                                                                                                                                                    |
| Reparto              | Porcentajes de hidratos, proteína y grasas; gramos y g/kg calculados para el ejemplo                                                                                                  |
| Recomendaciones      | Lista de textos, que salen de plantillas de Guía y reglas y se editan por cliente                                                                                                     |
| Suplementos          | Nombre, dosis y nota («creatina 3–5 g al día, también en descanso»)                                                                                                                   |
| Descanso             | Horas de sueño recomendadas y nota                                                                                                                                                    |
| Nota                 | Texto libre, por ejemplo la relación entre entrenamiento, alimentación y descanso                                                                                                     |

Los cálculos son estimaciones y la pantalla lo dice: se ajustan con la media del
peso, la cintura, el rendimiento y la adherencia.

## Reglas

- El entrenador edita un borrador y lo **publica**. El cliente ve siempre la
  última versión publicada; las anteriores se conservan.
- Si a la fórmula elegida le falta un dato (el sexo en Mifflin-St Jeor, la grasa
  corporal en Katch-McArdle), el metabolismo basal no se calcula: la pantalla
  pide el dato que falta y no cambia de fórmula por su cuenta.
- Cuando exista `seguimiento-corporal`, los datos de referencia se proponen desde
  la última medición; hasta entonces se teclean.
- Son datos de salud: hasta que existan las tareas 19 y 21 de `identity`, solo
  con datos de prueba.

## Permisos

| Acción                     | Cliente     | Entrenador         | Nutricionista          | Empleado |
| -------------------------- | ----------- | ------------------ | ---------------------- | -------- |
| Editar y publicar la pauta | No          | Sí                 | Pendiente (pregunta 1) | No       |
| Leer la pauta publicada    | Solo propia | Todos sus clientes | Pendiente (pregunta 1) | No       |

## Criterios de aceptación

1. El metabolismo basal y los gramos coinciden con las fórmulas para varios
   casos de prueba, incluidos decimales: Mifflin-St Jeor con las dos
   constantes (+5 y −161) y Katch-McArdle con grasa corporal.
2. Si a la fórmula elegida le falta su dato, no se muestra ningún metabolismo
   basal y se pide ese dato.
3. Publicar deja visible la versión nueva al cliente y conserva la anterior.
4. El cliente no ve un borrador sin publicar.
5. Cliente ajeno, nutricionista, empleado y petición sin sesión tienen pruebas de
   denegación.

## Preguntas abiertas

1. Si el cliente tiene nutricionista asignada, ¿quién manda? Propuesta: su pauta
   sustituye a la del entrenador, que la ve en solo lectura.
2. ¿Hace falta registrar a mano hábitos diarios (peso en ayunas, pasos, sueño,
   creatina) aquí o en `seguimiento-corporal`? Propuesta: en seguimiento corporal.
