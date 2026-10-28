# Compatibilidad de las dependencias de Expo 57

`expo-router++query-string+9.5.1.patch` añade las exportaciones con nombre a la misma API
que el paquete ya exporta por defecto. Expo Router 57 las consume con
`__importStar(require("query-string"))`; sin esta línea el cambio de la versión
7 a la 9 rompe la generación de enlaces. El parche no cambia el decodificador.

La versión 9.5.1 incorpora `decode-uri-component` 0.5, que corrige el aviso
([GHSA-vcc3-ghjq-m6fr](https://github.com/advisories/GHSA-vcc3-ghjq-m6fr)).
Se conserva la rama 9 porque la 10 usa expresiones regulares que el compilador
Hermes de este SDK rechaza.
El override está limitado a Expo Router. Jest transforma esos módulos ESM;
Metro ya los transforma al construir la app. Los enlaces de activación y
recuperación se comprueban con el router real en `rutas-compat.spec.ts`.

`npm ci` ejecuta `prepare`, que aplica el parche con `--error-on-fail` antes
de compilar. Si se instala con `--ignore-scripts`, ejecutar después
`npm run prepare`. Construir con las dependencias de desarrollo; un despliegue
que las retire debe conservar los módulos ya preparados, no reinstalarlos sin
aplicar el parche.

Al actualizar el SDK, revisar si Expo Router ya acepta la API por defecto y
retirar juntos el parche, su override y la excepción de transformación de Jest.
El override de Zod en el CLI evita su versión vulnerable; las dos fuentes del
CLI que lo consumen y sus esquemas de herramientas se verificaron con Zod 4.
