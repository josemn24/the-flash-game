import { notFound, redirect } from "next/navigation";
import { AuthenticationRequiredError, SuperadminAccessDeniedError } from "@/application/administration/errors";
import { QuestionVersionEditor } from "@/components/admin/QuestionVersionEditor.client";
import { requireSuperadmin } from "@/server/admin";
import { supabaseSuperadminEditorialQueries } from "@/infrastructure/supabase/superadminEditorialQueries";

export const dynamic = "force-dynamic";

async function loadQuestionVersion(questionVersionId: string) {
  try {
    await requireSuperadmin();
    return await supabaseSuperadminEditorialQueries.getQuestionVersion(questionVersionId);
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) redirect("/");
    if (error instanceof SuperadminAccessDeniedError) notFound();
    if (error instanceof Error && error.message.includes("content_not_found")) notFound();
    throw error;
  }
}

export default async function QuestionVersionPage({ params }: { readonly params: Promise<{ questionVersionId: string }> }) {
  const { questionVersionId } = await params;
  const detail = await loadQuestionVersion(questionVersionId);
  return <QuestionVersionEditor detail={detail} />;
}
