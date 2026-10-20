import { notFound } from "next/navigation";
import { RehearsalGameApp } from "@/components/game/production";
import { ButtonLink, Canvas, Card } from "@/components/ui";
import { getPlayerRehearsal } from "@/server/production-rehearsal-data-access";

export const dynamic = "force-dynamic";
export const metadata = { title: "Partida de prueba — The Flash" };
export default async function RehearsalPage({
  params,
  searchParams,
}: {
  params: Promise<{ challengeId: string }>;
  searchParams: Promise<{ roomId?: string | string[] }>;
}) {
  const { challengeId } = await params;
  const query = await searchParams;
  const roomId = Array.isArray(query.roomId) ? query.roomId[0] : query.roomId;
  if (!roomId) notFound();
  const returnTo = `/desafios/${encodeURIComponent(challengeId)}?roomId=${encodeURIComponent(roomId)}`;
  let rehearsal: Awaited<ReturnType<typeof getPlayerRehearsal>> = null;
  let failed = false;
  try {
    rehearsal = await getPlayerRehearsal(roomId, challengeId);
  } catch {
    failed = true;
  }
  if (failed)
    return (
      <Canvas maxWidth="content">
        <Card>
          <h1>No se pudo cargar la prueba</h1>
          <p>La partida oficial sigue disponible cuando corresponda.</p>
          <a
            href={`/desafios/${encodeURIComponent(challengeId)}/prueba?roomId=${encodeURIComponent(roomId)}`}
          >
            Reintentar
          </a>
          <ButtonLink href={returnTo} prefetch={false}>
            Volver al desafío
          </ButtonLink>
        </Card>
      </Canvas>
    );
  if (rehearsal)
    return (
      <RehearsalGameApp
        definition={rehearsal.definition}
        reference={rehearsal.ref}
        returnTo={returnTo}
      />
    );
  notFound();
}
