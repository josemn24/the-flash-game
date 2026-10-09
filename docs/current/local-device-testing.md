> Estado: vigente. Guía para probar la aplicación y Supabase locales desde un dispositivo externo.

# Pruebas locales desde un dispositivo externo

Esta guía permite abrir The Flash en un iPhone, un Android u otro ordenador mientras Next.js y
Supabase se ejecutan en el Mac. El dispositivo accede a la IP del Mac por la red local; el Mac
atiende las peticiones de la aplicación y se comunica con Supabase.

## Preparación

- Conecta el Mac y el dispositivo a la misma red Wi-Fi. La red debe permitir la comunicación entre
  equipos; algunas redes de invitados la bloquean.
- Mantén el Mac encendido y sin entrar en reposo durante la prueba.
- Ten Docker disponible y la configuración de Supabase en `.env.local`, con las claves del stack
  local y un usuario de prueba.
- Si necesitas preparar cuentas y desafíos, consulta
  [`supabase/local-development.md`](../../supabase/local-development.md). Los comandos de setup
  reconstruyen la base local: para probar desde el móvil con los datos que ya tienes, basta con
  arrancar los servicios.

## 1. Localizar la IP del Mac

En macOS, abre **Ajustes del Sistema → Wi-Fi → Detalles de la red → TCP/IP** y consulta la dirección
IPv4 del Mac. En los ejemplos de esta guía se usa `192.168.1.14`; sustitúyela por tu dirección actual.

La IP puede cambiar al volver a conectar el Mac o al cambiar de red. Si cambia, actualiza los pasos
siguientes y la dirección que abres en el dispositivo.

## 2. Configurar el entorno local

