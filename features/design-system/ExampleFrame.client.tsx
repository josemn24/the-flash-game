"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import styles from "./Catalog.module.css";

export function ExampleFrame({ id, title }: { id: string; title: string }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const observer = useRef<ResizeObserver | null>(null);
  const [height, setHeight] = useState(640);
  const observe = useCallback(() => {
    observer.current?.disconnect();
    const content =
      frame.current?.contentDocument?.querySelector<HTMLElement>("[data-preview-content]");
    if (!content) return;
    const minimum = ["superficies", "feedback", "carga-vacio"].includes(id) ? 640 : 240;
    const measure = () =>
      setHeight(Math.max(minimum, Math.ceil(content.getBoundingClientRect().height)));
    observer.current = new ResizeObserver(measure);
    observer.current.observe(content);
    measure();
  }, [id]);
  useEffect(() => () => observer.current?.disconnect(), []);
  return (
    <>
      <div id={`example-controls-${id}`} />
      <iframe
        ref={frame}
        className={styles.frame}
        title={title}
        src={`/design-system/preview/${id}`}
        height={height}
        onLoad={observe}
      />
    </>
  );
}
