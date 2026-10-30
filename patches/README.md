# Compatibilidad de las dependencias de Expo 58

Expo Router 58.0.28 utiliza `URLSearchParams` para leer y generar los parámetros
de consulta y ya no depende de `query-string`. El cambio se incorporó en
[Expo Router 58.0.13](https://github.com/expo/expo/pull/50725).
Se retiraron el parche `expo-router++query-string+9.5.1.patch`, su override y
las excepciones de transformación de Jest para `query-string` y sus dependencias.
No hace falta adaptar sus exportaciones por defecto ni conservar el decodificador.

Los enlaces de activación y recuperación siguen comprobándose con el router real
en `apps/mobile/src/lib/rutas-compat.spec.ts`: tokens con caracteres especiales,
parámetros repetidos y escapes mal formados.

`npm ci` ejecuta `prepare`, que comprueba los parches con `--error-on-fail` antes
de compilar los paquetes compartidos y generar Prisma. Actualmente no hay parches
de Expo que aplicar. Si se instala con `--ignore-scripts`, ejecutar después
`npm run prepare`.

El override de Zod en el CLI es independiente del parche retirado del router.

Jest utiliza el [resolver oficial de Reanimated](https://docs.swmansion.com/react-native-reanimated/docs/guides/testing/)
para Reanimated 4.7 y Worklets 0.13. El resolver local también encuentra el core
desde Expo aunque npm lo anide, comparte el React del móvil con las librerías
elevadas a la raíz y utiliza el renderer de `jest-expo` 58, compatible con React
19.3. Se retiraron los overrides de React Native, Reanimated y Worklets del SDK 57
y el override del renderer 1.2, que solo admite React anterior a 19.3.
