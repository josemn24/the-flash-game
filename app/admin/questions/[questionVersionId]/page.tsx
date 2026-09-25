import { notFound, redirect } from "next/navigation";
import { AuthenticationRequiredError, SuperadminAccessDeniedError } from "@/application/administration/errors";
import { AdminShell } from "@/components/admin";
import { QuestionVersionEditor } from "@/components/admin/QuestionVersionEditor.client";
import { getSuperadminQuestionVersionPageModel } from "@/server/data-access";

export const dynamic = "force-dynamic";

async function loadQuestionVersion(questionVersionId: string) {
  try {
    return await getSuperadminQuestionVersionPageModel(questionVersionId);
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
  return (
    <AdminShell
      operator={detail.operator}
      activeSection="questions"
      breadcrumbs={[{ label: "Resumen", href: "/admin" }, { label: "Preguntas", href: "/admin/questions" }, { label: "Editar pregunta" }]}
    >
      <QuestionVersionEditor detail={detail.detail} />
    </AdminShell>
  );
}
