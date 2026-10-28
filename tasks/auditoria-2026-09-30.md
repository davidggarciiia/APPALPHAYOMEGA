# Auditoría de Alpha y Omega del 30 de septiembre de 2026

> Informe histórico de hallazgos. Su implementación y verificación posterior se registran en [Correcciones de auditoría del 4 de octubre](correcciones-auditoria-2026-10-04.md).

La revisión encontró **41 errores reproducidos: 3 P1, 35 P2 y 3 P3**, además de un riesgo de bloqueo pendiente de comprobación con PostgreSQL. Los más urgentes permiten conservar una sesión después de restablecer la contraseña o cerrar sesión, y completar escrituras después de retirar el consentimiento. También hay pérdidas silenciosas de pautas y borradores y fallos al reintentar publicaciones. Las pruebas existentes de la base revisada pasan al ejecutarlas en serie, pero no cubren estos escenarios.

Se revisaron autenticación, permisos, catálogo, agenda, entrenamiento, nutrición, seguimiento, valoraciones, fotos, persistencia local, contratos y configuración. La base revisada es `074e204001ad7cb476e50342211c6bf0b9935590`, rama `codex/cliente-intuitivo`. No se corrigió código de la aplicación ni se modificaron cuentas o datos reales. Los hallazgos antiguos RI01, RI02 y RI04–RI07 no se vuelven a presentar como pendientes: sus correcciones ya están integradas. RI03 conserva su pendiente documentado.

Las reproducciones adicionales ejecutan las funciones y servicios reales con repositorios, almacenamiento y respuestas controlados en memoria. En los componentes se ejecuta TSX real con hooks deterministas y componentes visuales simulados. Esto demuestra las secuencias del código; **no sustituye una prueba HTTP con PostgreSQL ni una prueba en Android o iOS**. El caso de precisión decimal simula expresamente la escala de la columna de la base.

## Errores prioritarios P1

### 1 Una contraseña antigua puede abrir una sesión después de restablecerla

