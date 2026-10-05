import type { CSSProperties } from "react";
import { Card } from "@/components/ui";
import { TokenValue } from "./TokenValue.client";
import { FoundationScales } from "./FoundationScales.client";
import styles from "./Foundations.module.css";
import catalogStyles from "./Catalog.module.css";
import Link from "next/link";

const roles = ["brand", "selected", "success", "error", "info", "reward"] as const;
const surfaces = ["canvas", "surface", "surface-raised", "surface-soft"] as const;
const foregrounds = ["primary", "secondary", ...roles] as const;
const colors = [
  ["Canvas", "--ds-color-bg-canvas"],
  ["Surface", "--ds-color-bg-surface"],
  ["Raised", "--ds-color-bg-surface-raised"],
  ["Soft", "--ds-color-bg-surface-soft"],
  ["Inverse", "--ds-color-bg-inverse"],
  ...roles.map((role) => [role, `--ds-color-bg-${role}`]),
];

function ColorPair({
  id,
  background,
  foreground,
  border,
  children,
}: {
  id: string;
  background: string;
  foreground: string;
  border?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={styles.colorPair}
      data-token-pair={id}
      data-background={background}
      data-foreground={foreground}
      data-border={border}
      style={
        {
          "--sample-background": `var(--ds-color-${background})`,
          "--sample-foreground": `var(--ds-color-${foreground})`,
          "--sample-border": `var(--ds-color-${border ?? "border-default"})`,
        } as CSSProperties
      }
    >
      {children}
    </div>
  );
}

const radii = [
  ["Sm", "--radius-sm"],
  ["Control", "--radius-control"],
  ["Card", "--radius-card"],
  ["Hero", "--radius-hero"],
  ["Pill", "--radius-pill"],
] as const;

const elevations = [
  ["Control", "--shadow-control"],
  ["Card", "--shadow-card"],
  ["Hero", "--shadow-hero"],
] as const;

function SectionHeading({
  id,
  eyebrow,
  children,
}: {
  id: string;
  eyebrow: string;
  children: React.ReactNode;
}) {
  return (
    <header className={styles.sectionHeading}>
      <p>{eyebrow}</p>
      <h2 id={id}>{children}</h2>
    </header>
  );
}

