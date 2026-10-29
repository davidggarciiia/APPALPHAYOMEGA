# D3 · Cliente móvil

Diseño aprobado: [ESPEC](ESPEC.md), secciones 4.1, 4.2, 4.3, 4.8, 4.9, 4.10 y 7.

1. Reutilizar movimiento, pestañas y esqueletos existentes. Añadir entrada compartida que espere el ajuste de accesibilidad y transición de contenido; probar consulta tardía y reducción de movimiento.
2. Acceso y Perfil: campos y presentación limpia, logo real, edición existente, consentimiento cuadrado. Verificar envío y controles accesibles.
3. Hoy y Plan: hero con botón de marca, semana con barras, lista única de sesiones, segmentado y hoja para cambiar día. Conservar consulta, copia, revisión y guardas de navegación; probar estas interacciones.
4. Nutrición: semana, objetivo y macros, comidas y suplementos cuadrados, estados y dos grupos de entrada.
5. Progreso: indicadores activos, cifra y delta, gráfica animada con alternativa estática, estados y pruebas de pocos puntos.
6. Revisar cambios, registrar equivalencias si cambia una prueba y verificar suite móvil completa, typecheck y lint desde raíz. Sin commits ni cambios de rama.

Los bloques 2, 4 y 5 se ejecutan en paralelo sobre archivos separados. No se modifican contratos ni lógica de sesión, datos o sondeos.
