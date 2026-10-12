> Estado: vigente. Contrato de colores y estados de Flash Pop. Revisado: 2026-10-05.

# Colores y estados

La fuente de verdad es [`app/globals.css`](../../app/globals.css), en `app-tokens`.
Los [fundamentos del catálogo](../../features/design-system/Foundations.tsx), disponibles en
`/design-system/fundamentos` únicamente en desarrollo, muestran los pares claros, sólidos e
inverse, bordes y errores después de aplicar la cascada. La organización y mantenimiento están en
[`design-system.md`](design-system.md).

## Elegir un rol

- `--ds-color-bg-*`: fondos sólidos y superficies. No usar como texto de feedback.
- `--ds-color-fg-*`: texto e iconos informativos sobre las superficies claras.
- `--ds-color-fg-on-{rol}`: texto e iconos sobre el fondo sólido de ese rol.
- `--ds-color-fg-{rol}-inverse`: acentos sobre `bg-inverse`.
- `--ds-color-border-*`: delimitadores. Los bordes de estado usan el foreground de su estado,
  y su variante `-inverse` cuando están sobre inverse.
- `--ds-color-focus-ring`: foco visible sólido, con separación respecto al control.

`fg-secondary` sirve para ayudas, placeholders, etiquetas y metadatos. `fg-disabled` se reserva
para controles inactivos y `fg-decorative` para elementos sin información. Estos dos últimos
no cumplen el contrato de contraste de texto normal y no sustituyen a secondary.

## Fundamentos

| Rol                         | Valor   | Uso                          |
| --------------------------- | ------- | ---------------------------- |
| bg-canvas                   | #f4f1ea | Fondo crema de la aplicación |
| bg-surface                  | #ffffff | Tarjetas y campos            |
| bg-surface-raised           | #fbfaf6 | Superficie elevada           |
| bg-surface-soft             | #eae7ff | Superficie neutral suave     |
| bg-inverse                  | #171720 | Superficie oscura            |
| fg-primary                  | #171720 | Texto principal claro        |
| fg-secondary                | #686872 | Texto secundario legible     |
| fg-disabled / fg-decorative | #94949c | Inactividad / decoración     |
| fg-on-inverse               | #ffffff | Texto principal inverse      |
| fg-secondary-inverse        | #b8b8c2 | Texto secundario inverse     |

## Estados y acentos

Todas las columnas son tokens con el prefijo `--ds-color-`.

| Rol      | bg-{rol} | fg-{rol} | fg-{rol}-inverse | fg-on-{rol} |
| -------- | -------- | -------- | ---------------- | ----------- |
| brand    | #d7ff19  | #171720  | #d7ff19          | #171720     |
| selected | #6957e8  | #5142b8  | #c4b5fd          | #ffffff     |
| success  | #0f766e  | #0f766e  | #67d7be          | #ffffff     |
| error    | #ff7276  | #a71930  | #ff7276          | #171720     |
| info     | #74a7f5  | #245aa6  | #74a7f5          | #171720     |
| reward   | #ffd85a  | #805000  | #ffd85a          | #171720     |

`bg-success-soft`, `bg-error-soft`, `bg-info-soft` y `bg-reward-soft` mezclan en sRGB el 12 %
del fondo sólido con `bg-surface`. `bg-selected-soft` referencia `bg-surface-soft`.
Los avisos ordinarios utilizan estas superficies y su foreground de estado; los avisos sólidos
utilizan `fg-on-{rol}`. No reducir la opacidad del texto de un aviso.

En puzzles: acierto → success; error → error; seleccionado → selected; movible → brand;
neutral → surface-soft. Los colores que identifican parejas, regiones o símbolos siguen siendo
locales al formato. La forma, el patrón y las etiquetas existentes siguen acompañando al color.

## Bordes, foco y transparencia

| Rol               | Valor          | Uso                                    |
| ----------------- | -------------- | -------------------------------------- |
| border-subtle     | Ink al 12 %    | Delimitación decorativa                |
| border-default    | Ink al 14 %    | Separación de superficies              |
| border-hover      | Ink al 28 %    | Refuerzo de hover                      |
| border-action     | Ink al 78 %    | Delimitación esencial de acciones      |
| border-strong     | #80808a        | Campos e indicadores esenciales claros |
| border-brand      | Ink al 36 %    | Borde de marca existente               |
| border-ink        | fg-primary     | Borde opaco Ink existente              |
| border-on-inverse | fg-on-inverse  | Borde blanco opaco existente           |
| focus-ring        | #4d3bd1        | Foco sobre superficies claras          |
| bg-overlay        | Ink al 84 %    | Overlay                                |
| border-overlay    | Blanco al 16 % | Delimitación decorativa del overlay    |