export function Foundations() {
  return (
    <article className={catalogStyles.article}>
      <header className={catalogStyles.intro}>
        <nav className={catalogStyles.breadcrumbs} aria-label="Breadcrumbs">
          <Link href="/design-system">Design system</Link>
          <span>/</span>
          <span aria-current="page">Fundamentos</span>
        </nav>
        <h1>Fundamentos</h1>
        <p>
          Roles y escalas existentes. Los valores de las muestras se leen de los tokens y de sus
          estilos computados.
        </p>
      </header>
      <nav className={catalogStyles.anchors} aria-label="En esta página">
        <a href="#color">Color</a>
        <a href="#pares">Pares y contraste</a>
        <a href="#tipografia">Tipografía</a>
        <a href="#geometria">Geometría</a>
        <a href="#espaciado">Espaciado</a>
        <a href="#movimiento">Movimiento</a>
      </nav>
      <section>
        <h2>Elegir un rol</h2>
        <ul>
          <li>
            bg define fondos; fg define texto e iconos informativos; border define delimitadores.
          </li>
          <li>
            Sobre un sólido usa fg-on del mismo rol. Sobre inverse usa los foregrounds y bordes
            inverse.
          </li>
          <li>
            Secondary sirve para ayudas, placeholders y metadatos. Disabled y decorative no
            sustituyen a texto legible.
          </li>
          <li>
            Subtle, default, hover y brand delimitan superficies. Para indicadores esenciales usa
            strong, action o un borde de estado.
          </li>
          <li>
            Las superficies soft de estado son las mezclas canónicas; conserva la opacidad del texto
            informativo.
          </li>
        </ul>
      </section>
      <section className={styles.section} aria-labelledby="color">
        <SectionHeading id="color" eyebrow="01 · Fundamentos">
          Color y tipografía
        </SectionHeading>
        <div className={styles.swatchGrid}>
          {colors.map(([name, token]) => (
            <Card key={token} padding="compact" elevation="flat" className={styles.swatchCard}>
              <span
                className={styles.swatch}
                style={{ "--swatch-color": `var(${token})` } as CSSProperties}
              />
              <span>
                <strong>{name}</strong>
                <small>{token.replace("--ds-color-", "")}</small>
                <TokenValue token={token} color />
              </span>
            </Card>
          ))}
        </div>
        <Card id="tipografia" className={styles.typeSpecimen}>
          <p className={styles.displayType}>Hoy toca subir.</p>
          <p className={styles.displayTypeSoft}>La Pirámide se abre.</p>
          <p className={styles.uiType}>
            Manrope mantiene clara la interfaz incluso cuando aumenta la densidad de información.
          </p>
          <p className={styles.monoType}>02:14 · 680 ⚡</p>
        </Card>
        <div id="geometria" className={styles.foundationGrid}>
          <Card elevation="flat" className={styles.tokenPanel}>
            <h3>Radios</h3>
            <div className={styles.radiusSpecimens}>
              {radii.map(([name, token]) => (
                <span key={token}>
                  <i
                    className={styles.radiusShape}
                    style={{ "--sample-radius": `var(${token})` } as CSSProperties}
                  />
                  <strong>{name}</strong>
                  <TokenValue token={token} />
                </span>
              ))}
            </div>
          </Card>
          <Card elevation="flat" className={styles.tokenPanel}>
            <h3>Elevación</h3>
            <div className={styles.elevationSpecimens}>
              {elevations.map(([name, token]) => (
                <span key={token}>
                  <i
                    className={styles.elevationShape}
                    style={{ "--sample-shadow": `var(${token})` } as CSSProperties}
                  />
                  <strong>{name}</strong>
                  <TokenValue token={token} />
                </span>
              ))}
            </div>
          </Card>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="pares">
        <SectionHeading id="pares" eyebrow="Roles · Color y estados">
          Pares de color y contraste
        </SectionHeading>
        <p className={styles.roleHelp}>
          Texto normal: 4,5:1. Foco e indicadores esenciales: 3:1. Los bordes sutiles delimitan
          superficies; strong identifica controles.
        </p>
        {surfaces.map((surface) => (
          <div key={surface} className={styles.pairGrid}>
            {foregrounds.map((foreground) => (
              <ColorPair
                key={foreground}
                id={`${surface}-${foreground}`}
                background={`bg-${surface}`}
                foreground={`fg-${foreground}`}
              >
                {surface} · {foreground}
              </ColorPair>
            ))}
          </div>
        ))}
        <div className={styles.pairGrid}>
          {roles.flatMap((role) => [
            <ColorPair
              key={`${role}-solid`}
              id={`${role}-solid`}
              background={`bg-${role}`}
              foreground={`fg-on-${role}`}
            >
              {role} · sólido
            </ColorPair>,
            <ColorPair
              key={`${role}-light`}
              id={`${role}-light`}
              background={role === "brand" ? "bg-canvas" : `bg-${role}-soft`}
              foreground={`fg-${role}`}
              border={role === "brand" ? "border-action" : `border-${role}`}
            >
              {role} · claro
            </ColorPair>,
            <ColorPair
              key={`${role}-inverse`}
              id={`${role}-inverse`}
              background="bg-inverse"
              foreground={`fg-${role}-inverse`}
              border={`border-${role}-inverse`}
            >
              {role} · inverse
            </ColorPair>,
          ])}
          <ColorPair id="inverse-primary" background="bg-inverse" foreground="fg-on-inverse">
            Inverse · primary
          </ColorPair>
          <ColorPair
            id="inverse-secondary"
            background="bg-inverse"
            foreground="fg-secondary-inverse"
          >
            Inverse · secondary
          </ColorPair>
        </div>
        <div className={styles.pairGrid}>
          {["subtle", "default", "hover", "action", "strong", "brand"].map((border) => (
            <ColorPair
              key={border}
              id={`border-${border}`}
              background="bg-surface"
              foreground="fg-secondary"
              border={`border-${border}`}
            >
              Borde {border}
            </ColorPair>
          ))}
        </div>
        <Card className={styles.errorExamples}>
          <label htmlFor="ui-kit-email">Correo electrónico</label>
          <input
            id="ui-kit-email"
            type="email"
            defaultValue="ana@"
            aria-invalid="true"
            aria-describedby="ui-kit-email-help ui-kit-email-error"
          />
          <span id="ui-kit-email-help">Usa el correo asociado a tu cuenta.</span>
          <p id="ui-kit-email-error" className={styles.fieldError}>
            Introduce una dirección válida.
          </p>
          <ColorPair
            id="error-notice"
            background="bg-error-soft"
            foreground="fg-error"
            border="border-error"
          >
            No se pudo guardar. Revisa los campos indicados.
          </ColorPair>
          <ColorPair id="error-solid" background="bg-error" foreground="fg-on-error">
            Credenciales incorrectas. Vuelve a intentarlo.
          </ColorPair>
        </Card>
      </section>

      <FoundationScales />
    </article>
  );
}
