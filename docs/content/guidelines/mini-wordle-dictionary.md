> Estado: vigente. Generación del vocabulario y diferencias entre práctica y competición.

# Diccionarios de Mini-Wordle

## Contrato

Mini-Wordle admite palabras españolas de cuatro o cinco letras y entre uno y diez intentos.
Los valores locales predeterminados son cuatro letras y cuatro intentos. La configuración
publicada fija esos valores; los tipos y límites están en [miniWordle.ts](../../../lib/miniWordle.ts).

El vocabulario de intentos es más amplio que las soluciones. Cada pregunta conserva una
solución editorial privada y puede declarar palabras adicionales. Las variantes competitivas
pueden utilizar el diccionario general o palabras temáticas privadas; consultar sus
[contratos de formato](../../current/competitive-format-contracts.md).

## Fuente y generación

El generador usa `dictionary-es@4.0.0`, derivado de `sbosio/rla-es` versión 2.8, y
`nspell@2.1.5`. Recorre las combinaciones de la longitud elegida del alfabeto español,
incluidas vocales acentuadas, `ü` y `ñ`, y conserva las formas reconocidas por Hunspell.

Normaliza a mayúsculas, elimina tildes y diéresis, conserva `Ñ` como letra distinta,
aplica las excepciones de la longitud correspondiente y deduplica/ordena el resultado.

| Longitud | Excepciones                                                                                   | Recurso versionado                                                        |
| -------- | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| 4        | [mini-wordle-es-4.overrides.json](../../../data/dictionaries/mini-wordle-es-4.overrides.json) | [es-general-4.v1.json](../../../public/dictionaries/es-general-4.v1.json) |
| 5        | [mini-wordle-es-5.overrides.json](../../../data/dictionaries/mini-wordle-es-5.overrides.json) | [es-general-5.v1.json](../../../public/dictionaries/es-general-5.v1.json) |

Desde la raíz, ambos comandos procesan las dos longitudes:

```bash
npm run dictionary:generate
npm run dictionary:check
```

El script también admite `--length=4` o `--length=5`. El build no regenera vocabularios.
Una actualización de fuente, reglas o excepciones debe generar y revisar los recursos antes
de versionarlos. Si cambia contenido ya publicado, incrementar la versión del recurso para
conservar la caché inmutable. Las métricas están en los propios JSON; no se duplican aquí.

## Carga y evaluación

En práctica, el navegador comparte la carga del recurso de la longitud correspondiente, lo
convierte en un `Set` y evalúa localmente. Mientras se prepara el diccionario no comienza el
cronómetro. Un fallo permite reintentar; no habilita combinaciones arbitrarias ni un vocabulario
reducido alternativo. Esta evaluación local no es la autoridad competitiva.

En competición, las soluciones no se entregan al navegador. Los comandos autorizados validan
los intentos y PostgreSQL conserva su progreso y feedback; el servidor evalúa el resultado
según el contrato publicado. El [workflow de carga](../../../supabase/README.md) y
`npm run supabase:dictionary:load` preparan los diccionarios del entorno.

## Licencia

El diccionario original ofrece GPL‑3.0+, LGPL‑3.0+ o MPL‑1.1+. El proyecto utiliza la opción
MPL‑1.1 o posterior y conserva la atribución en
[THIRD_PARTY_NOTICES.md](../../../THIRD_PARTY_NOTICES.md). Las utilidades de empaquetado
de `dictionary-es` y `nspell` usan licencia MIT.