Subtle, default, hover, brand y overlay son delimitadores decorativos: no garantizan 3:1.
Usar strong, action o un borde de estado para comunicar información esencial. Sobre inverse,
usar bordes de estado `-inverse`; un foco sobre inverse puede utilizar el borde selected-inverse
porque focus-ring está definido para superficies claras.

`bg-brand-hover` conserva #e1ff48. `--ds-opacity-disabled` vale 0.55 y solo se aplica a
controles inactivos. `--border-subtle`, `--border-flash` y `--border-action` conservan su geometría
y consumen los nuevos colores. Los gradientes, sombras y efectos conservan sus proporciones
originales. La transparencia se evalúa compuesta sobre la superficie real, nunca sobre blanco
por defecto cuando hay otra superficie debajo.

## Equivalencias de migración

La API anterior está retirada; esta tabla explica la migración y no define aliases de compatibilidad.

| Nombre anterior                                        | Sustitución según función                                                            |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------ |
| color-canvas / surface / surface-raised / surface-soft | bg-canvas / bg-surface / bg-surface-raised / bg-surface-soft                         |
| color-ink                                              | fg-primary, bg-inverse o border-ink                                                  |
| color-ink-muted / color-muted                          | fg-secondary                                                                         |
| color-ink-faint                                        | fg-secondary para información; fg-disabled o fg-decorative para sus usos específicos |
| color-brand / color-accent                             | bg-brand para acciones y marca; fg-selected para enlaces antes llamados accent       |
| color-social                                           | bg-selected / fg-selected / border-selected                                          |
| color-danger                                           | bg-error / fg-error / border-error                                                   |
| color-success / info / reward                          | bg-{rol} / fg-{rol} / border-{rol}                                                   |
| color-text-on-*                                        | fg-on-*; social pasa a selected y danger a error                                     |
| color-line / color-border                              | border-default                                                                       |
| color-line-strong / color-border-strong                | border-strong                                                                        |
| color-border-hover                                     | border-hover                                                                         |
| color-focus / state-focus                              | focus-ring                                                                           |
| color-overlay-ink / color-overlay-border               | bg-overlay / border-overlay                                                          |
| color-disabled-opacity                                 | ds-opacity-disabled                                                                  |
| state-correct / error / selected / movable / neutral   | Roles success / error / selected / brand / surface-soft, separados por función       |

Los puentes Tailwind `--color-background` y `--color-foreground` son los únicos nombres `--color-*`
conservados y apuntan a bg-canvas y fg-primary. Los laboratorios pueden sobrescribir nuevos tokens
localmente; no deben modificar `:root`. Los documentos de `archive/` conservan la API histórica.

## Validación y mantenimiento

El contrato exige 4,5:1 para texto normal en las cuatro superficies claras, los pares sólidos,
las superficies soft de estado y inverse; exige 3:1 para foco claro e indicadores esenciales.
El caso más ajustado es fg-success sobre bg-surface-soft (aproximadamente 4,53:1), por lo que no
se debe atenuar ese foreground. Las excepciones disabled/decorative se identifican por su rol.

- `npm run style-architecture` revisa CSS y TSX, aliases locales, referencias inexistentes,
  tokens retirados y ciclos de color, espaciado, radios, sombras, tipografía, controles y movimiento.
  Reconoce las variables generadas por las llamadas a `next/font` importadas. Un fallback no
  legitima una referencia inexistente. Excluye pruebas con fixtures y fuentes generadas.
  Los aliases heredados por componentes hijos se resuelven
  estáticamente por sus definiciones; el navegador comprueba la cascada real en el catálogo.
- `npm test -- components/game/modes/flash-pop/flashPopContrast.test.ts scripts/check-style-architecture.test.mjs`
  resuelve aliases, mezclas sRGB y transparencia. Los fixtures del comprobador viven en directorios temporales.
- `npm run test:e2e:design-system -- e2e/design-tokens.spec.ts` comprueba los colores computados, contraste,
  foco, movimiento reducido, el espaciado `--space-7` (28 px) y anchura a 390 y 1280 px.

Al añadir un color compartido, definir su rol aquí y en globals, mostrar sus pares en el catálogo
y cubrir sus contrastes. La tipografía, el espaciado, los radios, las sombras y las mecánicas
no forman parte de esta migración.
