import type { Metadata } from "next";
import Link from "next/link";
import { ButtonsExample } from "@/features/design-system/examples/ComponentExamples.client";
import styles from "@/features/design-system/Catalog.module.css";
export const metadata: Metadata = { title: "Accesibilidad" };
export default function AccessibilityPage() {
  return (
    <article className={styles.article}>
      <header className={styles.intro}>
        <nav className={styles.breadcrumbs} aria-label="Breadcrumbs">
          <Link href="/design-system">Design system</Link>
          <span>/</span>
          <span aria-current="page">Accesibilidad</span>
        </nav>
        <h1>Accesibilidad</h1>
        <p>
          Los ejemplos permiten comprobar los contratos existentes con teclado y preferencias del
          sistema.
        </p>
      </header>
      <nav className={styles.anchors} aria-label="En esta página">
        <a href="#teclado">Teclado</a>
        <a href="#contraste">Contraste</a>
        <a href="#estados">Estados</a>
        <a href="#movimiento">Movimiento</a>
      </nav>
      <section id="teclado">
        <h2>Teclado y foco</h2>
        <ul>
          <li>
            Tab y Shift+Tab recorren controles en orden lógico; Enter activa enlaces y botones;
            Espacio activa botones y detalles.
          </li>
          <li>El enlace Saltar al contenido evita repetir la navegación del catálogo.</li>
          <li>
            El foco visible usa focus-ring en superficies claras; sobre inverse utiliza un indicador
            inverse contrastado.
          </li>
          <li>
            Los controles deshabilitados conservan su semántica nativa y no se sustituyen por un
            cambio de color.
          </li>
        </ul>
        <ButtonsExample />
      </section>
      <section id="contraste">
        <h2>Contraste y señales</h2>
        <p>
          Texto normal: al menos 4,5:1. Foco e indicadores esenciales: al menos 3:1. Disabled y
          decorative son excepciones para usos específicos, no para ayudas o metadatos.
        </p>
        <p>
          Comprueba los <Link href="/design-system/fundamentos#pares">pares reales de color</Link>.
          Acompaña estados con texto, iconos o patrones; no comuniques resultados únicamente
          mediante color.
        </p>
      </section>
      <section id="estados">
        <h2>Formularios y anuncios de estado</h2>
        <ul>
          <li>
            Asocia label, ayuda y error mediante IDs únicos; aria-invalid identifica un campo
            inválido.
          </li>
          <li>
            role=status y aria-live=polite anuncian resultados sin interrumpir innecesariamente.
          </li>
          <li>role=alert se reserva para errores que necesitan atención inmediata.</li>
          <li>
            Los previews tienen título y documento propio para conservar encabezados y landmarks de
            las vistas completas.
          </li>
        </ul>
        <p>
          Prueba la <Link href="/design-system/patrones/formularios">validación guiada</Link> y la{" "}
          <Link href="/design-system/patrones/revision">revisión con details</Link>.
        </p>
      </section>
      <section id="movimiento">
        <h2>Movimiento reducido</h2>
        <p>
          Con prefers-reduced-motion: reduce, las reglas globales reducen transiciones y animaciones
          CSS. Las animaciones JavaScript de MotionButton y feedback se documentan tal como existen;
          requieren revisar su contrato específico antes de prometer una alternativa sin movimiento.
        </p>
        <p>
          El temporizador conserva el dato temporal: reducir movimiento no pausa una cuenta atrás.
        </p>
        <p>
          La comprobación automática se complementa con una revisión manual de teclado y anuncios
          mediante lector de pantalla.
        </p>
      </section>
    </article>
  );
}
