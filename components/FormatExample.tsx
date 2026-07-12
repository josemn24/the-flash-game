import { Badge } from "@/components/ui/Badge";
import type { Question } from "@/types/game";
import styles from "@/components/FormatLibrary.module.css";

export function FormatExample({ question }: { question: Question }) {
  return (
    <div className={styles.exampleCard}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <Badge>{question.category}</Badge>
        <span className="font-mono text-[10px] font-black tracking-widest text-white/30 uppercase">
          {question.timeLimit} s · {question.points} pts
        </span>
      </div>
      <h3>{question.question}</h3>
      <ExampleBody question={question} />
      <div className={styles.exampleExplanation}>
        <span>Solución comentada</span>
        <p>{question.explanation}</p>
      </div>
    </div>
  );
}

function ExampleBody({ question }: { question: Question }) {
  switch (question.type) {
    case "multiple-choice":
      return (
        <div className={styles.exampleOptions}>
          {question.options.map((option) => (
            <span key={option}>{option}</span>
          ))}
        </div>
      );
    case "true-false":
      return (
        <div className={styles.exampleOptions}>
          <span>Verdadero</span>
          <span>Falso</span>
        </div>
      );
    case "short-text":
      return <div className={styles.exampleInput}>Escribe una respuesta breve…</div>;
    case "ordering":
      return (
        <div className={styles.exampleStack}>
          {question.items.map((item, index) => (
            <span key={item}>
              <b>{index + 1}</b>
              {item}
            </span>
          ))}
        </div>
      );
    case "classification":
      return (
        <div className={styles.exampleStack}>
          {question.items.map((item) => (
            <span key={item.label}>
              {item.label}
              <small>{question.categories.join(" · ")}</small>
            </span>
          ))}
        </div>
      );
    case "logic-code":
      return (
        <div className={styles.exampleStack}>
          {question.clues.map((clue) => (
            <span key={clue.code}>
              <b>{clue.code}</b>
              {clue.hint}
            </span>
          ))}
        </div>
      );
    case "estimation":
      return (
        <div className={styles.exampleRange}>
          <span>
            {question.min} {question.unit}
          </span>
          <i />
          <strong>
            {question.initialValue} {question.unit}
          </strong>
          <i />
          <span>
            {question.max} {question.unit}
          </span>
        </div>
      );
  }
}
