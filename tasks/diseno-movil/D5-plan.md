# D5 · Constructor móvil

Fuente: ESPEC completo, con alcance en 5.5. Diseño ya aprobado. Sin cambios de contrato, dependencias ni operaciones de escritura en Git.

- [x] Convertir la tabla principal en cinco celdas táctiles; probar apertura del ajuste sin teclado, rangos y cargas.
- [x] Reutilizar BarraAjuste y Hoja para prescripción y detalles del ejercicio, conservando campos avanzados y guardas de series heterogéneas.
- [x] Mover datos del bloque y biblioteca a hojas; mantener confirmaciones de plantilla, quitar día y salida.
- [x] Dar al constructor su scroll y una sola barra fija Ver como cliente/Publicar; conservar errores junto a la acción.
- [x] Reutilizar AvisoDeshacer durante cinco segundos, conservando reinserción y protección frente al doble toque.
- [x] Adaptar las pruebas a los nuevos controles sin retirar escenarios y añadir cobertura del flujo móvil.
- [x] Ejecutar pruebas dirigidas, suite móvil, typecheck y lint; revisar el diff y declarar límites de verificación real.

Archivos: constructor/{constructor,tabla,partes}.tsx, ajuste-prescripcion.tsx y pruebas vecinas; ruta de plan y armazón para evitar doble cabecera/scroll; BarraAjuste solo si necesita contenido adicional reutilizable.

Verificación incremental: `npm test --workspace apps/mobile -- src/entrenamiento-entrenador/constructor`. Cierre: `npm test --workspace apps/mobile`, `npm run typecheck`, `npm run lint` desde la raíz. La publicación mantiene persistencia previa a la API, identificador de operación e identificadores de series. El autoguardado conserva su espera de 800 ms y sus condiciones.

Resultado: 125 suites y 1195 pruebas móviles pasan; typecheck y lint de la raíz pasan. No se eliminan ni omiten escenarios. La prueba de caducidad de seis segundos pasa a cinco conservando su comprobación del borrador. Se añaden pruebas de edición y vaciado de opcionales, hojas y navegación, plantillas con entrada inválida, orden del aviso y conservación de su vencimiento al cambiar de contenedor.

Reordenación mediante botones accesibles, alternativa prevista en ESPEC. Sin cambios de contrato ni dependencias. Sin verificación en dispositivo, hápticos, teclado nativo ni rendimiento real. La revisión visual en navegador quedó bloqueada: host no disponible y control de Chrome no autorizado; no se creó ningún servidor ni archivo temporal.
