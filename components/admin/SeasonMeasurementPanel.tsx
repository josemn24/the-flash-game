import Link from "next/link";
import { Button, Card } from "@/components/ui";
import type { SeasonMeasurementReport } from "@/types/contracts/room-measurement";
import { seasonMetricLabels } from "@/lib/seasonMeasurement";

const statuses: Record<string, string> = {
  draft: "Borrador",
  scheduled: "Programada",
  active: "Activa",
  finished: "Finalizada",
  cancelled: "Cancelada",
  completed: "Completado",
  abandoned: "Abandonado",
  invalidated: "Invalidado",
  in_progress: "En curso",
  not_started: "Sin intento",
  unavailable: "Sin oportunidad",
  upcoming: "Pendiente de apertura",
};
const percent = (n: number, d: number) => (d ? `${Math.round((100 * n) / d)} %` : "—");
export function SeasonMeasurementPanel({
  report,
  timeZone,
  page = 1,
}: {
  report: SeasonMeasurementReport;
  timeZone: string;
  page?: number;
}) {
  const { sources, metrics } = report;
  const { season } = sources;
  const base = `/admin/rooms/${sources.roomId}/measurement`;
  const date = (v: string) =>
    new Intl.DateTimeFormat("es-ES", { dateStyle: "short", timeStyle: "short", timeZone }).format(
      new Date(v),
    );
  const pages = Math.max(1, Math.ceil(report.participants.length / 50));
  const current = Math.min(page, pages);
  const visible = report.participants.slice((current - 1) * 50, current * 50);
  return (
    <div className="grid gap-5">
      <header>
        <h1 className="text-2xl font-bold">Medición de temporada</h1>
        <p className="mt-2">
          La actividad de {sources.roomTitle} se registra automáticamente. Consulta la participación
          y descarga los datos para analizarlos.
        </p>
        <p className="mt-2 text-sm">
          Las métricas describen la actividad de la temporada. Los objetivos y criterios de éxito se
          evalúan en el análisis posterior.
        </p>
      </header>
      {sources.seasons.length ? (
        <form action={base} method="get" className="flex flex-wrap items-end gap-3">
          <div className="grid gap-1">
            <label htmlFor="measurement-season">Temporada</label>
            <select
              id="measurement-season"
              className="rounded border p-2"
              name="season"
              defaultValue={season?.seasonId}
            >
              {sources.seasons.map((s) => (
                <option key={s.seasonId} value={s.seasonId}>
                  {s.title} · {statuses[s.status]}
                </option>
              ))}
            </select>
          </div>
          <Button type="submit">Ver temporada</Button>
        </form>
      ) : null}
      {!season ? (
        <Card>
          <p>Todavía no hay temporadas. La medición estará disponible cuando crees la primera.</p>
          <Link
            className="mt-3 inline-block underline"
            href={`/admin/rooms/${sources.roomId}?tab=seasons`}
          >
            Gestionar temporadas
          </Link>
        </Card>
      ) : (
        <>
          <Card>
            <h2 className="text-xl font-semibold">{season.title}</h2>
            <p>
              {statuses[season.status]} · {date(season.startsAt)} – {date(season.endsAt)}
            </p>
            <p className="mt-3">
              {report.participants.length} personas incluidas · {report.publications.length}{" "}
              desafíos incluidos
            </p>
            <p className="mt-2 text-sm">
              Los participantes y desafíos se incorporan automáticamente. Se excluyen espectadores y
              cuentas operativas. Las oportunidades anteriores a la incorporación de una persona no
              se consideran desafíos pendientes.
            </p>
            <p className="mt-2 text-sm">
              Se incluyen las partidas históricas disponibles, también las de prueba. Las visitas,
              consultas y ensayos locales solo están disponibles desde{" "}
              {sources.startedAt ? date(sources.startedAt) : "el inicio de la captura"}.
            </p>
            <p className="mt-2 text-sm">Actualizado: {date(sources.generatedAt)}.</p>
          </Card>
          <section
            className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
            aria-label="Resumen de actividad"
          >
            {Object.entries(seasonMetricLabels).map(([key, label]) => (
              <Card key={key}>
                <p className="text-sm">{label}</p>
                <p className="mt-2 text-2xl font-semibold">
                  {metrics[key as keyof typeof metrics]}
                </p>
              </Card>
            ))}
          </section>
          <Card>
            <p>
              {report.activePeople} de {report.participants.length} personas han iniciado algún
              desafío ({percent(report.activePeople, report.participants.length)}).
            </p>
            <p>
              {metrics.competitiveCompletions} de {report.opportunities} oportunidades completadas (
              {percent(metrics.competitiveCompletions, report.opportunities)}).
            </p>
            <p className="mt-2 text-sm">
              Las oportunidades son las parejas de persona y desafío que ya han tenido una ventana
              disponible. Se excluyen desafíos futuros, cancelados o cerrados antes de la
              incorporación. Este porcentaje usa el alcance de la temporada, que puede crecer con
              nuevas incorporaciones.
            </p>
            <p className="mt-2 text-sm">
              Una persona vuelve cuando inicia partidas no invalidadas en dos desafíos distintos; no
              exige completarlos ni jugar en días diferentes. Las finalizaciones incluyen derrotas y
              cero puntos. Las visitas cuentan observaciones, no personas únicas; la ausencia de
              eventos no demuestra ausencia de uso.
            </p>
          </Card>
          <Card>
            <h2 className="mb-3 text-lg font-semibold">Exportar datos</h2>
            <p className="mb-3 text-sm">
              Los CSV reflejan el estado disponible en la fecha de descarga. Conserva la extracción
              utilizada para cada análisis; una descarga posterior puede contener cambios.
            </p>
            <div className="flex flex-wrap gap-4">
              {(
                [
                  ["participants", "Personas"],
                  ["participation", "Participación por desafío"],
                  ["challenges", "Desafíos"],
                  ["summary", "Resumen"],
                ] as const
              ).map(([dataset, label]) => (
                <Link
                  key={dataset}
                  className="underline"
                  prefetch={false}
                  href={`${base}/export?season=${season.seasonId}&dataset=${dataset}`}
                >
                  CSV: {label}
                </Link>
              ))}
            </div>
          </Card>
          <Card>
            <h2 className="mb-3 text-lg font-semibold">Actividad por desafío</h2>
            {report.publications.length ? (
              <div className="overflow-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr>
                      {[
                        "Desafío",
                        "Aperturas",
                        "Inicios",
                        "Finalizaciones / oportunidades",
                        "Prácticas iniciadas / finalizadas",
                        "Disfrute (mediana; respuestas)",
                      ].map((label) => (
                        <th className="border p-2" key={label}>
                          {label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {report.publications.map((p) => (
                      <tr key={p.publicationId}>
                        <th className="border p-2">
                          {p.number}. {p.title}
                          <p className="font-normal">{date(p.opensAt)}</p>
                        </th>
                        <td className="border p-2">{p.metrics.challengeOpens}</td>
                        <td className="border p-2">{p.metrics.competitiveStarts}</td>
                        <td className="border p-2">
                          {p.metrics.competitiveCompletions} / {p.opportunities}
                        </td>
                        <td className="border p-2">
                          {p.metrics.practiceStarts} / {p.metrics.practiceCompletions}
                        </td>
                        <td className="border p-2">
                          {p.enjoyment ?? "—"} · {p.ratingCount} respuestas
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p>Los desafíos aparecerán aquí cuando se añadan a la temporada.</p>
            )}
          </Card>
          <Card>
            <h2 className="mb-3 text-lg font-semibold">Participación por persona</h2>
            <p className="mb-3 text-sm">
              Abre una persona para ver su actividad y el resultado de cada desafío. El disfrute es
              opcional, en una escala de 1 a 5.
            </p>
            {visible.length ? (
              visible.map((p) => (
                <details key={p.playerId} className="my-2 rounded border p-3">
                  <summary className="cursor-pointer">
                    {p.displayName} · {p.metrics.competitiveCompletions} / {p.opportunities}{" "}
                    desafíos completados
                  </summary>
                  <dl className="my-3 grid gap-3 sm:grid-cols-3">
                    {Object.entries(seasonMetricLabels)
                      .filter(([key]) => key !== "returningPeople")
                      .map(([key, label]) => (
                        <div key={key}>
                          <dt className="text-sm">{label}</dt>
                          <dd className="font-semibold">
                            {p.metrics[key as keyof typeof p.metrics]}
                          </dd>
                        </div>
                      ))}
                  </dl>
                  <div className="overflow-auto">
                    <table
                      className="w-full text-left text-sm"
                      aria-label={`Desafíos de ${p.displayName}`}
                    >
                      <thead>
                        <tr>
                          {["Desafío", "Estado", "Puntos", "Disfrute"].map((label) => (
                            <th key={label} className="border p-2">
                              {label}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {report.publications.map((publication) => {
                          const cell = report.cells.find(
                            (c) =>
                              c.playerId === p.playerId &&
                              c.publicationId === publication.publicationId,
                          )!;
                          return (
                            <tr key={publication.publicationId}>
                              <th className="border p-2">
                                {publication.number}. {publication.title}
                              </th>
                              <td className="border p-2">
                                {cell.attemptId ? (
                                  <Link
                                    className="underline"
                                    href={`/admin/rooms/${sources.roomId}/attempts/${publication.publicationId}/${cell.attemptId}`}
                                  >
                                    {statuses[cell.status] ?? cell.status}
                                  </Link>
                                ) : (
                                  statuses[cell.status]
                                )}
                              </td>
                              <td className="border p-2">{cell.score ?? "—"}</td>
                              <td className="border p-2">{cell.rating ?? "—"}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </details>
              ))
            ) : (
              <p>
                Todavía no hay participantes elegibles. Se incorporarán automáticamente al entrar en
                la sala.
              </p>
            )}
            {pages > 1 ? (
              <nav className="mt-4 flex gap-4" aria-label="Páginas de participantes">
                {current > 1 ? (
                  <Link href={`${base}?season=${season.seasonId}&page=${current - 1}`}>
                    Anterior
                  </Link>
                ) : null}
                <span>
                  Página {current} de {pages}
                </span>
                {current < pages ? (
                  <Link href={`${base}?season=${season.seasonId}&page=${current + 1}`}>
                    Siguiente
                  </Link>
                ) : null}
              </nav>
            ) : null}
          </Card>
        </>
      )}
    </div>
  );
}
