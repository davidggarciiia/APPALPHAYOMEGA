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

- [ ] 1. Cargar los ejemplos usando los servicios de dominio y verificar por API.
- [ ] 2. Adaptar cabecera e inicio; comprobar navegación y calendario.
- [ ] 3. Adaptar tabla y perfil; comprobar edición, envío y guardado.
- [ ] 4. Revisar cambios, probar 320/768/1024/1440 px, ejecutar comprobaciones y documentar.

## Verificación

`npm run typecheck`, `npm run lint`, `npm run test --workspace apps/mobile -- --runInBand`,
`npm run build --workspace apps/api` y pruebas enfocadas de comportamiento nuevo.
Prueba manual web con la cuenta demo; conservar los ejemplos al finalizar.
No añadir dependencias ni modificar esquema de base de datos.