Conserva las claves y el resto de variables de tu `.env.local`. Para este recorrido, Supabase sigue
apuntando al propio Mac:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
FLASH_RUNTIME_SCOPE=development
APP_ORIGIN=http://192.168.1.14:3000
FLASH_DEV_ALLOWED_ORIGINS=192.168.1.14
```

`APP_ORIGIN` se muestra alineado con la dirección de la prueba. En el ámbito `development`, la API
competitiva comprueba el origen de la petición frente al destino indicado por `Host`; en `pilot`,
exige que coincida exactamente con `APP_ORIGIN`.

Configura `FLASH_DEV_ALLOWED_ORIGINS` en `.env.local` con la IP del Mac. Puedes indicar varios hosts
exactos separados por comas, por ejemplo `192.168.1.14,flash-mac.local`, sin protocolo, puerto, rutas
ni comodines. Las entradas vacías se omiten y los duplicados se eliminan; una entrada inválida
impide arrancar Next.js y muestra el nombre de la variable. No necesitas editar el código cuando
cambia la IP.

Esta lista solo añade orígenes para los recursos de desarrollo de Next.js. `127.0.0.1` permanece
permitido y Next.js admite `localhost`. `APP_ORIGIN` y la validación de la API competitiva son
independientes de esta lista.

## 3. Arrancar los servicios

Desde la raíz del proyecto, inicia Supabase si todavía no está en marcha:

```bash
npm run supabase:start
```

En otra terminal, inicia Next.js escuchando en las interfaces de red del Mac:

```bash
npm run dev -- --hostname 0.0.0.0 --port 3000
```

Si ya tenías Next.js abierto, detén ese proceso y vuelve a iniciarlo con este comando. Reinícialo
también después de modificar `.env.local`.

## 4. Abrir la aplicación en el dispositivo

En Safari del iPhone, o en el navegador del otro dispositivo, abre:

```text
http://192.168.1.14:3000
```

`localhost` y `127.0.0.1` en el iPhone apuntan al iPhone. `0.0.0.0` es la dirección de escucha del
servidor; para navegar utiliza la IP del Mac.

Inicia sesión con tu cuenta local. La sesión del navegador del Mac no se comparte con Safari del
iPhone. Acceder mediante `localhost` y mediante la IP también crea contextos de cookies distintos.

El dispositivo solo necesita acceder al puerto de Next.js, `3000` en este ejemplo. No necesitas
abrirle el puerto `54321` de Supabase ni el puerto de PostgreSQL. Si macOS solicita permiso para
conexiones entrantes de Node.js, permite el acceso para esta prueba en tu red local.

## Imágenes, subidas e identificadores por HTTP

En desarrollo, cuando `NEXT_PUBLIC_SUPABASE_URL` apunta a localhost, las URLs de Storage que recibe
el navegador se sirven a través de Next.js usando esta ruta:

```text
http://192.168.1.14:3000/__local-supabase/storage/v1/object/...
```

El Mac reenvía esas peticiones a Supabase local. El mecanismo cubre avatares, imágenes privadas
con URL firmada y subidas, y conserva los tokens de las URLs firmadas. Por eso puedes mantener
`NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321` al probar desde el móvil. La implementación está en
[`localStorageProxy.ts`](../../lib/media/localStorageProxy.ts).

Mientras este proxy está activo, Next.js permite transportar completos los archivos de hasta
50 MiB admitidos por el editor. El límite de avatares sigue siendo de 5 MiB. Para comprobar el
transporte de 1 KiB, 11 MiB y 50 MiB con Next.js real y un servidor HTTP simulado, ejecuta:

```bash
npm run test:local-storage-proxy
```

La prueba usa una aplicación temporal y puertos dinámicos, sin consultar Supabase. Los dos
escenarios de recuperación de avatares se pueden ejecutar con un stack de Supabase aislado:

```bash
npm run test:e2e:isolated -- e2e/avatar-resilience.spec.ts
```

Safari no expone `crypto.randomUUID()` al abrir una IP de la red por HTTP. Los componentes de la
aplicación usan [`randomUuid.ts`](../../lib/randomUuid.ts): aprovecha esa API cuando está disponible
y, en caso contrario, genera un UUID v4 con `crypto.getRandomValues()`, que funciona también en este
contexto. Esto permite crear las claves de operación y de subida durante la prueba.

## Recorrido de prueba

Comprueba estas acciones con los datos locales que ya tengas preparados:

- [ ] Iniciar sesión y abrir una sala de la que el usuario sea miembro.
- [ ] Ver los avatares de la sala y una pregunta que contenga una imagen de Storage.
- [ ] Abrir un desafío publicado y comprobar su pantalla de preparación.
- [ ] Iniciar Alphabet, responder y pasar una letra sin errores de confirmación.
- [ ] Recargar durante un intento recuperable y comprobar que se restaura su estado.
- [ ] Finalizar un intento y consultar el resultado.
- [ ] Subir o cambiar un avatar desde el móvil y comprobar que aparece después de recargar.

Las partidas y los cambios de avatar se guardan en la base local. Los desafíos deben estar abiertos
en su ventana de publicación y el usuario debe disponer de los intentos correspondientes.

Para documentar un fallo, anota la fecha, el dispositivo y la versión del navegador, la dirección
usada, la sala o desafío, los pasos y el resultado esperado y observado. Conserva también el código
de error y el estado HTTP que aparecen en los logs del Mac, evitando copiar cookies o tokens de
URLs firmadas.

## Resolución de problemas

| Síntoma                                                                   | Qué comprobar                                                                                                                                                                                                                                                                       |
| ------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| El navegador no conecta con el Mac                                        | Comprueba la IP actual, el puerto, que Next.js esté escuchando en `0.0.0.0` y que el Mac siga activo. Revisa el firewall y si la Wi-Fi aísla los dispositivos.                                                                                                                      |
| Next.js bloquea recursos de desarrollo                                    | Añade la IP actual a `FLASH_DEV_ALLOWED_ORIGINS` en `.env.local` y reinicia Next.js.                                                                                                                                                                                                |
| Las imágenes intentan cargar desde `127.0.0.1:54321`                      | Comprueba que ejecutas el código actualizado con `npm run dev`, que Supabase apunta a localhost y que has reiniciado Next.js. Recarga la página; las URLs de Storage entregadas al móvil deben usar `/__local-supabase/`.                                                           |
| Aparece `crypto.randomUUID is not a function`                             | Comprueba que el cliente está cargando el código actualizado que usa `randomUuid.ts`. Recarga y, si persiste una sesión o recursos antiguos, borra los datos del sitio.                                                                                                             |
| Aparece «No hemos podido confirmar la operación»                          | Consulta el error de la petición en los logs: el aviso puede tener varias causas. Si es `403 invalid_origin`, comprueba la configuración del ámbito y que ejecutas la validación actual de `Origin` y `Host`. En `pilot`, la URL usada debe coincidir exactamente con `APP_ORIGIN`. |
| La sesión o la recuperación de un intento falla tras cambiar de dirección | Vuelve a iniciar sesión en la dirección actual. Si persiste, elimina los datos de ese sitio en Safari y entra de nuevo.                                                                                                                                                             |

### Eliminar cookies y datos del sitio en Safari del iPhone

En versiones actuales de iOS, abre **Ajustes → Apps → Safari → Avanzado → Datos de sitios web**.
Elimina la entrada del sitio de pruebas si puedes identificarla. Para limpiar todos los sitios,
selecciona **Eliminar todos los datos** y confirma; esto también cerrará sesiones en otras webs.
Después, vuelve a abrir la dirección del Mac e inicia sesión.

Consulta las instrucciones de [Apple para borrar datos de Safari](https://support.apple.com/es-es/105082)
si la ubicación del ajuste difiere en tu versión de iOS.

## Alcance de la prueba y producción

Este recorrido comprueba la interfaz táctil, la autenticación, las partidas y Storage en la red
local. El registro del service worker está desactivado en `npm run dev`. Para validar el service
worker y el funcionamiento sin conexión en un iPhone, utiliza una compilación de producción
servida mediante HTTPS con un certificado que el dispositivo reconozca.

El proxy de Storage solo se activa con `NODE_ENV=development` y una URL de Supabase de localhost.
Al ejecutar `npm run build` y `npm run start`, no se configura ese proxy: las imágenes deben tener
URLs accesibles desde el dispositivo. Para las pruebas de producción, utiliza la configuración de
Supabase del entorno de destino.

En un despliegue del piloto, configura `FLASH_RUNTIME_SCOPE=pilot` y
`APP_ORIGIN=https://tu-dominio`, con el origen exacto, sin barra final. Una variable explícita
`FLASH_RUNTIME_SCOPE=development` prevalece incluso con `NODE_ENV=production`; revisa los valores
del entorno de despliegue. El nombre de un archivo `.env.staging` no garantiza que sus valores
correspondan al ámbito `pilot`.

La generación de UUID mantiene aleatoriedad criptográfica en ambos entornos. `allowedDevOrigins`
solo afecta al servidor de desarrollo, y la validación estricta del origen en `pilot` se mantiene.
