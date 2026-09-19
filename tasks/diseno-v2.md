# Diseño v2 y cuenta de demostración

Referencia: `Theme files review (1).zip`, `Alpha Omega App v2.dc.html` (19/09/2026).
Petición: adaptar el diseño nuevo y poblar la cuenta cliente recién creada.
Se conserva la preferencia explícita por blanco y negro.

## Criterios

- Cabecera clara, avatar, navegación de tres destinos operativos, tarjetas blancas,
  tipografía Barlow y jerarquía del nuevo diseño; sin marco de teléfono del prototipo.
- Inicio con sesión del día, semana y resultados enviados procedentes de la API.
- Registro de series en tabla: número, objetivo, kg, repeticiones o segundos y marca
  de realizada. Mantener guardado local, validación y confirmación de envío.
- Perfil con identidad, datos personales editables y salida de sesión funcional.
- Datos persistentes de ejemplo solo para `cliente.demo@prueba.local`: perfil,
  plan con ejercicios por repeticiones y tiempo, resultados y cambio de fecha.
  Conservar contraseña y datos ajenos; no sobrescribir futuras ediciones del demo.
- La referencia gráfica no amplía el alcance a nutrición, mediciones corporales,
  fichajes, vídeos ni temporizadores: esos módulos aún no tienen contratos reales.
  No añadir controles sin función ni estadísticas inventadas a las pantallas.

## Bloques

- [x] 1. Cargar los ejemplos usando los servicios de dominio y verificar por API.
- [x] 2. Adaptar cabecera e inicio; comprobar navegación y calendario.
- [x] 3. Adaptar tabla y perfil; comprobar edición, resumen de envío y guardado.
- [x] 4. Revisar cambios, probar 320/768/1024/1440 px, ejecutar comprobaciones y documentar.

## Verificación

`npm run typecheck`, `npm run lint`, `npm run test --workspace apps/mobile -- --runInBand`,
`npm run build --workspace apps/api` y pruebas enfocadas de comportamiento nuevo.
Prueba manual web con la cuenta demo; conservar los ejemplos al finalizar.
No añadir dependencias ni modificar esquema de base de datos.

## Resultado y evidencia

- Plan demo: nueve sesiones entre el 7 y el 25 de septiembre de 2026, cinco resultados
  enviados mediante `RegistrosService` y cuatro sesiones abiertas. La del viernes 18
  pasó al sábado 19 mediante `AgendaService`: el historial conserva autor y fechas.
- La cuenta conserva su contraseña. Perfil con teléfono y nacimiento de ejemplo.
  Sus planes, resultados y datos personales quedan persistidos en la base local.
- Prueba web del registro: 27,5 kg y 12 repeticiones en press; 45 segundos en plancha;
  resumen con dos series hechas y siete omitidas; cancelación y recarga con valores
  recuperados. Se deja la sesión abierta para que el usuario pueda continuar.
- Perfil: resumen, edición, guardado confirmado y contacto actualizado. Se conectó
  al transporte autenticado existente para renovar credenciales; renovar no reinicia
  los campos editados ni repite automáticamente un PATCH. Regresiones cubiertas.
- `npm test`: 76 pruebas API y 91 pruebas móviles, 167 en total.
- Typecheck, ESLint/Prettier y compilación API correctos. Revisión independiente
  de los cambios visuales y del guardado del perfil sin hallazgos obligatorios.
- Revisión visual web a 320, 390, 768, 1024 y 1440 px, sin desbordamiento horizontal.
  No se ha realizado verificación en dispositivos iOS/Android físicos.
- La fotografía procede del slot `ao-sesion-hoy` del ZIP del usuario y se sirve
  localmente; se presenta con el filtro de escala de grises de React Native.
- Durante la prueba hubo dos pestañas usando la misma sesión web guardada y
  renovaciones concurrentes. Se cerró la pestaña auxiliar y se verificó en la vista
  del usuario. La coordinación de credenciales entre pestañas no se amplía en este
  cambio; cada sesión independiente del móvil mantiene su propia credencial.
