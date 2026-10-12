"use client";
import { useState } from "react";
import {
  Avatar,
  AvatarStack,
  BackButton,
  BackLink,
  Button,
  ButtonLink,
  Card,
  Canvas,
  Chip,
  GameHeader,
  IconButton,
  MotionButton,
  Timer,
  TimerDisplay,
  ArrowIcon,
  BellIcon,
  BoltIcon,
  CheckIcon,
  CrossIcon,
  type AvatarTone,
  type CardProps,
} from "@/components/ui";
import * as icons from "@/components/ui/icons";
import type { ButtonSize } from "@/components/ui/buttonStyles";
import { participants } from "./fixtures";
import styles from "../Catalog.module.css";

export function ButtonsExample() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("Sin acciones todavía.");
  return (
    <div className={styles.demo} data-example="botones">
      <div className={styles.row}>
        <Button
          loading={busy}
          trailingIcon={<ArrowIcon />}
          onClick={() => {
            setBusy(true);
            setMessage("Guardando localmente…");
          }}
        >
          Guardar ejemplo
        </Button>
        <Button
          variant="secondary"
          disabled={!busy}
          onClick={() => {
            setBusy(false);
            setMessage("Ejemplo guardado.");
          }}
        >
          Completar simulación
        </Button>
        <Button disabled>Acción no disponible</Button>
      </div>
      <div className={styles.row}>
        {(["sm", "md", "lg", "default", "hero"] satisfies ButtonSize[]).map((size) => (
          <Button
            key={size}
            size={size}
            variant="secondary"
            onClick={() => setMessage(`Tamaño ${size} seleccionado.`)}
          >
            {size}
          </Button>
        ))}
      </div>
      <div className={styles.row}>
        <Button
          leadingIcon={<BoltIcon />}
          onClick={() => setMessage("Acción con icono realizada.")}
        >
          Ver progreso
        </Button>
        <ButtonLink href="/design-system/fundamentos" variant="secondary">
          Ver fundamentos
        </ButtonLink>
        <MotionButton
          whileTap={{ scale: 0.98 }}
          onClick={() => setMessage("Acción animada realizada.")}
        >
          Acción animada
        </MotionButton>
        <IconButton
          label="Notificaciones de ejemplo"
          onClick={() => setMessage("No hay nuevas notificaciones.")}
        >
          <BellIcon />
        </IconButton>
        <IconButton
          label="Progreso social de ejemplo"
          variant="social"
          onClick={() => setMessage("Progreso social consultado.")}
        >
          <BoltIcon />
        </IconButton>
      </div>
      <div
        className={styles.longTextDemo}
        role="region"
        aria-label="Ejemplo de texto largo"
        tabIndex={0}
      >
        <div className={styles.longControl}>
          <Button fullWidth onClick={() => setMessage("Acción de anchura completa realizada.")}>
            Continuar con este texto deliberadamente más largo
          </Button>
        </div>
      </div>
      <p className={styles.caption}>
        Button conserva el texto en una línea. Este ejemplo permite desplazarlo cuando no cabe;
        revisa la longitud de la etiqueta antes de usarlo en una pantalla estrecha.
      </p>
      <p className={styles.result} role="status">
        {message}
      </p>
      <Button
        variant="secondary"
        size="sm"
        onClick={() => {
          setBusy(false);
          setMessage("Sin acciones todavía.");
        }}
      >
        Reiniciar ejemplo
      </Button>
    </div>
  );
}

export function ChipsExample() {
  return (
    <div className={styles.demo} data-example="chips">
      <div className={styles.row}>
        <Chip>Disponible</Chip>
        <Chip tone="social">Nuevo</Chip>
        <Chip tone="info">En progreso</Chip>
        <Chip tone="success" icon={<CheckIcon />}>
          Completado
        </Chip>
        <Chip tone="danger" icon={<CrossIcon />}>
          Cerrado
        </Chip>
        <Chip variant="data">2 h 14 min</Chip>
        <Chip variant="flashPoints" ariaLabel="Hasta 100 Flash Points">
          +100 ⚡
        </Chip>
      </div>
      <p className={styles.caption}>Etiquetas informativas: no ejecutan acciones.</p>
    </div>
  );
}

