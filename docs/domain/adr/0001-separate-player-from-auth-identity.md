# ADR 0001: Separar jugador e identidad de autenticación

- Estado: aceptado.
- Fecha: 2026-09-12.

## Contexto

Supabase Auth será el primer proveedor de autenticación, pero los resultados históricos deben
permanecer cuando una persona elimina su cuenta. Usar directamente `auth.users.id` como identidad
de todas las relaciones dificultaría la anonimización, el cambio de proveedor y la conservación de
históricos.

## Decisión

El dominio tendrá un `Player` con ID estable propio y una referencia única y anulable a la identidad
de Supabase Auth. La sesión autenticada se resolverá a un jugador antes de acceder al dominio.

Al eliminar la cuenta se desvincula la identidad de autenticación y se anonimiza el perfil, pero no
se reescriben intentos ni rankings históricos.

## Consecuencias

- Se necesita una resolución segura entre `auth.uid()` y `player.id`.
- Las políticas RLS deberán utilizar esa relación y sus columnas deberán estar indexadas.
- El modelo no queda acoplado permanentemente a Supabase Auth.
- La eliminación de una cuenta no rompe claves foráneas de actividad histórica.
