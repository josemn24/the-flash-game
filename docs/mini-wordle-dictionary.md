# Diccionario de Mini-Wordle

## Propósito

Mini-Wordle acepta palabras españolas de cuatro letras mediante un vocabulario estático generado offline. El navegador descarga el recurso únicamente al comenzar este formato, lo convierte en un `Set` y lo reutiliza durante la sesión. La partida no depende de una API ni incorpora Hunspell al bundle de producción.

El vocabulario de intentos es deliberadamente más amplio que las soluciones: cada pregunta conserva una solución editorial revisada y puede declarar `additionalGuesses` para cubrir una omisión puntual de la fuente.

## Fuente y generación

El generador usa `dictionary-es@4.0.0`, derivado de `sbosio/rla-es` versión 2.8, y `nspell@2.1.5`. Comprueba todas las combinaciones de cuatro caracteres del alfabeto español, incluidas vocales acentuadas, `ü` y `ñ`, y conserva las formas reconocidas por Hunspell.

Después:

1. convierte a mayúsculas;
2. elimina tildes y diéresis;
3. conserva `Ñ` como letra distinta de `N`;
4. aplica `allow` y `deny` desde `data/dictionaries/mini-wordle-es-4.overrides.json`;
5. deduplica y ordena el resultado;
6. escribe `public/dictionaries/es-general-4.v1.json`.

Para regenerar o comprobar el artefacto:

```bash
npm run dictionary:generate
npm run dictionary:check
```

El build no regenera el archivo. Una actualización de la fuente, las reglas o las excepciones debe generar y revisar el resultado antes de versionarlo. Si cambia el contenido publicado, debe incrementarse la versión del nombre y la URL para conservar la caché inmutable.

## Métricas de la versión 1

- 2.433 palabras normalizadas.
- 17.421 bytes como JSON.
- 6.201 bytes con gzip.
- 2.767 bytes con Brotli.
- Incluye, entre otras, `AIRE`, `LUNA`, `CAÑA` y `AGIL`.

## Carga y errores

El cliente comparte una única promesa de carga. Mientras el recurso no esté disponible, el tablero permanece deshabilitado y el cronómetro no comienza. Un fallo muestra una acción de reintento; no se acepta cualquier combinación ni se recurre a un vocabulario reducido.

La evaluación de esta PoC continúa siendo local y síncrona. El componente garantiza la pertenencia al vocabulario y el evaluador comprueba la forma del historial, el máximo de intentos, la resolución y la puntuación. No constituye una barrera antitrampas.

## Licencia

El diccionario original ofrece GPL‑3.0+, LGPL‑3.0+ o MPL‑1.1+. Este proyecto utiliza la opción MPL‑1.1 o posterior y conserva la atribución en `THIRD_PARTY_NOTICES.md`. Las utilidades de empaquetado de `dictionary-es` y `nspell` usan licencia MIT.