export function AvatarsExample() {
  const [limit, setLimit] = useState(3);
  return (
    <div className={styles.demo} data-example="avatares">
      <div className={styles.row}>
        {(["social", "coral", "blue", "aqua", "ink", "reward"] satisfies AvatarTone[]).map(
          (tone) => (
            <div key={tone} className={styles.stack}>
              <Avatar name={`Persona ${tone}`} tone={tone} />
              <span className={styles.caption}>{tone}</span>
            </div>
          ),
        )}
      </div>
      <div className={styles.row}>
        <Avatar name="Ana Moreno" size="sm" />
        <Avatar name="Luis Úbeda" size="md" />
        <Avatar name="Rocío del Mar" size="lg" />
        <Avatar name="Imagen local de ejemplo" src="/icons/the-flash-192.png" size="lg" />
        <Avatar name="Iniciales explícitas" initials="01" tone="reward" />
      </div>
      <AvatarStack items={participants.slice(0, 2)} label="2 participantes" />
      <label className={styles.controlLabel}>
        Avatares visibles
        <select
          className={styles.select}
          value={limit}
          onChange={(event) => setLimit(Number(event.currentTarget.value))}
        >
          {[2, 3, 4, 6].map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
      </label>
      <AvatarStack items={participants} maxVisible={limit} label="6 participantes" />
      <Button variant="secondary" size="sm" onClick={() => setLimit(3)}>
        Reiniciar ejemplo
      </Button>
    </div>
  );
}

export function SurfacesExample() {
  const [width, setWidth] = useState<"wide" | "content" | "none">("content");
  return (
    <Canvas maxWidth={width}>
      <div className={styles.stack} data-example="superficies">
        <h1>Canvas y tarjetas</h1>
        <label className={styles.controlLabel}>
          Anchura de Canvas
          <select
            className={styles.select}
            value={width}
            onChange={(event) => setWidth(event.currentTarget.value as typeof width)}
          >
            {["wide", "content", "none"].map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>
        <div className={styles.grid}>
          {(["surface", "soft"] as const).flatMap((surface) =>
            (["flat", "card", "hero"] as const).map((elevation) => (
              <Card key={`${surface}-${elevation}`} surface={surface} elevation={elevation}>
                <strong>
                  {surface} · {elevation}
                </strong>
                <p>Contenido de una tarjeta real.</p>
              </Card>
            )),
          )}
          {(["none", "compact", "default"] satisfies NonNullable<CardProps["density"]>[]).map(
            (density) => (
              <Card key={density} density={density}>
                <span>Densidad {density}</span>
              </Card>
            ),
          )}
        </div>
        <p className={styles.caption}>
          density tiene prioridad sobre padding. Este ejemplo conserva la geometría del componente.
        </p>
        <Button variant="secondary" size="sm" onClick={() => setWidth("content")}>
          Reiniciar ejemplo
        </Button>
      </div>
    </Canvas>
  );
}

export function NavigationExample() {
  const [custom, setCustom] = useState(false);
  const [message, setMessage] = useState("Contexto inicial.");
  return (
    <div className={styles.demo} data-example="navegacion">
      <GameHeader
        title="La Pirámide"
        left={custom ? <strong>Contexto propio</strong> : undefined}
        mobileLabel="Nivel 2"
        mobileLabelAriaLabel="Nivel 2 de La Pirámide"
        timer={<TimerDisplay duration={20} remaining={14} size="compact" />}
        action={
          <BackButton
            label="Volver en el ejemplo"
            onClick={() => setMessage("Has vuelto al contexto anterior.")}
          />
        }
      />
      <div className={styles.row}>
        <Button variant="secondary" size="sm" onClick={() => setCustom((value) => !value)}>
          Alternar identidad
        </Button>
        <BackLink label="Volver al catálogo" href="/design-system" />
        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            setCustom(false);
            setMessage("Contexto inicial.");
          }}
        >
          Reiniciar ejemplo
        </Button>
      </div>
      <p className={styles.result} role="status">
        {message}
      </p>
    </div>
  );
}

export function TimersExample() {
  const [active, setActive] = useState(false);
  const [finished, setFinished] = useState(false);
  const [cycle, setCycle] = useState(0);
  return (
    <div className={styles.demo} data-example="temporizadores">
      <div className={styles.row}>
        <TimerDisplay duration={20} remaining={14} />
        <TimerDisplay duration={20} remaining={4} />
        <TimerDisplay duration={20} remaining={0} />
        <TimerDisplay duration={20} remaining={20} size="compact" />
      </div>
      <div className={styles.row}>
        <Timer duration={20} active={active} resetKey={cycle} onTimeUp={() => setFinished(true)} />
        <Button disabled={active} onClick={() => setActive(true)}>
          Iniciar cuenta
        </Button>
        <Button
          variant="secondary"
          onClick={() => {
            setCycle((value) => value + 1);
            setActive(false);
            setFinished(false);
          }}
        >
          Reiniciar cuenta
        </Button>
      </div>
      <p className={styles.result} role="status">
        {finished ? "Tiempo agotado." : active ? "Cuenta en marcha." : "Cuenta preparada."}
      </p>
    </div>
  );
}

export function IconsExample() {
  return (
    <div className={styles.demo} data-example="iconos">
      <div className={styles.iconGrid}>
        {Object.entries(icons).map(([name, Icon]) => (
          <div key={name} className={styles.iconItem}>
            <Icon />
            <code>{name}</code>
          </div>
        ))}
      </div>
      <p className={styles.row}>
        <CheckIcon width={24} height={24} /> Completado: el icono es decorativo.
      </p>
      <p className={styles.row}>
        <icons.WarningIcon
          role="img"
          aria-hidden={false}
          aria-label="Atención"
          width={24}
          height={24}
        />{" "}
        Icono con nombre accesible.
      </p>
    </div>
  );
}