[Inicio de sesión](../apps/api/src/identity/auth.service.ts#L75) verifica la contraseña antes de emitir el token y no coordina ambas acciones con el restablecimiento. Un login puede verificar el hash antiguo, quedar pendiente, terminar el cambio de contraseña y su revocación de sesiones, y después insertar una sesión nueva.

**Evidencia:** el restablecimiento deja cero tokens vivos; al continuar el login aparece un token nuevo y `sesionSigueViva` devuelve `true`. El usuario que restablece su contraseña para expulsar a quien conoce la anterior puede dejarlo dentro. La emisión debe comprobar que las credenciales verificadas siguen vigentes dentro de la misma coordinación que el cambio de contraseña.

### 2 Una renovación puede sobrevivir a un cierre de sesión completado

[Revocación de la familia](../apps/api/src/identity/tokens-refresco.service.ts#L348) hace dos escrituras separadas. Entre ellas, un refresh que había leído un token rotado admisible por gracia puede consumir esa gracia y crear otro sucesor. La segunda escritura del cierre solo busca tokens con motivo `rotacion` y no alcanza el sucesor nuevo.

**Evidencia:** cierre y refresh terminan correctamente, pero el token `after-logout` sigue vivo. La secuencia utiliza operaciones completadas entre las dos escrituras, sin necesitar lecturas de cambios sin confirmar. El cierre y la renovación deben compartir la misma serialización por cuenta o familia.

### 3 Cinco recorridos guardan datos después de retirar el consentimiento

[ConsentimientoGuard](../apps/api/src/identity/consentimiento.guard.ts#L60) comprueba el consentimiento antes de entrar al controlador. Los servicios de [seguimiento](../apps/api/src/seguimiento/seguimiento.service.ts#L126), [molestias](../apps/api/src/entrenamiento/molestias.service.ts#L81) y [comidas](../apps/api/src/nutricion/comidas.service.ts#L75) no vuelven a comprobarlo durante la escritura.

**Reproducción:** el guard permite la petición; se completa `retirar` y el consentimiento pasa a `vigente:false`; después se guarda un diario, una medida, una prueba, una molestia o una comida. Los cinco casos producen `persistedAfterWithdrawal:true`.

Ya existe el mecanismo para impedirlo en [exigirVigente](../apps/api/src/identity/consentimiento.service.ts#L54): comprueba y bloquea la fila del consentimiento dentro de la transacción. Los recorridos afectados deben aplicar esa protección. Este hallazgo describe la regla del código, sin emitir una evaluación legal.

## Errores de funcionamiento P2

### 4 Editar una dieta elimina información que ya estaba guardada

[desdeDocumento](../apps/mobile/src/nutricion/editor-modelo.ts#L189) y [convertir](../apps/mobile/src/nutricion/editor-modelo.ts#L404) descartan suplementos, nota, cálculo, `registroComidas` y margen de calorías. La API sustituye el documento completo al guardar.

**Reproducción:** abrir una dieta válida, cambiar solo el nombre y guardar. Los campos desaparecen con `errores: []`; quitar `registroComidas:false` hace que el cliente vuelva al registro habilitado por defecto. El editor debe conservar los campos que no permite modificar.

**También ocurre desde Pauta:** [textosIniciales y pautaDesde](../apps/mobile/src/nutricion/pauta.tsx#L67) reducen suplementos a un interruptor de creatina. Cambiar solo la nota de una dieta con Creatina de 2 g y Magnesio de 200 mg elimina el Magnesio, cambia la creatina a 3–5 g y elimina `calculo.nota`. La reproducción adicional confirma este segundo recorrido de la misma pérdida de información.

### 5 Editar una rutina elimina parte de su prescripción

[Conversión del editor profesional](../apps/mobile/src/entrenamiento-entrenador/editor-modelo.ts#L154) reconstruye únicamente una parte del documento. El recorrido de EditorRutina y EditorPlan pierde duración, notas, partes y circuito de la sesión; sección, RIR, descanso, dosis, subida, alternativas, compuesto y notas del ejercicio; y `repeticionesMax`.

**Reproducción:** cargar una rutina con calentamiento, descanso de 60 segundos y rango de 8–10 repeticiones; cambiar solo su nombre y guardar. Se obtiene un ejercicio sin sección ni descanso y con objetivo fijo de 8. La conversión debe preservar los datos fuera de los campos editados.

### 6 El constructor cambia series distintas al adaptar una rutina

[Carga de la primera serie](../apps/mobile/src/entrenamiento-entrenador/constructor/modelo.ts#L154) toma su carga y objetivo como los de todo el ejercicio. La protección solo detecta mezclas de unidades, no series distintas dentro de la misma unidad.

**Evidencia:** una rutina con `20 kg × 12` y `40 kg × 8`, adaptada sin editar sus series, se transforma en `20 kg × 12` y `20 kg × 12`. `faltaEnDia` devuelve `null`. Hay que conservar las diferencias o advertir que la fila no puede representarlas antes de publicar.

### 7 Una respuesta lenta marca cambios posteriores como guardados

[Guardar borrador de dieta](../apps/mobile/src/nutricion/editor-dieta.tsx#L105) permite seguir editando durante la petición y fuerza el estado `guardado` cuando llega la respuesta.

**Reproducción:** guardar A, escribir B antes de recibir respuesta y esperar. El servidor recibe A; la pantalla muestra B como «Guardado». «Volver a la dieta» sale sin confirmación y pierde B. Editar durante la espera también vuelve a habilitar Guardar, permitiendo otra petición. El resultado debe referirse a la versión enviada o debe bloquearse la edición durante el guardado.

### 8 El reintento de publicar una dieta queda bloqueado tras guardar

[Publicar cambios](../apps/mobile/src/nutricion/ficha-nutricion.tsx#L243) guarda el borrador y después publica, pero no conserva la nueva revisión entre ambas acciones.

**Reproducción:** guardar tiene éxito y publicar falla por red. Al reintentar se repite el guardado con la revisión antigua y se obtiene `revision_obsoleta`; no se vuelve a llamar a publicar. La reproducción registra revisiones de guardado `[0,0]` y una sola llamada de publicación. Hay que conservar la fase y la revisión alcanzadas por la operación.

### 9 Editar el bloque rompe el reintento de la asignación del plan

[cambiarBloque](../apps/api/src/entrenamiento/planes.service.ts#L180) incrementa `version`. [El reintento de asignar](../apps/api/src/entrenamiento/planes.service.ts#L50) pasa esa versión a [leerDocumento](../apps/api/src/entrenamiento/documentos.ts#L30), que solo acepta `1`.

**Evidencia:** la repetición inicial devuelve el plan; editar el bloque deja versión 2; repetir exactamente la asignación original devuelve 500. Se está utilizando el mismo campo para revisión editable y versión del formato guardado.

### 10 Un reintento de molestia puede descartar síntomas nuevos

[Comprobación de la operación repetida](../apps/api/src/entrenamiento/molestias.service.ts#L69) solo compara sesión e intensidad. Ignora ejercicio, serie, zona, síntomas y nota.

**Reproducción:** reutilizar el UUID con la misma intensidad, cambiando hombro sin síntomas por codo con `pinchazo`. Se devuelve el aviso anterior sin conflicto, síntomas vacíos y nivel ámbar, aunque la petición nueva produciría nivel rojo. Debe comprobarse todo el contenido de la operación.

### 11 Dos peticiones simultáneas del mismo registro generan un error interno

[Medidas](../apps/api/src/seguimiento/seguimiento.service.ts#L154), [pruebas](../apps/api/src/seguimiento/seguimiento.service.ts#L219), [comentarios](../apps/api/src/entrenamiento/comentarios.service.ts#L62) y [molestias](../apps/api/src/entrenamiento/molestias.service.ts#L63) consultan si existe el UUID y luego crean, sin serialización ni recuperación del conflicto único.

**Evidencia:** con ambas lecturas viendo ausencia, una inserción gana y la otra lanza `P2002` sin convertirlo en una respuesta HTTP del contrato. Los cuatro recorridos producen una aceptación y un error interno. El caso se simula con la restricción única; falta repetirlo contra PostgreSQL. Debe devolverse el resultado existente cuando el contenido coincide.

### 12 La limpieza de fotos borra una subida que acaba de renovarse

[LimpiezaMedios](../apps/api/src/medios/limpieza-medios.ts#L115) borra el objeto antes de comprobar que la intención sigue caducada.

**Reproducción:** la limpieza selecciona una intención vieja y queda pendiente al borrar; el cliente renueva, recibe otro enlace y sube a la misma clave; el borrado tardío elimina esa foto nueva. La fila se conserva porque su caducidad ya fue renovada. Resultado: intención válida, `rowsCleaned=0`, archivo inexistente. Renovación y limpieza deben coordinar el uso de la clave temporal.

### 13 La API permite registrar comidas configuradas solo para consulta

[ComidasService.registrar](../apps/api/src/nutricion/comidas.service.ts#L70) no comprueba `documento.registroComidas`. La app oculta las acciones con el valor `false`, pero una petición válida directa todavía escribe el registro.

**Evidencia:** dieta con `registroComidas:false`, elección completa y válida: una escritura aceptada. La configuración profesional debe respetarse también en el servidor.

### 14 Un plato de intercambio incompleto se acepta como comida hecha

[comprobarEleccion](../apps/api/src/nutricion/comidas.service.ts#L38) comprueba duplicados y pertenencia, pero no exige representar todas las columnas pautadas.

**Reproducción:** comida con Proteína e Hidratos; se envía únicamente Pollo de Proteína y se guarda. La especificación y la pantalla exigen combinar un alimento de cada columna. Debe validarse la cobertura completa de las columnas cuando la elección es de tipo `plato`.

### 15 Una comida puede guardarse contra una dieta que acaba de archivarse

[Registro de comida](../apps/api/src/nutricion/comidas.service.ts#L65) lee la dieta vigente y comprueba su ID, pero la escritura posterior no comparte transacción o bloqueo con la publicación.

**Reproducción:** registrar lee A; se completa publicar B, que archiva A; registrar guarda con ID A. No aparece `revision_obsoleta`, pese al contrato que exige rechazar si cambió la dieta. El control de vigencia debe cubrir también la escritura.

### 16 Una prueba admite decimales que la base redondea y después rechaza el reintento

[Contrato de pruebas](../packages/shared/src/seguimiento.ts#L175) acepta números sin límite de decimales, mientras [la columna](../apps/api/prisma/schema.prisma#L584) es `Decimal(8,2)`. [El reintento](../apps/api/src/seguimiento/seguimiento.service.ts#L226) compara el valor almacenado con la entrada mediante igualdad exacta.

**Evidencia con escala de base simulada:** `1.234` pasa validación, se almacena como `1.23` y repetir exactamente la entrada devuelve 409. Contrato, normalización e igualdad deben utilizar la misma precisión. Las medidas corporales no presentan este desajuste.

### 17 Una foto llega después de revisar la solicitud y conserva el estado revisado

[Revisar solicitud](../apps/api/src/seguimiento/solicitudes-fotos.service.ts#L141) permite cerrar lo recibido aunque haya otra intención pendiente. [Confirmar esa intención](../apps/api/src/medios/medios.service.ts#L316) añade la foto, pero solo cambia solicitudes que estaban `pendiente`.

**Reproducción:** solicitud de frente y espalda; llega frente y espalda queda pendiente; el entrenador revisa una foto; el cliente confirma espalda. Ahora hay dos fotos disponibles y la solicitud conserva «revisada» y la fecha anterior. La segunda aportación no se presenta como pendiente de revisión. Debe rechazarse la intención anterior o registrar una nueva aportación pendiente de revisar.

### 18 Las ráfagas simultáneas pasan el límite de intentos de login

[AuthService](../apps/api/src/identity/auth.service.ts#L50) comprueba el contador antes de consultar y verificar Argon2, y contabiliza el fallo al terminar.

**Evidencia:** 20 llamadas simultáneas desde la misma IP alcanzan la consulta y verificación; todas responden 401 y ninguna 429. Solo la siguiente petición recibe 429. La protección no limita los intentos en curso, por lo que permite acumular verificaciones en una ráfaga. No se hizo una prueba de carga ni se estimó consumo máximo de memoria.

### 20 El reintento de publicar un plan cambia sus propias series y acaba duplicando el plan

[preparar](../apps/mobile/src/entrenamiento-entrenador/constructor/constructor.tsx#L282) reconstruye la solicitud utilizando la operación pendiente, pero [seriesDeFila](../apps/mobile/src/entrenamiento-entrenador/constructor/modelo.ts#L305) genera UUID nuevos para las series recién añadidas. El estado editable no recibe los UUID de la primera solicitud. Aunque no se toque ningún campo, el reintento tiene otro contenido con la misma operación.

**Reproducción con ConstructorPlan y PlanesService reales:** la primera publicación crea seis sesiones y pierde su respuesta. «Reintentar publicación» devuelve `409 operacion_incompatible` y elimina el pendiente. Pulsar Publicar de nuevo utiliza otra operación y crea otras seis sesiones. Resultado: dos planes y doce sesiones para un único plan que se intentaba confirmar. El reintento debe usar exactamente la solicitud persistida.

### 21 Dos renovaciones simultáneas revocan la sesión que acaba de ganar

[canjear](../apps/api/src/identity/tokens-refresco.service.ts#L78) lee el token antes de adquirir el bloqueo del usuario. La segunda transacción pierde la escritura condicional, pero [decide si fue rotación o reutilización](../apps/api/src/identity/tokens-refresco.service.ts#L154) usando la lectura anterior, que todavía mostraba un token vivo. Interpreta reutilización y revoca toda la familia, incluido el sucesor recién emitido.

**Evidencia con transacciones serializadas en memoria:** dos llamadas que leyeron antes de la primera rotación terminan `[200,401]`, con cero tokens vivos y `winnerSessionStillAlive:false`. La [prueba HTTP existente](../apps/api/test/carrera-refresco.e2e-spec.ts#L93) exige que permanezca una sesión viva, pero no se ejecutó en esta auditoría por falta de PostgreSQL. Hay que releer el estado después de adquirir el bloqueo.

### 22 Una renovación desde otra pestaña cierra la cuenta y borra sus borradores

[Petición autenticada](../apps/mobile/src/lib/peticion-autenticada.ts#L68) revoca la sesión si el reintento recibe otro 401. [El proveedor](../apps/mobile/src/sesion.tsx#L126) comprueba únicamente que la cuenta compartida coincide, aunque otra pestaña acabe de renovar correctamente esa misma cuenta.

**Reproducción web:** A renueva y queda pendiente su reintento; B renueva, revoca el acceso de A y completa su petición; el reintento de A recibe 401. El proveedor real pasa a `fuera`, borra el token de refresco compartido y limpia el borrador pendiente. El candado de credenciales no abarca la petición posterior. La revocación debe distinguir credenciales rechazadas de una rotación posterior en otra pestaña.

### 23 Dos primeras escrituras reemplazan la clave de cifrado compartida

[recuperarClave](../apps/mobile/src/entrenamiento/clave-local.ts#L18) comprueba ausencia de clave y documentos antes de esperar a generar una clave. Dos pestañas pueden superar esas comprobaciones y guardar claves diferentes. La [cola del almacén](../apps/mobile/src/entrenamiento/almacen-local.ts#L29) solo coordina cada instancia.

**Evidencia con funciones reales y AES-GCM:** A cifra y guarda un borrador con la primera clave; B sustituye la clave compartida y guarda otro documento. Quedan dos documentos, B se lee y A falla autenticación. La clave necesaria para A se ha perdido. La creación de la clave debe coordinarse entre pestañas.

### 24 Dos pestañas sobrescriben borradores offline sin avisar

[Persistencia web](../apps/mobile/src/entrenamiento/persistencia.web.ts#L7) comparte una sola clave por sesión. [RegistroControl](../apps/mobile/src/entrenamiento/registro-control.ts#L172) sustituye el documento completo sin comprobar si cambió desde otra instancia.

**Reproducción:** dos pestañas abren el mismo entrenamiento y editan sin conexión. Ambas muestran guardado local y `conflicto:false`. A guarda sus notas y series; B guarda las suyas; recargar A recupera únicamente B y `respaldo:null`. Debe detectarse la versión compartida o conservar copias independientes.

### 25 Una reactivación tardía vuelve a bloquear una cuenta activada

[reactivar](../apps/api/src/identity/usuarios.service.ts#L344) calcula el nuevo estado a partir de una lectura anterior y después actualiza únicamente por ID. Dos reactivaciones pueden leer una cuenta desactivada sin contraseña. La primera reactiva a pendiente; el titular recibe un enlace y activa; la segunda vuelve a escribir `pendiente` sobre el estado activo.

**Evidencia con los servicios reales de usuarios, activación y login:** estado `activo` antes de la escritura retrasada, `pendiente` después, contraseña fijada y login con la contraseña correcta devuelve 401. La transición debe comprobar el estado vigente dentro de la misma coordinación que la activación.

### 26 Un nombre válido de perfil rompe el listado de fotos

[PerfilSchema](../packages/shared/src/index.ts#L114) admite nombre de 80 caracteres y apellidos de 120. [medioPublico](../apps/api/src/medios/medios.service.ts#L50) los une con un espacio, produciendo 201 caracteres, pero [el autor](../packages/shared/src/medios.ts#L88) admite un máximo de 200.

**Reproducción:** actualizar el perfil con esos valores válidos y consultar fotos de ese autor. `deCliente` lanza `ZodError` en `autor.nombre`; una sola fila rompe el listado entero. El contrato de autor de valoraciones presenta el mismo límite, aunque la reproducción se limita a fotos. Los límites de entrada y salida deben ser compatibles.

### 27 Un resultado con definición desconocida se pierde silenciosamente

[Cambiar valoración](../apps/api/src/seguimiento/valoraciones.service.ts#L217) filtra UUID desconocidos antes de validar y completa los resultados ausentes como pendientes. Así evita la comprobación [«Resultado sin definición»](../packages/shared/src/valoraciones.ts#L422).

**Reproducción:** borrador con peso registrado de 80; enviar peso 90 con un UUID de definición ajeno. La petición devuelve éxito y revisión 2; el peso anterior pasa a pendiente. Debe rechazarse la entrada inválida en vez de transformar el documento guardado.

### 28 Una valoración con solo grasa por pliegues no se puede publicar

[Publicar valoración](../apps/api/src/seguimiento/valoraciones.service.ts#L468) exige resultados corporales, pruebas o conclusión, pero omite `grasaPorPliegues`, que el contrato admite como resultado independiente.

**Reproducción:** documento válido con bloque de pliegues, 18,5 %, método y fecha, sin otras medidas ni conclusión. Se guarda, pero publicar devuelve 400 «Anota algún resultado o una conclusión». La comprobación debe incluir ese resultado.

### 29 Dos publicaciones idénticas producen un conflicto falso

[Publicar](../apps/api/src/seguimiento/valoraciones.service.ts#L474) devuelve `revision_obsoleta` cuando otra transacción ya cerró el borrador. La recuperación de replay en línea 506 solo maneja una restricción única.

**Evidencia con la segunda escritura esperando a la primera:** dos POST con el mismo autor, UUID, borrador y revisión producen una publicación y un 409. Un tercer POST idéntico sí devuelve la publicación. Contradice la idempotencia de [la especificación](../SPEC-seguimiento-corporal.md#L41). Al perder el cierre condicional debe comprobarse si la misma operación ya terminó.

### 30 Asociar una foto puede terminar después de publicar y dejarla fuera

[vincularFoto](../apps/api/src/seguimiento/valoraciones.service.ts#L575) comprueba que el borrador está abierto antes de escribir el vínculo, sin coordinarlo con publicar. La publicación puede terminar y pasar por su actualización de fotos antes de que se cree la asociación.

**Reproducción:** asociar lee el borrador; publicar termina; la asociación escribe y devuelve éxito. La foto queda vinculada con `publicadaEn:null`, el borrador está cerrado y el listado de esa visita para el cliente devuelve cero fotos. Hace falta otra corrección y publicación para mostrarla allí. La asociación y el cierre deben compartir la coordinación del borrador.

### 31 Resolver un conflicto después de publicar rompe el editor

[Resolver conflicto](../apps/mobile/src/seguimiento/borrador-valoracion.tsx#L309) sustituye el estado sin comprobar si sigue existiendo un borrador. Si otro dispositivo publicó, la respuesta contiene `borrador:null`.

**Reproducción:** A entra en conflicto; B publica; A pulsa cualquiera de las dos acciones de resolución. El siguiente render lanza `TypeError` al leer `documento` en línea 219. El editor debe manejar que el borrador se haya cerrado.

### 32 Cambiar una solicitud de fotos tras perder la respuesta bloquea su reintento

[Solicitud de fotos](../apps/mobile/src/seguimiento/solicitudes-fotos.tsx#L222) conserva el UUID hasta recibir éxito, mientras el formulario permite modificar la indicación y las vistas.

**Reproducción contra el servicio real en memoria:** A se crea pero se pierde su respuesta; editar la indicación a B y volver a enviar reutiliza el UUID con otro contenido. Todos los reintentos reciben `409 operacion_incompatible`. Hay que conservar la solicitud original hasta confirmar su resultado, o separar su confirmación de una operación nueva.

### 33 La respuesta de un guardado cierra otro formulario y pierde su texto

[HoyDiario.confirmar](../apps/mobile/src/seguimiento/hoy-diario.tsx#L177) cierra el diálogo vigente al terminar cualquier guardado, sin asociar ese cierre con el formulario enviado.

**Reproducción:** guardar peso con respuesta lenta; cancelar; abrir Sueño y escribir `7:40`; recibir la respuesta del peso. Se cierra Sueño y reabrirlo reemplaza su texto por vacío. El segundo valor nunca se envió. El resultado debe actuar sobre la edición que originó la petición.

### 34 Repetir un ejercicio altera «Anterior» y «Fuerza»

Una sesión válida puede repetir un ejercicio del catálogo en calentamiento y parte principal, con IDs prescritos distintos. [anteriores](../apps/api/src/entrenamiento/sesiones.service.ts#L168) elimina el ejercicio buscado al procesar su primera aparición. [fuerza](../apps/api/src/entrenamiento/sesiones.service.ts#L248) produce un punto por aparición en lugar de la mejor serie del ejercicio en la sesión.

**Evidencia:** banca con `20 kg × 5` de calentamiento y `60 kg × 5` principal. Anterior devuelve 20 kg; Fuerza devuelve dos puntos en la misma fecha, con estimaciones 23,3 y 70. También cuenta dos apariciones al seleccionar ejercicios por frecuencia. Debe considerar todas las apariciones y escoger la mejor por ejercicio y sesión.

### 35 «Anterior» oculta ejecuciones existentes después de 60 sesiones ajenas

[La consulta](../apps/api/src/entrenamiento/sesiones.service.ts#L149) solo lee las últimas 60 sesiones enviadas, sin filtrar primero por los ejercicios buscados ni paginar.

**Reproducción:** 60 sesiones de otro ejercicio y una sesión previa del buscado. Devuelve `anteriores:[]` aunque existe una ejecución válida. El contrato promete la mejor serie de la última vez sin esa ventana. Hay que buscar hasta localizar los ejercicios o consultar sus referencias.

### 36 Se confirma como foto disponible un PNG sin cabecera ni píxeles

[El saneamiento PNG](../apps/api/src/medios/imagenes.ts#L204) comprueba firma, tipos y límites de bloques, pero no exige un `IHDR` válido ni ningún `IDAT`. [Confirmar](../apps/api/src/medios/medios.service.ts#L270) almacena el resultado como disponible.

**Evidencia:** archivo de 32 bytes con firma PNG, `IHDR` vacío e `IEND`, ambos con CRC válido: se acepta, se guarda definitivamente y la confirmación repetida devuelve esa foto. El decodificador `System.Drawing.Image.FromStream` rechaza los mismos bytes. Debe comprobarse que el archivo contiene una imagen decodificable.

### 39 Detrás del proxy, los fallos de una persona bloquean el login de otras

[Arranque](../apps/api/src/main.ts#L14) no configura confianza en el proxy. Express la desactiva por defecto y [el login](../apps/api/src/identity/auth.controller.ts#L39) utiliza `req.ip` para el contador global de origen. El [despliegue previsto](../docs/DESPLIEGUE.md#L129) pasa por un proxy HTTPS.

**Evidencia con Express y AuthService reales en memoria:** dos peticiones con IP originales distintas en `X-Forwarded-For`, remitidas por el proxy local, obtienen ambas `127.0.0.1`. B entra correctamente al principio; tras seis fallos de A, B recibe 429 con su contraseña válida. Su contador por correo no está bloqueado; el contador global compartido sí. Debe confiarse únicamente en el proxy previsto y obtener correctamente el origen. El caso aplica a un proxy convencional que remite las IP por cabeceras; no se inspeccionó un despliegue real.

### 40 Una pauta creada por la app se reabre con porcentajes inválidos

[porcentajesDe](../apps/mobile/src/nutricion/calculo.ts#L29) redondea cada porcentaje por separado a partir de los gramos guardados. [pautaDesde](../apps/mobile/src/nutricion/pauta.tsx#L109) exige que la suma sea exactamente 100, sin compensar el redondeo al reconstruir el formulario.

**Reproducción:** crear 3.250 kcal con 34,5 / 35,5 / 30 %, aplicar la pauta y reabrir. El documento válido guarda 280 / 288 / 108 g; se reconstruye como 34 / 35 / 30 %, suma 99, y se bloquea publicar sin editar nada. Con 825 kcal y 45 / 25 / 30 %, la reapertura suma 101. La conversión debe conservar el reparto o ajustar su reconstrucción a un total válido.

### 41 Activar peso diario descarta la indicación cuando ya hay diez

[aplicarPauta](../apps/mobile/src/nutricion/calculo.ts#L83) añade «Peso en ayunas» después de las indicaciones existentes y luego recorta el array a diez. Si ya hay diez indicaciones distintas, la nueva es precisamente la descartada.

**Reproducción:** dieta válida con diez indicaciones; activar Peso diario, aplicar y publicar. El documento resultante pasa el esquema, conserva las diez anteriores y no contiene la instrucción activada. Reabrir muestra el interruptor desactivado. Debe avisarse del límite o permitir decidir qué indicación sustituir.

## Errores menores P3

### 19 Consultar el plan provoca un aviso falso de cambios pendientes

[hayCambiosLocales](../apps/mobile/src/entrenamiento/documento-local.ts#L64) considera pendiente cualquier clave `plan-`. [PlanCliente](../apps/mobile/src/entrenamiento/plan/plan-cliente.tsx#L83) utiliza el mismo prefijo para copias de consulta.

**Reproducción:** abrir «Tu plan» sin editar nada y cerrar sesión. Se exige «Descartar y cerrar». Un almacén con únicamente `plan-2026-09-28` devuelve `hayCambiosLocales=true`. Hay que distinguir caché de consulta y operaciones pendientes.

### 37 El limitador copia el correo completo a los logs

[La clave del login](../apps/api/src/identity/auth.service.ts#L48) incluye correo e IP y [se imprime íntegra](../apps/api/src/identity/limitador-intentos.service.ts#L87) en el sexto fallo. La captura del logger con un correo sintético confirma que contiene el correo completo. Conviene enmascarar o sustituir el identificador de cuenta, como ya hace [el servicio de correo](../apps/api/src/correo/correo.service.ts#L79). La [política del despliegue](../docs/DESPLIEGUE.md#L164) evita copiar datos reales a logs. Este caso no acredita exposición de datos de salud.

### 38 Una hora de sueño inválida se transforma silenciosamente

[leerSueno](../apps/mobile/src/seguimiento/modelo.ts#L34) acepta un componente de minutos mayor que 59. `7:99` se convierte en 519 minutos, pasa el contrato y después aparece como `8 h 39`. Debe rechazarse el formato inválido antes de convertirlo.

## Riesgo pendiente de comprobar con PostgreSQL

**Mover y enviar una sesión toman los bloqueos en orden opuesto.** [Mover](../apps/api/src/agenda/agenda.service.ts#L41) bloquea agenda y luego inserta una novedad con FK a entrenamiento. [Enviar](../apps/api/src/entrenamiento/sesiones.service.ts#L102) bloquea entrenamiento con `FOR UPDATE` y luego actualiza agenda. El acceso `KEY SHARE` exigido por el FK puede cerrar el ciclo entre ambas transacciones.

El modelo explícito de bloqueos, ejecutando ambos servicios reales, reproduce el ciclo y la propagación de `P2034` sin recuperación. **No se ha observado un deadlock real en PostgreSQL**, por lo que este caso no cuenta entre los 41 errores reproducidos. Debe probarse la intercalación en una base dedicada antes de cerrar la conclusión.

## Comprobaciones ejecutadas

| Comprobación                      | Resultado                                                                                                                                                                                     |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tipos con `npm run typecheck`     | Correctos en la base revisada. La repetición posterior falla en una prueba nueva de trabajo concurrente, fuera del alcance seleccionado por el usuario. No se declara limpio el árbol actual. |
| Compilación de la API             | Correcta con `npm run build --workspace apps/api`.                                                                                                                                            |
| Unitarios API                     | 192 pruebas y 23 suites correctas.                                                                                                                                                            |
| Unitarios móviles                 | 613 pruebas y 70 suites correctas con `--runInBand`.                                                                                                                                          |
| Primera ejecución conjunta        | 612 móviles correctas y un timeout en el constructor; sus 11 casos pasan aislados y la suite móvil completa pasa después en serie. No se clasifica como defecto funcional confirmado.         |
| Exportación web                   | Correcta con API configurada y caché reconstruida. Acceso público, validación de campos vacíos y navegación a recuperación comprobados en navegador. Recuperación observada a 360 px.         |
| ESLint                            | Correcto.                                                                                                                                                                                     |
| Prettier                          | Falla por `.claude/launch.json` y el nuevo plan `docs/superpowers/plans/2026-09-30-ampliacion-catalogo.md`. Se conservaron esos archivos.                                                     |
| `git diff --check`                | Correcto; el informe se comprueba también con Prettier.                                                                                                                                       |
| HTTP con PostgreSQL               | No ejecutado: TCP local 5432 devuelve `ECONNREFUSED` y Docker no tiene un motor activo accesible. No se usó la base habitual.                                                                 |
| Dispositivo físico y proveedor S3 | No comprobados en esta pasada.                                                                                                                                                                |

Las comprobaciones de compilación y unitarios corresponden a la base indicada. El trabajo concurrente posterior queda fuera del alcance seleccionado por el usuario; no se corrigieron ni formatearon sus archivos.

## Repetir las reproducciones

Se conservaron scripts y logs sintéticos en `build/audit/`, ignorados por Git. Los scripts viven dentro de `dist` para que no alteren los controles del código de aplicación. Desde la raíz, con dependencias instaladas y API compilada:

```powershell
node build/audit/dist/seguridad-repro.mjs
node build/audit/dist/dominio-repro.mjs
node build/audit/dist/mobile-repro.cjs
node build/audit/dist/reproduce-root.cjs
node build/audit/dist/constructor-repro.cjs
node build/audit/dist/identidad-repro.mjs
node build/audit/dist/identidad-adicional-repro.mjs
node build/audit/dist/valoraciones-repro.mjs
node build/audit/dist/offline-repro.cjs
node build/audit/dist/seguimiento-ui-repro.cjs
node build/audit/dist/agenda-sesiones-repro.mjs
node build/audit/dist/proxy-repro.mjs
node build/audit/dist/nutricion-calculo-repro.cjs
```

Los trece terminaron con salida 0: las aserciones comprueban que los defectos descritos ocurren. El caso de bloqueo de `agenda-sesiones-repro.mjs` es un modelo SQL y se mantiene como riesgo pendiente. No son pruebas de que los errores estén corregidos. Los scripts de identidad se ejecutan fuera de la búsqueda del `.env` del repositorio y usan únicamente valores sintéticos.

La siguiente corrección debe empezar por los tres P1, continuar por las pérdidas de prescripción y los reintentos, y añadir regresiones de cada escenario antes del cambio. Las carreras deben repetirse posteriormente en una base dedicada y las fotos con el proveedor real.
